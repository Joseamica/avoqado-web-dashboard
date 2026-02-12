/**
 * Dashboard Sector Hook
 *
 * Returns the dashboard configuration (visible sections + KPI cards)
 * for the active venue's business sector.
 *
 * @example
 * ```tsx
 * const { isSectionVisible, kpiCards } = useDashboardSector()
 * if (isSectionVisible('kitchen-performance')) { ... }
 * ```
 */

import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getBusinessCategory, type BusinessCategory } from '@/types'
import {
  SECTOR_DASHBOARD_CONFIG,
  type ChartSectionId,
  type KpiCardId,
  type SectorDashboardConfig,
} from '@/config/dashboard-sectors'

/**
 * Derive BusinessCategory from venue type string
 */
function deriveCategory(venueType: string | undefined): BusinessCategory {
  if (!venueType) return 'FOOD_SERVICE'
  if (venueType === 'HOTEL_RESTAURANT') return 'FOOD_SERVICE'
  if (venueType === 'FITNESS_STUDIO') return 'SERVICES'
  try {
    return getBusinessCategory(venueType as any)
  } catch {
    return 'OTHER'
  }
}

export function useDashboardSector() {
  const { activeVenue } = useAuth()

  const category = useMemo(
    () => deriveCategory(activeVenue?.type),
    [activeVenue?.type],
  )

  const config: SectorDashboardConfig = useMemo(
    () => SECTOR_DASHBOARD_CONFIG[category] || SECTOR_DASHBOARD_CONFIG.FOOD_SERVICE,
    [category],
  )

  const isSectionVisible = useMemo(() => {
    return (sectionId: ChartSectionId): boolean => config.visibleSections.has(sectionId)
  }, [config])

  const kpiCards: KpiCardId[] = config.kpiCards

  return {
    category,
    config,
    isSectionVisible,
    kpiCards,
  }
}

export default useDashboardSector
