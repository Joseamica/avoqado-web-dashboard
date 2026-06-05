/**
 * FeatureTeaser — visible paywall / upsell overlay for paid features.
 *
 * Instead of hiding a feature when the venue hasn't subscribed, we keep it
 * fully discoverable: the page still renders (usually with sample/placeholder
 * children behind it) and this component lays a blurred gradient + a centered
 * "Contrata el Plan Pro" upsell card over the lower portion. The top rows stay
 * readable so the user gets a real taste of the feature.
 *
 * Generic by design — pass any `featureName` + `children` so other paid
 * features can reuse it.
 *
 * Usage:
 * ```tsx
 * const hasCfdi = useAuth().checkFeatureAccess('CFDI')
 * <FeatureTeaser active={hasCfdi} featureName={t('cfdi:list.title')}>
 *   {hasCfdi ? <RealTable /> : <SampleRows />}
 * </FeatureTeaser>
 * ```
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useNavigate } from 'react-router-dom'

interface FeatureTeaserProps {
  /** When true the children render normally (feature unlocked). */
  active: boolean
  /** Translated, human-readable feature name shown in the upsell card. */
  featureName: string
  /** Real content when active; sample/placeholder content when locked. */
  children: ReactNode
  /**
   * Min height of the teaser sample area so the blur+CTA always has room to
   * breathe even when the placeholder children are short. Defaults to 24rem.
   */
  sampleHeight?: string
}

export function FeatureTeaser({ active, featureName, children, sampleHeight = '24rem' }: FeatureTeaserProps) {
  const { t } = useTranslation(['common'])
  const navigate = useNavigate()
  const { fullBasePath } = useCurrentVenue()

  // Unlocked → render the real feature, no overlay.
  if (active) return <>{children}</>

  const goToBilling = () => navigate(`${fullBasePath}/settings/billing`)

  return (
    <div className="relative overflow-hidden rounded-xl" style={{ minHeight: sampleHeight }}>
      {/* Sample content sits underneath, non-interactive. */}
      <div className="pointer-events-none select-none" aria-hidden="true">
        {children}
      </div>

      {/* Lower-portion blur + fade so the top rows stay readable. */}
      <div className="absolute inset-x-0 bottom-0 top-1/4 flex items-end justify-center">
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-background/80 to-background backdrop-blur-sm" />

        {/* Centered upsell card pinned over the blur. */}
        <div className="relative z-10 mx-4 mb-10 w-full max-w-md rounded-2xl border border-input bg-card/95 p-6 text-center shadow-lg">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-green-600/10 dark:bg-green-400/10">
            <Star className="h-5 w-5 fill-green-600 text-green-600 dark:fill-green-400 dark:text-green-400" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">
            {t('common:featureTeaser.headline', { feature: featureName })}
          </h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{t('common:featureTeaser.body')}</p>
          <Button onClick={goToBilling} className="mt-5 cursor-pointer">
            <Sparkles className="mr-2 h-4 w-4" />
            {t('common:featureTeaser.cta')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default FeatureTeaser
