/**
 * SalesReport - Sales Dashboard with charts and breakdowns
 *
 * Layout:
 * - Header with period selector and export
 * - Summary metrics row
 * - Charts row: By Period, By Category, By Channel
 * - Detailed transactions table
 *
 * Based on mockup: ventas.html
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Receipt,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  Package,
  Hash,
  ChevronDown,
} from 'lucide-react'
import {
  SalesByPeriodChart,
  SalesByCategoryChart,
  SalesByChannelChart,
} from './components'

// Period options
type Period = 'today' | 'yesterday' | 'week' | 'month' | 'custom'

// Mock period data
const MOCK_PERIOD_DATA = [
  { period: 'Lun', sales: 18500, units: 52 },
  { period: 'Mar', sales: 22000, units: 61 },
  { period: 'Mié', sales: 19800, units: 55 },
  { period: 'Jue', sales: 25400, units: 70 },
  { period: 'Vie', sales: 31200, units: 85 },
  { period: 'Sáb', sales: 28500, units: 78 },
  { period: 'Dom', sales: 15600, units: 43 },
]

// Mock category data
const MOCK_CATEGORY_DATA = [
  { name: 'Chip Telcel Negra', value: 45000, units: 300, color: '#22c55e' },
  { name: 'Chip Telcel Blanca', value: 32000, units: 267, color: '#3b82f6' },
  { name: 'Chip Telcel Roja', value: 28500, units: 158, color: '#ef4444' },
  { name: 'Recarga Telcel', value: 18000, units: 90, color: '#f59e0b' },
  { name: 'Otros', value: 8500, units: 42, color: '#8b5cf6' },
]

// Mock channel data
const MOCK_CHANNEL_DATA = [
  { name: 'Efectivo', value: 65000, transactions: 420 },
  { name: 'Tarjeta', value: 38000, transactions: 180 },
  { name: 'Transferencia', value: 22000, transactions: 95 },
  { name: 'Deposito', value: 7000, transactions: 28 },
]

// Mock sales transactions
const MOCK_SALES = [
  {
    id: '1',
    serial: '8952140063000001234',
    category: 'Chip Telcel Negra',
    price: 150.00,
    seller: 'Juan Pérez',
    store: 'Plaza Centro',
    soldAt: '2024-01-15T10:30:00Z',
    paymentMethod: 'Efectivo',
  },
  {
    id: '2',
    serial: '8952140063000001235',
    category: 'Chip Telcel Blanca',
    price: 120.00,
    seller: 'María García',
    store: 'Sucursal Norte',
    soldAt: '2024-01-15T11:45:00Z',
    paymentMethod: 'Tarjeta',
  },
  {
    id: '3',
    serial: '8952140063000005678',
    category: 'Recarga Telcel',
    price: 200.00,
    seller: 'Carlos López',
    store: 'Plaza Centro',
    soldAt: '2024-01-15T12:15:00Z',
    paymentMethod: 'Efectivo',
  },
  {
    id: '4',
    serial: '8952140063000005679',
    category: 'Chip Telcel Roja',
    price: 180.00,
    seller: 'Ana Martínez',
    store: 'Sucursal Sur',
    soldAt: '2024-01-15T14:00:00Z',
    paymentMethod: 'Transferencia',
  },
  {
    id: '5',
    serial: '8952140063000008901',
    category: 'Chip Telcel Negra',
    price: 150.00,
    seller: 'Roberto Sánchez',
    store: 'Plaza Centro',
    soldAt: '2024-01-15T15:30:00Z',
    paymentMethod: 'Tarjeta',
  },
  {
    id: '6',
    serial: '8952140063000008902',
    category: 'Chip Telcel Blanca',
    price: 120.00,
    seller: 'Laura Hernández',
    store: 'Sucursal Norte',
    soldAt: '2024-01-15T16:00:00Z',
    paymentMethod: 'Efectivo',
  },
]

// Mock summary
const MOCK_SUMMARY = {
  totalSales: 132000,
  totalUnits: 857,
  avgTicket: 154.02,
  transactions: 723,
  trend: 12.5,
}

export function SalesReport() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { activeVenue } = useAuth()
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('week')

  // Format currency
  const formatCurrency = useMemo(
    () =>
      (value: number) =>
        new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: activeVenue?.currency || 'MXN',
          minimumFractionDigits: 0,
        }).format(value),
    [activeVenue?.currency]
  )

  // Format date
  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(dateString))
  }

  return (
    <div className="space-y-6">
      {/* Header with Period Selector */}
      <GlassCard className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Select
              value={selectedPeriod}
              onValueChange={value => setSelectedPeriod(value as Period)}
            >
              <SelectTrigger className="w-40">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">
                  {t('playtelecom:sales.today', { defaultValue: 'Hoy' })}
                </SelectItem>
                <SelectItem value="yesterday">
                  {t('playtelecom:sales.yesterday', { defaultValue: 'Ayer' })}
                </SelectItem>
                <SelectItem value="week">
                  {t('playtelecom:sales.thisWeek', { defaultValue: 'Esta Semana' })}
                </SelectItem>
                <SelectItem value="month">
                  {t('playtelecom:sales.thisMonth', { defaultValue: 'Este Mes' })}
                </SelectItem>
                <SelectItem value="custom">
                  {t('playtelecom:sales.custom', { defaultValue: 'Personalizado' })}
                </SelectItem>
              </SelectContent>
            </Select>

            <Badge variant="secondary" className="gap-1">
              <Hash className="w-3 h-3" />
              {MOCK_SUMMARY.transactions} {t('playtelecom:sales.transactions', { defaultValue: 'transacciones' })}
            </Badge>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            {t('playtelecom:sales.export', { defaultValue: 'Exportar' })}
          </Button>
        </div>
      </GlassCard>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
              <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('playtelecom:sales.totalSales', { defaultValue: 'Ventas Totales' })}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-xl font-semibold">{formatCurrency(MOCK_SUMMARY.totalSales)}</p>
                {MOCK_SUMMARY.trend > 0 && (
                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                    <TrendingUp className="w-3 h-3 mr-0.5" />
                    +{MOCK_SUMMARY.trend}%
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
              <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('playtelecom:sales.unitsSold', { defaultValue: 'Unidades Vendidas' })}
              </p>
              <p className="text-xl font-semibold">{MOCK_SUMMARY.totalUnits.toLocaleString()}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
              <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('playtelecom:sales.avgTicket', { defaultValue: 'Ticket Promedio' })}
              </p>
              <p className="text-xl font-semibold">{formatCurrency(MOCK_SUMMARY.avgTicket)}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5">
              <Receipt className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('playtelecom:sales.transactionCount', { defaultValue: 'Transacciones' })}
              </p>
              <p className="text-xl font-semibold">{MOCK_SUMMARY.transactions}</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SalesByPeriodChart
          data={MOCK_PERIOD_DATA}
          periodType={selectedPeriod === 'month' ? 'month' : selectedPeriod === 'week' ? 'day' : 'day'}
          trend={MOCK_SUMMARY.trend}
        />
        <SalesByCategoryChart data={MOCK_CATEGORY_DATA} />
        <SalesByChannelChart data={MOCK_CHANNEL_DATA} />
      </div>

      {/* Sales Table */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {t('playtelecom:sales.recentTransactions', { defaultValue: 'Transacciones Recientes' })}
          </h3>
          <Button variant="ghost" size="sm" className="gap-1">
            {t('common:viewAll', { defaultValue: 'Ver todas' })}
            <ChevronDown className="w-4 h-4" />
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:sales.date', { defaultValue: 'Fecha' })}
                </th>
                <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:sales.serial', { defaultValue: 'Serie' })}
                </th>
                <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:sales.category', { defaultValue: 'Categoría' })}
                </th>
                <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:sales.seller', { defaultValue: 'Vendedor' })}
                </th>
                <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:sales.store', { defaultValue: 'Tienda' })}
                </th>
                <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:sales.payment', { defaultValue: 'Pago' })}
                </th>
                <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:sales.amount', { defaultValue: 'Monto' })}
                </th>
              </tr>
            </thead>
            <tbody>
              {MOCK_SALES.map(sale => (
                <tr key={sale.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-2 text-sm">{formatDate(sale.soldAt)}</td>
                  <td className="py-3 px-2">
                    <code className="text-xs bg-muted/50 px-2 py-1 rounded font-mono">
                      {sale.serial.slice(-8)}
                    </code>
                  </td>
                  <td className="py-3 px-2 text-sm">{sale.category}</td>
                  <td className="py-3 px-2 text-sm">{sale.seller}</td>
                  <td className="py-3 px-2 text-sm text-muted-foreground">{sale.store}</td>
                  <td className="py-3 px-2">
                    <Badge variant="outline" className="text-xs">
                      {sale.paymentMethod}
                    </Badge>
                  </td>
                  <td className="py-3 px-2 text-right font-medium text-green-600 dark:text-green-400">
                    {formatCurrency(sale.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  )
}

export default SalesReport
