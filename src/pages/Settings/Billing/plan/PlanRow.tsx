// src/pages/Settings/Billing/plan/PlanRow.tsx
import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { salesWhatsAppLink } from '@/config/plan-catalog'
import type { PlanOrigin, PlanState } from '@/services/features.service'
import type { FeatureGrid, HybridReplacementOptions } from '@/services/hybridBilling.service'
import { useVenueDateTime } from '@/utils/datetime'
import { getIntlLocale } from '@/utils/i18n-locale'
import { planPillPrice, tierFeatureCount, type PlanTarget } from './planActions'

const TIERS: PlanTarget[] = ['FREE', 'PRO', 'PREMIUM']

export interface PlanRowProps {
  origin: PlanOrigin
  planState: PlanState | undefined
  grandfathered: boolean
  grid: FeatureGrid | undefined
  replacements: HybridReplacementOptions | undefined
  classicRejected: boolean
  current: PlanTarget
  selected: PlanTarget
  onSelect: (tier: PlanTarget) => void
  interval: 'monthly' | 'annual'
  onIntervalChange: (interval: 'monthly' | 'annual') => void
  canManage: boolean
  busy: boolean
  onCancel: () => void
  onReactivate: () => void
  onUpdatePayment: () => void
  /** What the selection quotes at list price (spec §5): the pill shows the price the quote will carry. */
  preferList?: string[]
}

/** "Tu plan": three choices with what each one costs today, and the status of the one obligation behind it (spec §4.2). */
export function PlanRow(props: PlanRowProps) {
  const { t, i18n } = useTranslation('billing')
  const { formatDate } = useVenueDateTime()
  const { origin, planState, grandfathered, current, selected, canManage, busy } = props
  const money = (value: number) => new Intl.NumberFormat(getIntlLocale(i18n.language), { style: 'currency', currency: 'MXN' }).format(value)
  const tierName = (tier: PlanTarget) => t(`plan.tiers.${tier.toLowerCase()}.name`)
  const originTier = origin.tier ? tierName(origin.tier) : ''
  const until = origin.cancelAt ?? origin.currentPeriodEnd
  const untilText = until ? formatDate(until) : null
  const suspended = origin.kind === 'CLASSIC' && (planState?.state === 'past_due' || planState?.state === 'suspended')
  // Mensual/Anual only matters to the classic checkout: a paid plan picked while on Gratis.
  const showInterval = origin.kind === 'NONE' && !grandfathered && !props.classicRejected && selected !== 'FREE'
  const priceInput = {
    origin,
    grandfathered,
    grid: props.grid,
    replacements: props.replacements,
    classicRejected: props.classicRejected,
    interval: props.interval,
    preferList: props.preferList,
  }
  const statusText =
    origin.kind === 'COMP'
      ? untilText
        ? t('plan.row.comp', { tier: originTier, date: untilText })
        : t('plan.row.compNoDate', { tier: originTier })
      : origin.cancelAt
        ? t(origin.kind === 'CONTRACT' ? 'plan.row.endsContract' : 'plan.row.endsClassic', { tier: originTier, date: untilText })
        : untilText
          ? t('currentPlan.renewsOn', { date: untilText })
          : null

  return (
    <section className="space-y-3" data-tour="plan-row">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">{t('plan.row.label')}</span>
        <div role="radiogroup" aria-label={t('plan.chooseAria')} className="flex flex-wrap gap-2">
          {TIERS.map(tier => {
            const price = planPillPrice(tier, priceInput)
            const isSelected = selected === tier
            return (
              <button
                key={tier}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={grandfathered || !canManage}
                onClick={() => props.onSelect(tier)}
                data-tour={`plan-option-${tier.toLowerCase()}`}
                className={cn(
                  'flex items-center gap-2 rounded-xl border border-input bg-card px-4 py-2.5 text-left text-sm transition-colors',
                  isSelected ? 'border-foreground ring-1 ring-foreground' : 'hover:bg-muted/50',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                )}
              >
                <span
                  aria-hidden
                  className={cn('h-3.5 w-3.5 rounded-full border', isSelected ? 'border-[5px] border-foreground' : 'border-input')}
                />
                <span className="font-semibold">{tierName(tier)}</span>
                <span className="tabular-nums">
                  {money(price.amount)}
                  {tier !== 'FREE' && (price.per === 'year' ? t('plan.perYear') : t('plan.perMonth'))}
                </span>
                {props.grid && (
                  <span className="text-xs text-muted-foreground">
                    {t('plan.row.features', { count: tierFeatureCount(props.grid.entries, tier) })}
                  </span>
                )}
                {current === tier && <Badge variant="soft">{t('plan.row.current')}</Badge>}
              </button>
            )
          })}
        </div>
        {showInterval && (
          <div className="flex rounded-lg border border-input p-0.5 text-sm" role="group" data-tour="plan-interval">
            {(['monthly', 'annual'] as const).map(value => (
              <button
                key={value}
                type="button"
                aria-pressed={props.interval === value}
                onClick={() => props.onIntervalChange(value)}
                className={cn('rounded-md px-3 py-1', props.interval === value && 'bg-foreground text-background')}
              >
                {t(`plan.billing.${value}`)}
              </button>
            ))}
          </div>
        )}
        <a
          className="ml-auto text-sm underline"
          href={salesWhatsAppLink('Hola, quiero el plan Enterprise de Avoqado para varias sucursales.')}
          target="_blank"
          rel="noreferrer"
          data-tour="plan-enterprise"
        >
          {t('plan.row.enterprise')}
        </a>
      </div>

      {grandfathered ? (
        <p className="text-sm text-muted-foreground" data-tour="plan-status">
          {t('plan.row.founder')}
        </p>
      ) : origin.kind === 'NONE' ? null : (
        <div className="flex flex-wrap items-center gap-3 text-sm" data-tour="plan-status">
          {suspended ? (
            <p role="alert" className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              {t('plan.row.paymentPending')}
            </p>
          ) : origin.kind === 'CONTRACT' && origin.paymentIssue ? (
            <p role="alert" className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              {t('hybrid.fundingIssue')}
            </p>
          ) : (
            statusText && <p className="text-muted-foreground">{statusText}</p>
          )}
          {origin.kind === 'CLASSIC' &&
            (origin.cancelAt ? (
              <Button size="sm" disabled={!canManage || busy} onClick={props.onReactivate} data-tour="plan-reactivate">
                {t('plan.row.resume')}
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled={!canManage || busy} onClick={props.onCancel} data-tour="plan-cancel">
                {t('currentPlan.actions.cancel')}
              </Button>
            ))}
          {origin.kind === 'CLASSIC' && (
            <Button
              size="sm"
              variant="outline"
              disabled={!canManage || busy}
              onClick={props.onUpdatePayment}
              data-tour="plan-update-payment"
            >
              {t('currentPlan.actions.updatePayment')}
            </Button>
          )}
          {origin.kind === 'CONTRACT' && !origin.cancelAt && (
            <Button size="sm" variant="outline" disabled={!canManage || busy} onClick={props.onCancel} data-tour="plan-cancel">
              {t('hybrid.cancelContract')}
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
