import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, CheckCircle2, Loader2, AlertTriangle, Search } from 'lucide-react'

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchCombobox, type SearchComboboxItem } from '@/components/search-combobox'
import { useToast } from '@/hooks/use-toast'
import { includesNormalized } from '@/lib/utils'
import { getAllVenues } from '@/services/superadmin.service'
import { paymentProviderAPI } from '@/services/paymentProvider.service'
import { terminalAPI, type Terminal, type PreflightResult, type TerminalMigrationInfo } from '@/services/superadmin-terminals.service'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  terminal: Terminal | null
  /**
   * When set with `inProgress`, the wizard opens straight into the `progress`
   * step (skipping pickVenue/preflight/confirm) and resumes polling the
   * existing migration via its `commandId`. Used by the "Migrando…" row in
   * Terminals.tsx so an interrupted migration can be watched / cancelled.
   */
  resumeMigration?: TerminalMigrationInfo | null
}

type Step = 'pickVenue' | 'preflight' | 'confirm' | 'progress'

const POLL_TIMEOUT_MS = 10 * 60 * 1000 // 10 min — after this, surface the "device hasn't returned" guidance

export default function MigrateTerminalWizard({ open, onOpenChange, terminal, resumeMigration }: Props) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [step, setStep] = useState<Step>('pickVenue')
  const [search, setSearch] = useState('')
  const [toVenueId, setToVenueId] = useState('')
  const [preflight, setPreflight] = useState<PreflightResult | null>(null)
  const [commandId, setCommandId] = useState<string | null>(null)
  const [progressSticky, setProgressSticky] = useState({ delivered: false, rebound: false, online: false })
  // Optional merchant assignment for the destination venue. Empty = use default.
  const [merchantMode, setMerchantMode] = useState<'default' | 'specific'>('default')
  const [selectedMerchantIds, setSelectedMerchantIds] = useState<string[]>([])
  const [merchantSearch, setMerchantSearch] = useState('')
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  // Merchant-carry checkbox: unblocks NO_PAYMENT_CONFIG by carrying the origin's
  // merchant to the destination venue. Toggling it re-runs preflight (below).
  const [migrateMerchant, setMigrateMerchant] = useState(false)

  const { data: venues = [] } = useQuery({ queryKey: ['venues'], queryFn: () => getAllVenues() })
  const venueItems = useMemo<SearchComboboxItem[]>(
    () => venues
      .filter((v) => v.id !== terminal?.venueId && (!search || includesNormalized(v.name ?? '', search)))
      .map((v) => ({ id: v.id, label: v.name, description: v.slug })),
    [venues, search, terminal],
  )

  // Destination venue's merchant accounts (optional assignment, §merchant step).
  // Reuses the superadmin merchant-accounts endpoint — each account carries the
  // enriched `venues` list, so we filter client-side to the destination venue.
  const { data: allMerchants = [] } = useQuery({
    queryKey: ['merchant-accounts'],
    queryFn: () => paymentProviderAPI.getAllMerchantAccounts({ active: true }),
    enabled: step === 'preflight' && !!toVenueId,
  })
  const destinationMerchants = useMemo(
    () => allMerchants.filter((m) => m.venues?.some((v) => v.id === toVenueId)),
    [allMerchants, toVenueId],
  )
  const filteredMerchants = useMemo(() => {
    if (!merchantSearch) return destinationMerchants
    return destinationMerchants.filter((m) =>
      includesNormalized([m.displayName, m.alias, m.externalMerchantId, m.provider?.name].filter(Boolean).join(' '), merchantSearch),
    )
  }, [destinationMerchants, merchantSearch])

  const reset = () => {
    setStep('pickVenue'); setSearch(''); setToVenueId(''); setPreflight(null); setCommandId(null)
    setProgressSticky({ delivered: false, rebound: false, online: false })
    setMerchantMode('default'); setSelectedMerchantIds([]); setMerchantSearch(''); setCancelConfirmOpen(false)
    setMigrateMerchant(false)
  }
  const close = () => { onOpenChange(false); setTimeout(reset, 200) }

  // Resume: when opened with an in-flight migration, jump straight to progress.
  useEffect(() => {
    if (!open) return
    if (resumeMigration?.inProgress) {
      setStep('progress')
      setCommandId(resumeMigration.commandId)
      setToVenueId(resumeMigration.toVenueId)
    }
  }, [open, resumeMigration])

  const toggleMerchant = (id: string) => {
    setSelectedMerchantIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const preflightMutation = useMutation({
    mutationFn: () => terminalAPI.migratePreflight(terminal!.id, toVenueId, migrateMerchant),
    onSuccess: (r) => { setPreflight(r); setStep('preflight') },
    onError: (e: any) => toast({ title: 'Error en pre-vuelo', description: e?.response?.data?.message || e?.message, variant: 'destructive' }),
  })

  const executeMutation = useMutation({
    mutationFn: () => terminalAPI.migrateExecute(
      terminal!.id,
      toVenueId,
      merchantMode === 'specific' && selectedMerchantIds.length ? selectedMerchantIds : undefined,
      migrateMerchant,
    ),
    onSuccess: (r) => {
      setCommandId(r.commandId)
      setStep('progress')
      queryClient.invalidateQueries({ queryKey: ['terminals'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-terminals'] })
    },
    onError: (e: any) => toast({ title: 'No se pudo iniciar la migración', description: e?.response?.data?.message || e?.message, variant: 'destructive' }),
  })

  // The merchant-carry checkbox changes the preflight blockers (NO_PAYMENT_CONFIG
  // depends on `migrateMerchant`), and preflight is a mutation — not a query — so
  // there's no cache to invalidate; we must explicitly re-run it. Do this from an
  // effect (not directly in the checkbox's onCheckedChange) so `preflightMutation`
  // reads the fresh `migrateMerchant` value instead of the stale one captured by
  // the render that owned the click handler. Skip the very first render (mount)
  // and only fire once the destination venue has actually been chosen.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    if (step === 'preflight' && toVenueId) preflightMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [migrateMerchant])

  const cancelMutation = useMutation({
    mutationFn: () => terminalAPI.migrateCancel(terminal!.id),
    onSuccess: () => {
      toast({ title: 'Migración cancelada', description: 'La TPV volvió a su venue original.' })
      queryClient.invalidateQueries({ queryKey: ['terminals'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-terminals'] })
      setCancelConfirmOpen(false)
      close()
    },
    onError: (e: any) => {
      setCancelConfirmOpen(false)
      toast({ title: 'No se pudo cancelar', description: e?.response?.data?.message || e?.message, variant: 'destructive' })
    },
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
                <Button variant="outline" className="cursor-pointer" onClick={close}>Cancelar</Button>
                <Button className="cursor-pointer" disabled={!toVenueId || preflightMutation.isPending} onClick={() => preflightMutation.mutate()}>
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

              {/*
                Merchant-carry checkbox: rendered even while `canProceed` is false,
                since unblocking a NO_PAYMENT_CONFIG-blocked migration is the whole
                point of this control. `merchantMigration.available` is computed
                unconditionally by the backend on every preflight call, so it's
                visible from the very first preflight — no need to check the box
                first to discover it exists.
              */}
              {preflight.merchantMigration.available && (
                <div className="flex items-start gap-2 rounded-lg border border-input p-3">
                  <Checkbox
                    id="migrate-merchant"
                    className="cursor-pointer"
                    checked={migrateMerchant}
                    onCheckedChange={(v) => setMigrateMerchant(v === true)}
                  />
                  <div>
                    <Label htmlFor="migrate-merchant" className="cursor-pointer">
                      Migrar también el comercio ({preflight.merchantMigration.merchants.map((m) => m.displayName ?? m.id).join(', ')})
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      La TPV se lleva su comercio actual y la sucursal destino queda configurada para cobrar con él.
                    </p>
                  </div>
                </div>
              )}

              {/* Optional merchant assignment for the destination venue. */}
              {preflight.canProceed && (
                <div className="space-y-2 rounded-lg border border-input p-3">
                  <p className="text-sm font-medium">Merchant en el venue destino</p>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="merchant-mode"
                      checked={merchantMode === 'default'}
                      onChange={() => { setMerchantMode('default'); setSelectedMerchantIds([]) }}
                      className="w-4 h-4"
                    />
                    <span>Merchant por defecto del venue (recomendado)</span>
                  </label>
                  {destinationMerchants.length > 0 && (
                    <>
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="radio"
                          name="merchant-mode"
                          checked={merchantMode === 'specific'}
                          onChange={() => setMerchantMode('specific')}
                          className="w-4 h-4"
                        />
                        <span>Merchant específico</span>
                      </label>
                      {merchantMode === 'specific' && (
                        <div className="space-y-2 pl-6">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={merchantSearch}
                              onChange={(e) => setMerchantSearch(e.target.value)}
                              placeholder="Buscar comercio…"
                              className="h-9 pl-8 text-sm bg-background"
                            />
                          </div>
                          <div className="border border-input rounded-md p-3 space-y-2 max-h-40 overflow-y-auto bg-background">
                            {filteredMerchants.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-2">Sin resultados</p>
                            ) : (
                              filteredMerchants.map((m) => (
                                <label key={m.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                                  <input
                                    type="checkbox"
                                    checked={selectedMerchantIds.includes(m.id)}
                                    onChange={() => toggleMerchant(m.id)}
                                    className="w-4 h-4"
                                  />
                                  <div className="flex-1 flex items-center gap-2 text-sm min-w-0">
                                    <span className="font-medium truncate">{m.displayName || m.alias}</span>
                                    {m.externalMerchantId && (
                                      <span className="text-xs text-muted-foreground truncate">({m.externalMerchantId})</span>
                                    )}
                                    {m.provider && (
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted shrink-0">{m.provider.name}</span>
                                    )}
                                  </div>
                                </label>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" className="cursor-pointer" onClick={() => setStep('pickVenue')}>Atrás</Button>
                <Button className="cursor-pointer" disabled={!preflight.canProceed} onClick={() => setStep('confirm')}>Continuar</Button>
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
                <DialogFooter className="gap-2 sm:gap-2">
                  {migStatus?.confirmed ? (
                    <Button className="cursor-pointer" onClick={() => { toast({ title: 'Migración completa', description: 'La TPV está activa en el venue nuevo.' }); close() }}>
                      Finalizar
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        className="cursor-pointer"
                        disabled={cancelMutation.isPending}
                        onClick={() => setCancelConfirmOpen(true)}
                      >
                        {cancelMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Cancelar migración
                      </Button>
                      {timedOut ? (
                        <Button variant="outline" className="cursor-pointer" onClick={close}>Dejar pendiente y cerrar</Button>
                      ) : (
                        <Button variant="outline" disabled>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Esperando a la TPV…
                        </Button>
                      )}
                    </>
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

      <AlertDialog open={cancelConfirmOpen} onOpenChange={(v) => { if (!v && !cancelMutation.isPending) setCancelConfirmOpen(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar la migración?</AlertDialogTitle>
            <AlertDialogDescription>
              La TPV volverá a su venue original. Solo funciona si la TPV aún no se ha borrado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>No, seguir migrando</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); cancelMutation.mutate() }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Sí, cancelar
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
