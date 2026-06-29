import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, LockOpen } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PermissionGate } from '@/components/PermissionGate'
import { useClosePeriod, usePeriodLocks, useReopenPeriod } from '@/hooks/usePeriodLocks'
import { useVenueDateTime } from '@/utils/datetime'

/** Mes actual (YYYY-MM) en la zona horaria del local, NO la del navegador. */
const currentMonthInTz = (tz: string): string => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' }).format(new Date())

interface PeriodLockCardProps {
  /** false desde el teaser (paywall) → no consulta. */
  enabled?: boolean
}

/**
 * Cierre de periodo (Capa B). Cierra/reabre meses contables: un mes cerrado ya no admite pólizas
 * nuevas ni correcciones, protegiendo lo declarado al SAT. Cerrar/reabrir = permiso accounting:manage.
 */
export function PeriodLockCard({ enabled = true }: PeriodLockCardProps) {
  const { t } = useTranslation('reports')
  const { venueTimezone } = useVenueDateTime()
  const locksQuery = usePeriodLocks({ enabled })
  const closeMutation = useClosePeriod()
  const reopenMutation = useReopenPeriod()

  const [period, setPeriod] = useState(() => currentMonthInTz(venueTimezone))
  const [reason, setReason] = useState('')

  const closedSet = useMemo(() => new Set((locksQuery.data?.locks ?? []).filter(l => l.status === 'CLOSED').map(l => l.period)), [locksQuery.data])
  const closedList = useMemo(
    () =>
      (locksQuery.data?.locks ?? [])
        .filter(l => l.status === 'CLOSED')
        .sort((a, b) => b.period.localeCompare(a.period)),
    [locksQuery.data],
  )
  const isClosed = closedSet.has(period)
  const pending = closeMutation.isPending || reopenMutation.isPending

  const onConfirm = () => {
    const mut = isClosed ? reopenMutation : closeMutation
    mut.mutate({ period, reason: reason.trim() || undefined }, { onSettled: () => setReason('') })
  }

  return (
    <Card className="border-input">
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center gap-2">
          {isClosed ? <Lock className="h-4 w-4 text-amber-500" /> : <LockOpen className="h-4 w-4 text-emerald-500" />}
          <h2 className="text-sm font-semibold text-foreground">{t('periodLock.title')}</h2>
        </div>
        <p className="text-xs text-muted-foreground">{t('periodLock.subtitle')}</p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t('periodLock.month')}</label>
            <Input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="h-10 w-44" data-tour="period-lock-month" />
          </div>
          <div className="pb-1">
            {isClosed ? (
              <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
                {t('periodLock.statusClosed')}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                {t('periodLock.statusOpen')}
              </Badge>
            )}
          </div>
          <PermissionGate permission="accounting:manage">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant={isClosed ? 'outline' : 'default'} disabled={pending || !period} data-tour="period-lock-action">
                  {isClosed ? t('periodLock.reopen') : t('periodLock.close')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{isClosed ? t('periodLock.reopenConfirmTitle', { period }) : t('periodLock.closeConfirmTitle', { period })}</AlertDialogTitle>
                  <AlertDialogDescription>{isClosed ? t('periodLock.reopenConfirmBody') : t('periodLock.closeConfirmBody')}</AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('periodLock.reasonLabel')}</label>
                  <Input value={reason} onChange={e => setReason(e.target.value)} placeholder={t('periodLock.reasonPh')} className="h-10" maxLength={500} />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('periodLock.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={onConfirm}>{isClosed ? t('periodLock.reopen') : t('periodLock.close')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </PermissionGate>
        </div>

        {closedList.length > 0 && (
          <div className="pt-1">
            <p className="text-xs font-medium text-muted-foreground">{t('periodLock.closedMonths')}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {closedList.map(l => (
                <Badge
                  key={l.period}
                  variant="outline"
                  className="cursor-pointer border-amber-500/40 text-amber-600 dark:text-amber-400"
                  onClick={() => setPeriod(l.period)}
                  title={l.reason ?? undefined}
                >
                  <Lock className="mr-1 h-3 w-3" />
                  {l.period}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
