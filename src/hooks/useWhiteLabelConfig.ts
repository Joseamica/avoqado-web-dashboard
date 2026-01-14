/**
 * useWhiteLabelConfig Hook
 *
 * Provides access to the white-label configuration for the current venue.
 * Extracts config from VenueModule where module.code === 'WHITE_LABEL_DASHBOARD'
 */

import { useCallback, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import type {
  WhiteLabelConfig,
  WhiteLabelTheme,
  NavigationItem,
  EnabledFeature,
  UseWhiteLabelConfigReturn,
} from '@/types/white-label'
import { isWhiteLabelConfig } from '@/types/white-label'
import { DEFAULT_WHITE_LABEL_CONFIG, DEFAULT_THEME } from '@/types/white-label'

const WHITE_LABEL_MODULE_CODE = 'WHITE_LABEL_DASHBOARD'

/**
 * Hook to access white-label configuration for the current venue
 */
export function useWhiteLabelConfig(): UseWhiteLabelConfigReturn {
  const { activeVenue, checkModuleAccess } = useAuth()

  // Check if white-label module is enabled
  const isWhiteLabelEnabled = useMemo(() => {
    return checkModuleAccess(WHITE_LABEL_MODULE_CODE)
  }, [checkModuleAccess])

  // Extract white-label config from venue modules
  const config = useMemo((): WhiteLabelConfig | null => {
    if (!activeVenue?.modules || !isWhiteLabelEnabled) {
      return null
    }

    const whiteLabelModule = activeVenue.modules.find(
      m => m.module.code === WHITE_LABEL_MODULE_CODE && m.enabled
    )

    if (!whiteLabelModule?.config) {
      return null
    }

    // Validate and return config
    const moduleConfig = whiteLabelModule.config as unknown
    if (isWhiteLabelConfig(moduleConfig)) {
      return moduleConfig
    }

    // Return default config if validation fails but module exists
    console.warn('[useWhiteLabelConfig] Invalid config structure, using defaults')
    return DEFAULT_WHITE_LABEL_CONFIG
  }, [activeVenue?.modules, isWhiteLabelEnabled])

  // Extract theme
  const theme = useMemo((): WhiteLabelTheme | null => {
    return config?.theme ?? null
  }, [config])

  // Extract navigation items
  const navigation = useMemo((): NavigationItem[] => {
    return config?.navigation?.items ?? []
  }, [config])

  // Extract enabled features
  const enabledFeatures = useMemo((): EnabledFeature[] => {
    return config?.enabledFeatures ?? []
  }, [config])

  // Get configuration for a specific feature
  const getFeatureConfig = useCallback(
    <T = Record<string, unknown>>(featureCode: string): T | null => {
      if (!config?.featureConfigs) {
        return null
      }

      const featureConfig = config.featureConfigs[featureCode]
      if (!featureConfig?.enabled) {
        return null
      }

      return featureConfig.config as T
    },
    [config]
  )

  // Check if a specific feature is enabled
  const isFeatureEnabled = useCallback(
    (featureCode: string): boolean => {
      if (!config?.enabledFeatures) {
        return false
      }

      return config.enabledFeatures.some(f => f.code === featureCode)
    },
    [config]
  )

  return {
    isWhiteLabelEnabled,
    config,
    theme,
    navigation,
    enabledFeatures,
    getFeatureConfig,
    isFeatureEnabled,
    isLoading: false, // Config comes from AuthContext, already loaded
  }
}

/**
 * Hook to get CSS variables from white-label theme
 */
export function useWhiteLabelCSSVariables(): Record<string, string> {
  const { theme } = useWhiteLabelConfig()

  return useMemo(() => {
    if (!theme) {
      return {}
    }

    const variables: Record<string, string> = {}

    if (theme.primaryColor) {
      variables['--wl-primary'] = theme.primaryColor
      // Generate lighter/darker variants
      variables['--wl-primary-light'] = adjustBrightness(theme.primaryColor, 20)
      variables['--wl-primary-dark'] = adjustBrightness(theme.primaryColor, -20)
    }

    if (theme.secondaryColor) {
      variables['--wl-secondary'] = theme.secondaryColor
    }

    return variables
  }, [theme])
}

/**
 * Hook to get the feature slug for navigation
 */
export function useWhiteLabelFeatureSlug(featureCode: string): string {
  return useMemo(() => {
    return slugify(featureCode)
  }, [featureCode])
}

// ============================================
// Helper Functions
// ============================================

/**
 * Convert feature code to URL-safe slug
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

/**
 * Convert slug back to feature code
 */
export function unslugify(slug: string): string {
  return slug.toUpperCase().replace(/-/g, '_')
}

/**
 * Adjust hex color brightness
 */
function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const amt = Math.round(2.55 * percent)
  const R = Math.max(0, Math.min(255, (num >> 16) + amt))
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt))
  const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt))
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`
}

// ============================================
// Type Re-exports for Convenience
// ============================================

export type {
  WhiteLabelConfig,
  WhiteLabelTheme,
  NavigationItem,
  EnabledFeature,
  UseWhiteLabelConfigReturn,
} from '@/types/white-label'
