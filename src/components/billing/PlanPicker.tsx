// src/components/billing/PlanPicker.tsx
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PLAN_TIERS, TIER_ORDER, type TierId, type PlanTierDef } from '@/config/plan-catalog'

const ACCENT: Record<PlanTierDef['accent'], string> = {
  free: 'text-muted-foreground',
  pro: 'text-emerald-400',
  premium: 'text-amber-400',
  enterprise: 'text-slate-300',
}
const ACCENT_BG: Record<PlanTierDef['accent'], string> = {
  free: 'bg-muted',
  pro: 'bg-emerald-400/15',
  premium: 'bg-amber-400/15',
  enterprise: 'bg-slate-300/10',
}

const fmt = (n: number) => `$${n.toLocaleString('es-MX')}`

interface PlanPickerProps {
  currentTier: TierId
  onSelectTier: (tier: TierId, interval: 'monthly' | 'annual') => void
  /**
   * Controlled billing interval. When provided (with `onIntervalChange`), the parent owns
   * the toggle state — used by wizards that must persist the interval even when the user
   * flips the toggle without re-clicking a tier CTA. Omit for the default uncontrolled mode.
   */
  interval?: 'monthly' | 'annual'
  onIntervalChange?: (interval: 'monthly' | 'annual') => void
  /**
   * Optional promo note rendered under a tier's price line (e.g. the onboarding intro
   * offer "3 meses a $599" on PRO). Display-only — the caller owns the promo's billing logic.
   */
  promoNotes?: Partial<Record<TierId, string>>
}

export function PlanPicker({ currentTier, onSelectTier, interval: controlledInterval, onIntervalChange, promoNotes }: PlanPickerProps) {
  const { t } = useTranslation('billing')
  const [internalInterval, setInternalInterval] = useState<'monthly' | 'annual'>('monthly')
  const interval = controlledInterval ?? internalInterval
  const setInterval = (i: 'monthly' | 'annual') => {
    setInternalInterval(i)
    onIntervalChange?.(i)
  }

  const tiers = useMemo(() => PLAN_TIERS, [])

  return (
    <div className="flex flex-col gap-6">
      {/* Billing toggle — the savings hint lives ON the annual segment so it's unambiguously
          tied to choosing annual (not a floating pill that reads as always-on). */}
      <div className="flex items-center gap-3">
        <div className="inline-flex rounded-full border border-input bg-muted/60 p-1">
          {(['monthly', 'annual'] as const).map(i => (
            <button
              key={i}
              type="button"
              onClick={() => setInterval(i)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition cursor-pointer',
                interval === i ? 'bg-foreground text-background' : 'text-muted-foreground',
              )}
            >
              {t(`plan.billing.${i}`)}
              {i === 'annual' && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
                    interval === 'annual' ? 'bg-emerald-400 text-emerald-950' : 'bg-emerald-400/15 text-emerald-500',
                  )}
                >
                  {t('plan.billing.save')}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiers.map(tier => (
          <PlanCard
            key={tier.id}
            tier={tier}
            interval={interval}
            isCurrent={tier.id === currentTier}
            isDowngrade={TIER_ORDER.indexOf(tier.id) < TIER_ORDER.indexOf(currentTier)}
            promoNote={promoNotes?.[tier.id]}
            onSelect={() => onSelectTier(tier.id, interval)}
          />
        ))}
      </div>
    </div>
  )
}

function PlanCard({
  tier,
  interval,
  isCurrent,
  isDowngrade,
  promoNote,
  onSelect,
}: {
  tier: PlanTierDef
  interval: 'monthly' | 'annual'
  isCurrent: boolean
  isDowngrade: boolean
  promoNote?: string
  onSelect: () => void
}) {
  const { t } = useTranslation('billing')
  const Icon = tier.icon
  const tierName = t(`plan.tiers.${tier.key}.name`)
  // Always show the effective MONTHLY price as the headline; annual shows the per-month
  // equivalent with the yearly total in the subtitle (matches the approved mockup).
  const monthlyEquiv =
    interval === 'monthly' ? tier.priceMonthly : tier.priceAnnual != null ? Math.round(tier.priceAnnual / 12) : null

  return (
    <div
      data-tour={`plan-card-${tier.id.toLowerCase()}`}
      className={cn(
        'relative flex flex-col gap-4 rounded-2xl border border-input bg-card p-5 transition hover:-translate-y-0.5',
        tier.popular && 'border-emerald-400/55 ring-1 ring-emerald-400/25',
      )}
    >
      {tier.popular && (
        <span className="absolute -top-3 left-5 rounded-full bg-emerald-400 px-2.5 py-1 text-[11px] font-bold text-emerald-950">
          {t('plan.popular')}
        </span>
      )}
      <div className={cn('grid h-10 w-10 place-items-center rounded-xl', ACCENT_BG[tier.accent], ACCENT[tier.accent])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-lg font-bold">{tierName}</div>
      <p className="min-h-[34px] text-sm text-muted-foreground">{t(`plan.tiers.${tier.key}.pitch`)}</p>

      <div className="flex items-baseline gap-1.5">
        {monthlyEquiv === null ? (
          <span className="text-xl font-extrabold">{t('plan.cta.contact')}</span>
        ) : (
          <>
            <span className="text-3xl font-extrabold tracking-tight">{fmt(monthlyEquiv)}</span>
            <span className="text-xs text-muted-foreground">{t('plan.perMonth')}</span>
            {monthlyEquiv > 0 && <span className="text-[11px] text-muted-foreground">{t('plan.plusIva')}</span>}
          </>
        )}
      </div>
      <div className="min-h-[16px] text-xs text-muted-foreground">
        {tier.id === 'FREE'
          ? t('plan.forever')
          : tier.priceMonthly === null
            ? ''
            : interval === 'annual' && tier.priceAnnual != null
              ? t('plan.annualEquiv', { price: fmt(tier.priceAnnual) })
              : t('plan.billedMonthly')}
      </div>
      {promoNote && (
        <div className="rounded-lg bg-emerald-400/10 px-2.5 py-1.5 text-xs font-medium text-emerald-500">{promoNote}</div>
      )}

      <ul className="mt-1 flex flex-col gap-2.5">
        {tier.featureKeys.map(fk => (
          <li key={fk} className="flex items-start gap-2 text-sm">
            <Check className={cn('mt-0.5 h-4 w-4 shrink-0', ACCENT[tier.accent])} />
            <span>
              {t(`plan.features.${fk}`)}
              {fk === 'chatbotBeta' && (
                <Badge variant="outline" className="ml-1.5 h-4 px-1 text-[9px]">
                  Beta
                </Badge>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-2">
        {isCurrent ? (
          <Button disabled variant="ghost" className="w-full cursor-default text-muted-foreground">
            {t('plan.cta.current')}
          </Button>
        ) : tier.checkout === 'coming_soon' ? (
          <Button disabled variant="outline" className="w-full gap-2">
            <Badge variant="outline" className="h-4 px-1 text-[10px]">
              {t('plan.comingSoon')}
            </Badge>
          </Button>
        ) : tier.checkout === 'contact' ? (
          <Button variant="outline" className="w-full cursor-pointer" onClick={onSelect}>
            {t('plan.cta.contact')}
          </Button>
        ) : (
          <Button
            className="w-full cursor-pointer"
            variant={tier.popular && !isDowngrade ? 'default' : 'outline'}
            onClick={onSelect}
          >
            {t(`plan.cta.${isDowngrade ? 'downgrade' : 'upgrade'}`, { tier: tierName })}
          </Button>
        )}
      </div>
    </div>
  )
}
