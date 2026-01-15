import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { Skeleton } from '@/components/ui/skeleton'
import { DateRangePicker } from '@/components/date-range-picker'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Currency } from '@/utils/currency'
import { getLast7Days } from '@/utils/datetime'
import { useAuth } from '@/context/AuthContext'
import {
  fetchSalesByItem,
  salesByItemKeys,
  type ReportType,
  type GroupByOption,
} from '@/services/reports/salesByItem.service'
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  Download,
  MoreVertical,
  Package,
  Settings2,
  ArrowUpDown,
} from 'lucide-react'
import { SalesByItemChart } from './components/SalesByItemChart'

// ============================================
// Types
// ============================================

type SortField = 'productName' | 'categoryName' | 'itemsSold' | 'unitsSold' | 'grossSales' | 'discounts' | 'netSales'
type SortDirection = 'asc' | 'desc'
type HoursFilter = 'all' | 'custom'
type ControlPanel = 'main' | 'reportType' | 'hoursFilter' | 'groupBy'

// Report types (same as sales summary)
const REPORT_TYPE_OPTIONS = {
  summaries: ['summary', 'hourlySum', 'dailySum'],
  increments: ['hours', 'days', 'weeks', 'months'],
}

// Group by options
const GROUP_BY_OPTIONS: GroupByOption[] = [
  'none',
  'category',
  'channel',
  'paymentMethod',
  'device',
  'source',
  'serviceOption',
  'itemType',
]

// LocalStorage key for persisting user preferences
const STORAGE_KEY = 'avoqado:salesByItem:preferences'

interface SalesByItemPreferences {
  reportType: ReportType
  hoursFilter: HoursFilter
  groupBy: GroupByOption
}

function loadPreferences(): Partial<SalesByItemPreferences> | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function savePreferences(prefs: Partial<SalesByItemPreferences>): void {
  try {
    const existing = loadPreferences() || {}
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, ...prefs }))
  } catch {
    // Ignore storage errors
  }
}

// ============================================
// GlassCard Component
// ============================================
const GlassCard: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className }) => (
  <div
    className={cn(
      'relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm',
      'shadow-sm transition-all duration-300',
      className
    )}
  >
    {children}
  </div>
)

// ============================================
// ControlOption Component
// ============================================
const ControlOption: React.FC<{
  value: string
  label: string
  description: string
  isSelected: boolean
}> = ({ value, label, description, isSelected }) => (
  <Label
    htmlFor={value}
    className={cn(
      'flex items-start gap-4 p-4 rounded-lg cursor-pointer transition-colors border border-transparent',
      'hover:bg-muted/50',
      isSelected && 'bg-muted/30 border-border'
    )}
  >
    <div className="flex-1 space-y-1 min-w-0">
      <p className="text-sm font-semibold leading-tight">{label}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
    <RadioGroupItem value={value} id={value} className="mt-0.5 shrink-0" />
  </Label>
)

// ============================================
// ControlRow Component
// ============================================
const ControlRow: React.FC<{
  label: string
  description: string
  value: string
  onClick: () => void
}> = ({ label, description, value, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center justify-between py-4 hover:bg-muted/30 rounded-lg transition-colors text-left px-2 cursor-pointer"
  >
    <div className="flex-1 space-y-1 min-w-0 pr-4">
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      <Badge variant="secondary" className="font-normal rounded-full px-3">
        {value}
      </Badge>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </div>
  </button>
)

// ============================================
// ControlPill Component
// ============================================
const ControlPill: React.FC<{
  label: string
  value: string
  onClick: () => void
}> = ({ label, value, onClick }) => (
  <Button
    variant="outline"
    size="sm"
    onClick={onClick}
    className="rounded-full h-8 px-3 text-xs font-medium border-border/60 hover:bg-muted/50 cursor-pointer"
  >
    <span className="text-muted-foreground mr-1">{label}</span>
    <span className="font-semibold">{value}</span>
  </Button>
)

// ============================================
// SortableHeader Component
// ============================================
const SortableHeader: React.FC<{
  label: string
  field: SortField
  currentSort: { field: SortField; direction: SortDirection }
  onSort: (field: SortField) => void
  align?: 'left' | 'right'
}> = ({ label, field, currentSort, onSort, align = 'left' }) => {
  const isActive = currentSort.field === field
  return (
    <button
      onClick={() => onSort(field)}
      className={cn(
        'flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer',
        align === 'right' && 'justify-end',
        isActive ? 'text-foreground' : 'text-muted-foreground'
      )}
    >
      <span className="text-xs font-medium">{label}</span>
      {isActive ? (
        currentSort.direction === 'asc' ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-50" />
      )}
    </button>
  )
}

// ============================================
// Loading Skeleton
// ============================================
const SalesByItemSkeleton = () => (
  <div className="p-4 md:p-6 space-y-6">
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-32" />
    </div>
    <div className="flex gap-2">
      {[1, 2].map((i) => (
        <Skeleton key={i} className="h-8 w-32 rounded-full" />
      ))}
    </div>
    <Skeleton className="h-48 w-full rounded-2xl" />
    <Skeleton className="h-96 w-full rounded-2xl" />
  </div>
)

// ============================================
// Main Component
// ============================================
export default function SalesByItem() {
  const { t, i18n } = useTranslation('reports')
  const { venueId: _venueId } = useCurrentVenue()
  const { activeVenue } = useAuth()
  const venueTimezone = activeVenue?.timezone || 'America/Mexico_City'

  // Date range state
  const defaultDateRange = useMemo(() => getLast7Days(venueTimezone), [venueTimezone])
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: defaultDateRange.from,
    to: defaultDateRange.to,
  })

  // Load saved preferences
  const savedPrefs = useMemo(() => loadPreferences(), [])

  // Controls state - applied values
  const [reportType, setReportType] = useState<ReportType>(() => (savedPrefs?.reportType as ReportType) || 'summary')
  const [hoursFilter, setHoursFilter] = useState<HoursFilter>(() => (savedPrefs?.hoursFilter as HoursFilter) || 'all')
  const [groupBy, setGroupBy] = useState<GroupByOption>(() => (savedPrefs?.groupBy as GroupByOption) || 'none')
  const [customStartHour, setCustomStartHour] = useState<string>('00:00')
  const [customEndHour, setCustomEndHour] = useState<string>('23:59')

  // Pending values (before applying)
  const [pendingReportType, setPendingReportType] = useState<ReportType>('summary')
  const [pendingHoursFilter, setPendingHoursFilter] = useState<HoursFilter>('all')
  const [pendingGroupBy, setPendingGroupBy] = useState<GroupByOption>('none')
  const [pendingStartHour, setPendingStartHour] = useState<string>('00:00')
  const [pendingEndHour, setPendingEndHour] = useState<string>('23:59')

  // Controls drawer state
  const [controlsOpen, setControlsOpen] = useState(false)
  const [activePanel, setActivePanel] = useState<ControlPanel>('main')

  // Sorting state
  const [sort, setSort] = useState<{ field: SortField; direction: SortDirection }>({
    field: 'grossSales',
    direction: 'desc',
  })

  // Handle sort
  const handleSort = (field: SortField) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc',
    }))
  }

  // Get translated label for report type
  const getReportTypeLabel = (value: string) => {
    return t(`salesSummary.controls.reportType.options.${value}`, value)
  }

  // Get translated label for hours filter
  const getHoursFilterLabel = (value: HoursFilter) => {
    if (value === 'all') {
      return t('salesByItem.controls.hoursFilter.options.all')
    }
    // Show the custom time range
    return `${customStartHour} - ${customEndHour}`
  }

  // Get translated label for group by
  const getGroupByLabel = (value: GroupByOption) => {
    return t(`salesByItem.controls.groupBy.options.${value}`, value)
  }

  // Determine if we should show product-specific columns (SKU, Category)
  const showProductColumns = groupBy === 'none'

  // Get the label for the first column based on groupBy
  const getFirstColumnLabel = () => {
    if (groupBy === 'none') return t('salesByItem.columns.item')
    return t(`salesByItem.controls.groupBy.options.${groupBy}`)
  }

  // Check if there are pending changes
  const hasReportTypeChange = pendingReportType !== reportType
  const hasHoursFilterChange = pendingHoursFilter !== hoursFilter ||
    (pendingHoursFilter === 'custom' && (pendingStartHour !== customStartHour || pendingEndHour !== customEndHour))
  const hasGroupByChange = pendingGroupBy !== groupBy

  // Open control panel
  const openControlPanel = (panel: ControlPanel) => {
    setPendingReportType(reportType)
    setPendingHoursFilter(hoursFilter)
    setPendingGroupBy(groupBy)
    setPendingStartHour(customStartHour)
    setPendingEndHour(customEndHour)
    setActivePanel(panel)
    setControlsOpen(true)
  }

  // Apply report type change
  const applyReportType = () => {
    setReportType(pendingReportType)
    savePreferences({ reportType: pendingReportType })
    setControlsOpen(false)
    setActivePanel('main')
  }

  // Apply hours filter change
  const applyHoursFilter = () => {
    setHoursFilter(pendingHoursFilter)
    if (pendingHoursFilter === 'custom') {
      setCustomStartHour(pendingStartHour)
      setCustomEndHour(pendingEndHour)
    }
    savePreferences({ hoursFilter: pendingHoursFilter })
    setControlsOpen(false)
    setActivePanel('main')
  }

  // Apply group by change
  const applyGroupBy = () => {
    setGroupBy(pendingGroupBy)
    savePreferences({ groupBy: pendingGroupBy })
    setControlsOpen(false)
    setActivePanel('main')
  }

  // Build API filters
  const apiFilters = useMemo(() => ({
    startDate: dateRange.from.toISOString(),
    endDate: dateRange.to.toISOString(),
    reportType,
    groupBy,
    // Include custom hours if filter is set to custom
    ...(hoursFilter === 'custom' && {
      startHour: customStartHour,
      endHour: customEndHour,
    }),
  }), [dateRange.from, dateRange.to, reportType, groupBy, hoursFilter, customStartHour, customEndHour])

  // Fetch data
  const {
    data: apiResponse,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: salesByItemKeys.report(apiFilters),
    queryFn: () => fetchSalesByItem(apiFilters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // Debug: Log API response
  console.log('API Response:', {
    byPeriod: apiResponse?.byPeriod?.slice(0, 3),
    totals: apiResponse?.totals,
    itemsCount: apiResponse?.items?.length,
  })

  // Sort items
  const sortedItems = useMemo(() => {
    if (!apiResponse?.items) return []
    return [...apiResponse.items].sort((a, b) => {
      const aValue = a[sort.field]
      const bValue = b[sort.field]
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sort.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }
      const numA = Number(aValue) || 0
      const numB = Number(bValue) || 0
      return sort.direction === 'asc' ? numA - numB : numB - numA
    })
  }, [apiResponse?.items, sort])

  // Handle date range change
  const handleDateRangeUpdate = (values: { range: { from: Date; to: Date | undefined } }) => {
    if (values.range.from && values.range.to) {
      setDateRange({ from: values.range.from, to: values.range.to })
    }
  }

  // Export CSV
  const handleExportCSV = () => {
    if (!apiResponse) return

    const rows: string[][] = []

    // Header - conditional columns based on groupBy
    const headerRow = [getFirstColumnLabel()]
    if (groupBy === 'none') {
      headerRow.push(t('salesByItem.columns.sku'), t('salesByItem.columns.category'))
    }
    headerRow.push(
      t('salesByItem.columns.unit'),
      t('salesByItem.columns.itemsSold'),
      t('salesByItem.columns.unitsSold'),
      t('salesByItem.columns.grossSales'),
      t('salesByItem.columns.discounts'),
    )
    rows.push(headerRow)

    // Data rows
    sortedItems.forEach(item => {
      const dataRow = [item.productName]
      if (groupBy === 'none') {
        dataRow.push(item.productSku || '', item.categoryName || '')
      }
      dataRow.push(
        item.unit,
        item.itemsSold.toString(),
        item.unitsSold.toString(),
        item.grossSales.toFixed(2),
        item.discounts.toFixed(2),
      )
      rows.push(dataRow)
    })

    // Totals row
    const totalsRow = [t('salesByItem.totals.label')]
    if (groupBy === 'none') {
      totalsRow.push('', '')
    }
    totalsRow.push(
      '',
      apiResponse.totals.itemsSold.toString(),
      apiResponse.totals.unitsSold.toString(),
      apiResponse.totals.grossSales.toFixed(2),
      apiResponse.totals.discounts.toFixed(2),
    )
    rows.push(totalsRow)

    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `sales-by-item-${dateRange.from.toISOString().split('T')[0]}-${dateRange.to.toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  if (isLoading) {
    return <SalesByItemSkeleton />
  }

  if (isError) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <PageTitleWithInfo
            title={t('salesByItem.title')}
            className="text-2xl font-bold"
            tooltip={t('info.salesByItem', {
              defaultValue: 'Reporte de ventas por producto para identificar volumen y rentabilidad.',
            })}
          />
        </div>
        <GlassCard className="p-6">
          <p className="text-destructive">
            {error instanceof Error ? error.message : 'Error loading sales by item data'}
          </p>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <PageTitleWithInfo
            title={t('salesByItem.title')}
            className="text-2xl font-bold"
            tooltip={t('info.salesByItem', {
              defaultValue: 'Reporte de ventas por producto para identificar volumen y rentabilidad.',
            })}
          />
          <Badge variant="outline" className="text-xs font-normal">
            Beta
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 cursor-pointer"
            onClick={handleExportCSV}
            disabled={!apiResponse}
          >
            <Download className="w-4 h-4" />
          </Button>

          {/* Controls Sheet */}
          <Sheet open={controlsOpen} onOpenChange={(open) => {
            setControlsOpen(open)
            if (!open) setActivePanel('main')
          }}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 cursor-pointer">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[450px] p-0 overflow-hidden">
              {/* Main Panel */}
              <div
                className={cn(
                  'absolute inset-0 transition-all duration-300 ease-in-out bg-background',
                  activePanel === 'main'
                    ? 'translate-x-0 opacity-100 visible z-20'
                    : '-translate-x-full opacity-0 invisible z-0'
                )}
              >
                <SheetHeader className="p-4 border-b">
                  <SheetTitle className="flex items-center gap-2">
                    <Settings2 className="w-5 h-5" />
                    {t('salesByItem.controls.title')}
                  </SheetTitle>
                </SheetHeader>
                <div className="p-2 space-y-1">
                  <ControlRow
                    label={t('salesByItem.controls.hoursFilter.label')}
                    description={t('salesByItem.controls.hoursFilter.description')}
                    value={getHoursFilterLabel(hoursFilter)}
                    onClick={() => setActivePanel('hoursFilter')}
                  />
                  <Separator className="my-2" />
                  <ControlRow
                    label={t('salesSummary.controls.reportType.label')}
                    description={t('salesSummary.controls.reportType.description')}
                    value={getReportTypeLabel(reportType)}
                    onClick={() => setActivePanel('reportType')}
                  />
                  <Separator className="my-2" />
                  <ControlRow
                    label={t('salesByItem.controls.groupBy.label')}
                    description={t('salesByItem.controls.groupBy.description')}
                    value={getGroupByLabel(groupBy)}
                    onClick={() => setActivePanel('groupBy')}
                  />
                </div>
              </div>

              {/* Hours Filter Panel */}
              <div
                className={cn(
                  'absolute inset-0 transition-all duration-300 ease-in-out bg-background flex flex-col',
                  activePanel === 'hoursFilter'
                    ? 'translate-x-0 opacity-100 visible z-20'
                    : 'translate-x-full opacity-0 invisible z-0'
                )}
              >
                <div className="flex items-center justify-between p-4 border-b">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full cursor-pointer"
                    onClick={() => setActivePanel('main')}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <Button
                    className="rounded-full px-6 cursor-pointer"
                    disabled={!hasHoursFilterChange}
                    onClick={applyHoursFilter}
                  >
                    {t('salesByItem.controls.apply')}
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="space-y-3">
                    <h2 className="text-2xl font-bold">{t('salesByItem.controls.hoursFilter.label')}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t('salesByItem.controls.hoursFilter.longDescription')}
                    </p>
                  </div>
                  <RadioGroup
                    value={pendingHoursFilter}
                    onValueChange={(v) => setPendingHoursFilter(v as HoursFilter)}
                    className="space-y-1"
                  >
                    <ControlOption
                      value="all"
                      label={t('salesByItem.controls.hoursFilter.options.all')}
                      description={t('salesByItem.controls.hoursFilter.options.allDesc')}
                      isSelected={pendingHoursFilter === 'all'}
                    />
                    <ControlOption
                      value="custom"
                      label={t('salesByItem.controls.hoursFilter.options.custom')}
                      description={t('salesByItem.controls.hoursFilter.options.customDesc')}
                      isSelected={pendingHoursFilter === 'custom'}
                    />
                  </RadioGroup>

                  {/* Custom hours inputs */}
                  {pendingHoursFilter === 'custom' && (
                    <div className="space-y-4 pt-4 border-t border-border/50">
                      <div className="space-y-2">
                        <Label htmlFor="startHour" className="text-sm font-medium">
                          {t('salesByItem.controls.hoursFilter.start', 'Hora inicio')}
                        </Label>
                        <input
                          id="startHour"
                          type="time"
                          value={pendingStartHour}
                          onChange={(e) => setPendingStartHour(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="endHour" className="text-sm font-medium">
                          {t('salesByItem.controls.hoursFilter.end', 'Hora fin')}
                        </Label>
                        <input
                          id="endHour"
                          type="time"
                          value={pendingEndHour}
                          onChange={(e) => setPendingEndHour(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Report Type Panel */}
              <div
                className={cn(
                  'absolute inset-0 transition-all duration-300 ease-in-out bg-background flex flex-col',
                  activePanel === 'reportType'
                    ? 'translate-x-0 opacity-100 visible z-20'
                    : 'translate-x-full opacity-0 invisible z-0'
                )}
              >
                <div className="flex items-center justify-between p-4 border-b">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full cursor-pointer"
                    onClick={() => setActivePanel('main')}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <Button
                    className="rounded-full px-6 cursor-pointer"
                    disabled={!hasReportTypeChange}
                    onClick={applyReportType}
                  >
                    {t('salesByItem.controls.apply')}
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="space-y-3">
                    <h2 className="text-2xl font-bold">{t('salesSummary.controls.reportType.label')}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t('salesSummary.controls.reportType.longDescription')}
                    </p>
                  </div>
                  <RadioGroup
                    value={pendingReportType}
                    onValueChange={(v) => setPendingReportType(v as ReportType)}
                    className="space-y-6"
                  >
                    {/* Summaries Section */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        {t('salesSummary.controls.reportType.summariesSection')}
                      </h3>
                      <div className="space-y-1">
                        {REPORT_TYPE_OPTIONS.summaries.map((key) => (
                          <ControlOption
                            key={key}
                            value={key}
                            label={t(`salesSummary.controls.reportType.options.${key}`)}
                            description={t(`salesSummary.controls.reportType.options.${key}Desc`)}
                            isSelected={pendingReportType === key}
                          />
                        ))}
                      </div>
                    </div>
                    {/* Increments Section */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        {t('salesSummary.controls.reportType.incrementsSection')}
                      </h3>
                      <div className="space-y-1">
                        {REPORT_TYPE_OPTIONS.increments.map((key) => (
                          <ControlOption
                            key={key}
                            value={key}
                            label={t(`salesSummary.controls.reportType.options.${key}`)}
                            description={t(`salesSummary.controls.reportType.options.${key}Desc`)}
                            isSelected={pendingReportType === key}
                          />
                        ))}
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              {/* Group By Panel */}
              <div
                className={cn(
                  'absolute inset-0 transition-all duration-300 ease-in-out bg-background flex flex-col',
                  activePanel === 'groupBy'
                    ? 'translate-x-0 opacity-100 visible z-20'
                    : 'translate-x-full opacity-0 invisible z-0'
                )}
              >
                <div className="flex items-center justify-between p-4 border-b">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full cursor-pointer"
                    onClick={() => setActivePanel('main')}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <Button
                    className="rounded-full px-6 cursor-pointer"
                    disabled={!hasGroupByChange}
                    onClick={applyGroupBy}
                  >
                    {t('salesByItem.controls.apply')}
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="space-y-3">
                    <h2 className="text-2xl font-bold">{t('salesByItem.controls.groupBy.label')}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t('salesByItem.controls.groupBy.longDescription')}
                    </p>
                  </div>
                  <RadioGroup
                    value={pendingGroupBy}
                    onValueChange={(v) => setPendingGroupBy(v as GroupByOption)}
                    className="space-y-1"
                  >
                    {GROUP_BY_OPTIONS.map((key) => (
                      <ControlOption
                        key={key}
                        value={key}
                        label={t(`salesByItem.controls.groupBy.options.${key}`)}
                        description={t(`salesByItem.controls.groupBy.options.${key}Desc`)}
                        isSelected={pendingGroupBy === key}
                      />
                    ))}
                  </RadioGroup>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="flex items-center">
        <DateRangePicker
          initialDateFrom={dateRange.from}
          initialDateTo={dateRange.to}
          onUpdate={handleDateRangeUpdate}
          align="start"
          locale={i18n.language}
          showCompare={false}
        />
      </div>

      {/* Control Pills */}
      <div className="flex flex-wrap gap-2">
        <ControlPill
          label={t('salesByItem.controls.hoursFilter.label')}
          value={getHoursFilterLabel(hoursFilter)}
          onClick={() => openControlPanel('hoursFilter')}
        />
        <ControlPill
          label={t('salesSummary.controls.reportType.label')}
          value={getReportTypeLabel(reportType)}
          onClick={() => openControlPanel('reportType')}
        />
        <ControlPill
          label={t('salesByItem.controls.groupBy.label')}
          value={getGroupByLabel(groupBy)}
          onClick={() => openControlPanel('groupBy')}
        />
      </div>

      {/* Chart - Only show for time-based reports */}
      {apiResponse && reportType !== 'summary' && apiResponse.byPeriod && apiResponse.byPeriod.length > 0 && (
        <SalesByItemChart
          data={apiResponse.byPeriod}
          reportType={reportType}
        />
      )}

      {/* Summary Stats */}
      {apiResponse && (
        <GlassCard className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
              <Package className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">{t('salesByItem.title')}</p>
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-2xl font-bold tracking-tight">{Currency(apiResponse.totals.grossSales)}</p>
                  <p className="text-xs text-muted-foreground">{t('salesByItem.columns.grossSales')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">{apiResponse.totals.itemsSold}</p>
                  <p className="text-xs text-muted-foreground">{t('salesByItem.columns.itemsSold')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">{apiResponse.totals.unitsSold}</p>
                  <p className="text-xs text-muted-foreground">{t('salesByItem.columns.unitsSold')}</p>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Items Table */}
      {apiResponse && (
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-4 py-3 text-left">
                    <SortableHeader
                      label={getFirstColumnLabel()}
                      field="productName"
                      currentSort={sort}
                      onSort={handleSort}
                    />
                  </th>
                  {showProductColumns && (
                    <th className="px-4 py-3 text-left hidden md:table-cell">
                      <span className="text-xs font-medium text-muted-foreground">
                        {t('salesByItem.columns.sku')}
                      </span>
                    </th>
                  )}
                  {showProductColumns && (
                    <th className="px-4 py-3 text-left hidden lg:table-cell">
                      <SortableHeader
                        label={t('salesByItem.columns.category')}
                        field="categoryName"
                        currentSort={sort}
                        onSort={handleSort}
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-center hidden sm:table-cell">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t('salesByItem.columns.unit')}
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SortableHeader
                      label={t('salesByItem.columns.itemsSold')}
                      field="itemsSold"
                      currentSort={sort}
                      onSort={handleSort}
                      align="right"
                    />
                  </th>
                  <th className="px-4 py-3 text-right hidden sm:table-cell">
                    <SortableHeader
                      label={t('salesByItem.columns.unitsSold')}
                      field="unitsSold"
                      currentSort={sort}
                      onSort={handleSort}
                      align="right"
                    />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SortableHeader
                      label={t('salesByItem.columns.grossSales')}
                      field="grossSales"
                      currentSort={sort}
                      onSort={handleSort}
                      align="right"
                    />
                  </th>
                  <th className="px-4 py-3 text-right hidden md:table-cell">
                    <SortableHeader
                      label={t('salesByItem.columns.discounts')}
                      field="discounts"
                      currentSort={sort}
                      onSort={handleSort}
                      align="right"
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item, index) => (
                  <tr
                    key={`${item.productId || item.productName}-${index}`}
                    className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium">{item.productName}</span>
                    </td>
                    {showProductColumns && (
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">{item.productSku || '—'}</span>
                      </td>
                    )}
                    {showProductColumns && (
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-sm text-muted-foreground">{item.categoryName || '—'}</span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <span className="text-sm text-muted-foreground">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-mono">{item.itemsSold}</span>
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <span className="text-sm font-mono">{item.unitsSold}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-mono">{Currency(item.grossSales)}</span>
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">
                      <span className="text-sm font-mono text-muted-foreground">
                        {item.discounts > 0 ? `-${Currency(item.discounts)}` : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 font-semibold">
                  <td className="px-4 py-3">
                    <span className="text-sm">{t('salesByItem.totals.label')}</span>
                  </td>
                  {showProductColumns && <td className="px-4 py-3 hidden md:table-cell" />}
                  {showProductColumns && <td className="px-4 py-3 hidden lg:table-cell" />}
                  <td className="px-4 py-3 hidden sm:table-cell" />
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-mono">{apiResponse.totals.itemsSold}</span>
                  </td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell">
                    <span className="text-sm font-mono">{apiResponse.totals.unitsSold}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-mono">{Currency(apiResponse.totals.grossSales)}</span>
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    <span className="text-sm font-mono">
                      {apiResponse.totals.discounts > 0 ? `-${Currency(apiResponse.totals.discounts)}` : '—'}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Empty State */}
      {apiResponse && apiResponse.items.length === 0 && (
        <GlassCard className="p-12 text-center">
          <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">{t('salesByItem.chart.noData')}</p>
        </GlassCard>
      )}
    </div>
  )
}
