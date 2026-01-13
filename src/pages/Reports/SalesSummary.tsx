import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { DateRangePicker } from '@/components/date-range-picker'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Currency } from '@/utils/currency'
import { getLast7Days } from '@/utils/datetime'
import { useAuth } from '@/context/AuthContext'
import {
  fetchSalesSummary,
  salesSummaryKeys,
  type ReportType,
  type GroupBy as ApiGroupBy,
} from '@/services/reports/salesSummary.service'
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Download,
  MoreVertical,
  TrendingUp,
  CreditCard,
  Banknote,
  Smartphone,
  Receipt,
  Filter,
  Settings2,
  PieChart,
  Table2,
  BarChart3,
  LayoutGrid,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { PeriodBreakdownTable } from './components/PeriodBreakdownTable'

// ============================================
// Payment Method Mapping
// ============================================
const PAYMENT_METHOD_DISPLAY: Record<string, { key: 'card' | 'cash' | 'other'; color: string }> = {
  CARD: { key: 'card', color: 'bg-blue-500' },
  CASH: { key: 'cash', color: 'bg-green-500' },
  TRANSFER: { key: 'other', color: 'bg-orange-500' },
  OTHER: { key: 'other', color: 'bg-orange-500' },
}


// Control option keys (translations are loaded dynamically)
// Report types are split into two categories like Square
const REPORT_TYPE_OPTIONS = {
  summaries: ['summary', 'hourlySum', 'dailySum'], // Resúmenes
  increments: ['hours', 'days', 'weeks', 'months'], // Incrementos individuales
}

const CONTROL_OPTION_KEYS = {
  viewType: ['gauge', 'pie', 'table'],
  groupBy: ['none', 'origin', 'channel', 'paymentMethod', 'shift', 'staff'],
  terminal: ['all'], // Will be populated with actual terminals from venue
}

// Available metrics for the report (based on database schema)
// Some metrics can be shown in the chart visualization (hasChart: true)
// Organized following Square's structure: Sales breakdown → Deductions → Totals → Costs → Profit
const AVAILABLE_METRICS = [
  // Sales breakdown
  { key: 'grossSales', hasChart: true },      // Ventas brutas - includes modifiers
  { key: 'items', hasChart: false },          // Artículos - pure item sales before tax/discounts
  { key: 'serviceCosts', hasChart: false },   // Costes del servicio - tips integrated, surcharges
  // Deductions
  { key: 'discounts', hasChart: false },      // Descuentos y artículos gratuitos
  { key: 'refunds', hasChart: false },        // Devoluciones
  // Calculated totals
  { key: 'netSales', hasChart: true },        // Ventas netas
  { key: 'deferredSales', hasChart: false },  // Ventas diferidas - open orders/pay-later
  // Fees and taxes
  { key: 'taxes', hasChart: false },          // Impuestos
  { key: 'tips', hasChart: false },           // Propinas
  // Costs breakdown (NEW - for clarity)
  { key: 'platformFees', hasChart: false },   // Comisiones de plataforma (Avoqado)
  { key: 'staffCommissions', hasChart: false }, // Comisiones a empleados
  // Final totals
  { key: 'totalCollected', hasChart: true },  // Total cobrado
  { key: 'netProfit', hasChart: true },       // Ganancia neta (after all costs)
] as const

type MetricKey = typeof AVAILABLE_METRICS[number]['key']

// Default selected metrics (most commonly used)
const DEFAULT_SELECTED_METRICS: MetricKey[] = ['grossSales', 'discounts', 'refunds', 'netSales', 'taxes', 'tips', 'platformFees', 'staffCommissions', 'totalCollected', 'netProfit']
const DEFAULT_CHART_METRIC: MetricKey = 'totalCollected'

// LocalStorage key for persisting user preferences
const STORAGE_KEY = 'avoqado:salesSummary:preferences'

// Preferences interface
interface SalesSummaryPreferences {
  selectedMetrics: MetricKey[]
  chartMetric: MetricKey
  viewType: string
  reportType: string
  groupBy: string
}

// Load preferences from localStorage
function loadPreferences(): Partial<SalesSummaryPreferences> | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Validate that selectedMetrics contains valid metric keys
      if (parsed.selectedMetrics) {
        const validKeys = AVAILABLE_METRICS.map(m => m.key)
        parsed.selectedMetrics = parsed.selectedMetrics.filter(
          (key: string) => validKeys.includes(key as MetricKey)
        )
        // Ensure at least one metric is selected
        if (parsed.selectedMetrics.length === 0) {
          parsed.selectedMetrics = DEFAULT_SELECTED_METRICS
        }
      }
      return parsed
    }
  } catch (e) {
    console.error('Failed to load sales summary preferences:', e)
  }
  return null
}

// Save preferences to localStorage
function savePreferences(prefs: SalesSummaryPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch (e) {
    console.error('Failed to save sales summary preferences:', e)
  }
}

// Custom icon for gauge (horizontal segmented bar like Square)
const GaugeBarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-muted-foreground">
    <rect x="1" y="6" width="6" height="4" rx="1" fill="currentColor" />
    <rect x="8" y="6" width="4" height="4" rx="1" fill="currentColor" opacity="0.6" />
    <rect x="13" y="6" width="2" height="4" rx="0.5" fill="currentColor" opacity="0.3" />
  </svg>
)

// Icons for viewType options
const VIEW_TYPE_ICONS: Record<string, React.ReactNode> = {
  gauge: <GaugeBarIcon />,
  pie: <PieChart className="w-4 h-4 text-muted-foreground" />,
  table: <Table2 className="w-4 h-4 text-muted-foreground" />,
}

// ============================================
// ControlOption Component (Radio with description - Square style)
// ============================================
const ControlOption: React.FC<{
  value: string
  label: string
  description: string
  isSelected: boolean
  icon?: React.ReactNode
}> = ({ value, label, description, isSelected, icon }) => (
  <Label
    htmlFor={value}
    className={cn(
      'flex items-start gap-4 p-4 rounded-lg cursor-pointer transition-colors border border-transparent',
      'hover:bg-muted/50',
      isSelected && 'bg-muted/30 border-border'
    )}
  >
    {icon && (
      <div className={cn(
        'p-2 rounded-lg shrink-0 mt-0.5',
        isSelected ? 'bg-foreground/10' : 'bg-muted/50'
      )}>
        {icon}
      </div>
    )}
    <div className="flex-1 space-y-1 min-w-0">
      <p className="text-sm font-semibold leading-tight">{label}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
    <RadioGroupItem value={value} id={value} className="mt-0.5 shrink-0" />
  </Label>
)

// ============================================
// ControlRow Component (Square style - title, description, badge)
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
// GlassCard Component (Modern Dashboard Design)
// ============================================
const GlassCard: React.FC<{
  children: React.ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}> = ({ children, className, hover = false, onClick }) => (
  <div
    onClick={onClick}
    className={cn(
      'relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm',
      'shadow-sm transition-all duration-300',
      hover && 'cursor-pointer hover:shadow-md hover:border-border hover:bg-card/90 hover:-translate-y-0.5',
      onClick && 'cursor-pointer',
      className
    )}
  >
    {children}
  </div>
)

// ============================================
// StatusIndicator Component (Square-style)
// ============================================
const StatusIndicator: React.FC<{ type: 'positive' | 'negative' | 'neutral' }> = ({ type }) => {
  const colors = {
    positive: 'bg-green-500',
    negative: 'bg-red-500',
    neutral: 'bg-blue-500',
  }
  return <span className={cn('shrink-0 w-2 h-2 rounded-sm', colors[type])} />
}

// ============================================
// ControlPill Component (Opens Sheet panel directly)
// ============================================
const ControlPill: React.FC<{
  label: string
  value: string
  onClick: () => void
}> = ({ label, value, onClick }) => {
  return (
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
}

// ============================================
// SummaryRow Component (Square-style with tooltip on dashed underline)
// ============================================
const SummaryRow: React.FC<{
  label: string
  value: number
  count?: number
  countLabel?: string
  type: 'positive' | 'negative' | 'neutral'
  indent?: number // 0 = no indent, 1 = first level, 2 = second level
  bold?: boolean
  tooltip?: string
}> = ({ label, value, count, countLabel, type, indent = 0, bold = false, tooltip }) => (
  <div
    className={cn(
      'flex items-start justify-between gap-4 py-2.5 hover:bg-muted/30 rounded-lg transition-colors',
      indent === 0 && 'px-4',
      indent === 1 && 'pl-10 pr-4',
      indent === 2 && 'pl-16 pr-4'
    )}
  >
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <StatusIndicator type={type} />
        {tooltip ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn(
                  'text-sm cursor-help border-b border-dashed border-muted-foreground/50 hover:border-foreground transition-colors',
                  bold && 'font-semibold'
                )}>
                  {label}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[280px] text-xs">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className={cn('text-sm', bold && 'font-semibold')}>{label}</span>
        )}
      </div>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground ml-4">{count} {countLabel}</span>
      )}
    </div>
    <span className={cn('text-sm text-right min-w-[100px] font-mono', bold && 'font-semibold')}>
      {Currency(value)}
    </span>
  </div>
)

// ============================================
// CollapsibleSummaryRow Component (Square-style parent row with expand/collapse)
// ============================================
const CollapsibleSummaryRow: React.FC<{
  label: string
  value: number
  count?: number
  countLabel?: string
  type: 'positive' | 'negative' | 'neutral'
  bold?: boolean
  tooltip?: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}> = ({ label, value, count, countLabel, type, bold = false, tooltip, isOpen, onToggle, children }) => (
  <div>
    <div
      className="flex items-start justify-between gap-4 px-4 py-2.5 hover:bg-muted/30 rounded-lg transition-colors cursor-pointer"
      onClick={onToggle}
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <ChevronDown className={cn(
            'w-4 h-4 text-muted-foreground transition-transform shrink-0',
            !isOpen && '-rotate-90'
          )} />
          <StatusIndicator type={type} />
          {tooltip ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn(
                    'text-sm cursor-help border-b border-dashed border-muted-foreground/50 hover:border-foreground transition-colors',
                    bold && 'font-semibold'
                  )}>
                    {label}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[280px] text-xs">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <span className={cn('text-sm', bold && 'font-semibold')}>{label}</span>
          )}
        </div>
        {count !== undefined && (
          <span className="text-xs text-muted-foreground ml-8">{count} {countLabel}</span>
        )}
      </div>
      <span className={cn('text-sm text-right min-w-[100px] font-mono', bold && 'font-semibold')}>
        {Currency(value)}
      </span>
    </div>
    {isOpen && (
      <div className="mt-1">
        {children}
      </div>
    )}
  </div>
)

// ============================================
// SalesBreakdownBar Component (Progress bar style visualization)
// ============================================
const SalesBreakdownBar: React.FC<{
  segments: Array<{
    label: string
    value: number
    color: string
    percentage: number
  }>
}> = ({ segments }) => (
  <div className="space-y-3">
    {/* Progress bar */}
    <div className="h-3 rounded-full bg-muted/50 overflow-hidden flex">
      {segments.map((segment, index) => (
        <TooltipProvider key={index}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn('h-full transition-all cursor-pointer hover:opacity-80', segment.color)}
                style={{ width: `${segment.percentage}%` }}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <p className="font-medium">{segment.label}</p>
              <p className="text-muted-foreground">{Currency(segment.value)} ({segment.percentage.toFixed(1)}%)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
    {/* Legend */}
    <div className="flex flex-wrap gap-4 text-xs">
      {segments.map((segment, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <div className={cn('w-2.5 h-2.5 rounded-sm', segment.color)} />
          <span className="text-muted-foreground">{segment.label}</span>
          <span className="font-medium">{segment.percentage.toFixed(0)}%</span>
        </div>
      ))}
    </div>
  </div>
)

// ============================================
// SalesPieChart Component (Single donut chart)
// ============================================
const SalesPieChart: React.FC<{
  segments: Array<{
    label: string
    value: number
    color: string
    percentage: number
  }>
}> = ({ segments }) => {
  const radius = 60
  const strokeWidth = 20
  const circumference = 2 * Math.PI * radius

  // Calculate cumulative offsets for each segment
  let cumulativePercentage = 0
  const segmentsWithOffset = segments.map((segment) => {
    const offset = cumulativePercentage
    cumulativePercentage += segment.percentage
    return { ...segment, offset }
  })

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Donut chart */}
      <div className="relative w-40 h-40">
        <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 160 160">
          {/* Background circle */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            className="text-muted/20"
          />
          {/* Segments */}
          {segmentsWithOffset.map((segment, index) => {
            const strokeDasharray = (segment.percentage / 100) * circumference
            const strokeDashoffset = -(segment.offset / 100) * circumference

            return (
              <TooltipProvider key={index}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <circle
                      cx="80"
                      cy="80"
                      r={radius}
                      stroke="currentColor"
                      strokeWidth={strokeWidth}
                      fill="none"
                      className={cn(
                        'cursor-pointer transition-opacity hover:opacity-80',
                        segment.color === 'bg-blue-500' && 'text-blue-500',
                        segment.color === 'bg-green-500' && 'text-green-500',
                        segment.color === 'bg-orange-500' && 'text-orange-500'
                      )}
                      style={{
                        strokeDasharray: `${strokeDasharray} ${circumference}`,
                        strokeDashoffset: strokeDashoffset,
                        transition: 'stroke-dasharray 0.5s ease-in-out',
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    <p className="font-medium">{segment.label}</p>
                    <p className="text-muted-foreground">{Currency(segment.value)} ({segment.percentage.toFixed(1)}%)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          })}
        </svg>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 text-xs">
        {segments.map((segment, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <div className={cn('w-2.5 h-2.5 rounded-sm', segment.color)} />
            <span className="text-muted-foreground">{segment.label}</span>
            <span className="font-medium">{segment.percentage.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// SalesTable Component (Table view)
// ============================================
const SalesTable: React.FC<{
  segments: Array<{
    label: string
    value: number
    color: string
    percentage: number
  }>
  columns: {
    method: string
    amount: string
    percentage: string
  }
}> = ({ segments, columns }) => (
  <div className="rounded-lg border border-border/50 overflow-hidden">
    {/* Header */}
    <div className="grid grid-cols-3 gap-4 px-4 py-2 bg-muted/30 text-xs font-medium text-muted-foreground">
      <span>{columns.method}</span>
      <span className="text-right">{columns.amount}</span>
      <span className="text-right">{columns.percentage}</span>
    </div>
    {/* Rows */}
    {segments.map((segment, index) => (
      <div
        key={index}
        className="grid grid-cols-3 gap-4 px-4 py-3 border-t border-border/30 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className={cn('w-2.5 h-2.5 rounded-sm', segment.color)} />
          <span className="text-sm">{segment.label}</span>
        </div>
        <span className="text-sm font-mono text-right">{Currency(segment.value)}</span>
        <span className="text-sm text-right text-muted-foreground">{segment.percentage.toFixed(1)}%</span>
      </div>
    ))}
  </div>
)

// ============================================
// PaymentMethodRow Component
// ============================================
const PaymentMethodRow: React.FC<{
  icon: React.ReactNode
  label: string
  amount: number
  count: number
  percentage: number
}> = ({ icon, label, amount, count, percentage }) => (
  <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-4 py-3 hover:bg-muted/30 rounded-lg transition-colors">
    <div className="p-2 rounded-lg bg-muted/50">{icon}</div>
    <span className="text-sm font-medium">{label}</span>
    <span className="text-sm text-muted-foreground text-right">{count} trans.</span>
    <span className="text-sm text-muted-foreground text-right min-w-[50px]">{percentage.toFixed(1)}%</span>
    <span className="text-sm font-mono text-right min-w-[100px]">{Currency(amount)}</span>
  </div>
)

// ============================================
// Loading Skeleton
// ============================================
const SalesSummarySkeleton = () => (
  <div className="p-4 md:p-6 space-y-6">
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-32" />
    </div>
    <div className="flex gap-2">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-8 w-32 rounded-full" />
      ))}
    </div>
    <Skeleton className="h-24 w-full rounded-2xl" />
    <Skeleton className="h-64 w-full rounded-2xl" />
    <Skeleton className="h-48 w-full rounded-2xl" />
  </div>
)

// ============================================
// Main Component
// ============================================
export default function SalesSummary() {
  const { t, i18n } = useTranslation('reports')
  const { venueId: _venueId } = useCurrentVenue() // Will be used for API calls
  const { activeVenue } = useAuth()
  const venueTimezone = activeVenue?.timezone || 'America/Mexico_City'

  // Date range state - default to last 7 days
  const defaultDateRange = useMemo(() => getLast7Days(venueTimezone), [venueTimezone])
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: defaultDateRange.from,
    to: defaultDateRange.to,
  })


  // State for collapsible sections
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [paymentsOpen, setPaymentsOpen] = useState(true)

  // State for collapsible summary rows (Square-style hierarchy)
  const [grossSalesOpen, setGrossSalesOpen] = useState(true)
  const [discountsOpen, setDiscountsOpen] = useState(true)

  // State for export sheet
  const [exportOpen, setExportOpen] = useState(false)
  const [exportType, setExportType] = useState<'all' | 'view'>('view')

  // State for controls drawer
  const [controlsOpen, setControlsOpen] = useState(false)
  const [activePanel, setActivePanel] = useState<'main' | 'reportType' | 'viewType' | 'groupBy' | 'terminal' | 'metrics' | null>('main')

  // Load saved preferences from localStorage
  const savedPrefs = useMemo(() => loadPreferences(), [])

  // Applied control values (what's actually shown in the report)
  const [reportType, setReportType] = useState<ReportType>(() => (savedPrefs?.reportType as ReportType) || 'summary')
  const [viewType, setViewType] = useState(() => savedPrefs?.viewType || 'gauge')
  const [groupBy, setGroupBy] = useState(() => savedPrefs?.groupBy || 'none')
  const [terminal, setTerminal] = useState('all')
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(
    () => savedPrefs?.selectedMetrics || DEFAULT_SELECTED_METRICS
  )
  const [chartMetric, setChartMetric] = useState<MetricKey>(
    () => savedPrefs?.chartMetric || DEFAULT_CHART_METRIC
  )

  // Pending control values (temporary state while editing in drawer)
  const [pendingReportType, setPendingReportType] = useState<ReportType>('summary')
  const [pendingViewType, setPendingViewType] = useState('gauge')
  const [pendingGroupBy, setPendingGroupBy] = useState('none')
  const [pendingTerminal, setPendingTerminal] = useState('all')
  const [pendingSelectedMetrics, setPendingSelectedMetrics] = useState<MetricKey[]>(DEFAULT_SELECTED_METRICS)
  const [pendingChartMetric, setPendingChartMetric] = useState<MetricKey>(DEFAULT_CHART_METRIC)

  // Save preferences to localStorage when they change
  useEffect(() => {
    savePreferences({
      selectedMetrics,
      chartMetric,
      viewType,
      reportType,
      groupBy,
    })
  }, [selectedMetrics, chartMetric, viewType, reportType, groupBy])

  // Get translated label for current selection
  const getSelectedLabel = (category: 'reportType' | 'viewType' | 'groupBy' | 'terminal', value: string) => {
    return t(`salesSummary.controls.${category}.options.${value}`, value)
  }

  // Check if there are pending changes for each control
  const hasReportTypeChange = pendingReportType !== reportType
  const hasViewTypeChange = pendingViewType !== viewType
  const hasGroupByChange = pendingGroupBy !== groupBy
  const hasTerminalChange = pendingTerminal !== terminal
  const hasMetricsChange = JSON.stringify(pendingSelectedMetrics) !== JSON.stringify(selectedMetrics) || pendingChartMetric !== chartMetric

  // Open sheet and navigate to specific panel, initialize pending with current value
  const openControlPanel = (panel: 'main' | 'reportType' | 'viewType' | 'groupBy' | 'terminal' | 'metrics') => {
    // Initialize pending values with current values when opening
    setPendingReportType(reportType)
    setPendingViewType(viewType)
    setPendingGroupBy(groupBy)
    setPendingTerminal(terminal)
    setPendingSelectedMetrics([...selectedMetrics])
    setPendingChartMetric(chartMetric)
    setActivePanel(panel)
    setControlsOpen(true)
  }

  // Apply changes and close drawer
  const applyReportType = () => {
    setReportType(pendingReportType)
    setControlsOpen(false)
    setActivePanel('main')
  }

  const applyViewType = () => {
    setViewType(pendingViewType)
    setControlsOpen(false)
    setActivePanel('main')
  }

  const applyGroupBy = () => {
    setGroupBy(pendingGroupBy)
    setControlsOpen(false)
    setActivePanel('main')
  }

  const applyTerminal = () => {
    setTerminal(pendingTerminal)
    setControlsOpen(false)
    setActivePanel('main')
  }

  const applyMetrics = () => {
    setSelectedMetrics([...pendingSelectedMetrics])
    setChartMetric(pendingChartMetric)
    setControlsOpen(false)
    setActivePanel('main')
  }

  // Toggle a metric selection
  const toggleMetric = (metric: MetricKey) => {
    setPendingSelectedMetrics(prev => {
      if (prev.includes(metric)) {
        // Don't allow deselecting all metrics
        if (prev.length === 1) return prev
        return prev.filter(m => m !== metric)
      }
      return [...prev, metric]
    })
  }

  // Toggle all metrics
  const toggleAllMetrics = () => {
    const allMetrics = AVAILABLE_METRICS.map(m => m.key)
    if (pendingSelectedMetrics.length === allMetrics.length) {
      // Keep at least one metric selected
      setPendingSelectedMetrics([allMetrics[0]])
    } else {
      setPendingSelectedMetrics(allMetrics)
    }
  }

  // Set chart metric (only one can be selected for chart visualization)
  const setMetricAsChart = (metric: MetricKey) => {
    setPendingChartMetric(metric)
  }

  // Export CSV function
  const handleExportCSV = () => {
    // Format date for filename
    const formatDateForFilename = (date: Date) => {
      return date.toISOString().split('T')[0]
    }

    // Build CSV content
    const rows: string[][] = []

    // Header row
    rows.push([t('salesSummary.title'), `${formatDateForFilename(dateRange.from)} - ${formatDateForFilename(dateRange.to)}`])
    rows.push([]) // Empty row

    // Summary section
    rows.push([t('salesSummary.sections.summary')])
    rows.push([t('salesSummary.columns.concept'), t('salesSummary.columns.count'), t('salesSummary.columns.amount')])
    rows.push([t('salesSummary.rows.grossSales'), data.transactions.completed.toString(), data.summary.totalGross.toFixed(2)])
    rows.push([t('salesSummary.rows.discounts'), '', (-data.summary.discounts).toFixed(2)])
    rows.push([t('salesSummary.rows.refunds'), data.transactions.refunded.toString(), (-data.summary.refunds).toFixed(2)])
    rows.push([t('salesSummary.rows.netSales'), '', data.summary.netSales.toFixed(2)])
    rows.push([t('salesSummary.rows.taxes'), '', data.summary.taxes.toFixed(2)])
    rows.push([t('salesSummary.rows.tips'), '', data.summary.tips.toFixed(2)])
    rows.push([t('salesSummary.rows.totalCollected'), '', data.summary.totalCollected.toFixed(2)])

    // Add payment methods if exporting all data
    if (exportType === 'all') {
      rows.push([]) // Empty row
      rows.push([t('salesSummary.sections.paymentMethods')])
      rows.push([t('salesSummary.tableColumns.method'), t('salesSummary.columns.count'), t('salesSummary.columns.amount'), t('salesSummary.tableColumns.percentage')])
      rows.push([t('salesSummary.paymentTypes.card'), data.paymentMethods.card.count.toString(), data.paymentMethods.card.amount.toFixed(2), `${data.paymentMethods.card.percentage.toFixed(1)}%`])
      rows.push([t('salesSummary.paymentTypes.cash'), data.paymentMethods.cash.count.toString(), data.paymentMethods.cash.amount.toFixed(2), `${data.paymentMethods.cash.percentage.toFixed(1)}%`])
      rows.push([t('salesSummary.paymentTypes.other'), data.paymentMethods.other.count.toString(), data.paymentMethods.other.amount.toFixed(2), `${data.paymentMethods.other.percentage.toFixed(1)}%`])
    }

    // Convert to CSV string
    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')

    // Create and download file
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `sales-summary-${formatDateForFilename(dateRange.from)}-${formatDateForFilename(dateRange.to)}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    // Close export sheet
    setExportOpen(false)
  }

  // Build API filters
  // Always request paymentMethod grouping for the top chart visualization
  const apiFilters = useMemo(() => ({
    startDate: dateRange.from.toISOString(),
    endDate: dateRange.to.toISOString(),
    groupBy: 'paymentMethod' as ApiGroupBy, // Always get payment breakdown for visualization
    reportType: reportType as ReportType,
  }), [dateRange.from, dateRange.to, reportType])

  // Fetch sales summary data from API
  const {
    data: apiResponse,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: salesSummaryKeys.summary(apiFilters),
    queryFn: () => fetchSalesSummary(apiFilters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // Transform API response to component data format
  const data = useMemo(() => {
    if (!apiResponse) return null

    // Process payment methods from API response
    // Database stores: CREDIT_CARD, DEBIT_CARD, CASH, TRANSFER, etc.
    const paymentMethods = apiResponse.byPaymentMethod || []

    // Group card payments (CREDIT_CARD + DEBIT_CARD)
    const cardPayments = paymentMethods.filter(p =>
      ['CREDIT_CARD', 'DEBIT_CARD', 'CARD'].includes(p.method)
    )
    const cardAmount = cardPayments.reduce((sum, p) => sum + p.amount, 0)
    const cardCount = cardPayments.reduce((sum, p) => sum + p.count, 0)

    // Cash payment
    const cashPayment = paymentMethods.find(p => p.method === 'CASH')

    // Other payments (everything else)
    const otherPayments = paymentMethods.filter(p =>
      !['CREDIT_CARD', 'DEBIT_CARD', 'CARD', 'CASH'].includes(p.method)
    )
    const otherAmount = otherPayments.reduce((sum, p) => sum + p.amount, 0)
    const otherCount = otherPayments.reduce((sum, p) => sum + p.count, 0)

    const totalPaymentAmount = paymentMethods.reduce((sum, p) => sum + p.amount, 0)

    return {
      summary: {
        totalGross: apiResponse.summary.grossSales,
        items: apiResponse.summary.items,
        serviceCosts: apiResponse.summary.serviceCosts,
        discounts: apiResponse.summary.discounts,
        refunds: apiResponse.summary.refunds,
        netSales: apiResponse.summary.netSales,
        deferredSales: apiResponse.summary.deferredSales,
        taxes: apiResponse.summary.taxes,
        tips: apiResponse.summary.tips,
        // Costs breakdown (NEW - for clarity)
        platformFees: apiResponse.summary.platformFees,       // Avoqado platform fees
        staffCommissions: apiResponse.summary.staffCommissions, // Commissions paid to staff
        totalCollected: apiResponse.summary.totalCollected,
        netProfit: apiResponse.summary.netProfit,             // True profit after all costs
      },
      transactions: {
        total: apiResponse.summary.transactionCount,
        completed: apiResponse.summary.transactionCount, // API doesn't break down by status
        refunded: 0, // Not available in current API
        voided: 0,
        deferred: 0,
      },
      paymentMethods: {
        card: {
          amount: cardAmount,
          count: cardCount,
          percentage: totalPaymentAmount > 0 ? (cardAmount / totalPaymentAmount) * 100 : 0,
        },
        cash: {
          amount: cashPayment?.amount || 0,
          count: cashPayment?.count || 0,
          percentage: totalPaymentAmount > 0 ? ((cashPayment?.amount || 0) / totalPaymentAmount) * 100 : 0,
        },
        other: {
          amount: otherAmount,
          count: otherCount,
          percentage: totalPaymentAmount > 0 ? (otherAmount / totalPaymentAmount) * 100 : 0,
        },
      },
      periodStart: apiResponse.dateRange.startDate,
      periodEnd: apiResponse.dateRange.endDate,
    }
  }, [apiResponse])

  // Extract period data for time-based reports
  const periodData = useMemo(() => {
    if (!apiResponse?.byPeriod || reportType === 'summary') {
      return null
    }
    return apiResponse.byPeriod
  }, [apiResponse?.byPeriod, reportType])

  // Handle date range change
  const handleDateRangeUpdate = (values: { range: { from: Date; to: Date | undefined } }) => {
    if (values.range.from && values.range.to) {
      setDateRange({ from: values.range.from, to: values.range.to })
      // TODO: Refetch data with new date range
    }
  }

  if (isLoading || !data) {
    return <SalesSummarySkeleton />
  }

  if (isError) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <PageTitleWithInfo
            title={t('salesSummary.title')}
            className="text-2xl font-bold"
            tooltip={t('info.salesSummary', {
              defaultValue: 'Resumen de ventas con totales y desglose por metodo, canal y periodo.',
            })}
          />
        </div>
        <GlassCard className="p-6">
          <p className="text-destructive">
            {error instanceof Error ? error.message : 'Error loading sales summary'}
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
            title={t('salesSummary.title')}
            className="text-2xl font-bold"
            tooltip={t('info.salesSummary', {
              defaultValue: 'Resumen de ventas con totales y desglose por metodo, canal y periodo.',
            })}
          />
          <Badge variant="outline" className="text-xs font-normal">
            Beta
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {/* Export Popover */}
          <Popover open={exportOpen} onOpenChange={setExportOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 cursor-pointer">
                <Download className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-4">
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-sm">{t('salesSummary.export.title')}</h4>
                  <p className="text-xs text-muted-foreground">{t('salesSummary.export.subtitle')}</p>
                </div>
                <RadioGroup
                  value={exportType}
                  onValueChange={(value: 'all' | 'view') => setExportType(value)}
                  className="space-y-2"
                >
                  <Label
                    htmlFor="export-all"
                    className={cn(
                      'flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                      'hover:bg-muted/50',
                      exportType === 'all' && 'bg-muted/30'
                    )}
                  >
                    <RadioGroupItem value="all" id="export-all" className="mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium leading-tight">{t('salesSummary.export.exportAll')}</p>
                      <p className="text-xs text-muted-foreground">{t('salesSummary.export.exportAllDesc')}</p>
                    </div>
                  </Label>
                  <Label
                    htmlFor="export-view"
                    className={cn(
                      'flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                      'hover:bg-muted/50',
                      exportType === 'view' && 'bg-muted/30'
                    )}
                  >
                    <RadioGroupItem value="view" id="export-view" className="mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium leading-tight">{t('salesSummary.export.exportView')}</p>
                      <p className="text-xs text-muted-foreground">{t('salesSummary.export.exportViewDesc')}</p>
                    </div>
                  </Label>
                </RadioGroup>
                <Button
                  size="sm"
                  className="w-full rounded-full cursor-pointer"
                  onClick={handleExportCSV}
                >
                  {t('salesSummary.export.button')}
                </Button>
              </div>
            </PopoverContent>
          </Popover>

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
              {/* Main Controls Panel */}
              <div
                className={cn(
                  'absolute inset-0 transition-transform duration-300 ease-in-out',
                  activePanel === 'main' ? 'translate-x-0' : '-translate-x-full'
                )}
              >
                <SheetHeader className="p-4 border-b">
                  <SheetTitle className="flex items-center gap-2">
                    <Settings2 className="w-5 h-5" />
                    {t('salesSummary.controls.title')}
                  </SheetTitle>
                </SheetHeader>
                <div className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-80px)]">
                  <ControlRow
                    label={t('salesSummary.controls.metrics.label')}
                    description={t('salesSummary.controls.metrics.description')}
                    value={`${selectedMetrics.length} ${t('salesSummary.controls.metrics.selected')}`}
                    onClick={() => setActivePanel('metrics')}
                  />
                  <Separator />
                  <ControlRow
                    label={t('salesSummary.controls.reportType.label')}
                    description={t('salesSummary.controls.reportType.description')}
                    value={getSelectedLabel('reportType', reportType)}
                    onClick={() => setActivePanel('reportType')}
                  />
                  <Separator />
                  <ControlRow
                    label={t('salesSummary.controls.terminal.label')}
                    description={t('salesSummary.controls.terminal.description')}
                    value={getSelectedLabel('terminal', terminal)}
                    onClick={() => setActivePanel('terminal')}
                  />
                  <Separator />
                  <ControlRow
                    label={t('salesSummary.controls.viewType.label')}
                    description={t('salesSummary.controls.viewType.description')}
                    value={getSelectedLabel('viewType', viewType)}
                    onClick={() => setActivePanel('viewType')}
                  />
                  <Separator />
                  <ControlRow
                    label={t('salesSummary.controls.groupBy.label')}
                    description={t('salesSummary.controls.groupBy.description')}
                    value={getSelectedLabel('groupBy', groupBy)}
                    onClick={() => setActivePanel('groupBy')}
                  />
                  <Separator />
                  <ControlRow
                    label={t('salesSummary.controls.filterBy.label')}
                    description={t('salesSummary.controls.filterBy.description')}
                    value={t('salesSummary.controls.filterBy.none')}
                    onClick={() => {/* TODO: Implement filter panel */}}
                  />
                </div>
              </div>

              {/* Report Type Sub-Panel (Square-like with two sections) */}
              <div
                className={cn(
                  'absolute inset-0 transition-transform duration-300 ease-in-out bg-background flex flex-col',
                  activePanel === 'reportType' ? 'translate-x-0' : 'translate-x-full'
                )}
              >
                {/* Header with back and apply buttons */}
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
                    {t('salesSummary.controls.apply')}
                  </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Title and description */}
                  <div className="space-y-3">
                    <h2 className="text-2xl font-bold">{t('salesSummary.controls.reportType.label')}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t('salesSummary.controls.reportType.longDescription')}
                    </p>
                  </div>

                  <RadioGroup value={pendingReportType} onValueChange={(v) => setPendingReportType(v as ReportType)} className="space-y-6">
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

              {/* Terminal Sub-Panel */}
              <div
                className={cn(
                  'absolute inset-0 transition-transform duration-300 ease-in-out bg-background flex flex-col',
                  activePanel === 'terminal' ? 'translate-x-0' : 'translate-x-full'
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
                    disabled={!hasTerminalChange}
                    onClick={applyTerminal}
                  >
                    {t('salesSummary.controls.apply')}
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="space-y-3">
                    <h2 className="text-2xl font-bold">{t('salesSummary.controls.terminal.label')}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t('salesSummary.controls.terminal.longDescription')}
                    </p>
                  </div>
                  <RadioGroup value={pendingTerminal} onValueChange={setPendingTerminal} className="space-y-1">
                    {CONTROL_OPTION_KEYS.terminal.map((key) => (
                      <ControlOption
                        key={key}
                        value={key}
                        label={t(`salesSummary.controls.terminal.options.${key}`)}
                        description={t(`salesSummary.controls.terminal.options.${key}Desc`)}
                        isSelected={pendingTerminal === key}
                      />
                    ))}
                  </RadioGroup>
                </div>
              </div>

              {/* View Type Sub-Panel */}
              <div
                className={cn(
                  'absolute inset-0 transition-transform duration-300 ease-in-out bg-background flex flex-col',
                  activePanel === 'viewType' ? 'translate-x-0' : 'translate-x-full'
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
                    disabled={!hasViewTypeChange}
                    onClick={applyViewType}
                  >
                    {t('salesSummary.controls.apply')}
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="space-y-3">
                    <h2 className="text-2xl font-bold">{t('salesSummary.controls.viewType.label')}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t('salesSummary.controls.viewType.longDescription')}
                    </p>
                  </div>
                  <RadioGroup value={pendingViewType} onValueChange={setPendingViewType} className="space-y-1">
                    {CONTROL_OPTION_KEYS.viewType.map((key) => (
                      <ControlOption
                        key={key}
                        value={key}
                        label={t(`salesSummary.controls.viewType.options.${key}`)}
                        description={t(`salesSummary.controls.viewType.options.${key}Desc`)}
                        isSelected={pendingViewType === key}
                        icon={VIEW_TYPE_ICONS[key]}
                      />
                    ))}
                  </RadioGroup>
                </div>
              </div>

              {/* Group By Sub-Panel */}
              <div
                className={cn(
                  'absolute inset-0 transition-transform duration-300 ease-in-out bg-background flex flex-col',
                  activePanel === 'groupBy' ? 'translate-x-0' : 'translate-x-full'
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
                    {t('salesSummary.controls.apply')}
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="space-y-3">
                    <h2 className="text-2xl font-bold">{t('salesSummary.controls.groupBy.label')}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t('salesSummary.controls.groupBy.longDescription')}
                    </p>
                  </div>
                  <RadioGroup value={pendingGroupBy} onValueChange={setPendingGroupBy} className="space-y-1">
                    {CONTROL_OPTION_KEYS.groupBy.map((key) => (
                      <ControlOption
                        key={key}
                        value={key}
                        label={t(`salesSummary.controls.groupBy.options.${key}`)}
                        description={t(`salesSummary.controls.groupBy.options.${key}Desc`)}
                        isSelected={pendingGroupBy === key}
                      />
                    ))}
                  </RadioGroup>
                </div>
              </div>

              {/* Metrics Sub-Panel */}
              <div
                className={cn(
                  'absolute inset-0 transition-transform duration-300 ease-in-out bg-background flex flex-col',
                  activePanel === 'metrics' ? 'translate-x-0' : 'translate-x-full'
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
                    disabled={!hasMetricsChange}
                    onClick={applyMetrics}
                  >
                    {t('salesSummary.controls.apply')}
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="space-y-3">
                    <h2 className="text-2xl font-bold">{t('salesSummary.controls.metrics.label')}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t('salesSummary.controls.metrics.longDescription')}
                    </p>
                  </div>

                  {/* Chart hint - Square style info box */}
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                    <BarChart3 className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t('salesSummary.controls.metrics.chartHint')}
                    </p>
                  </div>

                  {/* All metrics toggle */}
                  <div
                    className={cn(
                      'flex items-center justify-between p-4 rounded-lg cursor-pointer transition-colors',
                      'hover:bg-muted/50 border border-border/50'
                    )}
                    onClick={toggleAllMetrics}
                  >
                    <span className="text-sm font-semibold">{t('salesSummary.controls.metrics.allMetrics')}</span>
                    <Checkbox
                      checked={pendingSelectedMetrics.length === AVAILABLE_METRICS.length}
                      onCheckedChange={toggleAllMetrics}
                      className="cursor-pointer"
                    />
                  </div>

                  {/* Individual metrics */}
                  <div className="space-y-1">
                    {AVAILABLE_METRICS.map((metric) => {
                      const isSelected = pendingSelectedMetrics.includes(metric.key)
                      const isChartMetric = pendingChartMetric === metric.key
                      return (
                        <div
                          key={metric.key}
                          className={cn(
                            'flex items-start gap-4 p-4 rounded-lg transition-colors cursor-pointer',
                            'hover:bg-muted/50',
                            isSelected && 'bg-muted/30'
                          )}
                          onClick={() => toggleMetric(metric.key)}
                        >
                          <div className="flex-1 space-y-1 min-w-0">
                            <p className="text-sm font-semibold leading-tight">
                              {t(`salesSummary.controls.metrics.options.${metric.key}`)}
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {t(`salesSummary.controls.metrics.options.${metric.key}Desc`)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {/* Chart toggle - only for metrics that can be charted */}
                            {metric.hasChart && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  'h-8 w-8 cursor-pointer',
                                  isChartMetric && 'bg-foreground/10'
                                )}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (isSelected) setMetricAsChart(metric.key)
                                }}
                                disabled={!isSelected}
                              >
                                <BarChart3 className={cn(
                                  'w-4 h-4',
                                  isChartMetric ? 'text-foreground' : 'text-muted-foreground'
                                )} />
                              </Button>
                            )}
                            {/* Include checkbox */}
                            <Checkbox
                              checked={isSelected}
                              onClick={(e) => e.stopPropagation()}
                              className="cursor-pointer"
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
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

      {/* Control Pills (click to open control panel) - Square order */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => openControlPanel('metrics')}
          className="rounded-full h-8 px-3 text-xs font-medium border-border/60 hover:bg-muted/50 cursor-pointer"
        >
          <LayoutGrid className="w-3 h-3 mr-1.5" />
          <span className="text-muted-foreground mr-1">{t('salesSummary.controls.metrics.label')}</span>
          <span className="font-semibold">{selectedMetrics.length}</span>
        </Button>
        <ControlPill
          label={t('salesSummary.controls.reportType.label')}
          value={getSelectedLabel('reportType', reportType)}
          onClick={() => openControlPanel('reportType')}
        />
        <ControlPill
          label={t('salesSummary.controls.terminal.label')}
          value={getSelectedLabel('terminal', terminal)}
          onClick={() => openControlPanel('terminal')}
        />
        <ControlPill
          label={t('salesSummary.controls.viewType.label')}
          value={getSelectedLabel('viewType', viewType)}
          onClick={() => openControlPanel('viewType')}
        />
        <ControlPill
          label={t('salesSummary.controls.groupBy.label')}
          value={getSelectedLabel('groupBy', groupBy)}
          onClick={() => openControlPanel('groupBy')}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => openControlPanel('main')}
          className="rounded-full h-8 px-3 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <Filter className="w-3 h-3 mr-1" />
          {t('salesSummary.filters.more')}
        </Button>
      </div>

      {/* Big Number - Total Sales with Dynamic Visualization */}
      <GlassCard className="p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
            <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">{t('salesSummary.totalSales')}</p>
            <p className="text-4xl font-bold tracking-tight">{Currency(data.summary.totalCollected)}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {data.transactions.total} {t('salesSummary.transactions')}
            </p>
          </div>
        </div>

        {/* Dynamic visualization based on viewType */}
        {viewType === 'gauge' && (
          <SalesBreakdownBar
            segments={[
              {
                label: t('salesSummary.paymentTypes.card'),
                value: data.paymentMethods.card.amount,
                color: 'bg-blue-500',
                percentage: data.paymentMethods.card.percentage,
              },
              {
                label: t('salesSummary.paymentTypes.cash'),
                value: data.paymentMethods.cash.amount,
                color: 'bg-green-500',
                percentage: data.paymentMethods.cash.percentage,
              },
              {
                label: t('salesSummary.paymentTypes.other'),
                value: data.paymentMethods.other.amount,
                color: 'bg-orange-500',
                percentage: data.paymentMethods.other.percentage,
              },
            ]}
          />
        )}

        {viewType === 'pie' && (
          <SalesPieChart
            segments={[
              {
                label: t('salesSummary.paymentTypes.card'),
                value: data.paymentMethods.card.amount,
                color: 'bg-blue-500',
                percentage: data.paymentMethods.card.percentage,
              },
              {
                label: t('salesSummary.paymentTypes.cash'),
                value: data.paymentMethods.cash.amount,
                color: 'bg-green-500',
                percentage: data.paymentMethods.cash.percentage,
              },
              {
                label: t('salesSummary.paymentTypes.other'),
                value: data.paymentMethods.other.amount,
                color: 'bg-orange-500',
                percentage: data.paymentMethods.other.percentage,
              },
            ]}
          />
        )}

        {viewType === 'table' && (
          <SalesTable
            segments={[
              {
                label: t('salesSummary.paymentTypes.card'),
                value: data.paymentMethods.card.amount,
                color: 'bg-blue-500',
                percentage: data.paymentMethods.card.percentage,
              },
              {
                label: t('salesSummary.paymentTypes.cash'),
                value: data.paymentMethods.cash.amount,
                color: 'bg-green-500',
                percentage: data.paymentMethods.cash.percentage,
              },
              {
                label: t('salesSummary.paymentTypes.other'),
                value: data.paymentMethods.other.amount,
                color: 'bg-orange-500',
                percentage: data.paymentMethods.other.percentage,
              },
            ]}
            columns={{
              method: t('salesSummary.tableColumns.method'),
              amount: t('salesSummary.columns.amount'),
              percentage: t('salesSummary.tableColumns.percentage'),
            }}
          />
        )}
      </GlassCard>

      {/* Summary Section (Collapsible) - Only shown for summary report type */}
      {reportType === 'summary' && (
        <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
          <GlassCard>
            <CollapsibleTrigger asChild>
              <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                    <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">{t('salesSummary.sections.summary')}</h3>
                    <p className="text-xs text-muted-foreground">{t('salesSummary.sections.summaryDesc')}</p>
                  </div>
                </div>
                <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', summaryOpen && 'rotate-180')} />
              </div>
            </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-1">
              <div className="h-px bg-border/50 mb-3" />

              {/* Ventas brutas - Collapsible parent with children */}
              {selectedMetrics.includes('grossSales') && (
                <CollapsibleSummaryRow
                  label={t('salesSummary.rows.grossSales')}
                  value={data.summary.totalGross}
                  count={data.transactions.completed}
                  countLabel={t('salesSummary.transactionsLabel')}
                  type="positive"
                  tooltip={t('salesSummary.tooltips.grossSales')}
                  isOpen={grossSalesOpen}
                  onToggle={() => setGrossSalesOpen(!grossSalesOpen)}
                >
                  {selectedMetrics.includes('items') && (
                    <SummaryRow
                      label={t('salesSummary.rows.items')}
                      value={data.summary.items}
                      type="positive"
                      indent={1}
                      tooltip={t('salesSummary.tooltips.items')}
                    />
                  )}
                  {selectedMetrics.includes('serviceCosts') && (
                    <SummaryRow
                      label={t('salesSummary.rows.serviceCosts')}
                      value={data.summary.serviceCosts}
                      type="positive"
                      indent={1}
                      tooltip={t('salesSummary.tooltips.serviceCosts')}
                    />
                  )}
                </CollapsibleSummaryRow>
              )}

              {/* Devoluciones - Same level as Ventas brutas */}
              {selectedMetrics.includes('refunds') && (
                <SummaryRow
                  label={t('salesSummary.rows.refunds')}
                  value={-data.summary.refunds}
                  count={data.transactions.refunded > 0 ? data.transactions.refunded : undefined}
                  countLabel={t('salesSummary.transactionsLabel')}
                  type="negative"
                  tooltip={t('salesSummary.tooltips.refunds')}
                />
              )}

              {/* Descuentos - Collapsible parent (future: can have subcategories) */}
              {selectedMetrics.includes('discounts') && (
                <SummaryRow
                  label={t('salesSummary.rows.discounts')}
                  value={-data.summary.discounts}
                  type="negative"
                  tooltip={t('salesSummary.tooltips.discounts')}
                />
              )}

              {/* Ventas netas - Calculated total */}
              {selectedMetrics.includes('netSales') && (
                <>
                  <div className="h-px bg-border/30 mx-4 my-2" />
                  <SummaryRow
                    label={t('salesSummary.rows.netSales')}
                    value={data.summary.netSales}
                    type="neutral"
                    bold
                    tooltip={t('salesSummary.tooltips.netSales')}
                  />
                </>
              )}

              {/* Ventas diferidas */}
              {selectedMetrics.includes('deferredSales') && (
                <SummaryRow
                  label={t('salesSummary.rows.deferredSales')}
                  value={data.summary.deferredSales}
                  count={data.transactions.deferred > 0 ? data.transactions.deferred : undefined}
                  countLabel={t('salesSummary.transactionsLabel')}
                  type="neutral"
                  tooltip={t('salesSummary.tooltips.deferredSales')}
                />
              )}

              {/* Impuestos */}
              {selectedMetrics.includes('taxes') && (
                <SummaryRow
                  label={t('salesSummary.rows.taxes')}
                  value={data.summary.taxes}
                  type="neutral"
                  tooltip={t('salesSummary.tooltips.taxes')}
                />
              )}

              {/* Total de las ventas - Mexico model: taxes already included in prices */}
              {selectedMetrics.includes('totalCollected') && (
                <>
                  <div className="h-px bg-border/30 mx-4 my-2" />
                  <SummaryRow
                    label={t('salesSummary.rows.totalSales')}
                    value={data.summary.netSales}
                    count={data.transactions.completed}
                    countLabel={t('salesSummary.transactionsLabel')}
                    type="positive"
                    bold
                    tooltip={t('salesSummary.tooltips.totalSales')}
                  />
                </>
              )}

              {/* Propinas */}
              {selectedMetrics.includes('tips') && (
                <SummaryRow
                  label={t('salesSummary.rows.tips')}
                  value={data.summary.tips}
                  type="positive"
                  tooltip={t('salesSummary.tooltips.tips')}
                />
              )}

              {/* Comisiones de plataforma (Avoqado) */}
              {selectedMetrics.includes('platformFees') && (
                <SummaryRow
                  label={t('salesSummary.rows.platformFees')}
                  value={-data.summary.platformFees}
                  type="negative"
                  tooltip={t('salesSummary.tooltips.platformFees')}
                />
              )}

              {/* Comisiones a empleados */}
              {selectedMetrics.includes('staffCommissions') && (
                <SummaryRow
                  label={t('salesSummary.rows.staffCommissions')}
                  value={-data.summary.staffCommissions}
                  type="negative"
                  tooltip={t('salesSummary.tooltips.staffCommissions')}
                />
              )}

              {/* Total cobrado - Money received */}
              {selectedMetrics.includes('totalCollected') && (
                <>
                  <div className="h-px bg-border/30 mx-4 my-2" />
                  <SummaryRow
                    label={t('salesSummary.rows.totalCollected')}
                    value={data.summary.totalCollected}
                    type="positive"
                    bold
                    tooltip={t('salesSummary.tooltips.totalCollected')}
                  />
                </>
              )}

              {/* Ganancia neta - True profit after all costs */}
              {selectedMetrics.includes('netProfit') && (
                <>
                  <div className="h-px bg-border/50 mx-4 my-3" />
                  <SummaryRow
                    label={t('salesSummary.rows.netProfit')}
                    value={data.summary.netProfit}
                    type="positive"
                    bold
                    tooltip={t('salesSummary.tooltips.netProfit')}
                  />
                </>
              )}
            </div>
          </CollapsibleContent>
        </GlassCard>
      </Collapsible>
      )}

      {/* Period Breakdown Table - Only shown for time-based reports */}
      {reportType !== 'summary' && periodData && periodData.length > 0 && (
        <PeriodBreakdownTable
          periods={periodData}
          selectedMetrics={selectedMetrics}
          reportType={reportType}
          venueTimezone={venueTimezone}
        />
      )}

      {/* Payment Methods Section (Collapsible) */}
      <Collapsible open={paymentsOpen} onOpenChange={setPaymentsOpen}>
        <GlassCard>
          <CollapsibleTrigger asChild>
            <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
                  <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">{t('salesSummary.sections.paymentMethods')}</h3>
                  <p className="text-xs text-muted-foreground">{t('salesSummary.sections.paymentMethodsDesc')}</p>
                </div>
              </div>
              <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', paymentsOpen && 'rotate-180')} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-1">
              <div className="h-px bg-border/50 mb-3" />

              <PaymentMethodRow
                icon={<CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                label={t('salesSummary.paymentTypes.card')}
                amount={data.paymentMethods.card.amount}
                count={data.paymentMethods.card.count}
                percentage={data.paymentMethods.card.percentage}
              />
              <PaymentMethodRow
                icon={<Banknote className="w-4 h-4 text-green-600 dark:text-green-400" />}
                label={t('salesSummary.paymentTypes.cash')}
                amount={data.paymentMethods.cash.amount}
                count={data.paymentMethods.cash.count}
                percentage={data.paymentMethods.cash.percentage}
              />
              <PaymentMethodRow
                icon={<Smartphone className="w-4 h-4 text-orange-600 dark:text-orange-400" />}
                label={t('salesSummary.paymentTypes.other')}
                amount={data.paymentMethods.other.amount}
                count={data.paymentMethods.other.count}
                percentage={data.paymentMethods.other.percentage}
              />
            </div>
          </CollapsibleContent>
        </GlassCard>
      </Collapsible>
    </div>
  )
}
