// src/components/billing/PlanPicker.tsx
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PLAN_TIERS, type TierId, type PlanTierDef } from '@/config/plan-catalog'

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
}

export function PlanPicker({ currentTier, onSelectTier }: PlanPickerProps) {
  const { t } = useTranslation('billing')
  const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly')

  const tiers = useMemo(() => PLAN_TIERS, [])

  return (
    <div className="flex flex-col gap-6">
      {/* Billing toggle */}
      <div className="flex items-center gap-3">
        <div className="inline-flex rounded-full border border-input bg-muted/60 p-1">
          {(['monthly', 'annual'] as const).map(i => (
            <button
              key={i}
              type="button"
              onClick={() => setInterval(i)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-semibold transition cursor-pointer',
                interval === i ? 'bg-foreground text-background' : 'text-muted-foreground',
              )}
            >
              {t(`plan.billing.${i}`)}
            </button>
          ))}
        </div>
        <span className="rounded-full bg-emerald-400/12 px-2.5 py-1 text-xs font-semibold text-emerald-400">
          {t('plan.billing.save')}
        </span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiers.map(tier => (
          <PlanCard
            key={tier.id}
            tier={tier}
            interval={interval}
            isCurrent={tier.id === currentTier}
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
  onSelect,
}: {
  tier: PlanTierDef
  interval: 'monthly' | 'annual'
  isCurrent: boolean
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
            variant={tier.popular ? 'default' : 'outline'}
            onClick={onSelect}
          >
            {t('plan.cta.upgrade', { tier: tierName })}
          </Button>
        )}
      </div>
    </div>
  )
}
