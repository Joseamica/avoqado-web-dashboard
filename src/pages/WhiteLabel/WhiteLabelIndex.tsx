/**
 * WhiteLabelIndex - Landing page for white-label dashboards
 *
 * Shows either:
 * - The first enabled feature (if configured)
 * - A welcome page with feature overview
 */

import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Package,
  Users,
  DollarSign,
  BarChart3,
  Gem,
  HandCoins,
  Store,
  Handshake,
  ArrowRight,
} from 'lucide-react'
import { useWhiteLabelConfig, slugify } from '@/hooks/useWhiteLabelConfig'
import { getFeatureByCode, FEATURE_CATEGORIES } from '@/config/feature-registry'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

// Icon map for features
const FEATURE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Package,
  Users,
  DollarSign,
  BarChart3,
  Gem,
  HandCoins,
  Store,
  Handshake,
}

export default function WhiteLabelIndex() {
  const { t } = useTranslation('whitelabel')
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const {
    isWhiteLabelEnabled,
    config,
    theme,
    enabledFeatures,
    navigation,
    isLoading,
  } = useWhiteLabelConfig()

  // Get first navigation item to auto-redirect
  const firstNavItem = useMemo(() => {
    if (!navigation || navigation.length === 0) return null
    const firstFeature = navigation.find(item => item.type === 'feature' && item.featureCode)
    return firstFeature
  }, [navigation])

  // Auto-redirect to first feature if configured
  useEffect(() => {
    if (!isLoading && firstNavItem?.featureCode && slug) {
      const featureSlug = slugify(firstNavItem.featureCode)
      navigate(`/venues/${slug}/wl/${featureSlug}`, { replace: true })
    }
  }, [isLoading, firstNavItem, slug, navigate])

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    )
  }

  // Not enabled - should not reach here
  if (!isWhiteLabelEnabled) {
    return null
  }

  // If we have a first nav item, we'll redirect, show loading
  if (firstNavItem?.featureCode) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">
            {t('redirecting', { defaultValue: 'Loading...' })}
          </p>
        </div>
      </div>
    )
  }

  // Show feature overview if no navigation configured
  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {t('welcome', {
            defaultValue: 'Welcome to {{brandName}}',
            brandName: theme?.brandName || 'Dashboard',
          })}
        </h1>
        <p className="text-muted-foreground">
          {t('welcomeDesc', {
            defaultValue: 'Your customized dashboard with {{count}} features enabled.',
            count: enabledFeatures.length,
          })}
        </p>
      </div>

      {/* Enabled Features Grid */}
      {enabledFeatures.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">
            {t('enabledFeatures', { defaultValue: 'Available Features' })}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {enabledFeatures.map(({ code, source }) => {
              const feature = getFeatureByCode(code)
              if (!feature) return null

              const IconComponent = FEATURE_ICONS[feature.defaultNavItem.icon] || LayoutDashboard
              const categoryInfo = FEATURE_CATEGORIES[feature.category]
              const featureSlug = slugify(code)

              return (
                <Card
                  key={code}
                  className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
                  onClick={() => navigate(`/venues/${slug}/wl/${featureSlug}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div
                        className="p-2 rounded-lg transition-colors"
                        style={{
                          backgroundColor: `${theme?.primaryColor || 'var(--primary)'}20`,
                        }}
                      >
                        <IconComponent
                          className="h-5 w-5"
                          style={{ color: theme?.primaryColor || 'var(--primary)' }}
                        />
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {source === 'avoqado_core' ? 'Avoqado' : 'Custom'}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg mt-2 group-hover:text-primary transition-colors">
                      {feature.name}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">
                        {categoryInfo?.label || feature.category}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {t('open', { defaultValue: 'Open' })}
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* No features enabled */}
      {enabledFeatures.length === 0 && (
        <Card className="max-w-md mx-auto mt-12">
          <CardHeader>
            <CardTitle>
              {t('noFeaturesEnabled', { defaultValue: 'No features enabled' })}
            </CardTitle>
            <CardDescription>
              {t('noFeaturesEnabledDesc', {
                defaultValue: 'Contact your administrator to enable features for this dashboard.',
              })}
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  )
}
