/**
 * SalesReport - Sales Report Dashboard for PlayTelecom
 *
 * Layout (based on ventas.html mockup):
 * - Header with store filter, date range picker, search & export
 * - Summary metrics row (3 cards: Revenue, Volume, Avg Ticket)
 * - Charts row: Revenue Trend (area), Volume by Day (bar)
 * - Detailed transactions table with proof of sale images
 *
 * Key feature: proofOfSale field - URL to photo evidence of each sale
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { DateTime } from 'luxon'
import { useAuth } from '@/context/AuthContext'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { FilterPill, FilterPopoverFooter, FilterPopoverHeader } from '@/components/filters/FilterPill'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Receipt,
  Download,
  Search,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Copy,
  Hash,
  ChevronLeft,
  ChevronRight,
  Check,
  ImageIcon,
  BarChart3,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import { getLast30Days, useVenueDateTime } from '@/utils/datetime'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import * as saleVerificationService from '@/services/saleVerification.service'
import type {
  SaleVerification,
  SaleVerificationStatus,
} from '@/services/saleVerification.service'

// Status colors and labels
const STATUS_CONFIG: Record<SaleVerificationStatus, { label: string; className: string }> = {
  COMPLETED: {
    label: 'CONCILIADO',
    className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
  },
  PENDING: {
    label: 'PENDIENTE',
    className: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700',
  },
  FAILED: {
    label: 'FALLIDO',
    className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
  },
}

// Chart tooltip
const ChartTooltip = ({ active, payload, label, valuePrefix = '' }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium text-sm mb-1">{label}</p>
        <p className="text-sm text-primary font-semibold">
          {valuePrefix}{payload[0]?.value?.toLocaleString()}
        </p>
      </div>
    )
  }
  return null
}

const getDefaultDateRange = (timezone: string) => {
  const range = getLast30Days(timezone)
  const startDate = DateTime.fromJSDate(range.from, { zone: 'utc' }).setZone(timezone).toISODate()
  const endDate = DateTime.fromJSDate(range.to, { zone: 'utc' }).setZone(timezone).toISODate()
  return {
    startDate: startDate ?? '',
    endDate: endDate ?? '',
  }
}

type SingleSelectOption = {
  value: string
  label: string
}

interface SingleSelectFilterContentProps {
  title: string
  options: SingleSelectOption[]
  value: string
  onApply: (value: string) => void
  onClose?: () => void
  clearValue?: string
  emptyLabel?: string
}

const SingleSelectFilterContent = ({
  title,
  options,
  value,
  onApply,
  onClose,
  clearValue = 'all',
  emptyLabel = 'Sin opciones',
}: SingleSelectFilterContentProps) => {
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleApply = () => {
    onApply(localValue)
    onClose?.()
  }

  const handleClear = () => {
    setLocalValue(clearValue)
  }

  return (
    <div className="flex flex-col">
      <FilterPopoverHeader title={title} />
      <div className="max-h-[240px] overflow-y-auto p-2">
        {options.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <div className="space-y-1">
            {options.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setLocalValue(option.value)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                  'hover:bg-muted/50',
                  localValue === option.value && 'bg-muted/30'
                )}
              >
                <span className="flex-1 text-left">{option.label}</span>
                {localValue === option.value && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        )}
      </div>
      <FilterPopoverFooter onApply={handleApply} onClear={handleClear} showClear={localValue !== clearValue} />
    </div>
  )
}

interface DateRangeFilterContentProps {
  title: string
  startDate: string
  endDate: string
  onApply: (range: { startDate: string; endDate: string }) => void
  onClose?: () => void
}

const DateRangeFilterContent = ({ title, startDate, endDate, onApply, onClose }: DateRangeFilterContentProps) => {
  const [localStart, setLocalStart] = useState(startDate)
  const [localEnd, setLocalEnd] = useState(endDate)

  useEffect(() => {
    setLocalStart(startDate)
    setLocalEnd(endDate)
  }, [startDate, endDate])

  const handleApply = () => {
    onApply({ startDate: localStart, endDate: localEnd })
    onClose?.()
  }

  const handleClear = () => {
    setLocalStart('')
    setLocalEnd('')
  }

  return (
    <div className="flex flex-col">
      <FilterPopoverHeader title={title} />
      <div className="p-3 space-y-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Desde</p>
          <Input type="date" value={localStart} onChange={e => setLocalStart(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Hasta</p>
          <Input type="date" value={localEnd} onChange={e => setLocalEnd(e.target.value)} className="h-9" />
        </div>
      </div>
      <FilterPopoverFooter onApply={handleApply} onClear={handleClear} showClear={Boolean(localStart || localEnd)} />
    </div>
  )
}

export function SalesReport() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { activeVenue } = useAuth()
  const { venueTimezone } = useVenueDateTime()
  const venueId = activeVenue?.id ?? ''

  // Filters
  const [selectedStaff, setSelectedStaff] = useState('all')
  const [statusFilter, setStatusFilter] = useState<SaleVerificationStatus | 'all'>('all')
  const defaultRange = useMemo(() => getDefaultDateRange(venueTimezone), [venueTimezone])
  const [startDate, setStartDate] = useState(defaultRange.startDate)
  const [endDate, setEndDate] = useState(defaultRange.endDate)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)
  const hasDateRange = Boolean(startDate && endDate)

  useEffect(() => {
    setStartDate(defaultRange.startDate)
    setEndDate(defaultRange.endDate)
  }, [defaultRange.startDate, defaultRange.endDate])

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Image preview modal
  const [previewImages, setPreviewImages] = useState<string[] | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0)

  // Format currency
  const formatCurrency = useCallback(
    (value: number) =>
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: activeVenue?.currency || 'MXN',
        minimumFractionDigits: value === 0 ? 0 : 2,
      }).format(value),
    [activeVenue?.currency]
  )

  // Format date in venue timezone
  const formatDate = useCallback(
    (dateString: string) => {
      const date = new Date(dateString)
      return new Intl.DateTimeFormat('es-MX', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: venueTimezone,
      }).format(date)
    },
    [venueTimezone],
  )

  const apiDateRange = useMemo(() => {
    if (!startDate || !endDate) {
      return {
        fromDate: undefined,
        toDate: undefined,
      }
    }

    const start = DateTime.fromISO(startDate, { zone: venueTimezone }).startOf('day')
    const end = DateTime.fromISO(endDate, { zone: venueTimezone }).endOf('day')

    return {
      fromDate: start.isValid ? start.toUTC().toISO() ?? undefined : undefined,
      toDate: end.isValid ? end.toUTC().toISO() ?? undefined : undefined,
    }
  }, [startDate, endDate, venueTimezone])

  // Fetch sale verifications
  const {
    data: verificationsData,
    isLoading: isLoadingVerifications,
  } = useQuery({
    queryKey: [
      'sale-verifications',
      venueId,
      currentPage,
      pageSize,
      statusFilter,
      selectedStaff,
      apiDateRange.fromDate,
      apiDateRange.toDate,
      debouncedSearch,
    ],
    queryFn: () =>
      saleVerificationService.listSaleVerifications(venueId, {
        pageNumber: currentPage,
        pageSize,
        status: statusFilter === 'all' ? undefined : statusFilter,
        staffId: selectedStaff === 'all' ? undefined : selectedStaff,
        fromDate: apiDateRange.fromDate,
        toDate: apiDateRange.toDate,
        search: debouncedSearch || undefined,
      }),
    enabled: !!venueId,
  })

  // Fetch summary
  const { data: summary, isLoading: isLoadingSummary } = useQuery({
    queryKey: ['sale-verifications-summary', venueId, apiDateRange.fromDate, apiDateRange.toDate],
    queryFn: () =>
      saleVerificationService.getSaleVerificationsSummary(venueId, {
        fromDate: apiDateRange.fromDate,
        toDate: apiDateRange.toDate,
      }),
    enabled: !!venueId,
  })

  // Fetch daily data for charts
  const { data: dailyData } = useQuery({
    queryKey: ['sale-verifications-daily', venueId, apiDateRange.fromDate, apiDateRange.toDate],
    queryFn: () =>
      saleVerificationService.getDailySalesData(venueId, {
        fromDate: apiDateRange.fromDate,
        toDate: apiDateRange.toDate,
      }),
    enabled: !!venueId,
  })

  // Fetch staff for filter
  const { data: staffList } = useQuery({
    queryKey: ['sale-verifications-staff', venueId],
    queryFn: () => saleVerificationService.getStaffWithVerifications(venueId),
    enabled: !!venueId,
  })

  const staffOptions = useMemo<SingleSelectOption[]>(() => {
    const base = [
      {
        value: 'all',
        label: t('playtelecom:sales.allStaff', { defaultValue: 'Todo el personal' }),
      },
    ]
    if (!staffList) return base
    return base.concat(
      staffList.map(staff => ({
        value: staff.id,
        label: `${staff.firstName} ${staff.lastName} (${staff.verificationCount})`,
      })),
    )
  }, [staffList, t])

  const statusOptions = useMemo<SingleSelectOption[]>(
    () => [
      { value: 'all', label: t('playtelecom:sales.allStatuses', { defaultValue: 'Todos' }) },
      { value: 'COMPLETED', label: STATUS_CONFIG.COMPLETED.label },
      { value: 'PENDING', label: STATUS_CONFIG.PENDING.label },
      { value: 'FAILED', label: STATUS_CONFIG.FAILED.label },
    ],
    [t],
  )

  const selectedStaffLabel = staffOptions.find(option => option.value === selectedStaff)?.label
  const selectedStatusLabel = statusOptions.find(option => option.value === statusFilter)?.label
  const formatShortDate = useCallback(
    (date: string) => DateTime.fromISO(date, { zone: venueTimezone }).toFormat('dd/MM/yy'),
    [venueTimezone],
  )
  const dateRangeLabel = hasDateRange ? `${formatShortDate(startDate)} - ${formatShortDate(endDate)}` : null
  const clearDateRange = useCallback(() => {
    setStartDate('')
    setEndDate('')
  }, [])

  // Transform daily data for charts
  const chartData = useMemo(() => {
    if (!dailyData) return { revenue: [], volume: [] }

    const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    const formatDay = (date: string) => {
      const dt = DateTime.fromISO(date, { zone: venueTimezone })
      return dayNames[dt.weekday - 1] ?? dayNames[0]
    }

    if (!hasDateRange) {
      return {
        revenue: dailyData.map(d => ({ day: formatDay(d.date), revenue: d.revenue })),
        volume: dailyData.map(d => ({ day: formatDay(d.date), units: d.count })),
      }
    }

    const dataByDate = new Map(dailyData.map(d => [d.date, d]))
    const start = DateTime.fromISO(startDate, { zone: venueTimezone }).startOf('day')
    const end = DateTime.fromISO(endDate, { zone: venueTimezone }).startOf('day')
    const days: Array<{ day: string; revenue: number; units: number }> = []

    let cursor = start
    while (cursor.toMillis() <= end.toMillis()) {
      const dateKey = cursor.toISODate() ?? ''
      const record = dataByDate.get(dateKey)
      days.push({
        day: dayNames[cursor.weekday - 1] ?? dayNames[0],
        revenue: record?.revenue ?? 0,
        units: record?.count ?? 0,
      })
      cursor = cursor.plus({ days: 1 })
    }

    return {
      revenue: days.map(d => ({ day: d.day, revenue: d.revenue })),
      volume: days.map(d => ({ day: d.day, units: d.units })),
    }
  }, [dailyData, startDate, endDate, hasDateRange, venueTimezone])

  const verifications = verificationsData?.data ?? []
  const pagination = verificationsData?.pagination
  const totalPages = pagination?.totalPages ?? 1

  // Get staff name
  const getStaffName = (verification: SaleVerification) => {
    if (verification.staff) {
      return `${verification.staff.firstName} ${verification.staff.lastName}`.trim()
    }
    return 'N/A'
  }

  // Get staff avatar URL
  const getStaffAvatar = (verification: SaleVerification) => {
    if (verification.staff?.photoUrl) {
      return verification.staff.photoUrl
    }
    const name = getStaffName(verification)
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
  }

  // Copy payment ID to clipboard
  const copyPaymentId = useCallback((paymentId: string) => {
    navigator.clipboard.writeText(paymentId)
  }, [])

  // Format payment ID (show last 8 chars)
  const formatPaymentId = useCallback((paymentId: string) => {
    if (paymentId.length <= 12) return paymentId
    return `${paymentId.slice(0, 4)}...${paymentId.slice(-4)}`
  }, [])

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <GlassCard className="p-4">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Receipt className="w-5 h-5 text-primary" />
            </div>
            <div>
              <PageTitleWithInfo
                title={t('playtelecom:sales.title')}
                className="text-lg font-bold tracking-tight"
              />
              <p className="text-xs text-muted-foreground">
                {t('playtelecom:sales.transactionAnalysis', { defaultValue: 'Análisis transaccional y validación de registros' })}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
            <FilterPill
              label={t('playtelecom:sales.staff', { defaultValue: 'Personal' })}
              activeValue={selectedStaff !== 'all' ? selectedStaffLabel : null}
              isActive={selectedStaff !== 'all'}
              onClear={selectedStaff !== 'all' ? () => setSelectedStaff('all') : undefined}
            >
              <SingleSelectFilterContent
                title={t('playtelecom:sales.staff', { defaultValue: 'Personal' })}
                options={staffOptions}
                value={selectedStaff}
                onApply={setSelectedStaff}
              />
            </FilterPill>

            <FilterPill
              label={t('playtelecom:sales.status', { defaultValue: 'Estado' })}
              activeValue={statusFilter !== 'all' ? selectedStatusLabel : null}
              isActive={statusFilter !== 'all'}
              onClear={statusFilter !== 'all' ? () => setStatusFilter('all') : undefined}
            >
              <SingleSelectFilterContent
                title={t('playtelecom:sales.status', { defaultValue: 'Estado' })}
                options={statusOptions}
                value={statusFilter}
                onApply={value => setStatusFilter(value as SaleVerificationStatus | 'all')}
              />
            </FilterPill>

            <FilterPill
              label={t('playtelecom:sales.dateRange', { defaultValue: 'Fecha' })}
              activeValue={dateRangeLabel}
              isActive={hasDateRange}
              onClear={hasDateRange ? clearDateRange : undefined}
            >
              <DateRangeFilterContent
                title={t('playtelecom:sales.dateRange', { defaultValue: 'Fecha' })}
                startDate={startDate}
                endDate={endDate}
                onApply={({ startDate: nextStart, endDate: nextEnd }) => {
                  setStartDate(nextStart)
                  setEndDate(nextEnd)
                }}
              />
            </FilterPill>

            <Button variant="outline" size="sm" className="gap-1 ml-auto">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Revenue */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                {t('playtelecom:sales.totalRevenuePeriod', { defaultValue: 'Ingreso Total (Periodo)' })}
              </p>
              {isLoadingSummary ? (
                <div className="h-9 flex items-center">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <p className="text-3xl font-black mt-1">{formatCurrency(summary?.totalRevenue ?? 0)}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingUp className="w-3 h-3 text-green-500" />
                    <span className="text-[10px] text-green-500 font-bold">
                      {summary?.totalCount ?? 0} {t('playtelecom:sales.transactions', { defaultValue: 'transacciones' })}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="size-12 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-500" />
            </div>
          </div>
        </GlassCard>

        {/* Sales Volume */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                {t('playtelecom:sales.salesVolume', { defaultValue: 'Volumen Ventas' })}
              </p>
              {isLoadingSummary ? (
                <div className="h-9 flex items-center">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <p className="text-3xl font-black mt-1">
                    {(summary?.totalCount ?? 0).toLocaleString()}{' '}
                    <span className="text-sm text-muted-foreground font-medium">ventas</span>
                  </p>
                  <span className="text-[10px] text-muted-foreground font-bold mt-1">
                    {summary?.conciliatedCount ?? 0} {t('playtelecom:sales.conciliatedShort', { defaultValue: 'conciliadas' })}
                  </span>
                </>
              )}
            </div>
            <div className="size-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-blue-500" />
            </div>
          </div>
        </GlassCard>

        {/* Average Ticket */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                {t('playtelecom:sales.avgTicket')}
              </p>
              {isLoadingSummary ? (
                <div className="h-9 flex items-center">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <p className="text-3xl font-black mt-1">{formatCurrency(summary?.avgAmount ?? 0)}</p>
                  <span className="text-[10px] text-orange-500 font-bold mt-1">
                    {summary?.pendingCount ?? 0} {t('playtelecom:sales.pendingShort', { defaultValue: 'pendientes' })}
                  </span>
                </>
              )}
            </div>
            <div className="size-12 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
              <Receipt className="w-6 h-6 text-orange-500" />
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Trend - 2/3 width */}
        <GlassCard className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-black uppercase tracking-widest">
                {t('playtelecom:sales.revenueTrend', { defaultValue: 'Tendencia de Ingresos' })}
              </h3>
            </div>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData.revenue} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" className="stroke-border/30" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                />
                <RechartsTooltip content={<ChartTooltip valuePrefix="$" />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Volume by Day - 1/3 width */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-pink-500" />
              <h3 className="text-xs font-black uppercase tracking-widest">
                {t('playtelecom:sales.volumeByDay', { defaultValue: 'Volumen por Día' })}
              </h3>
            </div>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.volume} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="4 4" className="stroke-border/30" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                />
                <RechartsTooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="units"
                  fill="hsl(var(--accent, 330 90% 50%))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      {/* Transactions Table */}
      <GlassCard className="overflow-hidden">
        {/* Table Header */}
        <div className="px-6 py-4 border-b border-border bg-muted/30 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <h3 className="font-black uppercase tracking-wide text-sm flex items-center gap-2">
              {t('playtelecom:sales.transactionDetails', { defaultValue: 'Detalle de Transacciones' })}
            </h3>
          </div>
          <div className="flex gap-2">
            <span className="bg-background border border-border text-muted-foreground text-[10px] font-bold px-2 py-1 rounded flex items-center">
              <span className="size-2 bg-green-500 rounded-full mr-1" />
              {t('playtelecom:sales.conciliated', { defaultValue: 'Conciliadas' })}: {(summary?.conciliatedCount ?? 0).toLocaleString()}
            </span>
            <span className="bg-background border border-border text-muted-foreground text-[10px] font-bold px-2 py-1 rounded flex items-center">
              <span className="size-2 bg-yellow-400 rounded-full mr-1" />
              {t('playtelecom:sales.pending', { defaultValue: 'Pendientes' })}: {summary?.pendingCount ?? 0}
            </span>
            {(summary?.withoutVerificationCount ?? 0) > 0 && (
              <span className="bg-background border border-amber-300 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-2 py-1 rounded flex items-center">
                <AlertTriangle className="size-3 mr-1" />
                {t('playtelecom:sales.withoutEvidence', { defaultValue: 'Sin evidencia' })}: {summary?.withoutVerificationCount ?? 0}
              </span>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-3 border-b border-border bg-background">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('playtelecom:sales.searchPlaceholder', { defaultValue: 'Buscar por ID, nombre...' })}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-background border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-black text-[10px] uppercase text-muted-foreground">
                  {t('playtelecom:sales.paymentIdDate', { defaultValue: 'ID Pago / Fecha' })}
                </th>
                <th className="px-6 py-4 font-black text-[10px] uppercase text-muted-foreground text-center">
                  {t('playtelecom:sales.proofOfSale', { defaultValue: 'Evidencia Registro' })}
                </th>
                <th className="px-6 py-4 font-black text-[10px] uppercase text-muted-foreground">
                  {t('playtelecom:sales.seller')}
                </th>
                <th className="px-6 py-4 font-black text-[10px] uppercase text-muted-foreground text-right">
                  {t('playtelecom:sales.amount')}
                </th>
                <th className="px-6 py-4 font-black text-[10px] uppercase text-muted-foreground text-center">
                  {t('playtelecom:sales.status', { defaultValue: 'Estado' })}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {isLoadingVerifications ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mt-2">
                      {t('common:loading', { defaultValue: 'Cargando...' })}
                    </p>
                  </td>
                </tr>
              ) : verifications.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Receipt className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {t('playtelecom:sales.noVerifications', { defaultValue: 'No hay verificaciones de venta' })}
                    </p>
                  </td>
                </tr>
              ) : (
                verifications.map(verification => (
                  <tr key={verification.id} className="hover:bg-muted/30 transition-colors">
                    {/* ID & Date */}
                    <td className="px-6 py-4">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => copyPaymentId(verification.paymentId)}
                              className="font-bold text-primary text-xs flex items-center gap-1 hover:text-primary/80 transition-colors cursor-pointer"
                            >
                              <Hash className="w-3 h-3" />
                              {formatPaymentId(verification.paymentId)}
                              <Copy className="w-3 h-3 opacity-50" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('playtelecom:sales.clickToCopy', { defaultValue: 'Clic para copiar' })}</p>
                            <p className="font-mono text-xs">{verification.paymentId}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {formatDate(verification.createdAt)}
                      </p>
                    </td>

                    {/* Proof of Sale */}
                    <td className="px-6 py-4 text-center">
                      {verification.photos.length > 0 ? (
                        <button
                          onClick={() => {
                            setPreviewImages(verification.photos)
                            setPreviewIndex(0)
                          }}
                          className="relative group inline-block cursor-pointer"
                        >
                          <img
                            src={verification.photos[0]}
                            alt={t('playtelecom:sales.proofOfSale')}
                            className="h-10 w-16 object-cover rounded border border-border shadow-sm transition-all group-hover:shadow-md group-hover:scale-105"
                          />
                          {verification.photos.length > 1 && (
                            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                              +{verification.photos.length - 1}
                            </span>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded transition-colors flex items-center justify-center">
                            <Search className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="inline-flex items-center justify-center gap-1 text-amber-500">
                                <AlertTriangle className="w-4 h-4" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t('playtelecom:sales.noVerification', { defaultValue: 'Sin evidencia de registro' })}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </td>

                    {/* Seller */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <img
                          src={getStaffAvatar(verification)}
                          alt={getStaffName(verification)}
                          className="size-6 rounded-full"
                        />
                        <span className="text-xs font-bold">{getStaffName(verification)}</span>
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="px-6 py-4 text-right font-black">
                      {formatCurrency(verification.payment?.amount ?? 0)}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 text-center">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-[9px] font-black border',
                          STATUS_CONFIG[verification.status]?.className ?? STATUS_CONFIG.PENDING.className
                        )}
                      >
                        {STATUS_CONFIG[verification.status]?.label ?? verification.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-border bg-muted/30 flex justify-between items-center">
          <p className="text-[10px] text-muted-foreground font-bold">
            {t('playtelecom:sales.showingOf', {
              defaultValue: 'Mostrando {{current}} de {{total}} ventas',
              current: verifications.length,
              total: pagination?.totalCount ?? 0,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="text-xs"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              {t('common:previous', { defaultValue: 'Anterior' })}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="text-xs"
            >
              {t('common:next', { defaultValue: 'Siguiente' })}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Image Preview Modal */}
      <Dialog open={!!previewImages} onOpenChange={() => setPreviewImages(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              {t('playtelecom:sales.proofOfSale')}
              {previewImages && previewImages.length > 1 && (
                <span className="text-sm text-muted-foreground font-normal">
                  ({previewIndex + 1} / {previewImages.length})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {previewImages && (
            <div className="relative">
              <img
                src={previewImages[previewIndex]}
                alt={t('playtelecom:sales.proofOfSale')}
                className="w-full h-auto rounded-lg"
              />
              {previewImages.length > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={previewIndex === 0}
                    onClick={() => setPreviewIndex(i => i - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={previewIndex >= previewImages.length - 1}
                    onClick={() => setPreviewIndex(i => i + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SalesReport
