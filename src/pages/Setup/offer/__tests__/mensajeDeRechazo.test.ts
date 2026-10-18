/**
 * 🔴 Medido en vivo el 18-sep: con la tarjeta de prueba que el banco rechaza, la pantalla —toda
 * en español— mostró «Your card was declined.» El front prefería el `message` crudo de Stripe
 * (inglés) sobre su propio texto, así que `offer.declined` existía y NO se usaba nunca.
 */
import { describe, expect, it } from 'vitest'

import enSetup from '@/locales/en/setup.json'
import esSetup from '@/locales/es/setup.json'

import { claveDeRechazo, textoDeRechazo } from '../mensajeDeRechazo'

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

/**
 * 3D Secure (spec 2026-10-18-campana-3ds §8): si el cliente no completa la autorización de su
 * banco, el servidor responde 402 con `payment_intent_authentication_failure`. Antes caía al
 * genérico «Tu banco rechazó el cargo» — falso: el banco no rechazó, faltó autorizar.
 */
describe('3D Secure: textos y código de rechazo', () => {
  const AUTORIZACION_NO_COMPLETADA = 'No se completó la autorización de tu banco. Inténtalo otra vez o usa otra tarjeta.'

  it('`payment_intent_authentication_failure` tiene texto propio, con respaldo en español', () => {
    expect(textoDeRechazo('payment_intent_authentication_failure')).toEqual({
      clave: 'offer.declineAuthentication',
      porDefecto: AUTORIZACION_NO_COMPLETADA,
    })
  })

  it('regresión: `lost_card` sigue en el genérico', () => {
    expect(textoDeRechazo('lost_card').clave).toBe('offer.declined')
  })

  const TEXTOS: Record<string, { es: string; en: string }> = {
    authorizing: {
      es: 'Tu banco pide que autorices este pago. Sigue los pasos en la ventana de tu banco.',
      en: "Your bank needs you to authorize this payment. Follow the steps in your bank's window.",
    },
    authorizePending: {
      es: 'Tu banco todavía espera que autorices el pago. No se te ha cobrado.',
      en: "Your bank is still waiting for you to authorize the payment. You haven't been charged.",
    },
    authorizeAgain: { es: 'Autorizar el pago', en: 'Authorize payment' },
    declineAuthentication: {
      es: AUTORIZACION_NO_COMPLETADA,
      en: "Your bank's authorization wasn't completed. Try again or use another card.",
    },
  }

  for (const [llave, { es, en }] of Object.entries(TEXTOS)) {
    it(`offer.${llave} existe en es y en con el texto exacto del spec`, () => {
      expect((esSetup.offer as Record<string, string>)[llave]).toBe(es)
      expect((enSetup.offer as Record<string, string>)[llave]).toBe(en)
    })
  }
})
