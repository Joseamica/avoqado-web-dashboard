/**
 * SupervisorDashboard - Operational oversight dashboard
 *
 * Sections:
 * - Date/Store filters
 * - Operational coverage (open/closed + gauge) + Cash in field
 * - Store detail table
 * - 3 Charts (pie, progress bars, bar ranking)
 * - Real-time transactions table
 *
 * Access: MANAGER+ only
 */

import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
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
import { Calendar, Store, TrendingUp, Download, Receipt } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import {
  useStoresOverview,
  useStoresStockSummary,
  useStoresVenues,
  useStoresActivityFeed,
  useStoresRevenueVsTarget,
  useStoresStorePerformance,
  useStoresStaffAttendance,
} from '@/hooks/useStoresAnalysis'
import { cn } from '@/lib/utils'

export function SupervisorDashboard() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { activeVenue } = useAuth()
  const { fullBasePath } = useCurrentVenue()

  const [storeFilter, setStoreFilter] = useState('all')

  // Use venue-level hooks for white-label access
  const { data: overview } = useStoresOverview()
  const { data: _stockSummary } = useStoresStockSummary()
  const { data: venuesResponse } = useStoresVenues()
  const { data: activityFeed } = useStoresActivityFeed(20, { refetchInterval: 30000 })
  const { data: _revenueData } = useStoresRevenueVsTarget()
  const { data: storePerformanceData } = useStoresStorePerformance()
  const { data: attendanceData } = useStoresStaffAttendance({
    filterVenueId: storeFilter !== 'all' ? storeFilter : undefined,
    refetchInterval: 30000,
  })

  // Extract venues array from response
  const venuesData = venuesResponse?.venues

  const formatCurrency = useMemo(
    () => (value: number) =>
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: activeVenue?.currency || 'MXN',
        minimumFractionDigits: 0,
      }).format(value),
    [activeVenue?.currency],
  )

  // Derive store detail rows from attendance API
  const storeDetailRows = useMemo(() => {
    if (!attendanceData?.staff) return []
    return attendanceData.staff.map(entry => ({
      store: entry.venueName,
      promoter: entry.name,
      clockIn: entry.checkInTime
        ? new Date(entry.checkInTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()
        : '--:--',
      clockOut: entry.checkOutTime
        ? new Date(entry.checkOutTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()
        : '--:--',
      sales: entry.sales || 0,
      hasDepositPhoto: !!entry.checkInPhotoUrl,
    }))
  }, [attendanceData])

  // Derive transactions from activity feed
  const transactions = useMemo(() => {
    if (!activityFeed?.events) return []
    const colors = ['#6366f1', '#0ea5e9', '#a855f7', '#f59e0b', '#10b981']
    return activityFeed.events
      .filter(e => e.type === 'sale' || e.type === 'checkin')
      .slice(0, 10)
      .map((e, i) => ({
        id: `#${e.id.slice(-6).toUpperCase()}`,
        store: e.venueName || '',
        product: e.title,
        iccid: (e.metadata?.iccid as string) || '--',
        simType: (e.metadata?.categoryName as string) || 'SIM',
        simColor: colors[i % colors.length],
        seller: e.staffName || '--',
        amount: (e.metadata?.amount as number) || 0,
      }))
  }, [activityFeed])

  const storesOpen = overview?.activeStores ?? 0
  const totalStores = overview?.totalStores ?? venuesData?.length ?? storesOpen
  const storesClosed = Math.max(totalStores - storesOpen, 0)
  const coveragePercent = totalStores > 0 ? Math.round((storesOpen / totalStores) * 100) : 0
  const cashInField = overview?.todaySales ?? 0

  // Chart data - derive from store performance
  const salesByStore = useMemo(() => {
    if (!storePerformanceData?.stores?.length) return []
    const total = storePerformanceData.stores.reduce((a, s) => a + s.todaySales, 0) || 1
    const colors = ['#10b981', '#3b82f6', '#64748b', '#f59e0b', '#a855f7']
    return storePerformanceData.stores.slice(0, 5).map((s, i) => ({
      label: s.name.length > 10 ? s.name.slice(0, 10) : s.name,
      percent: Math.round((s.todaySales / total) * 100),
      color: colors[i % colors.length],
    }))
  }, [storePerformanceData])

  const salesVsTarget = useMemo(() => {
    if (!storePerformanceData?.stores?.length) return []
    return storePerformanceData.stores.slice(0, 4).map(s => {
      const perf = Number.isFinite(s.performance) ? s.performance : 0
      return {
        store: s.name.length > 18 ? s.name.slice(0, 18) + '...' : s.name,
        percent: Math.min(perf, 100),
        color: perf >= 70 ? 'bg-green-500' : 'bg-amber-500',
      }
    })
  }, [storePerformanceData])

  const promoterRanking = useMemo(() => {
    if (!storePerformanceData?.stores?.length) return []
    return storePerformanceData.stores.slice(0, 5).map((s, i) => ({
      name: s.name.slice(0, 8),
      amount: s.todaySales,
      isYou: i === 0,
    }))
  }, [storePerformanceData])

  const maxPromoterAmount = Math.max(...promoterRanking.map(p => p.amount), 1)

  const handleDownloadReport = useCallback(() => {
    // Navigate to report page
    window.location.href = `${fullBasePath}/playtelecom/reporte`
  }, [fullBasePath])

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">
          {t('playtelecom:supervisor.title', { defaultValue: 'Tablero Operativo' })}
        </h2>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 bg-card border border-green-500/30 hover:border-green-500 rounded-lg px-3 py-1.5 transition-colors">
            <Calendar className="w-4 h-4 text-green-400" />
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-muted-foreground uppercase leading-none">
                {t('playtelecom:supervisor.date', { defaultValue: 'Fecha' })}
              </span>
              <input
                type="date"
                defaultValue={new Date().toISOString().split('T')[0]}
                className="bg-transparent border-none text-xs font-semibold focus:outline-none p-0 cursor-pointer"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 bg-card border border-green-500/30 hover:border-green-500 rounded-lg px-3 py-1.5 transition-colors">
            <Store className="w-4 h-4 text-green-400" />
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-muted-foreground uppercase leading-none">
                {t('playtelecom:supervisor.store', { defaultValue: 'Tienda' })}
              </span>
              <Select value={storeFilter} onValueChange={setStoreFilter}>
                <SelectTrigger className="border-0 bg-transparent h-5 text-xs font-semibold w-[140px] p-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('playtelecom:supervisor.allStores', { defaultValue: 'Todas las Tiendas' })}</SelectItem>
                  {venuesData?.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Coverage + Cash */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Coverage */}
        <GlassCard className="lg:col-span-2 p-6 flex items-center justify-around relative overflow-hidden">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
              {t('playtelecom:supervisor.operationalCoverage', { defaultValue: 'Cobertura Operativa' })}
            </p>
            <div className="flex items-center gap-8">
              <div>
                <span className="text-green-400 font-black text-4xl block">{storesOpen}</span>
                <span className="text-muted-foreground text-xs font-bold uppercase">
                  {t('playtelecom:supervisor.open', { defaultValue: 'Abiertas' })}
                </span>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <span className="text-red-400 font-black text-4xl block">{storesClosed}</span>
                <span className="text-muted-foreground text-xs font-bold uppercase">
                  {t('playtelecom:supervisor.closed', { defaultValue: 'Cerradas' })}
                </span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs bg-muted/50 px-3 py-1 rounded-full w-fit">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-green-400 font-medium">
                {t('playtelecom:supervisor.systemOnline', { defaultValue: 'Sistema Online' })}
              </span>
            </div>
          </div>

          {/* Simple gauge */}
          <div className="flex flex-col items-center">
            <div className="relative w-[140px] h-[70px] overflow-hidden">
              <div className="absolute w-[140px] h-[140px] bg-muted rounded-full top-0" />
              <div
                className="absolute w-[140px] h-[140px] bg-green-500 rounded-full top-0"
                style={{
                  clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)',
                  transform: `rotate(${(coveragePercent / 100) * 180}deg)`,
                }}
              />
              <div className="absolute w-[110px] h-[110px] bg-card rounded-full top-[15px] left-[15px] z-10" />
            </div>
            <span className="text-xl font-black -mt-8 z-20">{coveragePercent}%</span>
            <span className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
              {t('playtelecom:supervisor.compliance', { defaultValue: 'Cumplimiento' })}
            </span>
          </div>
        </GlassCard>

        {/* Cash in Field */}
        <GlassCard className="p-5 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-4 right-4 p-3 rounded-xl bg-green-500/10">
            <TrendingUp className="w-6 h-6 text-green-500" />
          </div>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mb-2">
            {t('playtelecom:supervisor.cashInField', { defaultValue: 'Efectivo Total en Calle' })}
          </p>
          <h3 className="text-4xl font-black">{formatCurrency(cashInField)}</h3>
          <div className="w-full bg-muted h-1.5 mt-4 rounded-full overflow-hidden">
            <div className="bg-green-500 h-full w-[70%]" />
          </div>
          <p className="text-xs text-green-400 mt-2 font-semibold flex items-center">
            <TrendingUp className="w-3.5 h-3.5 mr-1" /> +15% vs dia anterior
          </p>
        </GlassCard>
      </div>

      {/* Store Detail Table */}
      <GlassCard className="overflow-hidden">
        <div className="bg-card/80 px-6 py-3 border-b border-border/50">
          <h3 className="font-semibold text-sm uppercase flex items-center gap-2">
            <Store className="w-4 h-4 text-primary" />
            {t('playtelecom:supervisor.storeDetail', { defaultValue: 'Detalle por Tienda' })}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 text-xs uppercase font-bold text-muted-foreground">
              <tr>
                <th className="px-6 py-3">{t('playtelecom:supervisor.store', { defaultValue: 'Tienda' })}</th>
                <th className="px-6 py-3">{t('playtelecom:supervisor.promoter', { defaultValue: 'Promotor' })}</th>
                <th className="px-6 py-3">{t('playtelecom:supervisor.entry', { defaultValue: 'Entrada' })}</th>
                <th className="px-6 py-3">{t('playtelecom:supervisor.exit', { defaultValue: 'Salida' })}</th>
                <th className="px-6 py-3 text-right">{t('playtelecom:supervisor.sale', { defaultValue: 'Venta' })}</th>
                <th className="px-6 py-3 text-center">{t('playtelecom:supervisor.depositPhoto', { defaultValue: 'Deposito (Foto)' })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {storeDetailRows.map((row, i) => (
                <tr key={i} className="hover:bg-muted/20 transition">
                  <td className="px-6 py-4 font-medium">{row.store}</td>
                  <td className="px-6 py-4 text-muted-foreground">{row.promoter}</td>
                  <td className="px-6 py-4 text-green-400 font-mono font-semibold">{row.clockIn}</td>
                  <td className="px-6 py-4 text-muted-foreground font-mono">{row.clockOut}</td>
                  <td className="px-6 py-4 text-right font-semibold font-mono">{formatCurrency(row.sales)}</td>
                  <td className="px-6 py-4 text-center">
                    {row.hasDepositPhoto ? (
                      <Badge className="bg-green-500/10 text-green-400 border-green-500/20">OK</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">--</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pie - Sales by Store */}
        <GlassCard className="p-5 flex flex-col items-center justify-center min-h-[280px]">
          <h4 className="text-xs font-bold text-muted-foreground uppercase mb-4 self-start">
            {t('playtelecom:supervisor.salesByStore', { defaultValue: 'Ventas x Tienda' })}
          </h4>
          <div className="relative w-36 h-36">
            <div
              className="w-full h-full rounded-full shadow-lg"
              style={{
                background: `conic-gradient(${salesByStore.map((s, i) => {
                  const start = salesByStore.slice(0, i).reduce((a, x) => a + x.percent, 0)
                  return `${s.color} ${start}% ${start + s.percent}%`
                }).join(', ')})`,
              }}
            />
            <div className="absolute inset-4 bg-card rounded-full flex items-center justify-center">
              <div className="text-center">
                <span className="block font-bold text-lg">100%</span>
                <span className="text-[9px] font-bold text-muted-foreground uppercase">Total</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-4 text-[10px] text-muted-foreground">
            {salesByStore.map((s, i) => (
              <span key={i} className="flex items-center">
                <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        </GlassCard>

        {/* Progress - Sales vs Target */}
        <GlassCard className="p-5 flex flex-col justify-center">
          <h4 className="text-xs font-bold text-muted-foreground uppercase mb-4">
            {t('playtelecom:supervisor.salesVsTarget', { defaultValue: 'Ventas vs Meta' })}
          </h4>
          <div className="space-y-6">
            {salesVsTarget.map((item, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{item.store}</span>
                  <span className={cn('font-bold', item.percent >= 70 ? 'text-green-400' : 'text-amber-400')}>
                    {item.percent}%
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden relative">
                  <div className={cn('h-full rounded-full', item.color)} style={{ width: `${item.percent}%` }} />
                  <div className="absolute top-0 bottom-0 w-[2px] bg-foreground/30" style={{ left: '90%' }} />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Bar - Promoter Ranking */}
        <GlassCard className="p-5 flex flex-col">
          <h4 className="text-xs font-bold text-muted-foreground uppercase mb-4">
            {t('playtelecom:supervisor.promoterRanking', { defaultValue: 'Ranking Promotores' })}
          </h4>
          <div className="flex-1 flex items-end justify-around gap-4 min-h-[160px]">
            {promoterRanking.map((p, i) => (
              <div key={i} className="flex flex-col items-center w-full h-full justify-end group">
                <div className={cn(
                  'text-[10px] font-bold mb-1 transition-opacity',
                  p.isYou ? 'text-green-400 opacity-100' : 'opacity-0 group-hover:opacity-100'
                )}>
                  {formatCurrency(p.amount)}
                </div>
                <div
                  className={cn(
                    'w-full rounded-t-md transition-all cursor-pointer',
                    p.isYou
                      ? 'bg-gradient-to-t from-green-600 to-green-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                      : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  )}
                  style={{ height: `${(p.amount / maxPromoterAmount) * 100}%`, minHeight: '8px' }}
                />
                <span className={cn(
                  'text-[10px] mt-2 font-bold',
                  p.isYou ? 'bg-green-500/20 px-2 rounded-full' : 'text-muted-foreground'
                )}>
                  {p.name}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Real-time Transactions */}
      <GlassCard className="overflow-hidden">
        <div className="px-6 py-4 border-b border-border/50 flex justify-between items-center bg-card/80">
          <h3 className="font-semibold flex items-center gap-2">
            <Receipt className="w-4 h-4 text-green-400" />
            {t('playtelecom:supervisor.transactions', { defaultValue: 'Transacciones en tiempo real' })}
          </h3>
          <Button size="sm" onClick={handleDownloadReport} className="bg-green-600 hover:bg-green-500 gap-2">
            <Download className="w-3.5 h-3.5" />
            {t('playtelecom:supervisor.downloadReport', { defaultValue: 'DESCARGAR REPORTE' })}
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 text-xs uppercase font-bold text-muted-foreground">
              <tr>
                <th className="px-6 py-3">ID / Venta</th>
                <th className="px-6 py-3">{t('playtelecom:supervisor.store', { defaultValue: 'Tienda' })}</th>
                <th className="px-6 py-3">ICCID / Producto</th>
                <th className="px-6 py-3">Tipo SIM</th>
                <th className="px-6 py-3">{t('playtelecom:supervisor.seller', { defaultValue: 'Vendedor' })}</th>
                <th className="px-6 py-3 text-right">{t('playtelecom:supervisor.amount', { defaultValue: 'Monto' })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {transactions.map((tx, i) => (
                <tr key={i} className="hover:bg-muted/20 transition group">
                  <td className="px-6 py-3 font-mono text-primary group-hover:text-foreground transition-colors">{tx.id}</td>
                  <td className="px-6 py-3 text-muted-foreground">{tx.store}</td>
                  <td className="px-6 py-3">
                    <div className="font-medium">{tx.product}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{tx.iccid}</div>
                  </td>
                  <td className="px-6 py-3">
                    <Badge
                      className="text-[10px]"
                      style={{
                        backgroundColor: `${tx.simColor}20`,
                        color: tx.simColor,
                        borderColor: `${tx.simColor}50`,
                      }}
                    >
                      {tx.simType}
                    </Badge>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">{tx.seller}</td>
                  <td className="px-6 py-3 text-right text-green-400 font-bold font-mono">{formatCurrency(tx.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  )
}

export default SupervisorDashboard
