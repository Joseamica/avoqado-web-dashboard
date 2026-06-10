/**
 * PlanStep — V2 wizard final step (mandatory, no skip).
 *
 * 4-tier selection (FREE / PRO / PREMIUM / ENTERPRISE) driven by PLAN_TIERS via the
 * shared billing PlanPicker (same integration pattern as ConversionWizard):
 *   - FREE        → continue without a card; the venue simply stays on the Free plan.
 *   - PRO/PREMIUM → card captured via Stripe Elements against a customer-scoped
 *                   SetupIntent, then two CTAs: "Empezar 30 días gratis" (payNow:false)
 *                   or "Pagar hoy" (payNow:true). PRO monthly pay-now keeps the
 *                   $599×3 intro promo (INTRO_PRO_3M on the backend).
 *   - ENTERPRISE  → contact sales (no self-serve).
 * On confirm, persists v2SetupData.plan = { tier, paymentMethodId?, interval, payNow?, acceptedAt }.
 * Old payloads have no `tier`; the backend defaults them to PRO for back-compat.
 * Spec: docs/superpowers/specs/2026-06-02-venue-base-subscription-design.md
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { PlanPicker } from '@/components/billing/PlanPicker'
import { getTierDef, type TierId } from '@/config/plan-catalog'
import { setupService } from '@/services/setup.service'
import { useToast } from '@/hooks/use-toast'
import type { StepProps } from '../types'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string)

interface PlanStepProps extends StepProps {
  venueId: string
  organizationId: string
}

/** Tiers the wizard can persist. ENTERPRISE routes to contact-sales and is never stored. */
type SelectableTier = 'FREE' | 'PRO' | 'PREMIUM'

export function PlanStep({ onNext, venueId, data }: PlanStepProps) {
  const { t } = useTranslation('setup')
  const { t: tBilling } = useTranslation('billing')
  const [selectedTier, setSelectedTier] = useState<SelectableTier>(data.plan?.tier ?? 'PRO')
  const [interval, setInterval] = useState<'monthly' | 'annual'>(data.plan?.interval ?? 'monthly')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const { toast } = useToast()

  const isPaidTier = selectedTier === 'PRO' || selectedTier === 'PREMIUM'
  const tierName = tBilling(`plan.tiers.${getTierDef(selectedTier).key}.name`)

  useEffect(() => {
    if (!venueId) return
    let active = true
    setupService
      .planSetupIntent(venueId)
      .then(res => {
        if (active) setClientSecret(res.data.data.clientSecret)
      })
      .catch(() => toast({ title: 'No pudimos preparar el pago', variant: 'destructive' }))
    return () => {
      active = false
    }
  }, [venueId, toast])

  const options = useMemo(() => (clientSecret ? { clientSecret } : undefined), [clientSecret])

  const handleSelectTier = (tier: TierId) => {
    if (tier === 'ENTERPRISE') {
      // Enterprise is contact-sales only — no self-serve onboarding path (matches ConversionWizard).
      window.open('https://avoqado.io/contact', '_blank', 'noopener,noreferrer')
      return
    }
    setSelectedTier(tier)
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{t('plan.title', { defaultValue: 'Tu plan Avoqado' })}</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {t('plan.subtitle', { defaultValue: 'Elige el plan que mejor se adapte a tu negocio. Puedes cambiarlo cuando quieras.' })}
        </p>
      </div>

      {/* Reuse the billing PlanPicker — same cards + monthly/annual toggle as the billing
          portal and ConversionWizard. `currentTier` is bound to the in-wizard selection so
          the chosen tier reads as "selected". Interval is controlled so a toggle flip is
          persisted even without re-clicking a tier CTA. */}
      <div data-tour="setup-plan-picker">
        <PlanPicker
          currentTier={selectedTier}
          interval={interval}
          onIntervalChange={setInterval}
          promoNotes={interval === 'monthly' ? { PRO: t('plan.promoLine', { defaultValue: 'Paga hoy: 3 meses a $599 + IVA, luego $999.' }) } : undefined}
          onSelectTier={handleSelectTier}
        />
      </div>

      {isPaidTier ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-input p-5">
          <div>
            <p className="text-sm font-semibold">{t('plan.selectedPlan', { plan: tierName, defaultValue: 'Plan seleccionado: {{plan}}' })}</p>
            {selectedTier === 'PRO' && interval === 'monthly' && (
              <p className="text-xs text-muted-foreground mt-1">
                {t('plan.promoLine', { defaultValue: 'Paga hoy: 3 meses a $599 + IVA, luego $999.' })}
              </p>
            )}
          </div>
          {options ? (
            <Elements stripe={stripePromise} options={options}>
              <PlanCardForm
                tier={selectedTier}
                interval={interval}
                onConfirmed={(paymentMethodId, payNow) =>
                  onNext({ plan: { tier: selectedTier, paymentMethodId, interval, payNow, acceptedAt: new Date().toISOString() } })
                }
              />
            </Elements>
          ) : (
            <p className="text-sm text-muted-foreground">{t('plan.loading', { defaultValue: 'Cargando…' })}</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-2xl border border-input p-5">
          <p className="text-sm text-muted-foreground">
            {t('plan.freeNote', { defaultValue: 'Empieza gratis sin tarjeta. Puedes mejorar tu plan cuando quieras desde Facturación.' })}
          </p>
          <Button
            data-tour="setup-plan-free-continue"
            className="rounded-full"
            onClick={() => onNext({ plan: { tier: 'FREE', acceptedAt: new Date().toISOString() } })}
          >
            {t('plan.freeContinue', { defaultValue: 'Continuar con el plan Gratis' })}
          </Button>
        </div>
      )}
    </div>
  )
}

function PlanCardForm({
  tier,
  interval,
  onConfirmed,
}: {
  tier: 'PRO' | 'PREMIUM'
  interval: 'monthly' | 'annual'
  onConfirmed: (paymentMethodId: string, payNow: boolean) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const { t } = useTranslation('setup')
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const confirm = async (payNow: boolean) => {
    if (!stripe || !elements) return
    setSubmitting(true)
    try {
      const { error, setupIntent } = await stripe.confirmSetup({ elements, redirect: 'if_required' })
      if (error || !setupIntent?.payment_method) {
        toast({ title: error?.message || 'No se pudo guardar la tarjeta', variant: 'destructive' })
        return
      }
      onConfirmed(String(setupIntent.payment_method), payNow)
    } finally {
      setSubmitting(false)
    }
  }

  // The $599×3 intro promo only exists for PRO monthly — Premium and annual pay full price today.
  const payNowLabel =
    interval === 'annual'
      ? t('plan.payNowAnnual', { defaultValue: 'Pagar hoy (anual)' })
      : tier === 'PRO'
        ? t('plan.payNowMonthly', { defaultValue: 'Pagar hoy y ahorrar (3 meses a $599)' })
        : t('plan.payNow', { defaultValue: 'Pagar hoy' })

  return (
    <div className="flex flex-col gap-4">
      <PaymentElement />
      <div className="flex flex-col gap-3">
        <Button data-tour="setup-plan-start-trial" disabled={submitting} onClick={() => confirm(false)} className="rounded-full">
          {t('plan.startTrial', { defaultValue: 'Empezar 30 días gratis' })}
        </Button>
        <Button
          data-tour="setup-plan-pay-now"
          disabled={submitting}
          variant="outline"
          onClick={() => confirm(true)}
          className="rounded-full"
        >
          {payNowLabel}
        </Button>
      </div>
    </div>
  )
}
