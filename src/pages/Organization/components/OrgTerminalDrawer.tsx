import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusPulse } from '@/components/ui/status-pulse'
import { useVenueDateTime } from '@/utils/datetime'
import { getDateFnsLocale } from '@/utils/i18n-locale'
import { getTerminalStatusInfo } from '@/lib/terminal-status'
import { getOrgTerminalById, type OrgTerminal, type OrgTerminalCommand } from '@/services/organizationDashboard.service'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { ChevronDown, ChevronUp, Lock, RefreshCcw, RefreshCw, Unlock, Wrench, X, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface OrgTerminalDrawerProps {
  orgId: string
  terminalId: string | null
  fromCache?: OrgTerminal | null
  onClose: () => void
  onCommand: (terminal: OrgTerminal, command: OrgTerminalCommand) => void
  onEditMerchants?: (terminal: OrgTerminal) => void
  onDelete?: (terminal: OrgTerminal) => void
  onEdit?: (terminal: OrgTerminal) => void
  onGenerateActivationCode?: (terminal: OrgTerminal) => void
  onRemoteActivate?: (terminal: OrgTerminal) => void
  isLockUnlockBusy?: boolean
}

export function OrgTerminalDrawer({
  orgId,
  terminalId,
  fromCache,
  onClose,
  onCommand,
  onEditMerchants,
  onDelete,
  onEdit,
  onGenerateActivationCode,
  onRemoteActivate,
  isLockUnlockBusy,
}: OrgTerminalDrawerProps) {
  const { t, i18n } = useTranslation('organization')
  const { formatDateTime } = useVenueDateTime()
  const dateFnsLocale = getDateFnsLocale(i18n.language)
  const [showDanger, setShowDanger] = useState(false)

  // Only fetch when the URL has a terminal id we don't have in the list cache
  const { data: fetched, isLoading } = useQuery({
    queryKey: ['org-terminal', orgId, terminalId],
    queryFn: () => getOrgTerminalById(orgId, terminalId!),
    enabled: !!terminalId && !fromCache,
  })

  const terminal: OrgTerminal | null = fromCache ?? fetched ?? null

  useEffect(() => {
    if (!terminalId) setShowDanger(false)
  }, [terminalId])

  const open = !!terminalId
  const info = terminal
    ? getTerminalStatusInfo({ status: terminal.status, lastHeartbeat: terminal.lastHeartbeat, isLocked: terminal.isLocked })
    : null
  const statusLabel = info ? t(`terminals.status.${info.statusKey === 'pending' ? 'pending' : info.statusKey}` as const, {
    defaultValue: info.statusKey,
  }) : ''

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-input bg-muted/30 px-5 py-4">
          {info && <StatusPulse status={info.pulseStatus} size="md" className="mt-1.5" />}
          <div className="flex-1 min-w-0">
            {terminal ? (
              <>
                <h2 className="text-base font-semibold truncate">{terminal.name}</h2>
                <p className="text-xs text-muted-foreground truncate">
                  {terminal.venue.name}
                  {terminal.serialNumber && <> · <span className="font-mono">{terminal.serialNumber}</span></>}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-xs">{statusLabel}</span>
                  {terminal.isLocked && (
                    <Badge variant="outline" className="h-4 px-1.5 text-[10px] gap-0.5">
                      <Lock className="h-2.5 w-2.5" />
                      {t('terminals.status.locked')}
                    </Badge>
                  )}
                </div>
              </>
            ) : (
              <>
                <Skeleton className="h-5 w-44 mb-1.5" />
                <Skeleton className="h-3 w-64" />
              </>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={onClose} aria-label={t('terminals.drawer.close')}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Actions row */}
        {terminal && (
          <div className="flex flex-wrap gap-1.5 border-b border-input bg-background px-5 py-2.5">
            {onEdit && (
              <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => onEdit(terminal)}>
                {t('terminals.actions.edit')}
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => onCommand(terminal, 'RESTART')}>
              <RefreshCw className="h-3.5 w-3.5" />
              {t('terminals.actions.restart')}
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => onCommand(terminal, 'SYNC_DATA')}>
              <RefreshCcw className="h-3.5 w-3.5" />
              {t('terminals.actions.syncData', { defaultValue: 'Sincronizar' })}
            </Button>
            {terminal.isLocked ? (
              <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={isLockUnlockBusy} onClick={() => onCommand(terminal, 'UNLOCK')}>
                <Unlock className="h-3.5 w-3.5" />
                {t('terminals.actions.unlock')}
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={isLockUnlockBusy} onClick={() => onCommand(terminal, 'LOCK')}>
                <Lock className="h-3.5 w-3.5" />
                {t('terminals.actions.lock')}
              </Button>
            )}
            {terminal.status === 'MAINTENANCE' ? (
              <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => onCommand(terminal, 'EXIT_MAINTENANCE')}>
                <Wrench className="h-3.5 w-3.5" />
                {t('terminals.actions.exitMaintenance')}
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => onCommand(terminal, 'MAINTENANCE_MODE')}>
                <Wrench className="h-3.5 w-3.5" />
                {t('terminals.actions.maintenance')}
              </Button>
            )}
            {!terminal.activatedAt && onRemoteActivate && (
              <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => onRemoteActivate(terminal)}>
                <Zap className="h-3.5 w-3.5" />
                {t('terminals.actions.remoteActivate', { defaultValue: 'Activar' })}
              </Button>
            )}
            {!terminal.activatedAt && onGenerateActivationCode && (
              <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => onGenerateActivationCode(terminal)}>
                {t('terminals.actions.generateCode')}
              </Button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {isLoading && !terminal && (
            <div className="space-y-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          )}

          {!isLoading && !terminal && terminalId && (
            <p className="text-sm text-muted-foreground">{t('terminals.drawer.notFound')}</p>
          )}

          {terminal && (
            <>
              {/* Identity */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('terminals.drawer.identity')}
                </h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <FieldRow label={t('terminals.drawer.identityFields.serial')} value={terminal.serialNumber ?? '—'} mono />
                  <FieldRow label={t('terminals.drawer.identityFields.type')} value={terminal.type} />
                  <FieldRow label={t('terminals.drawer.identityFields.brand')} value={terminal.brand ?? '—'} />
                  <FieldRow label={t('terminals.drawer.identityFields.model')} value={terminal.model ?? '—'} />
                  <FieldRow label={t('terminals.drawer.identityFields.version')} value={terminal.version ?? '—'} mono />
                  <FieldRow label={t('terminals.drawer.identityFields.ip')} value={terminal.ipAddress ?? '—'} mono />
                  <FieldRow
                    label={t('terminals.drawer.identityFields.lastSeen')}
                    value={
                      terminal.lastHeartbeat
                        ? `${formatDistanceToNow(new Date(terminal.lastHeartbeat), { addSuffix: true, locale: dateFnsLocale })} · ${formatDateTime(terminal.lastHeartbeat)}`
                        : '—'
                    }
                  />
                </dl>
              </section>

              {/* Health */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('terminals.drawer.health')}
                </h3>
                {terminal.healthScore === null ? (
                  <p className="text-sm text-muted-foreground">{t('terminals.drawer.healthNoData')}</p>
                ) : (
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-semibold ${healthColor(terminal.healthScore)}`}>
                      {terminal.healthScore}%
                    </span>
                    <span className="text-xs text-muted-foreground">{t('terminals.drawer.healthScore')}</span>
                  </div>
                )}
              </section>

              {/* Merchants */}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('terminals.drawer.merchants')}
                  </h3>
                  {onEditMerchants && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs cursor-pointer" onClick={() => onEditMerchants(terminal)}>
                      {t('terminals.drawer.merchantsEdit')}
                    </Button>
                  )}
                </div>
                {terminal.assignedMerchantIds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('terminals.drawer.merchantsNone')}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {terminal.assignedMerchantIds.map(id => (
                      <Badge key={id} variant="outline" className="font-mono text-[10px]">
                        {id.slice(0, 8)}…
                      </Badge>
                    ))}
                  </div>
                )}
              </section>

              {/* Danger zone */}
              <section>
                <button
                  type="button"
                  onClick={() => setShowDanger(v => !v)}
                  className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-destructive cursor-pointer"
                >
                  <span>{t('terminals.drawer.dangerZone')}</span>
                  {showDanger ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {showDanger && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    <Button variant="outline" size="sm" className="h-8 justify-start text-destructive hover:text-destructive" onClick={() => onCommand(terminal, 'FACTORY_RESET')}>
                      {t('terminals.actions.factoryReset', { defaultValue: 'Factory Reset' })}
                    </Button>
                    {onDelete && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 justify-start text-destructive hover:text-destructive"
                        onClick={() => onDelete(terminal)}
                      >
                        {t('terminals.actions.delete')}
                      </Button>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function FieldRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`text-sm ${mono ? 'font-mono' : ''} truncate`}>{value}</dd>
    </>
  )
}

function healthColor(score: number) {
  if (score >= 80) return 'text-green-600 dark:text-green-400'
  if (score >= 50) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}
