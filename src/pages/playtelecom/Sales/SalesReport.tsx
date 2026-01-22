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

import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Calendar,
  Store,
  Copy,
  Hash,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'

// Types
type SaleStatus = 'conciliado' | 'pendiente' | 'exitoso'

interface Sale {
  id: string
  date: string
  store: string
  product: string
  productType: 'bait_200' | 'bait_100' | 'portabilidad' | 'recarga'
  iccid: string
  proofOfSale?: string // URL to proof of sale image
  seller: {
    name: string
    avatar: string
  }
  amount: number
  status: SaleStatus
}

// Mock data
const MOCK_STORES = [
  { id: 'all', name: 'Todas las Tiendas' },
  { id: 'centro', name: 'Centro Histórico #402' },
  { id: 'walmart-norte', name: 'Walmart Norte #112' },
  { id: 'soriana-sur', name: 'Soriana Sur #203' },
]

const MOCK_REVENUE_TREND = [
  { day: 'Lun', revenue: 12500 },
  { day: 'Mar', revenue: 18200 },
  { day: 'Mié', revenue: 15400 },
  { day: 'Jue', revenue: 22100 },
  { day: 'Vie', revenue: 19500 },
  { day: 'Sáb', revenue: 28400 },
  { day: 'Dom', revenue: 25000 },
]

const MOCK_VOLUME_TREND = [
  { day: 'Lun', units: 45 },
  { day: 'Mar', units: 62 },
  { day: 'Mié', units: 55 },
  { day: 'Jue', units: 78 },
  { day: 'Vie', units: 65 },
  { day: 'Sáb', units: 95 },
  { day: 'Dom', units: 88 },
]

const MOCK_SALES: Sale[] = [
  {
    id: 'VN-8821',
    date: '2024-10-24T10:42:00Z',
    store: 'Centro Histórico',
    product: 'BAIT $200',
    productType: 'bait_200',
    iccid: '89521400630000044421',
    proofOfSale: 'https://images.unsplash.com/photo-1621243804936-775306a8f2e3?auto=format&fit=crop&q=80&w=400',
    seller: { name: 'Sarah J.', avatar: 'https://ui-avatars.com/api/?name=Sarah+Jenkins&background=random' },
    amount: 200.00,
    status: 'conciliado',
  },
  {
    id: 'VN-8820',
    date: '2024-10-24T09:15:00Z',
    store: 'Walmart Norte',
    product: 'BAIT $100',
    productType: 'bait_100',
    iccid: '89521400630000099912',
    proofOfSale: 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=400',
    seller: { name: 'Pedro R.', avatar: 'https://ui-avatars.com/api/?name=Pedro+Ruiz&background=random' },
    amount: 100.00,
    status: 'pendiente',
  },
  {
    id: 'VN-8819',
    date: '2024-10-23T18:40:00Z',
    store: 'Centro Histórico',
    product: 'Portabilidad',
    productType: 'portabilidad',
    iccid: '89521400630000011102',
    proofOfSale: undefined, // Portabilidad doesn't require proof
    seller: { name: 'Sarah J.', avatar: 'https://ui-avatars.com/api/?name=Sarah+Jenkins&background=random' },
    amount: 0.00,
    status: 'exitoso',
  },
  {
    id: 'VN-8818',
    date: '2024-10-23T16:20:00Z',
    store: 'Soriana Sur',
    product: 'BAIT $200',
    productType: 'bait_200',
    iccid: '89521400630000077789',
    proofOfSale: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=400',
    seller: { name: 'Carlos M.', avatar: 'https://ui-avatars.com/api/?name=Carlos+Martinez&background=random' },
    amount: 200.00,
    status: 'conciliado',
  },
  {
    id: 'VN-8817',
    date: '2024-10-23T14:05:00Z',
    store: 'Walmart Norte',
    product: 'Recarga $50',
    productType: 'recarga',
    iccid: '89521400630000055543',
    proofOfSale: 'https://images.unsplash.com/photo-1556742393-d75f468bfcb0?auto=format&fit=crop&q=80&w=400',
    seller: { name: 'Ana G.', avatar: 'https://ui-avatars.com/api/?name=Ana+Garcia&background=random' },
    amount: 50.00,
    status: 'conciliado',
  },
]

const MOCK_SUMMARY = {
  totalRevenue: 482500,
  revenueTrend: 12,
  totalUnits: 1240,
  avgPerDay: 45,
  avgTicket: 389.00,
  topPlan: '$200',
  conciliatedCount: 1200,
  pendingCount: 40,
}

// Product type colors
const PRODUCT_TYPE_COLORS: Record<Sale['productType'], string> = {
  bait_200: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  bait_100: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  portabilidad: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  recarga: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
}

// Status colors and labels
const STATUS_CONFIG: Record<SaleStatus, { label: string; className: string }> = {
  conciliado: {
    label: 'CONCILIADO',
    className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
  },
  pendiente: {
    label: 'PENDIENTE',
    className: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700',
  },
  exitoso: {
    label: 'EXITOSO',
    className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
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

export function SalesReport() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { activeVenue } = useAuth()

  // Filters
  const [selectedStore, setSelectedStore] = useState('all')
  const [startDate, setStartDate] = useState('2024-10-01')
  const [endDate, setEndDate] = useState('2024-10-24')
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Image preview modal
  const [previewImage, setPreviewImage] = useState<string | null>(null)

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

  // Format date
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('es-MX', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }, [])

  // Format ICCID (show last 4 digits)
  const formatIccid = useCallback((iccid: string) => {
    return `${iccid.slice(0, 4)}...${iccid.slice(-4)}`
  }, [])

  // Copy ICCID to clipboard
  const copyIccid = useCallback((iccid: string) => {
    navigator.clipboard.writeText(iccid)
  }, [])

  // Filter sales
  const filteredSales = useMemo(() => {
    return MOCK_SALES.filter(sale => {
      // Store filter
      if (selectedStore !== 'all') {
        const storeMatch = MOCK_STORES.find(s => s.id === selectedStore)
        if (storeMatch && !sale.store.toLowerCase().includes(storeMatch.name.split(' ')[0].toLowerCase())) {
          return false
        }
      }
      // Search filter
      if (debouncedSearch) {
        const search = debouncedSearch.toLowerCase()
        return (
          sale.id.toLowerCase().includes(search) ||
          sale.store.toLowerCase().includes(search) ||
          sale.product.toLowerCase().includes(search) ||
          sale.iccid.includes(search) ||
          sale.seller.name.toLowerCase().includes(search)
        )
      }
      return true
    })
  }, [selectedStore, debouncedSearch])

  // Paginated sales
  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredSales.slice(start, start + pageSize)
  }, [filteredSales, currentPage])

  const totalPages = Math.ceil(filteredSales.length / pageSize)

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
              <h2 className="text-lg font-bold tracking-tight">
                {t('playtelecom:sales.title')}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t('playtelecom:sales.transactionAnalysis', { defaultValue: 'Análisis transaccional y validación de registros' })}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 bg-muted/50 p-1.5 rounded-xl border border-border w-full xl:w-auto">
            {/* Store Select */}
            <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger className="w-48 bg-background">
                <Store className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOCK_STORES.map(store => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="h-6 w-px bg-border hidden sm:block" />

            {/* Date Range */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="pl-8 w-36 h-9 text-sm bg-background"
                />
              </div>
              <span className="text-muted-foreground text-sm">-</span>
              <div className="relative">
                <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="pl-8 w-36 h-9 text-sm bg-background"
                />
              </div>
            </div>

            {/* Actions */}
            <Button size="sm" className="gap-1 ml-auto">
              <Search className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="gap-1">
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
              <p className="text-3xl font-black mt-1">{formatCurrency(MOCK_SUMMARY.totalRevenue)}</p>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3 text-green-500" />
                <span className="text-[10px] text-green-500 font-bold">
                  +{MOCK_SUMMARY.revenueTrend}% {t('playtelecom:sales.vsLastMonth', { defaultValue: 'vs mes anterior' })}
                </span>
              </div>
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
              <p className="text-3xl font-black mt-1">
                {MOCK_SUMMARY.totalUnits.toLocaleString()}{' '}
                <span className="text-sm text-muted-foreground font-medium">SIMs</span>
              </p>
              <span className="text-[10px] text-muted-foreground font-bold mt-1">
                {MOCK_SUMMARY.avgPerDay} {t('playtelecom:sales.salesPerDayAvg', { defaultValue: 'ventas/día prom.' })}
              </span>
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
              <p className="text-3xl font-black mt-1">{formatCurrency(MOCK_SUMMARY.avgTicket)}</p>
              <span className="text-[10px] text-orange-500 font-bold mt-1">
                {t('playtelecom:sales.planPlusRecharges', { defaultValue: 'Plan $200 + Recargas', plan: MOCK_SUMMARY.topPlan })}
              </span>
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
              <AreaChart data={MOCK_REVENUE_TREND} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
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
                  stroke="hsl(var(--primary))"
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
              <BarChart data={MOCK_VOLUME_TREND} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
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
              {t('playtelecom:sales.conciliated', { defaultValue: 'Conciliadas' })}: {MOCK_SUMMARY.conciliatedCount.toLocaleString()}
            </span>
            <span className="bg-background border border-border text-muted-foreground text-[10px] font-bold px-2 py-1 rounded flex items-center">
              <span className="size-2 bg-yellow-400 rounded-full mr-1" />
              {t('playtelecom:sales.pending', { defaultValue: 'Pendientes' })}: {MOCK_SUMMARY.pendingCount}
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-3 border-b border-border bg-background">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('playtelecom:sales.searchPlaceholder', { defaultValue: 'Buscar por ID, tienda, ICCID...' })}
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
                  {t('playtelecom:sales.saleIdDate', { defaultValue: 'ID Venta / Fecha' })}
                </th>
                <th className="px-6 py-4 font-black text-[10px] uppercase text-muted-foreground">
                  {t('playtelecom:sales.store')}
                </th>
                <th className="px-6 py-4 font-black text-[10px] uppercase text-muted-foreground">
                  {t('playtelecom:sales.productIccid', { defaultValue: 'Producto / ICCID' })}
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
              {paginatedSales.map(sale => (
                <tr key={sale.id} className="hover:bg-muted/30 transition-colors">
                  {/* ID & Date */}
                  <td className="px-6 py-4">
                    <p className="font-bold text-primary text-xs">#{sale.id}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{formatDate(sale.date)}</p>
                  </td>

                  {/* Store */}
                  <td className="px-6 py-4 text-xs font-bold">{sale.store}</td>

                  {/* Product & ICCID */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', PRODUCT_TYPE_COLORS[sale.productType])}>
                        {sale.product}
                      </span>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => copyIccid(sale.iccid)}
                            className="text-[10px] text-muted-foreground font-mono mt-1 flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                          >
                            <Hash className="w-3 h-3" />
                            {formatIccid(sale.iccid)}
                            <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t('playtelecom:sales.clickToCopy', { defaultValue: 'Clic para copiar' })}</p>
                          <p className="font-mono text-xs">{sale.iccid}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </td>

                  {/* Proof of Sale */}
                  <td className="px-6 py-4 text-center">
                    {sale.proofOfSale ? (
                      <button
                        onClick={() => setPreviewImage(sale.proofOfSale!)}
                        className="relative group inline-block cursor-pointer"
                      >
                        <img
                          src={sale.proofOfSale}
                          alt={t('playtelecom:sales.proofOfSale')}
                          className="h-10 w-16 object-cover rounded border border-border shadow-sm transition-all group-hover:shadow-md group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded transition-colors flex items-center justify-center">
                          <Search className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    ) : (
                      <span className="text-[9px] text-muted-foreground italic">
                        {t('playtelecom:sales.notRequired', { defaultValue: 'No requiere' })}
                      </span>
                    )}
                  </td>

                  {/* Seller */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <img
                        src={sale.seller.avatar}
                        alt={sale.seller.name}
                        className="size-6 rounded-full"
                      />
                      <span className="text-xs font-bold">{sale.seller.name}</span>
                    </div>
                  </td>

                  {/* Amount */}
                  <td className="px-6 py-4 text-right font-black">
                    {formatCurrency(sale.amount)}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 text-center">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded text-[9px] font-black border',
                        STATUS_CONFIG[sale.status].className
                      )}
                    >
                      {STATUS_CONFIG[sale.status].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-border bg-muted/30 flex justify-between items-center">
          <p className="text-[10px] text-muted-foreground font-bold">
            {t('playtelecom:sales.showingOf', {
              defaultValue: 'Mostrando {{current}} de {{total}} ventas',
              current: paginatedSales.length,
              total: filteredSales.length,
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
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              {t('playtelecom:sales.proofOfSale')}
            </DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="relative">
              <img
                src={previewImage}
                alt={t('playtelecom:sales.proofOfSale')}
                className="w-full h-auto rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SalesReport
