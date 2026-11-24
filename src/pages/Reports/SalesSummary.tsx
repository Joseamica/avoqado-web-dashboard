import { useState, useMemo, useEffect, useId, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AvisoDeCarga } from '@/components/AvisoDeCarga'
import { AvisoCobrosQrIncompletos } from '@/components/AvisoCobrosQrIncompletos'
import { falloDeCarga } from '@/lib/falloDeCarga'
import { reintentarSalvoSinPermiso } from '@/lib/reintentoSinPermiso'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { DateRangePicker } from '@/components/date-range-picker'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Currency } from '@/utils/currency'
import { getIntlLocale } from '@/utils/i18n-locale'
import { getLast7Days, getToday, zonaValida } from '@/utils/datetime'
import { useAuth } from '@/context/AuthContext'
import { planTierQueryKey, useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AntesDelPeriodo, CambioDelPeriodo } from './components/CambioDelPeriodo'
import { sonDiasCompletos, ventanaDelPeriodo, type Sentido } from './compararPeriodos'
import {
  fetchSalesSummary,
  salesSummaryKeys,
  type ReportType,
  type GroupBy as ApiGroupBy,
  type PaymentMethodFilter,
  type CardTypeFilter,
  type PaymentMethodDetailedBreakdown,
  type CompararCon,
  type SalesSummaryMetrics,
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
  LayoutGrid,
  Store,
  Clock,
  QrCode,
  WalletCards,
  Filter,
  X,
  Lock,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { PeriodBreakdownTable } from './components/PeriodBreakdownTable'
import { SalesByChannelSection } from './components/SalesByChannelSection'
import { StatementSection } from './statement/StatementSection'
import { SettlementWeekStrip } from '@/components/settlement/SettlementWeekStrip'
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
}

// Available metrics for the report (based on database schema)
// Organized following Square's structure: Sales breakdown → Deductions → Totals → Costs → Profit
const AVAILABLE_METRICS = [
  // Sales breakdown
  { key: 'grossSales' },      // Ventas brutas - includes modifiers
  { key: 'items' },          // Artículos - pure item sales before tax/discounts
  { key: 'serviceCosts' },   // Costes del servicio - tips integrated, surcharges
  // Deductions
  { key: 'discounts' },      // Descuentos y artículos gratuitos
  { key: 'refunds' },        // Devoluciones
  // Calculated totals
  { key: 'netSales' },        // Ventas netas
  { key: 'deferredSales' },  // Ventas diferidas - open orders/pay-later
  // Fees and taxes
  { key: 'taxes' },          // Impuestos
  { key: 'tips' },           // Propinas
  // Costs breakdown (NEW - for clarity)
  { key: 'platformFees' },   // Comisiones de plataforma (Avoqado)
  { key: 'staffCommissions' }, // Comisiones a empleados
  // Final totals
  { key: 'totalCollected' },  // Total cobrado
  { key: 'netProfit' },       // Ganancia neta (after all costs)
] as const

type MetricKey = typeof AVAILABLE_METRICS[number]['key']

// Default selected metrics (most commonly used)
const DEFAULT_SELECTED_METRICS: MetricKey[] = ['grossSales', 'discounts', 'refunds', 'netSales', 'taxes', 'tips', 'platformFees', 'staffCommissions', 'totalCollected', 'netProfit']

// LocalStorage key for persisting user preferences
const STORAGE_KEY = 'avoqado:salesSummary:preferences'

// Preferences interface. Sin el filtro de pago (carril F, hz:fefa11b6:D7.7): la llave es del navegador, no del negocio, y un
// filtro guardado abría otro negocio (o el mismo días después) filtrado sin que nadie lo eligiera; «QR» fuera de Mindform daba 400.
interface SalesSummaryPreferences {
  selectedMetrics: MetricKey[]
  viewType: string
  reportType: string
}

const REPORT_TYPES: string[] = [...REPORT_TYPE_OPTIONS.summaries, ...REPORT_TYPE_OPTIONS.increments]

// Load preferences from localStorage
function loadPreferences(): Partial<SalesSummaryPreferences> | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Validate that selectedMetrics contains valid metric keys
      if (parsed.selectedMetrics) {
        const validKeys = AVAILABLE_METRICS.map(m => m.key)
        // Sin repetidas: «Quitar» una métrica repetida borraba las dos copias y «Aplicar» dejaba cero métricas.
        parsed.selectedMetrics = [...new Set<string>(parsed.selectedMetrics.filter(
          (key: string) => validKeys.includes(key as MetricKey)
        ))]
        // Ensure at least one metric is selected
        if (parsed.selectedMetrics.length === 0) {
          parsed.selectedMetrics = DEFAULT_SELECTED_METRICS
        }
      }
      // Lo que ya no se guarda, o un valor que no existe (nota de D16, e), no se lee.
      delete parsed.paymentMethodFilter
      delete parsed.cardTypeFilter
      if (!CONTROL_OPTION_KEYS.viewType.includes(parsed.viewType)) delete parsed.viewType
      if (!REPORT_TYPES.includes(parsed.reportType)) delete parsed.reportType
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
}> = ({ value, label, description, isSelected, icon }) => {
  // Id propio: los subpaneles viven todos en el DOM y comparten valores («all» en Comercio y en Filtrar por); con `id={value}`,
  // el `htmlFor` de una opción activaba el radio de OTRA (el primero con ese id), y «Todos» de un panel movía el borrador de otro.
  const id = useId()
  return (
    <Label
      htmlFor={id}
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
      <RadioGroupItem value={value} id={id} className="mt-0.5 shrink-0" />
    </Label>
  )
}

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

/** Un importe en otra moneda (paquetes en USD): con su código; si el código no es válido, número y código. */
function enSuMoneda(amount: number, currency: string, locale: string): string {
  try {
    // Con su código (USD 100.00): en inglés el símbolo de dólar se confundiría con pesos (Codex r3 #5).
    return amount.toLocaleString(getIntlLocale(locale), { style: 'currency', currency, currencyDisplay: 'code' })
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
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
type RowType = 'positive' | 'negative' | 'neutral' | 'total'
// Suma · resta · informativo (no se suma). Un total no lleva punto: su raya y su negrita dicen que es un resultado (D16.15).
const STATUS_COLORS: Record<RowType, string> = {
  positive: 'bg-green-500',
  negative: 'bg-red-500',
  neutral: 'bg-blue-500',
  total: 'bg-transparent',
}
const StatusIndicator: React.FC<{ type: RowType }> = ({ type }) => (
  <span aria-hidden className={cn('shrink-0 w-2 h-2 rounded-sm', STATUS_COLORS[type])} />
)

/** Menos de medio centavo es cero: una comisión de 4 decimales o un residuo no se pintan «−$0.00» (D16.1; Codex r1 #3 del carril F). */
const sinMedioCentavo = (n: number) => (Math.abs(n) < 0.005 ? 0 : n)

/**
 * El formateador de dinero de TODA la pantalla (número grande, renglones, métodos, estado, canales): sin medio centavo, así que
 * nunca «−$0.00» (familia de D16.1; Codex r1 #3 y r2 #1 del carril F).
 */
const pesos = (n: number) => Currency(sinMedioCentavo(n))

/** Lo que resta se pinta en negativo; un reverso (comisión que regresó, valor negativo) suma. */
const comoResta = (n: number | null | undefined) => sinMedioCentavo(-Number(n ?? 0))

/** El punto de un renglón que normalmente resta: si el valor regresó (un reverso), suma (Codex r1 #4 del carril F). */
const tipoDeResta = (n: number | null | undefined): RowType => (comoResta(n) > 0 ? 'positive' : 'negative')

/**
 * La ayuda de un renglón (subrayado punteado). Un botón: se alcanza con el tabulador y abre al enfocarlo, y en un celular abre
 * al tocarlo (el tooltip de Radix sólo abre con el cursor; D16.7).
 */
const Ayuda: React.FC<{ label: string; tooltip: string; nota?: string; bold?: boolean }> = ({ label, tooltip, nota, bold }) => {
  const [open, setOpen] = useState(false)
  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={e => {
              // Sin preventDefault Radix cierra al hacer clic; sin stopPropagation, tocar la ayuda de «Ventas brutas» la plegaba.
              e.preventDefault()
              e.stopPropagation()
              setOpen(true)
            }}
            className={cn(
              'text-sm text-left cursor-help border-b border-dashed border-muted-foreground/50 hover:border-foreground transition-colors',
              'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              bold && 'font-semibold',
            )}
          >
            {label}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[280px] text-xs">
          <span className="block">{tooltip}</span>
          {nota && <span className="mt-1.5 block">{nota}</span>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** Atributo `inert` (React 18 no lo tipa): un subpanel que no se ve tampoco se alcanza con el tabulador (D16.8). */
const fueraDeVista = (oculto: boolean) => (oculto ? ({ inert: '' } as Record<string, string>) : {})

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
      className="shrink-0 rounded-full h-8 px-3 text-xs font-medium border-border/60 hover:bg-muted/50 cursor-pointer"
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
  type: RowType
  indent?: number // 0 = no indent, 1 = first level, 2 = second level
  bold?: boolean
  tooltip?: string
  /** Un segundo párrafo de la ayuda. */
  nota?: string
  /** Una línea debajo del nombre que dice de dónde sale la cifra. */
  caption?: string
  /** Carril F2: lo del otro periodo, debajo del importe. */
  antes?: React.ReactNode
}> = ({ label, value, count, countLabel, type, indent = 0, bold = false, tooltip, nota, caption, antes }) => (
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
          <Ayuda label={label} tooltip={tooltip} nota={nota} bold={bold} />
        ) : (
          <span className={cn('text-sm', bold && 'font-semibold')}>{label}</span>
        )}
      </div>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground ml-4">{count} {countLabel}</span>
      )}
      {caption && <span className="text-xs text-muted-foreground ml-4">{caption}</span>}
    </div>
    <span className="text-right min-w-[100px]">
      <span data-monto className={cn('block text-sm tabular-nums', bold && 'font-semibold')}>
        {pesos(value)}
      </span>
      {antes}
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
  type: RowType
  bold?: boolean
  tooltip?: string
  isOpen: boolean
  onToggle: () => void
  /** Nombre del botón que pliega (para lector de pantalla). */
  toggleLabel: string
  children: React.ReactNode
  antes?: React.ReactNode
}> = ({ label, value, count, countLabel, type, bold = false, tooltip, isOpen, onToggle, toggleLabel, children, antes }) => (
  <div>
    <div
      className="flex items-start justify-between gap-4 px-4 py-2.5 hover:bg-muted/30 rounded-lg transition-colors cursor-pointer"
      onClick={onToggle}
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          {/* El renglón entero pliega con el mouse; con teclado, este botón (D7.9). */}
          <button
            type="button"
            aria-expanded={isOpen}
            aria-label={toggleLabel}
            onClick={e => {
              e.stopPropagation()
              onToggle()
            }}
            className="rounded-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown className={cn(
              'w-4 h-4 text-muted-foreground transition-transform shrink-0',
              !isOpen && '-rotate-90'
            )} />
          </button>
          <StatusIndicator type={type} />
          {tooltip ? (
            <Ayuda label={label} tooltip={tooltip} bold={bold} />
          ) : (
            <span className={cn('text-sm', bold && 'font-semibold')}>{label}</span>
          )}
        </div>
        {count !== undefined && (
          <span className="text-xs text-muted-foreground ml-8">{count} {countLabel}</span>
        )}
      </div>
      <span className="text-right min-w-[100px]">
        <span data-monto className={cn('block text-sm tabular-nums', bold && 'font-semibold')}>
          {pesos(value)}
        </span>
        {antes}
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
              <p className="text-muted-foreground">{pesos(segment.value)} ({segment.percentage.toFixed(1)}%)</p>
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
          {/* El importe también en la leyenda: el tooltip del segmento sólo abre con el mouse (Codex r3 E del carril F). */}
          <span className="tabular-nums">{pesos(segment.value)}</span>
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
                        segment.color === 'bg-orange-500' && 'text-orange-500',
                        segment.color === 'bg-purple-500' && 'text-purple-500'
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
                    <p className="text-muted-foreground">{pesos(segment.value)} ({segment.percentage.toFixed(1)}%)</p>
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
            <span className="tabular-nums">{pesos(segment.value)}</span>
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
        <span className="text-sm tabular-nums text-right">{pesos(segment.value)}</span>
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
  countLabel: string
  settlementLabel?: string
}> = ({ icon, label, amount, count, percentage, countLabel, settlementLabel }) => (
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
    <span className="text-sm text-muted-foreground text-right">{count} {countLabel}</span>
    <span className="text-sm text-muted-foreground text-right min-w-[50px]">{percentage.toFixed(1)}%</span>
    <span className="text-sm tabular-nums text-right min-w-[100px]">{pesos(amount)}</span>
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
            // El renglón entero despliega con el mouse; con teclado, este botón (Codex r2 #6 del carril F).
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={label}
              onClick={e => {
                e.stopPropagation()
                setExpanded(v => !v)
              }}
              className="rounded-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronDown
                className={cn('w-4 h-4 text-muted-foreground transition-transform shrink-0', !expanded && '-rotate-90')}
              />
            </button>
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
              {feesLabel}: {pesos(platformFees)}
            </span>
          )}
        </div>
        <span className="text-sm text-muted-foreground text-right">{count} {countLabel}</span>
        <span className="text-sm text-muted-foreground text-right min-w-[50px]">{percentage.toFixed(1)}%</span>
        <span className="text-sm tabular-nums text-right min-w-[100px]">{pesos(amount)}</span>
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
                    {feesLabel}: {pesos(sub.platformFees)}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground text-right">{sub.count} {countLabel}</span>
              <span className="text-xs text-muted-foreground text-right min-w-[50px]">{sub.percentage.toFixed(1)}%</span>
              <span className="text-sm tabular-nums text-right min-w-[100px]">{pesos(sub.amount)}</span>
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
  <>
    <Skeleton className="h-24 w-full rounded-2xl" />
    <Skeleton className="h-64 w-full rounded-2xl" />
    <Skeleton className="h-48 w-full rounded-2xl" />
  </>
)

// ============================================
// Main Component
// ============================================
export default function SalesSummary() {
  const { t, i18n } = useTranslation('reports')
  const { venueId, fullBasePath } = useCurrentVenue()
  const { activeVenue } = useAuth()
  // Una zona guardada como «GMT-6» (altas viejas) no es IANA: Luxon da una fecha inválida y la pantalla tronaba. La misma salida
  // que el SERVIDOR (`zonaDelCalculo`): la Ciudad de México.
  const venueTimezone = zonaValida(activeVenue?.timezone)

  // Tier gate: Free venues get a BASIC report (today's summary only). Pro+ unlocks
  // history (other date ranges / past periods) and the advanced breakdowns. The
  // sales-summary API is NOT feature-gated server-side (only `reports:read`), so a
  // Free venue's request still returns data — this is a pure FRONTEND gate.
  const { hasAccess } = useTierFeatureAccess('ADVANCED_REPORTS')

  // «Hoy» sigue al reloj del negocio (D15.1): el plan Gratis con el panel abierto al pasar la medianoche seguía pidiendo el día
  // anterior y el SERVIDOR lo rechazaba («El histórico requiere Pro») hasta recargar. Se revisa cada minuto y al volver a la pestaña.
  const [todayRange, setTodayRange] = useState(() => getToday(venueTimezone))
  useEffect(() => {
    const revisar = () =>
      setTodayRange(prev => {
        const hoy = getToday(venueTimezone)
        return hoy.from.getTime() === prev.from.getTime() && hoy.to.getTime() === prev.to.getTime() ? prev : hoy
      })
    revisar()
    const id = window.setInterval(revisar, 60_000)
    window.addEventListener('focus', revisar)
    document.addEventListener('visibilitychange', revisar)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', revisar)
      document.removeEventListener('visibilitychange', revisar)
    }
  }, [venueTimezone])

  // Date range state - Pro defaults to last 7 days; Free is locked to today.
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
  const [activePanel, setActivePanel] = useState<'main' | 'reportType' | 'viewType' | 'metrics' | 'merchant' | 'filterBy' | null>('main')
  // Foco del panel (Codex r1 #7 del carril F): al cambiar de subpanel, el foco pasa al nuevo (el de antes queda `inert`); al cerrar,
  // regresa al botón que lo abrió (⋮ o una píldora).
  const sheetRef = useRef<HTMLDivElement>(null)
  const abiertoDesde = useRef<HTMLElement | null>(null)
  const enfocarPanel = (panel: string | null) =>
    requestAnimationFrame(() =>
      sheetRef.current?.querySelector<HTMLElement>(`[data-panel="${panel}"] button:not([disabled])`)?.focus(),
    )
  const irAPanel = (panel: 'main' | 'reportType' | 'viewType' | 'metrics' | 'merchant' | 'filterBy') => {
    setActivePanel(panel)
    enfocarPanel(panel)
  }

  // Load saved preferences from localStorage
  const savedPrefs = useMemo(() => loadPreferences(), [])

  // Applied control values (what's actually shown in the report)
  const [reportType, setReportType] = useState<ReportType>(() => (savedPrefs?.reportType as ReportType) || 'summary')
  // Free venues never reach the report-type control (it's Pro-only), so a saved
  // increment preference must not leak the period-breakdown view. Force "summary".
  const effectiveReportType: ReportType = hasAccess ? reportType : 'summary'
  const [viewType, setViewType] = useState(() => savedPrefs?.viewType || 'gauge')
  const [selectedMetricsGuardadas, setSelectedMetrics] = useState<MetricKey[]>(
    () => savedPrefs?.selectedMetrics || DEFAULT_SELECTED_METRICS
  )
  // El plan Gratis no tiene «Métricas»: ve las de siempre, no las que se guardaron en este navegador con otro negocio Pro (como el
  // filtro de D15.3, que ya no se guarda).
  const selectedMetrics = hasAccess ? selectedMetricsGuardadas : DEFAULT_SELECTED_METRICS

  // Merchant filter state
  const [merchantAccountId, setMerchantAccountId] = useState<string | null>(null)
  const [pendingMerchantAccountId, setPendingMerchantAccountId] = useState<string | null>(null)

  // Payment method / card type filter state (no se guardan en el navegador: carril F, D7.7)
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethodFilter | null>(null)
  const [cardTypeFilter, setCardTypeFilter] = useState<CardTypeFilter | null>(null)
  const [pendingPaymentMethodFilter, setPendingPaymentMethodFilter] = useState<PaymentMethodFilter | null>(null)
  const [pendingCardTypeFilter, setPendingCardTypeFilter] = useState<CardTypeFilter | null>(null)

  // Carril F2 (hz:fefa11b6:D7): «Comparar con». Nada por default y no se guarda en el navegador (como los filtros, D7.7). Sólo Pro.
  const [compararCon, setCompararCon] = useState<CompararCon | 'none'>('none')
  const queryClient = useQueryClient()

  const isMindform = venueId === MINDFORM_VENUE_ID
  // El filtro que de verdad se aplica: sólo con el plan (el Gratis no tiene controles) y «QR» sólo en Mindform, que es donde
  // existe (fuera de ahí el SERVIDOR responde 400). Insignia, petición y pantalla leen éste (D15.3).
  const filtroDePago = hasAccess && (paymentMethodFilter !== 'QR_LEGACY' || isMindform) ? paymentMethodFilter : null
  const isFiltered = filtroDePago !== null

  // Fetch venue merchant accounts
  const { data: merchantAccounts = [], isSuccess: comerciosListos } = useQuery({
    queryKey: ['venueMerchantAccounts', venueId],
    queryFn: () => getVenueMerchantAccountsByVenueId(venueId),
    staleTime: 1000 * 60 * 30,
  })
  // Codex r14 #2 y r15 #2 (carril F): si una afiliación elegida sale de la lista (soporte la retiró), se quita sola, en lo aplicado y en
  // el borrador, cada uno por su cuenta. El SERVIDOR ya rechaza con 400 un comercio que no es del negocio, y sin él en la lista no
  // queda selector para quitarlo.
  useEffect(() => {
    if (!comerciosListos) return
    const fuera = (id: string | null) => id !== null && !merchantAccounts.some(m => m.id === id)
    if (fuera(merchantAccountId)) setMerchantAccountId(null)
    if (fuera(pendingMerchantAccountId)) setPendingMerchantAccountId(null)
  }, [comerciosListos, merchantAccounts, merchantAccountId, pendingMerchantAccountId])

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

    const debitDays = debit?.settlementDays ?? 1
    const creditDays = credit?.settlementDays ?? 1
    const amexDays = amex?.settlementDays ?? 3

    const cardMax = Math.max(debitDays, creditDays)
    const cardParts: string[] = []
    if (debitDays === creditDays) {
      cardParts.push(formatDays(debitDays))
    } else {
      // Sin repetir «Liquidación:» (ya va al principio) y con los nombres de los locales, no «(débito)» fijo en español.
      const debito = t('salesSummary.controls.filterBy.cardType.options.debit').toLowerCase()
      const credito = t('salesSummary.controls.filterBy.cardType.options.credit').toLowerCase()
      cardParts.push(`${formatDays(debitDays)} (${debito}), ${formatDays(creditDays)} (${credito})`)
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
  const [pendingSelectedMetrics, setPendingSelectedMetrics] = useState<MetricKey[]>(DEFAULT_SELECTED_METRICS)

  // Save preferences to localStorage when they change
  useEffect(() => {
    savePreferences({
      // Las guardadas, no las del plan Gratis: abrir un negocio Gratis no borra lo que eligió en otro Pro.
      selectedMetrics: selectedMetricsGuardadas,
      viewType,
      reportType,
    })
  }, [selectedMetricsGuardadas, viewType, reportType])

  // Get translated label for current selection
  const getSelectedLabel = (category: 'reportType' | 'viewType', value: string) => {
    return t(`salesSummary.controls.${category}.options.${value}`, value)
  }

  // Check if there are pending changes for each control
  const hasReportTypeChange = pendingReportType !== reportType
  const hasViewTypeChange = pendingViewType !== viewType
  const hasMetricsChange = JSON.stringify(pendingSelectedMetrics) !== JSON.stringify(selectedMetrics)
  const hasMerchantChange = pendingMerchantAccountId !== merchantAccountId
  const hasFilterByChange =
    pendingPaymentMethodFilter !== paymentMethodFilter || pendingCardTypeFilter !== cardTypeFilter

  // Open sheet and navigate to specific panel, initialize pending with current value
  const openControlPanel = (panel: 'main' | 'reportType' | 'viewType' | 'metrics' | 'merchant' | 'filterBy') => {
    // Initialize pending values with current values when opening
    setPendingReportType(reportType)
    setPendingViewType(viewType)
    setPendingSelectedMetrics([...selectedMetrics])
    setPendingMerchantAccountId(merchantAccountId)
    setPendingPaymentMethodFilter(paymentMethodFilter)
    setPendingCardTypeFilter(cardTypeFilter)
    abiertoDesde.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
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

  const applyMetrics = () => {
    setSelectedMetrics([...pendingSelectedMetrics])
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
      ...(filtroDePago ? { paymentMethod: filtroDePago } : {}),
      ...(filtroDePago === 'CARD' && cardTypeFilter ? { cardType: cardTypeFilter } : {}),
      // Always request the per-merchant card breakdown + settlement projection for
      // the reconciliation view (both additive / opt-in on the backend).
      includeMerchantBreakdown: true,
      includeSettlementProjection: true,
      // Carril G: «Ventas por canal» (todos los planes, decisión del founder del 22-nov) y lo cobrado por adelantado (D5).
      includeChannelBreakdown: true,
      includePrepaid: true,
      // Carril F2: el otro periodo viene en la MISMA respuesta (una sola petición, un solo instante para los dos lados).
      ...(hasAccess && compararCon !== 'none' ? { compareTo: compararCon } : {}),
    }
  }, [venueId, hasAccess, dateRange.from, dateRange.to, todayRange.from, todayRange.to, effectiveReportType, merchantAccountId, filtroDePago, cardTypeFilter, compararCon])

  // Fetch sales summary data from API
  const salesQuery = useQuery({
    // Carril G (Codex r3 #2): el acceso va en la llave. Si el plan cambia con la pantalla abierta, no se reusa la respuesta de antes
    // (con las tablas Pro para un negocio que ya es Gratis, o al revés).
    queryKey: [...salesSummaryKeys.summary(apiFilters), hasAccess],
    queryFn: () => fetchSalesSummary(apiFilters),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: reintentarSalvoSinPermiso, // D3: un 403 (cajero por liga directa) avisa «sin permiso» de inmediato
  })
  const { data: apiResponse } = salesQuery

  // Carril F2: la comparación que se pinta. Sólo si es la de la opción elegida (un SERVIDOR viejo ignora `compareTo` y no la manda).
  const comparacionPedida = hasAccess && compararCon !== 'none'
  const comparacion = comparacionPedida && apiResponse?.comparison?.compareTo === compararCon ? apiResponse.comparison : undefined
  const comparado = comparacion?.status === 'ok' ? comparacion : undefined
  // Sin Pro (el plan bajó con la pantalla abierta): se vuelve a pedir el plan; con Gratis la píldora queda con candado.
  useEffect(() => {
    if (comparacion?.status === 'plan') void queryClient.invalidateQueries({ queryKey: planTierQueryKey(venueId) })
  }, [comparacion?.status, queryClient, venueId])
  // Las fechas exactas de cada lado: con horas si alguno de los dos no es de días completos (r9 #3 del plan).
  const conHoras =
    !!comparado?.baseRange &&
    !!comparado.dateRange &&
    !(sonDiasCompletos(comparado.baseRange, venueTimezone) && sonDiasCompletos(comparado.dateRange, venueTimezone))
  const ventanaActual = comparado?.baseRange ? ventanaDelPeriodo(comparado.baseRange, venueTimezone, conHoras, i18n.language) : ''
  const ventanaComparada = comparado?.dateRange ? ventanaDelPeriodo(comparado.dateRange, venueTimezone, conHoras, i18n.language) : ''
  /** Lo del otro periodo para un renglón del Resumen. `mostrar` es cómo pinta el renglón su cifra (p. ej. lo que resta, en negativo). */
  const antesDe = (campo: keyof SalesSummaryMetrics, sentido: Sentido, mostrar: (n: number) => number = n => n) =>
    comparado?.summary ? (
      <AntesDelPeriodo
        valor={comparado.summary[campo] == null ? null : mostrar(Number(comparado.summary[campo]))}
        cambio={comparado.changes?.[campo]}
        sentido={sentido}
        formatCurrency={pesos}
      />
    ) : undefined
  /** Un renglón que sale «si hay» sale también si el otro periodo tiene algo. */
  const enComparado = (campo: keyof SalesSummaryMetrics) => Number(comparado?.summary?.[campo] ?? 0) !== 0

  // Period statement inputs — the additive API fields powering the Mercury-style
  // "estado de cuenta" (StatementSection derives all money math from these).
  const merchantBreakdown = useMemo(() => apiResponse?.byMerchantAccount ?? [], [apiResponse])
  const detailedBuckets = useMemo(() => apiResponse?.byPaymentMethodDetailed ?? [], [apiResponse])
  const settlementCalendar = useMemo(() => apiResponse?.settlementCalendar ?? [], [apiResponse])
  const statementDestinations = apiResponse?.statementDestinations
  // Show the statement only when advanced reporting is unlocked, no payment-method
  // filter is active (it would collapse the by-method view to 100%), and the
  // backend returned the detailed buckets the hero bar needs.
  const showStatement = hasAccess && !isFiltered && detailedBuckets.length > 0

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

    // La barra de arriba reparte las VENTAS por método (full-testing v2 #1; la cifra grande es «Total cobrado», D16): con tarjetas de regalo el server manda
    // `salesByPaymentMethod` (sin las cargas, con lo pagado con saldo como GIFT_CARD); sin él, ventas y dinero son lo mismo.
    const ventas = apiResponse.salesByPaymentMethod ?? paymentMethods
    const esTarjeta = (m: string) => ['CREDIT_CARD', 'DEBIT_CARD', 'CARD'].includes(m)
    const ventasDe = (es: (m: string) => boolean) => ventas.filter(p => es(p.method)).reduce((sum, p) => sum + p.amount, 0)
    const repartoDeVentas = {
      card: ventasDe(esTarjeta),
      cash: ventasDe(m => m === 'CASH'),
      other: ventasDe(m => !esTarjeta(m) && m !== 'CASH' && m !== 'GIFT_CARD'),
      giftCard: ventasDe(m => m === 'GIFT_CARD'),
    }

    return {
      summary: {
        totalGross: apiResponse.summary.grossSales,
        items: apiResponse.summary.items,
        serviceCosts: apiResponse.summary.serviceCosts,
        discounts: apiResponse.summary.discounts,
        refunds: apiResponse.summary.refunds,
        netSales: apiResponse.summary.netSales,
        deferredSales: apiResponse.summary.deferredSales,
        // «Sin cobrar» (D6, 21-nov): lo que deben las cuentas abiertas, sin propina. Un servidor viejo sólo manda `deferredSales`.
        unpaid: apiResponse.summary.unpaidSales !== undefined ? apiResponse.summary.unpaidSales : apiResponse.summary.deferredSales,
        unpaidOrders: apiResponse.summary.unpaidOrders ?? null,
        // Un servidor anterior a la base de caja no manda `unpaidSales`: sus ventas brutas traen cuentas abiertas y su «diferidas»
        // trae propina. Las ayudas lo dicen así en vez de afirmar la regla nueva (Codex r2 #9).
        baseDeCaja: apiResponse.summary.unpaidSales !== undefined,
        // Comisiones de terceros (D1): Rappi, Uber Eats, tipos de pago con comisión. Ya restadas de «Neto cobrado».
        tenderCommissions: apiResponse.summary.tenderCommissions ?? 0,
        // D16.2: lo cobrado con el filtro (vista de movimientos), con propina y sin devoluciones. Un servidor viejo no lo manda.
        chargedAmount: typeof apiResponse.summary.chargedAmount === 'number' ? apiResponse.summary.chargedAmount : null,
        taxes: apiResponse.summary.taxes,
        tips: apiResponse.summary.tips,
        // Costs breakdown (NEW - for clarity)
        platformFees: apiResponse.summary.platformFees,       // Avoqado platform fees
        staffCommissions: apiResponse.summary.staffCommissions, // Commissions paid to staff
        totalCollected: apiResponse.summary.totalCollected,
        netProfit: apiResponse.summary.netProfit,             // True profit after all costs
        // Tarjetas de regalo (spec §7, B5): cifras aparte, opcionales — un server sin la función no las manda.
        giftCardLoads: apiResponse.summary.giftCardLoads ?? null,
        giftCardLoadsCount: apiResponse.summary.giftCardLoadsCount ?? null,
        paidWithGiftCardBalance: apiResponse.summary.paidWithGiftCardBalance ?? null,
        // Carril G · D5: cobrado por adelantado que no es venta (opcional: un servidor viejo no lo manda).
        packagesSoldOnline: apiResponse.summary.packagesSoldOnline ?? null,
        packagesSoldOnlineCount: apiResponse.summary.packagesSoldOnlineCount ?? 0,
        reservationDeposits: apiResponse.summary.reservationDeposits ?? null,
        reservationDepositsCount: apiResponse.summary.reservationDepositsCount ?? 0,
        reservationDepositsRefunded: apiResponse.summary.reservationDepositsRefunded ?? 0,
        packagesSoldOnlineOtherCurrencies: apiResponse.summary.packagesSoldOnlineOtherCurrencies ?? [],
      },
      transactions: {
        total: apiResponse.summary.transactionCount,
        completed: apiResponse.summary.transactionCount, // API doesn't break down by status
        // D10.1: las devoluciones ya no son «transacciones»; el servidor nuevo manda cuántas hubo.
        refunded: apiResponse.summary.refundCount ?? 0,
        voided: 0,
        deferred: 0,
      },
      repartoDeVentas,
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
    // «Sin cobrar» (D6): el renglón de la tabla se llama así y lee `unpaidSales`; un servidor viejo sólo trae `deferredSales`.
    return apiResponse.byPeriod.map(p =>
      p.metrics.unpaidSales !== undefined ? { ...p, metrics: { ...p.metrics, deferredSales: p.metrics.unpaidSales } } : p,
    )
  }, [apiResponse?.byPeriod, effectiveReportType])

  // D14.2: la columna «Total» de la tabla por periodo es la cabecera del SERVIDOR (la misma cifra que el Resumen), con el mismo
  // cambio de «Sin cobrar» que los periodos.
  const totalDelPeriodo = useMemo(() => {
    const cabecera = apiResponse?.summary
    if (!cabecera) return undefined
    return cabecera.unpaidSales !== undefined ? { ...cabecera, deferredSales: cabecera.unpaidSales } : cabecera
  }, [apiResponse?.summary])
  // Carril F2: el otro periodo en la celda de «Total», con la misma traducción de «Sin cobrar».
  const comparadoDelPeriodo = useMemo(() => {
    if (!comparado?.summary) return undefined
    const m = comparado.summary
    return {
      ventana: ventanaComparada,
      metrics: m.unpaidSales !== undefined ? { ...m, deferredSales: m.unpaidSales } : m,
      changes: { ...comparado.changes, deferredSales: comparado.changes?.unpaidSales ?? null },
    }
  }, [comparado, ventanaComparada])

  // Handle date range change
  const handleDateRangeUpdate = (values: { range: { from: Date; to: Date | undefined } }) => {
    if (values.range.from && values.range.to) {
      setDateRange({ from: values.range.from, to: values.range.to })
      // TODO: Refetch data with new date range
    }
  }

  // El encabezado y los filtros no dependen de lo leído: se conservan aunque la lectura falle.
  const filtros = (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <PageTitleWithInfo
            title={t('salesSummary.title')}
            className="text-2xl font-bold"
            tooltip={t('salesSummary.pageInfo')}
          />
          <Badge variant="outline" className="text-xs font-normal">
            {t('salesSummary.beta')}
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

          {/* Controls Sheet. ⋮ abre con lo aplicado, como las píldoras (nota c de D16), y tiene nombre (D16.7). */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 cursor-pointer"
            onClick={() => openControlPanel('main')}
            aria-label={t('salesSummary.controls.title')}
          >
            <MoreVertical className="w-4 h-4" />
          </Button>
          <Sheet open={controlsOpen} onOpenChange={(open) => {
            setControlsOpen(open)
            if (!open) setActivePanel('main')
          }}>
            {/* En un celular de 390 px, 400 fijos quedaban cortados (D16.9). */}
            <SheetContent
              ref={sheetRef}
              className="w-full sm:w-[450px] sm:max-w-[450px] p-0 overflow-hidden"
              onOpenAutoFocus={e => {
                e.preventDefault()
                enfocarPanel(activePanel)
              }}
              onCloseAutoFocus={e => {
                e.preventDefault()
                abiertoDesde.current?.focus()
              }}
            >
              {/* Main Controls Panel */}
              <div
                className={cn(
                  'absolute inset-0 transition-transform duration-300 ease-in-out',
                  activePanel === 'main' ? 'translate-x-0' : '-translate-x-full'
                )}
              
                data-panel="main"
                {...fueraDeVista(activePanel !== 'main')}
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
                    onClick={() => irAPanel('metrics')}
                  />
                  <Separator />
                  <ControlRow
                    label={t('salesSummary.controls.reportType.label')}
                    description={t('salesSummary.controls.reportType.description')}
                    value={getSelectedLabel('reportType', reportType)}
                    onClick={() => irAPanel('reportType')}
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
                        onClick={() => irAPanel('merchant')}
                      />
                      <Separator />
                    </>
                  )}
                  <ControlRow
                    label={t('salesSummary.controls.viewType.label')}
                    description={t('salesSummary.controls.viewType.description')}
                    value={getSelectedLabel('viewType', viewType)}
                    onClick={() => irAPanel('viewType')}
                  />
                  <Separator />
                  <ControlRow
                    label={t('salesSummary.controls.filterBy.label')}
                    description={t('salesSummary.controls.filterBy.description')}
                    value={filterByValueLabel()}
                    onClick={() => irAPanel('filterBy')}
                  />
                </div>
              </div>

              {/* Report Type Sub-Panel (Square-like with two sections) */}
              <div
                className={cn(
                  'absolute inset-0 transition-transform duration-300 ease-in-out bg-background flex flex-col',
                  activePanel === 'reportType' ? 'translate-x-0' : 'translate-x-full'
                )}
              
                data-panel="reportType"
                {...fueraDeVista(activePanel !== 'reportType')}
              >
                {/* Header with back and apply buttons */}
                <div className="flex items-center justify-between p-4 border-b">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full cursor-pointer"
                    onClick={() => irAPanel('main')}
                    aria-label={t('salesSummary.controls.back')}
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

              {/* Merchant Sub-Panel */}
              <div
                className={cn(
                  'absolute inset-0 transition-transform duration-300 ease-in-out bg-background flex flex-col',
                  activePanel === 'merchant' ? 'translate-x-0' : 'translate-x-full'
                )}
              
                data-panel="merchant"
                {...fueraDeVista(activePanel !== 'merchant')}
              >
                <div className="flex items-center justify-between p-4 border-b">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full cursor-pointer"
                    onClick={() => irAPanel('main')}
                    aria-label={t('salesSummary.controls.back')}
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
              
                data-panel="viewType"
                {...fueraDeVista(activePanel !== 'viewType')}
              >
                <div className="flex items-center justify-between p-4 border-b">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full cursor-pointer"
                    onClick={() => irAPanel('main')}
                    aria-label={t('salesSummary.controls.back')}
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
                    {/* Nota de D16 (b): con un filtro de pago la gráfica no se pinta; se dice antes de «Aplicar». */}
                    {isFiltered && (
                      <p className="text-xs text-muted-foreground" data-testid="view-type-filtered-note">
                        {t('salesSummary.controls.viewType.filteredNote')}
                      </p>
                    )}
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

              {/* Metrics Sub-Panel */}
              <div
                className={cn(
                  'absolute inset-0 transition-transform duration-300 ease-in-out bg-background flex flex-col',
                  activePanel === 'metrics' ? 'translate-x-0' : 'translate-x-full'
                )}
              
                data-panel="metrics"
                {...fueraDeVista(activePanel !== 'metrics')}
              >
                <div className="flex items-center justify-between p-4 border-b">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full cursor-pointer"
                    onClick={() => irAPanel('main')}
                    aria-label={t('salesSummary.controls.back')}
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
                            {/* Include checkbox */}
                            <Checkbox
                              checked={isSelected}
                              onClick={(e) => e.stopPropagation()}
                              // D16.5: la casilla también cambia la métrica (antes detenía el clic y no hacía nada).
                              onCheckedChange={() => toggleMetric(metric.key)}
                              aria-label={t(`salesSummary.controls.metrics.options.${metric.key}`)}
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
              
                data-panel="filterBy"
                {...fueraDeVista(activePanel !== 'filterBy')}
              >
                {/* Header with back and apply buttons */}
                <div className="flex items-center justify-between p-4 border-b">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full cursor-pointer"
                    onClick={() => irAPanel('main')}
                    aria-label={t('salesSummary.controls.back')}
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
          // El detalle trae cobros Y devoluciones; desde D10.1 `transactionCount` ya no cuenta las devoluciones.
          estimatedCount={
            apiResponse?.summary ? apiResponse.summary.transactionCount + (apiResponse.summary.refundCount ?? 0) : undefined
          }
          reportType={effectiveReportType}
        />
      )}

      {/* Date Range Picker — Pro can pick any range; Free is locked to "Hoy" with an
          inline upsell to history. */}
      {hasAccess ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker
              initialDateFrom={dateRange.from}
              initialDateTo={dateRange.to}
              onUpdate={handleDateRangeUpdate}
              align="start"
              locale={i18n.language}
              showCompare={false}
            />
            {/* Carril F2: «Comparar con», como la píldora del Inicio. */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 cursor-pointer gap-2 rounded-full border-input px-4 text-sm font-normal"
                  data-tour="sales-summary-compare"
                >
                  <span className="text-muted-foreground">{t('salesSummary.compare.label')}</span>
                  <span className="font-semibold">{t(`salesSummary.compare.options.${compararCon}`)}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[260px] rounded-xl p-1">
                {(['none', 'previous_period', 'previous_year'] as const).map(opcion => (
                  <DropdownMenuItem
                    key={opcion}
                    onClick={() => setCompararCon(opcion)}
                    className={cn('cursor-pointer rounded-lg px-3 py-2', opcion === compararCon && 'bg-muted font-semibold')}
                  >
                    {t(`salesSummary.compare.options.${opcion}`)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {/* Lo que impide comparar lo dice el SERVIDOR; un SERVIDOR viejo que no sabe comparar no manda nada. */}
          {comparacionPedida && apiResponse && !comparado && (
            <p className="text-xs text-muted-foreground" data-testid="sales-summary-compare-notice">
              {comparacion?.message ?? t('salesSummary.compare.unavailable')}
            </p>
          )}
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
          {/* Carril F2: comparar es de Pro (lee periodos pasados). */}
          <Button
            type="button"
            variant="outline"
            disabled
            aria-disabled
            className="h-9 gap-2 rounded-full opacity-100 disabled:opacity-100 cursor-not-allowed"
            data-testid="sales-summary-compare-locked"
          >
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{t('salesSummary.compare.label')}</span>
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
      // En un celular las píldoras van en una sola fila que se desliza (antes ocupaban 4 filas antes del primer número, D16.10).
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => openControlPanel('metrics')}
          className="shrink-0 rounded-full h-8 px-3 text-xs font-medium border-border/60 hover:bg-muted/50 cursor-pointer"
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
          label={t('salesSummary.controls.filterBy.label')}
          value={filterByValueLabel()}
          onClick={() => openControlPanel('filterBy')}
        />
      </div>
      )}
    </>
  )

  // Los filtros se quedan mientras carga o se reintenta, y si falla: sin red son la salida a un periodo ya leído.
  if (!data) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        {filtros}
        {falloDeCarga(salesQuery) ? <AvisoDeCarga query={salesQuery} hayDatos={false} /> : <SalesSummarySkeleton />}
      </div>
    )
  }

  // Tarjetas de regalo (D5 r1). Con alguna cifra ≠ 0, «Total cobrado» explica que no trae lo cargado y sí lo pagado con saldo
  // (el server no cambia: su totalCollected alimenta el job nocturno y el correo).
  // Sin nada que repartir (los métodos suman 0: p. ej. el único cobro del rango fue con saldo), la barra, la dona y la tabla de
  // arriba no pintan «0 %» por método (lote ⭐ r1). El total y su conteo siguen; «Métodos de pago» dice su estado vacío.
  // La barra, la dona y la tabla de arriba: UN arreglo (antes se repetía tres veces). El saldo de tarjeta sale sólo si hubo.
  // Sin nada que repartir, o con un método en negativo (una devolución del día, Codex r1 #1), no se pintan: serían «0 %» o
  // porcentajes imposibles. El total, su conteo y «Métodos de pago» siguen.
  // Vista de movimientos (D9.1): con un método elegido, o con un comercio en un servidor que ya lo trata igual (`filtered`), las
  // métricas de orden vienen en null y sus renglones no se pintan. `isFiltered` sigue mandando en lo demás (repartos, estado de cuenta).
  const sinMetricasDeOrden = isFiltered || apiResponse?.filtered === true
  const mostrarVentasNetas = !sinMetricasDeOrden && selectedMetrics.includes('netSales')
  const cobradoConFiltro = sinMetricasDeOrden && data.summary.chargedAmount !== null
  const mostrarSinCobrar =
    !sinMetricasDeOrden &&
    data.summary.unpaid !== null &&
    (selectedMetrics.includes('deferredSales') || (data.summary.unpaidOrders ?? 0) > 0 || enComparado('unpaidOrders'))
  const hayPaquetes =
    (data.summary.packagesSoldOnline ?? 0) !== 0 || data.summary.packagesSoldOnlineOtherCurrencies.length > 0 || enComparado('packagesSoldOnline')
  const hayDepositos =
    data.summary.reservationDeposits !== null &&
    (data.summary.reservationDeposits !== 0 ||
      data.summary.reservationDepositsCount > 0 ||
      data.summary.reservationDepositsRefunded !== 0 ||
      enComparado('reservationDeposits') ||
      enComparado('reservationDepositsCount'))
  // El renglón «Tarjetas de regalo cargadas»: sin filtro de pago y si no es cero. Sin él, el tooltip no lo menciona (lote ⭐).
  const hayRenglonDeCargas =
    !isFiltered && typeof data.summary.giftCardLoads === 'number' && (data.summary.giftCardLoads !== 0 || enComparado('giftCardLoads'))
  const hayAparte = mostrarSinCobrar || hayRenglonDeCargas || hayPaquetes || hayDepositos
  /** Las partes de «Ventas brutas»: bajo su renglón (sangría 1) o solas si «Ventas brutas» no está elegida (sangría 0). */
  const renglonesDeVentasBrutas = (indent: 0 | 1) => (
    <>
      {selectedMetrics.includes('items') && (
        <SummaryRow
          label={t('salesSummary.rows.items')}
          value={data.summary.items ?? 0}
          type={indent ? 'neutral' : 'positive'}
          indent={indent}
          tooltip={t('salesSummary.tooltips.items')}
          antes={antesDe('items', 'subeBien')}
        />
      )}
      {/* D2: los cargos por servicio ya son venta; si hubo, se ven aunque no estén elegidos en Métricas. */}
      {(selectedMetrics.includes('serviceCosts') || (data.summary.serviceCosts ?? 0) !== 0 || enComparado('serviceCosts')) && (
        <SummaryRow
          label={t('salesSummary.rows.serviceCosts')}
          value={data.summary.serviceCosts ?? 0}
          type={indent ? 'neutral' : 'positive'}
          indent={indent}
          tooltip={t('salesSummary.tooltips.serviceCosts')}
          antes={antesDe('serviceCosts', 'subeBien')}
        />
      )}
    </>
  )
  // Con el QR anterior sin leer las cifras pueden estar incompletas: no se afirma que no hubo ventas (Codex r1 #8).
  const sinMovimientos =
    !apiResponse?.legacyUnavailable &&
    data.transactions.total === 0 &&
    data.transactions.refunded === 0 &&
    data.summary.totalCollected === 0 &&
    (data.summary.unpaidOrders ?? 0) === 0
  const rv = data.repartoDeVentas
  const totalVendido = rv.card + rv.cash + rv.other + rv.giftCard
  const hayReparto = totalVendido > 0 && [rv.card, rv.cash, rv.other, rv.giftCard].every(v => v >= 0)
  const segmentosDeVentas = [
    { label: t('salesSummary.paymentTypes.card'), value: rv.card, color: 'bg-blue-500' },
    { label: t('salesSummary.paymentTypes.cash'), value: rv.cash, color: 'bg-green-500' },
    { label: t('salesSummary.paymentTypes.other'), value: rv.other, color: 'bg-orange-500' },
    ...(rv.giftCard !== 0 ? [{ label: t('salesSummary.paymentTypes.giftCardBalance'), value: rv.giftCard, color: 'bg-purple-500' }] : []),
  ].map(seg => ({ ...seg, percentage: totalVendido > 0 ? (seg.value / totalVendido) * 100 : 0 }))
  const hayCifrasDeTarjetas =
    !isFiltered && ((data.summary.giftCardLoads ?? 0) !== 0 || (data.summary.paidWithGiftCardBalance ?? 0) !== 0)
  // En la vista de movimientos «Neto cobrado» sale de los pagos del filtro, no de las ventas netas (Codex r4 #4).
  const tooltipTotalCobrado = sinMetricasDeOrden
    ? t('salesSummary.tooltips.totalCollectedMovements')
    : !hayCifrasDeTarjetas
    ? t(data.summary.baseDeCaja ? 'salesSummary.tooltips.totalCollected' : 'salesSummary.tooltips.totalCollectedOld')
    : hayRenglonDeCargas
      ? t('salesSummary.tooltips.totalCollectedWithGiftCards')
      : t('salesSummary.tooltips.totalCollectedWithGiftCardsNoLoadsRow')

  // Lo pagado con saldo NO es un bucket (B5): va aparte y sin porcentaje, porque no es dinero que entró en el periodo (entró
  // cuando se vendió la tarjeta). BRUTO como los buckets; lo que regresó al saldo se dice aparte, sin restar en el panel (M2).
  // Sale después del estado de cuenta (Pro, M1) o en «Métodos de pago» (Free, o sin buckets), FUERA de la rama de los buckets:
  // si el único cobro del rango fue con saldo, el server manda `byPaymentMethodDetailed: []` y la línea igual se dice (lote ⭐).
  const saldoDeRegalo = apiResponse?.giftCardBalanceBreakdown
  const lineaDeSaldo = (className: string) =>
    saldoDeRegalo && (saldoDeRegalo.count > 0 || (data.summary.paidWithGiftCardBalance ?? 0) !== 0) ? (
      <p className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)} data-tour="sales-summary-gift-balance">
        <WalletCards className="w-4 h-4 shrink-0" />
        {saldoDeRegalo.refunds > 0
          ? t('salesSummary.giftBalanceLineWithRefunds', {
              amount: pesos(saldoDeRegalo.amount),
              count: saldoDeRegalo.count,
              refunds: pesos(saldoDeRegalo.refunds),
            })
          : t('salesSummary.giftBalanceLine', { amount: pesos(saldoDeRegalo.amount), count: saldoDeRegalo.count })}
      </p>
    ) : null

  return (
    <div className="p-4 md:p-6 space-y-6">
      {filtros}
      <AvisoDeCarga query={salesQuery} hayDatos />
      <AvisoCobrosQrIncompletos incompleto={apiResponse?.legacyUnavailable} onRetry={() => void salesQuery.refetch()} />

      {/* Big Number - Total Sales with Dynamic Visualization (FREE: today's headline) */}
      <GlassCard className="p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
            <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">{t('salesSummary.totalSales')}</p>
            <p className="text-4xl font-bold tracking-tight">{pesos(data.summary.totalCollected)}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {data.transactions.total} {t('salesSummary.transactions')}
            </p>
            {/* Carril F2: el número grande dice SIEMPRE cuánto fue el otro periodo y su ventana (así la caída se ve aunque la tabla por
                días no tenga filas o el cambio no se calcule), y su cambio cuando lo hay. */}
            {comparado?.summary && (
              <div className="mt-2 space-y-0.5 text-sm text-muted-foreground" data-testid="sales-summary-compare-headline">
                <p>
                  {t('salesSummary.compare.headline', { window: ventanaComparada, amount: pesos(comparado.summary.totalCollected) })}
                  {comparado.changes?.totalCollected && (
                    <>
                      {' · '}
                      <CambioDelPeriodo cambio={comparado.changes.totalCollected} sentido="subeBien" formatCurrency={pesos} />
                    </>
                  )}
                </p>
                {comparado.excludesLegacyQr && <p data-testid="sales-summary-compare-legacy">{t('salesSummary.compare.excludesLegacyQr')}</p>}
              </div>
            )}
            {/* D7.5: un periodo sin nada se dice con palabras, no sólo con renglones en $0.00. */}
            {sinMovimientos && (
              <p className="text-sm text-muted-foreground mt-2" data-testid="sales-summary-empty">
                {t('salesSummary.empty')}
              </p>
            )}
          </div>
        </div>

        {/* Lo que pintan la barra, la dona y la tabla NO es el desglose de «Neto cobrado»: es lo que entró por método (cobros menos
            devoluciones, con propina, también abonos de cuentas abiertas) y antes de comisiones. Se titula y se explica, para que no
            se lea como la suma del número grande (full-testing FAIL 1 del carril F; como «Cobraste» del estado del periodo). */}
        {!isFiltered && hayReparto && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="sales-summary-payment-split-title">
            {/* Con su propio total: no es el desglose de «Neto cobrado» (re-revisión del carril F). */}
            <Ayuda label={t('salesSummary.paymentSplit.titleWithTotal', { amount: pesos(totalVendido) })} tooltip={t('salesSummary.paymentSplit.tooltip')} />
          </p>
        )}

        {/* Dynamic visualization based on viewType — hidden under a payment
            filter (the distribution would be a tautological 100% of the
            filtered method). */}
        {!isFiltered && hayReparto && viewType === 'gauge' && (
          <SalesBreakdownBar
            segments={segmentosDeVentas}
          />
        )}

        {!isFiltered && hayReparto && viewType === 'pie' && (
          <SalesPieChart
            segments={segmentosDeVentas}
          />
        )}

        {!isFiltered && hayReparto && viewType === 'table' && (
          <SalesTable
            segments={segmentosDeVentas}
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
          FREE: this is the basic "today's totals" breakdown and stays visible.
          Carril F (D7.2): se lee como una cuenta — lo que suma, lo que resta, cada total con su raya, y abajo lo que va aparte. */}
      {effectiveReportType === 'summary' && (
        <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
          <GlassCard>
            <h3>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:bg-muted/30 transition-colors rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex items-center gap-3">
                    <span className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                      <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </span>
                    <span>
                      <span className="block font-medium text-sm">{t('salesSummary.sections.summary')}</span>
                      <span className="block text-xs text-muted-foreground font-normal">{t('salesSummary.sections.summaryDesc')}</span>
                    </span>
                  </span>
                  <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', summaryOpen && 'rotate-180')} />
                </button>
              </CollapsibleTrigger>
            </h3>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-1 lg:max-w-3xl">
              <div className="h-px bg-border/50 mb-3" />
              {/* Qué quiere decir cada punto (D16.15). */}
              <p className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-2 text-xs text-muted-foreground" data-testid="sales-summary-legend">
                {(['positive', 'negative', 'neutral'] as const).map(k => (
                  <span key={k} className="flex items-center gap-1.5">
                    <StatusIndicator type={k} />
                    {t(`salesSummary.legend.${k}`)}
                  </span>
                ))}
              </p>
              {/* Carril F2: las fechas y horas exactas de cada lado, siempre a la vista. */}
              {comparado && (
                <div className="px-4 pb-2 text-xs text-muted-foreground" data-testid="sales-summary-compare-windows">
                  <p>
                    {t('salesSummary.compare.thisPeriod')}: <span className="text-foreground">{ventanaActual}</span>
                    {' · '}
                    {t(comparado.matchedWeekday ? 'salesSummary.compare.comparedWeekday' : 'salesSummary.compare.compared')}:{' '}
                    <span className="text-foreground">{ventanaComparada}</span>
                  </p>
                  {comparado.untilSameTime && <p>{t('salesSummary.compare.untilSameTimeNote')}</p>}
                  {comparado.excludesLegacyQr && <p>{t('salesSummary.compare.excludesLegacyQr')}</p>}
                </div>
              )}

              {/* Ventas brutas - Collapsible parent with children.
                  Order-derived → hidden under a payment filter (can't be split per method). */}
              {!sinMetricasDeOrden && selectedMetrics.includes('grossSales') && (
                <CollapsibleSummaryRow
                  label={t('salesSummary.rows.grossSales')}
                  value={data.summary.totalGross}
                  count={data.transactions.completed}
                  countLabel={t('salesSummary.transactionsLabel')}
                  type="positive"
                  tooltip={t(data.summary.baseDeCaja ? 'salesSummary.tooltips.grossSales' : 'salesSummary.tooltips.grossSalesOld')}
                  isOpen={grossSalesOpen}
                  onToggle={() => setGrossSalesOpen(!grossSalesOpen)}
                  toggleLabel={t(grossSalesOpen ? 'salesSummary.periodTable.collapse' : 'salesSummary.periodTable.expand')}
                  antes={antesDe('grossSales', 'subeBien')}
                >
                  {renglonesDeVentasBrutas(1)}
                </CollapsibleSummaryRow>
              )}
              {/* Nota de D16 (d): con «Ventas brutas» apagada, sus partes elegidas salen solas (antes desaparecían). */}
              {!sinMetricasDeOrden && !selectedMetrics.includes('grossSales') && renglonesDeVentasBrutas(0)}

              {/* D16.2: con un filtro de pago, la cuenta abre con lo cobrado con ese filtro (con propina): Cobrado − Devoluciones −
                  comisiones = Neto cobrado, al centavo. */}
              {cobradoConFiltro && (
                <SummaryRow
                  label={t('salesSummary.rows.chargedAmount')}
                  value={data.summary.chargedAmount ?? 0}
                  type="positive"
                  tooltip={t('salesSummary.tooltips.chargedAmount')}
                  antes={antesDe('chargedAmount', 'subeBien')}
                />
              )}

              {/* Devoluciones - Same level as Ventas brutas. Con «Cobrado» a la vista sale si hubo, aunque no esté elegida: sin ella
                  la cuenta hasta «Neto cobrado» no cierra (Codex r5 #4 del carril F). */}
              {(selectedMetrics.includes('refunds') || (cobradoConFiltro && data.summary.refunds !== 0)) && (
                <SummaryRow
                  label={t('salesSummary.rows.refunds')}
                  value={comoResta(data.summary.refunds)}
                  count={data.transactions.refunded > 0 && data.summary.refunds !== 0 ? data.transactions.refunded : undefined}
                  countLabel={t('salesSummary.refundsCountLabel', { count: data.transactions.refunded })}
                  type="negative"
                  tooltip={t('salesSummary.tooltips.refunds')}
                  antes={antesDe('refunds', 'subeMal', comoResta)}
                />
              )}

              {/* Descuentos - order-derived → hidden under filter */}
              {!sinMetricasDeOrden && selectedMetrics.includes('discounts') && (
                <SummaryRow
                  label={t('salesSummary.rows.discounts')}
                  value={comoResta(data.summary.discounts)}
                  type={tipoDeResta(data.summary.discounts)}
                  tooltip={t('salesSummary.tooltips.discounts')}
                  antes={antesDe('discounts', 'subeMal', comoResta)}
                />
              )}

              {/* Ventas netas - order-derived → hidden under filter. D7.1: ya no se repite abajo como «Total de las ventas». */}
              {mostrarVentasNetas && (
                <>
                  <div className="h-px bg-border/30 mx-4 my-2" />
                  <SummaryRow
                    label={t('salesSummary.rows.netSales')}
                    value={data.summary.netSales}
                    type="total"
                    bold
                    tooltip={t('salesSummary.tooltips.netSales')}
                    antes={antesDe('netSales', 'subeBien')}
                  />
                </>
              )}

              {/* Impuestos: ya vienen DENTRO de las ventas netas (México); informativo, después de ellas y al ras: con una devolución de
                  otro día las ventas netas pueden quedar por debajo de sus impuestos (Codex r3 C del carril F). */}
              {!sinMetricasDeOrden && selectedMetrics.includes('taxes') && (
                <SummaryRow
                  label={t('salesSummary.rows.taxes')}
                  value={data.summary.taxes}
                  type="neutral"
                  tooltip={t('salesSummary.tooltips.taxes')}
                  antes={antesDe('taxes', 'neutro')}
                />
              )}

              {/* Propinas */}
              {selectedMetrics.includes('tips') && (
                <SummaryRow
                  label={t('salesSummary.rows.tips')}
                  value={data.summary.tips}
                  // Con «Cobrado» a la vista las propinas ya vienen dentro (y las devueltas, en «Devoluciones»): informativas.
                  type={cobradoConFiltro ? 'neutral' : 'positive'}
                  tooltip={t(cobradoConFiltro ? 'salesSummary.tooltips.tipsMovements' : 'salesSummary.tooltips.tips')}
                  antes={antesDe('tips', cobradoConFiltro ? 'neutro' : 'subeBien')}
                />
              )}

              {/* Comisiones de plataforma (Avoqado). Igual que las devoluciones con «Cobrado» a la vista. */}
              {(selectedMetrics.includes('platformFees') || (cobradoConFiltro && data.summary.platformFees !== 0)) && (
                <SummaryRow
                  label={t('salesSummary.rows.platformFees')}
                  value={comoResta(data.summary.platformFees)}
                  type={tipoDeResta(data.summary.platformFees)}
                  tooltip={t('salesSummary.tooltips.platformFees')}
                  antes={antesDe('platformFees', 'subeMal', comoResta)}
                />
              )}

              {/* Comisiones de terceros (D1): Rappi, Uber Eats, tipos de pago con comisión. Ya están restadas de «Neto cobrado»: si hubo,
                  se ven siempre, para que la cuenta cuadre. */}
              {(data.summary.tenderCommissions !== 0 || enComparado('tenderCommissions')) && (
                <SummaryRow
                  label={t('salesSummary.rows.tenderCommissions')}
                  value={comoResta(data.summary.tenderCommissions)}
                  type={tipoDeResta(data.summary.tenderCommissions)}
                  tooltip={t('salesSummary.tooltips.tenderCommissions')}
                  antes={antesDe('tenderCommissions', 'subeMal', comoResta)}
                />
              )}

              {/* Neto cobrado - Money received */}
              {selectedMetrics.includes('totalCollected') && (
                <>
                  <div className="h-px bg-border/30 mx-4 my-2" />
                  <SummaryRow
                    label={t('salesSummary.rows.totalCollected')}
                    value={data.summary.totalCollected}
                    count={data.transactions.completed}
                    countLabel={t('salesSummary.transactionsLabel')}
                    type="total"
                    bold
                    tooltip={
                      settlementConfigs.length > 0
                        ? `${tooltipTotalCobrado.replace(/\.$/, '')}. ${t('salesSummary.tooltips.totalCollectedSettlement', { debitDays: settlementLabels.debitDays, amexDays: settlementLabels.amexDays })}`
                        : tooltipTotalCobrado
                    }
                    // D16.3: los dos «netos» de la página miden distinto; se dice aquí, donde se comparan. Con un filtro de pago o de
                    // comercio, «Neto cobrado» ya sale de los pagos: la comparación no aplica (Codex r2 #2).
                    nota={showStatement && !sinMetricasDeOrden ? t('salesSummary.tooltips.totalCollectedVsStatement') : undefined}
                    antes={antesDe('totalCollected', 'subeBien')}
                  />
                  {/* Tarjetas de regalo (spec §7, B5): de lo cobrado, lo que se pagó con saldo (venta y propina). Informativo y al ras: trae
                      propina, así que no es una parte de «Ventas netas» (Codex r2 #3). El server la manda sólo sin filtro de pago. */}
                  {!sinMetricasDeOrden &&
                    typeof data.summary.paidWithGiftCardBalance === 'number' &&
                    (data.summary.paidWithGiftCardBalance !== 0 || enComparado('paidWithGiftCardBalance')) && (
                      <SummaryRow
                        label={t('salesSummary.rows.paidWithGiftCardBalance')}
                        value={data.summary.paidWithGiftCardBalance}
                        type="neutral"
                        tooltip={t('salesSummary.tooltips.paidWithGiftCardBalance')}
                        antes={antesDe('paidWithGiftCardBalance', 'neutro')}
                      />
                    )}
                </>
              )}

              {/* Comisiones a empleados: no las resta «Neto cobrado», sólo «Ganancia neta» (D7.2): van entre los dos. */}
              {selectedMetrics.includes('staffCommissions') && (
                <SummaryRow
                  label={t('salesSummary.rows.staffCommissions')}
                  value={comoResta(data.summary.staffCommissions)}
                  type={tipoDeResta(data.summary.staffCommissions)}
                  tooltip={t('salesSummary.tooltips.staffCommissions')}
                  antes={antesDe('staffCommissions', 'subeMal', comoResta)}
                />
              )}

              {/* Ganancia neta */}
              {selectedMetrics.includes('netProfit') && (
                <>
                  <div className="h-px bg-border/50 mx-4 my-3" />
                  <SummaryRow
                    label={t('salesSummary.rows.netProfit')}
                    value={data.summary.netProfit}
                    type="total"
                    bold
                    // Codex r1 #4: debajo de «Neto cobrado − empleados» la cuenta no da sin decir que también salen las propinas.
                    caption={t('salesSummary.netProfitCaption')}
                    tooltip={t(
                      sinMetricasDeOrden
                        ? 'salesSummary.tooltips.netProfitMovements'
                        : data.summary.baseDeCaja
                          ? 'salesSummary.tooltips.netProfit'
                          : 'salesSummary.tooltips.netProfitOld',
                    )}
                    antes={antesDe('netProfit', 'subeBien')}
                  />
                </>
              )}

              {/* Aparte: lo que NO entra en la cuenta de arriba. */}
              {hayAparte && (
                <>
                  <div className="h-px bg-border/50 mx-4 mt-3" />
                  <p className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground">{t('salesSummary.apart')}</p>
                </>
              )}

              {/* «Sin cobrar» (D6, base de caja): cuentas abiertas o pagadas a medias, sin propina. NO es venta. Order-derived → hidden
                  in the movement view. Con cuentas abiertas se ve aunque no esté elegido en Métricas (Toast enseña siempre lo no cobrado). */}
              {mostrarSinCobrar && (
                <SummaryRow
                  label={t('salesSummary.rows.deferredSales')}
                  value={data.summary.unpaid ?? 0}
                  count={data.summary.unpaidOrders ?? undefined}
                  countLabel={t('salesSummary.unpaidOrdersLabel', { count: data.summary.unpaidOrders ?? 0 })}
                  type="neutral"
                  tooltip={t(data.summary.baseDeCaja ? 'salesSummary.tooltips.deferredSales' : 'salesSummary.tooltips.deferredSalesOld')}
                  antes={antesDe('unpaidSales', 'neutro')}
                />
              )}

              {/* Tarjetas de regalo cargadas (spec §7, B5): NO es venta ni entra a «Total cobrado» (ruling del contador, D5 r1):
                  renglón aparte, debajo de todo, con su conteo. Sólo sin filtro de pago y si no es cero. */}
              {hayRenglonDeCargas && (
                <SummaryRow
                  label={t('salesSummary.rows.giftCardLoads')}
                  value={data.summary.giftCardLoads ?? 0}
                  // Sólo con tarjetas cargadas en el rango: un neto de puras cancelaciones no dice «0 tarjetas» (lote ⭐).
                  count={data.summary.giftCardLoadsCount || undefined}
                  countLabel={t('salesSummary.giftCardsCountLabel', { count: data.summary.giftCardLoadsCount ?? 0 })}
                  type="neutral"
                  tooltip={t('salesSummary.tooltips.giftCardLoads')}
                  antes={antesDe('giftCardLoads', 'neutro')}
                />
              )}

              {/* Carril G · D5: paquetes comprados en línea y depósitos de reservas. Tampoco son venta ni entran a «Neto cobrado»
                  (no crean cuenta ni cobro; se decide después si son venta al usarse). Sin filtro de pago; el de depósitos sale
                  también si se cobró y se devolvió en el mismo periodo ($0 neto), para que su conteo no desaparezca. */}
              {/* Sin `!sinMetricasDeOrden`: el SERVIDOR sólo los manda en la vista de ventas, y un filtro guardado que la petición no llevó
                  (plan Gratis) los escondía (Codex r3 #2). */}
              {hayPaquetes && (
                  <>
                    <SummaryRow
                      label={t('salesSummary.rows.packagesSoldOnline')}
                      value={data.summary.packagesSoldOnline ?? 0}
                      count={data.summary.packagesSoldOnlineCount || undefined}
                      countLabel={t('salesSummary.packagesCountLabel', { count: data.summary.packagesSoldOnlineCount })}
                      type="neutral"
                      tooltip={t('salesSummary.tooltips.packagesSoldOnline')}
                      antes={antesDe('packagesSoldOnline', 'neutro')}
                    />
                    {/* Paquetes en otra moneda (el panel deja crearlos en USD): se dicen, nunca se suman a los pesos. */}
                    {data.summary.packagesSoldOnlineOtherCurrencies.map(o => (
                      <p key={o.currency} className="pl-8 pr-4 pb-1 text-xs text-muted-foreground" data-testid="paquetes-otra-moneda">
                        {t('salesSummary.packagesOtherCurrency', { amount: enSuMoneda(o.amount, o.currency, i18n.language), count: o.count })}
                      </p>
                    ))}
                  </>
                )}
              {hayDepositos && (
                  <SummaryRow
                    label={t('salesSummary.rows.reservationDeposits')}
                    value={data.summary.reservationDeposits}
                    // Siempre con su conteo: un depósito de ayer devuelto hoy dice «0 cobrados · $80 devuelto», no un número suelto.
                    count={data.summary.reservationDepositsCount}
                    countLabel={
                      data.summary.reservationDepositsRefunded !== 0
                        ? t('salesSummary.depositsCountLabelWithRefunds', {
                            count: data.summary.reservationDepositsCount,
                            refunded: pesos(data.summary.reservationDepositsRefunded),
                          })
                        : t('salesSummary.depositsCountLabel', { count: data.summary.reservationDepositsCount })
                    }
                    type="neutral"
                    tooltip={t('salesSummary.tooltips.reservationDeposits')}
                    antes={antesDe('reservationDeposits', 'neutro')}
                  />
                )}

              {/* Order-level metrics (gross sales, taxes, discounts…) are hidden
                  under a payment filter — they can't be attributed per method. */}
              {sinMetricasDeOrden && (
                <p className="px-4 pt-3 text-xs italic text-muted-foreground">
                  {t('salesSummary.controls.filterBy.hiddenMetricsMessage')}
                </p>
              )}
            </div>
          </CollapsibleContent>
        </GlassCard>
      </Collapsible>
      )}

      {/* Period Breakdown Table - Only shown for time-based reports (Pro-only: effectiveReportType is forced to 'summary' for
          Free). D14.3: justo donde estaría el Resumen (antes quedaba al fondo, después del estado de cuenta), con la columna
          «Total» de la cabecera del SERVIDOR (D14.2). */}
      {hasAccess && effectiveReportType !== 'summary' && periodData && periodData.length > 0 && (
        <PeriodBreakdownTable
          periods={periodData}
          total={totalDelPeriodo}
          comparado={comparadoDelPeriodo}
          selectedMetrics={selectedMetrics}
          reportType={effectiveReportType}
          venueTimezone={venueTimezone}
        />
      )}

      {/* Carril G · D4: «Ventas por canal» y «Por tipo de pedido», en todos los planes (decisión del founder del 22-nov). */}
      <SalesByChannelSection
        byChannel={apiResponse?.byChannel}
        byOrderType={apiResponse?.byOrderType}
        // La vista que de verdad pidió la pantalla (Codex r3 #2): con el plan Gratis la petición no lleva el filtro guardado.
        conFiltro={apiResponse?.filtered === true}
        desfasado={apiResponse?.channelBreakdownOutOfSync === true}
        formatCurrency={pesos}
      />

      {/* Period statement (Mercury-style): "cuánto gané, cuánto me pagan, cuándo
          y cómo" in one cohesive card. Advanced analysis → Pro-only. Hidden under
          a payment filter (which would collapse the by-method view to 100%). */}
      {showStatement && (
        <>
          <StatementSection
            buckets={detailedBuckets}
            merchants={merchantBreakdown}
            destinations={statementDestinations}
            calendar={settlementCalendar}
            venueTimezone={venueTimezone}
            formatCurrency={pesos}
          />
          {lineaDeSaldo('px-1')}
          {/* The week strip reads the whole venue: with one merchant chosen it would contradict the statement above (D9.2). */}
          {venueId && !merchantAccountId && <SettlementWeekStrip venueId={venueId} venueTimezone={venueTimezone} />}
        </>
      )}
      {hasAccess && isFiltered && (
        <p className="px-1 text-xs text-muted-foreground" data-testid="statement-filtered-note">
          {t('salesSummary.statement.filteredNote')}
        </p>
      )}

      {/* Payment Methods Section (Collapsible). For Pro + unfiltered the statement
          above already tells the by-method story, so this only shows for Free or
          when a payment filter is active. */}
      {/* D16.2: con un filtro de pago la tarjeta sólo repetía «Quita el filtro…» (ya lo dice el número grande): no sale. */}
      {!showStatement && !isFiltered && (
      <Collapsible open={paymentsOpen} onOpenChange={setPaymentsOpen}>
        <GlassCard>
          <h3>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:bg-muted/30 transition-colors rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-center gap-3">
                  <span className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
                    <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </span>
                  <span>
                    <span className="block font-medium text-sm">{t('salesSummary.sections.paymentMethods')}</span>
                    <span className="block text-xs text-muted-foreground font-normal">{t('salesSummary.sections.paymentMethodsDesc')}</span>
                  </span>
                </span>
                <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', paymentsOpen && 'rotate-180')} />
              </button>
            </CollapsibleTrigger>
          </h3>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-1">
              <div className="h-px bg-border/50 mb-3" />

              {apiResponse?.byPaymentMethodDetailed && apiResponse.byPaymentMethodDetailed.length > 0 ? (
                <>
                {/* Enriched breakdown: Card expands to Credit/Debit/AMEX/International with commission. */}
                {apiResponse.byPaymentMethodDetailed.map(bucket => {
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
                      // El importe es el movimiento (cobros menos devoluciones) y el conteo incluye las devoluciones: «movimientos»,
                      // no «cobros» (Codex r1 #5).
                      countLabel={t('salesSummary.movementsLabel')}
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
                })}
                </>
              ) : apiResponse?.byPaymentMethodDetailed ? (
                // Buckets vacíos (p. ej. el único cobro fue con saldo): estado vacío honesto, nunca $0.00 / 0 % (lote ⭐).
                <p className="px-4 py-3 text-sm text-muted-foreground" data-tour="sales-summary-payment-methods-empty">
                  {t('salesSummary.paymentMethodsEmpty')}
                </p>
              ) : (
                // Fallback flat layout (e.g. groupBy != paymentMethod or no detailed data).
                <>
                  <PaymentMethodRow
                    icon={<CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                    label={t('salesSummary.paymentTypes.card')}
                    amount={data.paymentMethods.card.amount}
                    count={data.paymentMethods.card.count}
                    percentage={data.paymentMethods.card.percentage}
                    countLabel={t('salesSummary.movementsLabel')}
                    settlementLabel={settlementLabels.card}
                  />
                  <PaymentMethodRow
                    icon={<Banknote className="w-4 h-4 text-green-600 dark:text-green-400" />}
                    label={t('salesSummary.paymentTypes.cash')}
                    amount={data.paymentMethods.cash.amount}
                    count={data.paymentMethods.cash.count}
                    percentage={data.paymentMethods.cash.percentage}
                    countLabel={t('salesSummary.movementsLabel')}
                    settlementLabel={settlementLabels.cash}
                  />
                  <PaymentMethodRow
                    icon={<Smartphone className="w-4 h-4 text-orange-600 dark:text-orange-400" />}
                    label={t('salesSummary.paymentTypes.other')}
                    amount={data.paymentMethods.other.amount}
                    count={data.paymentMethods.other.count}
                    percentage={data.paymentMethods.other.percentage}
                    countLabel={t('salesSummary.movementsLabel')}
                  />
                </>
              )}
              {lineaDeSaldo('px-4 py-3')}
            </div>
          </CollapsibleContent>
        </GlassCard>
      </Collapsible>
      )}

      {/* FREE upsell: history + advanced reporting are Pro. Inline FeatureGate
          renders a blurred teaser of what Pro unlocks (it's already a paywall card
          for non-Pro venues, and a no-op pass-through for Pro). */}
      {/* D15.2: la lista de beneficios se lee (antes iba DENTRO del candado, borrosa detrás de su tarjeta); el candado sólo
          trae el botón y el precio. */}
      {!hasAccess && (
        <div className="space-y-3" data-testid="sales-summary-upsell">
          <div className="rounded-2xl border border-input bg-card p-6 space-y-4">
            <h3 className="text-lg font-semibold">{t('salesSummary.basic.upsell.title')}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• {t('salesSummary.basic.upsell.history')}</li>
              <li>• {t('salesSummary.basic.upsell.periods')}</li>
              <li>• {t('salesSummary.basic.upsell.breakdowns')}</li>
              <li>• {t('salesSummary.basic.upsell.export')}</li>
              <li>• {t('salesSummary.basic.upsell.compare')}</li>
            </ul>
          </div>
          <FeatureGate feature="ADVANCED_REPORTS">
            <div aria-hidden className="min-h-[12rem]" />
          </FeatureGate>
        </div>
      )}
    </div>
  )
}
