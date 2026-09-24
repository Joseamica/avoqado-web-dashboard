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

import { Button } from '@/components/ui/button'
import { mensajeDeFalloDeCobro } from '../offer/falloDeCobro'

interface PlanCardFormProps {
  /** Texto del botón que paga hoy. */
  payNowLabel: string
  /** Texto del botón de prueba gratis. Ausente ⇒ un SOLO botón (el camino de la oferta). */
  trialLabel?: string | null
  onConfirmed: (paymentMethodId: string, payNow: boolean) => void | Promise<void>
  /** Bloquea los botones mientras el llamador habla con el servidor. */
  busy?: boolean
  /** Mensaje bajo el formulario: rechazo del banco, tarjeta inválida… */
  errorMessage?: string | null
  dataTourPrefix?: string
}

export function PlanCardForm({ payNowLabel, trialLabel, onConfirmed, busy, errorMessage, dataTourPrefix = 'setup-plan' }: PlanCardFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const { t } = useTranslation('setup')
  const [submitting, setSubmitting] = useState(false)
  const [cardError, setCardError] = useState<string | null>(null)

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
        const legible =
          mensajeDeFalloDeCobro(fallo) ?? (fallo as { response?: { data?: { message?: string } } })?.response?.data?.message
        setCardError(legible || t('plan.chargeError', { defaultValue: 'No pudimos procesar el pago. Intenta de nuevo.' }))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const bloqueado = submitting || !!busy

  return (
    <div className="flex flex-col gap-4">
      <PaymentElement />
      {(cardError || errorMessage) && <p className="text-sm text-destructive">{cardError || errorMessage}</p>}
      <div className="flex flex-col gap-3">
        {trialLabel ? (
          <Button data-tour={`${dataTourPrefix}-start-trial`} disabled={bloqueado} onClick={() => confirm(false)} className="rounded-full">
            {trialLabel}
          </Button>
        ) : null}
        <Button
          data-tour={`${dataTourPrefix}-pay-now`}
          disabled={bloqueado}
          variant={trialLabel ? 'outline' : 'default'}
          onClick={() => confirm(true)}
          className="rounded-full"
        >
          {payNowLabel}
        </Button>
      </div>
    </div>
  )
}
