import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Columns3, Plus, Settings, Users } from 'lucide-react'
import { DateTime } from 'luxon'
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
// Select and Tabs removed — view toggle now uses dropdown
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { useToast } from '@/hooks/use-toast'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useVenueDateTime } from '@/utils/datetime'
import { getDateFnsLocale } from '@/utils/i18n-locale'
import reservationService from '@/services/reservation.service'
import classSessionService from '@/services/classSession.service'
import type { Reservation, ReservationSettings, ReservationStatus } from '@/types/reservation'

import { CreateReservationForm } from './CreateReservation'
import { CreateClassSessionDialog } from './components/CreateClassSessionDialog'
import { EditClassSessionDialog } from './components/EditClassSessionDialog'
import { EditAvailabilityDialog } from './components/EditAvailabilityDialog'
import { CalendarAttributesDialog, loadAttributes, type CalendarAttributes } from './components/CalendarAttributesDialog'

type CalendarView = 'day' | 'week' | '5day' | 'month'
type GroupByMode = 'none' | 'staff' | 'table'

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

function get5Days(baseDate: Date): Date[] {
  const dayOfWeek = baseDate.getDay()
  const monday = addDays(baseDate, -((dayOfWeek + 6) % 7))
  return Array.from({ length: 5 }, (_, i) => addDays(monday, i))
}

function getMonthDays(baseDate: Date): Date[] {
  const year = baseDate.getFullYear()
  const month = baseDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1))
}

// Padding at top of grid so first hour label isn't clipped
const GRID_TOP_PAD = 12

export default function ReservationCalendar() {
  const { t, i18n } = useTranslation('reservations')
  const { venueId, fullBasePath } = useCurrentVenue()
  const navigate = useNavigate()
  const { t: tCommon } = useTranslation()
  const locale = i18n.language
  const { formatTime, formatDateISO: formatVenueDateISO, venueTimezone } = useVenueDateTime()
  const queryClient = useQueryClient()

  const { data: settings } = useQuery({
    queryKey: ['reservation-settings', venueId],
    queryFn: () => reservationService.getSettings(venueId),
  })
  const HOURS = useMemo(() => computeHoursFromSettings(settings), [settings])
  const firstHour = HOURS[0]

  const [view, setView] = useState<CalendarView>('day')
  const [groupBy, setGroupBy] = useState<GroupByMode>('none')
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

  // Edit class session dialog state
  const [editSessionId, setEditSessionId] = useState<string | null>(null)

  // Drag/resize refs (declared early — handlers are set up after classSessions is available)
  const dragRef = useRef<{
    sessionId: string
    startX: number
    startY: number
    originalTop: number
    durationHours: number
    dayKey: string
    el: HTMLDivElement
    didDrag: boolean
    mode: 'move' | 'resize-top' | 'resize-bottom'
    originalHeight: number
  } | null>(null)
  const didDragRef = useRef(false)
  const { toast } = useToast()

  // Edit availability dialog state
  const [availabilityOpen, setAvailabilityOpen] = useState(false)

  // Calendar attributes dialog state
  const [attributesOpen, setAttributesOpen] = useState(false)
  const [calendarAttrs, setCalendarAttrs] = useState<CalendarAttributes>(loadAttributes)

  // Grid click context menu state (choose event type before opening form)
  const [gridClickMenu, setGridClickMenu] = useState<{
    open: boolean
    x: number
    y: number
    date: string
    startTime: string
  }>({ open: false, x: 0, y: 0, date: '', startTime: '' })
  const gridClickMenuRef = useRef<HTMLDivElement>(null)

  // Hover highlight state — tracks which 15-min slot the cursor is over
  const [hoverSlot, setHoverSlot] = useState<{ top: number; time: string; dayKey: string } | null>(null)

  // Close grid click menu on outside click
  useEffect(() => {
    if (!gridClickMenu.open) return
    const handler = (e: MouseEvent) => {
      if (gridClickMenuRef.current && !gridClickMenuRef.current.contains(e.target as Node)) {
        setGridClickMenu(prev => ({ ...prev, open: false }))
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [gridClickMenu.open])

  const createFormSubmitRef = useMemo<MutableRefObject<(() => void) | null>>(() => ({ current: null }), [])

  // Calculate date range based on view
  const { dateFrom, dateTo, displayDays } = useMemo(() => {
    if (view === 'day') {
      const iso = formatVenueDateISO(currentDate)
      return { dateFrom: iso, dateTo: iso, displayDays: [currentDate] }
    }
    if (view === '5day') {
      const days = get5Days(currentDate)
      return { dateFrom: formatVenueDateISO(days[0]), dateTo: formatVenueDateISO(days[4]), displayDays: days }
    }
    if (view === 'month') {
      const days = getMonthDays(currentDate)
      return { dateFrom: formatVenueDateISO(days[0]), dateTo: formatVenueDateISO(days[days.length - 1]), displayDays: days }
    }
    const days = getWeekDays(currentDate)
    return {
      dateFrom: formatVenueDateISO(days[0]),
      dateTo: formatVenueDateISO(days[6]),
      displayDays: days,
    }
  }, [view, currentDate, formatVenueDateISO])

  // Fetch calendar data (reservations) — pass groupBy when active for day view
  const activeGroupBy = view === 'day' && groupBy !== 'none' ? groupBy : undefined
  const { data: calendarData, isLoading } = useQuery({
    queryKey: ['reservation-calendar', venueId, dateFrom, dateTo, activeGroupBy],
    queryFn: () => reservationService.getCalendar(venueId, dateFrom, dateTo, activeGroupBy),
    enabled: !!dateFrom && !!dateTo,
  })

  const reservations = useMemo(() => calendarData?.reservations ?? [], [calendarData])

  // Fetch class sessions for the same date range
  const { data: classSessions = [] } = useQuery({
    queryKey: ['class-sessions', venueId, dateFrom, dateTo],
    queryFn: () => classSessionService.getClassSessions(venueId!, { dateFrom, dateTo }),
    enabled: !!dateFrom && !!dateTo && !!venueId,
  })

  // Drag-to-reschedule: mutation + document-level handlers (must be after classSessions)
  const dragUpdateMutation = useMutation({
    mutationFn: ({ sessionId, startsAt, endsAt }: { sessionId: string; startsAt: string; endsAt: string }) =>
      classSessionService.updateClassSession(venueId!, sessionId, { startsAt, endsAt }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-sessions', venueId] })
      queryClient.invalidateQueries({ queryKey: ['reservation-calendar', venueId] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Error al mover la clase'
      toast({ title: msg, variant: 'destructive' })
      queryClient.invalidateQueries({ queryKey: ['class-sessions', venueId] })
    },
  })

  useEffect(() => {
    // Find the day column ([data-day-key]) under the cursor
    function getDayKeyAtPoint(x: number, y: number): string | null {
      const els = document.elementsFromPoint(x, y)
      for (const el of els) {
        const dayKey = (el as HTMLElement).dataset?.dayKey
        if (dayKey) return dayKey
      }
      return null
    }

    // Compute the time (snapped to 15min) from a Y position inside a day column
    function getTimeAtPoint(x: number, y: number): number | null {
      const els = document.elementsFromPoint(x, y)
      for (const el of els) {
        if (!(el as HTMLElement).dataset?.dayKey) continue
        const rect = el.getBoundingClientRect()
        const relY = y - rect.top
        const hourFloat = (relY - GRID_TOP_PAD) / 64 + firstHour
        return Math.round(hourFloat * 60 / 15) * 15 // total minutes, snapped
      }
      return null
    }

    let highlightedCol: HTMLElement | null = null

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const deltaY = e.clientY - dragRef.current.startY
      const deltaX = dragRef.current.mode === 'move' ? (e.clientX - dragRef.current.startX) : 0
      if (!dragRef.current.didDrag && Math.abs(deltaY) < 4 && Math.abs(deltaX) < 4) return
      e.preventDefault()
      dragRef.current.didDrag = true

      const { mode, el, originalHeight } = dragRef.current
      el.style.opacity = '0.7'
      el.style.zIndex = '30'
      el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'

      if (mode === 'move') {
        el.style.transform = `translateY(${deltaY}px)`

        // Highlight target day column during cross-day drag
        const targetDayKey = getDayKeyAtPoint(e.clientX, e.clientY)
        if (targetDayKey && targetDayKey !== dragRef.current.dayKey) {
          const targetCol = document.querySelector(`[data-day-key="${targetDayKey}"]`) as HTMLElement | null
          if (highlightedCol && highlightedCol !== targetCol) {
            highlightedCol.style.backgroundColor = ''
          }
          if (targetCol) {
            targetCol.style.backgroundColor = 'rgba(139, 92, 246, 0.06)'
            highlightedCol = targetCol
          }
        } else if (highlightedCol) {
          highlightedCol.style.backgroundColor = ''
          highlightedCol = null
        }
      } else if (mode === 'resize-bottom') {
        const newHeight = Math.max(16, originalHeight + deltaY)
        el.style.height = `${newHeight}px`
      } else if (mode === 'resize-top') {
        const newHeight = Math.max(16, originalHeight - deltaY)
        const topShift = originalHeight - newHeight
        el.style.transform = `translateY(${topShift}px)`
        el.style.height = `${newHeight}px`
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (!dragRef.current) return
      const drag = dragRef.current
      const wasDrag = drag.didDrag

      // Clean up highlight
      if (highlightedCol) {
        highlightedCol.style.backgroundColor = ''
        highlightedCol = null
      }

      // Reset all inline styles
      drag.el.style.transform = ''
      drag.el.style.opacity = ''
      drag.el.style.zIndex = ''
      drag.el.style.boxShadow = ''
      drag.el.style.height = ''
      didDragRef.current = wasDrag
      dragRef.current = null

      if (!wasDrag) return

      const session = classSessions.find(s => s.id === drag.sessionId)
      if (!session) return

      const tz = venueTimezone
      const origStart = DateTime.fromISO(session.startsAt, { zone: 'utc' }).setZone(tz)
      const origEnd = DateTime.fromISO(session.endsAt, { zone: 'utc' }).setZone(tz)
      const durationMin = origEnd.diff(origStart, 'minutes').minutes

      let newStart = origStart
      let newEnd = origEnd

      if (drag.mode === 'move') {
        // Detect target day column for cross-day drag
        const targetDayKey = getDayKeyAtPoint(e.clientX, e.clientY)
        const targetMinutes = getTimeAtPoint(e.clientX, e.clientY)

        if (targetDayKey && targetMinutes !== null) {
          // Build new start from target day + snapped time
          const targetDate = DateTime.fromISO(targetDayKey, { zone: tz })
          const hour = Math.floor(targetMinutes / 60)
          const minute = targetMinutes % 60
          newStart = targetDate.set({ hour, minute, second: 0, millisecond: 0 })
          newEnd = newStart.plus({ minutes: durationMin })
        } else {
          // Fallback: same-day vertical drag
          const deltaY = e.clientY - drag.startY
          const deltaMinutes = Math.round((deltaY / 64) * 60 / 15) * 15
          if (Math.abs(deltaMinutes) < 15) return
          newStart = origStart.plus({ minutes: deltaMinutes })
          newEnd = origEnd.plus({ minutes: deltaMinutes })
        }

        // Check nothing actually changed
        if (newStart.equals(origStart) && newEnd.equals(origEnd)) return
      } else if (drag.mode === 'resize-bottom') {
        const deltaY = e.clientY - drag.startY
        const deltaMinutes = Math.round((deltaY / 64) * 60 / 15) * 15
        if (Math.abs(deltaMinutes) < 15) return
        newEnd = origEnd.plus({ minutes: deltaMinutes })
        if (newEnd.diff(origStart, 'minutes').minutes < 15) return
      } else if (drag.mode === 'resize-top') {
        const deltaY = e.clientY - drag.startY
        const deltaMinutes = Math.round((deltaY / 64) * 60 / 15) * 15
        if (Math.abs(deltaMinutes) < 15) return
        newStart = origStart.plus({ minutes: deltaMinutes })
        if (origEnd.diff(newStart, 'minutes').minutes < 15) return
      }

      // Don't allow before first hour
      if (newStart.hour < firstHour) return

      dragUpdateMutation.mutate({
        sessionId: drag.sessionId,
        startsAt: newStart.toUTC().toISO()!,
        endsAt: newEnd.toUTC().toISO()!,
      })
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [classSessions, venueTimezone, firstHour, dragUpdateMutation])

  const handleSessionDragStart = useCallback((
    e: React.MouseEvent,
    session: (typeof classSessions)[0],
    top: number,
    height: number,
    mode: 'move' | 'resize-top' | 'resize-bottom',
  ) => {
    if (session.status === 'CANCELLED' || session.status === 'COMPLETED') return
    e.stopPropagation()
    e.preventDefault()
    const el = (mode === 'move' ? e.currentTarget : e.currentTarget.parentElement) as HTMLDivElement
    const start = DateTime.fromISO(session.startsAt, { zone: 'utc' }).setZone(venueTimezone)
    const end = DateTime.fromISO(session.endsAt, { zone: 'utc' }).setZone(venueTimezone)
    didDragRef.current = false
    dragRef.current = {
      sessionId: session.id,
      startX: e.clientX,
      startY: e.clientY,
      originalTop: top,
      durationHours: end.diff(start, 'hours').hours,
      dayKey: start.toFormat('yyyy-MM-dd'),
      el,
      didDrag: false,
      mode,
      originalHeight: height,
    }
  }, [venueTimezone])

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
  const navStep = view === 'day' ? 1 : view === '5day' ? 5 : view === 'month' ? 30 : 7
  const goPrev = () => setCurrentDate(prev => view === 'month'
    ? new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    : addDays(prev, -navStep))
  const goNext = () => setCurrentDate(prev => view === 'month'
    ? new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    : addDays(prev, navStep))

  // Format current date display
  const dateDisplay = useMemo(() => {
    if (view === 'day') {
      return currentDate.toLocaleDateString(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    }
    if (view === 'month') {
      return currentDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
    }
    const days = view === '5day' ? get5Days(currentDate) : getWeekDays(currentDate)
    const from = days[0].toLocaleDateString(locale, { month: 'short', day: 'numeric' })
    const to = days[days.length - 1].toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
    return `${from} – ${to}`
  }, [view, currentDate, locale])

  // Group reservations by day for rendering
  // Exclude reservations tied to a ClassSession — those are already shown inside the class block
  // Respect calendar attribute filters (show/hide confirmed, pending, cancelled)
  const reservationsByDay = useMemo(() => {
    const map: Record<string, Reservation[]> = {}
    for (const r of reservations) {
      if (r.classSessionId) continue
      if (r.status === 'CANCELLED' && !calendarAttrs.showCancelled) continue
      if (r.status === 'PENDING' && !calendarAttrs.showPending) continue
      if ((r.status === 'CONFIRMED' || r.status === 'CHECKED_IN' || r.status === 'COMPLETED') && !calendarAttrs.showConfirmed) continue
      const dayKey = formatVenueDateISO(r.startsAt)
      if (!map[dayKey]) map[dayKey] = []
      map[dayKey].push(r)
    }
    return map
  }, [reservations, formatVenueDateISO, calendarAttrs.showCancelled, calendarAttrs.showPending, calendarAttrs.showConfirmed])

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

  // Compute grouped columns for day view when groupBy is active
  const groupedColumns = useMemo(() => {
    if (!activeGroupBy || !calendarData?.grouped) return null
    const entries = Object.entries(calendarData.grouped)

    // Apply calendar attribute filters to each group
    const filtered = entries.map(([key, rsvps]) => {
      const filteredRsvps = rsvps.filter(r => {
        if (r.classSessionId) return false
        if (r.status === 'CANCELLED' && !calendarAttrs.showCancelled) return false
        if (r.status === 'PENDING' && !calendarAttrs.showPending) return false
        if ((r.status === 'CONFIRMED' || r.status === 'CHECKED_IN' || r.status === 'COMPLETED') && !calendarAttrs.showConfirmed) return false
        return true
      })

      // Derive column header from reservation data
      let headerLabel: string
      if (key === 'unassigned' || key === 'null') {
        headerLabel = t('calendar.groupBy.unassigned')
      } else if (activeGroupBy === 'staff') {
        const staff = rsvps[0]?.assignedStaff
        headerLabel = staff ? `${staff.firstName} ${staff.lastName}` : key
      } else {
        const table = rsvps[0]?.table
        headerLabel = table ? `${t('columns.table')} ${table.number}` : key
      }

      return { key, headerLabel, reservations: filteredRsvps }
    })

    // Sort: named columns first, unassigned last
    return filtered.sort((a, b) => {
      if (a.key === 'unassigned' || a.key === 'null') return 1
      if (b.key === 'unassigned' || b.key === 'null') return -1
      return a.headerLabel.localeCompare(b.headerLabel)
    })
  }, [activeGroupBy, calendarData?.grouped, calendarAttrs.showCancelled, calendarAttrs.showPending, calendarAttrs.showConfirmed, t])

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
    const canDrag = session.status !== 'CANCELLED' && session.status !== 'COMPLETED'

    return (
      <div
        key={`cs-${session.id}`}
        data-reservation="true"
        className={`absolute left-1 right-1 rounded-md border px-2 py-1 text-xs overflow-hidden bg-violet-500/20 border-violet-500/40 text-violet-700 dark:text-violet-300 select-none group ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
        style={{ top: `${top}px`, height: `${height}px` }}
        onMouseDown={e => {
          if (e.button !== 0 || !canDrag) return
          handleSessionDragStart(e, session, top, height, 'move')
        }}
        onClick={e => {
          e.stopPropagation()
          if (didDragRef.current) {
            didDragRef.current = false
            return
          }
          setEditSessionId(session.id)
        }}
      >
        {/* Top resize handle */}
        {canDrag && (
          <div
            className="absolute top-0 left-0 right-0 h-1.5 cursor-n-resize z-10 opacity-0 group-hover:opacity-100 bg-violet-500/30 rounded-t-md"
            onMouseDown={e => {
              if (e.button !== 0) return
              handleSessionDragStart(e, session, top, height, 'resize-top')
            }}
          />
        )}

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

        {/* Bottom resize handle */}
        {canDrag && (
          <div
            className="absolute bottom-0 left-0 right-0 h-1.5 cursor-s-resize z-10 opacity-0 group-hover:opacity-100 bg-violet-500/30 rounded-b-md"
            onMouseDown={e => {
              if (e.button !== 0) return
              handleSessionDragStart(e, session, top, height, 'resize-bottom')
            }}
          />
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

  const handleGridMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>, day: Date) => {
    if ((e.target as HTMLElement).closest('[data-reservation]')) {
      setHoverSlot(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const hourFloat = (y - GRID_TOP_PAD) / 64 + firstHour

    const hour = Math.floor(hourFloat)
    const rawMinutes = Math.round(((hourFloat - hour) * 60) / 15) * 15
    const snappedMinutes = rawMinutes >= 60 ? 0 : rawMinutes
    const snappedHour = rawMinutes >= 60 ? hour + 1 : hour

    if (snappedHour < firstHour || snappedHour > lastHour) {
      setHoverSlot(null)
      return
    }

    const top = (snappedHour - firstHour) * 64 + (snappedMinutes / 60) * 64 + GRID_TOP_PAD
    const time = `${String(snappedHour).padStart(2, '0')}:${String(snappedMinutes).padStart(2, '0')}`
    const dayKey = formatVenueDateISO(day)
    setHoverSlot(prev => (prev?.time === time && prev?.dayKey === dayKey ? prev : { top, time, dayKey }))
  }, [firstHour, lastHour, formatVenueDateISO])

  const handleGridMouseLeave = useCallback(() => setHoverSlot(null), [])

  // Handle click on empty grid area — show event type picker
  const handleGridClick = useCallback((e: React.MouseEvent<HTMLDivElement>, day: Date) => {
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

    // Show the event type picker at click position
    setGridClickMenu({ open: true, x: e.clientX, y: e.clientY, date, startTime })
  }, [firstHour, lastHour, formatVenueDateISO])

  const handleGridMenuSelect = useCallback((type: 'reservation' | 'class') => {
    const { date, startTime } = gridClickMenu
    setGridClickMenu(prev => ({ ...prev, open: false }))
    if (type === 'reservation') {
      setCreateModal({ open: true, date, startTime })
    } else {
      setClassModal({ open: true, date, startTime })
    }
  }, [gridClickMenu])

  // Render the day column
  const renderDayColumn = (day: Date, isWide: boolean) => {
    const dayKey = formatVenueDateISO(day)
    const dayReservations = reservationsByDay[dayKey] || []
    const dayClassSessions = classSessionsByDay[dayKey] || []
    const dayIsToday = isToday(day)

    return (
      <div key={dayKey} className={`relative border-l border-border/30 ${isWide ? 'flex-1' : 'flex-1 min-w-[120px]'}`}>
        {/* Day header (multi-day views) */}
        {view !== 'day' && view !== 'month' && (
          <div
            className={`sticky top-0 z-10 border-b border-border px-2 py-1 text-center ${dayIsToday ? 'bg-primary/5' : 'bg-background'}`}
          >
            <div className="text-xs text-muted-foreground">{day.toLocaleDateString(locale, { weekday: 'short' })}</div>
            <div
              className={`text-sm font-medium ${dayIsToday ? 'bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center mx-auto' : ''}`}
            >
              {day.getDate()}
            </div>
          </div>
        )}

        {/* Time grid */}
        <div
          data-day-key={dayKey}
          className={`relative cursor-pointer ${dayIsToday && view === 'day' ? 'bg-primary/2' : ''}`}
          style={{ height: `${HOURS.length * 64 + GRID_TOP_PAD + 8}px` }}
          onClick={e => handleGridClick(e, day)}
          onMouseMove={e => handleGridMouseMove(e, day)}
          onMouseLeave={handleGridMouseLeave}
        >
          {/* Hover highlight — 15min slot preview */}
          {hoverSlot && hoverSlot.dayKey === dayKey && (
            <div
              className="absolute left-1 right-1 rounded-md bg-primary/10 border border-primary/25 pointer-events-none z-10 flex items-center px-2"
              style={{ top: `${hoverSlot.top}px`, height: '16px' }}
            >
              <span className="text-[10px] font-medium text-primary/70">{hoverSlot.time}</span>
            </div>
          )}

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

  // Render a grouped column (staff/table) for day view
  const renderGroupedColumn = (col: { key: string; headerLabel: string; reservations: Reservation[] }, day: Date) => {
    const dayKey = formatVenueDateISO(day)
    const dayIsToday = isToday(day)

    return (
      <div key={col.key} className="relative border-l border-border/30 flex-1 min-w-[160px]">
        {/* Column header — staff name or table number */}
        <div
          className={`sticky top-0 z-10 border-b border-border px-2 py-1.5 text-center ${dayIsToday ? 'bg-primary/5' : 'bg-background'}`}
        >
          <div className="text-sm font-medium truncate">{col.headerLabel}</div>
          <div className="text-xs text-muted-foreground">{col.reservations.length} {col.reservations.length === 1 ? t('people', { count: 1 }).split(' ').pop() : ''}</div>
        </div>

        {/* Time grid */}
        <div
          data-day-key={dayKey}
          className={`relative cursor-pointer ${dayIsToday ? 'bg-primary/2' : ''}`}
          style={{ height: `${HOURS.length * 64 + GRID_TOP_PAD + 8}px` }}
          onClick={e => handleGridClick(e, day)}
          onMouseMove={e => handleGridMouseMove(e, day)}
          onMouseLeave={handleGridMouseLeave}
        >
          {/* Hover highlight */}
          {hoverSlot && hoverSlot.dayKey === dayKey && (
            <div
              className="absolute left-1 right-1 rounded-md bg-primary/10 border border-primary/25 pointer-events-none z-10 flex items-center px-2"
              style={{ top: `${hoverSlot.top}px`, height: '16px' }}
            >
              <span className="text-[10px] font-medium text-primary/70">{hoverSlot.time}</span>
            </div>
          )}

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

          {/* Reservation blocks for this group */}
          {col.reservations.map(renderReservationBlock)}
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
          {/* Date navigation with popover picker */}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 font-medium">
                <CalendarDays className="h-3.5 w-3.5" />
                {dateDisplay}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-fit p-0" align="start">
              <div className="inline-flex">
                {/* Presets */}
                <div className="border-r border-border p-2 space-y-0.5">
                  <button
                    className="block text-left px-3 py-1.5 text-sm rounded-md hover:bg-accent cursor-pointer whitespace-nowrap"
                    onClick={() => { setCurrentDate(new Date()) }}
                  >
                    {t('tabs.today', { defaultValue: 'Hoy' })}
                  </button>
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <button
                      key={n}
                      className="block text-left px-3 py-1.5 text-sm rounded-md hover:bg-accent cursor-pointer text-muted-foreground whitespace-nowrap"
                      onClick={() => { setCurrentDate(addDays(new Date(), n * 7)) }}
                    >
                      {t('calendar.inWeeks', { count: n, defaultValue: `En ${n} semana${n > 1 ? 's' : ''}` })}
                    </button>
                  ))}
                </div>
                {/* Calendar */}
                <div className="p-2">
                  <Calendar
                    mode="single"
                    selected={currentDate}
                    onSelect={date => { if (date) setCurrentDate(date) }}
                    weekStartsOn={1}
                    locale={getDateFnsLocale(locale)}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* View interval — dropdown like Square, next to date picker */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium">
                {t('calendar.interval', { defaultValue: 'Intervalo' })}{' '}
                <span className="font-bold">
                  {view === 'day' ? t('calendar.views.day')
                    : view === '5day' ? t('calendar.views.5day', { defaultValue: '5-días' })
                    : view === 'month' ? t('calendar.views.month', { defaultValue: 'Mes' })
                    : t('calendar.views.week')}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-36">
              {(['day', 'week', '5day', 'month'] as CalendarView[]).map(v => (
                <DropdownMenuItem
                  key={v}
                  className={`cursor-pointer ${view === v ? 'font-bold bg-accent' : ''}`}
                  onClick={() => setView(v)}
                >
                  {v === 'day' ? t('calendar.views.day')
                    : v === '5day' ? t('calendar.views.5day', { defaultValue: '5-días' })
                    : v === 'month' ? t('calendar.views.month', { defaultValue: 'Mes' })
                    : t('calendar.views.week')}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* GroupBy dropdown — only visible in day view */}
          {view === 'day' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium">
                  <Columns3 className="h-3.5 w-3.5" />
                  {groupBy === 'none'
                    ? t('calendar.groupBy.label')
                    : `${t('calendar.groupBy.label')}: `}
                  {groupBy !== 'none' && (
                    <span className="font-bold">
                      {groupBy === 'staff' ? t('calendar.groupBy.staff') : t('calendar.groupBy.table')}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                {(['none', 'staff', 'table'] as GroupByMode[]).map(mode => (
                  <DropdownMenuItem
                    key={mode}
                    className={`cursor-pointer ${groupBy === mode ? 'font-bold bg-accent' : ''}`}
                    onClick={() => setGroupBy(mode)}
                  >
                    {mode === 'none' ? t('calendar.groupBy.none')
                      : mode === 'staff' ? t('calendar.groupBy.staff')
                      : t('calendar.groupBy.table')}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Calendar attributes — gear icon like Square */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setAttributesOpen(true)}
            title={t('calendarAttributes.title', { defaultValue: 'Atributos de la cita' })}
          >
            <Settings className="h-4 w-4" />
          </Button>

          {/* Edit availability — clock icon like Square */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setAvailabilityOpen(true)}
            title={t('availability.title', { defaultValue: 'Editar disponibilidad' })}
          >
            <Clock className="h-4 w-4" />
          </Button>

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
        </div>
      </div>

      {/* Calendar Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">{tCommon('loading')}</div>
      ) : view === 'month' ? (
        /* Month view — compact grid of day cells */
        <div className="rounded-xl border border-border overflow-auto max-h-[calc(100vh-220px)]">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(d => (
              <div key={d} className="px-2 py-1.5 text-xs font-medium text-muted-foreground text-center border-r border-border/30 last:border-r-0">
                {t(`settings.operatingHours.days.${d}`).slice(0, 3)}
              </div>
            ))}
          </div>
          {/* Day cells — padded to start on correct weekday */}
          <div className="grid grid-cols-7">
            {/* Empty cells for days before month start */}
            {Array.from({ length: (displayDays[0].getDay() + 6) % 7 }, (_, i) => (
              <div key={`pad-${i}`} className="min-h-[100px] border-r border-b border-border/30" />
            ))}
            {displayDays.map(day => {
              const dayKey = formatVenueDateISO(day)
              const dayReservations = reservationsByDay[dayKey] || []
              const dayClassSessions = classSessionsByDay[dayKey] || []
              const dayIsToday = isToday(day)
              const totalEvents = dayReservations.length + dayClassSessions.length

              return (
                <div
                  key={dayKey}
                  className={`min-h-[100px] border-r border-b border-border/30 p-1.5 cursor-pointer hover:bg-accent/30 transition-colors ${dayIsToday ? 'bg-primary/5' : ''}`}
                  onClick={() => { setCurrentDate(day); setView('day') }}
                >
                  <div className={`text-sm mb-1 ${dayIsToday ? 'bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center' : 'text-foreground'}`}>
                    {day.getDate()}
                  </div>
                  {/* Compact event indicators */}
                  {dayReservations.slice(0, 3).map(r => (
                    <div
                      key={r.id}
                      className={`text-[10px] leading-tight truncate rounded px-1 py-0.5 mb-0.5 ${statusColorMap[r.status]}`}
                    >
                      {r.customer ? r.customer.firstName : r.guestName || '—'} {formatTime(r.startsAt)}
                    </div>
                  ))}
                  {dayClassSessions.slice(0, 2).map(s => (
                    <div
                      key={s.id}
                      className="text-[10px] leading-tight truncate rounded px-1 py-0.5 mb-0.5 bg-violet-500/20 text-violet-700 dark:text-violet-300"
                    >
                      {s.product.name} {formatTime(s.startsAt)}
                    </div>
                  ))}
                  {totalEvents > 5 && (
                    <div className="text-[10px] text-muted-foreground">+{totalEvents - 5}</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* Time-axis view (day, week, 5day) */
        <div ref={scrollRef} className="rounded-xl border border-border overflow-auto max-h-[calc(100vh-220px)]">
          <div className="flex min-w-[600px]">
            {/* Time axis */}
            <div className="w-14 shrink-0 border-r border-border">
              {(view !== 'day' || (groupedColumns && groupedColumns.length > 0)) && <div className="sticky top-0 bg-background z-10 border-b border-border h-[44px]" />}
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

            {/* Day columns — use grouped columns when groupBy is active in day view */}
            {view === 'day' && groupedColumns && groupedColumns.length > 0
              ? groupedColumns.map(col => renderGroupedColumn(col, currentDate))
              : displayDays.map(day => renderDayColumn(day, displayDays.length === 1))
            }
          </div>
        </div>
      )}

      {/* Grid click — event type picker */}
      {gridClickMenu.open && (
        <div
          ref={gridClickMenuRef}
          className="fixed z-50 w-48 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95"
          style={{ top: gridClickMenu.y, left: gridClickMenu.x }}
        >
          <div className="p-1">
            <button
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
              onClick={() => handleGridMenuSelect('reservation')}
            >
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              {t('calendar.createCita', { defaultValue: 'Cita' })}
            </button>
            <div className="mx-2 my-0.5 h-px bg-border" />
            <button
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
              onClick={() => handleGridMenuSelect('class')}
            >
              <Users className="h-4 w-4 text-muted-foreground" />
              {t('calendar.createClase', { defaultValue: 'Clase' })}
            </button>
          </div>
          <div className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
            {gridClickMenu.startTime}
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

      {/* Edit class session dialog */}
      <EditClassSessionDialog
        open={!!editSessionId}
        onOpenChange={open => !open && setEditSessionId(null)}
        sessionId={editSessionId}
      />

      {/* Edit availability dialog */}
      <EditAvailabilityDialog
        open={availabilityOpen}
        onOpenChange={setAvailabilityOpen}
      />

      {/* Calendar attributes dialog */}
      <CalendarAttributesDialog
        open={attributesOpen}
        onOpenChange={setAttributesOpen}
        onSave={setCalendarAttrs}
      />
    </div>
  )
}
