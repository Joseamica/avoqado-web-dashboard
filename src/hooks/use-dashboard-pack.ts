/**
 * Dashboard Pack Hook
 *
 * Returns the resolved dashboard pack for the active venue's
 * business category, filtered by data availability.
 */

import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getBusinessCategory, type BusinessCategory } from '@/types'
import { getResolvedDashboard } from '@/config/dashboard-engine'

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

export function useDashboardPack() {
  const { activeVenue } = useAuth()

  const category = useMemo(
    () => deriveCategory(activeVenue?.type),
    [activeVenue?.type],
  )

  const resolvedDashboard = useMemo(
    () => getResolvedDashboard(category),
    [category],
  )

  return { category, resolvedDashboard }
}
