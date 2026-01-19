/**
 * PreviewPanel - Live preview of white-label dashboard configuration
 *
 * Shows how the dashboard will look with current theme and features
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Eye } from 'lucide-react'
import type { WizardState } from '../WhiteLabelWizard'
import { FEATURE_REGISTRY } from '@/config/feature-registry'
import { cn } from '@/lib/utils'

interface PreviewPanelProps {
  state: WizardState
  currentStep: 'setup' | 'features' | 'configuration' | 'preview'
}

export default function PreviewPanel({ state, currentStep }: PreviewPanelProps) {
  const { t } = useTranslation('superadmin')

  // Get icon component from lucide-react dynamically
  const getIconComponent = (iconName: string) => {
    // This is a simplified version - in real app you'd use dynamic imports
    // For now, just show a placeholder
    return null
  }

  // Preview content based on current step
  const previewContent = useMemo(() => {
    if (currentStep === 'setup') {
      return {
        title: t('whiteLabelWizard.preview.themePreview'),
        description: t('whiteLabelWizard.preview.themeDescription'),
      }
    } else if (currentStep === 'features') {
      return {
        title: t('whiteLabelWizard.preview.featuresPreview'),
        description: t('whiteLabelWizard.preview.featuresDescription'),
      }
    } else if (currentStep === 'configuration') {
      return {
        title: t('whiteLabelWizard.preview.configPreview'),
        description: t('whiteLabelWizard.preview.configDescription'),
      }
    } else {
      return {
        title: t('whiteLabelWizard.preview.finalPreview'),
        description: t('whiteLabelWizard.preview.finalDescription'),
      }
    }
  }, [currentStep, t])

  return (
    <div className="sticky top-6 h-[calc(100vh-12rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 px-4 py-3 rounded-lg bg-muted/50">
        <Eye className="w-4 h-4 text-muted-foreground" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold">{previewContent.title}</h3>
          <p className="text-xs text-muted-foreground">{previewContent.description}</p>
        </div>
      </div>

      {/* Preview Container */}
      <div className="flex-1 rounded-xl border-2 border-dashed border-border overflow-hidden bg-background">
        <div className="h-full flex flex-col">
          {/* Mock Browser Chrome */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-muted/30">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 mx-3 px-3 py-1 rounded bg-background text-[10px] text-muted-foreground font-mono">
              {state.venueName ? `${state.venueName.toLowerCase().replace(/\s+/g, '-')}.dashboard.avoqado.io` : 'preview.dashboard.avoqado.io'}
            </div>
          </div>

          {/* Dashboard Preview */}
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar Preview */}
            <div
              className="w-56 border-r p-3 space-y-2 overflow-y-auto"
              style={{
                backgroundColor: `${state.theme.primaryColor}08`,
                borderColor: `${state.theme.primaryColor}20`,
              }}
            >
              {/* Brand Name */}
              <div className="px-3 py-2 mb-4">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: state.theme.primaryColor }}
                  >
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {state.theme.brandName || 'Dashboard'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Navigation Items */}
              {state.enabledFeatures.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                  {t('whiteLabelWizard.preview.noFeatures')}
                </div>
              ) : (
                <div className="space-y-1">
                  {state.navigation.map((item, index) => {
                    const feature = FEATURE_REGISTRY[item.featureCode || '']
                    if (!feature) return null

                    // Check if label was customized
                    const isCustomLabel = item.label && item.label !== feature.defaultNavItem.label

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                          index === 0
                            ? 'bg-background shadow-sm border'
                            : 'hover:bg-background/50'
                        )}
                        style={{
                          color: index === 0 ? state.theme.primaryColor : undefined,
                        }}
                      >
                        <span className="w-4 h-4 flex items-center justify-center">
                          {item.icon ? '◉' : '○'}
                        </span>
                        <span className="truncate flex-1">{item.label || feature.defaultNavItem.label}</span>
                        {isCustomLabel && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400">
                            ✎
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Main Content Preview */}
            <div className="flex-1 p-6 overflow-y-auto bg-muted/20">
              <div className="space-y-4">
                {/* Mock Header */}
                <div className="space-y-2">
                  <div className="h-8 w-48 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-64 rounded bg-muted/60 animate-pulse" />
                </div>

                {/* Mock Content Cards */}
                <div className="grid grid-cols-2 gap-3 mt-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="aspect-video rounded-lg bg-muted/60 animate-pulse"
                    />
                  ))}
                </div>

                {/* Theme Color Preview */}
                {currentStep === 'setup' && state.theme.primaryColor !== '#000000' && (
                  <div className="mt-6 p-4 rounded-lg border bg-card">
                    <p className="text-xs font-medium mb-3">
                      {t('whiteLabelWizard.preview.themeColor')}
                    </p>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-lg border-2"
                        style={{
                          backgroundColor: state.theme.primaryColor,
                          borderColor: state.theme.primaryColor,
                        }}
                      />
                      <div>
                        <p className="text-sm font-mono">
                          {state.theme.primaryColor.toUpperCase()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('whiteLabelWizard.preview.primaryColor')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Footer */}
      <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
        <p className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" />
          {t('whiteLabelWizard.preview.liveUpdates')}
        </p>
      </div>
    </div>
  )
}
