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
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Store, TrendingUp, TrendingDown, Download, Receipt, Plus, FileSpreadsheet, FileText, Sheet } from 'lucide-react'
import { exportToCSV, exportToExcel, generateFilename, formatDateForExport, formatCurrencyForExport } from '@/utils/export'
import { useToast } from '@/hooks/use-toast'
import CreateStoreGoalDialog from './CreateStoreGoalDialog'
import { DateRangePicker } from '@/components/date-range-picker'
import { getIntlLocale } from '@/utils/i18n-locale'
import { getToday } from '@/utils/datetime'
import { useAuth } from '@/context/AuthContext'
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
  const { t, i18n } = useTranslation(['playtelecom', 'common'])
  const { activeVenue } = useAuth()
  const { toast } = useToast()
  const localeCode = getIntlLocale(i18n.language)

  const venueTimezone = activeVenue?.timezone || 'America/Mexico_City'

  const [storeFilter, setStoreFilter] = useState('all')
  const [selectedRange, setSelectedRange] = useState<{ from: Date; to: Date }>(() => getToday(venueTimezone))
  const [hoveredPieIndex, setHoveredPieIndex] = useState<number | null>(null)
  const [goalDialogOpen, setGoalDialogOpen] = useState(false)
  const [selectedStoreForGoal, setSelectedStoreForGoal] = useState<string | null>(null)
  const [editGoalId, setEditGoalId] = useState<string | null>(null)
  const [editGoalAmount, setEditGoalAmount] = useState<number | undefined>()
  const [editGoalPeriod, setEditGoalPeriod] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | undefined>()

  // Derive ISO date strings from selected range for API calls
  const startDateISO = selectedRange.from.toISOString()
  const endDateISO = selectedRange.to.toISOString()

  // Previous day range for "vs dia anterior" comparison
  const prevDayDates = useMemo(() => {
    const prev = new Date(selectedRange.from)
    prev.setDate(prev.getDate() - 1)
    const end = new Date(prev.getTime() + 86400000 - 1)
    return { start: prev.toISOString(), end: end.toISOString() }
  }, [selectedRange.from])

  // Use venue-level hooks for white-label access — pass date range to filter data
  const { data: overview } = useStoresOverview({
    startDate: startDateISO,
    endDate: endDateISO,
    filterVenueId: storeFilter !== 'all' ? storeFilter : undefined,
  })
  const { data: previousOverview } = useStoresOverview({
    startDate: prevDayDates.start,
    endDate: prevDayDates.end,
    filterVenueId: storeFilter !== 'all' ? storeFilter : undefined,
  })
  const { data: _stockSummary } = useStoresStockSummary()
  const { data: venuesResponse } = useStoresVenues()
  const { data: activityFeed } = useStoresActivityFeed(20, {
    refetchInterval: 30000,
    startDate: startDateISO,
    endDate: endDateISO,
    filterVenueId: storeFilter !== 'all' ? storeFilter : undefined,
  })
  const { data: _revenueData } = useStoresRevenueVsTarget()
  const { data: storePerformanceData } = useStoresStorePerformance({ startDate: startDateISO, endDate: endDateISO })
  const { data: attendanceData } = useStoresStaffAttendance({
    date: selectedRange.from.toISOString().split('T')[0],
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
    const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: venueTimezone }
    return attendanceData.staff.flatMap(entry => {
      const allEntries = (entry as any).allTimeEntries as Array<{
        clockInTime: string | null
        clockOutTime: string | null
        checkInPhotoUrl: string | null
      }> | undefined

      // If backend provides allTimeEntries, create one row per entry
      if (allEntries && allEntries.length > 0) {
        return allEntries.map(te => ({
          store: entry.venueName,
          promoter: entry.name,
          clockIn: te.clockInTime
            ? new Date(te.clockInTime).toLocaleTimeString('es-MX', timeOpts).toUpperCase()
            : '--:--',
          clockOut: te.clockOutTime
            ? new Date(te.clockOutTime).toLocaleTimeString('es-MX', timeOpts).toUpperCase()
            : '--:--',
          sales: entry.sales || 0,
          hasDepositPhoto: !!te.checkInPhotoUrl,
        }))
      }

      // Fallback: single row from top-level fields
      return [{
        store: entry.venueName,
        promoter: entry.name,
        clockIn: entry.checkInTime
          ? new Date(entry.checkInTime).toLocaleTimeString('es-MX', timeOpts).toUpperCase()
          : '--:--',
        clockOut: entry.checkOutTime
          ? new Date(entry.checkOutTime).toLocaleTimeString('es-MX', timeOpts).toUpperCase()
          : '--:--',
        sales: entry.sales || 0,
        hasDepositPhoto: !!entry.checkInPhotoUrl,
      }]
    })
  }, [attendanceData, venueTimezone])

  // Derive transactions from activity feed
  const transactions = useMemo(() => {
    if (!activityFeed?.events) return []
    const colors = ['#6366f1', '#0ea5e9', '#a855f7', '#f59e0b', '#10b981']
    return activityFeed.events
      .filter(e => e.type === 'sale' || e.type === 'checkin')
      .slice(0, 10)
      .map((e, i) => ({
        id: `#${e.id.slice(-6).toUpperCase()}`,
        type: e.type as 'sale' | 'checkin',
        store: e.venueName || '',
        product: e.title,
        iccid: (e.metadata?.iccid as string) || '--',
        simType: e.type === 'sale' ? (e.metadata?.categoryName as string) || 'SIM' : null,
        simColor: colors[i % colors.length],
        seller: e.staffName || '--',
        amount: e.type === 'sale' ? (e.metadata?.total as number) || (e.metadata?.amount as number) || 0 : null,
        timestamp: e.timestamp,
      }))
  }, [activityFeed])

  const storesOpen = overview?.activeStores ?? 0
  const totalStores = overview?.totalStores ?? venuesData?.length ?? storesOpen
  const storesClosed = Math.max(totalStores - storesOpen, 0)
  const coveragePercent = totalStores > 0 ? Math.round((storesOpen / totalStores) * 100) : 0
  const cashInField = (overview?.todayCashSales ?? 0) - (overview?.approvedDeposits ?? 0)
  const previousCashInField = (previousOverview?.todayCashSales ?? 0) - (previousOverview?.approvedDeposits ?? 0)
  const cashChangePercent = previousCashInField > 0 ? Math.round(((cashInField - previousCashInField) / previousCashInField) * 100) : null
  const depositPercent =
    (overview?.todayCashSales ?? 0) > 0 ? Math.round(((overview?.approvedDeposits ?? 0) / overview!.todayCashSales) * 100) : 0

  // Chart data - derive from store performance
  const salesByStore = useMemo(() => {
    if (!storePerformanceData?.stores?.length) return []
    const total = storePerformanceData.stores.reduce((a, s) => a + s.todaySales, 0)
    if (total === 0) return [] // No sales → show empty state
    const colors = ['#10b981', '#3b82f6', '#64748b', '#f59e0b', '#a855f7']
    return storePerformanceData.stores.slice(0, 5).map((s, i) => ({
      label: s.name.length > 10 ? s.name.slice(0, 10) : s.name,
      fullName: s.name,
      percent: Math.round((s.todaySales / total) * 100),
      amount: s.todaySales,
      color: colors[i % colors.length],
    }))
  }, [storePerformanceData])
  const totalSalesByStore = salesByStore.reduce((a, s) => a + s.amount, 0)

  const salesVsTarget = useMemo(() => {
    if (!storePerformanceData?.stores?.length) return []
    return storePerformanceData.stores.slice(0, 4).map(s => {
      const perf = Number.isFinite(s.performance) ? s.performance : 0
      return {
        id: s.id,
        store: s.name,
        percent: Math.min(perf, 150), // Allow up to 150% for overachievers
        barPercent: Math.min(perf, 100), // Bar capped at 100%
        color: perf >= 70 ? 'bg-green-500' : 'bg-amber-500',
        hasGoal: s.goalAmount != null,
        goalId: s.goalId,
        goalPeriod: s.goalPeriod,
        amount: s.todaySales,
        goalAmount: s.goalAmount ?? 0,
      }
    })
  }, [storePerformanceData])

  const promoterRanking = useMemo(() => {
    if (!attendanceData?.staff?.length) return []
    // Aggregate sales by promoter name (same person may appear in multiple venues)
    const salesByPromoter = new Map<string, number>()
    for (const s of attendanceData.staff) {
      const current = salesByPromoter.get(s.name) || 0
      salesByPromoter.set(s.name, current + (s.sales ?? 0))
    }
    return Array.from(salesByPromoter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amount]) => ({
        name,
        amount,
        isYou: false,
      }))
  }, [attendanceData])

  const maxPromoterAmount = Math.max(...promoterRanking.map(p => p.amount), 1)

  // Derive store options for goal dialog
  const storeOptions = useMemo(() => {
    if (!storePerformanceData?.stores?.length) return []
    return storePerformanceData.stores.map(s => ({ id: s.id, name: s.name }))
  }, [storePerformanceData])

  const handleOpenGoalDialog = useCallback(
    (storeId?: string, goalId?: string, goalAmount?: number, goalPeriod?: 'DAILY' | 'WEEKLY' | 'MONTHLY') => {
      setSelectedStoreForGoal(storeId || null)
      setEditGoalId(goalId || null)
      setEditGoalAmount(goalAmount)
      setEditGoalPeriod(goalPeriod)
      setGoalDialogOpen(true)
    },
    [],
  )

  const buildExportData = useCallback(() => {
    if (!activityFeed?.events?.length) return null
    const events = activityFeed.events.filter(e => e.type === 'sale' || e.type === 'checkin')
    if (events.length === 0) return null
    return events.map(e => ({
      ID: e.id.slice(-6).toUpperCase(),
      [t('playtelecom:supervisor.exportHeaders.type', { defaultValue: 'Tipo' })]:
        e.type === 'sale' ? 'Venta' : 'Check-in',
      [t('playtelecom:supervisor.exportHeaders.store', { defaultValue: 'Tienda' })]: e.venueName || '',
      [t('playtelecom:supervisor.exportHeaders.product', { defaultValue: 'Producto' })]: e.title,
      ICCID: (e.metadata?.iccid as string) || '',
      [t('playtelecom:supervisor.exportHeaders.seller', { defaultValue: 'Vendedor' })]: e.staffName || '',
      [t('playtelecom:supervisor.exportHeaders.amount', { defaultValue: 'Monto' })]:
        e.type === 'sale' ? formatCurrencyForExport((e.metadata?.total as number) || (e.metadata?.amount as number) || 0) : '-',
      [t('playtelecom:supervisor.exportHeaders.date', { defaultValue: 'Fecha' })]: formatDateForExport(e.timestamp),
    }))
  }, [activityFeed, t])

  const handleExport = useCallback(
    async (format: 'csv' | 'excel' | 'sheets') => {
      const data = buildExportData()
      if (!data) return
      const filename = generateFilename('transacciones')
      try {
        if (format === 'csv') {
          exportToCSV(data, filename)
        } else if (format === 'excel') {
          await exportToExcel(data, filename, 'Transacciones')
        } else {
          // Google Sheets: export CSV then open Google Sheets import
          exportToCSV(data, filename)
          window.open('https://sheets.new', '_blank')
        }
        toast({
          title: t('playtelecom:supervisor.exportSuccess', { defaultValue: 'Reporte descargado' }),
        })
      } catch (_error) {
        toast({
          title: t('playtelecom:supervisor.exportError', { defaultValue: 'Error al descargar reporte' }),
          variant: 'destructive',
        })
      }
    },
    [buildExportData, toast, t],
  )

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <div className="flex items-center justify-between">
        <PageTitleWithInfo
          title={t('playtelecom:supervisor.title', { defaultValue: 'Tablero Operativo' })}
          className="text-xl font-bold tracking-tight"
        />
        <div className="flex gap-3">
          <DateRangePicker
            showCompare={false}
            onUpdate={({ range }) => {
              setSelectedRange({
                from: range.from,
                to: range.to ?? range.from,
              })
            }}
            initialDateFrom={selectedRange.from}
            initialDateTo={selectedRange.to}
            align="end"
            locale={localeCode}
          />
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
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
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
          <div className="flex flex-col items-center group/gauge relative">
            <div className="relative w-[140px] h-[70px]">
              <svg viewBox="0 0 140 70" className="w-full h-full">
                {/* Background arc */}
                <path
                  d="M 15 70 A 55 55 0 0 1 125 70"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="15"
                  strokeLinecap="round"
                  className="text-muted"
                />
                {/* Filled arc */}
                <path
                  d="M 15 70 A 55 55 0 0 1 125 70"
                  fill="none"
                  stroke="rgb(34 197 94)"
                  strokeWidth="15"
                  strokeLinecap="round"
                  strokeDasharray={`${(coveragePercent / 100) * 173} 173`}
                />
              </svg>
            </div>
            <span className="text-xl font-black -mt-8 z-20">{coveragePercent}%</span>
            <span className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider group-hover/gauge:hidden">
              {t('playtelecom:supervisor.compliance', { defaultValue: 'Cumplimiento' })}
            </span>
            <span className="text-[10px] text-foreground mt-1 font-semibold hidden group-hover/gauge:inline">
              {storesOpen} / {totalStores} {t('playtelecom:supervisor.stores', { defaultValue: 'tiendas' })}
            </span>
          </div>
        </GlassCard>

        {/* Cash in Field */}
        <GlassCard className="p-5 flex flex-col justify-center relative overflow-hidden group/cash">
          <div className="absolute top-4 right-4 p-3 rounded-xl bg-green-500/10">
            {cashChangePercent != null && cashChangePercent < 0 ? (
              <TrendingDown className="w-6 h-6 text-red-500" />
            ) : (
              <TrendingUp className="w-6 h-6 text-green-500" />
            )}
          </div>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mb-2">
            {t('playtelecom:supervisor.cashInField', { defaultValue: 'Efectivo Total en Calle' })}
          </p>
          <h3 className="text-4xl font-black">{formatCurrency(cashInField)}</h3>
          {/* Progress bar: % of cash that has been deposited */}
          <div className="w-full bg-muted h-1.5 mt-4 rounded-full overflow-hidden relative">
            <div className="bg-green-500 h-full transition-all" style={{ width: `${Math.min(depositPercent, 100)}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[10px] text-muted-foreground">
              {t('playtelecom:supervisor.deposited', { defaultValue: 'Depositado' })}: {depositPercent}%
            </p>
            {/* Hover tooltip: show breakdown */}
            <p className="text-[10px] text-muted-foreground opacity-0 group-hover/cash:opacity-100 transition-opacity">
              {formatCurrency(overview?.approvedDeposits ?? 0)} / {formatCurrency(overview?.todayCashSales ?? 0)}
            </p>
          </div>
          {cashChangePercent != null ? (
            <p className={cn('text-xs mt-1 font-semibold flex items-center', cashChangePercent >= 0 ? 'text-green-400' : 'text-red-400')}>
              {cashChangePercent >= 0 ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
              {cashChangePercent >= 0 ? '+' : ''}
              {cashChangePercent}% {t('playtelecom:supervisor.vsPrevDay', { defaultValue: 'vs dia anterior' })}
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground mt-1">
              {t('playtelecom:supervisor.noPrevData', { defaultValue: 'Sin datos del dia anterior' })}
            </p>
          )}
        </GlassCard>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pie - Sales by Store */}
        <GlassCard className="p-5 flex flex-col items-center justify-center min-h-[280px]">
          <h4 className="text-xs font-bold text-muted-foreground uppercase mb-4 self-start">
            {t('playtelecom:supervisor.salesByStore', { defaultValue: 'Ventas x Tienda' })}
          </h4>
          {salesByStore.length > 0 ? (
            <>
              <div className="relative w-36 h-36">
                <div
                  className="w-full h-full rounded-full shadow-lg"
                  style={{
                    background: `conic-gradient(${salesByStore
                      .map((s, i) => {
                        const start = salesByStore.slice(0, i).reduce((a, x) => a + x.percent, 0)
                        return `${s.color} ${start}% ${start + s.percent}%`
                      })
                      .join(', ')})`,
                  }}
                />
                <div className="absolute inset-4 bg-card rounded-full flex items-center justify-center transition-all">
                  <div className="text-center px-1">
                    {hoveredPieIndex != null ? (
                      <>
                        <span className="text-sm font-black block leading-tight">
                          {formatCurrency(salesByStore[hoveredPieIndex].amount)}
                        </span>
                        <span className="text-[8px] text-muted-foreground block truncate max-w-[80px]">
                          {salesByStore[hoveredPieIndex].fullName}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-black block leading-tight">{formatCurrency(totalSalesByStore)}</span>
                        <span className="text-[8px] text-muted-foreground uppercase">Total</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-4 text-[10px] text-muted-foreground">
                {salesByStore.map((s, i) => (
                  <span
                    key={i}
                    className={cn(
                      'flex items-center cursor-pointer transition-all rounded-full px-1.5 py-0.5',
                      hoveredPieIndex === i ? 'bg-muted text-foreground scale-105' : 'hover:text-foreground',
                    )}
                    onMouseEnter={() => setHoveredPieIndex(i)}
                    onMouseLeave={() => setHoveredPieIndex(null)}
                  >
                    <span className="w-2 h-2 rounded-full mr-1 shrink-0" style={{ backgroundColor: s.color }} />
                    {s.label} {s.percent}%
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
              <Store className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">{t('playtelecom:supervisor.noSalesData', { defaultValue: 'Sin ventas registradas' })}</p>
            </div>
          )}
        </GlassCard>

        {/* Progress - Sales vs Target */}
        <GlassCard className="p-5 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold text-muted-foreground uppercase">
              {t('playtelecom:supervisor.salesVsTarget', { defaultValue: 'Ventas vs Meta' })}
            </h4>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] text-green-400 hover:text-green-300 hover:bg-green-500/10"
              onClick={() => handleOpenGoalDialog()}
            >
              <Plus className="w-3 h-3 mr-1" />
              {t('playtelecom:supervisor.goalDialog.createGoal', { defaultValue: 'Crear Meta' })}
            </Button>
          </div>
          {salesVsTarget.length > 0 ? (
            <div className="space-y-6">
              {salesVsTarget.map((item, i) => (
                <div key={i} className="group/bar relative">
                  <div className="flex justify-between text-xs mb-1 gap-2">
                    <span className="font-medium truncate min-w-0">{item.store}</span>
                    {item.hasGoal ? (
                      <>
                        <button
                          type="button"
                          className={cn(
                            'font-bold shrink-0 group-hover/bar:hidden cursor-pointer hover:underline',
                            item.percent >= 70 ? 'text-green-400' : 'text-amber-400',
                          )}
                          onClick={() => handleOpenGoalDialog(item.id, item.goalId, item.goalAmount, item.goalPeriod)}
                        >
                          {item.percent}%
                        </button>
                        <span className="hidden group-hover/bar:inline text-[10px] font-bold shrink-0 text-foreground">
                          {formatCurrency(item.amount)} / {formatCurrency(item.goalAmount)}
                        </span>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="text-muted-foreground shrink-0 text-[10px] group-hover/bar:hidden cursor-pointer hover:text-green-400 hover:underline"
                          onClick={() => handleOpenGoalDialog(item.id)}
                        >
                          {t('playtelecom:supervisor.noGoal', { defaultValue: 'Sin meta' })}
                        </button>
                        <span className="hidden group-hover/bar:inline text-[10px] font-bold shrink-0 text-foreground">
                          {formatCurrency(item.amount)}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden relative">
                    <div className={cn('h-full rounded-full transition-all', item.color)} style={{ width: `${item.barPercent}%` }} />
                    {item.hasGoal && <div className="absolute top-0 bottom-0 w-[2px] bg-foreground/30" style={{ left: '90%' }} />}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
              <Store className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">{t('playtelecom:supervisor.noGoalData', { defaultValue: 'Sin metas configuradas' })}</p>
            </div>
          )}
        </GlassCard>

        {/* Bar - Promoter Ranking */}
        <GlassCard className="p-5 flex flex-col">
          <h4 className="text-xs font-bold text-muted-foreground uppercase mb-4">
            {t('playtelecom:supervisor.promoterRanking', { defaultValue: 'Ranking Promotores' })}
          </h4>
          <div className="flex-1 flex items-end justify-around gap-4 min-h-[160px]">
            {promoterRanking.map((p, i) => (
              <div key={i} className="flex flex-col items-center w-full h-full justify-end group">
                <div
                  className={cn(
                    'text-[10px] font-bold mb-1 transition-opacity',
                    p.isYou ? 'text-green-400 opacity-100' : 'opacity-0 group-hover:opacity-100',
                  )}
                >
                  {formatCurrency(p.amount)}
                </div>
                <div
                  className={cn(
                    'w-full rounded-t-md transition-all cursor-pointer',
                    p.isYou
                      ? 'bg-gradient-to-t from-green-600 to-green-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                      : 'bg-muted-foreground/30 hover:bg-muted-foreground/50',
                  )}
                  style={{ height: `${(p.amount / maxPromoterAmount) * 100}%`, minHeight: '8px' }}
                />
                <span
                  className={cn(
                    'text-[10px] mt-2 font-bold max-w-full truncate',
                    p.isYou ? 'bg-green-500/20 px-2 rounded-full' : 'text-muted-foreground',
                  )}
                  title={p.name}
                >
                  {p.name}
                </span>
              </div>
            ))}
          </div>
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
              {storeDetailRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <Store className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">
                      {t('playtelecom:supervisor.noStoreActivity', { defaultValue: 'Sin actividad registrada para este periodo' })}
                    </p>
                  </td>
                </tr>
              ) : (
                storeDetailRows.map((row, i) => (
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
                        <Badge variant="outline" className="text-muted-foreground">
                          --
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Real-time Transactions */}
      <GlassCard className="overflow-hidden">
        <div className="px-6 py-4 border-b border-border/50 flex justify-between items-center bg-card/80">
          <h3 className="font-semibold flex items-center gap-2">
            <Receipt className="w-4 h-4 text-green-400" />
            {t('playtelecom:supervisor.transactions', { defaultValue: 'Transacciones en tiempo real' })}
          </h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="bg-green-600 hover:bg-green-500 gap-2">
                <Download className="w-3.5 h-3.5" />
                {t('playtelecom:supervisor.downloadReport', { defaultValue: 'DESCARGAR REPORTE' })}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('excel')} className="gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('sheets')} className="gap-2">
                <Sheet className="w-4 h-4" />
                Google Sheets
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv')} className="gap-2">
                <FileText className="w-4 h-4" />
                CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 text-xs uppercase font-bold text-muted-foreground">
              <tr>
                <th className="px-6 py-3">{t('playtelecom:supervisor.date', { defaultValue: 'Fecha' })}</th>
                <th className="px-6 py-3">ID / Venta</th>
                <th className="px-6 py-3">{t('playtelecom:supervisor.eventType', { defaultValue: 'Tipo' })}</th>
                <th className="px-6 py-3">{t('playtelecom:supervisor.store', { defaultValue: 'Tienda' })}</th>
                <th className="px-6 py-3">ICCID / Producto</th>
                <th className="px-6 py-3">Tipo SIM</th>
                <th className="px-6 py-3">{t('playtelecom:supervisor.seller', { defaultValue: 'Vendedor' })}</th>
                <th className="px-6 py-3 text-right">{t('playtelecom:supervisor.amount', { defaultValue: 'Monto' })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">
                      {t('playtelecom:supervisor.noTransactions', { defaultValue: 'Sin transacciones en este periodo' })}
                    </p>
                  </td>
                </tr>
              ) : (
                transactions.map((tx, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition group">
                    <td className="px-6 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(tx.timestamp).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })},{' '}
                      {new Date(tx.timestamp).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </td>
                    <td className="px-6 py-3 font-mono text-primary group-hover:text-foreground transition-colors">{tx.id}</td>
                    <td className="px-6 py-3">
                      <Badge
                        variant={tx.type === 'sale' ? 'default' : 'secondary'}
                        className="text-[10px]"
                      >
                        {tx.type === 'sale' ? t('playtelecom:supervisor.sale', { defaultValue: 'Venta' }) : 'Check-in'}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">{tx.store}</td>
                    <td className="px-6 py-3">
                      <div className="font-medium">{tx.product}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{tx.iccid}</div>
                    </td>
                    <td className="px-6 py-3">
                      {tx.simType != null ? (
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
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">{tx.seller}</td>
                    <td className="px-6 py-3 text-right font-bold font-mono">
                      {tx.amount != null ? (
                        <span className="text-green-400">{formatCurrency(tx.amount)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Goal Dialog */}
      <CreateStoreGoalDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        stores={storeOptions}
        selectedStoreId={selectedStoreForGoal}
        editGoalId={editGoalId}
        editGoalAmount={editGoalAmount}
        editGoalPeriod={editGoalPeriod}
      />
    </div>
  )
}

export default SupervisorDashboard
