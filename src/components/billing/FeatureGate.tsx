// src/components/billing/FeatureGate.tsx
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { Button } from '@/components/ui/button'
import { getTierDef, type TierId } from '@/config/plan-catalog'
import { cn } from '@/lib/utils'

interface FeatureGateProps {
  /** Feature code that gates this content (e.g. 'CFDI'). */
  feature: string
  /** Override the advertised/required tier; defaults to getTierForFeature(feature). */
  requiredTier?: TierId
  children: React.ReactNode
}

const ACCENT: Record<string, string> = {
  free: 'text-muted-foreground',
  pro: 'text-emerald-400',
  premium: 'text-amber-400',
  enterprise: 'text-slate-300',
}

export function FeatureGate({ feature, requiredTier, children }: FeatureGateProps) {
  const { t } = useTranslation('billing')
  const { fullBasePath } = useCurrentVenue()
  const navigate = useNavigate()
  // Tier-aware access (gates normal venues by plan tier — unlike canFeature which is white-label-only).
  const { hasAccess, requiredTier: tierId } = useTierFeatureAccess(feature, requiredTier)

  if (hasAccess) return <>{children}</>

  const def = getTierDef(tierId)
  const Icon = def.icon
  // Use capitalized key directly so i18n interpolation produces the real tier name
  // (e.g. "premium" → "Premium"). Both locale files define `plan.tiers.premium.name = "Premium"`.
  const tierName = def.key.charAt(0).toUpperCase() + def.key.slice(1)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-input">
      {/* blurred teaser */}
      <div aria-hidden className="pointer-events-none select-none opacity-50 blur-[5px]">
        {children}
      </div>
      {/* paywall card */}
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-input bg-popover p-7 text-center shadow-2xl">
          <div className={cn('mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-amber-400/15', ACCENT[def.accent])}>
            <Icon className="h-6 w-6" />
          </div>
          <p className={cn('text-[11px] font-bold uppercase tracking-wide', ACCENT[def.accent])}>
            {t('featureGate.tierTag', { tier: tierName })}
          </p>
          <p className="mx-auto mb-5 mt-3 max-w-[30ch] text-sm text-muted-foreground">
            {t('featureGate.body', { tier: tierName })}
          </p>
          <Button className="cursor-pointer gap-2" onClick={() => navigate(`${fullBasePath}/settings/billing/subscriptions`)}>
            <Icon className="h-4 w-4" />
            {t('featureGate.upgrade', { tier: tierName })}
          </Button>
        </div>
      </div>
    </div>
  )
}
