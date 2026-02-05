/**
 * PromotersAuditPage - Auditoría de Promotores con filtros y mapa GPS
 *
 * Features:
 * - Filtros Stripe-style: Tienda, Fecha, Estado
 * - Tabla con check-in/out, ventas, ubicación GPS
 * - Botón "Ver en mapa" para cada promotor
 * - Gráficas de desempeño, mix de venta, asistencia
 * - Validación de depósitos al final
 *
 * Basado en mockup: /Users/amieva/Downloads/mockups-playtelecom/promotores.html
 */

import { useState, useMemo } from 'react'
import { FilterPill, CheckboxFilterContent, DateFilterContent, AmountFilterContent, type DateFilter, type AmountFilter } from '@/components/filters'
import DataTable from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useDebounce } from '@/hooks/useDebounce'
import { Search, X, Download, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ColumnDef } from '@tanstack/react-table'
import { PromoterLocationModal } from './components/PromoterLocationModal'
import { PromoterCharts } from './components/PromoterCharts'
import { DepositValidation } from './components/DepositValidation'
import { AllCheckInsDialog } from './components/AllCheckInsDialog'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useQuery } from '@tanstack/react-query'
import api from '@/api'
import accessService from '@/services/access.service'

// Types
interface TimeEntryData {
  clockInTime: string
  clockInLocation?: { lat: number; lng: number } | null
  checkInPhotoUrl?: string | null
  clockOutTime?: string | null
  clockOutLocation?: { lat: number; lng: number } | null
  checkOutPhotoUrl?: string | null
  status: string
}

interface PromoterRow {
  id: string
  name: string
  avatar?: string
  storeName: string
  storeId: string
  checkInTime?: string
  checkInLocation?: { lat: number; lng: number }
  checkInPhotoUrl?: string
  checkOutTime?: string
  checkOutLocation?: { lat: number; lng: number }
  checkOutPhotoUrl?: string
  sales: number // Venta del día/período
  break: boolean // En descanso
  breakMinutes: number // Tiempo de descanso en minutos
  status: 'ACTIVE' | 'INACTIVE' // Activo/Inactivo
  attendancePercent: number // % asistencia del mes
  allTimeEntries?: TimeEntryData[]
}

export default function PromotersAuditPage() {
  const { venue } = useCurrentVenue()

  // Filters
  const [storeFilter, setStoreFilter] = useState<string[]>([])
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null)
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [salesFilter, setSalesFilter] = useState<AmountFilter | null>(null)
  const [shiftFilter, setShiftFilter] = useState<string[]>([]) // En turno / Turno completo

  // Search
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // Selected promoter for details (full screen modal)
  const [selectedPromoter, setSelectedPromoter] = useState<PromoterRow | null>(null)
  const [promoterModalOpen, setPromoterModalOpen] = useState(false)

  // Location modal state (TODO: implement "Ver en mapa" button)
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [selectedPromoterForMap, _setSelectedPromoterForMap] = useState<PromoterRow | null>(null)

  // All check-ins dialog state
  const [checkInsDialogOpen, setCheckInsDialogOpen] = useState(false)
  const [selectedPromoterForDialog, setSelectedPromoterForDialog] = useState<PromoterRow | null>(null)

  // Calendar date dialog state (inside FullScreenModal, needs aboveModal)
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false)
  const [calendarTimeEntries, setCalendarTimeEntries] = useState<any[]>([])

  const dateFilterKey = useMemo(() => {
    if (!dateFilter) return 'all'
    const value = dateFilter.value ?? ''
    const value2 = dateFilter.value2 ?? ''
    const unit = dateFilter.unit ?? ''
    return `${dateFilter.operator}:${value}:${value2}:${unit}`
  }, [dateFilter])

  const toDateString = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getDateParams = () => {
    if (!dateFilter) return {}

    const operator = dateFilter.operator
    if (operator === 'on' && dateFilter.value) {
      return {
        date: dateFilter.value as string,
        startDate: dateFilter.value as string,
        endDate: dateFilter.value as string,
      }
    }

    if (operator === 'between' && dateFilter.value && dateFilter.value2) {
      return {
        startDate: dateFilter.value as string,
        endDate: dateFilter.value2 as string,
      }
    }

    if ((operator === 'before' || operator === 'after') && dateFilter.value) {
      return operator === 'before'
        ? { endDate: dateFilter.value as string }
        : { startDate: dateFilter.value as string }
    }

    if (operator === 'last' && dateFilter.value) {
      const value = typeof dateFilter.value === 'number' ? dateFilter.value : parseInt(dateFilter.value as string) || 0
      const now = new Date()
      const startDate = new Date(now)
      switch (dateFilter.unit) {
        case 'hours':
          startDate.setHours(startDate.getHours() - value)
          break
        case 'weeks':
          startDate.setDate(startDate.getDate() - value * 7)
          break
        case 'months':
          startDate.setMonth(startDate.getMonth() - value)
          break
        case 'days':
        default:
          startDate.setDate(startDate.getDate() - value)
          break
      }
      return {
        startDate: toDateString(startDate),
        endDate: toDateString(now),
      }
    }

    return {}
  }

  // Fetch staff attendance data
  const { data: attendanceData, isLoading } = useQuery({
    queryKey: ['staff-attendance', venue?.organizationId, dateFilterKey, storeFilter, statusFilter],
    queryFn: async () => {
      if (!venue?.organizationId) return { staff: [] }

      const params = new URLSearchParams()
      const dateParams = getDateParams()
      if (dateParams.date) params.append('date', dateParams.date)
      if (dateParams.startDate) params.append('startDate', dateParams.startDate)
      if (dateParams.endDate) params.append('endDate', dateParams.endDate)
      if (storeFilter.length > 0 && !storeFilter.includes('all')) {
        params.append('venueId', storeFilter[0]) // For now, support single venue filter
      }
      if (statusFilter.length > 0) {
        params.append('status', statusFilter[0]) // For now, support single status filter
      }

      const response = await api.get(`/api/v1/dashboard/organizations/${venue.organizationId}/staff/attendance?${params}`)
      return response.data.data
    },
    enabled: !!venue?.organizationId,
  })

  // Get all venues the user has access to for filter options
  const { data: venuesResponse } = useQuery({
    queryKey: ['user-venues'],
    queryFn: () => accessService.getVenues(),
    enabled: !!venue?.organizationId,
  })
  const venuesData = venuesResponse?.venues

  // Filter options
  const storeOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'Todas las Tiendas' }]
    return options.concat(
      (venuesData ?? []).map(venueItem => ({
        value: venueItem.id,
        label: venueItem.name,
      }))
    )
  }, [venuesData])

  const statusOptions = [
    { value: 'ACTIVE', label: 'Activos' },
    { value: 'INACTIVE', label: 'Inactivos' },
  ]

  const shiftOptions = [
    { value: 'pending_checkout', label: 'Pendiente de salida' }, // Check-in sin check-out en el mismo registro
  ]

  const formatTime = (value?: string | null) => {
    if (!value) return undefined
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return undefined
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }

  const getEntryDate = (entry: TimeEntryData) => {
    const dateValue = entry.clockInTime || entry.clockOutTime
    if (!dateValue) return null
    const date = new Date(dateValue)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const isEntryInDateFilter = (entry: TimeEntryData) => {
    if (!dateFilter) return true
    const entryDate = getEntryDate(entry)
    if (!entryDate) return false

    switch (dateFilter.operator) {
      case 'last': {
        const value = typeof dateFilter.value === 'number' ? dateFilter.value : parseInt(dateFilter.value as string) || 0
        const cutoffDate = new Date()
        switch (dateFilter.unit) {
          case 'hours':
            cutoffDate.setHours(cutoffDate.getHours() - value)
            break
          case 'weeks':
            cutoffDate.setDate(cutoffDate.getDate() - value * 7)
            break
          case 'months':
            cutoffDate.setMonth(cutoffDate.getMonth() - value)
            break
          case 'days':
          default:
            cutoffDate.setDate(cutoffDate.getDate() - value)
            break
        }
        return entryDate >= cutoffDate
      }
      case 'before': {
        const targetDate = new Date(dateFilter.value as string)
        return entryDate < targetDate
      }
      case 'after': {
        const targetDate = new Date(dateFilter.value as string)
        return entryDate > targetDate
      }
      case 'between': {
        const startDate = new Date(dateFilter.value as string)
        const endDate = new Date(dateFilter.value2 as string)
        endDate.setHours(23, 59, 59, 999)
        return entryDate >= startDate && entryDate <= endDate
      }
      case 'on': {
        const targetDate = new Date(dateFilter.value as string)
        return (
          entryDate.getFullYear() === targetDate.getFullYear() &&
          entryDate.getMonth() === targetDate.getMonth() &&
          entryDate.getDate() === targetDate.getDate()
        )
      }
      default:
        return true
    }
  }

  const sortEntriesByDate = (entries: TimeEntryData[]) => {
    return [...entries].sort((a, b) => {
      const aDate = getEntryDate(a)?.getTime() ?? 0
      const bDate = getEntryDate(b)?.getTime() ?? 0
      return bDate - aDate
    })
  }

  // Transform API data to PromoterRow format
  const promoters: PromoterRow[] = useMemo(() => {
    if (!attendanceData?.staff) return []

    return attendanceData.staff.map((staffMember: any) => {
      const allTimeEntries = staffMember.allTimeEntries || []

      // Get most recent check-in time from allTimeEntries (first entry)
      const mostRecentEntry = allTimeEntries.length > 0 ? allTimeEntries[0] : null

      const checkInTime = formatTime(mostRecentEntry?.clockInTime)

      // Find the most recent entry that has a checkout time
      // (current entry might be in progress with no checkout yet)
      const entryWithCheckout = allTimeEntries.find((entry: any) => entry.clockOutTime)
      const checkOutTime = formatTime(entryWithCheckout?.clockOutTime)

      return {
        id: staffMember.id,
        name: staffMember.name,
        avatar: staffMember.avatar || undefined,
        storeName: staffMember.venueName,
        storeId: staffMember.venueId,
        checkInTime,
        checkInLocation: mostRecentEntry?.clockInLocation || undefined,
        checkInPhotoUrl: mostRecentEntry?.checkInPhotoUrl || undefined,
        checkOutTime,
        checkOutLocation: entryWithCheckout?.clockOutLocation || undefined,
        checkOutPhotoUrl: entryWithCheckout?.checkOutPhotoUrl || undefined,
        sales: staffMember.sales,
        break: staffMember.break,
        breakMinutes: staffMember.breakMinutes || 0,
        status: staffMember.status,
        attendancePercent: staffMember.attendancePercent,
        allTimeEntries,
      }
    })
  }, [attendanceData])

  const dateFilteredPromoters = useMemo(() => {
    if (!dateFilter) return promoters

    return promoters.reduce<PromoterRow[]>((acc, promoter) => {
      const filteredEntries = (promoter.allTimeEntries || []).filter(isEntryInDateFilter)
      if (filteredEntries.length === 0) return acc

      const sortedEntries = sortEntriesByDate(filteredEntries)
      const mostRecentEntry = sortedEntries[0]
      const entryWithCheckout = sortedEntries.find(entry => entry.clockOutTime)

      acc.push({
        ...promoter,
        allTimeEntries: sortedEntries,
        checkInTime: formatTime(mostRecentEntry?.clockInTime),
        checkInLocation: mostRecentEntry?.clockInLocation || undefined,
        checkInPhotoUrl: mostRecentEntry?.checkInPhotoUrl || undefined,
        checkOutTime: formatTime(entryWithCheckout?.clockOutTime),
        checkOutLocation: entryWithCheckout?.clockOutLocation || undefined,
        checkOutPhotoUrl: entryWithCheckout?.checkOutPhotoUrl || undefined,
      })
      return acc
    }, [])
  }, [promoters, dateFilter])

  // Filtered data
  const filteredData = useMemo(() => {
    return dateFilteredPromoters.filter(promoter => {
      // Store filter
      if (storeFilter.length > 0 && !storeFilter.includes(promoter.storeId) && !storeFilter.includes('all')) {
        return false
      }

      // Status filter
      if (statusFilter.length > 0 && !statusFilter.includes(promoter.status)) {
        return false
      }

      // Sales filter (numeric)
      if (salesFilter && salesFilter.value !== null) {
        const sales = promoter.sales
        switch (salesFilter.operator) {
          case 'gt':
            if (sales <= salesFilter.value) return false
            break
          case 'lt':
            if (sales >= salesFilter.value) return false
            break
          case 'eq':
            if (sales !== salesFilter.value) return false
            break
          case 'between':
            if (salesFilter.value2 !== null && salesFilter.value2 !== undefined) {
              if (sales < salesFilter.value || sales > salesFilter.value2) return false
            }
            break
        }
      }

      // Shift filter - check if most recent TimeEntry has check-in but no check-out
      if (shiftFilter.length > 0 && shiftFilter.includes('pending_checkout')) {
        // Check the most recent TimeEntry (first in array) for missing checkout
        const mostRecentEntry = promoter.allTimeEntries?.[0]
        const hasPendingCheckout = mostRecentEntry && mostRecentEntry.clockInTime && !mostRecentEntry.clockOutTime
        if (!hasPendingCheckout) return false
      }

      // Search
      if (debouncedSearchTerm) {
        const searchLower = debouncedSearchTerm.toLowerCase()
        return promoter.name.toLowerCase().includes(searchLower)
      }

      return true
    })
  }, [dateFilteredPromoters, storeFilter, statusFilter, salesFilter, shiftFilter, debouncedSearchTerm])

  // Columns
  const columns = useMemo<ColumnDef<PromoterRow>[]>(
    () => [
      {
        id: 'status',
        header: 'Estado',
        cell: ({ row }) => {
          const isActive = row.original.status === 'ACTIVE'
          return (
            <Badge
              variant={isActive ? 'default' : 'secondary'}
              className={cn('text-xs font-bold', isActive && 'bg-green-100 text-green-700 border-green-200')}
            >
              {isActive ? (
                <>
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Activo
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3 mr-1" />
                  Inactivo
                </>
              )}
            </Badge>
          )
        },
      },
      {
        id: 'name',
        header: 'Promotor',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-8 w-8">
                <AvatarImage src={row.original.avatar} alt={row.original.name} />
                <AvatarFallback>{row.original.name.charAt(0)}</AvatarFallback>
              </Avatar>
              {row.original.status === 'ACTIVE' && (
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5">
                  <div className="bg-green-500 size-2 rounded-full border border-white"></div>
                </div>
              )}
            </div>
            <div>
              <p className="font-bold text-sm text-primary">{row.original.name}</p>
              <p className="text-xs text-muted-foreground">{row.original.storeName}</p>
            </div>
          </div>
        ),
      },
      {
        id: 'checkIn',
        header: 'Check-in',
        cell: ({ row }) => {
          const hasMultipleCheckIns = row.original.allTimeEntries && row.original.allTimeEntries.length > 1
          const hasCheckIn = !!row.original.checkInTime

          return (
            <Button
              variant="ghost"
              size="sm"
              disabled={!hasCheckIn}
              onClick={e => {
                e.stopPropagation() // Prevent row click from opening full-screen modal
                if (hasCheckIn) {
                  setSelectedPromoterForDialog(row.original)
                  setCheckInsDialogOpen(true)
                }
              }}
              className="h-7 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {row.original.checkInTime ? (
                  <>
                    <Clock className="w-3.5 h-3.5 text-green-500" />
                    <span className="font-mono text-xs">{row.original.checkInTime}</span>
                    {hasMultipleCheckIns && (
                      <Badge variant="secondary" className="text-xs h-5 px-1.5 min-w-[20px] flex items-center justify-center">
                        {row.original.allTimeEntries!.length}
                      </Badge>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">--:--</span>
                )}
              </div>
            </Button>
          )
        },
      },
      {
        id: 'checkOut',
        header: 'Check-out',
        cell: ({ row }) => {
          const hasCheckIn = !!row.original.checkInTime
          // Count entries that have a checkout time
          const checkoutCount = row.original.allTimeEntries?.filter((entry: any) => entry.clockOutTime).length || 0
          const hasMultipleCheckouts = checkoutCount > 1

          return (
            <Button
              variant="ghost"
              size="sm"
              disabled={!hasCheckIn}
              onClick={e => {
                e.stopPropagation() // Prevent row click from opening full-screen modal
                if (hasCheckIn) {
                  setSelectedPromoterForDialog(row.original)
                  setCheckInsDialogOpen(true)
                }
              }}
              className="h-7 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {row.original.checkOutTime ? (
                  <>
                    <Clock className="w-3.5 h-3.5 text-red-500" />
                    <span className="font-mono text-xs">{row.original.checkOutTime}</span>
                    {hasMultipleCheckouts && (
                      <Badge variant="secondary" className="text-xs h-5 px-1.5 min-w-[20px] flex items-center justify-center">
                        {checkoutCount}
                      </Badge>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">--:--</span>
                )}
              </div>
            </Button>
          )
        },
      },
      {
        id: 'sales',
        header: 'Venta',
        cell: ({ row }) => <span className="font-black text-sm">${row.original.sales.toLocaleString('es-MX')}</span>,
      },
      {
        id: 'break',
        header: 'Descanso',
        cell: ({ row }) => {
          const minutes = row.original.breakMinutes
          const hours = Math.floor(minutes / 60)
          const mins = minutes % 60
          const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`

          return (
            <span className={cn('font-mono text-sm', minutes > 0 ? 'text-foreground' : 'text-muted-foreground')}>
              {minutes > 0 ? timeStr : '—'}
            </span>
          )
        },
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col h-full p-6 space-y-6 overflow-y-auto">
      {/* Header with Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Auditoría de Promotores</h1>
            <p className="text-sm text-muted-foreground">Monitoreo de asistencia, ventas y ubicación GPS</p>
          </div>

          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Exportar Reporte
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search - FIRST */}
          <div className="relative flex items-center">
            {isSearchOpen ? (
              <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    placeholder="Buscar promotor..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Escape') {
                        if (!searchTerm) setIsSearchOpen(false)
                      }
                    }}
                    className="h-8 w-[200px] pl-8 pr-8 text-sm rounded-full border border-input bg-background focus:ring-2 focus:ring-ring"
                    autoFocus
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => {
                    setSearchTerm('')
                    setIsSearchOpen(false)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant={searchTerm ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setIsSearchOpen(true)}
              >
                <Search className="h-4 w-4" />
              </Button>
            )}
            {searchTerm && !isSearchOpen && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />}
          </div>

          {/* Fecha de Auditoría */}
          <FilterPill
            label="Fecha de Auditoría"
            isActive={!!dateFilter}
            onClear={() => setDateFilter(null)}
          >
            <DateFilterContent
              title="Fecha de Auditoría"
              value={dateFilter}
              onApply={setDateFilter}
            />
          </FilterPill>

          {/* Tienda Filter */}
          <FilterPill label="Tienda" isActive={storeFilter.length > 0} onClear={() => setStoreFilter([])}>
            <CheckboxFilterContent
              title="Seleccionar Tiendas"
              options={storeOptions}
              selectedValues={storeFilter}
              onApply={setStoreFilter}
            />
          </FilterPill>

          {/* Estado Filter */}
          <FilterPill label="Estado" isActive={statusFilter.length > 0} onClear={() => setStatusFilter([])}>
            <CheckboxFilterContent
              title="Seleccionar Estado"
              options={statusOptions}
              selectedValues={statusFilter}
              onApply={setStatusFilter}
            />
          </FilterPill>

          {/* Venta Filter */}
          <FilterPill label="Venta" isActive={!!salesFilter} onClear={() => setSalesFilter(null)}>
            <AmountFilterContent
              title="Filtrar por Venta"
              value={salesFilter}
              onApply={setSalesFilter}
            />
          </FilterPill>

          {/* Turno Filter */}
          <FilterPill label="Turno" isActive={shiftFilter.length > 0} onClear={() => setShiftFilter([])}>
            <CheckboxFilterContent
              title="Estado del Turno"
              options={shiftOptions}
              selectedValues={shiftFilter}
              onApply={setShiftFilter}
            />
          </FilterPill>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-card rounded-xl border p-12 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground">Cargando datos de asistencia...</p>
          </div>
        </div>
      )}

      {/* Table */}
      {!isLoading && (
        <div className="bg-card rounded-xl border">
          <div className="px-6 py-3 border-b bg-muted/30 flex justify-between items-center">
            <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">
              Resultados ({filteredData.length} {filteredData.length === 1 ? 'persona' : 'personas'})
            </h3>
          </div>
          <DataTable
            columns={columns}
            data={filteredData}
            rowCount={filteredData.length}
            showColumnCustomizer={false}
            onRowClick={row => {
              setSelectedPromoter(row)
              setPromoterModalOpen(true)
            }}
          />
        </div>
      )}

      {/* Full Screen Modal for Promoter Details */}
      {selectedPromoter && (
        <FullScreenModal
          open={promoterModalOpen}
          onClose={() => {
            setPromoterModalOpen(false)
            setSelectedPromoter(null)
            setCalendarDialogOpen(false)
          }}
          title={selectedPromoter.name}
        >
          <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Promoter Info Header */}
            <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
              <Avatar className="h-16 w-16">
                <AvatarImage src={selectedPromoter.avatar} alt={selectedPromoter.name} />
                <AvatarFallback className="text-xl">{selectedPromoter.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-xl font-bold">{selectedPromoter.name}</h2>
                <p className="text-muted-foreground">{selectedPromoter.storeName}</p>
              </div>
              <div className="text-right">
                <Badge
                  variant={selectedPromoter.status === 'ACTIVE' ? 'default' : 'secondary'}
                  className={cn(
                    'text-sm font-bold',
                    selectedPromoter.status === 'ACTIVE' && 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                  )}
                >
                  {selectedPromoter.status === 'ACTIVE' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Activo
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 mr-1" />
                      Inactivo
                    </>
                  )}
                </Badge>
                <p className="text-2xl font-bold mt-2">${selectedPromoter.sales.toLocaleString('es-MX')}</p>
                <p className="text-xs text-muted-foreground">Ventas del día</p>
              </div>
            </div>

            {/* Gráficas de desempeño */}
            <PromoterCharts
              promoterId={selectedPromoter.id}
              promoterName={selectedPromoter.name}
              venueId={selectedPromoter.storeId}
              onDateClick={(_date, timeEntries) => {
                setCalendarTimeEntries(timeEntries)
                setCalendarDialogOpen(true)
              }}
            />

            {/* Validación de Depósito */}
            <DepositValidation
              promoterId={selectedPromoter.id}
              promoterName={selectedPromoter.name}
              expectedAmount={selectedPromoter.sales}
              declaredAmount={selectedPromoter.sales - 500}
              voucherPhotoUrl="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400"
              status="PENDING"
            />

            {/* Calendar Date Dialog - rendered inside FullScreenModal with aboveModal flag */}
            <AllCheckInsDialog
              open={calendarDialogOpen}
              onOpenChange={setCalendarDialogOpen}
              promoter={selectedPromoter}
              timeEntries={calendarTimeEntries}
              aboveModal
            />
          </div>
        </FullScreenModal>
      )}

      {/* GPS Location Modal */}
      {selectedPromoterForMap && (
        <PromoterLocationModal open={locationModalOpen} onOpenChange={setLocationModalOpen} promoter={selectedPromoterForMap} />
      )}

      {/* All Check-Ins Dialog */}
      {selectedPromoterForDialog && (
        <AllCheckInsDialog
          open={checkInsDialogOpen}
          onOpenChange={setCheckInsDialogOpen}
          promoter={selectedPromoterForDialog}
          timeEntries={selectedPromoterForDialog.allTimeEntries || []}
        />
      )}
    </div>
  )
}
