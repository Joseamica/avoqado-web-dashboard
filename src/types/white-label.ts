/**
 * White-Label Dashboard Types
 *
 * Types for the WHITE_LABEL_DASHBOARD module that enables
 * customizable branded dashboards for enterprise clients.
 */

import type { StaffRole } from '@/types'

// ============================================
// Theme Configuration
// ============================================

export interface WhiteLabelTheme {
  /** Primary brand color (hex) */
  primaryColor: string
  /** Secondary brand color (hex) */
  secondaryColor?: string
  /** Logo URL or base64 */
  logo?: string
  /** Brand name displayed in UI */
  brandName: string
  /** Favicon URL */
  favicon?: string
}

// ============================================
// Feature Configuration
// ============================================

/** Source of a feature */
export type FeatureSource = 'avoqado_core' | 'module_specific' | 'custom'

/** Category of a feature */
export type FeatureCategory = 'analytics' | 'sales' | 'inventory' | 'team' | 'custom'

/** A feature enabled in the white-label config */
export interface EnabledFeature {
  /** Feature code (e.g., 'AVOQADO_COMMISSIONS') */
  code: string
  /** Where the feature comes from */
  source: FeatureSource
}

/** Configuration for a specific feature instance */
export interface FeatureInstanceConfig {
  /** Whether this feature is enabled */
  enabled: boolean
  /** Feature-specific configuration values */
  config: Record<string, unknown>
}

// ============================================
// Navigation Configuration
// ============================================

/** Navigation layout type */
export type NavigationLayout = 'sidebar' | 'topnav'

/** Navigation item type */
export type NavigationItemType = 'feature' | 'link' | 'divider' | 'group'

/** Navigation item in the white-label sidebar/nav */
export interface NavigationItem {
  /** Unique identifier */
  id: string
  /** Type of navigation item */
  type: NavigationItemType
  /** Feature code if type is 'feature' */
  featureCode?: string
  /** Display label */
  label?: string
  /** Icon name (from lucide-react) */
  icon?: string
  /** Roles that can see this item */
  roles?: StaffRole[]
  /** Sort order */
  order: number
  /** Child navigation items (for groups) */
  children?: NavigationItem[]
  /** External URL if type is 'link' */
  url?: string
}

/** Navigation configuration */
export interface NavigationConfig {
  /** Layout type */
  layout: NavigationLayout
  /** Navigation items */
  items: NavigationItem[]
}

// ============================================
// Main White-Label Configuration
// ============================================

/**
 * Complete white-label configuration stored in VenueModule.config
 */
export interface WhiteLabelConfig {
  /** Schema version for migrations */
  version: string

  /** Preset name used to initialize this config (optional, for reference) */
  preset?: PresetName | null

  /** Theme/branding configuration */
  theme: WhiteLabelTheme

  /** List of enabled features */
  enabledFeatures: EnabledFeature[]

  /** Navigation configuration */
  navigation: NavigationConfig

  /** Per-feature configuration overrides */
  featureConfigs: Record<string, FeatureInstanceConfig>
}

// ============================================
// Feature Registry Types
// ============================================

/** Route definition for a feature */
export interface RouteDefinition {
  /** Route path (relative to feature base) */
  path: string
  /** Component name for lazy loading */
  element: string
  /** Roles that can access this route */
  roles?: StaffRole[]
  /** Whether this is the index route */
  index?: boolean
}

/** Component configuration for a feature */
export interface FeatureComponent {
  /** Import path for lazy loading */
  path: string
  /** Layout component to use */
  layout?: string
}

/** Default navigation item for a feature */
export interface DefaultNavItem {
  /** Display label */
  label: string
  /** Icon name */
  icon: string
}

/**
 * JSON Schema for feature configuration
 * Used to generate dynamic forms
 */
export interface FeatureConfigSchema {
  type: 'object'
  properties: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object'
    enum?: string[]
    default?: unknown
    description?: string
    title?: string
    minimum?: number
    maximum?: number
    items?: Record<string, unknown>
  }>
  required?: string[]
}

/**
 * Complete feature definition in the registry
 */
export interface FeatureDefinition {
  /** Unique feature code */
  code: string
  /** Display name */
  name: string
  /** Description of the feature */
  description: string
  /** Category for grouping */
  category: FeatureCategory
  /** Source of the feature */
  source: FeatureSource

  /** Component configuration */
  component: FeatureComponent

  /** Route definitions */
  routes: RouteDefinition[]

  /** JSON Schema for configuration form */
  configSchema: FeatureConfigSchema

  /** Default navigation item */
  defaultNavItem: DefaultNavItem

  /** Feature dependencies (other feature codes) */
  dependencies?: string[]
}

// ============================================
// Preset Types
// ============================================

/** Available preset names */
export type PresetName = 'telecom' | 'jewelry' | 'retail' | 'custom'

/** Preset configuration */
export interface WhiteLabelPreset {
  /** Preset identifier */
  name: PresetName
  /** Display name */
  displayName: string
  /** Description */
  description: string
  /** Default theme for this preset */
  theme: Partial<WhiteLabelTheme>
  /** Pre-selected features */
  enabledFeatures: EnabledFeature[]
  /** Default feature configs */
  featureConfigs?: Record<string, Partial<FeatureInstanceConfig>>
}

// ============================================
// Hook Return Types
// ============================================

/** Return type for useWhiteLabelConfig hook */
export interface UseWhiteLabelConfigReturn {
  /** Whether white-label is enabled for this venue */
  isWhiteLabelEnabled: boolean
  /** Full white-label configuration */
  config: WhiteLabelConfig | null
  /** Theme configuration */
  theme: WhiteLabelTheme | null
  /** Navigation items */
  navigation: NavigationItem[]
  /** Enabled features */
  enabledFeatures: EnabledFeature[]
  /** Get configuration for a specific feature */
  getFeatureConfig: <T = Record<string, unknown>>(featureCode: string) => T | null
  /** Check if a feature is enabled */
  isFeatureEnabled: (featureCode: string) => boolean
  /** Loading state */
  isLoading: boolean
}

// ============================================
// API Types
// ============================================

/** Request to update white-label config */
export interface UpdateWhiteLabelConfigRequest {
  venueId: string
  config: Partial<WhiteLabelConfig>
}

/** Request to enable white-label for a venue */
export interface EnableWhiteLabelRequest {
  venueId: string
  preset?: PresetName
  config?: Partial<WhiteLabelConfig>
}

// ============================================
// Builder Types (for Visual Wizard)
// ============================================

/** Steps in the white-label wizard */
export type WizardStep = 'setup' | 'features' | 'configuration' | 'preview'

/** Wizard state */
export interface WhiteLabelWizardState {
  /** Current step */
  currentStep: WizardStep
  /** Selected venue ID */
  venueId: string | null
  /** Selected preset */
  preset: PresetName | null
  /** Configuration being built */
  config: Partial<WhiteLabelConfig>
  /** Validation errors per step */
  errors: Partial<Record<WizardStep, string[]>>
}

// ============================================
// Type Guards
// ============================================

export function isWhiteLabelConfig(value: unknown): value is WhiteLabelConfig {
  if (!value || typeof value !== 'object') return false
  const config = value as Record<string, unknown>
  return (
    typeof config.version === 'string' &&
    config.theme !== undefined &&
    Array.isArray(config.enabledFeatures) &&
    config.navigation !== undefined
  )
}

export function isFeatureDefinition(value: unknown): value is FeatureDefinition {
  if (!value || typeof value !== 'object') return false
  const def = value as Record<string, unknown>
  return (
    typeof def.code === 'string' &&
    typeof def.name === 'string' &&
    typeof def.source === 'string' &&
    def.component !== undefined &&
    Array.isArray(def.routes)
  )
}

// ============================================
// Default Values
// ============================================

export const DEFAULT_WHITE_LABEL_CONFIG: WhiteLabelConfig = {
  version: '1.0',
  theme: {
    primaryColor: '#000000',
    brandName: 'Dashboard',
  },
  enabledFeatures: [],
  navigation: {
    layout: 'sidebar',
    items: [],
  },
  featureConfigs: {},
}

export const DEFAULT_THEME: WhiteLabelTheme = {
  primaryColor: '#000000',
  brandName: 'Dashboard',
}
