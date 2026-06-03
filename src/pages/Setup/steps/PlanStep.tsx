/**
 * PlanStep — V2 wizard final step (mandatory, no skip).
 *
 * Billing toggle (Mensual/Anual) + two CTAs:
 *   - "Empezar 30 días gratis" → trial (payNow:false)
 *   - "Pagar hoy y ahorrar"    → no trial (payNow:true); monthly gets $599×3
 * Card captured via Stripe Elements against a customer-scoped SetupIntent.
 * On confirm, persists v2SetupData.plan = { paymentMethodId, interval, payNow }.
 * Spec: docs/superpowers/specs/2026-06-02-venue-base-subscription-design.md
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { setupService } from '@/services/setup.service'
import { useToast } from '@/hooks/use-toast'
import type { StepProps } from '../types'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string)

interface PlanStepProps extends StepProps {
  venueId: string
  organizationId: string
}

const PRICES = {
  monthly: { full: '$999', promo: '$599', label: 'mes' },
  annual: { full: '$9,990', promo: '$9,990', label: 'año' },
}

export function PlanStep({ onNext, venueId, data }: PlanStepProps) {
  const { t } = useTranslation('setup')
  const [interval, setInterval] = useState<'monthly' | 'annual'>(data.plan?.interval ?? 'monthly')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
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

  return (
    <div className="flex flex-col gap-8 max-w-xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{t('plan.title', { defaultValue: 'Tu plan Avoqado' })}</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {t('plan.subtitle', { defaultValue: 'Activa tu plan para usar todas las funciones de Avoqado.' })}
        </p>
      </div>

      <div className="inline-flex rounded-full border p-1 self-start">
        {(['monthly', 'annual'] as const).map(i => (
          <button
            key={i}
            type="button"
            onClick={() => setInterval(i)}
            className={`px-4 py-2 rounded-full text-sm ${interval === i ? 'bg-foreground text-background' : 'text-muted-foreground'}`}
          >
            {i === 'monthly'
              ? t('plan.monthly', { defaultValue: 'Mensual' })
              : t('plan.annual', { defaultValue: 'Anual (2 meses gratis)' })}
          </button>
        ))}
      </div>

      <div className="rounded-lg border p-4 text-sm">
        <p>{`${PRICES[interval].full} + IVA / ${PRICES[interval].label}`}</p>
        {interval === 'monthly' && (
          <p className="text-muted-foreground mt-1">
            {t('plan.promoLine', { defaultValue: 'Paga hoy: 3 meses a $599 + IVA, luego $999.' })}
          </p>
        )}
      </div>

      {options ? (
        <Elements stripe={stripePromise} options={options}>
          <PlanCardForm
            interval={interval}
            onConfirmed={(paymentMethodId, payNow) =>
              onNext({ plan: { paymentMethodId, interval, payNow, acceptedAt: new Date().toISOString() } })
            }
          />
        </Elements>
      ) : (
        <p className="text-sm text-muted-foreground">{t('plan.loading', { defaultValue: 'Cargando…' })}</p>
      )}
    </div>
  )
}

function PlanCardForm({
  interval,
  onConfirmed,
}: {
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

  return (
    <div className="flex flex-col gap-4">
      <PaymentElement />
      <div className="flex flex-col gap-3">
        <Button disabled={submitting} onClick={() => confirm(false)} className="rounded-full">
          {t('plan.startTrial', { defaultValue: 'Empezar 30 días gratis' })}
        </Button>
        <Button disabled={submitting} variant="outline" onClick={() => confirm(true)} className="rounded-full">
          {interval === 'monthly'
            ? t('plan.payNowMonthly', { defaultValue: 'Pagar hoy y ahorrar (3 meses a $599)' })
            : t('plan.payNowAnnual', { defaultValue: 'Pagar hoy (anual)' })}
        </Button>
      </div>
    </div>
  )
}
