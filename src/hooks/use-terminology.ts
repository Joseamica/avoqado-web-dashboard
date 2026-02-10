/**
 * Sector-Aware Terminology Hook
 *
 * Returns UI labels adapted to the active venue's business sector.
 * Resolution: VenueRoleConfig DB override > sector default > FOOD_SERVICE fallback
 *
 * @example
 * ```tsx
 * const { term } = useTerminology()
 * <span>{term('menu')}</span>      // "Menu" for restaurants, "Catalogo" for retail
 * <span>{term('waiterPlural')}</span> // "Meseros" for restaurants, "Vendedores" for retail
 * ```
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useRoleConfig } from '@/hooks/use-role-config'
import { getBusinessCategory, type BusinessCategory } from '@/types'
import { getSectorTerms, type TermKey, type SectorTerms } from '@/config/sector-terminology'

// Map role config role keys to terminology keys
const ROLE_TO_TERM_KEY: Record<string, TermKey> = {
  WAITER: 'waiter',
  CASHIER: 'cashier',
  KITCHEN: 'kitchen',
  HOST: 'host',
}

/**
 * Derive BusinessCategory from activeVenue.type
 * Handles VenueType (which has legacy values not in BusinessType)
 */
function deriveCategory(venueType: string | undefined): BusinessCategory {
  if (!venueType) return 'FOOD_SERVICE'

  // Handle legacy VenueType values
  if (venueType === 'HOTEL_RESTAURANT') return 'FOOD_SERVICE'
  if (venueType === 'FITNESS_STUDIO') return 'SERVICES'

  // Use the standard mapping (VenueType values match BusinessType values)
  try {
    return getBusinessCategory(venueType as any)
  } catch {
    return 'OTHER'
  }
}

export function useTerminology() {
  const { activeVenue } = useAuth()
  const { i18n } = useTranslation()
  const { configs } = useRoleConfig()

  const category = useMemo(
    () => deriveCategory(activeVenue?.type),
    [activeVenue?.type],
  )

  const locale = i18n.language

  // Get sector-specific terms
  const sectorTerms = useMemo(
    () => getSectorTerms(category, locale),
    [category, locale],
  )

  // Build a merged terms object: role config overrides > sector defaults
  const terms: SectorTerms = useMemo(() => {
    if (!configs || configs.length === 0) return sectorTerms

    const merged = { ...sectorTerms }

    // Apply VenueRoleConfig overrides for role-based terms
    for (const config of configs) {
      const roleStr = typeof config.role === 'string' ? config.role : String(config.role)
      const termKey = ROLE_TO_TERM_KEY[roleStr]
      if (termKey && config.displayName) {
        merged[termKey] = config.displayName
        // For plurals, if the config has a custom name, use it as-is
        // (VenueRoleConfig doesn't store plurals, so we keep the singular override)
        const pluralKey = `${termKey}Plural` as TermKey
        if (pluralKey in merged) {
          merged[pluralKey] = config.displayName
        }
      }
    }

    return merged
  }, [sectorTerms, configs])

  // Helper function to look up a term
  const term = useMemo(() => {
    return (key: TermKey): string => terms[key] || key
  }, [terms])

  return {
    term,
    terms,
    category,
  }
}

export default useTerminology
