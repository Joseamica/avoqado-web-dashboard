import { useTranslation } from 'react-i18next'
import { getTierDef, type TierId } from '@/config/plan-catalog'
import { useVenuePlanTier } from '@/hooks/use-tier-feature-access'
import { cn } from '@/lib/utils'

// Accent styles per tier. FREE stays on neutral semantic tokens so paid tiers pop;
// PRO/PREMIUM/ENTERPRISE use intentional brand accents (same family as the plan cards & sidebar TierBadge).
const TIER_STYLES: Record<TierId, string> = {
  FREE: 'border-input text-muted-foreground bg-muted/50',
  PRO: 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
  PREMIUM: 'border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10',
  ENTERPRISE: 'border-indigo-500/30 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10',
}

interface VenueTierBadgeProps {
  tier: TierId | null | undefined
  /** Hide the leading tier icon (e.g. very tight rows). Defaults to showing it. */
  showIcon?: boolean
  className?: string
}

/**
 * Compact pill showing a venue's subscription tier (Free / Pro / Premium / Enterprise).
 * Renders nothing until a tier is known. Pair with {@link useVenuePlanTier} to resolve the tier
 * for any venue id.
 */
export function VenueTierBadge({ tier, showIcon = true, className }: VenueTierBadgeProps) {
  const { t } = useTranslation()
  if (!tier) return null

  const Icon = getTierDef(tier).icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none',
        TIER_STYLES[tier],
        className,
      )}
    >
      {showIcon && <Icon className="size-2.5 shrink-0" />}
      {t(`venuesSwitcher.tier.${tier.toLowerCase()}`)}
    </span>
  )
}

interface VenueTierBadgeByIdProps {
  venueId: string | undefined
  /** Gate the network fetch (e.g. only while the switcher popover is open). Defaults to true. */
  enabled?: boolean
  showIcon?: boolean
  className?: string
}

/** Self-fetching {@link VenueTierBadge} for a venue id — resolves the tier via {@link useVenuePlanTier}. */
export function VenueTierBadgeById({ venueId, enabled = true, showIcon = true, className }: VenueTierBadgeByIdProps) {
  const { tier } = useVenuePlanTier(venueId, enabled)
  return <VenueTierBadge tier={tier} showIcon={showIcon} className={className} />
}
