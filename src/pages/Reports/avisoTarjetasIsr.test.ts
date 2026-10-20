import i18next from 'i18next'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import en from '@/locales/en/reports.json'
import es from '@/locales/es/reports.json'
import { avisoDeTarjetasDelIsr } from './avisoTarjetasIsr'

const AVISO_DEL_SERVER =
  'El ISR estimado no incluye $1,500.00 de tarjetas de regalo cobradas en el periodo y sí incluye $300.00 pagado con saldo de tarjetas; tu contador debe ajustarlo con el reporte de tarjetas.'
const BASE = {
  regime: 'RESICO' as const,
  avisoTarjetasDeRegalo: AVISO_DEL_SERVER,
  tarjetasCobradasNoIncluidasCents: 150000,
  pagadoConSaldoIncluidoCents: 30000,
}

// i18next REAL con los recursos REALES de `reports` (Codex r1 #3/#4): una llave o un {{marcador}} mal escrito tiene que fallar aquí.
describe('avisoDeTarjetasDelIsr (el aviso de tarjetas de regalo del ISR por idioma)', () => {
  const t = (k: string, o?: Record<string, unknown>) => i18next.getFixedT(null, 'reports')(k, o) as string

  beforeAll(async () => {
    await i18next.init({
      lng: 'en',
      fallbackLng: 'en',
      resources: { en: { reports: en }, es: { reports: es } },
      interpolation: { escapeValue: false },
    })
  })
  afterAll(async () => {
    await i18next.changeLanguage('es')
  })

  it('en inglés, el aviso de tarjetas del ISR usa su llave local con las cifras (RESICO: el periodo)', () => {
    expect(avisoDeTarjetasDelIsr(BASE, t)).toBe(
      'The estimated income tax does not include $1,500.00 of gift cards sold in the period and does include $300.00 paid with gift card balance; your accountant should adjust it using the gift cards report.',
    )
  })

  it('en inglés, régimen general: «lo que va del ejercicio»', () => {
    expect(avisoDeTarjetasDelIsr({ ...BASE, regime: 'GENERAL' }, t)).toBe(
      'The estimated income tax does not include $1,500.00 of gift cards sold so far this fiscal year and does include $300.00 paid with gift card balance; your accountant should adjust it using the gift cards report.',
    )
  })

  it('en inglés, importes negativos se dicen como devueltos y en positivo (nunca «−$300.00 cobradas»)', () => {
    const aviso = avisoDeTarjetasDelIsr({ ...BASE, tarjetasCobradasNoIncluidasCents: -30000, pagadoConSaldoIncluidoCents: -5000 }, t)
    expect(aviso).toBe(
      'The estimated income tax does not deduct $300.00 of gift cards refunded in the period and does subtract $50.00 of refunds on what was paid with gift card balance; your accountant should adjust it using the gift cards report.',
    )
    expect(aviso).not.toMatch(/-\$|−\$/)
  })

  it('en inglés, un importe en cero se dice igual que el server: «no incluye $0.00»', () => {
    expect(avisoDeTarjetasDelIsr({ ...BASE, tarjetasCobradasNoIncluidasCents: 0 }, t)).toContain(
      'does not include $0.00 of gift cards sold',
    )
  })

  it('en inglés, sin las cifras (un server viejo) o sin aviso: el texto del server / nada, nunca una llave', () => {
    expect(avisoDeTarjetasDelIsr({ regime: 'RESICO', avisoTarjetasDeRegalo: AVISO_DEL_SERVER }, t)).toBe(AVISO_DEL_SERVER)
    expect(avisoDeTarjetasDelIsr({ ...BASE, avisoTarjetasDeRegalo: undefined }, t)).toBeUndefined()
  })

  it('en español, el texto del server como hoy (aunque vengan las cifras)', async () => {
    await i18next.changeLanguage('es')
    try {
      expect(avisoDeTarjetasDelIsr(BASE, t)).toBe(AVISO_DEL_SERVER)
    } finally {
      await i18next.changeLanguage('en')
    }
  })

  it('es y en tienen las mismas llaves del aviso, y el es dice lo mismo que el server', () => {
    const hojas = (o: Record<string, unknown>) => Object.keys(o).sort()
    expect(hojas(es.isr.giftCardsNotice)).toEqual(hojas(en.isr.giftCardsNotice))
    const lleno = (plantilla: string, v: Record<string, string>) => plantilla.replace(/{{(\w+)}}/g, (_, k: string) => v[k] ?? `{{${k}}}`)
    const g = es.isr.giftCardsNotice
    const cobradas = lleno(g.soldNotIncluded, { amount: '$1,500.00', when: g.whenPeriod })
    const saldo = lleno(g.balanceIncluded, { amount: '$300.00' })
    expect(lleno(g.main, { sold: cobradas, balance: saldo })).toBe(AVISO_DEL_SERVER)
  })
})
