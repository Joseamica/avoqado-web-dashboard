import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Columns3, Eye, EyeOff, Plus, Settings, Users } from 'lucide-react'
import { DateTime } from 'luxon'
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { tableName } from '@/lib/tableName'
import { useNavigate } from 'react-router-dom'

import { AvisoDeCarga } from '@/components/AvisoDeCarga'
import { falloDeCarga } from '@/lib/falloDeCarga'
import { nombreCompleto } from '@/lib/nombreCompleto'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
// Select and Tabs removed — view toggle now uses dropdown
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { useToast } from '@/hooks/use-toast'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useAccess } from '@/hooks/use-access'
import { useVenueDateTime } from '@/utils/datetime'
import { getDateFnsLocale } from '@/utils/i18n-locale'
import reservationService from '@/services/reservation.service'
import classSessionService, { type ClassSession } from '@/services/classSession.service'
import googleCalendarService, { type ExternalBusyBlock } from '@/services/googleCalendar.service'
import type { Reservation, ReservationSettings, ReservationStatus, RescheduleNotificationChannel } from '@/types/reservation'

import { CreateReservationForm } from './CreateReservation'
import { avisoPorOmision, CANALES_DE_AVISO } from './reagendar'
import { CreateClassSessionDialog } from './components/CreateClassSessionDialog'
import { EditClassSessionDialog } from './components/EditClassSessionDialog'
import { useClaseDelEnlace } from './useClaseDelEnlace'
import { ClassSessionPassesLine } from './components/ClassSessionPassesLine'
import { EditAvailabilityDialog } from './components/EditAvailabilityDialog'
import { CalendarAttributesDialog, loadAttributes, type CalendarAttributes } from './components/CalendarAttributesDialog'
import { GoogleCalendarBusyBlock } from './components/GoogleCalendarBusyBlock'
import {
  carrilesDe,
  columnasAgrupadas,
  diaLocal,
  fechaDelDia,
  horasConEventos,
  paddingDelCarril,
  posicionDelCarril,
  type Carril,
  type ColumnaAgrupada,
} from './calendar-layout'

type CalendarView = 'day' | 'week' | '5day' | 'month'
type GroupByMode = 'none' | 'staff' | 'table'

const VIEW_STORAGE_KEY = 'avoqado:calendar-view'
const GROUP_BY_STORAGE_KEY = 'avoqado:calendar-group-by'
// Persisted Google Calendar overlay toggle — operators have strong opinions
// about whether to see external busy blocks; we honor their last choice across
// sessions. Defaults to ON because Phase 1 users' #1 complaint was "ya
// conectado no se ve nada en el calendario".
const GCAL_OVERLAY_STORAGE_KEY = 'gcal:overlay:visible'

function loadView(): CalendarView {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY)
    if (stored === 'day' || stored === 'week' || stored === '5day' || stored === 'month') return stored
  } catch {
    // localStorage unavailable (SSR / privacy mode) — fall through to default
  }
  return 'day'
}

function loadGroupBy(): GroupByMode {
  try {
    const stored = localStorage.getItem(GROUP_BY_STORAGE_KEY)
    if (stored === 'none' || stored === 'staff' || stored === 'table') return stored
  } catch {
    // localStorage unavailable — fall through to default
  }
  return 'none'
}

function loadGcalOverlay(): boolean {
  try {
    const stored = localStorage.getItem(GCAL_OVERLAY_STORAGE_KEY)
    if (stored === 'false') return false
  } catch {
    // localStorage unavailable — fall through to default
  }
  return true
}

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
// Lista vacía estable mientras cargan las clases: un `[]` nuevo en cada render recalcularía horas y carriles.
const SIN_CLASES: ClassSession[] = []

export default function ReservationCalendar() {
  const { t, i18n } = useTranslation('reservations')
  const { venueId, fullBasePath } = useCurrentVenue()
  // D107: sólo quien puede editar reservas las mueve arrastrando; quien sólo las ve, las abre.
  const puedeMoverCitas = useAccess().can('reservations:update')
  const navigate = useNavigate()
  const { t: tCommon } = useTranslation()
  const { t: tGcal } = useTranslation('googleCalendar')
  const locale = i18n.language
  const { formatTime, formatDateISO: formatVenueDateISO, venueTimezone } = useVenueDateTime()
  const queryClient = useQueryClient()

  const { data: settings } = useQuery({
    queryKey: ['reservation-settings', venueId],
    queryFn: () => reservationService.getSettings(venueId),
  })
  const [view, setView] = useState<CalendarView>(loadView)
  const [groupBy, setGroupBy] = useState<GroupByMode>(loadGroupBy)
  // D114: el día que se ve arranca en el HOY DEL NEGOCIO (no el de la computadora) y cada columna usa la fecha que se ve.
  const [currentDate, setCurrentDate] = useState(() => diaLocal(formatVenueDateISO(new Date())))
  // Google Calendar overlay toggle — when off, we skip the network call too
  // (TanStack `enabled: gcalOverlayVisible`) so we don't burn bandwidth on
  // operators who don't care about external blockers.
  const [gcalOverlayVisible, setGcalOverlayVisible] = useState<boolean>(loadGcalOverlay)

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view)
    } catch {
      // localStorage unavailable (SSR / privacy mode) — fall through to default
    }
  }, [view])

  useEffect(() => {
    try {
      localStorage.setItem(GROUP_BY_STORAGE_KEY, groupBy)
    } catch {
      // localStorage unavailable (SSR / privacy mode) — fall through to default
    }
  }, [groupBy])

  useEffect(() => {
    try {
      localStorage.setItem(GCAL_OVERLAY_STORAGE_KEY, gcalOverlayVisible ? 'true' : 'false')
    } catch {
      // localStorage unavailable — fall through to in-memory state only
    }
  }, [gcalOverlayVisible])

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
  // Abrir una clase por enlace (`?clase=<id>`), p. ej. desde «Diferencias por liquidar» de pago por servicio: la única salida
  // de una diferencia trabada es «Ajustar monto» en la clase.
  useClaseDelEnlace(venueId, setEditSessionId)

  // Drag/resize refs (declared early — handlers are set up after classSessions is available)
  const dragRef = useRef<{
    /** D107: también las citas se arrastran (sólo para moverlas; reagendar pide confirmar y cómo avisarle al cliente). */
    kind: 'clase' | 'cita'
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
    /** Cuántos px abajo del borde superior de la tarjeta se agarró: la clase empieza donde queda ese borde, no el ratón. */
    grabOffset: number
    /** La columna donde empezó el arrastre (en agrupado hay varias del mismo día). */
    colEl: HTMLElement | null
  } | null>(null)
  const didDragRef = useRef(false)
  const { toast } = useToast()

  // Edit availability dialog state
  const [availabilityOpen, setAvailabilityOpen] = useState(false)

  // Calendar attributes dialog state
  const [attributesOpen, setAttributesOpen] = useState(false)
  const [calendarAttrs, setCalendarAttrs] = useState<CalendarAttributes>(loadAttributes)
  // Qué reservaciones se dibujan según «Atributos de la cita». Las de una clase van dentro de su clase.
  const mostrarReserva = useCallback(
    (r: Reservation) => {
      if (r.classSessionId) return false
      if (r.status === 'CANCELLED' && !calendarAttrs.showCancelled) return false
      if (r.status === 'PENDING' && !calendarAttrs.showPending) return false
      if ((r.status === 'CONFIRMED' || r.status === 'CHECKED_IN' || r.status === 'COMPLETED') && !calendarAttrs.showConfirmed) return false
      return true
    },
    [calendarAttrs.showCancelled, calendarAttrs.showPending, calendarAttrs.showConfirmed],
  )

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
      const iso = fechaDelDia(currentDate)
      return { dateFrom: iso, dateTo: iso, displayDays: [currentDate] }
    }
    if (view === '5day') {
      const days = get5Days(currentDate)
      return { dateFrom: fechaDelDia(days[0]), dateTo: fechaDelDia(days[4]), displayDays: days }
    }
    if (view === 'month') {
      const days = getMonthDays(currentDate)
      return { dateFrom: fechaDelDia(days[0]), dateTo: fechaDelDia(days[days.length - 1]), displayDays: days }
    }
    const days = getWeekDays(currentDate)
    return {
      dateFrom: fechaDelDia(days[0]),
      dateTo: fechaDelDia(days[6]),
      displayDays: days,
    }
  }, [view, currentDate])

  // Fetch calendar data (reservations) — pass groupBy when active for day view
  const activeGroupBy = view === 'day' && groupBy !== 'none' ? groupBy : undefined
  const calendarQuery = useQuery({
    queryKey: ['reservation-calendar', venueId, dateFrom, dateTo, activeGroupBy],
    queryFn: () => reservationService.getCalendar(venueId, dateFrom, dateTo, activeGroupBy),
    enabled: !!dateFrom && !!dateTo,
  })
  const { data: calendarData, isLoading } = calendarQuery

  const reservations = useMemo(() => calendarData?.reservations ?? [], [calendarData])

  // Fetch class sessions for the same date range
  const sessionsQuery = useQuery({
    queryKey: ['class-sessions', venueId, dateFrom, dateTo],
    queryFn: () => classSessionService.getClassSessions(venueId!, { dateFrom, dateTo }),
    enabled: !!dateFrom && !!dateTo && !!venueId,
  })
  const { data: classSessions = SIN_CLASES } = sessionsQuery

  // D104: el horario del negocio, estirado para que quepa todo lo agendado en los días a la vista (una cita de 07:00 con
  // horario de 09:00 quedaba fuera del área visible). A propósito con TODAS las citas y no sólo las que el filtro deja ver:
  // así prender o apagar un filtro no cambia el alto de la cuadrícula ni mueve lo que estabas viendo.
  const HOURS = useMemo(
    () =>
      horasConEventos(
        computeHoursFromSettings(settings),
        // D112: el calendario ya trae canceladas; una cancelada sólo estira la cuadrícula si se están mostrando.
        [...reservations.filter(r => !r.classSessionId && (r.status !== 'CANCELLED' || calendarAttrs.showCancelled)), ...classSessions],
        venueTimezone,
      ),
    [settings, reservations, classSessions, venueTimezone, calendarAttrs.showCancelled],
  )
  const firstHour = HOURS[0]

  // ---------------------------------------------------------------------------
  // Google Calendar external busy blocks for the visible range. Treated as a
  // *visual overlay* layered into the same day columns — not a separate calendar.
  // The query is gated by `gcalOverlayVisible` so toggling it off literally
  // stops the network call (no point paying for data we won't render).
  //
  // We pass the venue tz day boundaries as UTC ISO strings — backend interprets
  // them as raw timestamps with no timezone math, so `formatVenueDateISO` +
  // `00:00`/`23:59:59` is enough. staffId is intentionally left undefined here
  // (we show all blocks visible to the operator); future enhancement: pass the
  // active staff filter when group-by=staff narrows down to one column.
  // ---------------------------------------------------------------------------
  const { data: busyBlocksData } = useQuery({
    queryKey: ['gcal-busy-blocks', venueId, dateFrom, dateTo],
    queryFn: () =>
      googleCalendarService.listBusyBlocks(venueId!, {
        from: new Date(`${dateFrom}T00:00:00.000Z`).toISOString(),
        to: new Date(`${dateTo}T23:59:59.999Z`).toISOString(),
      }),
    enabled: gcalOverlayVisible && !!venueId && !!dateFrom && !!dateTo,
    // The overlay is informational, not transactional — 1 minute staleness is
    // plenty for an operator scrolling through the week.
    staleTime: 60_000,
  })

  const busyBlocks = useMemo<ExternalBusyBlock[]>(() => busyBlocksData?.blocks ?? [], [busyBlocksData])

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
    function getColumnAtPoint(x: number, y: number): HTMLElement | null {
      for (const el of document.elementsFromPoint(x, y)) if ((el as HTMLElement).dataset?.dayKey) return el as HTMLElement
      return null
    }
    function getDayKeyAtPoint(x: number, y: number): string | null {
      return getColumnAtPoint(x, y)?.dataset.dayKey ?? null
    }

    // Compute the time (snapped to 15min) from a Y position inside a day column
    function getTimeAtPoint(x: number, y: number, grabOffset = 0): number | null {
      const els = document.elementsFromPoint(x, y)
      for (const el of els) {
        if (!(el as HTMLElement).dataset?.dayKey) continue
        const rect = el.getBoundingClientRect()
        const relY = y - grabOffset - rect.top
        const hourFloat = (relY - GRID_TOP_PAD) / 64 + firstHour
        return Math.round((hourFloat * 60) / 15) * 15 // total minutes, snapped
      }
      return null
    }

    let highlightedCol: HTMLElement | null = null

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const deltaY = e.clientY - dragRef.current.startY
      const deltaX = dragRef.current.mode === 'move' ? e.clientX - dragRef.current.startX : 0
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
      // El alto lo pone React en el `style`; si se borra y el cambio no llega a guardarse, React no lo vuelve a poner y la
      // tarjeta se encoge. Se regresa al de antes.
      drag.el.style.height = `${drag.originalHeight}px`
      didDragRef.current = wasDrag
      dragRef.current = null
      // El clic que sigue al soltar puede caer en otro elemento (el contenedor común) y no limpiaba la marca: el siguiente
      // clic de verdad se perdía. Se limpia sola después de ese clic.
      if (wasDrag) setTimeout(() => (didDragRef.current = false), 0)

      if (!wasDrag) return

      const session =
        drag.kind === 'clase' ? classSessions.find(s => s.id === drag.sessionId) : reservations.find(r => r.id === drag.sessionId)
      if (!session) return

      const tz = venueTimezone
      const origStart = DateTime.fromISO(session.startsAt, { zone: 'utc' }).setZone(tz)
      const origEnd = DateTime.fromISO(session.endsAt, { zone: 'utc' }).setZone(tz)
      const durationMin = origEnd.diff(origStart, 'minutes').minutes

      let newStart = origStart
      let newEnd = origEnd

      if (drag.mode === 'move') {
        // Detect target day column for cross-day drag
        const targetCol = getColumnAtPoint(e.clientX, e.clientY)
        const targetDayKey = targetCol?.dataset.dayKey ?? null
        const targetMinutes = getTimeAtPoint(e.clientX, e.clientY, drag.grabOffset)
        // Agrupado por personal o mesa, todas las columnas son del mismo día: soltar en la de otra persona no reasigna la
        // clase, así que tampoco se le cambia la hora.
        if (targetCol && targetDayKey === drag.dayKey && targetCol !== drag.colEl) return
        // D107: una cita soltada fuera de la cuadrícula (la regla de horas, la cabecera) no se mueve.
        if (drag.kind === 'cita' && !targetCol) return

        if (targetDayKey && targetMinutes !== null) {
          // Soltar a las 23:54 redondea a 24:00, que Luxon vuelve las 00:00 del día siguiente: no se mueve de día así.
          if (targetMinutes < 0 || targetMinutes >= 24 * 60) return
          // Build new start from target day + snapped time
          const targetDate = DateTime.fromISO(targetDayKey, { zone: tz })
          const hour = Math.floor(targetMinutes / 60)
          const minute = targetMinutes % 60
          newStart = targetDate.set({ hour, minute, second: 0, millisecond: 0 })
          // Una hora que el reloj se salta (cambio de horario) Luxon la corre en silencio: no se manda otra hora.
          if (newStart.hour !== hour || newStart.minute !== minute) return
          newEnd = newStart.plus({ minutes: durationMin })
        } else {
          // Fallback: same-day vertical drag
          const deltaY = e.clientY - drag.startY
          const deltaMinutes = Math.round(((deltaY / 64) * 60) / 15) * 15
          if (Math.abs(deltaMinutes) < 15) return
          newStart = origStart.plus({ minutes: deltaMinutes })
          newEnd = origEnd.plus({ minutes: deltaMinutes })
          if (!newStart.hasSame(origStart, 'day')) return
        }

        // Check nothing actually changed
        if (newStart.equals(origStart) && newEnd.equals(origEnd)) return
      } else if (drag.mode === 'resize-bottom') {
        const deltaY = e.clientY - drag.startY
        const deltaMinutes = Math.round(((deltaY / 64) * 60) / 15) * 15
        if (Math.abs(deltaMinutes) < 15) return
        newEnd = origEnd.plus({ minutes: deltaMinutes })
        if (newEnd.diff(origStart, 'minutes').minutes < 15) return
        // Estirar no la pasa al día siguiente (sí puede terminar a las 00:00 en punto); la que ya cruzaba la medianoche
        // se puede seguir ajustando.
        const terminaElMismoDia = (fin: DateTime) => fin.minus({ milliseconds: 1 }).hasSame(origStart, 'day')
        if (terminaElMismoDia(origEnd) && !terminaElMismoDia(newEnd)) return
      } else if (drag.mode === 'resize-top') {
        const deltaY = e.clientY - drag.startY
        const deltaMinutes = Math.round(((deltaY / 64) * 60) / 15) * 15
        if (Math.abs(deltaMinutes) < 15) return
        newStart = origStart.plus({ minutes: deltaMinutes })
        if (origEnd.diff(newStart, 'minutes').minutes < 15) return
        // Estirar hacia arriba una clase de las 00:00 no la pasa al día anterior.
        if (!newStart.hasSame(origStart, 'day')) return
      }

      // Don't allow before first hour
      if (newStart.hour < firstHour) return

      if (drag.kind === 'cita') {
        const cita = session as Reservation
        setMoverCita({ cita, startsAt: newStart.toUTC().toISO()!, endsAt: newEnd.toUTC().toISO()!, canal: avisoPorOmision(cita) })
        return
      }
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
  }, [classSessions, reservations, venueTimezone, firstHour, dragUpdateMutation])

  const iniciarArrastre = useCallback(
    (
      e: React.MouseEvent,
      item: { id: string; startsAt: string; endsAt: string },
      kind: 'clase' | 'cita',
      top: number,
      height: number,
      mode: 'move' | 'resize-top' | 'resize-bottom',
    ) => {
      e.stopPropagation()
      e.preventDefault()
      const el = (mode === 'move' ? e.currentTarget : e.currentTarget.parentElement) as HTMLDivElement
      const start = DateTime.fromISO(item.startsAt, { zone: 'utc' }).setZone(venueTimezone)
      const end = DateTime.fromISO(item.endsAt, { zone: 'utc' }).setZone(venueTimezone)
      didDragRef.current = false
      dragRef.current = {
        kind,
        sessionId: item.id,
        startX: e.clientX,
        startY: e.clientY,
        originalTop: top,
        durationHours: end.diff(start, 'hours').hours,
        dayKey: start.toFormat('yyyy-MM-dd'),
        el,
        didDrag: false,
        mode,
        originalHeight: height,
        grabOffset: e.clientY - el.getBoundingClientRect().top,
        colEl: el.closest<HTMLElement>('[data-day-key]'),
      }
    },
    [venueTimezone],
  )

  const handleSessionDragStart = useCallback(
    (
      e: React.MouseEvent,
      session: (typeof classSessions)[0],
      top: number,
      height: number,
      mode: 'move' | 'resize-top' | 'resize-bottom',
    ) => {
      if (session.status === 'CANCELLED' || session.status === 'COMPLETED') return
      iniciarArrastre(e, session, 'clase', top, height, mode)
    },
    [iniciarArrastre],
  )

  // D107: mover una cita arrastrándola. Al soltar se pide confirmar y cómo avisarle al cliente (como «Reagendar»).
  const [moverCita, setMoverCita] = useState<{
    cita: Reservation
    startsAt: string
    endsAt: string
    canal: RescheduleNotificationChannel
  } | null>(null)
  const moviendoCita = useRef(false)
  const moverCitaMutation = useMutation({
    mutationFn: (m: NonNullable<typeof moverCita>) =>
      reservationService.reschedule(venueId, m.cita.id, { startsAt: m.startsAt, endsAt: m.endsAt, notificationChannel: m.canal }),
    onSuccess: () => {
      toast({ title: t('toasts.rescheduleSuccess') })
      setMoverCita(null)
      queryClient.invalidateQueries({ queryKey: ['reservation-calendar', venueId] })
      queryClient.invalidateQueries({ queryKey: ['reservations', venueId] })
    },
    onError: (error: any) => {
      // Si la respuesta se perdió, el SERVIDOR pudo haberla movido: se vuelve a leer el calendario para enseñar dónde quedó
      // de verdad, y se cierra la ventana para no repetirlo a ciegas.
      setMoverCita(null)
      queryClient.invalidateQueries({ queryKey: ['reservation-calendar', venueId] })
      const status = error?.response?.status
      const message = error?.response?.data?.message ?? ''
      const code = error?.response?.data?.code ?? error?.response?.data?.errorCode ?? error?.response?.data?.error?.code
      if (code === 'external_calendar_busy' || (status === 409 && /calendario\s+externo/i.test(message))) {
        toast({ title: tGcal('reservationBusyError'), variant: 'destructive' })
        return
      }
      toast({ title: tCommon('error'), description: message || t('toasts.error'), variant: 'destructive' })
    },
  })
  // Sólo se ofrece el aviso que de verdad le llega: WhatsApp con teléfono, correo con email.
  const canalPosible = (cita: Reservation, canal: RescheduleNotificationChannel) =>
    canal === 'none' ||
    (canal === 'whatsapp' && !!(cita.customer?.phone || cita.guestPhone)) ||
    (canal === 'email' && !!(cita.customer?.email || cita.guestEmail))
  const confirmarMoverCita = () => {
    if (!moverCita || moviendoCita.current) return
    moviendoCita.current = true // un doble clic mandaba dos avisos al cliente en «Reagendar» (16-nov)
    moverCitaMutation.mutate(moverCita, { onSettled: () => (moviendoCita.current = false) })
  }

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
  // D113: «5 días» se ancla al lunes, así que avanza de semana en semana; sumar 5 desde un lunes caía en sábado y volvía al mismo lunes.
  const navStep = view === 'day' ? 1 : view === 'month' ? 30 : 7
  const goPrev = () =>
    setCurrentDate(prev => (view === 'month' ? new Date(prev.getFullYear(), prev.getMonth() - 1, 1) : addDays(prev, -navStep)))
  const goNext = () =>
    setCurrentDate(prev => (view === 'month' ? new Date(prev.getFullYear(), prev.getMonth() + 1, 1) : addDays(prev, navStep)))

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
      if (!mostrarReserva(r)) continue
      const dayKey = formatVenueDateISO(r.startsAt)
      if (!map[dayKey]) map[dayKey] = []
      map[dayKey].push(r)
    }
    return map
  }, [reservations, formatVenueDateISO, mostrarReserva])

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

  // Group external busy blocks by day — same shape as reservations/classes
  // so the day-column renderer can map them with identical pixel positioning.
  const busyBlocksByDay = useMemo(() => {
    if (!gcalOverlayVisible) return {} as Record<string, ExternalBusyBlock[]>
    const map: Record<string, ExternalBusyBlock[]> = {}
    for (const b of busyBlocks) {
      const dayKey = formatVenueDateISO(b.startsAt)
      if (!map[dayKey]) map[dayKey] = []
      map[dayKey].push(b)
    }
    return map
  }, [busyBlocks, gcalOverlayVisible, formatVenueDateISO])

  // Compute grouped columns for day view when groupBy is active. D103: las clases del día también entran a su columna.
  // Estos dos dependen sólo de los datos y no de `formatVenueDateISO` (una función nueva en cada render): pasar el ratón
  // por la cuadrícula vuelve a dibujar el calendario y no debe recalcularlos.
  const diaDelNegocio = useCallback(
    (iso: string) => DateTime.fromISO(iso, { zone: 'utc' }).setZone(venueTimezone).toISODate() ?? '',
    [venueTimezone],
  )
  const groupedColumns = useMemo(() => {
    if (!activeGroupBy || !calendarData?.grouped) return null
    const hoy = fechaDelDia(currentDate)
    return columnasAgrupadas(
      calendarData.grouped,
      classSessions.filter(s => diaDelNegocio(s.startsAt) === hoy),
      activeGroupBy,
      mostrarReserva,
      { sinAsignar: t('calendar.groupBy.unassigned'), mesa: numero => tableName(t, numero) },
    )
  }, [activeGroupBy, calendarData?.grouped, classSessions, currentDate, diaDelNegocio, mostrarReserva, t])

  // D102: lo que se encima en horario va lado a lado.
  const carrilesPorDia = useMemo(() => {
    const porDia = new Map<string, { clases: typeof classSessions; rsvps: Reservation[] }>()
    const de = (dia: string) => porDia.get(dia) ?? porDia.set(dia, { clases: [], rsvps: [] }).get(dia)!
    for (const s of classSessions) de(diaDelNegocio(s.startsAt)).clases.push(s)
    for (const r of reservations) if (mostrarReserva(r)) de(diaDelNegocio(r.startsAt)).rsvps.push(r)
    return new Map([...porDia].map(([dia, { clases, rsvps }]) => [dia, carrilesDe(clases, rsvps, venueTimezone)]))
  }, [classSessions, reservations, mostrarReserva, diaDelNegocio, venueTimezone])
  const carrilesPorColumna = useMemo(
    () => new Map((groupedColumns ?? []).map(c => [c.key, carrilesDe(c.classSessions, c.reservations, venueTimezone)])),
    [groupedColumns, venueTimezone],
  )

  // Render a single class session block (purple/violet tones to distinguish from reservations)
  const renderClassSessionBlock = (session: (typeof classSessions)[0], carril?: Carril) => {
    const start = DateTime.fromISO(session.startsAt, { zone: 'utc' }).setZone(venueTimezone)
    const end = DateTime.fromISO(session.endsAt, { zone: 'utc' }).setZone(venueTimezone)
    const startHour = start.hour + start.minute / 60
    const endHour = end.hasSame(start, 'day') ? end.hour + end.minute / 60 : 24 // lo que pasa de medianoche llega al fondo
    const top = (startHour - firstHour) * 64 + GRID_TOP_PAD
    const height = Math.max((endHour - startHour) * 64, 24)
    const isFull = session.enrolled >= session.capacity
    const spotsLeft = session.capacity - session.enrolled
    const canDrag = session.status !== 'CANCELLED' && session.status !== 'COMPLETED'

    return (
      <div
        key={`cs-${session.id}`}
        data-reservation="true"
        className={`absolute rounded-md border ${paddingDelCarril(carril)} py-1 text-xs overflow-hidden bg-violet-500/20 border-violet-500/40 text-violet-700 dark:text-violet-300 select-none group ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${session.status === 'CANCELLED' ? 'opacity-60 line-through' : ''}`}
        style={{ top: `${top}px`, height: `${height}px`, ...posicionDelCarril(carril) }}
        onMouseDown={e => {
          if (e.button !== 0 || !canDrag) return
          handleSessionDragStart(e, session, top, height, 'move')
        }}
        onClick={e => {
          e.stopPropagation()
          if (didDragRef.current) return
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
          // Una sola línea que no se parte (R2b-34): inscritos y pases nunca se encogen; el aviso de lugares se recorta.
          <div className="flex items-center gap-1 whitespace-nowrap overflow-hidden opacity-70">
            <Users className="h-3 w-3 shrink-0" />
            <span className="shrink-0">
              {session.enrolled}/{session.capacity}
            </span>
            <ClassSessionPassesLine passes={session.passes} />
            {isFull && (
              <Badge variant="outline" className="text-[10px] h-4 px-1 ml-1 min-w-0 border-violet-500/40">
                <span className="truncate">{t('classSession.full')}</span>
              </Badge>
            )}
            {!isFull && spotsLeft <= 3 && (
              <span className="min-w-0 truncate text-[10px] opacity-80">{t('classSession.spotsLeft', { count: spotsLeft })}</span>
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
  const renderReservationBlock = (reservation: Reservation, carril?: Carril) => {
    const start = DateTime.fromISO(reservation.startsAt, { zone: 'utc' }).setZone(venueTimezone)
    const end = DateTime.fromISO(reservation.endsAt, { zone: 'utc' }).setZone(venueTimezone)
    const startHour = start.hour + start.minute / 60
    const endHour = end.hasSame(start, 'day') ? end.hour + end.minute / 60 : 24 // lo que pasa de medianoche llega al fondo
    const top = (startHour - firstHour) * 64 + GRID_TOP_PAD
    const height = Math.max((endHour - startHour) * 64, 24)
    // D107: sólo lo que todavía no pasa se mueve arrastrando; lo demás se abre con un clic.
    const seMueve = puedeMoverCitas && (reservation.status === 'PENDING' || reservation.status === 'CONFIRMED')

    const guestName = nombreCompleto(reservation.customer) || reservation.guestName || t('unnamedGuest')

    // Service(s) + modifiers are the booking's content. Salons need to see them
    // at a glance on the calendar block (matching how Vagaro / Booksy surface
    // them) instead of having to open the detail page for every reservation.
    // Multi-service appointments list EVERY service, not just the lead one;
    // falls back to the single `product` for legacy rows.
    const services =
      reservation.services && reservation.services.length > 0
        ? reservation.services
        : reservation.product
          ? [{ id: reservation.product.id, name: reservation.product.name, price: reservation.product.price, duration: null }]
          : []
    // One service per line beats a single truncated "A + B + C + D" run, which
    // hid everything past the first service and made it impossible to tell what
    // was actually booked. Fit as many lines as the block's height allows and
    // roll the rest into a "+N más" counter; the tooltip always lists them all.
    const SERVICE_LINE_PX = 13
    const CHROME_PX = 34 // guest name + the start–end time row
    const visibleServiceCount = Math.max(0, Math.min(services.length, Math.floor((height - CHROME_PX) / SERVICE_LINE_PX)))
    const hiddenServiceCount = services.length - visibleServiceCount
    const modifiers = reservation.modifiers ?? []
    const modifiersTotal = modifiers.reduce((sum, m) => sum + (m.price ?? 0) * (m.quantity ?? 1), 0)

    return (
      // key goes on the OUTERMOST element returned in the reservations .map()
      // (renderReservationBlock), otherwise React can't dedupe siblings and warns.
      <TooltipProvider key={reservation.id} delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              data-reservation="true"
              className={`absolute rounded-md border ${paddingDelCarril(carril)} py-1 text-xs transition-opacity hover:opacity-80 overflow-hidden select-none ${seMueve ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${statusColorMap[reservation.status]}`}
              style={{ top: `${top}px`, height: `${height}px`, ...posicionDelCarril(carril) }}
              onMouseDown={e => {
                if (e.button !== 0 || !seMueve) return
                iniciarArrastre(e, reservation, 'cita', top, height, 'move')
              }}
              onClick={() => {
                if (didDragRef.current) return
                navigate(`${fullBasePath}/reservations/${reservation.id}`)
              }}
              // Con teclado: Tab llega a la cita y Enter la abre (moverla con teclado es «Reagendar» en su detalle).
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  navigate(`${fullBasePath}/reservations/${reservation.id}`)
                }
              }}
            >
              <div className="font-medium truncate">{guestName}</div>
              {services.length > 0 && visibleServiceCount > 0 && (
                <div className="text-[11px] opacity-90">
                  {services.slice(0, visibleServiceCount).map((s, i) => (
                    <div key={s.id ?? i} className="truncate leading-tight">
                      {s.name}
                    </div>
                  ))}
                  {(hiddenServiceCount > 0 || modifiers.length > 0) && (
                    <div className="truncate leading-tight opacity-75">
                      {hiddenServiceCount > 0 && t('calendar.moreServices', { count: hiddenServiceCount, defaultValue: `+${hiddenServiceCount} más` })}
                      {hiddenServiceCount > 0 && modifiers.length > 0 && ' · '}
                      {modifiers.length > 0 && `+${modifiers.length}`}
                    </div>
                  )}
                </div>
              )}
              <div className="opacity-70 truncate">
                {formatTime(reservation.startsAt)} – {formatTime(reservation.endsAt)}
              </div>
              {height > 56 && (
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
          </TooltipTrigger>
          <TooltipContent side="right" align="start" className="max-w-xs text-xs leading-relaxed">
            <div className="space-y-1">
              <div className="font-semibold">{guestName}</div>
              {services.map((s, i) => (
                <div key={s.id ?? i}>{s.name}</div>
              ))}
              {modifiers.length > 0 && (
                <div className="pt-1 border-t border-border/40">
                  {modifiers.map(m => (
                    <div key={m.id} className="flex justify-between gap-3">
                      <span>
                        {m.name}
                        {m.quantity > 1 ? ` ×${m.quantity}` : ''}
                      </span>
                      {m.price > 0 && (
                        <span className="tabular-nums opacity-80">
                          +
                          {(m.price * m.quantity).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })}
                        </span>
                      )}
                    </div>
                  ))}
                  {modifiersTotal > 0 && (
                    <div className="flex justify-between gap-3 pt-1 font-medium border-t border-border/40 mt-1">
                      <span>Extras</span>
                      <span className="tabular-nums">
                        +{modifiersTotal.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div className="text-muted-foreground pt-1">
                {formatTime(reservation.startsAt)} – {formatTime(reservation.endsAt)} · {reservation.partySize}p
                {reservation.table && ` · ${tableName(t, reservation.table.number)}`}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Render a single Google Calendar busy block — pixel positioning mirrors
  // renderReservationBlock so an overlap visually stacks cleanly (the busy
  // block sits at a lower z-index, behind real reservations).
  const renderBusyBlock = (block: ExternalBusyBlock) => {
    const start = DateTime.fromISO(block.startsAt, { zone: 'utc' }).setZone(venueTimezone)
    const end = DateTime.fromISO(block.endsAt, { zone: 'utc' }).setZone(venueTimezone)
    const startHour = start.hour + start.minute / 60
    // Sin cambio a propósito: un bloqueo de Google que cruza la medianoche y se alargara taparía las citas de debajo
    // (queda encima y abre Google Calendar). Ese bloqueo largo es otra tarea.
    const endHour = end.hour + end.minute / 60
    const top = (startHour - firstHour) * 64 + GRID_TOP_PAD
    const height = Math.max((endHour - startHour) * 64, 24)
    return <GoogleCalendarBusyBlock key={`gcal-${block.id}`} block={block} top={top} height={height} />
  }

  // Check if a date is today
  const isToday = (day: Date) => fechaDelDia(day) === formatVenueDateISO(new Date()) // hoy del negocio

  // Current time position for "now" indicator
  const lastHour = HOURS[HOURS.length - 1]
  const nowPosition = useMemo(() => {
    const now = DateTime.now().setZone(venueTimezone)
    const hour = now.hour + now.minute / 60
    if (hour < firstHour || hour > lastHour + 1) return null
    return (hour - firstHour) * 64 + GRID_TOP_PAD
  }, [firstHour, lastHour, venueTimezone])

  const handleGridMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, day: Date) => {
      // Treat reservations, class sessions, AND Google Calendar overlay blocks
      // as "filled" so hovering over a busy block doesn't render the
      // create-here ghost preview.
      const tgt = e.target as HTMLElement
      if (tgt.closest('[data-reservation]') || tgt.closest('[data-gcal-overlay]')) {
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
      const dayKey = fechaDelDia(day)
      setHoverSlot(prev => (prev?.time === time && prev?.dayKey === dayKey ? prev : { top, time, dayKey }))
    },
    [firstHour, lastHour],
  )

  const handleGridMouseLeave = useCallback(() => setHoverSlot(null), [])

  // Handle click on empty grid area — show event type picker
  const handleGridClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, day: Date) => {
      // Don't trigger if user clicked on an existing reservation block OR an
      // external Google Calendar busy block (those are read-only overlays).
      // D107: soltar algo que se arrastró dispara un «clic» en la cuadrícula; no es para crear nada.
      if (didDragRef.current) return
      const tgt = e.target as HTMLElement
      if (tgt.closest('[data-reservation]') || tgt.closest('[data-gcal-overlay]')) return

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
      const date = fechaDelDia(day)

      // Show the event type picker at click position
      setGridClickMenu({ open: true, x: e.clientX, y: e.clientY, date, startTime })
    },
    [firstHour, lastHour],
  )

  const handleGridMenuSelect = useCallback(
    (type: 'reservation' | 'class') => {
      const { date, startTime } = gridClickMenu
      setGridClickMenu(prev => ({ ...prev, open: false }))
      if (type === 'reservation') {
        setCreateModal({ open: true, date, startTime })
      } else {
        setClassModal({ open: true, date, startTime })
      }
    },
    [gridClickMenu],
  )

  // Render the day column
  const renderDayColumn = (day: Date, isWide: boolean) => {
    const dayKey = fechaDelDia(day)
    const dayReservations = reservationsByDay[dayKey] || []
    const dayClassSessions = classSessionsByDay[dayKey] || []
    const dayBusyBlocks = busyBlocksByDay[dayKey] || []
    const dayIsToday = isToday(day)
    const carriles = carrilesPorDia.get(dayKey)

    return (
      <div key={dayKey} className={`relative border-l border-border/30 ${isWide ? 'flex-1' : 'flex-1 min-w-[120px]'}`}>
        {/* Day header (multi-day views) */}
        {view !== 'day' && view !== 'month' && (
          <div
            className={`sticky top-0 z-10 border-b border-border px-2 py-1 text-center ${dayIsToday ? 'bg-primary/5' : 'bg-background'}`}
          >
            <div className="text-xs text-muted-foreground">{day.toLocaleDateString(locale, { weekday: 'short' })}</div>
            <div
              className={`text-sm font-medium ${dayIsToday ? 'bg-primary text-primary-foreground rounded-full w-7 h-7 -my-1 flex items-center justify-center mx-auto' : ''}`}
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

          {/* External busy blocks (Google Calendar) — rendered first so they
              sit behind reservations and class sessions in the z-stack. */}
          {dayBusyBlocks.map(renderBusyBlock)}

          {/* Class session blocks */}
          {dayClassSessions.map(s => renderClassSessionBlock(s, carriles?.get(`cs-${s.id}`)))}

          {/* Reservation blocks */}
          {dayReservations.map(r => renderReservationBlock(r, carriles?.get(r.id)))}
        </div>
      </div>
    )
  }

  // Render a grouped column (staff/table) for day view
  const renderGroupedColumn = (col: ColumnaAgrupada, day: Date) => {
    const dayKey = fechaDelDia(day)
    const dayBusyBlocks = busyBlocksByDay[dayKey] || []
    const dayIsToday = isToday(day)
    const carriles = carrilesPorColumna.get(col.key)
    const total = col.reservations.length + col.classSessions.length

    return (
      <div key={col.key} className="relative border-l border-border/30 flex-1 min-w-[160px]">
        {/* Column header — staff name or table number */}
        <div
          className={`sticky top-0 z-10 border-b border-border px-2 py-1 text-center ${dayIsToday ? 'bg-primary/5' : 'bg-background'}`}
        >
          <div className="text-sm font-medium truncate">{col.headerLabel}</div>
          <div className="text-xs text-muted-foreground">{total}</div>
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

          {/* External busy blocks — repeated across grouped columns so the
              operator sees the conflict no matter which staff/table column
              they're scanning. */}
          {dayBusyBlocks.map(renderBusyBlock)}

          {/* Class sessions and reservation blocks for this group */}
          {col.classSessions.map(s => renderClassSessionBlock(s, carriles?.get(`cs-${s.id}`)))}
          {col.reservations.map(r => renderReservationBlock(r, carriles?.get(r.id)))}
        </div>
      </div>
    )
  }

  const closeCreateModal = () => setCreateModal({ open: false, date: '', startTime: '' })
  const closeClassModal = () => setClassModal({ open: false, date: '', startTime: '' })

  return (
    <FeatureGate feature="RESERVATIONS">
      <div className="p-4 bg-background text-foreground" data-tour="reservations-calendar">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Date navigation with popover picker */}
            <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={goPrev} aria-label={t('calendar.previous')}>
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
                      onClick={() => {
                        setCurrentDate(diaLocal(formatVenueDateISO(new Date())))
                      }}
                    >
                      {t('tabs.today', { defaultValue: 'Hoy' })}
                    </button>
                    {[1, 2, 3, 4, 5, 6].map(n => (
                      <button
                        key={n}
                        className="block text-left px-3 py-1.5 text-sm rounded-md hover:bg-accent cursor-pointer text-muted-foreground whitespace-nowrap"
                        onClick={() => {
                          setCurrentDate(addDays(diaLocal(formatVenueDateISO(new Date())), n * 7))
                        }}
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
                      onSelect={date => {
                        if (date) setCurrentDate(date)
                      }}
                      weekStartsOn={1}
                      locale={getDateFnsLocale(locale)}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={goNext} aria-label={t('calendar.next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>

            {/* View interval — dropdown like Square, next to date picker */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium">
                  {t('calendar.interval', { defaultValue: 'Intervalo' })}{' '}
                  <span className="font-bold">
                    {view === 'day'
                      ? t('calendar.views.day')
                      : view === '5day'
                        ? t('calendar.views.5day', { defaultValue: '5 días' })
                        : view === 'month'
                          ? t('calendar.views.month', { defaultValue: 'Mes' })
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
                    {v === 'day'
                      ? t('calendar.views.day')
                      : v === '5day'
                        ? t('calendar.views.5day', { defaultValue: '5 días' })
                        : v === 'month'
                          ? t('calendar.views.month', { defaultValue: 'Mes' })
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
                    {groupBy === 'none' ? t('calendar.groupBy.label') : `${t('calendar.groupBy.label')}: `}
                    {groupBy !== 'none' && (
                      <span className="font-bold">{groupBy === 'staff' ? t('calendar.groupBy.staff') : t('calendar.groupBy.table')}</span>
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
                      {mode === 'none'
                        ? t('calendar.groupBy.none')
                        : mode === 'staff'
                          ? t('calendar.groupBy.staff')
                          : t('calendar.groupBy.table')}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Google Calendar overlay toggle — Eye icon flips between "blocks
              are visible" and "blocks are hidden". Persists in localStorage
              and gates the network call too. */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs font-medium"
              onClick={() => setGcalOverlayVisible(v => !v)}
              title={tGcal('overlay.toggle')}
              aria-pressed={gcalOverlayVisible}
            >
              {gcalOverlayVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              <span className="hidden lg:inline">{tGcal('overlay.toggle')}</span>
            </Button>

            {/* Calendar attributes — gear icon like Square */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setAttributesOpen(true)}
              title={t('calendarAttributes.title', { defaultValue: 'Atributos de la cita' })}
              aria-label={t('calendarAttributes.title', { defaultValue: 'Atributos de la cita' })}
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
              aria-label={t('availability.title', { defaultValue: 'Editar disponibilidad' })}
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
                  onClick={() => setCreateModal({ open: true, date: fechaDelDia(currentDate), startTime: '' })}
                >
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  {t('calendar.createCita', { defaultValue: 'Cita' })}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 cursor-pointer"
                  onClick={() => setClassModal({ open: true, date: fechaDelDia(currentDate), startTime: '' })}
                >
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {t('calendar.createClase', { defaultValue: 'Clase' })}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Calendar Grid. Sin leer las reservas no hay cuadrícula vacía que enseñar; sin leer las clases, las reservas se quedan y se avisa. */}
        <AvisoDeCarga query={calendarQuery} hayDatos={calendarData !== undefined} />
        <AvisoDeCarga query={sessionsQuery} hayDatos={sessionsQuery.data !== undefined} />
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">{tCommon('loading')}</div>
        ) : calendarData === undefined && falloDeCarga(calendarQuery) ? null : view === 'month' ? (
          /* Month view — compact grid of day cells */
          <div className="rounded-xl border border-border overflow-auto max-h-[calc(100vh-220px)]">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-border">
              {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(d => (
                <div
                  key={d}
                  className="px-2 py-1.5 text-xs font-medium text-muted-foreground text-center border-r border-border/30 last:border-r-0"
                >
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
                const dayKey = fechaDelDia(day)
                const dayReservations = reservationsByDay[dayKey] || []
                const dayClassSessions = classSessionsByDay[dayKey] || []
                const dayIsToday = isToday(day)
                // D106: citas y clases juntas y en orden de hora; «+N» cuenta exactamente lo que no cupo.
                const eventosDelDia = [
                  ...dayReservations.map(r => ({ tipo: 'cita' as const, id: r.id, startsAt: r.startsAt, r })),
                  ...dayClassSessions.map(s => ({ tipo: 'clase' as const, id: s.id, startsAt: s.startsAt, s })),
                ].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
                const CABEN = 4
                const visibles = eventosDelDia.length > CABEN ? eventosDelDia.slice(0, CABEN - 1) : eventosDelDia
                const sinCaber = eventosDelDia.length - visibles.length

                return (
                  <div
                    key={dayKey}
                    className={`min-h-[100px] border-r border-b border-border/30 p-1.5 cursor-pointer hover:bg-accent/30 transition-colors ${dayIsToday ? 'bg-primary/5' : ''}`}
                    onClick={() => {
                      setCurrentDate(day)
                      setView('day')
                    }}
                  >
                    <div
                      className={`text-sm mb-1 ${dayIsToday ? 'bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center' : 'text-foreground'}`}
                    >
                      {day.getDate()}
                    </div>
                    {/* Compact event indicators */}
                    {visibles.map(e =>
                      e.tipo === 'cita' ? (
                        <div
                          key={e.id}
                          className={`text-[10px] leading-tight truncate rounded px-1 py-0.5 mb-0.5 ${statusColorMap[e.r.status]}`}
                        >
                          {e.r.customer ? e.r.customer.firstName : e.r.guestName || '—'} {formatTime(e.r.startsAt)}
                        </div>
                      ) : (
                        <div
                          key={`cs-${e.id}`}
                          className={`text-[10px] leading-tight truncate rounded px-1 py-0.5 mb-0.5 bg-violet-500/20 text-violet-700 dark:text-violet-300 ${e.s.status === 'CANCELLED' ? 'line-through opacity-60' : ''}`}
                        >
                          {e.s.product.name} {formatTime(e.s.startsAt)}
                        </div>
                      ),
                    )}
                    {sinCaber > 0 && <div className="text-[10px] text-muted-foreground">+{sinCaber}</div>}
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
              <div className="w-[4.75rem] shrink-0 border-r border-border">
                {(view !== 'day' || (groupedColumns && groupedColumns.length > 0)) && (
                  <div className="sticky top-0 bg-background z-10 border-b border-border h-[45px]" />
                )}
                <div className="relative" style={{ height: `${HOURS.length * 64 + GRID_TOP_PAD + 8}px` }}>
                  {HOURS.map(hour => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 whitespace-nowrap text-xs text-muted-foreground text-right pr-2"
                      style={{ top: `${(hour - firstHour) * 64 + GRID_TOP_PAD - 8}px` }}
                    >
                      {formatTime(DateTime.fromObject({ hour }, { zone: venueTimezone }).toJSDate())}
                    </div>
                  ))}
                </div>
              </div>

              {/* Day columns — use grouped columns when groupBy is active in day view */}
              {view === 'day' && groupedColumns && groupedColumns.length > 0
                ? groupedColumns.map(col => renderGroupedColumn(col, currentDate))
                : displayDays.map(day => renderDayColumn(day, displayDays.length === 1))}
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
            <div className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">{gridClickMenu.startTime}</div>
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
        <EditClassSessionDialog open={!!editSessionId} onOpenChange={open => !open && setEditSessionId(null)} sessionId={editSessionId} />

        {/* Edit availability dialog */}
        <EditAvailabilityDialog open={availabilityOpen} onOpenChange={setAvailabilityOpen} />

        {/* D107: confirmar mover una cita arrastrada */}
        <AlertDialog open={!!moverCita} onOpenChange={open => !open && !moverCitaMutation.isPending && setMoverCita(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('calendar.moveCita.title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {moverCita &&
                  t('calendar.moveCita.description', {
                    name: nombreCompleto(moverCita.cita.customer) || moverCita.cita.guestName || t('unnamedGuest'),
                    from: `${DateTime.fromISO(moverCita.cita.startsAt, { zone: 'utc' }).setZone(venueTimezone).setLocale(locale).toFormat('ccc d LLL')} ${formatTime(moverCita.cita.startsAt)}`,
                    to: `${DateTime.fromISO(moverCita.startsAt, { zone: 'utc' }).setZone(venueTimezone).setLocale(locale).toFormat('ccc d LLL')} ${formatTime(moverCita.startsAt)}`,
                  })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {moverCita && (
              <div className="space-y-2">
                <Label>{t('detail.reschedule.notificationLabel')}</Label>
                <RadioGroup
                  value={moverCita.canal}
                  onValueChange={v => setMoverCita(m => (m ? { ...m, canal: v as RescheduleNotificationChannel } : m))}
                  className="grid grid-cols-1 gap-2"
                >
                  {CANALES_DE_AVISO.filter(canal => canalPosible(moverCita.cita, canal)).map(canal => (
                    <label
                      key={canal}
                      htmlFor={`mover-cita-${canal}`}
                      className="flex items-center gap-3 rounded-lg border border-input p-3 cursor-pointer hover:bg-muted/40"
                    >
                      <RadioGroupItem value={canal} id={`mover-cita-${canal}`} />
                      <span className="text-sm">{t(`detail.reschedule.channels.${canal}`)}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={moverCitaMutation.isPending}>{tCommon('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                disabled={moverCitaMutation.isPending}
                onClick={e => {
                  e.preventDefault() // se cierra al terminar, no antes: si falla, la cita se queda donde estaba y se avisa
                  confirmarMoverCita()
                }}
              >
                {moverCitaMutation.isPending ? tCommon('loading') : t('calendar.moveCita.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Calendar attributes dialog */}
        <CalendarAttributesDialog open={attributesOpen} onOpenChange={setAttributesOpen} onSave={setCalendarAttrs} />
      </div>
    </FeatureGate>
  )
}
