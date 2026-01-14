/**
 * WhiteLabelDashboardLayout - Layout for white-label dashboards
 *
 * Provides:
 * - Dynamic branding (logo, colors, brand name)
 * - CSS variables for theming
 * - Breadcrumb navigation
 * - Outlet for nested routes
 */

import { Outlet, useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMemo, useEffect } from 'react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { useAuth } from '@/context/AuthContext'
import { useWhiteLabelConfig, useWhiteLabelCSSVariables, unslugify } from '@/hooks/useWhiteLabelConfig'
import { getFeatureByCode } from '@/config/feature-registry'
import { Skeleton } from '@/components/ui/skeleton'

export default function WhiteLabelDashboardLayout() {
  const { t } = useTranslation(['whitelabel', 'common'])
  const location = useLocation()
  const { slug } = useParams<{ slug: string }>()
  const { activeVenue } = useAuth()
  const {
    isWhiteLabelEnabled,
    config,
    theme,
    enabledFeatures,
    isLoading,
  } = useWhiteLabelConfig()

  const cssVariables = useWhiteLabelCSSVariables()

  // Apply CSS variables to the layout container
  useEffect(() => {
    const root = document.documentElement
    Object.entries(cssVariables).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })

    // Cleanup on unmount
    return () => {
      Object.keys(cssVariables).forEach(key => {
        root.style.removeProperty(key)
      })
    }
  }, [cssVariables])

  // Parse current path to determine feature
  const currentFeature = useMemo(() => {
    const pathParts = location.pathname.split('/')
    const wlIndex = pathParts.findIndex(p => p === 'wl')
    if (wlIndex === -1) return null

    const featureSlug = pathParts[wlIndex + 1]
    if (!featureSlug) return null

    const featureCode = unslugify(featureSlug)
    return getFeatureByCode(featureCode)
  }, [location.pathname])

  // Get current feature title
  const featureTitle = useMemo(() => {
    if (!currentFeature) {
      return theme?.brandName || t('whitelabel:dashboard', { defaultValue: 'Dashboard' })
    }
    return currentFeature.name
  }, [currentFeature, theme?.brandName, t])

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 border-b border-border/50 bg-background/95 backdrop-blur">
          <div className="px-6 py-4">
            <Skeleton className="h-4 w-48 mb-2" />
            <Skeleton className="h-8 w-64" />
          </div>
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  // Not enabled - should not reach here due to ModuleProtectedRoute
  if (!isWhiteLabelEnabled) {
    return null
  }

  return (
    <div className="flex flex-col h-full wl-dashboard">
      {/* Header with dynamic branding */}
      <div
        className="flex-shrink-0 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        style={{
          '--wl-header-accent': theme?.primaryColor || 'var(--primary)',
        } as React.CSSProperties}
      >
        <div className="px-6 py-4">
          {/* Logo and Brand */}
          <div className="flex items-center gap-3 mb-3">
            {theme?.logo && (
              <img
                src={theme.logo}
                alt={theme.brandName || 'Logo'}
                className="h-8 w-auto object-contain"
              />
            )}
            {theme?.brandName && !theme?.logo && (
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center text-primary-foreground font-bold"
                style={{ backgroundColor: theme.primaryColor || 'var(--primary)' }}
              >
                {theme.brandName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Breadcrumbs */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href={`/venues/${slug || activeVenue?.slug}/home`}>
                  {activeVenue?.name || 'Venue'}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href={`/venues/${slug || activeVenue?.slug}/wl`}>
                  {theme?.brandName || t('whitelabel:dashboard', { defaultValue: 'Dashboard' })}
                </BreadcrumbLink>
              </BreadcrumbItem>
              {currentFeature && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{currentFeature.name}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>

          {/* Page Title */}
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {featureTitle}
          </h1>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <Outlet context={{ config, theme, enabledFeatures }} />
        </div>
      </div>
    </div>
  )
}

/**
 * Hook to access white-label context from child routes
 */
export function useWhiteLabelOutletContext() {
  // This will be used by DynamicFeatureLoader to pass context
  return null
}
