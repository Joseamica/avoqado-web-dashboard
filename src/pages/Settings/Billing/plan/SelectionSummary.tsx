// src/pages/Settings/Billing/plan/SelectionSummary.tsx
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FeatureGridEntry, FeatureGridOffer } from '@/services/hybridBilling.service'
import { getIntlLocale } from '@/utils/i18n-locale'
import type { DependencyFix, PlanOperation, SelectionSummaryModel } from './planActions'

export interface SelectionSummaryProps {
  model: SelectionSummaryModel
  seatRule: 'CHOOSE' | 'AUTOMATIC'
  canManage: boolean
  busy: boolean
  error: string | null
  onReview: () => void
  onPickTier: (tier: 'PRO' | 'PREMIUM') => void
  /** Only when there is a paid plan to ask about: an assisted "Gratis" is never offered. */
  onAssisted?: () => void
  /** A refused "drop to Gratis keeping functions": the spec's fallback, drop at period end (§4.1). */
  onFallbackDrop?: () => void
  /** A refused dependency term (HYBRID_DEPENDENCY_TERM): what fixes it (spec §5). */
  dependency?: DependencyFix | null
  /** Quote that function (or `'PLAN'`) at its list price instead. */
  onPreferList?: (code: string) => void
}

const PURCHASES: PlanOperation['kind'][] = ['FEATURES', 'CLASSIC_CHECKOUT', 'HYBRID_REPLACE', 'HYBRID_DROP']
const IDLE: PlanOperation['kind'][] = ['NONE', 'FOUNDER', 'COMP']

function ctaKey(op: PlanOperation): string {
  if (op.kind === 'DOWNGRADE_CLASSIC') return 'plan.selection.drop'
  if (op.kind === 'CANCEL_CONTRACT') return 'hybrid.cancelContract'
  if (op.kind === 'ASSISTED') return 'plan.selection.assisted'
  return 'plan.selection.review'
}

/** "Tu selección": what changes and what it costs — "Pagas hoy" only when a server number backs it (spec §4.2). */
export function SelectionSummary({
  model,
  seatRule,
  canManage,
  busy,
  error,
  onReview,
  onPickTier,
  onAssisted,
  onFallbackDrop,
  dependency,
  onPreferList,
}: SelectionSummaryProps) {
  const { t, i18n } = useTranslation('billing')
  const lang = (['es', 'en', 'fr'] as const).find(code => i18n.language.startsWith(code)) ?? 'es'
  const money = (value: number) => new Intl.NumberFormat(getIntlLocale(i18n.language), { style: 'currency', currency: 'MXN' }).format(value)
  const tierName = (tier: string) => t(`plan.tiers.${tier.toLowerCase()}.name`)
  const name = (entry: FeatureGridEntry) =>
    entry.featureCode ? t(`hybrid.featureNames.${entry.featureCode}`, { defaultValue: entry.names[lang] }) : entry.names[lang]
  const codeName = (code: string, entry?: FeatureGridEntry) =>
    entry ? name(entry) : t(`hybrid.featureNames.${code}`, { defaultValue: code })
  const promo = (offer: FeatureGridOffer) =>
    offer.renewal === 'REPRICE' && offer.promotionCycles && offer.renewalPrice != null
      ? t('plan.selection.promo', { count: offer.promotionCycles, price: money(offer.renewalPrice) })
      : offer.renewal === 'END' && offer.promotionCycles
        ? t('plan.selection.promoEnd', { count: offer.promotionCycles })
        : null
  const op = model.operation
  const purchase = PURCHASES.includes(op.kind)
  const disabled = !canManage || busy || model.tooMany || IDLE.includes(op.kind)
  const title = model.target !== model.current ? t('plan.selection.titleChange') : t('plan.selection.title')
  const cta = t(ctaKey(op))
  // On a paid plan the lines are only the functions being added: the figure is what's added, not the whole bill.
  const totalLabel = t(
    model.target === model.current && model.current !== 'FREE' ? 'plan.selection.monthlyAdded' : 'plan.selection.monthlyTotal',
  )

  const idleText =
    op.kind === 'FOUNDER'
      ? t('plan.selection.founder')
      : op.kind === 'COMP'
        ? t('plan.selection.comp')
        : op.kind === 'NONE'
          ? t('plan.selection.empty')
          : null

  return (
    <>
      <aside className="space-y-4 rounded-2xl border border-input bg-card p-5 xl:sticky xl:top-6 xl:self-start" data-tour="plan-selection">
        <h2 className="text-lg font-semibold">{title}</h2>
        {idleText ? (
          <p className="text-sm text-muted-foreground">{idleText}</p>
        ) : (
          <>
            <ul className="space-y-2 text-sm">
              {model.lines.map(line => (
                <li key={line.key} className="space-y-0.5">
                  <div className="flex justify-between gap-3">
                    <span>{line.plan ? t('plan.selection.plan', { tier: tierName(line.plan) }) : name(line.entry!)}</span>
                    <span className="tabular-nums">{line.price == null ? '—' : money(line.price)}</span>
                  </div>
                  {line.offer && promo(line.offer) && <p className="text-xs text-muted-foreground">{promo(line.offer)}</p>}
                </li>
              ))}
            </ul>
            {model.monthlyTotal != null && (
              <div className="border-t border-input pt-3">
                <p className="text-xs text-muted-foreground">{totalLabel}</p>
                <p className="text-3xl font-bold tabular-nums">{money(model.monthlyTotal)}</p>
                <p className="text-xs text-muted-foreground">
                  {t('plan.ivaIncluded')}
                  {purchase &&
                    ` · ${model.payToday != null ? t('plan.selection.payToday', { price: money(model.payToday) }) : t('plan.selection.payTodayAtReview')}`}
                </p>
              </div>
            )}
            {model.lose.length > 0 && (
              <div className="space-y-1 text-sm">
                <p className="font-medium">{t('plan.selection.lose')}</p>
                <ul className="space-y-0.5">
                  {model.lose.map(entry => (
                    <li key={entry.id} className="flex items-center gap-2">
                      <X className="h-3.5 w-3.5 text-destructive" aria-hidden />
                      {name(entry)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {model.hint && (
              <div className="rounded-xl border border-emerald-600/20 bg-emerald-600/5 p-3 text-sm" data-tour="plan-hint">
                <p>
                  {t('plan.selection.hint', {
                    tier: tierName(model.hint.tier),
                    covered: model.hint.covered,
                    more: model.hint.more,
                    price: money(model.hint.price),
                  })}{' '}
                  <button type="button" className="underline" onClick={() => onPickTier(model.hint!.tier)} data-tour="plan-hint-cta">
                    {t('plan.selection.hintCta', { tier: tierName(model.hint.tier) })}
                  </button>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{t('plan.selection.hintNote')}</p>
              </div>
            )}
            {op.kind === 'HYBRID_REPLACE' && model.current === 'FREE' && (
              <p className="text-xs text-muted-foreground">{t('plan.selection.absorbed')}</p>
            )}
            {op.kind === 'ASSISTED' && <p className="text-xs text-muted-foreground">{t('plan.selection.assistedNote')}</p>}
            {model.seatNotice && (
              <p className="text-xs text-muted-foreground" data-tour="plan-seat-notice">
                {t(seatRule === 'CHOOSE' ? 'plan.seatNotice.choose' : 'plan.seatNotice.automatic')}
              </p>
            )}
          </>
        )}
        {error && (
          <div role="alert" className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <p>{error}</p>
            {dependency && dependency.kind !== 'LIST' && (
              <p>
                {t(
                  dependency.kind === 'REMOVE'
                    ? 'plan.dependency.remove'
                    : dependency.kind === 'MISSING'
                      ? 'plan.dependency.missing'
                      : // The text names «Cambio asistido» only when that button is on screen (not on Gratis).
                        onAssisted
                        ? 'plan.dependency.retained'
                        : 'plan.dependency.retainedContact',
                  { name: codeName(dependency.code, dependency.entry) },
                )}
              </p>
            )}
            {dependency?.kind === 'LIST' && onPreferList && (
              <Button
                variant="link"
                className="block h-auto whitespace-normal p-0 text-left"
                disabled={busy || !canManage}
                onClick={() => onPreferList(dependency.prefer)}
                data-tour="plan-use-list"
              >
                {t('plan.dependency.useList', {
                  name: dependency.plan ? tierName(dependency.plan) : codeName(dependency.prefer, dependency.entry),
                  price: money(dependency.price),
                })}
              </Button>
            )}
            {onFallbackDrop && (
              <Button
                variant="link"
                className="block h-auto p-0"
                disabled={busy || !canManage}
                onClick={onFallbackDrop}
                data-tour="plan-fallback-drop"
              >
                {t('plan.selection.fallbackDrop')}
              </Button>
            )}
            {onAssisted && (
              <Button
                variant="link"
                className="block h-auto p-0"
                disabled={busy || !canManage}
                onClick={onAssisted}
                data-tour="plan-assisted"
              >
                {t('plan.selection.assisted')}
              </Button>
            )}
          </div>
        )}
        {!canManage && <p className="text-xs text-muted-foreground">{t('hybrid.permission')}</p>}
        <Button className="w-full" disabled={disabled} onClick={onReview} data-tour="plan-review">
          {cta}
        </Button>
      </aside>
      {/* Phone: a full-width bar (the app sidebar is off-canvas). From lg the sidebar is a visible column, so the bar
          becomes a floating card centered in the content area — clear of the sidebar and its user menu, even resized
          (the dashboard's Selection Summary Bar pattern). From xl "Tu selección" sits beside the grid and it goes. */}
      <div
        className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-input bg-background p-3 lg:inset-x-auto lg:bottom-6 lg:left-[calc(50%+var(--sidebar-width)/2)] lg:w-auto lg:min-w-80 lg:-translate-x-1/2 lg:rounded-xl lg:border lg:shadow-lg xl:hidden"
        data-tour="plan-selection-bar"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">{totalLabel}</p>
          <p className="font-semibold tabular-nums">{model.monthlyTotal != null ? money(model.monthlyTotal) : '—'}</p>
        </div>
        <Button disabled={disabled} onClick={onReview} data-tour="plan-review-bar">
          {cta}
        </Button>
      </div>
    </>
  )
}
