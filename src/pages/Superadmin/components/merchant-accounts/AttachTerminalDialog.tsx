/**
 * AttachTerminalDialog — pull an existing terminal from another venue into
 * the current AngelPay wizard's venue context (Task 54 — wizard consolidation).
 *
 * Why it exists:
 *   The AngelPay onboarding wizard (Section A in `ManualAccountDialog`)
 *   needs at least one NEXGO terminal physically present at the venue before
 *   merchants can be approved. Sometimes the terminal has already been
 *   registered at a *different* venue (op was unsure which venue would own
 *   it, or it's being repurposed). Rather than forcing the operator to
 *   delete + re-create the terminal (and lose its activation history /
 *   serial → terminalId mapping), they can move it here.
 *
 * Behavior:
 *   - Lists every ACTIVE terminal of the requested brand (typically NEXGO)
 *     that is NOT currently parented to `targetVenueId`.
 *   - Per-row "Mover aquí" → confirm dialog → PATCH the terminal with the
 *     new venueId. Backend clears `assignedMerchantIds` atomically (the
 *     existing assignments belong to the old venue's tenant scope and
 *     would be invalid in the new venue's slots).
 *   - On success: query invalidation on superadmin-terminals (so Section A
 *     in the wizard refreshes immediately) + venue-payment-config (the old
 *     venue's slots may now reference a now-unassigned merchant — visual
 *     refresh only, no data corruption).
 *
 * Out of scope (intentional MVP):
 *   - Moving INACTIVE / RETIRED terminals (operator should re-activate or
 *     create new).
 *   - Bulk move (one row at a time keeps the confirmation honest).
 *   - Recovering old assignedMerchantIds after a move (they're gone by
 *     design — see backend comment in `updateTerminal`).
 */

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, Loader2, Search } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { includesNormalized } from '@/lib/utils'
import { terminalAPI, type Terminal } from '@/services/superadmin-terminals.service'

export interface AttachTerminalDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** Venue that should own the terminal after the move. */
  targetVenueId: string
  /** Brand filter — only terminals matching this brand appear in the list. */
  targetBrand: string
  /** Fired after a successful move so the parent can refresh local state. */
  onAttached?: () => void
}

export function AttachTerminalDialog({
  open,
  onOpenChange,
  targetVenueId,
  targetBrand,
  onAttached,
}: AttachTerminalDialogProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [pendingMove, setPendingMove] = useState<Terminal | null>(null)

  // Cross-venue terminal pool. Filter client-side because the backend
  // endpoint takes a single venueId filter and we want "everything *except*
  // this venue" (the inverse). The list is small enough (hundreds, not
  // thousands) that this is fine for the MVP.
  const { data: allTerminals = [], isLoading } = useQuery({
    queryKey: ['superadmin-terminals', 'attach-dialog', targetBrand],
    queryFn: () => terminalAPI.getAllTerminals({ status: 'ACTIVE' }),
    enabled: open,
  })

  const candidates = allTerminals.filter(
    (t) =>
      (t.brand?.toUpperCase() === targetBrand.toUpperCase()) &&
      t.venueId !== targetVenueId &&
      (search.trim() === '' ||
        includesNormalized(t.name, search) ||
        includesNormalized(t.serialNumber, search) ||
        includesNormalized(t.venue?.name ?? '', search)),
  )

  const moveMutation = useMutation({
    mutationFn: (terminalId: string) => terminalAPI.updateTerminal(terminalId, { venueId: targetVenueId }),
    onSuccess: () => {
      // Section A subsection in the wizard reads from `superadmin-terminals`.
      // Other dashboard surfaces (Terminals page, merchant rows) read from
      // `terminals`. Invalidate both. Venue payment config of the *source*
      // venue may now reference a merchant with 0 active terminals — that's
      // surfaced visually elsewhere, no data fix needed here.
      queryClient.invalidateQueries({ queryKey: ['superadmin-terminals'] })
      queryClient.invalidateQueries({ queryKey: ['terminals'] })
      queryClient.invalidateQueries({ queryKey: ['venue-payment-config'] })
      toast({
        title: 'Terminal movida',
        description: `Ahora pertenece al venue actual. La TPV recogerá el cambio en su próximo heartbeat (~30s).`,
      })
      setPendingMove(null)
      onAttached?.()
      onOpenChange(false)
    },
    onError: (err: any) => {
      toast({
        title: 'No se pudo mover la terminal',
        description: err?.response?.data?.message || err?.message || 'Error desconocido',
        variant: 'destructive',
      })
      setPendingMove(null)
    },
  })

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[640px] max-h-[80vh] overflow-y-auto bg-background">
          <DialogHeader>
            <DialogTitle>Anexar terminal existente</DialogTitle>
            <DialogDescription>
              Terminales <strong>{targetBrand}</strong> registradas en otros venues. Selecciona la que físicamente
              pertenece a este venue para reasignarla aquí.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, serial, venue…"
                className="pl-9 bg-background border-input"
              />
            </div>

            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando terminales…
              </div>
            )}

            {!isLoading && candidates.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6 border rounded-md bg-muted/30">
                No hay terminales <strong>{targetBrand}</strong> en otros venues. Usa "Crear terminal nueva" para
                registrar una.
              </div>
            )}

            {!isLoading &&
              candidates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 p-3 border rounded-md bg-muted/30 flex-wrap"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{t.name}</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {t.serialNumber}
                      </Badge>
                      {t.brand && <Badge variant="secondary">{t.brand}</Badge>}
                      {t.model && <span className="text-xs text-muted-foreground">{t.model}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Actualmente en: <span className="font-medium">{t.venue?.name ?? '—'}</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={moveMutation.isPending}
                    onClick={() => setPendingMove(t)}
                  >
                    <ArrowRightLeft className="w-4 h-4 mr-2" />
                    Mover aquí
                  </Button>
                </div>
              ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={moveMutation.isPending}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingMove}
        onOpenChange={(v) => {
          if (!v && !moveMutation.isPending) setPendingMove(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Mover esta terminal?</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <p>
                  Esto moverá <strong>{pendingMove?.name}</strong> ({pendingMove?.serialNumber}) del venue{' '}
                  <strong>{pendingMove?.venue?.name}</strong> al venue actual.
                </p>
                <p className="text-xs">
                  Las asignaciones de merchants en el venue origen se borrarán (las asignaciones cross-tenant no son
                  válidas). La TPV recogerá el cambio en su próximo heartbeat (~30s).
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={moveMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (pendingMove) moveMutation.mutate(pendingMove.id)
              }}
              disabled={moveMutation.isPending}
            >
              {moveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Mover terminal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default AttachTerminalDialog
