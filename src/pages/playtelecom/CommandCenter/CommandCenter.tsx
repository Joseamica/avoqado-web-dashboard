/**
 * CommandCenter - Master Command Center Dashboard
 *
 * Matches mockup: file:///Users/amieva/Downloads/mockups%20sistema%20bait%20/index.html
 *
 * Features:
 * - 4 KPI metric cards with trends (sales, money in street, stock, anomalies)
 * - Dual charts: Ingresos vs Meta (area) + Volumen vs Meta (bar+line)
 * - Promotores online radial gauge
 * - Live activity feed
 * - Operational insights (top store, worst store, top promoter, worst attendance)
 * - Anomalies table with filters
 *
 * Access: MANAGER+ only
 */

import { useTranslation } from 'react-i18next'
import { useState, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import {
  useStoresOverview,
  useStoresVenues,
  useStoresOnlineStaff,
  useStoresActivityFeed,
  useStoresStockSummary,
  useStoresAnomalies,
  useStoresRevenueVsTarget,
  useStoresVolumeVsTarget,
  useStoresTopPromoter,
  useStoresWorstAttendance,
} from '@/hooks/useStoresAnalysis'
import type { ActivityFeedEvent } from '@/services/storesAnalysis.service'
import { GlassCard } from '@/components/ui/glass-card'
import { LiveActivityFeed, InsightCard, GaugeChart } from '@/components/playtelecom'
import { Badge } from '@/components/ui/badge'
import { StatusPulse } from '@/components/ui/status-pulse'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FilterPill } from '@/components/filters/FilterPill'
import { CheckboxFilterContent } from '@/components/filters/CheckboxFilterContent'
import { DateFilterContent, type DateFilter } from '@/components/filters/DateFilterContent'
import { Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts'
import { DollarSign, AlertTriangle, Package, TrendingUp, TrendingDown, Award, UserX, Download, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getIntlLocale } from '@/utils/i18n-locale'

const ACTIVITY_TYPE_BADGE_CLASSES: Record<ActivityFeedEvent['type'], string> = {
  sale: 'bg-green-500/10 text-green-600 dark:text-green-400',
  checkin: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  checkout: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  gps_error: 'bg-red-500/10 text-red-600 dark:text-red-400',
  alert: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  other: 'bg-muted text-muted-foreground',
}

export default function CommandCenter() {
  const { t, i18n } = useTranslation(['playtelecom', 'common'])
  const { activeVenue } = useAuth()
  const { venueId, venue } = useCurrentVenue()
  const intlLocale = getIntlLocale(i18n.language)
  const [selectedView, setSelectedView] = useState('global')
  const [selectedStore, setSelectedStore] = useState('all')
  const [selectedPeriod, setSelectedPeriod] = useState('today')
  const [activityDialogOpen, setActivityDialogOpen] = useState(false)
  const [activityVenueFilter, setActivityVenueFilter] = useState<string[]>([])
  const [activityPromoterFilter, setActivityPromoterFilter] = useState<string[]>([])
  const [activityTypeFilter, setActivityTypeFilter] = useState<string[]>([])
  const [activityDateFilter, setActivityDateFilter] = useState<DateFilter | null>(null)
  const chartVenueId = selectedView === 'global' ? undefined : selectedView

  // Fetch organization-wide data via venue-level endpoints (white-label access)
  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useStoresOverview({ refetchInterval: 60000 })
  const { data: venuesResponse, isLoading: venuesLoading, refetch: refetchVenues } = useStoresVenues({ refetchInterval: 60000 })
  const { data: onlineStaff, isLoading: onlineStaffLoading, refetch: refetchOnlineStaff } = useStoresOnlineStaff({ refetchInterval: 60000 })
  const { data: activityFeed, isLoading: activityFeedLoading, refetch: refetchActivityFeed } = useStoresActivityFeed(30, { refetchInterval: 60000 })
  const { data: stockSummary, isLoading: stockLoading, refetch: refetchStockSummary } = useStoresStockSummary({ refetchInterval: 120000 })
  const { data: anomaliesData, isLoading: anomaliesLoading, refetch: refetchAnomalies } = useStoresAnomalies({ refetchInterval: 120000 })
  const { data: revenueChartData, isLoading: revenueChartLoading, refetch: refetchRevenueChart } = useStoresRevenueVsTarget({
    refetchInterval: 120000,
    filterVenueId: chartVenueId,
  })
  const { data: volumeChartData, isLoading: volumeChartLoading, refetch: refetchVolumeChart } = useStoresVolumeVsTarget({
    refetchInterval: 120000,
    filterVenueId: chartVenueId,
  })
  const { data: topPromoter, refetch: refetchTopPromoter } = useStoresTopPromoter({ refetchInterval: 120000 })
  const { data: worstAttendance, refetch: refetchWorstAttendance } = useStoresWorstAttendance({ refetchInterval: 120000 })

  // Extract venues array from response
  const venues = venuesResponse?.venues

  // Calculate KPIs from real organization data
  const kpis = useMemo(() => {
    if (!overview) {
      return {
        totalSales: 0,
        salesTarget: 135000, // TODO: Get from config
        moneyInStreet: 0,
        stockSims: 0,
        lowStockStores: 0,
        anomalies: 0,
        criticalAnomalies: 0,
        promotersOnline: 0,
        promotersTotal: 0,
      }
    }

    return {
      totalSales: overview.todaySales || 0,
      salesTarget: 135000, // TODO: Get from organization config
      moneyInStreet: 45200, // TODO: Calculate from pending orders
      stockSims: stockSummary?.totalPieces || 0,
      lowStockStores: stockSummary?.lowStockAlerts || 0,
      anomalies: anomaliesData?.anomalies?.length || 0,
      criticalAnomalies: anomaliesData?.anomalies?.filter(a => a.severity === 'CRITICAL').length || 0,
      promotersOnline: onlineStaff?.onlineCount || 0,
      promotersTotal: onlineStaff?.totalCount || 0,
    }
  }, [overview, onlineStaff, stockSummary, anomaliesData])

  // Format currency
  const formatCurrency = useMemo(
    () => (value: number) =>
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: activeVenue?.currency || 'MXN',
        minimumFractionDigits: 0,
      }).format(value),
    [activeVenue?.currency],
  )
  const chartAxisTickStyle = { fontSize: 11, fill: 'var(--color-muted-foreground)', fontWeight: 600 }
  const chartAxisStroke = 'var(--color-border)'
  const chartPrimary = 'var(--color-primary)'
  const chartBackground = 'var(--color-background)'

  // Transform revenue chart data
  const revenueChartFormatted = useMemo(() => {
    if (!revenueChartData?.days) return []
    return revenueChartData.days.map(day => ({
      day: day.day,
      real: day.actual,
      target: day.target,
    }))
  }, [revenueChartData])

  // Transform volume chart data
  const volumeChartFormatted = useMemo(() => {
    if (!volumeChartData?.days) return []
    return volumeChartData.days.map(day => ({
      day: day.day,
      sales: day.actual,
      target: day.target,
    }))
  }, [volumeChartData])

  const activityTypeLabels = useMemo<Record<ActivityEvent['type'], string>>(
    () => ({
      sale: t('commandCenter.activity.types.sale', { defaultValue: 'Sale' }),
      checkin: t('commandCenter.activity.types.checkin', { defaultValue: 'Check-in' }),
      checkout: t('commandCenter.activity.types.checkout', { defaultValue: 'Check-out' }),
      gps_error: t('commandCenter.activity.types.gps_error', { defaultValue: 'GPS' }),
      alert: t('commandCenter.activity.types.alert', { defaultValue: 'Alert' }),
      other: t('commandCenter.activity.types.other', { defaultValue: 'Other' }),
    }),
    [t, i18n.language],
  )

  const activityEvents = useMemo<ActivityEvent[]>(() => activityFeed?.events || [], [activityFeed])

  const liveActivities = useMemo(
    () =>
      activityEvents.map(event => ({
        id: event.id,
        type: event.type,
        title: event.title,
        subtitle: event.subtitle,
        timestamp: new Date(event.timestamp),
        severity: event.severity,
      })),
    [activityEvents],
  )

  const activityVenueOptions = useMemo(() => {
    return (venues || []).map(venue => ({
      value: venue.id,
      label: venue.name,
    }))
  }, [venues])

  const activityPromoterOptions = useMemo(() => {
    const unique = new Map<string, string>()
    const unknownLabel = t('commandCenter.activity.unknownStaff', { defaultValue: 'Staff desconocido' })
    activityEvents.forEach(event => {
      const value = event.staffId || event.staffName || 'unknown'
      const label = event.staffName || unknownLabel
      if (!unique.has(value)) unique.set(value, label)
    })
    return Array.from(unique.entries()).map(([value, label]) => ({ value, label }))
  }, [activityEvents, t, i18n.language])

  const activityTypeOptions = useMemo(() => {
    const uniqueTypes = new Set(activityEvents.map(event => event.type))
    return Array.from(uniqueTypes).map(type => ({
      value: type,
      label: activityTypeLabels[type] || type,
    }))
  }, [activityEvents, activityTypeLabels])

  const getFilterDisplayLabel = (values: string[], options: { value: string; label: string }[]) => {
    if (values.length === 0) return null
    if (values.length === 1) {
      const option = options.find(o => o.value === values[0])
      return option?.label || values[0]
    }
    return t('commandCenter.activity.filters.selectedCount', {
      count: values.length,
      defaultValue: '{{count}} seleccionados',
    })
  }

  const formatFilterDate = (value?: string | number | null) => {
    if (!value) return ''
    if (typeof value === 'number') return value.toString()
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)
    return new Intl.DateTimeFormat(intlLocale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date)
  }

  const getDateFilterLabel = (filter: DateFilter | null) => {
    if (!filter) return null
    switch (filter.operator) {
      case 'last': {
        const value = typeof filter.value === 'number' ? filter.value : parseInt(filter.value as string) || 0
        const unit = filter.unit || 'days'
        const unitLabel = t(`commandCenter.activity.filters.units.${unit}`, {
          count: value,
          defaultValue: unit,
        })
        return t('commandCenter.activity.filters.last', {
          count: value,
          unit: unitLabel,
          defaultValue: 'Ultimos {{count}} {{unit}}',
        })
      }
      case 'before':
        return t('commandCenter.activity.filters.before', {
          value: formatFilterDate(filter.value),
          defaultValue: 'Antes de {{value}}',
        })
      case 'after':
        return t('commandCenter.activity.filters.after', {
          value: formatFilterDate(filter.value),
          defaultValue: 'Despues de {{value}}',
        })
      case 'between':
        return t('commandCenter.activity.filters.between', {
          start: formatFilterDate(filter.value),
          end: formatFilterDate(filter.value2),
          defaultValue: '{{start}} - {{end}}',
        })
      case 'on':
        return t('commandCenter.activity.filters.on', {
          value: formatFilterDate(filter.value),
          defaultValue: 'En {{value}}',
        })
      default:
        return null
    }
  }

  const formatActivityTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return '-'
    return new Intl.DateTimeFormat(intlLocale, {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  const filteredActivityEvents = useMemo(() => {
    if (!activityEvents.length) return []

    const isDateMatch = (timestamp: string, filter: DateFilter | null) => {
      if (!filter) return true
      const eventDate = new Date(timestamp)
      const now = new Date()

      switch (filter.operator) {
        case 'last': {
          const value = typeof filter.value === 'number' ? filter.value : parseInt(filter.value as string) || 0
          const cutoff = new Date()
          switch (filter.unit) {
            case 'hours':
              cutoff.setHours(now.getHours() - value)
              break
            case 'days':
              cutoff.setDate(now.getDate() - value)
              break
            case 'weeks':
              cutoff.setDate(now.getDate() - value * 7)
              break
            case 'months':
              cutoff.setMonth(now.getMonth() - value)
              break
          }
          return eventDate >= cutoff
        }
        case 'before': {
          const target = new Date(filter.value as string)
          return eventDate < target
        }
        case 'after': {
          const target = new Date(filter.value as string)
          return eventDate > target
        }
        case 'between': {
          const start = new Date(filter.value as string)
          const end = new Date(filter.value2 as string)
          end.setHours(23, 59, 59, 999)
          return eventDate >= start && eventDate <= end
        }
        case 'on': {
          const target = new Date(filter.value as string)
          return (
            eventDate.getFullYear() === target.getFullYear() &&
            eventDate.getMonth() === target.getMonth() &&
            eventDate.getDate() === target.getDate()
          )
        }
        default:
          return true
      }
    }

    return activityEvents.filter(event => {
      if (activityVenueFilter.length > 0 && !activityVenueFilter.includes(event.venueId)) {
        return false
      }

      const promoterKey = event.staffId || event.staffName || 'unknown'
      if (activityPromoterFilter.length > 0 && !activityPromoterFilter.includes(promoterKey)) {
        return false
      }

      if (activityTypeFilter.length > 0 && !activityTypeFilter.includes(event.type)) {
        return false
      }

      if (!isDateMatch(event.timestamp, activityDateFilter)) {
        return false
      }

      return true
    })
  }, [activityEvents, activityVenueFilter, activityPromoterFilter, activityTypeFilter, activityDateFilter])

  const hasActivityFilters =
    activityVenueFilter.length > 0 ||
    activityPromoterFilter.length > 0 ||
    activityTypeFilter.length > 0 ||
    activityDateFilter !== null

  const clearActivityFilters = () => {
    setActivityVenueFilter([])
    setActivityPromoterFilter([])
    setActivityTypeFilter([])
    setActivityDateFilter(null)
  }

  // Get suggested action based on anomaly type
  const getAnomalyAction = (type: string): string => {
    switch (type) {
      case 'NO_CHECKINS':
        return 'Contactar encargado'
      case 'PENDING_DEPOSITS':
        return 'Revisar depósitos'
      case 'LOW_STOCK':
        return 'Reponer inventario'
      case 'LOW_PERFORMANCE':
        return 'Análisis de ventas'
      case 'GPS_VIOLATION':
        return 'Verificar ubicación'
      default:
        return 'Revisar'
    }
  }

  // Map anomalies to table format
  const anomaliesForTable = useMemo(() => {
    if (!anomaliesData?.anomalies) return []

    const filteredAnomalies = selectedStore === 'all'
      ? anomaliesData.anomalies
      : anomaliesData.anomalies.filter(anomaly => anomaly.storeId === selectedStore)

    return filteredAnomalies.map(anomaly => ({
      id: anomaly.id,
      severity: anomaly.severity === 'CRITICAL' ? ('critical' as const) : ('medium' as const),
      store: anomaly.storeName,
      promoter: 'N/A', // Backend doesn't track specific promoter in anomaly
      issue: anomaly.description,
      action: getAnomalyAction(anomaly.type),
    }))
  }, [anomaliesData, selectedStore])

  // Calculate percentage for promoters online
  const promotersPercentage = kpis.promotersTotal > 0 ? Math.round((kpis.promotersOnline / kpis.promotersTotal) * 100) : 0

  // Calculate sales vs target
  const salesVsTarget = ((kpis.totalSales / kpis.salesTarget) * 100).toFixed(1)
  const salesAchieved = parseFloat(salesVsTarget) >= 100

  // Calculate operational insights from venue data
  const operationalInsights = useMemo(() => {
    if (!venues || venues.length === 0) {
      return {
        topStore: null,
        worstStore: null,
        topPromoter: { name: 'N/A', sales: 0 },
        worstAttendance: { storeName: 'N/A', absences: 0 },
      }
    }

    // Sort venues by revenue (descending)
    const sortedByRevenue = [...venues].sort((a, b) => (b.metrics?.revenue || 0) - (a.metrics?.revenue || 0))

    return {
      topStore: sortedByRevenue[0] || null,
      worstStore: venues.length > 1 ? sortedByRevenue[sortedByRevenue.length - 1] : null,
      topPromoter: topPromoter
        ? { name: topPromoter.staffName, sales: topPromoter.salesCount }
        : { name: 'Sin datos', sales: 0 },
      worstAttendance: worstAttendance
        ? { storeName: worstAttendance.venueName, absences: worstAttendance.absences }
        : { storeName: 'Sin datos', absences: 0 },
    }
  }, [venues, topPromoter, worstAttendance])

  const isLoading = overviewLoading || venuesLoading || stockLoading || anomaliesLoading || activityFeedLoading

  // Show error if no venue configured
  if (!venueId) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-orange-500 dark:text-orange-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground mb-2">Venue no configurado</h3>
          <p className="text-sm text-muted-foreground">Esta página requiere un venue válido.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">
            {venue?.name ? `${venue.name}: Operación Nacional` : 'Centro de Comando: Operación Nacional'}
          </h2>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
            Dashboard Maestro • En Tiempo Real
            {venues && ` • ${venues.length} Tiendas`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <StatusPulse status="warning" />}
          <Button
            variant="default"
            size="icon"
            className="cursor-pointer"
            onClick={() => {
              // Refetch all queries
              refetchOverview()
              refetchVenues()
              refetchOnlineStaff()
              refetchActivityFeed()
              refetchStockSummary()
              refetchAnomalies()
              refetchRevenueChart()
              refetchVolumeChart()
              refetchTopPromoter()
              refetchWorstAttendance()
            }}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards - Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Venta Total Bruta */}
        <GlassCard className="p-6 relative overflow-hidden hover:shadow-md transition-all group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
            <Badge
              variant={salesAchieved ? 'default' : 'secondary'}
              className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20"
            >
              +12.5% vs ayer
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-wide">Venta Total Bruta</p>
          <h3 className="text-3xl font-bold text-foreground mt-1">{formatCurrency(kpis.totalSales)}</h3>
          <p className="text-[10px] text-muted-foreground mt-1">
            Meta diaria: {formatCurrency(kpis.salesTarget)}{' '}
            <span
              className={cn('font-bold', salesAchieved ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400')}
            >
              ({salesAchieved ? 'Cumplida' : `${salesVsTarget}%`})
            </span>
          </p>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-blue-500 dark:to-blue-400" />
        </GlassCard>

        {/* Dinero en Calle (Riesgo) */}
        <GlassCard className="p-6 relative overflow-hidden hover:shadow-md transition-all group border-red-500/20">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg animate-pulse">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <Button variant="link" className="text-xs font-bold text-red-600 dark:text-red-400 underline h-auto p-0 cursor-pointer">
              Ver Detalle
            </Button>
          </div>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-wide">Dinero en Calle (Riesgo)</p>
          <h3 className="text-3xl font-bold text-foreground mt-1">{formatCurrency(kpis.moneyInStreet)}</h3>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 dark:from-red-400 to-orange-500 dark:to-orange-400" />
        </GlassCard>

        {/* Stock de SIMs */}
        <GlassCard className="p-6 relative overflow-hidden hover:shadow-md transition-all group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg">
              <Package className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs font-bold text-muted-foreground cursor-pointer hover:bg-muted/80">
              <span>Global</span>
            </div>
          </div>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-wide">Stock de SIMs</p>
          <h3 className="text-3xl font-bold text-foreground mt-1">{kpis.stockSims.toLocaleString()}</h3>
          <p className="text-[10px] text-muted-foreground mt-1">{kpis.lowStockStores} tiendas con stock bajo</p>
        </GlassCard>

        {/* Anomalías Operativas */}
        <GlassCard className="p-6 relative overflow-hidden hover:shadow-md transition-all group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-muted-foreground">Hoy</span>
          </div>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-wide">Anomalías Operativas</p>
          <h3 className="text-3xl font-bold text-foreground mt-1">{kpis.anomalies}</h3>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-orange-500 dark:bg-orange-400" />
        </GlassCard>
      </div>

      {/* Row 2: Full-Width Charts - Rendimiento vs Metas */}
      <GlassCard className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Rendimiento vs Metas
            </h3>
            <p className="text-xs text-muted-foreground">Comparativa en tiempo real contra objetivos</p>
          </div>
          <Select value={selectedView} onValueChange={setSelectedView}>
            <SelectTrigger className="w-[150px] text-xs font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">Vista Global</SelectItem>
              {venues?.map(venue => (
                <SelectItem key={venue.id} value={venue.id}>
                  {venue.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[420px]">
          {/* Ingresos vs Meta (Area Chart) */}
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-end mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Ingresos vs Meta ($)</p>
              <div className="flex gap-3 text-[10px] font-bold">
                <span className="flex items-center gap-1.5 text-primary">
                  <div className="size-2.5 rounded-full bg-primary shadow-sm" />
                  Real
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <div className="w-3 h-0.5 bg-muted-foreground border border-dashed rounded-full" />
                  Meta
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={revenueChartFormatted}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartPrimary} stopOpacity={0.7} />
                    <stop offset="95%" stopColor={chartPrimary} stopOpacity={0.15} />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartAxisStroke} opacity={0.2} vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={chartAxisTickStyle}
                  stroke={chartAxisStroke}
                  tickLine={false}
                  axisLine={{ strokeWidth: 1.5 }}
                />
                <YAxis
                  tick={chartAxisTickStyle}
                  stroke={chartAxisStroke}
                  tickLine={false}
                  axisLine={{ strokeWidth: 1.5 }}
                  tickFormatter={val => `$${(val / 1000).toFixed(0)}k`}
                />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm p-3 shadow-xl">
                        <p className="text-xs font-bold text-muted-foreground mb-2">{payload[0].payload.day}</p>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                              <div className="size-2 rounded-full bg-primary" />
                              Real
                            </span>
                            <span className="text-sm font-bold text-foreground">{formatCurrency(payload[0].value as number)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                              <div className="size-2 rounded-full bg-muted-foreground" />
                              Meta
                            </span>
                            <span className="text-sm font-bold text-foreground">{formatCurrency(payload[1].value as number)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="real"
                  stroke={chartPrimary}
                  strokeWidth={3}
                  fill="url(#revenueGradient)"
                  filter="url(#glow)"
                  activeDot={{ r: 6, strokeWidth: 2, stroke: chartBackground, fill: chartPrimary }}
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Volumen vs Meta (Bar + Line) */}
          <div className="flex flex-col h-full border-l border-border/50 pl-8">
            <div className="flex justify-between items-end mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Volumen vs Meta (#)</p>
              <div className="flex gap-3 text-[10px] font-bold">
                <span className="flex items-center gap-1.5 text-pink-600 dark:text-pink-400">
                  <div className="size-2.5 rounded-sm bg-pink-600 dark:bg-pink-400 shadow-sm" />
                  Venta
                </span>
                <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                  <div className="w-3 h-0.5 bg-green-600 dark:bg-green-400 rounded-full shadow-sm" />
                  Obj.
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={volumeChartFormatted}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ec4899" stopOpacity={1} />
                    <stop offset="100%" stopColor="#ec4899" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartAxisStroke} opacity={0.2} vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={chartAxisTickStyle}
                  stroke={chartAxisStroke}
                  tickLine={false}
                  axisLine={{ strokeWidth: 1.5 }}
                />
                <YAxis
                  tick={chartAxisTickStyle}
                  stroke={chartAxisStroke}
                  tickLine={false}
                  axisLine={{ strokeWidth: 1.5 }}
                />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm p-3 shadow-xl">
                        <p className="text-xs font-bold text-muted-foreground mb-2">{payload[0].payload.day}</p>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs font-semibold text-pink-600 dark:text-pink-400 flex items-center gap-1.5">
                              <div className="size-2 rounded-sm bg-pink-600 dark:bg-pink-400" />
                              Ventas
                            </span>
                            <span className="text-sm font-bold text-foreground">{payload[0].value}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs font-semibold text-green-600 dark:text-green-400 flex items-center gap-1.5">
                              <div className="size-2 rounded-full bg-green-600 dark:bg-green-400" />
                              Objetivo
                            </span>
                            <span className="text-sm font-bold text-foreground">{payload[1].value}</span>
                          </div>
                        </div>
                      </div>
                    )
                  }}
                />
                <Bar
                  dataKey="sales"
                  fill="url(#barGradient)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                  cursor="pointer"
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="#22c55e"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: chartBackground, fill: '#22c55e' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </GlassCard>

      {/* Row 3: Promotores Online + Live Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Promotores Online (Radial Gauge) */}
        <GlassCard className="p-6 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="w-full flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-foreground">Promotores Online</h3>
            <Badge variant="secondary" className="text-[10px] font-bold bg-green-500/10 text-green-600 dark:text-green-400 animate-pulse">
              En vivo
            </Badge>
          </div>
          <GaugeChart value={promotersPercentage} max={100} label="" size="sm" colorScheme="green" />
          <div className="text-center mt-4">
            <p className="text-3xl font-bold text-foreground">
              {kpis.promotersOnline}
              <span className="text-sm text-muted-foreground font-medium">/{kpis.promotersTotal}</span>
            </p>
            <p className="text-xs text-muted-foreground font-medium">Conectados ahora mismo</p>
          </div>
        </GlassCard>

        {/* Live Activity Feed */}
        <GlassCard className="flex flex-col overflow-hidden p-4">
          <LiveActivityFeed
            activities={liveActivities}
            maxHeight="h-64"
            showTimestamps={false}
            onViewAll={() => setActivityDialogOpen(true)}
            viewAllLabel={t('commandCenter.activity.viewMore', { defaultValue: 'Ver mas' })}
          />
        </GlassCard>
      </div>

      {/* Insights Operativos (Destacados) */}
      <div>
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          Insights Operativos (Destacados)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Tienda Líder (Ventas) - Top performing store */}
          <InsightCard
            icon={Award}
            title="Tienda Líder (Ventas)"
            subtitle={operationalInsights.topStore?.name || 'Sin datos'}
            value={operationalInsights.topStore ? formatCurrency(operationalInsights.topStore.metrics?.revenue || 0) : '--'}
            type="success"
          />

          {/* 2. Menor Venta - Lowest performing store */}
          <InsightCard
            icon={TrendingDown}
            title="Menor Venta"
            subtitle={operationalInsights.worstStore?.name || 'Sin datos'}
            value={operationalInsights.worstStore ? formatCurrency(operationalInsights.worstStore.metrics?.revenue || 0) : '--'}
            type="danger"
          />

          {/* 3. Top Promotor - Best salesperson */}
          <InsightCard
            icon={Award}
            title="Top Promotor"
            subtitle={operationalInsights.topPromoter.name}
            value={`${operationalInsights.topPromoter.sales} SIMs activadas`}
            type="success"
          />

          {/* 4. Peor Asistencia - Worst attendance */}
          <InsightCard
            icon={UserX}
            title="Peor Asistencia"
            subtitle={operationalInsights.worstAttendance.storeName}
            value={`${operationalInsights.worstAttendance.absences} faltas hoy`}
            type="danger"
          />
        </div>
      </div>

      {/* Anomalías Críticas (Table) */}
      <GlassCard className="overflow-hidden">
        <div className="px-6 py-5 border-b border-border flex flex-col sm:flex-row justify-between items-center bg-muted/30 gap-4">
          <h3 className="font-bold text-foreground flex items-center gap-2 text-sm uppercase tracking-wide">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            Anomalías Críticas
          </h3>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger className="w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las Tiendas</SelectItem>
                {venues?.map(venue => (
                  <SelectItem key={venue.id} value={venue.id}>
                    {venue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="yesterday">Ayer</SelectItem>
                <SelectItem value="week">Última Semana</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" className="cursor-pointer">
              <Download className="w-3.5 h-3.5 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="font-bold uppercase w-24">Estado</TableHead>
                <TableHead className="font-bold uppercase">Tienda</TableHead>
                <TableHead className="font-bold uppercase">Promotor</TableHead>
                <TableHead className="font-bold uppercase">Detalle del Problema</TableHead>
                <TableHead className="font-bold uppercase text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {anomaliesForTable.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    <div className="flex flex-col items-center gap-2">
                      <AlertTriangle className="w-8 h-8 text-muted-foreground/50" />
                      <p className="text-sm font-medium">No hay anomalías detectadas</p>
                      <p className="text-xs">Todo operando normalmente</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                anomaliesForTable.map(anomaly => (
                  <TableRow key={anomaly.id} className={cn('transition-colors', anomaly.severity === 'critical' && 'hover:bg-red-500/10')}>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-[10px] font-bold uppercase',
                          anomaly.severity === 'critical' && 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
                          anomaly.severity === 'medium' &&
                            'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20',
                        )}
                      >
                        {anomaly.severity === 'critical' ? 'Crítico' : 'Medio'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-foreground">{anomaly.store}</TableCell>
                    <TableCell className="text-muted-foreground">{anomaly.promoter}</TableCell>
                    <TableCell>
                      <div
                        className={cn(
                          'flex items-center gap-2 font-bold text-xs',
                          anomaly.severity === 'critical' && 'text-red-600 dark:text-red-400',
                          anomaly.severity === 'medium' && 'text-orange-600 dark:text-orange-400',
                        )}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {anomaly.issue}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="link" className="text-primary font-bold text-xs h-auto p-0 cursor-pointer">
                        {anomaly.action}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </GlassCard>

      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="max-w-7xl w-[96vw] h-[90vh] max-h-[90vh] p-0 overflow-hidden">
          <div className="flex h-full min-h-0 flex-col">
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-border bg-muted/20">
              <DialogTitle>{t('commandCenter.activity.title', { defaultValue: 'Actividad' })}</DialogTitle>
            </DialogHeader>

            <div className="px-6 py-4 border-b border-border">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
                <FilterPill
                  label={t('commandCenter.activity.filters.date', { defaultValue: 'Fecha' })}
                  activeValue={getDateFilterLabel(activityDateFilter)}
                  isActive={activityDateFilter !== null}
                  onClear={() => setActivityDateFilter(null)}
                >
                  <DateFilterContent
                    title={t('commandCenter.activity.filters.dateTitle', { defaultValue: 'Filtrar por fecha' })}
                    value={activityDateFilter}
                    onApply={setActivityDateFilter}
                    showTimezone={false}
                    labels={{
                      inTheLast: t('commandCenter.activity.filters.dateOperators.last', {
                        defaultValue: 'está en los últimos',
                      }),
                      before: t('commandCenter.activity.filters.dateOperators.before', {
                        defaultValue: 'es antes de',
                      }),
                      after: t('commandCenter.activity.filters.dateOperators.after', {
                        defaultValue: 'es después de',
                      }),
                      between: t('commandCenter.activity.filters.dateOperators.between', {
                        defaultValue: 'está entre',
                      }),
                      on: t('commandCenter.activity.filters.dateOperators.on', {
                        defaultValue: 'es en',
                      }),
                      hours: t('commandCenter.activity.filters.units.hours', { count: 2, defaultValue: 'horas' }),
                      days: t('commandCenter.activity.filters.units.days', { count: 2, defaultValue: 'días' }),
                      weeks: t('commandCenter.activity.filters.units.weeks', { count: 2, defaultValue: 'semanas' }),
                      months: t('commandCenter.activity.filters.units.months', { count: 2, defaultValue: 'meses' }),
                      and: t('commandCenter.activity.filters.and', { defaultValue: 'y' }),
                      apply: t('commandCenter.activity.filters.apply', { defaultValue: 'Aplicar' }),
                      clear: t('commandCenter.activity.filters.clearAction', { defaultValue: 'Limpiar' }),
                      timezone: t('commandCenter.activity.filters.timezone', { defaultValue: 'Zona horaria' }),
                    }}
                  />
                </FilterPill>

                <FilterPill
                  label={t('commandCenter.activity.filters.venue', { defaultValue: 'Tienda' })}
                  activeValue={getFilterDisplayLabel(activityVenueFilter, activityVenueOptions)}
                  isActive={activityVenueFilter.length > 0}
                  onClear={() => setActivityVenueFilter([])}
                >
                  <CheckboxFilterContent
                    title={t('commandCenter.activity.filters.venueTitle', { defaultValue: 'Filtrar por tienda' })}
                    options={activityVenueOptions}
                    selectedValues={activityVenueFilter}
                    onApply={setActivityVenueFilter}
                    searchable
                    searchPlaceholder={t('commandCenter.activity.filters.searchVenue', { defaultValue: 'Buscar tienda...' })}
                    applyLabel={t('commandCenter.activity.filters.apply', { defaultValue: 'Aplicar' })}
                    clearLabel={t('commandCenter.activity.filters.clearAction', { defaultValue: 'Limpiar' })}
                    emptyLabel={t('common:no_results', { defaultValue: 'Sin resultados' })}
                  />
                </FilterPill>

                <FilterPill
                  label={t('commandCenter.activity.filters.promoter', { defaultValue: 'Promotor' })}
                  activeValue={getFilterDisplayLabel(activityPromoterFilter, activityPromoterOptions)}
                  isActive={activityPromoterFilter.length > 0}
                  onClear={() => setActivityPromoterFilter([])}
                >
                  <CheckboxFilterContent
                    title={t('commandCenter.activity.filters.promoterTitle', { defaultValue: 'Filtrar por promotor' })}
                    options={activityPromoterOptions}
                    selectedValues={activityPromoterFilter}
                    onApply={setActivityPromoterFilter}
                    searchable
                    searchPlaceholder={t('commandCenter.activity.filters.searchPromoter', { defaultValue: 'Buscar promotor...' })}
                    applyLabel={t('commandCenter.activity.filters.apply', { defaultValue: 'Aplicar' })}
                    clearLabel={t('commandCenter.activity.filters.clearAction', { defaultValue: 'Limpiar' })}
                    emptyLabel={t('common:no_results', { defaultValue: 'Sin resultados' })}
                  />
                </FilterPill>

                <FilterPill
                  label={t('commandCenter.activity.filters.type', { defaultValue: 'Tipo' })}
                  activeValue={getFilterDisplayLabel(activityTypeFilter, activityTypeOptions)}
                  isActive={activityTypeFilter.length > 0}
                  onClear={() => setActivityTypeFilter([])}
                >
                  <CheckboxFilterContent
                    title={t('commandCenter.activity.filters.typeTitle', { defaultValue: 'Filtrar por tipo' })}
                    options={activityTypeOptions}
                    selectedValues={activityTypeFilter}
                    onApply={setActivityTypeFilter}
                    applyLabel={t('commandCenter.activity.filters.apply', { defaultValue: 'Aplicar' })}
                    clearLabel={t('commandCenter.activity.filters.clearAction', { defaultValue: 'Limpiar' })}
                    emptyLabel={t('common:no_results', { defaultValue: 'Sin resultados' })}
                  />
                </FilterPill>

                {hasActivityFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearActivityFilters}
                    className="h-8 rounded-full"
                  >
                    {t('commandCenter.activity.filters.clear', { defaultValue: 'Borrar filtros' })}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6">
              <div className="h-full overflow-hidden rounded-2xl border border-border bg-background">
                <div className="h-full overflow-auto">
                  <Table className="min-w-[900px]">
                    <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
                      <TableRow className="text-xs uppercase text-muted-foreground">
                        <TableHead className="pl-6">{t('commandCenter.activity.table.date', { defaultValue: 'Fecha' })}</TableHead>
                        <TableHead>{t('commandCenter.activity.table.type', { defaultValue: 'Tipo' })}</TableHead>
                        <TableHead>{t('commandCenter.activity.table.venue', { defaultValue: 'Tienda' })}</TableHead>
                        <TableHead>{t('commandCenter.activity.table.promoter', { defaultValue: 'Promotor' })}</TableHead>
                        <TableHead className="pr-6">{t('commandCenter.activity.table.detail', { defaultValue: 'Detalle' })}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredActivityEvents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                            {t('commandCenter.activity.table.empty', {
                              defaultValue: 'No hay actividad para los filtros seleccionados',
                            })}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredActivityEvents.map(event => (
                          <TableRow key={event.id} className="border-border/60 hover:bg-muted/30">
                            <TableCell className="pl-6 text-xs text-muted-foreground whitespace-nowrap">
                              {formatActivityTimestamp(event.timestamp)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={cn(
                                  'text-[10px] font-semibold uppercase tracking-wide',
                                  ACTIVITY_TYPE_BADGE_CLASSES[event.type] || 'bg-muted text-muted-foreground',
                                )}
                              >
                                {activityTypeLabels[event.type] || event.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium text-foreground">
                              {event.venueName || t('commandCenter.activity.unknownVenue', { defaultValue: 'Sin tienda' })}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {event.staffName || t('commandCenter.activity.unknownStaff', { defaultValue: 'Staff desconocido' })}
                            </TableCell>
                            <TableCell className="pr-6">
                              <div className="font-medium text-foreground">{event.title}</div>
                              {event.subtitle && (
                                <div className="text-xs text-muted-foreground">{event.subtitle}</div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
