/**
 * Step2Features - Feature selection
 *
 * Second step of the white-label wizard where users can:
 * 1. See pre-selected features from the chosen preset
 * 2. Add/remove features from the available catalog
 * 3. Browse features by category
 */

import { useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  BarChart3,
  ShoppingCart,
  Package,
  Users,
  Puzzle,
  Check,
  Sparkles,
  Building2,
} from 'lucide-react'
import type { EnabledFeature, FeatureCategory, FeatureSource, PresetName } from '@/types/white-label'
import {
  FEATURE_REGISTRY,
  getFeaturesByCategory,
  getAvoqadoCoreFeatures,
  getModuleSpecificFeatures,
  FEATURE_CATEGORIES,
} from '@/config/feature-registry'
import { getPreset } from '@/config/white-label-presets'

// ============================================
// Types
// ============================================

interface Step2FeaturesProps {
  enabledFeatures: EnabledFeature[]
  preset: PresetName | null
  onFeaturesChange: (features: EnabledFeature[]) => void
  errors: string[]
}

// ============================================
// Category Icons
// ============================================

const CATEGORY_ICONS: Record<FeatureCategory, React.ElementType> = {
  analytics: BarChart3,
  sales: ShoppingCart,
  inventory: Package,
  team: Users,
  custom: Puzzle,
}

// ============================================
// Component
// ============================================

export default function Step2Features({
  enabledFeatures,
  preset,
  onFeaturesChange,
  errors,
}: Step2FeaturesProps) {
  const { t } = useTranslation('superadmin')

  // Get all available features
  const avoqadoFeatures = useMemo(() => getAvoqadoCoreFeatures(), [])
  const moduleFeatures = useMemo(() => getModuleSpecificFeatures(), [])

  // Features from preset (if any)
  const presetFeatureCodes = useMemo(() => {
    if (!preset) return new Set<string>()
    return new Set(getPreset(preset).enabledFeatures.map(f => f.code))
  }, [preset])

  // Check if a feature is enabled
  const isFeatureEnabled = useCallback(
    (code: string) => enabledFeatures.some(f => f.code === code),
    [enabledFeatures]
  )

  // Toggle feature
  const toggleFeature = useCallback(
    (code: string) => {
      const feature = FEATURE_REGISTRY[code]
      if (!feature) return

      if (isFeatureEnabled(code)) {
        // Remove feature
        onFeaturesChange(enabledFeatures.filter(f => f.code !== code))
      } else {
        // Add feature
        onFeaturesChange([
          ...enabledFeatures,
          { code, source: feature.source },
        ])
      }
    },
    [enabledFeatures, isFeatureEnabled, onFeaturesChange]
  )

  // Features by category
  const categories = useMemo(() => {
    return Object.keys(FEATURE_CATEGORIES) as FeatureCategory[]
  }, [])

  // Count enabled features by source
  const counts = useMemo(() => {
    return {
      total: enabledFeatures.length,
      avoqado: enabledFeatures.filter(f => f.source === 'avoqado_core').length,
      module: enabledFeatures.filter(f => f.source === 'module_specific').length,
    }
  }, [enabledFeatures])

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
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

      {/* Header with counts */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t('whiteLabelWizard.features.title')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('whiteLabelWizard.features.description')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1">
            <Sparkles className="w-3 h-3" />
            {counts.avoqado} Avoqado
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Building2 className="w-3 h-3" />
            {counts.module} {t('whiteLabelWizard.features.moduleSpecific')}
          </Badge>
          <Badge variant="default" className="gap-1">
            <Check className="w-3 h-3" />
            {counts.total} {t('whiteLabelWizard.features.selected')}
          </Badge>
        </div>
      </div>

      {/* Feature Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="inline-flex h-10 items-center justify-start rounded-full bg-muted/60 px-1 py-1 text-muted-foreground border border-border">
          <TabsTrigger
            value="all"
            className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
          >
            {t('whiteLabelWizard.features.tabs.all')}
          </TabsTrigger>
          <TabsTrigger
            value="avoqado"
            className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
          >
            <Sparkles className="w-3 h-3 mr-1" />
            Avoqado Core
          </TabsTrigger>
          <TabsTrigger
            value="module"
            className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
          >
            <Building2 className="w-3 h-3 mr-1" />
            {t('whiteLabelWizard.features.tabs.moduleSpecific')}
          </TabsTrigger>
          {categories.map(cat => {
            const Icon = CATEGORY_ICONS[cat]
            return (
              <TabsTrigger
                key={cat}
                value={cat}
                className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
              >
                <Icon className="w-3 h-3 mr-1" />
                {FEATURE_CATEGORIES[cat].label}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* All Features */}
        <TabsContent value="all" className="mt-6">
          <div className="space-y-8">
            {/* Avoqado Core */}
            <FeatureSection
              title="Avoqado Core"
              description={t('whiteLabelWizard.features.avoqadoCoreDesc')}
              features={avoqadoFeatures}
              enabledFeatures={enabledFeatures}
              presetFeatureCodes={presetFeatureCodes}
              onToggle={toggleFeature}
              isFeatureEnabled={isFeatureEnabled}
              icon={Sparkles}
              accentColor="text-purple-500"
            />

            {/* Module Specific */}
            <FeatureSection
              title={t('whiteLabelWizard.features.moduleSpecificTitle')}
              description={t('whiteLabelWizard.features.moduleSpecificDesc')}
              features={moduleFeatures}
              enabledFeatures={enabledFeatures}
              presetFeatureCodes={presetFeatureCodes}
              onToggle={toggleFeature}
              isFeatureEnabled={isFeatureEnabled}
              icon={Building2}
              accentColor="text-orange-500"
            />
          </div>
        </TabsContent>

        {/* Avoqado Core Tab */}
        <TabsContent value="avoqado" className="mt-6">
          <FeatureSection
            title="Avoqado Core"
            description={t('whiteLabelWizard.features.avoqadoCoreDesc')}
            features={avoqadoFeatures}
            enabledFeatures={enabledFeatures}
            presetFeatureCodes={presetFeatureCodes}
            onToggle={toggleFeature}
            isFeatureEnabled={isFeatureEnabled}
            icon={Sparkles}
            accentColor="text-purple-500"
          />
        </TabsContent>

        {/* Module Specific Tab */}
        <TabsContent value="module" className="mt-6">
          <FeatureSection
            title={t('whiteLabelWizard.features.moduleSpecificTitle')}
            description={t('whiteLabelWizard.features.moduleSpecificDesc')}
            features={moduleFeatures}
            enabledFeatures={enabledFeatures}
            presetFeatureCodes={presetFeatureCodes}
            onToggle={toggleFeature}
            isFeatureEnabled={isFeatureEnabled}
            icon={Building2}
            accentColor="text-orange-500"
          />
        </TabsContent>

        {/* Category Tabs */}
        {categories.map(cat => {
          const categoryFeatures = getFeaturesByCategory(cat)
          const Icon = CATEGORY_ICONS[cat]
          return (
            <TabsContent key={cat} value={cat} className="mt-6">
              <FeatureSection
                title={FEATURE_CATEGORIES[cat].label}
                description={FEATURE_CATEGORIES[cat].description}
                features={categoryFeatures}
                enabledFeatures={enabledFeatures}
                presetFeatureCodes={presetFeatureCodes}
                onToggle={toggleFeature}
                isFeatureEnabled={isFeatureEnabled}
                icon={Icon}
                accentColor={
                  cat === 'analytics'
                    ? 'text-blue-500'
                    : cat === 'sales'
                      ? 'text-green-500'
                      : cat === 'inventory'
                        ? 'text-orange-500'
                        : cat === 'team'
                          ? 'text-purple-500'
                          : 'text-muted-foreground'
                }
              />
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}

// ============================================
// Feature Section Component
// ============================================

interface FeatureSectionProps {
  title: string
  description: string
  features: Array<{
    code: string
    name: string
    description: string
    category: FeatureCategory
    source: FeatureSource
    defaultNavItem: { label: string; icon: string }
  }>
  enabledFeatures: EnabledFeature[]
  presetFeatureCodes: Set<string>
  onToggle: (code: string) => void
  isFeatureEnabled: (code: string) => boolean
  icon: React.ElementType
  accentColor: string
}

function FeatureSection({
  title,
  description,
  features,
  presetFeatureCodes,
  onToggle,
  isFeatureEnabled,
  icon: Icon,
  accentColor,
}: FeatureSectionProps) {
  const { t } = useTranslation('superadmin')

  if (features.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t('whiteLabelWizard.features.noFeaturesInCategory')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className={cn('w-5 h-5', accentColor)} />
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(feature => {
          const isEnabled = isFeatureEnabled(feature.code)
          const isFromPreset = presetFeatureCodes.has(feature.code)
          const CategoryIcon = CATEGORY_ICONS[feature.category]

          return (
            <Card
              key={feature.code}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5',
                isEnabled && 'ring-2 ring-primary border-primary bg-primary/5'
              )}
              onClick={() => onToggle(feature.code)}
            >
              <CardHeader className="pb-1 pt-3 px-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <div
                      className={cn(
                        'p-1 rounded-md flex-shrink-0',
                        isEnabled ? 'bg-primary/20' : 'bg-muted'
                      )}
                    >
                      <CategoryIcon
                        className={cn(
                          'w-3 h-3',
                          isEnabled ? 'text-primary' : 'text-muted-foreground'
                        )}
                      />
                    </div>
                    <CardTitle className="text-xs font-medium truncate">{feature.name}</CardTitle>
                  </div>
                  <Checkbox
                    checked={isEnabled}
                    onClick={e => e.stopPropagation()}
                    className="cursor-pointer flex-shrink-0"
                  />
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-3 px-3">
                <CardDescription className="text-[10px] line-clamp-1 leading-tight mb-1.5">
                  {feature.description}
                </CardDescription>
                <div className="flex flex-wrap items-center gap-1">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[9px] px-1 py-0 h-4',
                      feature.source === 'avoqado_core'
                        ? 'border-purple-200 text-purple-700 bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:bg-purple-950'
                        : 'border-orange-200 text-orange-700 bg-orange-50 dark:border-orange-800 dark:text-orange-300 dark:bg-orange-950'
                    )}
                  >
                    {feature.source === 'avoqado_core' ? 'Avoqado' : 'Module'}
                  </Badge>
                  {isFromPreset && (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                      {t('whiteLabelWizard.features.fromPreset')}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
