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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { AlertCircle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlanPicker } from '@/components/billing/PlanPicker'
import { getTierDef, salesWhatsAppLink, type TierId } from '@/config/plan-catalog'
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
  // The SetupIntent can fail (backend flag off → 404) or never start (no provisional venue
  // yet). Both used to leave the step stuck on a permanent "Cargando…" with nothing to
  // click, which reads exactly like a dead button. Track the state so we can offer a retry.
  const [intentStatus, setIntentStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retryToken, setRetryToken] = useState(0)
  const { toast } = useToast()
  const checkoutPanelRef = useRef<HTMLDivElement | null>(null)

  const isPaidTier = selectedTier === 'PRO' || selectedTier === 'PREMIUM'
  const tierName = tBilling(`plan.tiers.${getTierDef(selectedTier).key}.name`)

  useEffect(() => {
    if (!venueId) {
      // Nothing to fetch against yet — surface it as an error with a retry instead of an
      // endless spinner (the provisional venue is created lazily by GET progress).
      setIntentStatus('error')
      return
    }
    let active = true
    setIntentStatus('loading')
    setupService
      .planSetupIntent(venueId)
      .then(res => {
        if (!active) return
        setClientSecret(res.data.data.clientSecret)
        setIntentStatus('ready')
      })
      .catch(() => {
        if (!active) return
        setIntentStatus('error')
        toast({ title: t('plan.setupIntentError', { defaultValue: 'No pudimos preparar el pago' }), variant: 'destructive' })
      })
    return () => {
      active = false
    }
  }, [venueId, retryToken, toast, t])

  const options = useMemo(() => (clientSecret ? { clientSecret } : undefined), [clientSecret])

  const handleSelectTier = useCallback((tier: TierId) => {
    if (tier === 'ENTERPRISE') {
      // Enterprise is contact-sales only — no self-serve onboarding path (matches ConversionWizard).
      window.open(salesWhatsAppLink('Hola, me interesa el plan Enterprise de Avoqado para mi negocio.'), '_blank', 'noopener,noreferrer')
      return
    }
    setSelectedTier(tier)
    // Picking a plan on a wide pricing grid leaves the actual next action (card form or
    // "Continuar") below the fold — bring it into view so the choice visibly leads somewhere.
    requestAnimationFrame(() => checkoutPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }, [])

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
          // Wizard semantics: `currentTier` is the pick, not a plan the venue owns. Without
          // this the pre-selected PRO card rendered a disabled "Tu plan actual".
          selectionMode="choice"
          interval={interval}
          onIntervalChange={setInterval}
          promoNotes={interval === 'monthly' ? { PRO: t('plan.promoLine', { defaultValue: 'Paga hoy: 3 meses a $599 + IVA, luego $999.' }) } : undefined}
          onSelectTier={handleSelectTier}
        />
      </div>

      <div ref={checkoutPanelRef} className="mx-auto flex w-full max-w-[640px] flex-col gap-4 rounded-2xl border border-input p-5">
        <div>
          <p className="text-sm font-semibold">{t('plan.selectedPlan', { plan: tierName, defaultValue: 'Plan seleccionado: {{plan}}' })}</p>
          {isPaidTier && selectedTier === 'PRO' && interval === 'monthly' && (
            <p className="text-xs text-muted-foreground mt-1">
              {t('plan.promoLine', { defaultValue: 'Paga hoy: 3 meses a $599 + IVA, luego $999.' })}
            </p>
          )}
        </div>

        {!isPaidTier ? (
          <>
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
          </>
        ) : intentStatus === 'error' || !options ? (
          intentStatus === 'error' ? (
            // Never strand the user on a spinner: say what failed and give them a way out.
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {t('plan.setupIntentErrorBody', {
                    defaultValue: 'No pudimos preparar el pago con tarjeta. Vuelve a intentarlo o continúa con el plan Gratis y mejóralo después.',
                  })}
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" className="rounded-full gap-2" onClick={() => setRetryToken(n => n + 1)}>
                  <RotateCw className="h-4 w-4" />
                  {t('plan.retry', { defaultValue: 'Reintentar' })}
                </Button>
                <Button
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => onNext({ plan: { tier: 'FREE', acceptedAt: new Date().toISOString() } })}
                >
                  {t('plan.freeContinue', { defaultValue: 'Continuar con el plan Gratis' })}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('plan.loading', { defaultValue: 'Cargando…' })}</p>
          )
        ) : (
          <Elements stripe={stripePromise} options={options}>
            <PlanCardForm
              tier={selectedTier}
              interval={interval}
              onConfirmed={(paymentMethodId, payNow) =>
                onNext({ plan: { tier: selectedTier, paymentMethodId, interval, payNow, acceptedAt: new Date().toISOString() } })
              }
            />
          </Elements>
        )}
      </div>
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
