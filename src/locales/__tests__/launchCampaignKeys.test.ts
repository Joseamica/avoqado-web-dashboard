/**
 * Las llaves nuevas del lanzamiento existen en los TRES idiomas (W8).
 *
 * 🔴 Por qué una prueba y no una revisión a ojo: una llave que falta no revienta — i18next pinta
 * la llave CRUDA («offer.todayYouPay») en la pantalla donde se cobra, y eso solo se ve abriendo el
 * dashboard en ese idioma. La regla del repo es que todo texto pasa por `t()`; ésta comprueba que
 * `t()` tenga qué devolver.
 */
import { describe, expect, it } from 'vitest'

import esSetup from '../es/setup.json'
import enSetup from '../en/setup.json'
import frSetup from '../fr/setup.json'
import esHome from '../es/home.json'
import enHome from '../en/home.json'
import frHome from '../fr/home.json'
import esKyc from '../es/kyc.json'
import enKyc from '../en/kyc.json'
import frKyc from '../fr/kyc.json'
import esTpv from '../es/tpv.json'
import enTpv from '../en/tpv.json'
import frTpv from '../fr/tpv.json'

const LLAVES_SETUP = [
  'consent.title', 'consent.subtitle', 'consent.continue', 'consent.checkbox', 'consent.termsTitle', 'consent.privacyTitle', 'consent.required',
  'basics.title', 'basics.subtitle', 'basics.nameLabel', 'basics.nameRequired', 'basics.phoneLabel', 'basics.phoneInvalid', 'basics.continue',
  'offer.title', 'offer.planLine', 'offer.pricePerMonth', 'offer.firstMonths', 'offer.afterwards', 'offer.perMonth', 'offer.ivaIncluded',
  'offer.todayYouPay', 'offer.legal', 'offer.payAndEnter', 'offer.seeOtherPlans', 'offer.otherPlansNote', 'offer.confirming', 'offer.pending',
  'offer.declined', 'offer.genericError', 'offer.alreadyActivated', 'offer.activeWithoutOffer', 'offer.alreadyActiveTitle', 'offer.enter',
  'offer.changePlanNote', 'offer.unavailable', 'offer.changed', 'offer.claimedUnavailable',
  'done.title', 'done.subtitle', 'done.subtitleNamed', 'done.enter', 'done.completeError',
  'plan.cardError', 'plan.chargeError', 'plan.promoLineFromQuote', 'plan.setupIntentError', 'plan.setupIntentErrorBody', 'plan.retry',
  'wizard.saveError',
  // fr venía sin estos dos bloques completos (W8)
  'step8.title', 'step9.title',
]

const LLAVES_HOME = [
  'paymentActivation.title', 'paymentActivation.subtitle', 'paymentActivation.progress', 'paymentActivation.toggle',
  'paymentActivation.items.profile', 'paymentActivation.items.documents', 'paymentActivation.items.online', 'paymentActivation.items.terminal',
  'paymentActivation.review', 'paymentActivation.start', 'paymentActivation.terminalBlocked', 'paymentActivation.pageSubtitle',
  'paymentActivation.sections.business', 'paymentActivation.sections.businessDesc', 'paymentActivation.sections.identity',
  'paymentActivation.sections.identityDesc', 'paymentActivation.sections.bank', 'paymentActivation.sections.bankDesc',
  'paymentActivation.addressLabel', 'paymentActivation.addressPlaceholder', 'paymentActivation.addressRequired',
  'paymentActivation.cityLabel', 'paymentActivation.stateLabel', 'paymentActivation.zipLabel', 'paymentActivation.currentClabe',
  'paymentActivation.saved', 'paymentActivation.saveError', 'paymentActivation.saving', 'paymentActivation.back',
]

function leer(objeto: unknown, ruta: string): unknown {
  return ruta.split('.').reduce<unknown>((cur, parte) => (cur as Record<string, unknown> | undefined)?.[parte], objeto)
}

const NAMESPACES: Array<[string, string[], Record<string, unknown>[]]> = [
  ['setup', LLAVES_SETUP, [esSetup, enSetup, frSetup]],
  ['home', LLAVES_HOME, [esHome, enHome, frHome]],
  ['kyc', ['banner.missing.message'], [esKyc, enKyc, frKyc]],
  ['tpv', ['actions.buyBlockedByKyc'], [esTpv, enTpv, frTpv]],
]

describe('llaves nuevas en es, en y fr', () => {
  for (const [ns, llaves, [es, en, fr] ] of NAMESPACES) {
    for (const llave of llaves) {
      it(`${ns}:${llave}`, () => {
        for (const [idioma, diccionario] of [['es', es], ['en', en], ['fr', fr]] as const) {
          const valor = leer(diccionario, llave)
          expect(typeof valor, `${idioma} no tiene ${ns}:${llave}`).toBe('string')
          expect(String(valor).trim().length, `${idioma}:${ns}:${llave} está vacía`).toBeGreaterThan(0)
        }
      })
    }
  }

  it('las interpolaciones de dinero viajan en las tres traducciones — si una las pierde, el precio desaparece', () => {
    for (const d of [esSetup, enSetup, frSetup] as Record<string, any>[]) {
      expect(d.offer.payAndEnter).toContain('{{price}}')
      expect(d.offer.pricePerMonth).toContain('{{price}}')
      expect(d.offer.legal).toContain('{{promo}}')
      expect(d.offer.legal).toContain('{{renewal}}')
      expect(d.offer.firstMonths).toContain('{{count}}')
    }
  })

  it('la casilla legal conserva sus dos enlaces en los tres idiomas', () => {
    for (const d of [esSetup, enSetup, frSetup] as Record<string, any>[]) {
      expect(d.consent.checkbox).toContain('<terms>')
      expect(d.consent.checkbox).toContain('<privacy>')
    }
  })
})
