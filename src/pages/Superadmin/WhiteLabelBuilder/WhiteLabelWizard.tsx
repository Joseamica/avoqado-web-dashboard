/**
 * WhiteLabelWizard - Visual builder for white-label dashboards
 *
 * 4-step wizard for Superadmin to configure white-label dashboards
 * without writing JSON. Uses form-based UI.
 */

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FEATURE_REGISTRY } from '@/config/feature-registry'
import { getPreset } from '@/config/white-label-presets'
import { cn } from '@/lib/utils'
import { getModulesForVenue } from '@/services/superadmin-modules.service'
import type {
  EnabledFeature,
  FeatureAccess,
  FeatureInstanceConfig,
  NavigationItem,
  PresetName,
  WhiteLabelConfig,
  WhiteLabelTheme,
  WizardStep,
} from '@/types/white-label'
import { Check, ChevronLeft, ChevronRight, Eye, Loader2, Palette, Puzzle, Settings } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import PreviewPanel from './components/PreviewPanel'
import Step1Setup from './steps/Step1Setup'
import Step2Features from './steps/Step2Features'
import Step3Configuration from './steps/Step3Configuration'
import Step4Preview from './steps/Step4Preview'

// ============================================
// Types
// ============================================

export interface WizardState {
  venueId: string
  venueName: string
  preset: PresetName | null
  theme: WhiteLabelTheme
  enabledFeatures: EnabledFeature[]
  featureConfigs: Record<string, FeatureInstanceConfig>
  navigation: NavigationItem[]
}

interface WhiteLabelWizardProps {
  onComplete: (venueId: string, config: WhiteLabelConfig) => void | Promise<void>
  onCancel: () => void
  initialVenueId?: string
  initialVenueName?: string
}

// ============================================
// Steps Configuration
// ============================================

const STEPS: { id: WizardStep; icon: React.ElementType; labelKey: string }[] = [
  { id: 'setup', icon: Palette, labelKey: 'whiteLabelWizard.steps.setup' },
  { id: 'features', icon: Puzzle, labelKey: 'whiteLabelWizard.steps.features' },
  { id: 'configuration', icon: Settings, labelKey: 'whiteLabelWizard.steps.configuration' },
  { id: 'preview', icon: Eye, labelKey: 'whiteLabelWizard.steps.preview' },
]

// ============================================
// Component
// ============================================

export default function WhiteLabelWizard({ onComplete, onCancel, initialVenueId = '', initialVenueName = '' }: WhiteLabelWizardProps) {
  const { t } = useTranslation('superadmin')

  // Current step
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const currentStep = STEPS[currentStepIndex]

  // Preview panel visibility
  const [showPreview, setShowPreview] = useState(false)

  // Wizard state
  const [state, setState] = useState<WizardState>({
    venueId: initialVenueId,
    venueName: initialVenueName,
    preset: null,
    theme: {
      primaryColor: '#000000',
      brandName: initialVenueName || 'Dashboard',
    },
    enabledFeatures: [],
    featureConfigs: {},
    navigation: [],
  })

  // Loading state for final submission
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Loading state for existing config
  const [isLoadingConfig, setIsLoadingConfig] = useState(false)

  // Validation errors
  const [errors, setErrors] = useState<Record<WizardStep, string[]>>({
    setup: [],
    features: [],
    configuration: [],
    preview: [],
  })

  // ============================================
  // State Update Handlers
  // ============================================

  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])

  // Load existing WHITE_LABEL_DASHBOARD config when venue is selected
  const loadExistingConfig = useCallback(async (venueId: string, venueName: string) => {
    setIsLoadingConfig(true)
    try {
      const { modules } = await getModulesForVenue(venueId)
      const whiteLabelModule = modules.find(m => m.code === 'WHITE_LABEL_DASHBOARD')

      if (whiteLabelModule?.enabled && whiteLabelModule.config) {
        // Parse existing config
        const existingConfig = whiteLabelModule.config as WhiteLabelConfig

        // Restore state from existing config
        setState(prev => ({
          ...prev,
          venueId,
          venueName,
          preset: existingConfig.preset || null, // Restore preset if available
          theme: existingConfig.theme || prev.theme,
          enabledFeatures: existingConfig.enabledFeatures || [],
          featureConfigs: existingConfig.featureConfigs || {},
          navigation: existingConfig.navigation?.items || [],
        }))
      } else {
        // No existing config, just update venue info and reset to defaults
        setState(prev => ({
          ...prev,
          venueId,
          venueName,
          preset: null,
          theme: {
            primaryColor: '#000000',
            brandName: venueName || 'Dashboard',
          },
          enabledFeatures: [],
          featureConfigs: {},
          navigation: [],
        }))
      }
    } catch (error) {
      console.error('Failed to load existing config:', error)
      // On error, just update venue info
      setState(prev => ({
        ...prev,
        venueId,
        venueName,
        theme: {
          ...prev.theme,
          brandName: venueName || prev.theme.brandName,
        },
      }))
    } finally {
      setIsLoadingConfig(false)
    }
  }, [])

  // Auto-load existing config when initialVenueId is provided (editing mode)
  useEffect(() => {
    if (initialVenueId && initialVenueName) {
      loadExistingConfig(initialVenueId, initialVenueName)
    }
  }, [initialVenueId, initialVenueName, loadExistingConfig])

  const handlePresetChange = useCallback((presetName: PresetName) => {
    const preset = getPreset(presetName)
    const enabledFeatures = preset.enabledFeatures
    const featureConfigs: Record<string, FeatureInstanceConfig> = {}

    // Build feature configs from preset
    enabledFeatures.forEach(ef => {
      const presetConfig = preset.featureConfigs?.[ef.code]
      const registryDef = FEATURE_REGISTRY[ef.code]

      // Get defaults from registry schema
      const defaultConfig: Record<string, unknown> = {}
      if (registryDef?.configSchema?.properties) {
        Object.entries(registryDef.configSchema.properties).forEach(([key, prop]) => {
          if (prop.default !== undefined) {
            defaultConfig[key] = prop.default
          }
        })
      }

      featureConfigs[ef.code] = {
        enabled: true,
        config: {
          ...defaultConfig,
          ...(presetConfig?.config || {}),
        },
      }
    })

    // Generate navigation items (preserving existing custom labels)
    const navigation = generateNavigationFromFeatures(enabledFeatures, [])

    setState(prev => ({
      ...prev,
      preset: presetName,
      theme: {
        ...prev.theme,
        primaryColor: preset.theme.primaryColor || prev.theme.primaryColor,
        brandName: preset.theme.brandName || prev.theme.brandName,
      },
      enabledFeatures,
      featureConfigs,
      navigation,
    }))
  }, [])

  const handleFeaturesChange = useCallback((features: EnabledFeature[]) => {
    setState(prev => {
      // Update feature configs - add new features, keep existing configs
      const newConfigs = { ...prev.featureConfigs }

      features.forEach(ef => {
        if (!newConfigs[ef.code]) {
          const registryDef = FEATURE_REGISTRY[ef.code]
          const defaultConfig: Record<string, unknown> = {}

          if (registryDef?.configSchema?.properties) {
            Object.entries(registryDef.configSchema.properties).forEach(([key, prop]) => {
              if (prop.default !== undefined) {
                defaultConfig[key] = prop.default
              }
            })
          }

          newConfigs[ef.code] = {
            enabled: true,
            config: defaultConfig,
          }
        }
      })

      // Remove configs for disabled features
      Object.keys(newConfigs).forEach(code => {
        if (!features.some(f => f.code === code)) {
          delete newConfigs[code]
        }
      })

      // Regenerate navigation (preserving existing custom labels)
      const navigation = generateNavigationFromFeatures(features, prev.navigation)

      return {
        ...prev,
        enabledFeatures: features,
        featureConfigs: newConfigs,
        navigation,
      }
    })
  }, [])

  const handleFeatureConfigChange = useCallback((featureCode: string, config: Record<string, unknown>) => {
    setState(prev => ({
      ...prev,
      featureConfigs: {
        ...prev.featureConfigs,
        [featureCode]: {
          ...prev.featureConfigs[featureCode],
          config,
        },
      },
    }))
  }, [])

  const handleNavigationChange = useCallback((items: NavigationItem[]) => {
    setState(prev => ({
      ...prev,
      navigation: items,
    }))
  }, [])

  const handleAccessChange = useCallback((featureCode: string, access: FeatureAccess) => {
    setState(prev => ({
      ...prev,
      enabledFeatures: prev.enabledFeatures.map(ef => (ef.code === featureCode ? { ...ef, access } : ef)),
    }))
  }, [])

  // ============================================
  // Navigation
  // ============================================

  const validateCurrentStep = useCallback((): boolean => {
    const stepErrors: string[] = []

    switch (currentStep.id) {
      case 'setup':
        if (!state.venueId) {
          stepErrors.push(t('whiteLabelWizard.errors.venueRequired'))
        }
        if (!state.theme.brandName) {
          stepErrors.push(t('whiteLabelWizard.errors.brandNameRequired'))
        }
        break

      case 'features':
        if (state.enabledFeatures.length === 0) {
          stepErrors.push(t('whiteLabelWizard.errors.featuresRequired'))
        }
        break

      case 'configuration':
        // Configuration is optional, no required validation
        break

      case 'preview':
        // Preview is final step, just validate we have navigation
        if (state.navigation.length === 0) {
          stepErrors.push(t('whiteLabelWizard.errors.navigationRequired'))
        }
        break
    }

    setErrors(prev => ({
      ...prev,
      [currentStep.id]: stepErrors,
    }))

    return stepErrors.length === 0
  }, [currentStep.id, state, t])

  const goToNextStep = useCallback(() => {
    if (!validateCurrentStep()) return

    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1)
    }
  }, [currentStepIndex, validateCurrentStep])

  const goToPreviousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1)
    }
  }, [currentStepIndex])

  const goToStep = useCallback(
    (index: number) => {
      // Only allow going to previous steps or current step
      if (index <= currentStepIndex) {
        setCurrentStepIndex(index)
      }
    },
    [currentStepIndex],
  )

  // ============================================
  // Final Submission
  // ============================================

  const buildFinalConfig = useCallback((): WhiteLabelConfig => {
    return {
      version: '1.0',
      preset: state.preset, // Save preset for reference
      theme: state.theme,
      enabledFeatures: state.enabledFeatures,
      navigation: {
        layout: 'sidebar',
        items: state.navigation,
      },
      featureConfigs: state.featureConfigs,
    }
  }, [state])

  const handleComplete = useCallback(async () => {
    if (!validateCurrentStep()) return

    setIsSubmitting(true)
    try {
      const config = buildFinalConfig()
      await onComplete(state.venueId, config)
    } finally {
      setIsSubmitting(false)
    }
  }, [buildFinalConfig, onComplete, validateCurrentStep, state.venueId])

  // ============================================
  // Step Completion Status
  // ============================================

  const isStepComplete = useMemo(() => {
    return {
      setup: !!state.venueId && !!state.theme.brandName,
      features: state.enabledFeatures.length > 0,
      configuration: true, // Optional step
      preview: state.navigation.length > 0,
    }
  }, [state])

  // ============================================
  // Render
  // ============================================

  return (
    <div className="flex flex-col h-full">
      {/* Step Indicator */}
      <div className="px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <nav className="flex items-center justify-center flex-1">
            <ol className="flex items-center space-x-2 sm:space-x-4">
              {STEPS.map((step, index) => {
                const Icon = step.icon
                const isActive = index === currentStepIndex
                const isCompleted = index < currentStepIndex || isStepComplete[step.id]
                const isClickable = index <= currentStepIndex

                return (
                  <li key={step.id} className="flex items-center">
                    {index > 0 && (
                      <div className={cn('w-8 sm:w-12 h-0.5 mx-1 sm:mx-2', index <= currentStepIndex ? 'bg-primary' : 'bg-muted')} />
                    )}
                    <button
                      onClick={() => goToStep(index)}
                      disabled={!isClickable}
                      className={cn(
                        'flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg transition-colors',
                        isActive && 'bg-primary/10 text-primary',
                        !isActive && isCompleted && 'text-primary',
                        !isActive && !isCompleted && 'text-muted-foreground',
                        isClickable && 'cursor-pointer hover:bg-muted',
                        !isClickable && 'cursor-not-allowed',
                      )}
                    >
                      <div
                        className={cn(
                          'flex items-center justify-center w-8 h-8 rounded-full',
                          isActive && 'bg-primary text-primary-foreground',
                          !isActive && isCompleted && 'bg-primary/20 text-primary',
                          !isActive && !isCompleted && 'bg-muted text-muted-foreground',
                        )}
                      >
                        {isCompleted && !isActive ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                      </div>
                      <span className="hidden sm:inline text-sm font-medium">{t(step.labelKey)}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>

          {/* Preview Toggle Button */}
          <Button variant="outline" size="sm" onClick={() => setShowPreview(true)} className="gap-2">
            <Eye className="w-4 h-4" />
            {t('whiteLabelWizard.showPreview')}
          </Button>
        </div>
      </div>

      {/* Full-Width Layout: Step Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full p-6">
          <div className="max-w-6xl mx-auto overflow-y-auto h-full">
            {currentStep.id === 'setup' && (
              <Step1Setup
                venueId={state.venueId}
                venueName={state.venueName}
                preset={state.preset}
                theme={state.theme}
                onVenueChange={loadExistingConfig}
                onPresetChange={handlePresetChange}
                onThemeChange={theme => updateState({ theme })}
                errors={errors.setup}
                isLoadingConfig={isLoadingConfig}
                isEditMode={!!initialVenueId}
              />
            )}

            {currentStep.id === 'features' && (
              <Step2Features
                enabledFeatures={state.enabledFeatures}
                preset={state.preset}
                onFeaturesChange={handleFeaturesChange}
                errors={errors.features}
              />
            )}

            {currentStep.id === 'configuration' && (
              <Step3Configuration
                enabledFeatures={state.enabledFeatures}
                featureConfigs={state.featureConfigs}
                onConfigChange={handleFeatureConfigChange}
                onAccessChange={handleAccessChange}
                errors={errors.configuration}
              />
            )}

            {currentStep.id === 'preview' && (
              <Step4Preview state={state} onNavigationChange={handleNavigationChange} errors={errors.preview} />
            )}
          </div>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              {t('whiteLabelWizard.preview.title')}
            </DialogTitle>
          </DialogHeader>
          <PreviewPanel state={state} currentStep={currentStep.id} />
        </DialogContent>
      </Dialog>

      {/* Footer Navigation */}
      <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {t('common.cancel')}
        </Button>

        <div className="flex items-center gap-2">
          {currentStepIndex > 0 && (
            <Button variant="outline" onClick={goToPreviousStep} disabled={isSubmitting}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              {t('whiteLabelWizard.back')}
            </Button>
          )}

          {currentStepIndex < STEPS.length - 1 ? (
            <Button onClick={goToNextStep} disabled={isSubmitting}>
              {t('whiteLabelWizard.next')}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('whiteLabelWizard.saving')}
                </>
              ) : (
                t('whiteLabelWizard.saveAndEnable')
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// Helpers
// ============================================

/**
 * Generate navigation items from enabled features.
 * Preserves custom labels from existing navigation when features are toggled.
 */
function generateNavigationFromFeatures(features: EnabledFeature[], existingNavigation: NavigationItem[] = []): NavigationItem[] {
  return features
    .map((feature, index) => {
      const def = FEATURE_REGISTRY[feature.code]
      if (!def) return null

      // Check if this feature already has a nav item with a custom label
      const existingItem = existingNavigation.find(nav => nav.featureCode === feature.code)

      const navItem: NavigationItem = {
        id: existingItem?.id || `nav-${feature.code}`,
        type: 'feature',
        featureCode: feature.code,
        label: existingItem?.label || def.defaultNavItem.label, // Preserve custom label
        icon: existingItem?.icon || def.defaultNavItem.icon,
        order: index,
      }
      return navItem
    })
    .filter((item): item is NavigationItem => item !== null)
}
