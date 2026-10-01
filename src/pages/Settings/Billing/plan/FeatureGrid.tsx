// src/pages/Settings/Billing/plan/FeatureGrid.tsx
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FeatureGridEntry, FeatureGridOffer } from '@/services/hybridBilling.service'
import { useVenueDateTime } from '@/utils/datetime'
import { getIntlLocale } from '@/utils/i18n-locale'
import { featureIcon } from './featureIcons'
import { MAX_OFFERS, TIER_RANK, type GridMode, type PlanTarget } from './planActions'

const CATEGORY_ORDER = ['sell', 'customers', 'inventory', 'money', 'team', 'ai', 'custom'] as const

export interface FeatureGridProps {
  entries: FeatureGridEntry[]
  purchasesEnabled: boolean
  mode: GridMode
  marked: string[]
  isMarkable: (entry: FeatureGridEntry) => boolean
  onToggle: (featureCode: string) => void
  onPickTier: (tier: 'PRO' | 'PREMIUM') => void
  canManage: boolean
  /** The plan the row has selected: a function above it jumps to the plan that includes it. */
  target: PlanTarget
}

/** All 40 functions at once, by area (the founder's choice, Odoo-style): nothing hidden, nothing paged. */
export function FeatureGrid({
  entries,
  purchasesEnabled,
  mode,
  marked,
  isMarkable,
  onToggle,
  onPickTier,
  canManage,
  target,
}: FeatureGridProps) {
  const { t, i18n } = useTranslation('billing')
  const { formatDate } = useVenueDateTime()
  const lang = (['es', 'en', 'fr'] as const).find(code => i18n.language.startsWith(code)) ?? 'es'
  const money = (value: number) => new Intl.NumberFormat(getIntlLocale(i18n.language), { style: 'currency', currency: 'MXN' }).format(value)
  const name = (entry: FeatureGridEntry) =>
    entry.featureCode ? t(`hybrid.featureNames.${entry.featureCode}`, { defaultValue: entry.names[lang] }) : entry.names[lang]
  const full = marked.length >= MAX_OFFERS
  // How long a promotion below its list lasts (spec §5): «Por 3 meses; luego $599», «Mientras la conserves».
  const condition = (offer: FeatureGridOffer, listPrice: number) =>
    offer.renewal === 'REPRICE'
      ? t('plan.grid.promoThen', { count: offer.promotionCycles, price: money(offer.renewalPrice ?? listPrice) })
      : offer.renewal === 'END'
        ? t('plan.grid.promoEnds', { count: offer.promotionCycles })
        : t('plan.grid.promoForever')
  const intro = !purchasesEnabled ? 'plan.grid.introClosed' : mode === 'DROP' ? 'plan.grid.introDrop' : 'plan.grid.intro'

  const status = (entry: FeatureGridEntry): { text: string | null; owned: boolean } => {
    const { source, paidThrough, cancelAt } = entry.access
    if (source === 'GRANDFATHERED') return { text: t('plan.grid.founder'), owned: true }
    if (source === 'FREE') return { text: t('plan.grid.included'), owned: true }
    if (source === 'PLAN') return { text: t('plan.grid.inPlan'), owned: true }
    if (source === 'STANDALONE') return { text: t('plan.grid.owned'), owned: true }
    if (source === 'CONTRACT')
      return {
        text: cancelAt
          ? t('plan.grid.ownedEnds', { date: formatDate(cancelAt) })
          : paidThrough
            ? t('plan.grid.ownedUntil', { date: formatDate(paidThrough) })
            : t('plan.grid.owned'),
        owned: true,
      }
    if (entry.minimumTier && entry.minimumTier !== 'FREE')
      return { text: t(`plan.tiers.${entry.minimumTier.toLowerCase()}.name`), owned: false }
    return { text: null, owned: false }
  }

  const tile = (entry: FeatureGridEntry) => {
    const Icon = featureIcon(entry.id)
    const code = entry.featureCode
    const checked = !!code && marked.includes(code)
    const markable = !!code && purchasesEnabled && mode !== 'VIEW' && canManage && isMarkable(entry) && (checked || !full)
    const upsellTier =
      entry.access.source === 'NONE' && !entry.offer && (entry.minimumTier === 'PRO' || entry.minimumTier === 'PREMIUM')
        ? entry.minimumTier
        : null
    const { text, owned } = status(entry)
    // Owned already: no price to buy it again, unless going to Gratis and keeping it alone (DROP).
    const showPrice = !!entry.offer && purchasesEnabled && (mode === 'DROP' || !owned)
    const listPrice =
      showPrice && entry.offer?.listPrice != null && entry.offer.listPrice > entry.offer.price ? entry.offer.listPrice : null
    const tour = `feature-tile-${entry.id.toLowerCase()}`
    const className = cn(
      'flex w-full items-center gap-3 rounded-xl border border-input bg-card p-3 text-left',
      checked && 'border-foreground ring-1 ring-foreground',
      owned && 'bg-muted/40',
    )
    const body = (
      <>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-input bg-background">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{name(entry)}</span>
          <span className="block text-sm font-semibold tabular-nums">
            {showPrice && entry.offer
              ? `${money(entry.offer.price)}${t('plan.perMonth')}`
              : entry.offering === 'CONTACT'
                ? t('plan.grid.quote')
                : ' '}
            {listPrice != null && <s className="ml-1.5 font-normal text-muted-foreground">{money(listPrice)}</s>}
          </span>
          {listPrice != null && entry.offer && (
            <span className="block text-xs text-muted-foreground">{condition(entry.offer, listPrice)}</span>
          )}
        </span>
        <span className="flex flex-col items-end gap-1">
          {markable ? (
            <span
              aria-hidden
              className={cn(
                'grid h-4 w-4 place-items-center rounded border',
                checked ? 'border-foreground bg-foreground text-background' : 'border-input',
              )}
            >
              {checked && <Check className="h-3 w-3" />}
            </span>
          ) : owned ? (
            <Check className="h-4 w-4 text-emerald-600" aria-hidden />
          ) : null}
          {text && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{text}</span>}
        </span>
      </>
    )
    if (markable)
      return (
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label={t('plan.grid.mark', { name: name(entry) })}
          onClick={() => onToggle(code!)}
          className={cn(className, 'cursor-pointer hover:bg-muted/50')}
          data-tour={tour}
        >
          {body}
        </button>
      )
    // Also while viewing another plan (VIEW): with Pro picked, a Premium function must still switch to Premium.
    if (upsellTier && canManage && mode !== 'DROP' && TIER_RANK[upsellTier] > TIER_RANK[target])
      return (
        <button
          type="button"
          onClick={() => onPickTier(upsellTier)}
          aria-label={t('plan.grid.pickTier', { name: name(entry), tier: t(`plan.tiers.${upsellTier.toLowerCase()}.name`) })}
          className={cn(className, 'hover:bg-muted/50')}
          data-tour={tour}
        >
          {body}
        </button>
      )
    return (
      <div className={className} data-tour={tour}>
        {body}
      </div>
    )
  }

  return (
    <section className="space-y-5" data-tour="feature-grid" aria-labelledby="feature-grid-title">
      <header className="space-y-1">
        <h2 id="feature-grid-title" className="text-lg font-semibold">
          {t('plan.grid.title', { count: entries.length })}
        </h2>
        <p className="text-sm text-muted-foreground">{t(intro)}</p>
        {full && (
          <p className="text-xs text-muted-foreground" role="status">
            {t('plan.grid.maxOffers')}
          </p>
        )}
      </header>
      {CATEGORY_ORDER.map(category => {
        const rows = entries.filter(entry => entry.category === category)
        if (!rows.length) return null
        return (
          <div key={category} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(`plan.grid.categories.${category}`)} · {rows.length}
            </h3>
            {/* Columns follow the grid's own width, not the screen's: on a laptop the settings menu and "Tu selección"
                leave it narrow, and viewport breakpoints squeezed three tiles into ~100 px each. 16rem is the narrowest
                tile where a price like "MX$249.00/mo" still clears the "Premium" badge (14rem ran it underneath). */}
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-2">
              {rows.map(entry => (
                <li key={entry.id}>{tile(entry)}</li>
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
