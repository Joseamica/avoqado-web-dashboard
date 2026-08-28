import { useQuery } from '@tanstack/react-query'
import { Clock, Coffee, PowerOff, UserCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { attendanceService, type TimeEntry } from '@/services/attendance.service'
import { useVenueDateTime } from '@/utils/datetime'
import { rangeToDates, type RangeKey } from './attendanceRange'
import { PayrollReport } from './PayrollReport'
import { LoadError, PunctualityReport } from './PunctualityReport'
import { ShiftPlanner } from './ShiftPlanner'
import { useAccess } from '@/hooks/use-access'

/**
 * Asistencia: sólo LECTURA. No hay «Aprobar»/«Rechazar» a propósito: Square no aprueba
 * checadas (aprueba solicitudes de corrección que manda el empleado), y validar cada
 * checada es el flujo de PlayTelecom — su supervisor valida foto y GPS porque de eso
 * depende que les paguen. Para una estética o una tienda, ese trámite es ruido. Tampoco
 * se muestran foto ni ubicación: esos campos sólo los llena la app de PT.
 */
export default function Attendance() {
  const { t } = useTranslation('attendance')
  const { venue, venueId, fullBasePath } = useCurrentVenue()
  // Apagado se VE y se EXPLICA — nunca desaparecer en silencio (regla del workspace; Codex hallazgo 1).
  const attendanceOff = venue?.settings?.attendanceEnabled === false
  const { formatTime, formatDate, venueTimezone } = useVenueDateTime()

  const [range, setRange] = useState<RangeKey>('today')
  // 'log' = quién checó y cuándo · 'punctuality' = contra el cuadrante (retardos, faltas)
  const [view, setView] = useState<'log' | 'punctuality' | 'payroll' | 'shifts'>('log')
  const { can } = useAccess()
  // Turnos rotativos (fase 1 "como Sesame"): interruptor por venue, apagado de fábrica.
  const rotatingShifts = venue?.settings?.rotatingShiftsEnabled === true

  // "Hoy" en la zona del negocio, no en la del navegador de quien mira.
  const todayIso = useMemo(() => new Intl.DateTimeFormat('en-CA', { timeZone: venueTimezone }).format(new Date()), [venueTimezone])
  const { startDate, endDate } = useMemo(() => rangeToDates(range, todayIso), [range, todayIso])

  const {
    data: activeStaff = [],
    isLoading: loadingActive,
    isError: errorActive,
    refetch: refetchActive,
  } = useQuery({
    queryKey: ['attendance', 'active', venueId],
    queryFn: () => attendanceService.getActiveStaff(venueId!),
    enabled: !!venueId,
    refetchInterval: 60_000,
  })

  const {
    data: page,
    isLoading: loadingEntries,
    isError: errorEntries,
    refetch: refetchEntries,
  } = useQuery({
    queryKey: ['attendance', 'entries', venueId, startDate, endDate],
    queryFn: () => attendanceService.getTimeEntries(venueId!, { startDate, endDate, limit: 200 }),
    enabled: !!venueId,
  })
  const entries = useMemo(() => page?.entries ?? [], [page])
  // Se piden 200; si hay más, se dice — una lista recortada en silencio miente.
  const truncated = (page?.total ?? 0) > entries.length

  const staffName = (entry: TimeEntry) => (entry.staff ? `${entry.staff.firstName} ${entry.staff.lastName}`.trim() : t('unknownStaff'))

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

      {attendanceOff && (
        <Card className="border-amber-500/40" role="status">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <PowerOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{t('disabled.title')}</p>
                <p className="text-sm text-muted-foreground">{t('disabled.description')}</p>
              </div>
            </div>
            <Link to={`${fullBasePath}/settings/local/basic-info`} className="text-sm font-medium underline underline-offset-4 shrink-0">
              {t('disabled.cta')}
            </Link>
          </CardContent>
        </Card>
      )}

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
          ) : errorActive ? (
            <LoadError t={t} onRetry={() => refetchActive()} />
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
        <Tabs value={view} onValueChange={v => setView(v as 'log' | 'punctuality' | 'payroll' | 'shifts')}>
          <TabsList className="rounded-full bg-muted/60 px-1 py-1 border border-border">
            <TabsTrigger value="log" className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background">
              {t('views.log')}
            </TabsTrigger>
            <TabsTrigger value="punctuality" className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background">
              {t('views.punctuality')}
            </TabsTrigger>
            <TabsTrigger value="payroll" className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background">
              {t('views.payroll')}
            </TabsTrigger>
            <TabsTrigger value="shifts" className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background">
              {t('views.shifts')}
            </TabsTrigger>
          </TabsList>
        </Tabs>

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

        <div className="flex items-center gap-2">
          {truncated && (
            <Badge variant="outline" className="rounded-full">
              {t('truncated', { shown: entries.length, total: page?.total ?? 0 })}
            </Badge>
          )}
        </div>
      </div>

      {view === 'shifts' ? (
        <ShiftPlanner
          venueId={venueId!}
          todayIso={todayIso}
          enabled={rotatingShifts}
          canManage={can('attendance:manage')}
          settingsPath={`${fullBasePath}/settings/local/basic-info`}
        />
      ) : view === 'payroll' ? (
        <PayrollReport venueId={venueId!} startDate={startDate} endDate={endDate} />
      ) : view === 'punctuality' ? (
        <PunctualityReport venueId={venueId!} startDate={startDate} endDate={endDate} />
      ) : loadingEntries ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : errorEntries ? (
        <LoadError t={t} onRetry={() => refetchEntries()} />
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
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
                    <UserCheck className="h-5 w-5 text-muted-foreground" />
                  </div>

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
                      {entry.autoClockOut && <span>· {t('autoClosed')}</span>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
