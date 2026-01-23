/**
 * PromoterDetailPanel - Main container for promoter detail view
 *
 * Combines:
 * - Profile card
 * - Entry evidence
 * - Daily scorecard
 * - Attendance calendar
 * - Deposit validation
 *
 * IMPORTANTE: Integración con TPV requerida
 * ==========================================
 * El TPV (avoqado-tpv) debe implementar:
 *
 * 1. CHECK-IN/CHECK-OUT (TimeEntry)
 *    - Crear TimeEntry con clockInTime, checkInPhotoUrl, GPS
 *    - Actualizar TimeEntry con clockOutTime al salir
 *    - Subir selfie a Firebase Storage: {env}/venues/{slug}/clockin/
 *
 * 2. VENTAS (Order + OrderItems)
 *    - Crear Orders asociadas al staffId del promotor
 *    - Para productos serializados, usar SerializedInventoryItem
 *
 * 3. DEPÓSITOS (CashDeposit)
 *    - Crear CashDeposit con foto del voucher
 *    - Subir voucher a Firebase: {env}/venues/{slug}/deposits/
 *    - Status inicial: PENDING (dashboard aprueba/rechaza)
 *
 * Ver cada componente hijo para detalles específicos.
 */

import { cn } from '@/lib/utils'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { AttendanceCalendar } from './AttendanceCalendar'
import { DailyScorecard } from './DailyScorecard'
import { DepositValidation } from './DepositValidation'
import { EntryEvidenceCard } from './EntryEvidenceCard'
import { PromoterProfileCard } from './PromoterProfileCard'

interface CheckInData {
  time: string
  method: string | null
  photoUrl: string | null
  location: { lat: number; lng: number } | null
  verified: boolean
}

interface AttendanceDay {
  date: string
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY'
}

interface TodayMetrics {
  sales: number
  units: number
  commission: number
  goalProgress: number
  dailyGoal: number
}

interface DepositData {
  id: string
  amount: number
  date: string
  status: 'pending' | 'approved' | 'rejected'
  voucherUrl: string | null
  notes?: string | null
  method?: string
  reviewedBy?: string
  reviewedAt?: string
}

interface PromoterData {
  id: string
  name: string
  store: string
  manager: string
  status: 'active' | 'break' | 'inactive'
  email?: string
  phone?: string
  level?: 'junior' | 'senior' | 'expert'
  rating?: number
  avatar?: string
  photo?: string | null
  todaySales: number
  weekSales: number
  assignedInventory: number
  soldToday: number
  commission: number
  // Data from detail API
  checkIn?: CheckInData | null
  attendance?: AttendanceDay[]
  todayMetrics?: TodayMetrics | null
}

interface PromoterDetailPanelProps {
  promoter: PromoterData
  deposits?: DepositData[]
  isLoading?: boolean
  currency?: string
  onApproveDeposit?: (depositId: string, notes?: string) => void
  onRejectDeposit?: (depositId: string, reason: string) => void
  className?: string
}

// Map backend attendance status to component status
const mapAttendanceStatus = (status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY'): 'present' | 'late' | 'absent' | 'holiday' => {
  switch (status) {
    case 'PRESENT':
      return 'present'
    case 'LATE':
      return 'late'
    case 'ABSENT':
      return 'absent'
    case 'HALF_DAY':
      return 'present' // Treat half day as present
    default:
      return 'absent'
  }
}

export const PromoterDetailPanel: React.FC<PromoterDetailPanelProps> = ({
  promoter,
  deposits = [],
  isLoading: _isLoading = false,
  currency = 'MXN',
  onApproveDeposit,
  onRejectDeposit,
  className,
}) => {
  const { t: _t } = useTranslation(['playtelecom', 'common'])

  // Map check-in data to evidence card format
  const evidenceData = promoter.checkIn
    ? {
        selfieUrl: promoter.checkIn.photoUrl,
        checkInTime: promoter.checkIn.time,
        gpsValid: promoter.checkIn.location !== null,
        biometricValid: promoter.checkIn.verified,
        distanceFromStore: 0, // Not available in current API
      }
    : null

  // Map today metrics to scorecard format
  const metricsData = {
    salesAmount: promoter.todayMetrics?.sales ?? promoter.todaySales,
    unitsSold: promoter.todayMetrics?.units ?? promoter.soldToday,
    commission: promoter.todayMetrics?.commission ?? promoter.commission,
    goalProgress: promoter.todayMetrics?.goalProgress ?? Math.min(Math.round((promoter.soldToday / 10) * 100), 100),
    vsYesterday: 0, // Not available in current API
  }

  // Map attendance data to calendar format
  const attendanceData = (promoter.attendance ?? []).map(day => ({
    date: day.date,
    status: mapAttendanceStatus(day.status),
  }))

  return (
    <div className={cn('space-y-4', className)}>
      {/* Row 1: Profile + Entry Evidence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PromoterProfileCard promoter={{ ...promoter, avatar: promoter.photo ?? undefined }} />
        <EntryEvidenceCard evidence={evidenceData} storeName={promoter.store} />
      </div>

      {/* Row 2: Daily Scorecard */}
      <DailyScorecard metrics={metricsData} currency={currency} />

      {/* Row 3: Calendar + Deposits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AttendanceCalendar data={attendanceData} />
        <DepositValidation deposits={deposits} currency={currency} onApprove={onApproveDeposit} onReject={onRejectDeposit} />
      </div>
    </div>
  )
}

export default PromoterDetailPanel
