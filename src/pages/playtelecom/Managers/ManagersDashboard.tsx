/**
 * ManagersDashboard - Manager Performance & Attendance Oversight
 *
 * Layout:
 * - Filters (period, state, store)
 * - 4 KPI cards (store status, incidents, stock, cash in field)
 * - 3 Charts (sales by SIM, goal progress, 7-day sales)
 * - Attendance log with approve/reject + photo evidence modal
 *
 * Access: ADMIN+ only
 */

import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { useOrganization, useOrganizationOverview, useStockSummary, useAnomalies, useOrganizationVenues, useRevenueVsTarget } from '@/hooks/useOrganization'
import { getStaffAttendance, validateTimeEntry } from '@/services/organizationDashboard.service'
import {
  ManagerFilters,
  ManagerKpiCards,
  ManagerCharts,
  AttendanceLog,
  PhotoEvidenceModal,
  type ManagerFilterValues,
  type ManagerKpiData,
  type AttendanceEntry,
} from './components'

export function ManagersDashboard() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { activeVenue } = useAuth()
  const { organizationId } = useOrganization()

  // Filters
  const [filters, setFilters] = useState<ManagerFilterValues>({
    period: 'week',
    state: 'all',
    store: 'all',
  })

  // Photo modal
  const [photoEntry, setPhotoEntry] = useState<AttendanceEntry | null>(null)

  const queryClient = useQueryClient()

  // Map filter period to timeRange for organization hooks
  const timeRange = useMemo((): '7d' | '30d' | '90d' => {
    if (filters.period === 'today') return '7d'
    if (filters.period === 'month') return '30d'
    return '7d'
  }, [filters.period])

  const selectedVenueId = filters.store !== 'all' ? filters.store : undefined

  // API hooks - pass filters
  const { data: overview } = useOrganizationOverview(timeRange)
  const { data: stockSummary } = useStockSummary()
  const { data: anomalies } = useAnomalies()
  const { data: venuesData } = useOrganizationVenues(timeRange)
  const { data: revenueData } = useRevenueVsTarget({ venueId: selectedVenueId })

  // Staff attendance from API
  const { data: attendanceData } = useQuery({
    queryKey: ['organization', organizationId, 'staff-attendance', filters],
    queryFn: () => getStaffAttendance(organizationId!, {
      period: filters.period,
      venueId: filters.store !== 'all' ? filters.store : undefined,
      status: filters.state !== 'all' ? filters.state : undefined,
    }),
    enabled: !!organizationId,
    staleTime: 30000,
  })

  // Validate time entry mutation
  const validateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      validateTimeEntry(organizationId!, id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', organizationId, 'staff-attendance'] })
    },
  })

  // Map API attendance data to AttendanceEntry format
  const attendanceEntries: AttendanceEntry[] = useMemo(() => {
    if (!attendanceData?.entries) return []
    return attendanceData.entries
      .filter(entry => entry.clockIn) // Only show staff who have clocked in
      .map(entry => {
        const clockInDate = new Date(entry.clockIn!)
        const isLate = clockInDate.getHours() >= 10 || (clockInDate.getHours() === 9 && clockInDate.getMinutes() > 30)
        const incidents: AttendanceEntry['incidents'] = []
        if (isLate) incidents.push({ label: 'Retardo', severity: 'critical' })
        if (!entry.clockInLatitude) incidents.push({ label: 'Sin GPS', severity: 'warning' })
        if (incidents.length === 0) incidents.push({ label: 'Sin Incidencias', severity: 'ok' })

        return {
          id: entry.staffId,
          timeEntryId: entry.id,
          date: clockInDate.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }),
          storeName: entry.venueName,
          promoterName: entry.staffName,
          clockIn: clockInDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase(),
          clockOut: entry.clockOut
            ? new Date(entry.clockOut).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()
            : null,
          clockInPhotoUrl: entry.clockInPhotoUrl,
          clockInLat: entry.clockInLatitude,
          clockInLon: entry.clockInLongitude,
          validationStatus: entry.validationStatus,
          sales: entry.sales ?? 0,
          incidents,
          isLate,
          gpsWarning: !entry.clockInLatitude,
        }
      })
  }, [attendanceData])

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

  // Derive KPI data from API
  const kpiData: ManagerKpiData = useMemo(() => {
    const anomalyList = anomalies?.anomalies ?? []
    const punctualityCount = anomalyList.filter(a => a.type === 'NO_CHECKINS').length
    const locationCount = anomalyList.filter(a => a.type === 'LOW_STOCK').length
    const depositCount = anomalyList.filter(a => a.type === 'PENDING_DEPOSITS').length

    // Stock by category from store breakdown
    const defaultColors = ['#6366f1', '#0ea5e9', '#a855f7', '#f59e0b', '#10b981']
    const stockCategories = stockSummary?.storeBreakdown
      ? stockSummary.storeBreakdown.slice(0, 3).map((s, i) => ({
          name: s.storeName,
          count: s.available,
          maxCount: Math.max(s.available + s.value, s.available * 1.5),
          color: defaultColors[i % defaultColors.length],
        }))
      : []

    return {
      storesOpen: overview?.venueCount ?? 0,
      storesClosed: venuesData ? Math.max(venuesData.length - (overview?.venueCount ?? 0), 0) : 0,
      incidents: [
        { label: t('playtelecom:managers.kpi.punctuality', { defaultValue: 'Puntualidad' }), count: punctualityCount, severity: 'critical' as const },
        { label: t('playtelecom:managers.kpi.location', { defaultValue: 'Localizacion' }), count: locationCount, severity: 'warning' as const },
        { label: t('playtelecom:managers.kpi.deposit', { defaultValue: 'Deposito' }), count: depositCount || 'OK', severity: depositCount ? 'warning' as const : 'ok' as const },
      ],
      stockByCategory: stockCategories,
      totalCashInField: overview?.totalRevenue ?? 0,
      cashCollectedPercent: overview?.totalRevenue && overview.totalOrders ? Math.min(Math.round((overview.totalRevenue / Math.max(overview.totalOrders * 200, 1)) * 100), 100) : 0,
    }
  }, [overview, stockSummary, anomalies, venuesData, t])

  // Chart data - derive from stock summary categories
  const salesBySIM = useMemo(() => {
    if (!stockSummary?.storeBreakdown?.length) return []
    const colors = ['#6366f1', '#0ea5e9', '#a855f7', '#f59e0b', '#10b981']
    return stockSummary.storeBreakdown.slice(0, 5).map((s, i) => ({
      label: s.storeName.slice(0, 8),
      value: s.available,
      color: colors[i % colors.length],
    }))
  }, [stockSummary])

  const goals = useMemo(() => {
    if (!venuesData?.length) return []
    return venuesData.slice(0, 4).map(v => {
      const revenue = v.metrics?.revenue ?? 0
      const growth = v.metrics?.growth ?? 0
      const percent = Math.min(Math.max(Math.round(growth + 50), 0), 100)
      return {
        storeName: v.name.length > 18 ? v.name.slice(0, 18) + '...' : v.name,
        percent,
        targetPercent: 90,
      }
    })
  }, [venuesData])

  const dailySales = useMemo(() => {
    if (!revenueData?.days?.length) return []
    const dayLabels = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
    return revenueData.days.map((d, i) => ({
      day: dayLabels[new Date(d.date).getDay()] || dayLabels[i % 7],
      value: d.actual,
      isHighlight: i === revenueData.days.length - 1,
    }))
  }, [revenueData])

  // Stores for filter dropdown - derive from venues API
  const storeOptions = useMemo(() => {
    if (!venuesData) return []
    return venuesData.map(v => ({ id: v.id, name: v.name }))
  }, [venuesData])

  const handleFilterChange = useCallback((key: keyof ManagerFilterValues, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleApprove = useCallback((id: string) => {
    if (!id) return
    validateMutation.mutate({ id, status: 'APPROVED' })
  }, [validateMutation])

  const handleReject = useCallback((id: string) => {
    if (!id) return
    validateMutation.mutate({ id, status: 'REJECTED' })
  }, [validateMutation])

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">
          {t('playtelecom:managers.title', { defaultValue: 'Dashboard Gerencial' })}
        </h2>
        <ManagerFilters
          values={filters}
          onChange={handleFilterChange}
          stores={storeOptions}
        />
      </div>

      {/* KPI Cards */}
      <ManagerKpiCards data={kpiData} formatCurrency={formatCurrency} />

      {/* Charts */}
      <ManagerCharts
        salesBySIM={salesBySIM}
        goals={goals}
        dailySales={dailySales}
      />

      {/* Attendance Log */}
      <AttendanceLog
        entries={attendanceEntries}
        onApprove={handleApprove}
        onReject={handleReject}
        onViewPhoto={setPhotoEntry}
      />

      {/* Photo Evidence Modal */}
      <PhotoEvidenceModal
        entry={photoEntry}
        open={!!photoEntry}
        onClose={() => setPhotoEntry(null)}
      />
    </div>
  )
}

export default ManagersDashboard
