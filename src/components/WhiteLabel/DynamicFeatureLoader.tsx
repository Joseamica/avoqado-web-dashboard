/**
 * DynamicFeatureLoader - Dynamically loads feature components
 *
 * Uses the Feature Registry to:
 * - Look up component paths
 * - Lazy load the correct component
 * - Pass feature configuration as props
 */

import { Suspense, lazy, useMemo, ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertCircle,
  Loader2,
  LayoutDashboard,
  DollarSign,
  HandCoins,
  BarChart3,
  Package,
  Users,
  Store,
  Gem,
  Handshake,
  LucideIcon,
} from 'lucide-react'
import { getFeatureByCode } from '@/config/feature-registry'
import { useWhiteLabelConfig } from '@/hooks/useWhiteLabelConfig'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface DynamicFeatureLoaderProps {
  featureCode: string
  fallback?: React.ReactNode
}

// Component cache to avoid re-creating lazy components
const componentCache = new Map<string, ComponentType<any>>()

/**
 * Get or create a lazy component for a feature
 */
function getLazyComponent(featureCode: string, componentPath: string): ComponentType<any> {
  if (componentCache.has(featureCode)) {
    return componentCache.get(featureCode)!
  }

  // Create dynamic import based on path
  // Note: Vite requires the path to be somewhat static for code-splitting
  // We'll handle this with a switch for known features
  const LazyComponent = lazy(() => loadFeatureComponent(featureCode, componentPath))

  componentCache.set(featureCode, LazyComponent)
  return LazyComponent
}

/**
 * Load feature component based on code
 * This function maps feature codes to their actual imports
 */
async function loadFeatureComponent(featureCode: string, _componentPath: string): Promise<{ default: ComponentType<any> }> {
  // Map feature codes to actual imports
  // This is necessary for Vite's code-splitting to work properly
  switch (featureCode) {
    // Avoqado Core Features
    case 'AVOQADO_COMMISSIONS':
      return import('@/pages/Commissions/CommissionsPage')

    case 'AVOQADO_TIPS':
      // Fallback to placeholder if not implemented
      return { default: FeaturePlaceholder }

    case 'AVOQADO_REPORTS':
      return import('@/pages/Reports/SalesSummary')

    // PlayTelecom Features
    case 'COMMAND_CENTER':
      return import('@/pages/playtelecom/CommandCenter/CommandCenter')

    case 'SERIALIZED_STOCK':
      return import('@/pages/playtelecom/Stock/StockControl')

    case 'PROMOTERS_AUDIT':
      return import('@/pages/playtelecom/Promoters/PromotersAudit')

    case 'STORES_ANALYSIS':
      return import('@/pages/playtelecom/Stores/StoresAnalysis')

    // Jewelry Features (placeholders)
    case 'APPRAISALS':
    case 'CONSIGNMENT':
      return { default: FeaturePlaceholder }

    default:
      console.warn(`[DynamicFeatureLoader] Unknown feature code: ${featureCode}`)
      return { default: FeaturePlaceholder }
  }
}

/**
 * Placeholder component for features not yet implemented
 */
function FeaturePlaceholder({ featureCode }: { featureCode?: string }) {
  const { t } = useTranslation('whitelabel')

  return (
    <Card className="max-w-md mx-auto mt-12">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-muted-foreground" />
          {t('featureNotImplemented', { defaultValue: 'Feature not implemented' })}
        </CardTitle>
        <CardDescription>
          {featureCode && (
            <code className="px-2 py-1 bg-muted rounded text-xs">
              {featureCode}
            </code>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {t('featureNotImplementedDesc', {
            defaultValue: 'This feature is being developed and will be available soon.',
          })}
        </p>
      </CardContent>
    </Card>
  )
}

/**
 * Loading fallback component
 */
function LoadingFallback() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}

/**
 * Error boundary fallback
 */
function ErrorFallback({
  featureCode,
  error,
  onRetry,
}: {
  featureCode: string
  error?: Error
  onRetry?: () => void
}) {
  const { t } = useTranslation('whitelabel')

  return (
    <Card className="max-w-md mx-auto mt-12 border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          {t('featureLoadError', { defaultValue: 'Failed to load feature' })}
        </CardTitle>
        <CardDescription>
          <code className="px-2 py-1 bg-muted rounded text-xs">
            {featureCode}
          </code>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t('featureLoadErrorDesc', {
            defaultValue: 'There was an error loading this feature. Please try again.',
          })}
        </p>
        {error && (
          <pre className="p-2 bg-muted rounded text-xs overflow-auto">
            {error.message}
          </pre>
        )}
        {onRetry && (
          <Button onClick={onRetry} variant="outline" size="sm">
            {t('retry', { defaultValue: 'Retry' })}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Feature not enabled fallback
 */
function FeatureNotEnabled({ featureCode }: { featureCode: string }) {
  const { t } = useTranslation('whitelabel')
  const feature = getFeatureByCode(featureCode)

  return (
    <Card className="max-w-md mx-auto mt-12">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-muted-foreground" />
          {t('featureNotEnabled', { defaultValue: 'Feature not enabled' })}
        </CardTitle>
        {feature && (
          <CardDescription>{feature.name}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {t('featureNotEnabledDesc', {
            defaultValue: 'This feature is not enabled for your dashboard. Please contact support to activate it.',
          })}
        </p>
      </CardContent>
    </Card>
  )
}

/**
 * Main component
 */
export default function DynamicFeatureLoader({
  featureCode,
  fallback,
}: DynamicFeatureLoaderProps) {
  const { isFeatureEnabled, getFeatureConfig } = useWhiteLabelConfig()

  // Get feature definition from registry
  const featureDefinition = useMemo(() => {
    return getFeatureByCode(featureCode)
  }, [featureCode])

  // Get feature-specific configuration
  const featureConfig = useMemo(() => {
    return getFeatureConfig(featureCode)
  }, [featureCode, getFeatureConfig])

  // Check if feature is enabled
  const enabled = useMemo(() => {
    return isFeatureEnabled(featureCode)
  }, [featureCode, isFeatureEnabled])

  // Feature not found in registry
  if (!featureDefinition) {
    return <FeaturePlaceholder featureCode={featureCode} />
  }

  // Feature not enabled for this venue
  if (!enabled) {
    return <FeatureNotEnabled featureCode={featureCode} />
  }

  // Get lazy component
  const LazyComponent = getLazyComponent(featureCode, featureDefinition.component.path)

  return (
    <Suspense fallback={fallback || <LoadingFallback />}>
      <LazyComponent
        featureConfig={featureConfig}
        whiteLabelMode={true}
      />
    </Suspense>
  )
}

export { FeaturePlaceholder, LoadingFallback, ErrorFallback, FeatureNotEnabled }

// ============================================
// Icon Helper
// ============================================

/**
 * Map of icon names to components
 */
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  DollarSign,
  HandCoins,
  BarChart3,
  Package,
  Users,
  Store,
  Gem,
  Handshake,
  AlertCircle,
}

/**
 * Get icon component by name
 */
export function getIconComponent(iconName: string): LucideIcon | null {
  return ICON_MAP[iconName] || null
}
