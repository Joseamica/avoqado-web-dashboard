/**
 * TeamCommissionRanking - Ranking table showing accumulated commissions per team member
 *
 * Shows a leaderboard of staff by total commissions generated, with clickable rows
 * to navigate to individual staff profiles. Includes period filter (week, biweek, month, quarter, all).
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Trophy, Medal, Award, User, TrendingUp, ExternalLink } from 'lucide-react'
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, startOfQuarter, endOfQuarter, subQuarters, parseISO, startOfDay, endOfDay } from 'date-fns'
import DataTable from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { FilterPill, FilterPopoverHeader, FilterPopoverFooter } from '@/components/filters/FilterPill'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { useCommissionSummaries, useCommissionStats } from '@/hooks/useCommissions'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import type { CommissionSummary } from '@/types/commission'
import { cn } from '@/lib/utils'

// Period filter options
type PeriodFilter = 'week' | 'biweek' | 'month' | 'quarter' | 'all'

// Aggregated staff data for ranking
interface StaffRankingData {
  rank: number
  staffId: string
  staffVenueId: string | null
  staffName: string
  currentPeriod: number
  previousPeriod: number
  netAmount: number
}

// Ranking badge component
const RankBadge = ({ rank }: { rank: number }) => {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500">
        <Trophy className="w-4 h-4 text-primary-foreground" />
      </div>
    )
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-400">
        <Medal className="w-4 h-4 text-primary-foreground" />
      </div>
    )
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-amber-600 to-amber-700">
        <Award className="w-4 h-4 text-primary-foreground" />
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
      <span className="text-sm font-semibold text-muted-foreground">{rank}</span>
    </div>
  )
}

// Calculate date ranges for each period filter
function getDateRanges(periodFilter: PeriodFilter): { current: { start: Date; end: Date }; previous: { start: Date; end: Date } | null } {
  const now = new Date()

  switch (periodFilter) {
    case 'week': {
      const currentStart = startOfWeek(now, { weekStartsOn: 1 }) // Monday
      const currentEnd = endOfWeek(now, { weekStartsOn: 1 })
      const previousStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
      const previousEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
      return {
        current: { start: currentStart, end: currentEnd },
        previous: { start: previousStart, end: previousEnd },
      }
    }
    case 'biweek': {
      // Get current date's week number in the month (1-4)
      const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 })
      const monthStart = startOfMonth(now)
      const daysSinceMonthStart = Math.floor((currentWeekStart.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24))
      const isSecondHalf = daysSinceMonthStart >= 14

      let currentStart: Date
      let currentEnd: Date
      let previousStart: Date
      let previousEnd: Date

      if (isSecondHalf) {
        // Second half of the month (15th to end)
        currentStart = new Date(now.getFullYear(), now.getMonth(), 16)
        currentEnd = endOfMonth(now)
        previousStart = new Date(now.getFullYear(), now.getMonth(), 1)
        previousEnd = new Date(now.getFullYear(), now.getMonth(), 15)
      } else {
        // First half of the month (1st to 15th)
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1)
        currentEnd = new Date(now.getFullYear(), now.getMonth(), 15)
        // Previous is second half of last month
        const lastMonth = subMonths(now, 1)
        previousStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 16)
        previousEnd = endOfMonth(lastMonth)
      }
      return {
        current: { start: startOfDay(currentStart), end: endOfDay(currentEnd) },
        previous: { start: startOfDay(previousStart), end: endOfDay(previousEnd) },
      }
    }
    case 'month': {
      const currentStart = startOfMonth(now)
      const currentEnd = endOfMonth(now)
      const lastMonth = subMonths(now, 1)
      const previousStart = startOfMonth(lastMonth)
      const previousEnd = endOfMonth(lastMonth)
      return {
        current: { start: currentStart, end: currentEnd },
        previous: { start: previousStart, end: previousEnd },
      }
    }
    case 'quarter': {
      const currentStart = startOfQuarter(now)
      const currentEnd = endOfQuarter(now)
      const lastQuarter = subQuarters(now, 1)
      const previousStart = startOfQuarter(lastQuarter)
      const previousEnd = endOfQuarter(lastQuarter)
      return {
        current: { start: currentStart, end: currentEnd },
        previous: { start: previousStart, end: previousEnd },
      }
    }
    case 'all':
    default:
      return {
        current: { start: new Date(0), end: now },
        previous: null,
      }
  }
}

// Period filter content component
interface PeriodFilterContentProps {
  value: PeriodFilter
  onChange: (value: PeriodFilter) => void
  onClose?: () => void
  t: (key: string, options?: Record<string, unknown>) => string
}

function PeriodFilterContent({ value, onChange, onClose, t }: PeriodFilterContentProps) {
  const [localValue, setLocalValue] = useState(value)

  const options: { value: PeriodFilter; label: string }[] = [
    { value: 'week', label: t('ranking.filterOptions.week') },
    { value: 'biweek', label: t('ranking.filterOptions.biweek') },
    { value: 'month', label: t('ranking.filterOptions.month') },
    { value: 'quarter', label: t('ranking.filterOptions.quarter') },
    { value: 'all', label: t('ranking.filterOptions.all') },
  ]

  const handleApply = () => {
    onChange(localValue)
    onClose?.()
  }

  return (
    <div className="flex flex-col">
      <FilterPopoverHeader title={t('ranking.filterPeriod')} />
      <div className="p-3">
        <RadioGroup value={localValue} onValueChange={v => setLocalValue(v as PeriodFilter)}>
          {options.map(option => (
            <div key={option.value} className="flex items-center space-x-2 py-1.5">
              <RadioGroupItem value={option.value} id={`period-${option.value}`} />
              <Label htmlFor={`period-${option.value}`} className="cursor-pointer text-sm font-normal">
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
      <FilterPopoverFooter onApply={handleApply} showClear={false} />
    </div>
  )
}

export default function TeamCommissionRanking() {
  const { t, i18n } = useTranslation('commissions')
  const navigate = useNavigate()
  const { venueSlug } = useCurrentVenue()
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  })
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('month')

  // Fetch summaries and stats
  const { data: summaries, isLoading: isLoadingSummaries } = useCommissionSummaries()
  const { data: stats, isLoading: isLoadingStats } = useCommissionStats()

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(i18n.language === 'es' ? 'es-MX' : 'en-US', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  // Safe number conversion - handles null, undefined, NaN, strings
  const safeNumber = (value: unknown): number => {
    if (value === null || value === undefined) return 0
    const num = Number(value)
    return Number.isNaN(num) ? 0 : num
  }

  // Get column headers based on period filter
  const getColumnHeaders = useMemo(() => {
    switch (periodFilter) {
      case 'week':
        return {
          current: t('ranking.columns.thisWeek'),
          previous: t('ranking.columns.lastWeek'),
        }
      case 'biweek':
        return {
          current: t('ranking.columns.thisBiweek'),
          previous: t('ranking.columns.lastBiweek'),
        }
      case 'month':
        return {
          current: t('ranking.columns.thisMonth'),
          previous: t('ranking.columns.lastMonth'),
        }
      case 'quarter':
        return {
          current: t('ranking.columns.thisQuarter'),
          previous: t('ranking.columns.lastQuarter'),
        }
      case 'all':
        return {
          current: t('ranking.columns.total'),
          previous: null,
        }
    }
  }, [periodFilter, t])

  // Get filter display label
  const getFilterDisplayLabel = useMemo(() => {
    switch (periodFilter) {
      case 'week':
        return t('ranking.filterOptions.week')
      case 'biweek':
        return t('ranking.filterOptions.biweek')
      case 'month':
        return t('ranking.filterOptions.month')
      case 'quarter':
        return t('ranking.filterOptions.quarter')
      case 'all':
        return t('ranking.filterOptions.all')
    }
  }, [periodFilter, t])

  // Aggregate summaries by staff with period filtering
  const rankingData: StaffRankingData[] = useMemo(() => {
    if (!summaries || summaries.length === 0) return []

    const dateRanges = getDateRanges(periodFilter)

    // Helper to check if a summary's period OVERLAPS with a date range
    // Commission summaries are typically monthly, so we check overlap not containment
    // Overlap: summaryStart <= rangeEnd AND summaryEnd >= rangeStart
    const periodsOverlap = (summary: CommissionSummary, range: { start: Date; end: Date }) => {
      try {
        const summaryStart = parseISO(summary.periodStart)
        const summaryEnd = parseISO(summary.periodEnd)
        return summaryStart <= range.end && summaryEnd >= range.start
      } catch {
        return false
      }
    }

    // Group by staffVenueId (unique per venue) or staffId as fallback
    const staffMap = new Map<
      string,
      {
        staffId: string
        staffVenueId: string | null
        staffName: string
        currentPeriod: number
        previousPeriod: number
        total: number
      }
    >()

    summaries.forEach((summary: CommissionSummary) => {
      const key = summary.staff.staffVenueId || summary.staffId
      const existing = staffMap.get(key) || {
        staffId: summary.staffId,
        staffVenueId: summary.staff.staffVenueId || null,
        staffName: `${summary.staff.firstName} ${summary.staff.lastName}`,
        currentPeriod: 0,
        previousPeriod: 0,
        total: 0,
      }

      const net = safeNumber(summary.netAmount)

      // Check which period this summary belongs to (using overlap for monthly summaries)
      if (periodsOverlap(summary, dateRanges.current)) {
        existing.currentPeriod += net
      }
      if (dateRanges.previous && periodsOverlap(summary, dateRanges.previous)) {
        existing.previousPeriod += net
      }
      // Always add to total for "all" filter
      existing.total += net

      staffMap.set(key, existing)
    })

    // Convert to array and sort by current period (or total for 'all') descending
    const sortedData = Array.from(staffMap.values())
      .filter(data => (periodFilter === 'all' ? data.total > 0 : data.currentPeriod > 0 || data.previousPeriod > 0))
      .sort((a, b) => {
        if (periodFilter === 'all') {
          return b.total - a.total
        }
        return b.currentPeriod - a.currentPeriod
      })
      .map((data, index) => ({
        rank: index + 1,
        staffId: data.staffId,
        staffVenueId: data.staffVenueId,
        staffName: data.staffName,
        currentPeriod: data.currentPeriod,
        previousPeriod: data.previousPeriod,
        netAmount: periodFilter === 'all' ? data.total : data.currentPeriod + data.previousPeriod,
      }))

    return sortedData
  }, [summaries, periodFilter])

  // Handle row click to navigate to staff profile
  const handleRowClick = (staffVenueId: string | null) => {
    if (staffVenueId && venueSlug) {
      navigate(`/venues/${venueSlug}/team/${staffVenueId}`)
    }
  }

  // Table columns - dynamically generated based on period filter
  const columns: ColumnDef<StaffRankingData>[] = useMemo(() => {
    const baseColumns: ColumnDef<StaffRankingData>[] = [
      {
        accessorKey: 'rank',
        header: '#',
        size: 60,
        cell: ({ row }) => <RankBadge rank={row.original.rank} />,
      },
      {
        accessorKey: 'staffName',
        header: t('table.staff'),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="font-medium">{row.original.staffName}</div>
          </div>
        ),
      },
      {
        accessorKey: 'currentPeriod',
        header: getColumnHeaders.current,
        cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.currentPeriod)}</span>,
      },
    ]

    // Add previous period column if not "all" filter
    if (periodFilter !== 'all' && getColumnHeaders.previous) {
      baseColumns.push({
        accessorKey: 'previousPeriod',
        header: getColumnHeaders.previous,
        cell: ({ row }) => (
          <span className={cn(row.original.previousPeriod > 0 && 'text-muted-foreground')}>{formatCurrency(row.original.previousPeriod)}</span>
        ),
      })
    }

    // Add total column
    baseColumns.push({
      accessorKey: 'netAmount',
      header: periodFilter === 'all' ? '' : t('ranking.total'),
      cell: ({ row }) =>
        periodFilter === 'all' ? null : <span className="font-bold text-foreground">{formatCurrency(row.original.netAmount)}</span>,
    })

    // Add actions column
    baseColumns.push({
      id: 'actions',
      header: '',
      size: 50,
      cell: ({ row }) => (row.original.staffVenueId ? <ExternalLink className="w-4 h-4 text-muted-foreground" /> : null),
    })

    return baseColumns
  }, [t, i18n.language, periodFilter, getColumnHeaders])

  const isLoading = isLoadingSummaries || isLoadingStats

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-6 w-48" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (rankingData.length === 0 && periodFilter !== 'all') {
    // Check if there's data in 'all' mode
    const hasAnyData = summaries && summaries.length > 0
    return (
      <div className="relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm">
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5">
                <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold">{t('ranking.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('ranking.description')}</p>
              </div>
            </div>
            <FilterPill
              label={t('ranking.filterPeriod')}
              activeValue={getFilterDisplayLabel}
              isActive={true}
              onClear={() => setPeriodFilter('month')}
            >
              <PeriodFilterContent value={periodFilter} onChange={setPeriodFilter} t={t} />
            </FilterPill>
          </div>
        </div>
        <div className="p-12 text-center">
          <div className="p-4 rounded-full bg-muted inline-block mb-4">
            <TrendingUp className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            {hasAnyData ? t('ranking.emptyPeriod') : t('ranking.empty')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {hasAnyData ? t('ranking.emptyPeriodDescription') : t('ranking.emptyDescription')}
          </p>
        </div>
      </div>
    )
  }

  if (rankingData.length === 0) {
    return (
      <div className="relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm">
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5">
              <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold">{t('ranking.title')}</h3>
              <p className="text-sm text-muted-foreground">{t('ranking.description')}</p>
            </div>
          </div>
        </div>
        <div className="p-12 text-center">
          <div className="p-4 rounded-full bg-muted inline-block mb-4">
            <TrendingUp className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">{t('ranking.empty')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('ranking.emptyDescription')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5">
              <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold">{t('ranking.title')}</h3>
              <p className="text-sm text-muted-foreground">{t('ranking.description')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Period Filter */}
            <FilterPill
              label={t('ranking.filterPeriod')}
              activeValue={getFilterDisplayLabel}
              isActive={true}
              onClear={() => setPeriodFilter('month')}
            >
              <PeriodFilterContent value={periodFilter} onChange={setPeriodFilter} t={t} />
            </FilterPill>
            {stats && (
              <Badge variant="secondary" className="gap-1">
                <User className="w-3 h-3" />
                {stats.staffWithCommissions} {t('ranking.staffCount')}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <DataTable<StaffRankingData>
        columns={columns}
        data={rankingData}
        pagination={pagination}
        showColumnCustomizer={false}
        setPagination={setPagination}
        rowCount={rankingData.length}
        onRowClick={row => handleRowClick(row.staffVenueId)}
      />
    </div>
  )
}
