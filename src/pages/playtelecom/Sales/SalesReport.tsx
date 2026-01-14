/**
 * SalesReport - Serialized Sales Transactions
 *
 * Displays:
 * - Date range filters
 * - Sales by seller/store
 * - Transaction history with serial numbers
 * - Export functionality
 *
 * Based on mockup: transacciones.html
 */

import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Receipt, Download, Calendar, DollarSign, TrendingUp, Package } from 'lucide-react'
import { useMemo } from 'react'

// Placeholder data - will be replaced with real API calls
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
]

const MOCK_SUMMARY = {
  totalSales: 12450.00,
  totalUnits: 35,
  avgTicket: 355.71,
  topCategory: 'Chip Telcel Negra',
}

export function SalesReport() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { activeVenue } = useAuth()

  // Format currency
  const formatCurrency = useMemo(
    () =>
      (value: number) =>
        new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: activeVenue?.currency || 'MXN',
          minimumFractionDigits: 2,
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
      {/* Filters Bar */}
      <GlassCard className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-2">
              <Calendar className="w-4 h-4" />
              {t('playtelecom:sales.dateRange', { defaultValue: 'Rango de fechas' })}
            </Button>
            {/* Placeholder for filters - will implement FilterPill later */}
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            {t('playtelecom:sales.export', { defaultValue: 'Exportar' })}
          </Button>
        </div>
      </GlassCard>

      {/* Summary Cards */}
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
              <p className="text-xl font-semibold">{formatCurrency(MOCK_SUMMARY.totalSales)}</p>
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
              <p className="text-xl font-semibold">{MOCK_SUMMARY.totalUnits}</p>
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
                {t('playtelecom:sales.topCategory', { defaultValue: 'Top Categoría' })}
              </p>
              <p className="text-xl font-semibold truncate">{MOCK_SUMMARY.topCategory}</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Sales Table */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4">
          {t('playtelecom:sales.transactions', { defaultValue: 'Transacciones' })}
        </h3>
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
                    <code className="text-xs bg-muted/50 px-2 py-1 rounded">{sale.serial.slice(-8)}</code>
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
