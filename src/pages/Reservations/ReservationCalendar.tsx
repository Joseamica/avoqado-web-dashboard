import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Users } from 'lucide-react'
import { DateTime } from 'luxon'
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useVenueDateTime } from '@/utils/datetime'
import reservationService from '@/services/reservation.service'
import classSessionService from '@/services/classSession.service'
import type { Reservation, ReservationSettings, ReservationStatus } from '@/types/reservation'

import { CreateReservationForm } from './CreateReservation'
import { CreateClassSessionDialog } from './components/CreateClassSessionDialog'

type CalendarView = 'day' | 'week'
type GroupBy = 'table' | 'staff'

// Status colors for calendar blocks
const statusColorMap: Record<ReservationStatus, string> = {
  PENDING: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-700 dark:text-yellow-300',
  CONFIRMED: 'bg-blue-500/20 border-blue-500/40 text-blue-700 dark:text-blue-300',
  CHECKED_IN: 'bg-green-500/20 border-green-500/40 text-green-700 dark:text-green-300',
  COMPLETED: 'bg-muted border-border text-muted-foreground',
  CANCELLED: 'bg-red-500/20 border-red-500/40 text-red-700 dark:text-red-300',
  NO_SHOW: 'bg-orange-500/20 border-orange-500/40 text-orange-700 dark:text-orange-300',
}

const DEFAULT_HOURS = Array.from({ length: 16 }, (_, i) => i + 8)

function computeHoursFromSettings(settings?: ReservationSettings | null): number[] {
  if (!settings?.operatingHours) return DEFAULT_HOURS
  let earliest = 24
  let latest = 0
  for (const day of Object.values(settings.operatingHours)) {
    if (!day.enabled) continue
    for (const range of day.ranges) {
      earliest = Math.min(earliest, parseInt(range.open.split(':')[0]))
      latest = Math.max(latest, parseInt(range.close.split(':')[0]))
    }
  }
  if (earliest >= latest) return DEFAULT_HOURS
  return Array.from({ length: latest - earliest + 1 }, (_, i) => i + earliest)
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function getWeekDays(baseDate: Date): Date[] {
  const dayOfWeek = baseDate.getDay()
  const monday = addDays(baseDate, -((dayOfWeek + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

// Padding at top of grid so first hour label isn't clipped
const GRID_TOP_PAD = 12

export default function ReservationCalendar() {
  const { t } = useTranslation('reservations')
  const { venueId, fullBasePath } = useCurrentVenue()
  const navigate = useNavigate()
  const { t: tCommon } = useTranslation()
  const { formatTime, formatDateISO: formatVenueDateISO, venueTimezone } = useVenueDateTime()
  const queryClient = useQueryClient()

  const { data: settings } = useQuery({
    queryKey: ['reservation-settings', venueId],
    queryFn: () => reservationService.getSettings(venueId),
  })
  const HOURS = useMemo(() => computeHoursFromSettings(settings), [settings])
  const firstHour = HOURS[0]

  const [view, setView] = useState<CalendarView>('day')
  const [groupBy, setGroupBy] = useState<GroupBy>('table')
  const [currentDate, setCurrentDate] = useState(new Date())

  // Click-to-create reservation modal state
  const [createModal, setCreateModal] = useState<{ open: boolean; date: string; startTime: string }>({
    open: false,
    date: '',
    startTime: '',
  })

  // Create class session dialog state
  const [classModal, setClassModal] = useState<{ open: boolean; date: string; startTime: string }>({
    open: false,
    date: '',
    startTime: '',
  })
  const createFormSubmitRef = useMemo<MutableRefObject<(() => void) | null>>(() => ({ current: null }), [])

  // Calculate date range based on view
  const { dateFrom, dateTo, displayDays } = useMemo(() => {
    if (view === 'day') {
      const iso = formatVenueDateISO(currentDate)
      return { dateFrom: iso, dateTo: iso, displayDays: [currentDate] }
    }
    const days = getWeekDays(currentDate)
    return {
      dateFrom: formatVenueDateISO(days[0]),
      dateTo: formatVenueDateISO(days[6]),
      displayDays: days,
    }
  }, [view, currentDate, formatVenueDateISO])

  // Fetch calendar data (reservations)
  const { data: calendarData, isLoading } = useQuery({
    queryKey: ['reservation-calendar', venueId, dateFrom, dateTo, groupBy],
    queryFn: () => reservationService.getCalendar(venueId, dateFrom, dateTo, groupBy),
    enabled: !!dateFrom && !!dateTo,
  })

  const reservations = calendarData?.reservations || []

  // Fetch class sessions for the same date range
  const { data: classSessions = [] } = useQuery({
    queryKey: ['class-sessions', venueId, dateFrom, dateTo],
    queryFn: () => classSessionService.getClassSessions(venueId!, { dateFrom, dateTo }),
    enabled: !!dateFrom && !!dateTo && !!venueId,
  })

  // Ref for auto-scroll to current time
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scrollRef.current || isLoading) return
    const now = DateTime.now().setZone(venueTimezone)
    const hour = now.hour
    // Scroll to ~1 hour before current time
    const scrollToHour = Math.max(hour - 1, firstHour)
    const scrollTop = (scrollToHour - firstHour) * 64
    scrollRef.current.scrollTop = scrollTop
  }, [isLoading, dateFrom, firstHour, venueTimezone])

  // Navigate date
  const goToday = () => setCurrentDate(new Date())
  const goPrev = () => setCurrentDate(prev => addDays(prev, view === 'day' ? -1 : -7))
  const goNext = () => setCurrentDate(prev => addDays(prev, view === 'day' ? 1 : 7))

  // Format current date display
  const dateDisplay = useMemo(() => {
    if (view === 'day') {
      return currentDate.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    }
    const days = getWeekDays(currentDate)
    const from = days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const to = days[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    return `${from} – ${to}`
  }, [view, currentDate])

  // Group reservations by day for rendering
  // Exclude reservations tied to a ClassSession — those are already shown inside the class block
  const reservationsByDay = useMemo(() => {
    const map: Record<string, Reservation[]> = {}
    for (const r of reservations) {
      if (r.classSessionId) continue
      const dayKey = formatVenueDateISO(r.startsAt)
      if (!map[dayKey]) map[dayKey] = []
      map[dayKey].push(r)
    }
    return map
  }, [reservations, formatVenueDateISO])

  // Group class sessions by day for rendering
  const classSessionsByDay = useMemo(() => {
    const map: Record<string, typeof classSessions> = {}
    for (const s of classSessions) {
      const dayKey = formatVenueDateISO(s.startsAt)
      if (!map[dayKey]) map[dayKey] = []
      map[dayKey].push(s)
    }
    return map
  }, [classSessions, formatVenueDateISO])

  // Render a single class session block (purple/violet tones to distinguish from reservations)
  const renderClassSessionBlock = (session: (typeof classSessions)[0]) => {
    const start = DateTime.fromISO(session.startsAt, { zone: 'utc' }).setZone(venueTimezone)
    const end = DateTime.fromISO(session.endsAt, { zone: 'utc' }).setZone(venueTimezone)
    const startHour = start.hour + start.minute / 60
    const endHour = end.hour + end.minute / 60
    const top = (startHour - firstHour) * 64 + GRID_TOP_PAD
    const height = Math.max((endHour - startHour) * 64, 24)
    const isFull = session.enrolled >= session.capacity
    const spotsLeft = session.capacity - session.enrolled

    return (
      <div
        key={`cs-${session.id}`}
        data-reservation="true"
        className="absolute left-1 right-1 rounded-md border px-2 py-1 text-xs cursor-pointer transition-opacity hover:opacity-80 overflow-hidden bg-violet-500/20 border-violet-500/40 text-violet-700 dark:text-violet-300"
        style={{ top: `${top}px`, height: `${height}px` }}
        onClick={e => e.stopPropagation()}
      >
        <div className="font-medium truncate">{session.product.name}</div>
        <div className="opacity-70 truncate">
          {formatTime(session.startsAt)} – {formatTime(session.endsAt)}
        </div>
        {height > 40 && (
          <div className="flex items-center gap-1 opacity-70">
            <Users className="h-3 w-3" />
            <span>
              {session.enrolled}/{session.capacity}
            </span>
            {isFull && (
              <Badge variant="outline" className="text-[10px] h-4 px-1 ml-1 border-violet-500/40">
                {t('classSession.full')}
              </Badge>
            )}
            {!isFull && spotsLeft <= 3 && (
              <span className="text-[10px] opacity-80">
                {t('classSession.spotsLeft', { count: spotsLeft })}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  // Render a single reservation block
  const renderReservationBlock = (reservation: Reservation) => {
    const start = DateTime.fromISO(reservation.startsAt, { zone: 'utc' }).setZone(venueTimezone)
    const end = DateTime.fromISO(reservation.endsAt, { zone: 'utc' }).setZone(venueTimezone)
    const startHour = start.hour + start.minute / 60
    const endHour = end.hour + end.minute / 60
    const top = (startHour - firstHour) * 64 + GRID_TOP_PAD
    const height = Math.max((endHour - startHour) * 64, 24)

    const guestName = reservation.customer
      ? `${reservation.customer.firstName} ${reservation.customer.lastName}`
      : reservation.guestName || t('unnamedGuest')

    return (
      <div
        key={reservation.id}
        data-reservation="true"
        className={`absolute left-1 right-1 rounded-md border px-2 py-1 text-xs cursor-pointer transition-opacity hover:opacity-80 overflow-hidden ${statusColorMap[reservation.status]}`}
        style={{ top: `${top}px`, height: `${height}px` }}
        onClick={() => navigate(`${fullBasePath}/reservations/${reservation.id}`)}
      >
        <div className="font-medium truncate">{guestName}</div>
        <div className="opacity-70 truncate">
          {formatTime(reservation.startsAt)} – {formatTime(reservation.endsAt)}
        </div>
        {height > 40 && (
          <div className="flex items-center gap-1 opacity-70">
            <Users className="h-3 w-3" />
            <span>{reservation.partySize}</span>
            {reservation.table && (
              <Badge variant="outline" className="text-[10px] h-4 px-1 ml-1">
                {reservation.table.number}
              </Badge>
            )}
          </div>
        )}
      </div>
    )
  }

  // Check if a date is today
  const isToday = (day: Date) => formatVenueDateISO(day) === formatVenueDateISO(new Date())

  // Current time position for "now" indicator
  const lastHour = HOURS[HOURS.length - 1]
  const nowPosition = useMemo(() => {
    const now = DateTime.now().setZone(venueTimezone)
    const hour = now.hour + now.minute / 60
    if (hour < firstHour || hour > lastHour + 1) return null
    return (hour - firstHour) * 64 + GRID_TOP_PAD
  }, [firstHour, lastHour, venueTimezone])

  // Handle click on empty grid area to create a reservation
  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>, day: Date) => {
    // Don't trigger if user clicked on an existing reservation block
    if ((e.target as HTMLElement).closest('[data-reservation]')) return

    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const hourFloat = (y - GRID_TOP_PAD) / 64 + firstHour

    // Snap to nearest 15-minute interval
    const hour = Math.floor(hourFloat)
    const rawMinutes = Math.round(((hourFloat - hour) * 60) / 15) * 15
    const snappedMinutes = rawMinutes >= 60 ? 0 : rawMinutes
    const snappedHour = rawMinutes >= 60 ? hour + 1 : hour

    // Clamp to valid range
    if (snappedHour < firstHour || snappedHour > lastHour) return

    const startTime = `${String(snappedHour).padStart(2, '0')}:${String(snappedMinutes).padStart(2, '0')}`
    const date = formatVenueDateISO(day)
    setCreateModal({ open: true, date, startTime })
  }

  // Render the day column
  const renderDayColumn = (day: Date, isWide: boolean) => {
    const dayKey = formatVenueDateISO(day)
    const dayReservations = reservationsByDay[dayKey] || []
    const dayClassSessions = classSessionsByDay[dayKey] || []
    const dayIsToday = isToday(day)

    return (
      <div key={dayKey} className={`relative border-l border-border/30 ${isWide ? 'flex-1' : 'flex-1 min-w-[120px]'}`}>
        {/* Day header (only in week view) */}
        {view === 'week' && (
          <div
            className={`sticky top-0 z-10 border-b border-border px-2 py-1 text-center ${dayIsToday ? 'bg-primary/5' : 'bg-background'}`}
          >
            <div className="text-xs text-muted-foreground">{day.toLocaleDateString(undefined, { weekday: 'short' })}</div>
            <div
              className={`text-sm font-medium ${dayIsToday ? 'bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center mx-auto' : ''}`}
            >
              {day.getDate()}
            </div>
          </div>
        )}

        {/* Time grid */}
        <div
          className={`relative cursor-pointer ${dayIsToday && view === 'day' ? 'bg-primary/[0.02]' : ''}`}
          style={{ height: `${HOURS.length * 64 + GRID_TOP_PAD + 8}px` }}
          onClick={e => handleGridClick(e, day)}
        >
          {/* Hour lines */}
          {HOURS.map(hour => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-border/30"
              style={{ top: `${(hour - firstHour) * 64 + GRID_TOP_PAD}px` }}
            />
          ))}

          {/* Half-hour lines */}
          {HOURS.map(hour => (
            <div
              key={`${hour}-half`}
              className="absolute left-0 right-0 border-t border-border/15"
              style={{ top: `${(hour - firstHour) * 64 + 32 + GRID_TOP_PAD}px` }}
            />
          ))}

          {/* Now indicator */}
          {dayIsToday && nowPosition !== null && (
            <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${nowPosition}px` }}>
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                <div className="flex-1 border-t-2 border-red-500" />
              </div>
            </div>
          )}

          {/* Class session blocks */}
          {dayClassSessions.map(renderClassSessionBlock)}

          {/* Reservation blocks */}
          {dayReservations.map(renderReservationBlock)}
        </div>
      </div>
    )
  }

  const closeCreateModal = () => setCreateModal({ open: false, date: '', startTime: '' })
  const closeClassModal = () => setClassModal({ open: false, date: '', startTime: '' })

  return (
    <div className="p-4 bg-background text-foreground">
      {/* Controls */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          {/* Date navigation */}
          <Button variant="outline" size="sm" onClick={goToday}>
            {t('tabs.today')}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{dateDisplay}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Crear dropdown — estilo Square */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-8 gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                {t('calendar.create', { defaultValue: 'Crear' })}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onClick={() =>
                  setCreateModal({ open: true, date: formatVenueDateISO(currentDate), startTime: '' })
                }
              >
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                {t('calendar.createCita', { defaultValue: 'Cita' })}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onClick={() =>
                  setClassModal({ open: true, date: formatVenueDateISO(currentDate), startTime: '' })
                }
              >
                <Users className="h-4 w-4 text-muted-foreground" />
                {t('calendar.createClase', { defaultValue: 'Clase' })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Group by */}
          <Select value={groupBy} onValueChange={v => setGroupBy(v as GroupBy)}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="table">{t('calendar.groupBy.table')}</SelectItem>
              <SelectItem value="staff">{t('calendar.groupBy.staff')}</SelectItem>
            </SelectContent>
          </Select>

          {/* View toggle */}
          <Tabs value={view} onValueChange={v => setView(v as CalendarView)}>
            <TabsList className="rounded-full bg-muted/60 px-1 py-1 border border-border h-8">
              <TabsTrigger
                value="day"
                className="rounded-full text-xs data-[state=active]:bg-foreground data-[state=active]:text-background h-6"
              >
                {t('calendar.views.day')}
              </TabsTrigger>
              <TabsTrigger
                value="week"
                className="rounded-full text-xs data-[state=active]:bg-foreground data-[state=active]:text-background h-6"
              >
                {t('calendar.views.week')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Calendar Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">{tCommon('loading')}</div>
      ) : (
        <div ref={scrollRef} className="rounded-xl border border-border overflow-auto max-h-[calc(100vh-220px)]">
          <div className="flex min-w-[600px]">
            {/* Time axis */}
            <div className="w-14 flex-shrink-0 border-r border-border">
              {view === 'week' && <div className="sticky top-0 bg-background z-10 border-b border-border h-[44px]" />}
              <div className="relative" style={{ height: `${HOURS.length * 64 + GRID_TOP_PAD + 8}px` }}>
                {HOURS.map(hour => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 text-xs text-muted-foreground text-right pr-2"
                    style={{ top: `${(hour - firstHour) * 64 + GRID_TOP_PAD - 8}px` }}
                  >
                    {`${String(hour).padStart(2, '0')}:00`}
                  </div>
                ))}
              </div>
            </div>

            {/* Day columns */}
            {displayDays.map(day => renderDayColumn(day, view === 'day'))}
          </div>
        </div>
      )}

      {/* Click-to-create reservation modal */}
      <FullScreenModal
        open={createModal.open}
        onClose={closeCreateModal}
        title={t('form.createTitle')}
        actions={<Button onClick={() => createFormSubmitRef.current?.()}>{t('actions.save')}</Button>}
      >
        <div className="max-w-4xl mx-auto p-6">
          <CreateReservationForm
            defaultDate={createModal.date}
            defaultStartTime={createModal.startTime}
            submitRef={createFormSubmitRef}
            onSuccess={() => {
              closeCreateModal()
              queryClient.invalidateQueries({ queryKey: ['reservation-calendar'] })
            }}
            onCancel={closeCreateModal}
          />
        </div>
      </FullScreenModal>

      {/* Create class session dialog */}
      <CreateClassSessionDialog
        open={classModal.open}
        onOpenChange={open => !open && closeClassModal()}
        defaultDate={classModal.date}
        defaultStartTime={classModal.startTime || undefined}
      />
    </div>
  )
}
