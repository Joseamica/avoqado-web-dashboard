/**
 * Step4Preview - Final preview and navigation ordering
 *
 * Fourth step of the white-label wizard where users can:
 * 1. See a visual preview of the dashboard
 * 2. Reorder navigation items via drag and drop
 * 3. Review the final configuration before saving
 */

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  GripVertical,
  Eye,
  Palette,
  Puzzle,
  Settings,
  ChevronUp,
  ChevronDown,
  LayoutDashboard,
  Check,
} from 'lucide-react'
import type { NavigationItem } from '@/types/white-label'
import type { WizardState } from '../WhiteLabelWizard'
import { FEATURE_REGISTRY } from '@/config/feature-registry'
import { getIconComponent } from '@/components/WhiteLabel/DynamicFeatureLoader'

// ============================================
// Types
// ============================================

interface Step4PreviewProps {
  state: WizardState
  onNavigationChange: (items: NavigationItem[]) => void
  errors: string[]
}

// ============================================
// Component
// ============================================

export default function Step4Preview({
  state,
  onNavigationChange,
  errors,
}: Step4PreviewProps) {
  const { t } = useTranslation('superadmin')

  // Move item up
  const moveUp = useCallback(
    (index: number) => {
      if (index === 0) return
      const newItems = [...state.navigation]
      ;[newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]]
      // Update order values
      newItems.forEach((item, i) => {
        item.order = i
      })
      onNavigationChange(newItems)
    },
    [state.navigation, onNavigationChange]
  )

  // Move item down
  const moveDown = useCallback(
    (index: number) => {
      if (index === state.navigation.length - 1) return
      const newItems = [...state.navigation]
      ;[newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]]
      // Update order values
      newItems.forEach((item, i) => {
        item.order = i
      })
      onNavigationChange(newItems)
    },
    [state.navigation, onNavigationChange]
  )

  return (
    <div className="space-y-6">
      {/* Errors */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">{t('whiteLabelWizard.preview.title')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('whiteLabelWizard.preview.description')}
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Navigation Editor */}
        <div className="col-span-12 lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" />
                {t('whiteLabelWizard.preview.navigation')}
              </CardTitle>
              <CardDescription>
                {t('whiteLabelWizard.preview.navigationHelp')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {state.navigation.map((item, index) => {
                const feature = item.featureCode ? FEATURE_REGISTRY[item.featureCode] : null
                const IconComponent = item.icon ? getIconComponent(item.icon) : null

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />

                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {IconComponent && (
                        <IconComponent className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium truncate">
                        {item.label || feature?.name || item.featureCode}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveDown(index)}
                        disabled={index === state.navigation.length - 1}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}

              {state.navigation.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {t('whiteLabelWizard.preview.noNavItems')}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Visual Preview */}
        <div className="col-span-12 lg:col-span-8">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="w-4 h-4" />
                {t('whiteLabelWizard.preview.visualPreview')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Mock Dashboard Preview */}
              <div className="border-t">
                {/* Header */}
                <div
                  className="h-14 flex items-center px-4 gap-3"
                  style={{ backgroundColor: state.theme.primaryColor }}
                >
                  {state.theme.logo ? (
                    <img src={state.theme.logo} alt="Logo" className="h-8" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-primary-foreground/20 flex items-center justify-center">
                      <LayoutDashboard className="w-4 h-4 text-primary-foreground/80" />
                    </div>
                  )}
                  <span className="font-bold text-primary-foreground">
                    {state.theme.brandName || 'Dashboard'}
                  </span>
                </div>

                {/* Content Area */}
                <div className="flex min-h-[300px]">
                  {/* Sidebar */}
                  <div className="w-48 border-r bg-muted/30 p-3 space-y-1">
                    {state.navigation.map((item, index) => {
                      const feature = item.featureCode
                        ? FEATURE_REGISTRY[item.featureCode]
                        : null
                      const IconComponent = item.icon
                        ? getIconComponent(item.icon)
                        : null
                      const isFirst = index === 0

                      return (
                        <div
                          key={item.id}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                            isFirst
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-muted'
                          )}
                        >
                          {IconComponent && <IconComponent className="w-4 h-4" />}
                          <span className="truncate">
                            {item.label || feature?.name}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 p-6">
                    <div className="space-y-4">
                      {/* Breadcrumb */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{state.theme.brandName}</span>
                        <span>/</span>
                        <span className="text-foreground">
                          {state.navigation[0]?.label || 'Home'}
                        </span>
                      </div>

                      {/* Page Title */}
                      <h1 className="text-2xl font-bold">
                        {state.navigation[0]?.label || 'Dashboard'}
                      </h1>

                      {/* Placeholder Content */}
                      <div className="grid grid-cols-3 gap-4">
                        {[1, 2, 3].map(i => (
                          <div
                            key={i}
                            className="h-24 rounded-lg bg-muted/50 border border-dashed flex items-center justify-center"
                          >
                            <span className="text-xs text-muted-foreground">
                              {t('whiteLabelWizard.preview.contentPlaceholder')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Configuration Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Check className="w-4 h-4" />
            {t('whiteLabelWizard.preview.configSummary')}
          </CardTitle>
          <CardDescription>
            {t('whiteLabelWizard.preview.configSummaryDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-3">
            {/* Branding */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Palette className="w-4 h-4 text-muted-foreground" />
                {t('whiteLabelWizard.preview.branding')}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('whiteLabelWizard.preview.brandName')}</span>
                  <span className="font-medium">{state.theme.brandName}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('whiteLabelWizard.preview.primaryColor')}</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded border"
                      style={{ backgroundColor: state.theme.primaryColor }}
                    />
                    <span className="font-mono text-xs">{state.theme.primaryColor}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('whiteLabelWizard.preview.logo')}</span>
                  <span className="font-medium">
                    {state.theme.logo
                      ? t('whiteLabelWizard.preview.logoSet')
                      : t('whiteLabelWizard.preview.noLogo')}
                  </span>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Puzzle className="w-4 h-4 text-muted-foreground" />
                {t('whiteLabelWizard.preview.features')}
              </div>
              <div className="flex flex-wrap gap-2">
                {state.enabledFeatures.map(ef => {
                  const feature = FEATURE_REGISTRY[ef.code]
                  return (
                    <Badge
                      key={ef.code}
                      variant="secondary"
                      className="text-xs"
                    >
                      {feature?.name || ef.code}
                    </Badge>
                  )
                })}
              </div>
              {state.enabledFeatures.length === 0 && (
                <span className="text-sm text-muted-foreground">
                  {t('whiteLabelWizard.preview.noFeatures')}
                </span>
              )}
            </div>

            {/* Configuration */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Settings className="w-4 h-4 text-muted-foreground" />
                {t('whiteLabelWizard.preview.configuration')}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('whiteLabelWizard.preview.totalFeatures')}
                  </span>
                  <Badge variant="outline">{state.enabledFeatures.length}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('whiteLabelWizard.preview.navItems')}
                  </span>
                  <Badge variant="outline">{state.navigation.length}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('whiteLabelWizard.preview.venue')}
                  </span>
                  <span className="font-medium truncate max-w-[120px]">
                    {state.venueName || '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
