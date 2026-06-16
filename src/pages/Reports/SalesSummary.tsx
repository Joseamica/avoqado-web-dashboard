import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { DateRangePicker } from '@/components/date-range-picker'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Currency } from '@/utils/currency'
import { getLast7Days, getToday } from '@/utils/datetime'
import { useAuth } from '@/context/AuthContext'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import {
  fetchSalesSummary,
  salesSummaryKeys,
  type ReportType,
  type GroupBy as ApiGroupBy,
  type PaymentMethodFilter,
  type CardTypeFilter,
  type PaymentMethodDetailedBreakdown,
  MINDFORM_VENUE_ID,
} from '@/services/reports/salesSummary.service'
import { getVenueMerchantAccountsByVenueId, getVenueSettlementInfo, type MerchantAccount } from '@/services/paymentProvider.service'
import { SalesSummaryExportDialog } from '@/pages/Reports/components/SalesSummaryExportDialog'
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
  Settings2,
  PieChart,
  Table2,
  BarChart3,
  LayoutGrid,
  Store,
  Clock,
  QrCode,
  Filter,
  X,
  Lock,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { PeriodBreakdownTable } from './components/PeriodBreakdownTable'
import { MerchantBreakdownPanel } from './MerchantBreakdownPanel'
import { MoneyLocationStrip } from './MoneyLocationStrip'
import { SettlementMiniCalendar } from './SettlementMiniCalendar'
import { FeatureGate } from '@/components/billing/FeatureGate'

// ============================================
// Payment Method Mapping
// ============================================
const _PAYMENT_METHOD_DISPLAY: Record<string, { key: 'card' | 'cash' | 'other'; color: string }> = {
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
  paymentMethodFilter?: PaymentMethodFilter | null
  cardTypeFilter?: CardTypeFilter | null
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
  settlementLabel?: string
}> = ({ icon, label, amount, count, percentage, settlementLabel }) => (
  <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-4 py-3 hover:bg-muted/30 rounded-lg transition-colors">
    <div className="p-2 rounded-lg bg-muted/50">{icon}</div>
    <div className="flex flex-col">
      <span className="text-sm font-medium">{label}</span>
      {settlementLabel && (
        <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
          <Clock className="w-3 h-3" />
          {settlementLabel}
        </span>
      )}
    </div>
    <span className="text-sm text-muted-foreground text-right">{count} trans.</span>
    <span className="text-sm text-muted-foreground text-right min-w-[50px]">{percentage.toFixed(1)}%</span>
    <span className="text-sm font-mono text-right min-w-[100px]">{Currency(amount)}</span>
  </div>
)

// ============================================
// DetailedBreakdownRow Component (enriched payment-method row with optional
// expandable card sub-types and platform commission line)
// ============================================
const DetailedBreakdownRow: React.FC<{
  icon: React.ReactNode
  label: string
  amount: number
  count: number
  percentage: number
  platformFees: number
  /** i18n labels resolved by the parent (component is module scope) */
  countLabel: string
  feesLabel: string
  settlementLabel?: string
  subBuckets?: PaymentMethodDetailedBreakdown['subBuckets']
  /** Map of sub-bucket type → translated label, e.g. { CREDIT: 'Crédito' } */
  subLabels?: Record<string, string>
}> = ({ icon, label, amount, count, percentage, platformFees, countLabel, feesLabel, settlementLabel, subBuckets, subLabels }) => {
  const [expanded, setExpanded] = useState(false)
  const hasSubBuckets = !!subBuckets && subBuckets.length > 0

  return (
    <div>
      <div
        className={cn(
          'grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-4 py-3 rounded-lg transition-colors hover:bg-muted/30',
          hasSubBuckets && 'cursor-pointer',
        )}
        onClick={hasSubBuckets ? () => setExpanded(v => !v) : undefined}
      >
        <div className="flex items-center gap-2">
          {hasSubBuckets ? (
            <ChevronDown
              className={cn('w-4 h-4 text-muted-foreground transition-transform shrink-0', !expanded && '-rotate-90')}
            />
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <div className="p-2 rounded-lg bg-muted/50">{icon}</div>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium">{label}</span>
          {settlementLabel && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              {settlementLabel}
            </span>
          )}
          {platformFees > 0 && (
            <span className="text-[11px] text-muted-foreground mt-0.5">
              {feesLabel}: {Currency(platformFees)}
            </span>
          )}
        </div>
        <span className="text-sm text-muted-foreground text-right">{count} {countLabel}</span>
        <span className="text-sm text-muted-foreground text-right min-w-[50px]">{percentage.toFixed(1)}%</span>
        <span className="text-sm font-mono text-right min-w-[100px]">{Currency(amount)}</span>
      </div>

      {hasSubBuckets && expanded && (
        <div className="mt-1 space-y-0.5">
          {subBuckets!.map(sub => (
            <div
              key={sub.type}
              className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 py-2 pl-14 pr-4 rounded-lg transition-colors hover:bg-muted/20"
            >
              <span className="w-4 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-sm">{subLabels?.[sub.type] ?? sub.type}</span>
                {sub.platformFees > 0 && (
                  <span className="text-[11px] text-muted-foreground mt-0.5">
                    {feesLabel}: {Currency(sub.platformFees)}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground text-right">{sub.count} {countLabel}</span>
              <span className="text-xs text-muted-foreground text-right min-w-[50px]">{sub.percentage.toFixed(1)}%</span>
              <span className="text-sm font-mono text-right min-w-[100px]">{Currency(sub.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

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
  const { venueId, fullBasePath } = useCurrentVenue()
  const { activeVenue } = useAuth()
  const venueTimezone = activeVenue?.timezone || 'America/Mexico_City'

  // Tier gate: Free venues get a BASIC report (today's summary only). Pro+ unlocks
  // history (other date ranges / past periods) and the advanced breakdowns. The
  // sales-summary API is NOT feature-gated server-side (only `reports:read`), so a
  // Free venue's request still returns data — this is a pure FRONTEND gate.
  const { hasAccess } = useTierFeatureAccess('ADVANCED_REPORTS')

  // Date range state - Pro defaults to last 7 days; Free is locked to today.
  const todayRange = useMemo(() => getToday(venueTimezone), [venueTimezone])
  const defaultDateRange = useMemo(
    () => (hasAccess ? getLast7Days(venueTimezone) : todayRange),
    [hasAccess, venueTimezone, todayRange],
  )
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: defaultDateRange.from,
    to: defaultDateRange.to,
  })

  // When tier access resolves (e.g. plan query lands after first render), keep a Free
  // venue pinned to "today" — never leave it showing a stale multi-day range.
  useEffect(() => {
    if (!hasAccess) {
      setDateRange(prev => {
        if (prev.from.getTime() === todayRange.from.getTime() && prev.to.getTime() === todayRange.to.getTime()) {
          return prev
        }
        return { from: todayRange.from, to: todayRange.to }
      })
    }
  }, [hasAccess, todayRange])


  // State for collapsible sections
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [paymentsOpen, setPaymentsOpen] = useState(true)

  // State for collapsible summary rows (Square-style hierarchy)
  const [grossSalesOpen, setGrossSalesOpen] = useState(true)
  const [_discountsOpen, _setDiscountsOpen] = useState(true)

  // State for export sheet
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

  // State for controls drawer
  const [controlsOpen, setControlsOpen] = useState(false)
  const [activePanel, setActivePanel] = useState<'main' | 'reportType' | 'viewType' | 'groupBy' | 'terminal' | 'metrics' | 'merchant' | 'filterBy' | null>('main')

  // Load saved preferences from localStorage
  const savedPrefs = useMemo(() => loadPreferences(), [])

  // Applied control values (what's actually shown in the report)
  const [reportType, setReportType] = useState<ReportType>(() => (savedPrefs?.reportType as ReportType) || 'summary')
  // Free venues never reach the report-type control (it's Pro-only), so a saved
  // increment preference must not leak the period-breakdown view. Force "summary".
  const effectiveReportType: ReportType = hasAccess ? reportType : 'summary'
  const [viewType, setViewType] = useState(() => savedPrefs?.viewType || 'gauge')
  const [groupBy, setGroupBy] = useState(() => savedPrefs?.groupBy || 'none')
  const [terminal, setTerminal] = useState('all')
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(
    () => savedPrefs?.selectedMetrics || DEFAULT_SELECTED_METRICS
  )
  const [chartMetric, setChartMetric] = useState<MetricKey>(
    () => savedPrefs?.chartMetric || DEFAULT_CHART_METRIC
  )

  // Merchant filter state
  const [merchantAccountId, setMerchantAccountId] = useState<string | null>(null)
  const [pendingMerchantAccountId, setPendingMerchantAccountId] = useState<string | null>(null)

  // Payment method / card type filter state
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethodFilter | null>(
    () => savedPrefs?.paymentMethodFilter ?? null,
  )
  const [cardTypeFilter, setCardTypeFilter] = useState<CardTypeFilter | null>(
    () => savedPrefs?.cardTypeFilter ?? null,
  )
  const [pendingPaymentMethodFilter, setPendingPaymentMethodFilter] = useState<PaymentMethodFilter | null>(null)
  const [pendingCardTypeFilter, setPendingCardTypeFilter] = useState<CardTypeFilter | null>(null)

  const isFiltered = paymentMethodFilter !== null
  const isMindform = venueId === MINDFORM_VENUE_ID

  // Fetch venue merchant accounts
  const { data: merchantAccounts = [] } = useQuery({
    queryKey: ['venueMerchantAccounts', venueId],
    queryFn: () => getVenueMerchantAccountsByVenueId(venueId),
    staleTime: 1000 * 60 * 30,
  })

  const { data: settlementConfigs = [] } = useQuery({
    queryKey: ['venueSettlementInfo', venueId],
    queryFn: () => getVenueSettlementInfo(venueId),
    staleTime: 1000 * 60 * 30,
  })

  const settlementLabels = useMemo(() => {
    if (settlementConfigs.length === 0) return { card: undefined, cash: undefined, other: undefined, debitDays: 1, amexDays: 3 }

    const formatDays = (days: number) =>
      days <= 1
        ? t('salesSummary.settlement.businessDay', { count: days })
        : t('salesSummary.settlement.businessDays', { count: days })

    const debit = settlementConfigs.find(s => s.cardType === 'DEBIT')
    const credit = settlementConfigs.find(s => s.cardType === 'CREDIT')
    const amex = settlementConfigs.find(s => s.cardType === 'AMEX')
    const intl = settlementConfigs.find(s => s.cardType === 'INTERNATIONAL')

    const debitDays = debit?.settlementDays ?? 1
    const creditDays = credit?.settlementDays ?? 1
    const amexDays = amex?.settlementDays ?? 3

    const cardMax = Math.max(debitDays, creditDays)
    const cardParts: string[] = []
    if (debitDays === creditDays) {
      cardParts.push(formatDays(debitDays))
    } else {
      cardParts.push(`${t('salesSummary.settlement.label')}: ${formatDays(debitDays)} (débito), ${formatDays(creditDays)} (crédito)`)
    }
    if (amex && amexDays !== cardMax) {
      cardParts.push(`Amex ${formatDays(amexDays)}`)
    }

    return {
      card: `${t('salesSummary.settlement.label')}: ${cardParts.join(' · ')}`,
      cash: `${t('salesSummary.settlement.label')}: ${t('salesSummary.settlement.immediate')}`,
      other: undefined,
      debitDays,
      amexDays,
    }
  }, [settlementConfigs, t])

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
      paymentMethodFilter,
      cardTypeFilter,
    })
  }, [selectedMetrics, chartMetric, viewType, reportType, groupBy, paymentMethodFilter, cardTypeFilter])

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
  const hasMerchantChange = pendingMerchantAccountId !== merchantAccountId
  const hasFilterByChange =
    pendingPaymentMethodFilter !== paymentMethodFilter || pendingCardTypeFilter !== cardTypeFilter

  // Open sheet and navigate to specific panel, initialize pending with current value
  const openControlPanel = (panel: 'main' | 'reportType' | 'viewType' | 'groupBy' | 'terminal' | 'metrics' | 'merchant' | 'filterBy') => {
    // Initialize pending values with current values when opening
    setPendingReportType(reportType)
    setPendingViewType(viewType)
    setPendingGroupBy(groupBy)
    setPendingTerminal(terminal)
    setPendingSelectedMetrics([...selectedMetrics])
    setPendingChartMetric(chartMetric)
    setPendingMerchantAccountId(merchantAccountId)
    setPendingPaymentMethodFilter(paymentMethodFilter)
    setPendingCardTypeFilter(cardTypeFilter)
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

  const applyMerchant = () => {
    setMerchantAccountId(pendingMerchantAccountId)
    setControlsOpen(false)
    setActivePanel('main')
  }

  const applyFilterBy = () => {
    setPaymentMethodFilter(pendingPaymentMethodFilter)
    // Drop the card sub-filter when the method isn't CARD anymore
    setCardTypeFilter(pendingPaymentMethodFilter === 'CARD' ? pendingCardTypeFilter : null)
    setControlsOpen(false)
    setActivePanel('main')
  }

  const clearFilterBy = () => {
    setPaymentMethodFilter(null)
    setCardTypeFilter(null)
  }

  // Map a payment-method enum value to its i18n option key (camelCase in JSON).
  const PAYMENT_METHOD_OPTION_KEY: Record<PaymentMethodFilter, string> = {
    CASH: 'cash',
    CARD: 'card',
    QR_LEGACY: 'qrLegacy',
    OTHER: 'other',
  }

  // Short label shown on the pill / row / badge for the active filter.
  const filterByValueLabel = () => {
    if (paymentMethodFilter === null) return t('salesSummary.controls.filterBy.none')
    if (paymentMethodFilter === 'CARD' && cardTypeFilter) {
      return t(`salesSummary.controls.filterBy.cardType.options.${cardTypeFilter.toLowerCase()}`)
    }
    return t(`salesSummary.controls.filterBy.paymentMethod.options.${PAYMENT_METHOD_OPTION_KEY[paymentMethodFilter]}`)
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

  // Build API filters
  // Always request paymentMethod grouping for the top chart visualization
  // Free venues are hard-pinned to today's summary: ignore any saved range / report
  // type / filters so the query can only ever return today's basic numbers.
  const apiFilters = useMemo(() => {
    const fromIso = hasAccess ? dateRange.from.toISOString() : todayRange.from.toISOString()
    const toIso = hasAccess ? dateRange.to.toISOString() : todayRange.to.toISOString()
    return {
      venueId,
      startDate: fromIso,
      endDate: toIso,
      groupBy: 'paymentMethod' as ApiGroupBy,
      reportType: effectiveReportType,
      ...(hasAccess && merchantAccountId ? { merchantAccountId } : {}),
      ...(hasAccess && paymentMethodFilter ? { paymentMethod: paymentMethodFilter } : {}),
      ...(hasAccess && paymentMethodFilter === 'CARD' && cardTypeFilter ? { cardType: cardTypeFilter } : {}),
      // Always request the per-merchant card breakdown + settlement projection for
      // the reconciliation view (both additive / opt-in on the backend).
      includeMerchantBreakdown: true,
      includeSettlementProjection: true,
    }
  }, [venueId, hasAccess, dateRange.from, dateRange.to, todayRange.from, todayRange.to, effectiveReportType, merchantAccountId, paymentMethodFilter, cardTypeFilter])

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

  // Per-merchant reconciliation (Entrega 1): the breakdown + the inputs for the
  // "¿Dónde está tu dinero?" strip. All derived from the additive API fields.
  const merchantBreakdown = useMemo(() => apiResponse?.byMerchantAccount ?? [], [apiResponse])
  const cashInHand = useMemo(
    () => apiResponse?.byPaymentMethodDetailed?.find(b => b.bucket === 'CASH')?.amount ?? 0,
    [apiResponse],
  )
  const cardNetToReceive = useMemo(() => merchantBreakdown.reduce((s, m) => s + m.netToReceive, 0), [merchantBreakdown])
  const commissionsPaid = useMemo(() => merchantBreakdown.reduce((s, m) => s + m.platformFee, 0), [merchantBreakdown])

  // Settlement projection (Entrega 2): the per-day "¿cuándo cae?" calendar. The
  // settled-vs-incoming split lives inside the calendar (it can only project
  // payments with a settlement rule), so it is deliberately kept out of the
  // money-location strip to avoid under-reporting unprojectable card money.
  const settlementCalendar = useMemo(() => apiResponse?.settlementCalendar ?? [], [apiResponse])

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
    if (!apiResponse?.byPeriod || effectiveReportType === 'summary') {
      return null
    }
    return apiResponse.byPeriod
  }, [apiResponse?.byPeriod, effectiveReportType])

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
        <div className="flex items-center gap-3 flex-wrap">
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
          {/* Free venues: make it obvious this is "today only" + where the rest lives. */}
          {!hasAccess && (
            <Badge variant="secondary" className="text-xs font-normal gap-1">
              {t('salesSummary.basic.todayBadge')}
            </Badge>
          )}
          {isFiltered && (
            <Badge variant="outline" className="text-xs font-normal gap-1 pl-2 pr-1 py-0.5">
              {t('salesSummary.controls.filterBy.active')}: {filterByValueLabel()}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-0.5 cursor-pointer"
                onClick={clearFilterBy}
                aria-label={t('salesSummary.controls.filterBy.clear')}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          )}
        </div>
        {/* Export + advanced controls (report type, group by, filters, metrics) are
            Pro-only — Free has nothing to configure on a single-day basic view. */}
        {hasAccess && (
        <div className="flex items-center gap-2">
          {/* Export trigger — opens the rich export dialog */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 cursor-pointer"
            data-tour="sales-summary-export"
            onClick={() => setExportDialogOpen(true)}
            aria-label={t('salesSummary.export.title')}
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
                  {merchantAccounts.length > 1 && (
                    <>
                      <ControlRow
                        label={t('salesSummary.controls.merchant.label')}
                        description={t('salesSummary.controls.merchant.description')}
                        value={merchantAccountId
                          ? merchantAccounts.find(m => m.id === merchantAccountId)?.displayName
                            || merchantAccounts.find(m => m.id === merchantAccountId)?.provider.name
                            || t('salesSummary.controls.merchant.options.all')
                          : t('salesSummary.controls.merchant.options.all')
                        }
                        onClick={() => setActivePanel('merchant')}
                      />
                      <Separator />
                    </>
                  )}
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
                    value={filterByValueLabel()}
                    onClick={() => setActivePanel('filterBy')}
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

              {/* Merchant Sub-Panel */}
              <div
                className={cn(
                  'absolute inset-0 transition-transform duration-300 ease-in-out bg-background flex flex-col',
                  activePanel === 'merchant' ? 'translate-x-0' : 'translate-x-full'
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
                    disabled={!hasMerchantChange}
                    onClick={applyMerchant}
                  >
                    {t('salesSummary.controls.apply')}
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="space-y-3">
                    <h2 className="text-2xl font-bold">{t('salesSummary.controls.merchant.label')}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t('salesSummary.controls.merchant.longDescription')}
                    </p>
                  </div>
                  <RadioGroup
                    value={pendingMerchantAccountId || 'all'}
                    onValueChange={(v) => setPendingMerchantAccountId(v === 'all' ? null : v)}
                    className="space-y-1"
                  >
                    <ControlOption
                      value="all"
                      label={t('salesSummary.controls.merchant.options.all')}
                      description={t('salesSummary.controls.merchant.options.allDesc')}
                      isSelected={pendingMerchantAccountId === null}
                      icon={<Store className="w-4 h-4 text-muted-foreground" />}
                    />
                    {merchantAccounts.map((account) => {
                      const accountLabel = account.displayName
                        || account.alias
                        || account.angelpayMerchantName
                        || account.provider.name
                      const accountDesc = [
                        account.provider.name,
                        account.angelpayAffiliation && `${t('salesSummary.controls.merchant.affiliation')}: ${account.angelpayAffiliation}`,
                        (account as MerchantAccount & { accountType: string }).accountType &&
                          t(`salesSummary.controls.merchant.${(account as MerchantAccount & { accountType: string }).accountType.toLowerCase()}`),
                      ].filter(Boolean).join(' · ')

                      return (
                        <ControlOption
                          key={account.id}
                          value={account.id}
                          label={accountLabel}
                          description={accountDesc}
                          isSelected={pendingMerchantAccountId === account.id}
                          icon={<Store className="w-4 h-4 text-muted-foreground" />}
                        />
                      )
                    })}
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

              {/* Filter By Sub-Panel (2-level: payment method → card type) */}
              <div
                className={cn(
                  'absolute inset-0 transition-transform duration-300 ease-in-out bg-background flex flex-col',
                  activePanel === 'filterBy' ? 'translate-x-0' : 'translate-x-full'
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
                    disabled={!hasFilterByChange}
                    onClick={applyFilterBy}
                  >
                    {t('salesSummary.controls.apply')}
                  </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Title and description */}
                  <div className="space-y-3">
                    <h2 className="text-2xl font-bold">{t('salesSummary.controls.filterBy.label')}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t('salesSummary.controls.filterBy.longDescription')}
                    </p>
                  </div>

                  {/* Level 1: Payment Method */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      {t('salesSummary.controls.filterBy.paymentMethod.label')}
                    </h3>
                    <RadioGroup
                      value={pendingPaymentMethodFilter ? pendingPaymentMethodFilter.toLowerCase() : 'all'}
                      onValueChange={(v) => {
                        const next = v === 'all' ? null : (v.toUpperCase() as PaymentMethodFilter)
                        setPendingPaymentMethodFilter(next)
                        if (next !== 'CARD') setPendingCardTypeFilter(null)
                      }}
                      className="space-y-1"
                    >
                      <ControlOption
                        value="all"
                        label={t('salesSummary.controls.filterBy.paymentMethod.options.all')}
                        description={t('salesSummary.controls.filterBy.paymentMethod.options.allDesc')}
                        isSelected={pendingPaymentMethodFilter === null}
                      />
                      <ControlOption
                        value="cash"
                        label={t('salesSummary.controls.filterBy.paymentMethod.options.cash')}
                        description={t('salesSummary.controls.filterBy.paymentMethod.options.cashDesc')}
                        isSelected={pendingPaymentMethodFilter === 'CASH'}
                        icon={<Banknote className="w-4 h-4 text-muted-foreground" />}
                      />
                      <ControlOption
                        value="card"
                        label={t('salesSummary.controls.filterBy.paymentMethod.options.card')}
                        description={t('salesSummary.controls.filterBy.paymentMethod.options.cardDesc')}
                        isSelected={pendingPaymentMethodFilter === 'CARD'}
                        icon={<CreditCard className="w-4 h-4 text-muted-foreground" />}
                      />
                      {isMindform && (
                        <ControlOption
                          value="qr_legacy"
                          label={t('salesSummary.controls.filterBy.paymentMethod.options.qrLegacy')}
                          description={t('salesSummary.controls.filterBy.paymentMethod.options.qrLegacyDesc')}
                          isSelected={pendingPaymentMethodFilter === 'QR_LEGACY'}
                          icon={<QrCode className="w-4 h-4 text-muted-foreground" />}
                        />
                      )}
                      <ControlOption
                        value="other"
                        label={t('salesSummary.controls.filterBy.paymentMethod.options.other')}
                        description={t('salesSummary.controls.filterBy.paymentMethod.options.otherDesc')}
                        isSelected={pendingPaymentMethodFilter === 'OTHER'}
                        icon={<Smartphone className="w-4 h-4 text-muted-foreground" />}
                      />
                    </RadioGroup>
                  </div>

                  {/* Level 2: Card Type — only when CARD selected */}
                  {pendingPaymentMethodFilter === 'CARD' && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        {t('salesSummary.controls.filterBy.cardType.label')}
                      </h3>
                      <RadioGroup
                        value={pendingCardTypeFilter ? pendingCardTypeFilter.toLowerCase() : 'all'}
                        onValueChange={(v) => setPendingCardTypeFilter(v === 'all' ? null : (v.toUpperCase() as CardTypeFilter))}
                        className="space-y-1"
                      >
                        <ControlOption
                          value="all"
                          label={t('salesSummary.controls.filterBy.cardType.options.all')}
                          description={t('salesSummary.controls.filterBy.cardType.options.allDesc')}
                          isSelected={pendingCardTypeFilter === null}
                        />
                        <ControlOption
                          value="credit"
                          label={t('salesSummary.controls.filterBy.cardType.options.credit')}
                          description={t('salesSummary.controls.filterBy.cardType.options.creditDesc')}
                          isSelected={pendingCardTypeFilter === 'CREDIT'}
                        />
                        <ControlOption
                          value="debit"
                          label={t('salesSummary.controls.filterBy.cardType.options.debit')}
                          description={t('salesSummary.controls.filterBy.cardType.options.debitDesc')}
                          isSelected={pendingCardTypeFilter === 'DEBIT'}
                        />
                        <ControlOption
                          value="amex"
                          label={t('salesSummary.controls.filterBy.cardType.options.amex')}
                          description={t('salesSummary.controls.filterBy.cardType.options.amexDesc')}
                          isSelected={pendingCardTypeFilter === 'AMEX'}
                        />
                        <ControlOption
                          value="international"
                          label={t('salesSummary.controls.filterBy.cardType.options.international')}
                          description={t('salesSummary.controls.filterBy.cardType.options.internationalDesc')}
                          isSelected={pendingCardTypeFilter === 'INTERNATIONAL'}
                        />
                      </RadioGroup>
                    </div>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        )}
      </div>

      {/* Rich export dialog — backend-driven export so numbers match the on-screen report.
          Seeded from the page's current filter state; the user can adjust inside. */}
      {hasAccess && (
        <SalesSummaryExportDialog
          open={exportDialogOpen}
          onClose={() => setExportDialogOpen(false)}
          venueId={venueId}
          initialDateFrom={dateRange.from}
          initialDateTo={dateRange.to}
          initialPaymentMethod={paymentMethodFilter}
          initialCardType={cardTypeFilter}
          initialMerchantAccountId={merchantAccountId}
          merchantAccounts={merchantAccounts}
          estimatedCount={apiResponse?.summary?.transactionCount ?? undefined}
        />
      )}

      {/* Date Range Picker — Pro can pick any range; Free is locked to "Hoy" with an
          inline upsell to history. */}
      {hasAccess ? (
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
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {/* Disabled "Hoy" pill — looks like the picker but can't be opened. */}
          <Button
            type="button"
            variant="outline"
            disabled
            aria-disabled
            className="h-9 gap-2 rounded-lg opacity-100 disabled:opacity-100 cursor-not-allowed"
          >
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">{t('salesSummary.basic.today')}</span>
          </Button>
          <span className="text-xs text-muted-foreground">
            {t('salesSummary.basic.historyLocked')}{' '}
            <Link
              to={`${fullBasePath}/settings/billing/subscriptions`}
              className="font-medium text-foreground underline underline-offset-2 hover:text-foreground/80"
            >
              {t('salesSummary.basic.historyCta')}
            </Link>
          </span>
        </div>
      )}

      {/* Control Pills (click to open control panel) - Square order. Pro-only:
          report type, group by, filters, metrics are all advanced. */}
      {hasAccess && (
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
        {merchantAccounts.length > 1 && (
          <ControlPill
            label={t('salesSummary.controls.merchant.label')}
            value={merchantAccountId
              ? merchantAccounts.find(m => m.id === merchantAccountId)?.displayName
                || merchantAccounts.find(m => m.id === merchantAccountId)?.alias
                || merchantAccounts.find(m => m.id === merchantAccountId)?.provider.name
                || t('salesSummary.controls.merchant.options.all')
              : t('salesSummary.controls.merchant.options.all')
            }
            onClick={() => openControlPanel('merchant')}
          />
        )}
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
        <ControlPill
          label={t('salesSummary.controls.filterBy.label')}
          value={filterByValueLabel()}
          onClick={() => openControlPanel('filterBy')}
        />
      </div>
      )}

      {/* Big Number - Total Sales with Dynamic Visualization (FREE: today's headline) */}
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

        {/* Dynamic visualization based on viewType — hidden under a payment
            filter (the distribution would be a tautological 100% of the
            filtered method). */}
        {!isFiltered && viewType === 'gauge' && (
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

        {!isFiltered && viewType === 'pie' && (
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

        {!isFiltered && viewType === 'table' && (
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

        {/* Under a payment filter the distribution chart is meaningless — show a hint instead. */}
        {isFiltered && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Filter className="w-4 h-4 shrink-0" />
            <span>{t('salesSummary.controls.filterBy.filteredMessage')}</span>
          </div>
        )}
      </GlassCard>

      {/* Summary Section (Collapsible) - Only shown for summary report type.
          FREE: this is the basic "today's totals" breakdown and stays visible. */}
      {effectiveReportType === 'summary' && (
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

              {/* Ventas brutas - Collapsible parent with children.
                  Order-derived → hidden under a payment filter (can't be split per method). */}
              {!isFiltered && selectedMetrics.includes('grossSales') && (
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

              {/* Descuentos - order-derived → hidden under filter */}
              {!isFiltered && selectedMetrics.includes('discounts') && (
                <SummaryRow
                  label={t('salesSummary.rows.discounts')}
                  value={-data.summary.discounts}
                  type="negative"
                  tooltip={t('salesSummary.tooltips.discounts')}
                />
              )}

              {/* Ventas netas - order-derived → hidden under filter */}
              {!isFiltered && selectedMetrics.includes('netSales') && (
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

              {/* Ventas diferidas - order-derived → hidden under filter */}
              {!isFiltered && selectedMetrics.includes('deferredSales') && (
                <SummaryRow
                  label={t('salesSummary.rows.deferredSales')}
                  value={data.summary.deferredSales}
                  count={data.transactions.deferred > 0 ? data.transactions.deferred : undefined}
                  countLabel={t('salesSummary.transactionsLabel')}
                  type="neutral"
                  tooltip={t('salesSummary.tooltips.deferredSales')}
                />
              )}

              {/* Impuestos - order-derived → hidden under filter */}
              {!isFiltered && selectedMetrics.includes('taxes') && (
                <SummaryRow
                  label={t('salesSummary.rows.taxes')}
                  value={data.summary.taxes}
                  type="neutral"
                  tooltip={t('salesSummary.tooltips.taxes')}
                />
              )}

              {/* Total de las ventas - Mexico model: taxes already included in prices.
                  netSales-based → order-derived, hidden under filter. */}
              {!isFiltered && selectedMetrics.includes('totalCollected') && (
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
                    tooltip={
                      settlementConfigs.length > 0
                        ? `${t('salesSummary.tooltips.totalCollected')}. ${t('salesSummary.tooltips.totalCollectedSettlement', { debitDays: settlementLabels.debitDays, amexDays: settlementLabels.amexDays })}`
                        : t('salesSummary.tooltips.totalCollected')
                    }
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

              {/* Order-level metrics (gross sales, taxes, discounts…) are hidden
                  under a payment filter — they can't be attributed per method. */}
              {isFiltered && (
                <p className="px-4 pt-3 text-xs italic text-muted-foreground">
                  {t('salesSummary.controls.filterBy.hiddenMetricsMessage')}
                </p>
              )}
            </div>
          </CollapsibleContent>
        </GlassCard>
      </Collapsible>
      )}

      {/* Per-merchant reconciliation (Entrega 1): "¿Dónde está tu dinero?" + the
          per-merchant card breakdown. Advanced analysis → Pro-only. Hidden under a
          payment filter. */}
      {hasAccess && merchantBreakdown.length > 0 && !isFiltered && (
        <div className="space-y-4">
          <MoneyLocationStrip
            cashInHand={cashInHand}
            cardNetToReceive={cardNetToReceive}
            commissionsPaid={commissionsPaid}
            formatCurrency={Currency}
          />
          <MerchantBreakdownPanel items={merchantBreakdown} formatCurrency={Currency} venueTimezone={venueTimezone} />
          <SettlementMiniCalendar days={settlementCalendar} formatCurrency={Currency} />
        </div>
      )}

      {/* Period Breakdown Table - Only shown for time-based reports (Pro-only:
          effectiveReportType is forced to 'summary' for Free). */}
      {hasAccess && effectiveReportType !== 'summary' && periodData && periodData.length > 0 && (
        <PeriodBreakdownTable
          periods={periodData}
          selectedMetrics={selectedMetrics}
          reportType={effectiveReportType}
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

              {isFiltered ? (
                // Under a payment filter the distribution is a single-method 100% — show a hint.
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                  <Filter className="w-4 h-4 shrink-0" />
                  <span>{t('salesSummary.controls.filterBy.filteredMessage')}</span>
                </div>
              ) : apiResponse?.byPaymentMethodDetailed && apiResponse.byPaymentMethodDetailed.length > 0 ? (
                // Enriched breakdown: Card expands to Credit/Debit/AMEX/International with commission.
                apiResponse.byPaymentMethodDetailed.map(bucket => {
                  const bucketConfig: Record<
                    PaymentMethodDetailedBreakdown['bucket'],
                    { icon: React.ReactNode; label: string; settlementLabel?: string }
                  > = {
                    CARD: {
                      icon: <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
                      label: t('salesSummary.paymentTypes.card'),
                      settlementLabel: settlementLabels.card,
                    },
                    CASH: {
                      icon: <Banknote className="w-4 h-4 text-green-600 dark:text-green-400" />,
                      label: t('salesSummary.paymentTypes.cash'),
                      settlementLabel: settlementLabels.cash,
                    },
                    OTHER: {
                      icon: <Smartphone className="w-4 h-4 text-orange-600 dark:text-orange-400" />,
                      label: t('salesSummary.paymentTypes.other'),
                    },
                    QR_LEGACY: {
                      icon: <QrCode className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
                      label: t('salesSummary.controls.filterBy.paymentMethod.options.qrLegacy'),
                    },
                  }
                  const cfg = bucketConfig[bucket.bucket]
                  return (
                    <DetailedBreakdownRow
                      key={bucket.bucket}
                      icon={cfg.icon}
                      label={cfg.label}
                      amount={bucket.amount}
                      count={bucket.count}
                      percentage={bucket.percentage}
                      platformFees={bucket.platformFees}
                      countLabel={t('salesSummary.transactionsShort')}
                      feesLabel={t('salesSummary.rows.platformFees')}
                      settlementLabel={cfg.settlementLabel}
                      subBuckets={bucket.subBuckets}
                      subLabels={{
                        CREDIT: t('salesSummary.controls.filterBy.cardType.options.credit'),
                        DEBIT: t('salesSummary.controls.filterBy.cardType.options.debit'),
                        AMEX: t('salesSummary.controls.filterBy.cardType.options.amex'),
                        INTERNATIONAL: t('salesSummary.controls.filterBy.cardType.options.international'),
                      }}
                    />
                  )
                })
              ) : (
                // Fallback flat layout (e.g. groupBy != paymentMethod or no detailed data).
                <>
                  <PaymentMethodRow
                    icon={<CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                    label={t('salesSummary.paymentTypes.card')}
                    amount={data.paymentMethods.card.amount}
                    count={data.paymentMethods.card.count}
                    percentage={data.paymentMethods.card.percentage}
                    settlementLabel={settlementLabels.card}
                  />
                  <PaymentMethodRow
                    icon={<Banknote className="w-4 h-4 text-green-600 dark:text-green-400" />}
                    label={t('salesSummary.paymentTypes.cash')}
                    amount={data.paymentMethods.cash.amount}
                    count={data.paymentMethods.cash.count}
                    percentage={data.paymentMethods.cash.percentage}
                    settlementLabel={settlementLabels.cash}
                  />
                  <PaymentMethodRow
                    icon={<Smartphone className="w-4 h-4 text-orange-600 dark:text-orange-400" />}
                    label={t('salesSummary.paymentTypes.other')}
                    amount={data.paymentMethods.other.amount}
                    count={data.paymentMethods.other.count}
                    percentage={data.paymentMethods.other.percentage}
                  />
                </>
              )}
            </div>
          </CollapsibleContent>
        </GlassCard>
      </Collapsible>

      {/* FREE upsell: history + advanced reporting are Pro. Inline FeatureGate
          renders a blurred teaser of what Pro unlocks (it's already a paywall card
          for non-Pro venues, and a no-op pass-through for Pro). */}
      {!hasAccess && (
        <FeatureGate feature="ADVANCED_REPORTS">
          <div className="rounded-2xl border border-input bg-card p-6 space-y-4">
            <h3 className="text-lg font-semibold">{t('salesSummary.basic.upsell.title')}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• {t('salesSummary.basic.upsell.history')}</li>
              <li>• {t('salesSummary.basic.upsell.periods')}</li>
              <li>• {t('salesSummary.basic.upsell.breakdowns')}</li>
              <li>• {t('salesSummary.basic.upsell.export')}</li>
            </ul>
          </div>
        </FeatureGate>
      )}
    </div>
  )
}
