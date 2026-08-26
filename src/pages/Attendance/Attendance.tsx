import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, Coffee, MapPin, ShieldCheck, ShieldX, UserCheck, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { PermissionGate } from '@/components/PermissionGate'
import { attendanceService, type TimeEntry } from '@/services/attendance.service'
import { useVenueDateTime } from '@/utils/datetime'

export type RangeKey = 'today' | 'week' | 'month'

/**
 * Rango en fechas del NEGOCIO. Nunca el reloj del navegador: el turno lo manda el venue.
 *
 * La resta va sobre `Date.UTC`, no sobre `new Date('YYYY-MM-DDT00:00:00')`. Esa segunda
 * forma interpreta la fecha en la zona de QUIEN MIRA, y al volver a ISO se corre un dia
 * para cualquiera que no este en la zona del negocio — el dueno revisando desde otro huso
 * veria una semana que empieza un dia antes de la que ve su gerente.
 */
const DAY_MS = 86_400_000

export function rangeToDates(range: RangeKey, todayIso: string): { startDate: string; endDate: string } {
  if (range === 'today') return { startDate: todayIso, endDate: todayIso }

  const [year, month, day] = todayIso.split('-').map(Number)
  const daysBack = range === 'week' ? 6 : 29
  const start = new Date(Date.UTC(year, month - 1, day) - daysBack * DAY_MS).toISOString().slice(0, 10)
  return { startDate: start, endDate: todayIso }
}

export default function Attendance() {
  const { t } = useTranslation('attendance')
  const { venueId } = useCurrentVenue()
  const { formatTime, formatDate, venueTimezone } = useVenueDateTime()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [range, setRange] = useState<RangeKey>('today')
  const [rejecting, setRejecting] = useState<TimeEntry | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  // "Hoy" en la zona del negocio, no en la del navegador de quien mira.
  const todayIso = useMemo(
    () => new Intl.DateTimeFormat('en-CA', { timeZone: venueTimezone }).format(new Date()),
    [venueTimezone],
  )
  const { startDate, endDate } = useMemo(() => rangeToDates(range, todayIso), [range, todayIso])

  const { data: activeStaff = [], isLoading: loadingActive } = useQuery({
    queryKey: ['attendance', 'active', venueId],
    queryFn: () => attendanceService.getActiveStaff(venueId!),
    enabled: !!venueId,
    refetchInterval: 60_000,
  })

  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ['attendance', 'entries', venueId, startDate, endDate],
    queryFn: () => attendanceService.getTimeEntries(venueId!, { startDate, endDate, limit: 200 }),
    enabled: !!venueId,
  })

  const validateMutation = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: 'APPROVED' | 'REJECTED'; note?: string }) =>
      attendanceService.validateTimeEntry(venueId!, id, status, note),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
      toast({
        title: variables.status === 'APPROVED' ? t('toasts.approvedTitle') : t('toasts.rejectedTitle'),
        description: variables.status === 'APPROVED' ? t('toasts.approvedDesc') : t('toasts.rejectedDesc'),
      })
    },
    onError: (error: any) => {
      toast({
        title: t('toasts.errorTitle'),
        description: error?.response?.data?.message || t('toasts.errorDesc'),
        variant: 'destructive',
      })
    },
  })

  const pendingCount = useMemo(() => entries.filter(e => e.validationStatus === 'PENDING' && e.clockOutTime).length, [entries])

  const staffName = (entry: TimeEntry) =>
    entry.staff ? `${entry.staff.firstName} ${entry.staff.lastName}`.trim() : t('unknownStaff')

  function hoursLabel(entry: TimeEntry): string {
    if (entry.totalHours == null) return '—'
    const n = Number(entry.totalHours)
    if (Number.isNaN(n)) return '—'
    const h = Math.floor(n)
    const m = Math.round((n - h) * 60)
    return t('hoursMinutes', { hours: h, minutes: m })
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {/* ── Quién está dentro ahora ───────────────────────── */}
      <Card className="border-input">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium">{t('onShift.title')}</h2>
            <Badge variant="secondary" className="rounded-full">
              {activeStaff.length}
            </Badge>
          </div>

          {loadingActive ? (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          ) : activeStaff.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('onShift.empty')}</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {activeStaff.map(entry => (
                <li key={entry.id} className="flex items-center justify-between gap-3 rounded-lg border border-input p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{staffName(entry)}</p>
                    <p className="text-xs text-muted-foreground">{t('onShift.since', { time: formatTime(entry.clockInTime) })}</p>
                  </div>
                  {entry.status === 'ON_BREAK' ? (
                    <Badge variant="outline" className="shrink-0 rounded-full gap-1">
                      <Coffee className="h-3 w-3" />
                      {t('status.onBreak')}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="shrink-0 rounded-full gap-1">
                      <Clock className="h-3 w-3" />
                      {t('status.clockedIn')}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Historial ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={range} onValueChange={v => setRange(v as RangeKey)}>
          <TabsList className="rounded-full bg-muted/60 px-1 py-1 border border-border">
            {(['today', 'week', 'month'] as RangeKey[]).map(key => (
              <TabsTrigger
                key={key}
                value={key}
                className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background"
              >
                {t(`ranges.${key}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {pendingCount > 0 && (
          <Badge variant="outline" className="rounded-full">
            {t('pendingReview', { count: pendingCount })}
          </Badge>
        )}
      </div>

      {loadingEntries ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : entries.length === 0 ? (
        <Card className="border-input">
          <CardContent className="p-8 text-center space-y-1">
            <p className="text-sm font-medium">{t('empty.title')}</p>
            <p className="text-sm text-muted-foreground">{t('empty.description')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <Card key={entry.id} className="border-input">
              <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  {entry.checkInPhotoUrl ? (
                    <img
                      src={entry.checkInPhotoUrl}
                      alt={t('photoAlt', { name: staffName(entry) })}
                      className="h-12 w-12 shrink-0 rounded-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
                      <UserCheck className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}

                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-medium">{staffName(entry)}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(entry.clockInTime)} · {formatTime(entry.clockInTime)}
                      {' → '}
                      {entry.clockOutTime ? formatTime(entry.clockOutTime) : t('stillIn')}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{t('worked', { value: hoursLabel(entry) })}</span>
                      {!!entry.breakMinutes && <span>· {t('breakMinutes', { count: entry.breakMinutes })}</span>}
                      {entry.clockInLatitude != null && (
                        <span className="inline-flex items-center gap-1">
                          · <MapPin className="h-3 w-3" />
                          {t('locationCaptured')}
                        </span>
                      )}
                      {entry.autoClockOut && <span>· {t('autoClosed')}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {entry.validationStatus === 'APPROVED' && (
                    <Badge variant="secondary" className="rounded-full gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      {t('validation.approved')}
                    </Badge>
                  )}
                  {entry.validationStatus === 'REJECTED' && (
                    <Badge variant="destructive" className="rounded-full gap-1">
                      <ShieldX className="h-3 w-3" />
                      {t('validation.rejected')}
                    </Badge>
                  )}

                  {entry.validationStatus === 'PENDING' && entry.clockOutTime && (
                    <PermissionGate permission="tpv-time-entries:write">
                      <Button
                        variant="outline"
                        size="sm"
                        className="cursor-pointer"
                        disabled={validateMutation.isPending}
                        onClick={() => validateMutation.mutate({ id: entry.id, status: 'APPROVED' })}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {t('actions.approve')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="cursor-pointer text-destructive hover:text-destructive"
                        disabled={validateMutation.isPending}
                        onClick={() => {
                          setRejectNote('')
                          setRejecting(entry)
                        }}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        {t('actions.reject')}
                      </Button>
                    </PermissionGate>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Rechazar pide motivo: la persona tiene que poder saber por qué. */}
      <AlertDialog open={!!rejecting} onOpenChange={open => !open && setRejecting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('rejectDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {rejecting ? t('rejectDialog.description', { name: staffName(rejecting) }) : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Textarea
            value={rejectNote}
            onChange={e => setRejectNote(e.target.value)}
            placeholder={t('rejectDialog.placeholder')}
            maxLength={500}
            className="min-h-24"
          />

          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">{t('rejectDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer bg-destructive hover:bg-destructive/90"
              disabled={!rejectNote.trim() || validateMutation.isPending}
              onClick={() => {
                if (rejecting) validateMutation.mutate({ id: rejecting.id, status: 'REJECTED', note: rejectNote.trim() })
                setRejecting(null)
              }}
            >
              {t('rejectDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
