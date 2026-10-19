/**
 * Texto del precio y traducciones de la pantalla de planes del alta (D1).
 *
 * 🔴 El dashboard no calcula dinero: `textoDePrecio` sólo formatea los centavos que manda el
 * servidor. El neto (sin IVA) es opcional porque `PlanQuote` puede no traerlo (servidor viejo).
 *
 * Las traducciones se prueban con las cadenas REALES de `setup.json`: una llave que falta no
 * revienta, i18next pinta la llave cruda («plans.title») en la pantalla donde se elige el plan.
 */
import i18next from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'

import enSetup from '@/locales/en/setup.json'
import esSetup from '@/locales/es/setup.json'

import { textoDePrecio } from '../offer/textoDePrecio'

const i18n = i18next.createInstance()
beforeAll(async () => {
  await i18n.init({
    lng: 'es',
    fallbackLng: false,
    ns: ['setup'],
    defaultNS: 'setup',
    resources: { es: { setup: esSetup }, en: { setup: enSetup } },
    interpolation: { escapeValue: false },
  })
})

type Arbol = { [clave: string]: string | Arbol }

function aplanar(arbol: Arbol, prefijo = ''): Record<string, string> {
  const salida: Record<string, string> = {}
  for (const [clave, valor] of Object.entries(arbol)) {
    const ruta = prefijo ? `${prefijo}.${clave}` : clave
    if (typeof valor === 'string') salida[ruta] = valor
    else Object.assign(salida, aplanar(valor, ruta))
  }
  return salida
}

const placeholders = (texto: string) => [...texto.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(m => m[1]).sort()

describe('textoDePrecio', () => {
  it('con neto: «$999.00 + IVA = $1,158.84»', () => {
    const t = i18n.getFixedT('es', 'setup')
    expect(textoDePrecio(t, 115884, 99900)).toBe('$999.00 + IVA = $1,158.84')
  })

  it('sin neto: «$1,158.84 con IVA»', () => {
    const t = i18n.getFixedT('es', 'setup')
    expect(textoDePrecio(t, 115884)).toBe('$1,158.84 con IVA')
  })

  it('en inglés dice VAT, con los mismos montos', () => {
    const t = i18n.getFixedT('en', 'setup')
    expect(textoDePrecio(t, 115884, 99900)).toBe('$999.00 + VAT = $1,158.84')
    expect(textoDePrecio(t, 115884)).toBe('$1,158.84 with VAT')
  })
})

describe('traducciones plans.*', () => {
  const es = aplanar((esSetup as unknown as { plans?: Arbol }).plans ?? {})
  const en = aplanar((enSetup as unknown as { plans?: Arbol }).plans ?? {})

  const BENEFICIOS = ['pro', 'premium', 'enterprise'].flatMap(plan => [1, 2, 3, 4].map(n => `benefits.${plan}.${n}`))
  const OBLIGATORIAS = [
    'title',
    'subtitle',
    'choosePro',
    'choosePremium',
    'chooseOffer',
    'talkToSales',
    'startTrial',
    'compare',
    'noCard',
    'recommended',
    'yourOffer',
    'trialPrice',
    'thenPerMonth',
    'withoutOffer',
    'offerPrice',
    'offerRenewal',
    'enterprisePrice',
    'enterpriseSub',
    'proTagline',
    'premiumTagline',
    'enterpriseTagline',
    'trialLegal',
    'netPlusIva',
    'grossWithIva',
    'pendingTitle',
    'confirmPayment',
    'trialTitle',
    'trialSubtitle',
    'offerTitle',
    'todayYouPay',
    'firstCharge',
    'noCardWhatsApp',
    'compareTitle',
    ...BENEFICIOS,
  ]

  it('define todas las llaves que usa la pantalla, en español', () => {
    expect(OBLIGATORIAS.filter(k => !es[k])).toEqual([])
  })

  it('cada llave de `es` existe en `en`, con los mismos {{placeholders}}', () => {
    const sinPar = Object.keys(es).filter(k => !en[k])
    expect(sinPar).toEqual([])
    const distintos = Object.keys(es).filter(k => placeholders(es[k]).join() !== placeholders(en[k]).join())
    expect(distintos).toEqual([])
  })

  it('`en` no trae llaves de más (sin huérfanas)', () => {
    expect(Object.keys(en).filter(k => !es[k])).toEqual([])
  })

  it('el copy de lanzamiento no lleva montos escritos: sólo {{placeholders}}', () => {
    const conMonto = Object.entries(es).filter(([, v]) => /\$\s?\d/.test(v))
    expect(conMonto).toEqual([])
  })
})
