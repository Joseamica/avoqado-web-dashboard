import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useVenueDateTime } from '@/utils/datetime'
import { Currency } from '@/utils/currency'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  MoreHorizontal,
  TrendingUp,
  CreditCard,
  Banknote,
  Smartphone,
  Receipt,
  DollarSign,
  Minus,
  Calendar,
  Filter,
} from 'lucide-react'

// ============================================
// MOCK DATA - Replace with real API call later
// ============================================
const MOCK_SALES_DATA = {
  summary: {
    totalGross: 15750.00,
    discounts: 450.00,
    refunds: 125.50,
    netSales: 15174.50,
    taxes: 2426.32,
    tips: 890.00,
    totalCollected: 18490.82,
  },
  transactions: {
    total: 127,
    completed: 118,
    refunded: 5,
    voided: 4,
  },
  paymentMethods: {
    card: { amount: 12500.00, count: 85, percentage: 79.4 },
    cash: { amount: 2150.00, count: 32, percentage: 13.7 },
    other: { amount: 524.50, count: 10, percentage: 3.3 },
  },
  // For date display
  periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  periodEnd: new Date().toISOString(),
}

// Filter pill options (like Square)
const FILTER_OPTIONS = {
  metrics: ['Total ventas', 'Ventas netas', 'Impuestos', 'Propinas'],
  reportType: ['Resumen', 'Detallado', 'Por hora'],
  location: ['Todas las ubicaciones', 'Solo esta sucursal'],
}

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
  return <span className={cn('inline-block w-2 h-2 rounded-sm mr-2', colors[type])} />
}

// ============================================
// FilterPill Component (Square-style)
// ============================================
const FilterPill: React.FC<{
  label: string
  value: string
  options: string[]
  onChange?: (value: string) => void
}> = ({ label, value, options, onChange }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full h-8 px-3 text-xs font-medium border-border/60 hover:bg-muted/50"
        >
          <span className="text-muted-foreground mr-1">{label}:</span>
          <span>{value}</span>
          <ChevronDown className="w-3 h-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map((option) => (
          <DropdownMenuItem key={option} onClick={() => onChange?.(option)}>
            {option}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ============================================
// SummaryRow Component (Square-style collapsible rows)
// ============================================
const SummaryRow: React.FC<{
  label: string
  value: number
  count?: number
  type: 'positive' | 'negative' | 'neutral'
  indent?: boolean
  bold?: boolean
}> = ({ label, value, count, type, indent = false, bold = false }) => (
  <div
    className={cn(
      'grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-2.5 hover:bg-muted/30 rounded-lg transition-colors',
      indent && 'pl-8'
    )}
  >
    <div className="flex items-center">
      <StatusIndicator type={type} />
      <span className={cn('text-sm', bold && 'font-semibold')}>{label}</span>
    </div>
    {count !== undefined && (
      <span className="text-sm text-muted-foreground text-right min-w-[60px]">{count}</span>
    )}
    <span className={cn('text-sm text-right min-w-[100px] font-mono', bold && 'font-semibold')}>
      {Currency(value)}
    </span>
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
  const { t } = useTranslation('reports')
  const { venueId } = useCurrentVenue()
  const { formatDate } = useVenueDateTime()

  // State for filters
  const [selectedMetric, setSelectedMetric] = useState(FILTER_OPTIONS.metrics[0])
  const [selectedReportType, setSelectedReportType] = useState(FILTER_OPTIONS.reportType[0])
  const [selectedLocation, setSelectedLocation] = useState(FILTER_OPTIONS.location[1])

  // State for collapsible sections
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [paymentsOpen, setPaymentsOpen] = useState(true)

  // Mock loading state (replace with real query)
  const isLoading = false
  const data = MOCK_SALES_DATA

  // Date range display
  const dateRangeDisplay = useMemo(() => {
    if (!data) return ''
    return `${formatDate(data.periodStart)} - ${formatDate(data.periodEnd)}`
  }, [data, formatDate])

  if (isLoading) {
    return <SalesSummarySkeleton />
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{t('salesSummary.title')}</h1>
          <Badge variant="outline" className="text-xs font-normal">
            Beta
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9 cursor-pointer">
            <Download className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 cursor-pointer">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>{t('salesSummary.actions.exportPDF')}</DropdownMenuItem>
              <DropdownMenuItem>{t('salesSummary.actions.exportCSV')}</DropdownMenuItem>
              <DropdownMenuItem>{t('salesSummary.actions.print')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button variant="outline" className="h-9 px-4 font-medium cursor-pointer">
          <Calendar className="w-4 h-4 mr-2" />
          {dateRangeDisplay}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap gap-2">
        <FilterPill
          label={t('salesSummary.filters.metrics')}
          value={selectedMetric}
          options={FILTER_OPTIONS.metrics}
          onChange={setSelectedMetric}
        />
        <FilterPill
          label={t('salesSummary.filters.reportType')}
          value={selectedReportType}
          options={FILTER_OPTIONS.reportType}
          onChange={setSelectedReportType}
        />
        <FilterPill
          label={t('salesSummary.filters.location')}
          value={selectedLocation}
          options={FILTER_OPTIONS.location}
          onChange={setSelectedLocation}
        />
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full h-8 px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Filter className="w-3 h-3 mr-1" />
          {t('salesSummary.filters.more')}
        </Button>
      </div>

      {/* Big Number - Total Sales */}
      <GlassCard className="p-6">
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
      </GlassCard>

      {/* Summary Section (Collapsible) */}
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

              {/* Header row */}
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-1 text-xs text-muted-foreground">
                <span>{t('salesSummary.columns.concept')}</span>
                <span className="text-right min-w-[60px]">{t('salesSummary.columns.count')}</span>
                <span className="text-right min-w-[100px]">{t('salesSummary.columns.amount')}</span>
              </div>

              {/* Rows */}
              <SummaryRow
                label={t('salesSummary.rows.grossSales')}
                value={data.summary.totalGross}
                count={data.transactions.completed}
                type="positive"
              />
              <SummaryRow
                label={t('salesSummary.rows.discounts')}
                value={-data.summary.discounts}
                type="negative"
                indent
              />
              <SummaryRow
                label={t('salesSummary.rows.refunds')}
                value={-data.summary.refunds}
                count={data.transactions.refunded}
                type="negative"
                indent
              />
              <div className="h-px bg-border/30 mx-4" />
              <SummaryRow
                label={t('salesSummary.rows.netSales')}
                value={data.summary.netSales}
                type="neutral"
                bold
              />
              <SummaryRow
                label={t('salesSummary.rows.taxes')}
                value={data.summary.taxes}
                type="neutral"
                indent
              />
              <SummaryRow
                label={t('salesSummary.rows.tips')}
                value={data.summary.tips}
                type="positive"
                indent
              />
              <div className="h-px bg-border/30 mx-4" />
              <SummaryRow
                label={t('salesSummary.rows.totalCollected')}
                value={data.summary.totalCollected}
                type="positive"
                bold
              />
            </div>
          </CollapsibleContent>
        </GlassCard>
      </Collapsible>

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
