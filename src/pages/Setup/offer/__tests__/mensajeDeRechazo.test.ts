/**
 * 🔴 Medido en vivo el 18-sep: con la tarjeta de prueba que el banco rechaza, la pantalla —toda
 * en español— mostró «Your card was declined.» El front prefería el `message` crudo de Stripe
 * (inglés) sobre su propio texto, así que `offer.declined` existía y NO se usaba nunca.
 */
import { describe, expect, it } from 'vitest'

import { claveDeRechazo } from '../mensajeDeRechazo'

describe('claveDeRechazo', () => {
  it('🔴 sin código conocido cae al texto propio en español, NUNCA al de Stripe', () => {
    expect(claveDeRechazo(null)).toBe('offer.declined')
    expect(claveDeRechazo(undefined)).toBe('offer.declined')
    expect(claveDeRechazo('un_codigo_que_stripe_invente_manana')).toBe('offer.declined')
  })

  it('traduce los rechazos que el cliente SÍ puede resolver', () => {
    expect(claveDeRechazo('insufficient_funds')).toBe('offer.declineInsufficientFunds')
    expect(claveDeRechazo('expired_card')).toBe('offer.declineExpiredCard')
    expect(claveDeRechazo('incorrect_cvc')).toBe('offer.declineIncorrectCvc')
    expect(claveDeRechazo('card_velocity_exceeded')).toBe('offer.declineVelocity')
    expect(claveDeRechazo('processing_error')).toBe('offer.declineProcessing')
  })

  it('🔴 un rechazo por SOSPECHA DE FRAUDE usa el genérico: Stripe pide no dar detalles', () => {
    for (const codigo of ['lost_card', 'stolen_card', 'fraudulent', 'pickup_card']) {
      expect(claveDeRechazo(codigo)).toBe('offer.declined')
    }
  })
})
