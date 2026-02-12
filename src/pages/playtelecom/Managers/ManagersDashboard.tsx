/**
 * ManagersDashboard - Manager Performance & Attendance Oversight
 *
 * Layout:
 * - Filters (date range, validation status, store)
 * - 4 KPI cards (store status, incidents, stock, cash in field)
 * - 3 Charts (sales by SIM, goal progress, 7-day sales)
 * - Attendance log with approve/reject + photo evidence modal
 *
 * Access: ADMIN+ only
 */

import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ShieldCheck, Store } from 'lucide-react'
import { DateRangePicker } from '@/components/date-range-picker'
import { getIntlLocale } from '@/utils/i18n-locale'
import { getToday } from '@/utils/datetime'
import {
  useStoresOverview,
  useStoresStockSummary,
  useStoresAnomalies,
  useStoresVenues,
  useStoresRevenueVsTarget,
  useStoresStaffAttendance,
  useStoresStorePerformance,
} from '@/hooks/useStoresAnalysis'
import CreateStoreGoalDialog from '../Supervisor/CreateStoreGoalDialog'

import { validateTimeEntry, resetTimeEntryValidation, type CrossStoreAnomaly } from '@/services/storesAnalysis.service'
import {
  ManagerKpiCards,
  ManagerCharts,
  AttendanceLog,
  PhotoEvidenceModal,
  DepositApprovalDialog,
  type ManagerKpiData,
  type AttendanceEntry,
} from './components'
import { LocationDialog } from './components/LocationDialog'
import { Skeleton } from '@/components/ui/skeleton'

export function ManagersDashboard() {
  const { t, i18n } = useTranslation(['playtelecom', 'common'])
  const { activeVenue } = useAuth()
  const { venueId } = useCurrentVenue()
  const localeCode = getIntlLocale(i18n.language)

  const venueTimezone = activeVenue?.timezone || 'America/Mexico_City'

  // Date range filter — uses venue timezone so VPN/remote users see correct dates
  const [selectedRange, setSelectedRange] = useState<{ from: Date; to: Date }>(() => getToday(venueTimezone))

  // Validation status filter
  const [statusFilter, setStatusFilter] = useState('all')
  // Store filter
  const [storeFilter, setStoreFilter] = useState('all')

  // Photo modal
  const [photoEntry, setPhotoEntry] = useState<AttendanceEntry | null>(null)
  const [photoType, setPhotoType] = useState<'clockIn' | 'clockOut'>('clockIn')

  // Location dialog
  const [locationEntry, setLocationEntry] = useState<AttendanceEntry | null>(null)
  const [locationType, setLocationType] = useState<'clockIn' | 'clockOut'>('clockIn')

  // Deposit approval dialog
  const [depositEntry, setDepositEntry] = useState<AttendanceEntry | null>(null)

  // Goal dialog state
  const [goalDialogOpen, setGoalDialogOpen] = useState(false)
  const [selectedStoreForGoal, setSelectedStoreForGoal] = useState<string | null>(null)
  const [editGoalId, setEditGoalId] = useState<string | null>(null)
  const [editGoalAmount, setEditGoalAmount] = useState<number | undefined>()
  const [editGoalType, setEditGoalType] = useState<'AMOUNT' | 'QUANTITY' | undefined>()
  const [editGoalPeriod, setEditGoalPeriod] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | undefined>()

  const queryClient = useQueryClient()

  // Derive ISO date strings from selected range for API calls
  const startDateISO = selectedRange.from.toISOString()
  const endDateISO = selectedRange.to.toISOString()

  const selectedVenueId = storeFilter !== 'all' ? storeFilter : undefined

  // API hooks using venue-level endpoints (white-label access)
  const { data: overview, isLoading: overviewLoading } = useStoresOverview({
    startDate: startDateISO,
    endDate: endDateISO,
    filterVenueId: selectedVenueId,
  })
  const { data: stockSummary } = useStoresStockSummary()
  const { data: anomalies } = useStoresAnomalies()
  const { data: venuesResponse } = useStoresVenues()
  const { data: revenueData } = useStoresRevenueVsTarget({ filterVenueId: selectedVenueId })
  const { data: storePerformanceData } = useStoresStorePerformance({ startDate: startDateISO, endDate: endDateISO })

  // Staff attendance using venue-level hook — pass YYYY-MM-DD strings (venue local dates)
  const startDateLocal = `${selectedRange.from.getFullYear()}-${String(selectedRange.from.getMonth() + 1).padStart(2, '0')}-${String(selectedRange.from.getDate()).padStart(2, '0')}`
  const endDateLocal = `${selectedRange.to.getFullYear()}-${String(selectedRange.to.getMonth() + 1).padStart(2, '0')}-${String(selectedRange.to.getDate()).padStart(2, '0')}`

  const { data: attendanceData, isLoading: attendanceLoading } = useStoresStaffAttendance({
    startDate: startDateLocal,
    endDate: endDateLocal,
    filterVenueId: selectedVenueId,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    refetchInterval: 30000,
  })

  // Extract venues array from response
  const venuesData = venuesResponse?.venues

  // Validate time entry mutation
  const validateMutation = useMutation({
    mutationFn: ({ id, status, depositAmount }: { id: string; status: 'APPROVED' | 'REJECTED'; depositAmount?: number }) =>
      validateTimeEntry(venueId!, id, { status, depositAmount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', venueId, 'staff-attendance'] })
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', venueId, 'overview'] })
      setDepositEntry(null)
    },
  })

  // Reset time entry validation mutation
  const resetMutation = useMutation({
    mutationFn: (id: string) => resetTimeEntryValidation(venueId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', venueId, 'staff-attendance'] })
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', venueId, 'overview'] })
    },
  })

  // Map API attendance data to AttendanceEntry format
  // DB stores UTC, browser converts to venue timezone for display
  // Expand allTimeEntries so each check-in/checkout appears as its own row
  // Pre-compute GPS violation set from backend anomalies for O(1) lookup
  const gpsViolationNames = useMemo(() => {
    const anomalyList = anomalies?.anomalies ?? []
    return new Set(
      anomalyList
        .filter(a => a.type === 'GPS_VIOLATION')
        .map(a => a.description) // "Alberto García hizo check-in 750.3km fuera del rango en ..."
    )
  }, [anomalies])

  const attendanceEntries: AttendanceEntry[] = useMemo(() => {
    if (!attendanceData?.staff) return []
    const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: venueTimezone }
    const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'long', day: '2-digit', month: 'short', timeZone: venueTimezone }

    const buildRow = (
      entry: (typeof attendanceData.staff)[number],
      te: { id?: string; clockInTime: string | null; clockOutTime: string | null; checkInPhotoUrl?: string | null; checkOutPhotoUrl?: string | null; depositPhotoUrl?: string | null; clockInLocation?: { lat: number; lng: number } | null; clockOutLocation?: { lat: number; lng: number } | null; validationStatus?: string; cashSales?: number },
    ): AttendanceEntry => {
      const clockInDate = new Date(te.clockInTime!)
      const isLate = clockInDate.getHours() >= 10 || (clockInDate.getHours() === 9 && clockInDate.getMinutes() > 30)
      const hasGps = !!(te.clockInLocation ?? entry.checkInLocation)
      const hasPhoto = !!(te.checkInPhotoUrl ?? entry.checkInPhotoUrl)
      // Check if this promoter has a GPS_VIOLATION anomaly from the backend
      const hasGpsViolation = [...gpsViolationNames].some(desc => desc.includes(entry.name))
      const incidents: AttendanceEntry['incidents'] = []
      if (isLate) incidents.push({ label: 'Retardo', severity: 'critical' })
      if (hasGpsViolation) incidents.push({ label: 'Fuera de Rango', severity: 'critical' })
      if (!hasGps) incidents.push({ label: 'Sin GPS', severity: 'warning' })
      if (!hasPhoto) incidents.push({ label: 'Sin Foto', severity: 'warning' })
      if (incidents.length === 0) incidents.push({ label: 'Sin Incidencias', severity: 'ok' })

      const teId = te.id || entry.timeEntryId || entry.id
      return {
        id: teId,
        timeEntryId: teId || null,
        date: clockInDate.toLocaleDateString('es-MX', dateOpts),
        storeName: entry.venueName,
        promoterName: entry.name,
        clockIn: clockInDate.toLocaleTimeString('es-MX', timeOpts).toUpperCase(),
        clockOut: te.clockOutTime
          ? new Date(te.clockOutTime).toLocaleTimeString('es-MX', timeOpts).toUpperCase()
          : null,
        clockInPhotoUrl: (te.checkInPhotoUrl as string) ?? entry.checkInPhotoUrl,
        clockOutPhotoUrl: (te.depositPhotoUrl as string) ?? (te.checkOutPhotoUrl as string) ?? entry.checkOutPhotoUrl,
        checkOutPhotoUrl: (te.depositPhotoUrl as string) ?? (te.checkOutPhotoUrl as string) ?? entry.checkOutPhotoUrl,
        clockInLat: (te.clockInLocation ?? entry.checkInLocation)?.lat ?? null,
        clockInLon: (te.clockInLocation ?? entry.checkInLocation)?.lng ?? null,
        clockOutLat: (te.clockOutLocation ?? entry.checkOutLocation)?.lat ?? null,
        clockOutLon: (te.clockOutLocation ?? entry.checkOutLocation)?.lng ?? null,
        validationStatus: ((te.validationStatus ?? entry.validationStatus ?? 'PENDING') as 'PENDING' | 'APPROVED' | 'REJECTED'),
        sales: entry.sales ?? 0,
        cashSales: te.cashSales ?? (entry as any).cashSales ?? 0,
        dailyCashSales: (entry as any).cashSales ?? 0,
        incidents,
        isLate,
        gpsWarning: !hasGps,
      }
    }

    return attendanceData.staff
      .filter(entry => entry.checkInTime)
      .flatMap(entry => {
        const allEntries = (entry as any).allTimeEntries as Array<{
          id?: string
          clockInTime: string | null
          clockOutTime: string | null
          checkInPhotoUrl?: string | null
          checkOutPhotoUrl?: string | null
          depositPhotoUrl?: string | null
          clockInLocation?: { lat: number; lng: number } | null
          clockOutLocation?: { lat: number; lng: number } | null
          validationStatus?: string
          cashSales?: number
        }> | undefined

        if (allEntries && allEntries.length > 0) {
          return allEntries
            .filter(te => te.clockInTime)
            .map(te => buildRow(entry, te))
        }

        return [buildRow(entry, {
          clockInTime: entry.checkInTime,
          clockOutTime: entry.checkOutTime,
          checkInPhotoUrl: entry.checkInPhotoUrl,
          checkOutPhotoUrl: entry.checkOutPhotoUrl,
          clockInLocation: entry.checkInLocation,
          clockOutLocation: entry.checkOutLocation,
          validationStatus: entry.validationStatus,
        })]
      })
  }, [attendanceData, venueTimezone, gpsViolationNames])

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

  // Derive KPI data from attendance entries (real data, not anomaly heuristics)
  // Count directly from the incidents already computed per row in buildRow
  const kpiData: ManagerKpiData = useMemo(() => {
    const punctualityCount = attendanceEntries.filter(e => e.incidents.some(i => i.label === 'Retardo')).length
    const locationCount = attendanceEntries.filter(e => e.incidents.some(i => i.label === 'Sin GPS' || i.label === 'Fuera de Rango' || i.label === 'Sin Foto')).length
    const depositCount = attendanceEntries.filter(e => e.clockOut && !e.clockOutPhotoUrl).length

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
      storesOpen: overview?.activeStores ?? 0,
      storesClosed: venuesData ? Math.max(venuesData.length - (overview?.activeStores ?? 0), 0) : overview?.totalStores ? overview.totalStores - (overview.activeStores ?? 0) : 0,
      incidents: [
        { label: t('playtelecom:managers.kpi.punctuality', { defaultValue: 'Puntualidad' }), count: punctualityCount || 'OK', severity: punctualityCount ? 'critical' as const : 'ok' as const, anomalyType: 'NO_CHECKINS' as const },
        { label: t('playtelecom:managers.kpi.location', { defaultValue: 'Localizacion y Fotos' }), count: locationCount || 'OK', severity: locationCount ? 'critical' as const : 'ok' as const, anomalyType: 'GPS_VIOLATION' as const },
        { label: t('playtelecom:managers.kpi.deposit', { defaultValue: 'Deposito' }), count: depositCount || 'OK', severity: depositCount ? 'critical' as const : 'ok' as const, anomalyType: 'PENDING_DEPOSITS' as const },
      ],
      stockByCategory: stockCategories,
      totalCashInField: (overview?.todayCashSales ?? 0) - (overview?.approvedDeposits ?? 0),
      cashCollectedPercent: overview?.todayCashSales
        ? Math.min(Math.round(((overview.approvedDeposits ?? 0) / Math.max(overview.todayCashSales, 1)) * 100), 100)
        : 0,
    }
  }, [overview, stockSummary, attendanceEntries, venuesData, t])

  // Generate detail items for the incident dialog from attendance entries
  // Maps each row's incidents to CrossStoreAnomaly for the detail dialog
  const attendanceAnomalies: CrossStoreAnomaly[] = useMemo(() => {
    const items: CrossStoreAnomaly[] = []
    for (const e of attendanceEntries) {
      // Group incidents by anomaly type per entry
      const punctualityLabels: string[] = []
      const locationLabels: string[] = []
      let worstPunctuality: 'WARNING' | 'CRITICAL' = 'WARNING'
      let worstLocation: 'WARNING' | 'CRITICAL' = 'WARNING'

      for (const inc of e.incidents) {
        if (inc.severity === 'ok') continue
        if (inc.label === 'Retardo') {
          punctualityLabels.push(inc.label)
          if (inc.severity === 'critical') worstPunctuality = 'CRITICAL'
        } else if (inc.label === 'Sin GPS' || inc.label === 'Fuera de Rango' || inc.label === 'Sin Foto') {
          locationLabels.push(inc.label)
          if (inc.severity === 'critical') worstLocation = 'CRITICAL'
        }
      }

      if (punctualityLabels.length > 0) {
        items.push({
          id: `punctuality-${e.id}`,
          type: 'NO_CHECKINS',
          severity: worstPunctuality,
          title: punctualityLabels.join(', '),
          description: `${e.promoterName} — ${punctualityLabels.join(', ')}${e.clockIn ? ` (${e.clockIn})` : ''}`,
          storeId: e.id,
          storeName: e.storeName,
          timestamp: e.date,
          actionRequired: true,
        })
      }

      if (locationLabels.length > 0) {
        items.push({
          id: `location-${e.id}`,
          type: 'GPS_VIOLATION',
          severity: worstLocation,
          title: locationLabels.join(', '),
          description: `${e.promoterName} — ${locationLabels.join(', ')}${e.clockIn ? ` (${e.clockIn})` : ''}`,
          storeId: e.id,
          storeName: e.storeName,
          timestamp: e.date,
          actionRequired: true,
        })
      }

      // Deposit: separate check (not in row incidents)
      if (e.clockOut && !e.clockOutPhotoUrl) {
        items.push({
          id: `deposit-${e.id}`,
          type: 'PENDING_DEPOSITS',
          severity: 'WARNING',
          title: 'Sin Voucher',
          description: `${e.promoterName} — salida sin foto de depósito`,
          storeId: e.id,
          storeName: e.storeName,
          timestamp: e.date,
          actionRequired: true,
        })
      }
    }
    return items
  }, [attendanceEntries])

  // Chart data - derive from overview category breakdown (sales by product category)
  const salesBySIM = useMemo(() => {
    if (!overview?.categoryBreakdown?.length) return []
    const colors = ['#6366f1', '#0ea5e9', '#a855f7', '#f59e0b', '#10b981']
    return overview.categoryBreakdown.slice(0, 5).map((cat, i) => ({
      label: cat.name,
      value: cat.units,
      color: colors[i % colors.length],
    }))
  }, [overview])

  const goals = useMemo(() => {
    if (!storePerformanceData?.stores?.length) return []
    return storePerformanceData.stores.slice(0, 4).map(s => {
      const perf = Number.isFinite(s.performance) ? s.performance : 0
      return {
        id: s.id,
        storeName: s.name,
        percent: Math.min(perf, 150),
        barPercent: Math.min(perf, 100),
        color: perf >= 70 ? 'bg-green-500' : 'bg-amber-500',
        hasGoal: s.goalAmount != null,
        goalId: s.goalId,
        goalType: s.goalType || 'AMOUNT',
        goalPeriod: s.goalPeriod,
        amount: s.todaySales,
        unitsSold: s.unitsSold,
        goalAmount: s.goalAmount ?? 0,
      }
    })
  }, [storePerformanceData])

  const dailySales = useMemo(() => {
    if (!revenueData?.days?.length) return []
    const dayLabels = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
    const todayStr = new Date().toISOString().slice(0, 10)
    const mapped = revenueData.days.map((d, i) => {
      const dow = new Date(d.date).getDay()
      return {
        day: dayLabels[dow] || dayLabels[i % 7],
        value: d.actual,
        isHighlight: d.date?.slice(0, 10) === todayStr,
        _sortKey: dow === 0 ? 6 : dow - 1, // Mon=0 … Sun=6
      }
    })
    mapped.sort((a, b) => a._sortKey - b._sortKey)
    return mapped
  }, [revenueData])

  // Stores for filter dropdown - derive from venues API
  const storeOptions = useMemo(() => {
    if (!venuesData) return []
    return venuesData.map(v => ({ id: v.id, name: v.name }))
  }, [venuesData])

  const handleApprove = useCallback((entry: AttendanceEntry) => {
    if (!entry.timeEntryId) return
    if (entry.clockOut && entry.dailyCashSales > 0) {
      // Has checkout + cash sales → must verify bank deposit before approving
      setDepositEntry(entry)
    } else {
      // No checkout yet or no cash sales → approve directly
      validateMutation.mutate({ id: entry.timeEntryId, status: 'APPROVED' })
    }
  }, [validateMutation])

  const handleConfirmDeposit = useCallback((id: string, amount: number) => {
    if (!id) return
    validateMutation.mutate({ id, status: 'APPROVED', depositAmount: amount })
  }, [validateMutation])

  const handleReject = useCallback((id: string) => {
    if (!id) return
    validateMutation.mutate({ id, status: 'REJECTED' })
  }, [validateMutation])

  const handleResetValidation = useCallback((id: string) => {
    if (!id) return
    resetMutation.mutate(id)
  }, [resetMutation])

  const handleOpenGoalDialog = useCallback(
    (storeId?: string, goalId?: string | null, goalAmount?: number, goalType?: 'AMOUNT' | 'QUANTITY', goalPeriod?: 'DAILY' | 'WEEKLY' | 'MONTHLY') => {
      setSelectedStoreForGoal(storeId || null)
      setEditGoalId(goalId || null)
      setEditGoalAmount(goalAmount)
      setEditGoalType(goalType)
      setEditGoalPeriod(goalPeriod)
      setGoalDialogOpen(true)
    },
    [],
  )

  // Derive store options for goal dialog
  const goalStoreOptions = useMemo(() => {
    if (!storePerformanceData?.stores?.length) return []
    return storePerformanceData.stores.map(s => ({ id: s.id, name: s.name }))
  }, [storePerformanceData])

  const isLoading = overviewLoading || attendanceLoading

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">
          {t('playtelecom:managers.title', { defaultValue: 'Dashboard Gerencial' })}
        </h2>
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

          {/* Validation Status */}
          <div className="flex items-center gap-2 bg-card border border-primary/30 hover:border-primary rounded-lg px-3 py-1.5 transition-colors">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-muted-foreground uppercase leading-none">
                {t('playtelecom:managers.filters.status', { defaultValue: 'Estado' })}
              </span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="border-0 bg-transparent h-5 text-xs font-semibold w-[100px] p-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('playtelecom:managers.filters.all', { defaultValue: 'Todos' })}</SelectItem>
                  <SelectItem value="PENDING">{t('playtelecom:managers.filters.pending', { defaultValue: 'Pendiente' })}</SelectItem>
                  <SelectItem value="APPROVED">{t('playtelecom:managers.filters.approved', { defaultValue: 'Aprobado' })}</SelectItem>
                  <SelectItem value="REJECTED">{t('playtelecom:managers.filters.rejected', { defaultValue: 'Rechazado' })}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Store */}
          <div className="flex items-center gap-2 bg-card border border-primary/30 hover:border-primary rounded-lg px-3 py-1.5 transition-colors">
            <Store className="w-4 h-4 text-primary" />
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-muted-foreground uppercase leading-none">
                {t('playtelecom:managers.filters.store', { defaultValue: 'Tienda' })}
              </span>
              <Select value={storeFilter} onValueChange={setStoreFilter}>
                <SelectTrigger className="border-0 bg-transparent h-5 text-xs font-semibold w-[130px] p-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('playtelecom:managers.filters.allStores', { defaultValue: 'Todas' })}</SelectItem>
                  {storeOptions.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <ManagerKpiCards data={kpiData} formatCurrency={formatCurrency} anomalies={attendanceAnomalies} />

      {/* Charts */}
      <ManagerCharts
        salesBySIM={salesBySIM}
        goals={goals}
        dailySales={dailySales}
        formatCurrency={formatCurrency}
        onCreateGoal={() => handleOpenGoalDialog()}
        onEditGoal={(storeId, goalId, goalAmount, goalType, goalPeriod) => handleOpenGoalDialog(storeId, goalId, goalAmount, goalType, goalPeriod)}
      />

      {/* Attendance Log */}
      <AttendanceLog
        entries={attendanceEntries}
        onApprove={handleApprove}
        onReject={handleReject}
        onResetValidation={handleResetValidation}
        onViewPhoto={(entry, type) => { setPhotoEntry(entry); setPhotoType(type) }}
        onViewLocation={(entry, type) => { setLocationEntry(entry); setLocationType(type) }}
      />

      {/* Photo Evidence Modal */}
      <PhotoEvidenceModal
        entry={photoEntry}
        type={photoType}
        open={!!photoEntry}
        onClose={() => setPhotoEntry(null)}
      />

      {/* Location Dialog */}
      <LocationDialog
        entry={locationEntry}
        type={locationType}
        open={!!locationEntry}
        onClose={() => setLocationEntry(null)}
      />

      {/* Deposit Approval Dialog */}
      <DepositApprovalDialog
        open={!!depositEntry}
        onOpenChange={open => { if (!open) setDepositEntry(null) }}
        entry={depositEntry}
        expectedAmount={depositEntry?.cashSales ?? 0}
        onConfirm={handleConfirmDeposit}
        isPending={validateMutation.isPending}
      />

      {/* Goal Dialog */}
      <CreateStoreGoalDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        stores={goalStoreOptions}
        selectedStoreId={selectedStoreForGoal}
        editGoalId={editGoalId}
        editGoalAmount={editGoalAmount}
        editGoalType={editGoalType}
        editGoalPeriod={editGoalPeriod}
      />
    </div>
  )
}

export default ManagersDashboard
