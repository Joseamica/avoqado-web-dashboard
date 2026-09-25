/**
 * El formulario de tarjeta del alta. Extraído de `PlanStep` para que la pantalla de la OFERTA
 * (§4.5) use exactamente el mismo captura-tarjeta que la vista estándar: si se duplicara, una de
 * las dos se quedaría sin un arreglo del camino del dinero.
 *
 * 🔴 No cobra. Guarda la tarjeta con `confirmSetup` y entrega el `payment_method` a quien lo
 * llamó. Quien cobra es el SERVIDOR, con `activate-plan`.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { Check, Loader2, Lock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { mensajeDeFalloDeCobro } from '../offer/falloDeCobro'

interface PlanCardFormProps {
  /** Texto del botón que paga hoy. */
  payNowLabel: string
  /** Texto del botón de prueba gratis. Ausente ⇒ un SOLO botón (el camino de la oferta). */
  trialLabel?: string | null
  /** Qué se cobra y cuándo, bajo el botón de prueba: nadie debería enterarse del cargo el día 31. */
  trialHint?: string | null
  /** Qué se cobra hoy, bajo el botón de pagar. */
  payNowHint?: string | null
  /** Títulos cortos de las dos opciones (sólo con prueba gratis). */
  trialOptionTitle?: string
  payNowOptionTitle?: string
  onConfirmed: (paymentMethodId: string, payNow: boolean) => void | Promise<void>
  /** Bloquea los botones mientras el llamador habla con el servidor. */
  busy?: boolean
  /** Mensaje bajo el formulario: rechazo del banco, tarjeta inválida… */
  errorMessage?: string | null
  dataTourPrefix?: string
}

export function PlanCardForm({
  payNowLabel,
  trialLabel,
  trialHint,
  payNowHint,
  trialOptionTitle,
  payNowOptionTitle,
  onConfirmed,
  busy,
  errorMessage,
  dataTourPrefix = 'setup-plan',
}: PlanCardFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const { t } = useTranslation('setup')
  const [submitting, setSubmitting] = useState(false)
  const [cardError, setCardError] = useState<string | null>(null)
  // El iframe de Stripe tarda en pintar; mientras tanto se ve la silueta del formulario, no un hueco.
  const [listo, setListo] = useState(false)
  // Con prueba gratis hay DOS caminos: se elige uno y un solo botón lo ejecuta. Arranca en la prueba
  // (hoy no se cobra nada), que era el botón principal.
  const [eleccion, setEleccion] = useState<'trial' | 'pay'>(trialLabel ? 'trial' : 'pay')

  const confirm = async (payNow: boolean) => {
    if (!stripe || !elements) return
    setSubmitting(true)
    setCardError(null)
    try {
      const { error, setupIntent } = await stripe.confirmSetup({ elements, redirect: 'if_required' })
      if (error || !setupIntent?.payment_method) {
        setCardError(error?.message || t('plan.cardError', { defaultValue: 'No se pudo guardar la tarjeta' }))
        return
      }
      try {
        await onConfirmed(String(setupIntent.payment_method), payNow)
      } catch (fallo) {
        // 🔴 Un cobro que revienta NO puede irse como promesa sin capturar: el botón se
        // rehabilitaría sin decir nada y la persona tocaría de nuevo creyendo que no pasó nada.
        // Se muestra el mensaje del servidor si lo trae, y el llamador NO avanza.
        // Primero el texto que el llamador declaró legible (`FalloDeCobro`), luego el del
        // servidor. Nunca el `message` pelón de un Error cualquiera: un `TypeError` acabaría
        // en la pantalla de alguien que está pagando.
        const legible = mensajeDeFalloDeCobro(fallo) ?? (fallo as { response?: { data?: { message?: string } } })?.response?.data?.message
        setCardError(legible || t('plan.chargeError', { defaultValue: 'No pudimos procesar el pago. Intenta de nuevo.' }))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const bloqueado = submitting || !!busy

  const opciones = trialLabel
    ? ([
        { id: 'trial', titulo: trialOptionTitle ?? trialLabel, detalle: trialHint },
        { id: 'pay', titulo: payNowOptionTitle ?? payNowLabel, detalle: payNowHint },
      ] as const)
    : null
  const pagaHoy = eleccion === 'pay'
  const etiqueta = pagaHoy ? payNowLabel : (trialLabel ?? payNowLabel)

  return (
    <div className="flex flex-col gap-6">
      {opciones && (
        <div
          role="radiogroup"
          aria-label={t('plan.howToStart', { defaultValue: '¿Cómo quieres empezar?' })}
          className="flex flex-col gap-3"
        >
          <p className="text-sm font-medium">{t('plan.howToStart', { defaultValue: '¿Cómo quieres empezar?' })}</p>
          {opciones.map(o => {
            const activa = eleccion === o.id
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={activa}
                data-tour={`${dataTourPrefix}-option-${o.id}`}
                disabled={bloqueado}
                onClick={() => setEleccion(o.id)}
                className={cn(
                  'flex w-full cursor-pointer items-start gap-3 rounded-xl border p-4 text-left transition-[border-color,background-color,box-shadow] duration-150 ease-out',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                  activa
                    ? 'border-foreground bg-muted/40 shadow-[0_0_0_1px_var(--foreground)]'
                    : 'border-input hover:border-ring hover:bg-muted/20',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150',
                    activa ? 'border-foreground bg-foreground text-background' : 'border-input',
                  )}
                >
                  {activa && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">{o.titulo}</span>
                  {o.detalle && <span className="text-xs leading-relaxed text-muted-foreground">{o.detalle}</span>}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="relative min-h-[220px]">
        {!listo && (
          <div className="absolute inset-0 flex flex-col gap-4" aria-hidden="true">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-12 w-full rounded-[10px]" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-12 w-full rounded-[10px]" />
              <Skeleton className="h-12 w-full rounded-[10px]" />
            </div>
            <Skeleton className="h-12 w-full rounded-[10px]" />
          </div>
        )}
        <div className={cn('transition-opacity duration-200 ease-out', listo ? 'opacity-100' : 'opacity-0')}>
          <PaymentElement onReady={() => setListo(true)} />
        </div>
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t('plan.cardSecure', {
          defaultValue: 'Tu tarjeta viaja cifrada a Stripe. Avoqado nunca ve el número completo.',
        })}
      </p>

      {(cardError || errorMessage) && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {cardError || errorMessage}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Button
          data-tour={pagaHoy ? `${dataTourPrefix}-pay-now` : `${dataTourPrefix}-start-trial`}
          disabled={bloqueado}
          aria-busy={bloqueado}
          onClick={() => confirm(pagaHoy)}
          className="h-12 rounded-full text-base transition-transform duration-150 ease-out active:scale-[0.98]"
        >
          {bloqueado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {etiqueta}
        </Button>
        {!opciones && payNowHint && <p className="px-2 text-center text-xs text-muted-foreground">{payNowHint}</p>}
      </div>
    </div>
  )
}
