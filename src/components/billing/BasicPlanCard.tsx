import { useTranslation } from 'react-i18next'
import { Check, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtPesos } from '@/utils/pesos'
import type { PublicBasicPlan } from '@/services/hybridBilling.service'

/**
 * La tarjeta del Plan Básico en «Elige tu plan», a la izquierda de Pro. Mismo molde que las tarjetas de
 * `PlanPicker`: toda la tarjeta es el radio. El precio es SIEMPRE sin IVA, con «+ IVA» en chico (regla del 5-nov).
 */
export function BasicPlanCard({
  plan,
  selected,
  disabled,
  onSelect,
}: {
  plan: PublicBasicPlan
  selected: boolean
  disabled?: boolean
  onSelect: () => void
}) {
  const { t } = useTranslation('billing')
  const price = fmtPesos(plan.priceWithoutTax)
  return (
    <div
      data-tour="plan-card-basic"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      tabIndex={0}
      onClick={() => !disabled && onSelect()}
      onKeyDown={e => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (!disabled) onSelect()
        }
      }}
      className={cn(
        'relative flex cursor-pointer flex-col gap-4 rounded-2xl border border-input bg-card p-5 transition hover:-translate-y-0.5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        !selected && 'hover:border-foreground/30',
        selected && 'border-primary ring-2 ring-primary/30 hover:translate-y-0',
      )}
    >
      {selected && (
        <span
          aria-hidden="true"
          className="absolute -top-3 right-4 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground"
        >
          <Check className="h-3.5 w-3.5" />
        </span>
      )}
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="text-lg font-bold">{plan.name}</div>
      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
        <span className="text-3xl font-extrabold tracking-tight">{price}</span>
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {t('plan.perMonth')} · {t('plan.plusIva')}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{t('plan.basic.trialCopy', { price })}</p>
      <ul className="mt-1 flex flex-col gap-2.5">
        {plan.featureCodes.map(code => (
          <li key={code} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{t(`hybrid.featureNames.${code}`, { defaultValue: code })}</span>
          </li>
        ))}
        <li className="flex items-start gap-2 text-sm">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span>{plan.seatCap == null ? t('plan.basic.seatsUnlimited') : t('plan.basic.seatsCapped', { count: plan.seatCap })}</span>
        </li>
      </ul>
    </div>
  )
}
