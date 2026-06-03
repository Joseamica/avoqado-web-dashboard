import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react'

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { SearchCombobox, type SearchComboboxItem } from '@/components/search-combobox'
import { useToast } from '@/hooks/use-toast'
import { includesNormalized } from '@/lib/utils'
import { getAllVenues } from '@/services/superadmin.service'
import { terminalAPI, type Terminal, type PreflightResult } from '@/services/superadmin-terminals.service'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  terminal: Terminal | null
}

type Step = 'pickVenue' | 'preflight' | 'confirm' | 'progress'

const POLL_TIMEOUT_MS = 10 * 60 * 1000 // 10 min — after this, surface the "device hasn't returned" guidance

export default function MigrateTerminalWizard({ open, onOpenChange, terminal }: Props) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [step, setStep] = useState<Step>('pickVenue')
  const [search, setSearch] = useState('')
  const [toVenueId, setToVenueId] = useState('')
  const [preflight, setPreflight] = useState<PreflightResult | null>(null)
  const [commandId, setCommandId] = useState<string | null>(null)
  const [progressSticky, setProgressSticky] = useState({ delivered: false, rebound: false, online: false })

  const { data: venues = [] } = useQuery({ queryKey: ['venues'], queryFn: () => getAllVenues() })
  const venueItems = useMemo<SearchComboboxItem[]>(
    () => venues
      .filter((v) => v.id !== terminal?.venueId && (!search || includesNormalized(v.name ?? '', search)))
      .map((v) => ({ id: v.id, label: v.name, description: v.slug })),
    [venues, search, terminal],
  )

  const reset = () => { setStep('pickVenue'); setSearch(''); setToVenueId(''); setPreflight(null); setCommandId(null); setProgressSticky({ delivered: false, rebound: false, online: false }) }
  const close = () => { onOpenChange(false); setTimeout(reset, 200) }

  const preflightMutation = useMutation({
    mutationFn: () => terminalAPI.migratePreflight(terminal!.id, toVenueId),
    onSuccess: (r) => { setPreflight(r); setStep('preflight') },
    onError: (e: any) => toast({ title: 'Error en pre-vuelo', description: e?.response?.data?.message || e?.message, variant: 'destructive' }),
  })

  const executeMutation = useMutation({
    mutationFn: () => terminalAPI.migrateExecute(terminal!.id, toVenueId),
    onSuccess: (r) => {
      setCommandId(r.commandId)
      setStep('progress')
      queryClient.invalidateQueries({ queryKey: ['terminals'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-terminals'] })
    },
    onError: (e: any) => toast({ title: 'No se pudo iniciar la migración', description: e?.response?.data?.message || e?.message, variant: 'destructive' }),
  })

  const { data: migStatus } = useQuery({
    queryKey: ['migrate-status', terminal?.id, commandId],
    queryFn: () => terminalAPI.migrateStatus(terminal!.id, commandId!),
    enabled: step === 'progress' && !!terminal && !!commandId,
    refetchInterval: (q) => (q.state.data?.confirmed === true ? false : 2000),
  })

  useEffect(() => {
    if (!migStatus) return
    setProgressSticky((prev) => ({
      delivered: prev.delivered || !!migStatus.commandDelivered,
      rebound: prev.rebound || !!migStatus.reboundAfterWipe,
      online: prev.online || !!migStatus.onlineUnderNewVenue,
    }))
  }, [migStatus])

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
        <DialogContent className="sm:max-w-[560px] bg-background">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="w-5 h-5" /> Migrar TPV a otro venue</DialogTitle>
            <DialogDescription>
              {terminal?.name} ({terminal?.serialNumber}) — actualmente en <strong>{terminal?.venue?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          {step === 'pickVenue' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Elige el venue destino:</p>
              <SearchCombobox
                placeholder="Buscar venue destino…"
                items={venueItems}
                value={search}
                onChange={setSearch}
                onSelect={(item) => setToVenueId(item.id)}
              />
              {toVenueId && <p className="text-xs">Destino seleccionado: <strong>{venues.find((v) => v.id === toVenueId)?.name}</strong></p>}
              <DialogFooter>
                <Button variant="outline" onClick={close}>Cancelar</Button>
                <Button disabled={!toVenueId || preflightMutation.isPending} onClick={() => preflightMutation.mutate()}>
                  {preflightMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Verificar destino
                </Button>
              </DialogFooter>
            </div>
          )}

          {step === 'preflight' && preflight && (
            <div className="space-y-3">
              {preflight.blockers.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> No se puede migrar:</p>
                  <ul className="text-sm list-disc pl-5 space-y-1">
                    {preflight.blockers.map((b) => <li key={b.code}>{b.message}</li>)}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> El venue destino está listo.</p>
              )}
              {preflight.warnings.map((w) => (
                <p key={w.code} className="text-xs text-amber-600 flex items-start gap-1"><AlertTriangle className="w-3.5 h-3.5 mt-0.5" /> {w.message}</p>
              ))}
              <DialogFooter>
                <Button variant="outline" onClick={() => setStep('pickVenue')}>Atrás</Button>
                <Button disabled={!preflight.canProceed} onClick={() => setStep('confirm')}>Continuar</Button>
              </DialogFooter>
            </div>
          )}

          {step === 'progress' && (() => {
            const timedOut = !migStatus?.confirmed && (migStatus?.elapsedMs ?? 0) > POLL_TIMEOUT_MS
            return (
              <div className="space-y-3 py-2">
                <p className="text-sm text-amber-600 flex items-start gap-1">
                  <AlertTriangle className="w-4 h-4 mt-0.5" /> NO uses esta terminal hasta finalizar.
                </p>
                <ProgressRow done={progressSticky.delivered} label="Comando de borrado entregado a la TPV" pending="En cola, esperando heartbeat…" />
                <ProgressRow done={progressSticky.rebound} label="La TPV se reinició y borró su memoria" pending="Esperando que la TPV reinicie…" />
                <ProgressRow done={progressSticky.online} label="La TPV está en línea en el venue nuevo" pending="Esperando reconexión…" />
                {timedOut && (
                  <div className="space-y-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                    <p className="text-sm font-medium text-amber-600 flex items-start gap-1">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> La TPV no ha reaparecido todavía. Verifica que esté encendida y con internet.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      El cambio de venue ya se aplicó en el servidor. Cuando la TPV se conecte, jalará el borrado y aparecerá sola en el venue nuevo — no necesitas repetir la migración.
                    </p>
                  </div>
                )}
                <DialogFooter>
                  {migStatus?.confirmed ? (
                    <Button onClick={() => { toast({ title: 'Migración completa', description: 'La TPV está activa en el venue nuevo.' }); close() }}>
                      Finalizar
                    </Button>
                  ) : timedOut ? (
                    <Button variant="outline" onClick={close}>Dejar pendiente y cerrar</Button>
                  ) : (
                    <Button variant="outline" disabled>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Esperando a la TPV…
                    </Button>
                  )}
                </DialogFooter>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      <AlertDialog open={step === 'confirm'} onOpenChange={(v) => { if (!v && !executeMutation.isPending) setStep('preflight') }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Migrar esta TPV?</AlertDialogTitle>
            <AlertDialogDescription>
              Se re-asignará <strong>{terminal?.name}</strong> al venue{' '}
              <strong>{venues.find((v) => v.id === toVenueId)?.name}</strong> y se enviará un
              FACTORY RESET. La TPV se reiniciará, borrará su memoria y aparecerá sola en el venue
              nuevo. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={executeMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); executeMutation.mutate() }}
              disabled={executeMutation.isPending}
            >
              {executeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Migrar y borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function ProgressRow({ done, label, pending }: { done?: boolean; label: string; pending: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /> : <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
      <span className={done ? '' : 'text-muted-foreground'}>{done ? label : pending}</span>
    </div>
  )
}
