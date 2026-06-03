import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, CheckCircle2, Loader2, AlertTriangle, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SearchCombobox, type SearchComboboxItem } from '@/components/search-combobox'
import { useToast } from '@/hooks/use-toast'
import { includesNormalized } from '@/lib/utils'
import { getOrganizationVenues } from '@/services/organization.service'
import OrgStaffAccessStep from './OrgStaffAccessStep'
import {
  getOrgMerchantAccounts,
  migratePreflightForOrg,
  migrateExecuteForOrg,
  migrateStatusForOrg,
  migrateCancelForOrg,
  type OrgTerminal,
  type OrgTerminalMigrationInfo,
  type OrgMigrationPreflight,
} from '@/services/organizationDashboard.service'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  orgId: string
  terminal: OrgTerminal | null
  /**
   * When set with `inProgress`, the wizard opens straight into the `progress`
   * step (skipping pickVenue/preflight/confirm) and resumes polling the existing
   * migration via its `commandId`. Used by the "Migrando…" row in
   * OrganizationTerminals so an interrupted migration can be watched / cancelled.
   */
  resumeMigration?: OrgTerminalMigrationInfo | null
}

type Step = 'pickVenue' | 'staff' | 'preflight' | 'confirm' | 'progress'

const POLL_TIMEOUT_MS = 10 * 60 * 1000 // 10 min — after this, surface the "device hasn't returned" guidance

export default function OrgMigrateTerminalWizard({ open, onOpenChange, orgId, terminal, resumeMigration }: Props) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('organization')
  const [step, setStep] = useState<Step>('pickVenue')
  const [search, setSearch] = useState('')
  const [toVenueId, setToVenueId] = useState('')
  const [preflight, setPreflight] = useState<OrgMigrationPreflight | null>(null)
  const [commandId, setCommandId] = useState<string | null>(null)
  const [progressSticky, setProgressSticky] = useState({ delivered: false, rebound: false, online: false })
  // Optional merchant assignment for the destination venue. Empty = use default.
  const [merchantMode, setMerchantMode] = useState<'default' | 'specific'>('default')
  const [selectedMerchantIds, setSelectedMerchantIds] = useState<string[]>([])
  const [merchantSearch, setMerchantSearch] = useState('')
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)

  // Destination venue picker: ONLY the org's venues, excluding the terminal's
  // current venue. This UI restriction mirrors the backend's "dest venue ∈ org"
  // guard — the operator can never pick a venue outside this organization.
  const { data: venues = [] } = useQuery({
    queryKey: ['organization', 'venues', orgId],
    queryFn: () => getOrganizationVenues(orgId),
    enabled: open && !!orgId,
  })
  const venueItems = useMemo<SearchComboboxItem[]>(
    () => venues
      .filter(v => v.id !== terminal?.venue?.id && (!search || includesNormalized(v.name ?? '', search)))
      .map(v => ({ id: v.id, label: v.name, description: v.slug })),
    [venues, search, terminal],
  )

  // Destination venue's merchant accounts (optional assignment). Reuses the org
  // merchant-accounts endpoint. The org merchant payload doesn't carry a venues
  // list, so we can't filter to the destination venue — show all org merchants.
  const { data: orgMerchants = [] } = useQuery({
    queryKey: ['organization', 'merchant-accounts', orgId],
    queryFn: () => getOrgMerchantAccounts(orgId),
    enabled: step === 'preflight' && !!toVenueId,
  })
  const filteredMerchants = useMemo(() => {
    if (!merchantSearch) return orgMerchants
    return orgMerchants.filter(m =>
      includesNormalized([m.displayName, m.alias, m.externalMerchantId, m.provider?.name].filter(Boolean).join(' '), merchantSearch),
    )
  }, [orgMerchants, merchantSearch])

  const reset = () => {
    setStep('pickVenue'); setSearch(''); setToVenueId(''); setPreflight(null); setCommandId(null)
    setProgressSticky({ delivered: false, rebound: false, online: false })
    setMerchantMode('default'); setSelectedMerchantIds([]); setMerchantSearch(''); setCancelConfirmOpen(false)
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
    setSelectedMerchantIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  const preflightMutation = useMutation({
    mutationFn: () => migratePreflightForOrg(orgId, terminal!.id, toVenueId),
    onSuccess: r => { setPreflight(r); setStep('preflight') },
    onError: (e: any) =>
      toast({ title: t('terminals.migrate.preflightError'), description: e?.response?.data?.message || e?.message, variant: 'destructive' }),
  })

  const executeMutation = useMutation({
    mutationFn: () => migrateExecuteForOrg(
      orgId,
      terminal!.id,
      toVenueId,
      merchantMode === 'specific' && selectedMerchantIds.length ? selectedMerchantIds : undefined,
    ),
    onSuccess: r => {
      setCommandId(r.commandId)
      setStep('progress')
      queryClient.invalidateQueries({ queryKey: ['org-terminals'] })
    },
    onError: (e: any) =>
      toast({ title: t('terminals.migrate.executeError'), description: e?.response?.data?.message || e?.message, variant: 'destructive' }),
  })

  const cancelMutation = useMutation({
    mutationFn: () => migrateCancelForOrg(orgId, terminal!.id),
    onSuccess: () => {
      toast({ title: t('terminals.migrate.cancelledToast'), description: t('terminals.migrate.cancelledToastBody') })
      queryClient.invalidateQueries({ queryKey: ['org-terminals'] })
      setCancelConfirmOpen(false)
      close()
    },
    onError: (e: any) => {
      setCancelConfirmOpen(false)
      // Backend returns a message (e.g. too late — TPV already wiped). Surface it.
      toast({ title: t('terminals.migrate.cancelError'), description: e?.response?.data?.message || e?.message, variant: 'destructive' })
    },
  })

  const { data: migStatus } = useQuery({
    queryKey: ['org-migrate-status', terminal?.id, commandId],
    queryFn: () => migrateStatusForOrg(orgId, terminal!.id, commandId!),
    enabled: step === 'progress' && !!terminal && !!commandId,
    refetchInterval: q => (q.state.data?.confirmed === true ? false : 2000),
  })

  useEffect(() => {
    if (!migStatus) return
    setProgressSticky(prev => ({
      delivered: prev.delivered || !!migStatus.commandDelivered,
      rebound: prev.rebound || !!migStatus.reboundAfterWipe,
      online: prev.online || !!migStatus.onlineUnderNewVenue,
    }))
  }, [migStatus])

  const destinationName = venues.find(v => v.id === toVenueId)?.name ?? ''

  return (
    <>
      <Dialog open={open} onOpenChange={v => (v ? onOpenChange(true) : close())}>
        <DialogContent className="sm:max-w-[560px] bg-background">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5" /> {t('terminals.migrate.title')}
            </DialogTitle>
            <DialogDescription>
              {t('terminals.migrate.subtitle', {
                name: terminal?.name ?? '',
                serial: terminal?.serialNumber ?? '—',
                venue: terminal?.venue?.name ?? '',
              })}
            </DialogDescription>
          </DialogHeader>

          {step === 'pickVenue' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t('terminals.migrate.pickVenuePrompt')}</p>
              <SearchCombobox
                placeholder={t('terminals.migrate.pickVenuePlaceholder')}
                items={venueItems}
                value={search}
                onChange={setSearch}
                onSelect={item => setToVenueId(item.id)}
              />
              {toVenueId && (
                <p className="text-xs">{t('terminals.migrate.destinationSelected', { name: destinationName })}</p>
              )}
              <DialogFooter>
                <Button variant="outline" className="cursor-pointer" onClick={close}>
                  {t('terminals.migrate.confirmCancel')}
                </Button>
                <Button
                  className="cursor-pointer"
                  disabled={!toVenueId}
                  onClick={() => setStep('staff')}
                >
                  {t('terminals.migrate.continue')}
                </Button>
              </DialogFooter>
            </div>
          )}

          {step === 'staff' && terminal && (
            <OrgStaffAccessStep
              orgId={orgId}
              destVenueId={toVenueId}
              sourceVenueId={terminal.venue?.id}
              destVenueName={destinationName}
              onDone={() => preflightMutation.mutate()}
              onSkip={() => preflightMutation.mutate()}
            />
          )}

          {step === 'preflight' && preflight && (
            <div className="space-y-3">
              {preflight.blockers.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> {t('terminals.migrate.cannotMigrate')}
                  </p>
                  <ul className="text-sm list-disc pl-5 space-y-1">
                    {preflight.blockers.map(b => <li key={b.code}>{b.message}</li>)}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> {t('terminals.migrate.destinationReady')}
                </p>
              )}
              {preflight.warnings.map(w => (
                <p key={w.code} className="text-xs text-amber-600 flex items-start gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5" /> {w.message}
                </p>
              ))}

              {/* Optional merchant assignment for the destination venue. */}
              {preflight.canProceed && (
                <div className="space-y-2 rounded-lg border border-input p-3">
                  <p className="text-sm font-medium">{t('terminals.migrate.merchantSection')}</p>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="org-merchant-mode"
                      checked={merchantMode === 'default'}
                      onChange={() => { setMerchantMode('default'); setSelectedMerchantIds([]) }}
                      className="w-4 h-4"
                    />
                    <span>{t('terminals.migrate.merchantDefault')}</span>
                  </label>
                  {orgMerchants.length > 0 && (
                    <>
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="radio"
                          name="org-merchant-mode"
                          checked={merchantMode === 'specific'}
                          onChange={() => setMerchantMode('specific')}
                          className="w-4 h-4"
                        />
                        <span>{t('terminals.migrate.merchantSpecific')}</span>
                      </label>
                      {merchantMode === 'specific' && (
                        <div className="space-y-2 pl-6">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={merchantSearch}
                              onChange={e => setMerchantSearch(e.target.value)}
                              placeholder={t('terminals.migrate.merchantSearchPlaceholder')}
                              className="h-9 pl-8 text-sm bg-background"
                            />
                          </div>
                          <div className="border border-input rounded-md p-3 space-y-2 max-h-40 overflow-y-auto bg-background">
                            {filteredMerchants.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-2">
                                {t('terminals.migrate.merchantNoResults')}
                              </p>
                            ) : (
                              filteredMerchants.map(m => (
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
                <Button variant="outline" className="cursor-pointer" onClick={() => setStep('pickVenue')}>
                  {t('terminals.migrate.back')}
                </Button>
                <Button className="cursor-pointer" disabled={!preflight.canProceed} onClick={() => setStep('confirm')}>
                  {t('terminals.migrate.continue')}
                </Button>
              </DialogFooter>
            </div>
          )}

          {step === 'progress' && (() => {
            const timedOut = !migStatus?.confirmed && (migStatus?.elapsedMs ?? 0) > POLL_TIMEOUT_MS
            return (
              <div className="space-y-3 py-2">
                <p className="text-sm text-amber-600 flex items-start gap-1">
                  <AlertTriangle className="w-4 h-4 mt-0.5" /> {t('terminals.migrate.doNotUse')}
                </p>
                <ProgressRow done={progressSticky.delivered} label={t('terminals.migrate.stepDelivered')} pending={t('terminals.migrate.stepDeliveredPending')} />
                <ProgressRow done={progressSticky.rebound} label={t('terminals.migrate.stepRebound')} pending={t('terminals.migrate.stepReboundPending')} />
                <ProgressRow done={progressSticky.online} label={t('terminals.migrate.stepOnline')} pending={t('terminals.migrate.stepOnlinePending')} />
                {timedOut && (
                  <div className="space-y-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                    <p className="text-sm font-medium text-amber-600 flex items-start gap-1">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {t('terminals.migrate.timeoutTitle')}
                    </p>
                    <p className="text-xs text-muted-foreground">{t('terminals.migrate.timeoutBody')}</p>
                  </div>
                )}
                <DialogFooter className="gap-2 sm:gap-2">
                  {migStatus?.confirmed ? (
                    <Button
                      className="cursor-pointer"
                      onClick={() => {
                        toast({ title: t('terminals.migrate.completeToast'), description: t('terminals.migrate.completeToastBody') })
                        close()
                      }}
                    >
                      {t('terminals.migrate.finish')}
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
                        {t('terminals.migrate.cancelMigration')}
                      </Button>
                      {timedOut ? (
                        <Button variant="outline" className="cursor-pointer" onClick={close}>
                          {t('terminals.migrate.leavePending')}
                        </Button>
                      ) : (
                        <Button variant="outline" disabled>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('terminals.migrate.waitingTerminal')}
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

      <AlertDialog open={step === 'confirm'} onOpenChange={v => { if (!v && !executeMutation.isPending) setStep('preflight') }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('terminals.migrate.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('terminals.migrate.confirmBody', { name: terminal?.name ?? '', venue: destinationName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={executeMutation.isPending}>{t('terminals.migrate.confirmCancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={e => { e.preventDefault(); executeMutation.mutate() }}
              disabled={executeMutation.isPending}
            >
              {executeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('terminals.migrate.confirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelConfirmOpen} onOpenChange={v => { if (!v && !cancelMutation.isPending) setCancelConfirmOpen(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('terminals.migrate.cancelConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('terminals.migrate.cancelConfirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>{t('terminals.migrate.cancelConfirmKeep')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => { e.preventDefault(); cancelMutation.mutate() }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('terminals.migrate.cancelConfirmYes')}
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
