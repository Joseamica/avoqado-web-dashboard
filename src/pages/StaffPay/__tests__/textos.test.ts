import i18next from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'
import es from '@/locales/es/staffPay.json'
import en from '@/locales/en/staffPay.json'

/** Los textos de verdad (no las llaves): singular/plural, una sola palabra para «pagados» y nada de «Muy pronto». */
const i18n = i18next.createInstance()
beforeAll(async () => {
  await i18n.init({ lng: 'es', resources: { es: { staffPay: es }, en: { staffPay: en } }, defaultNS: 'staffPay', interpolation: { escapeValue: false } })
})
const tEs = (k: string, o?: Record<string, unknown>) => i18n.getFixedT('es', 'staffPay')(k, o)
const tEn = (k: string, o?: Record<string, unknown>) => i18n.getFixedT('en', 'staffPay')(k, o)

describe('textos de pago por servicio', () => {
  it('«1 clase», nunca «1 clases» (QA defecto 13)', () => {
    expect(tEs('period.exceptionsBanner', { count: 1 })).toBe('1 clase no se puede pagar todavía. Resuélvela antes de cerrar.')
    expect(tEs('period.exceptionsBanner', { count: 3 })).toMatch(/^3 clases no se pueden/)
    expect(tEn('period.exceptionsBanner', { count: 1 })).toMatch(/^1 class cannot/)
    expect(tEs('period.orphans', { count: 1 })).toMatch(/^1 reserva de clase sin horario no cuenta/)
    expect(tEs('assign.effect', { count: 1 })).toMatch(/de 1 clase de este periodo/)
    expect(tEs('publish.effect', { count: 1 })).toMatch(/de 1 clase de este periodo/)
    expect(tEs('grid.missingCount', { count: 1 })).toBe('Falta 1 monto')
    expect(tEs('grid.cellLabel', { level: 'Coach', count: 1 })).toBe('Coach, 1 lugar')
  })
  it('el selector dice «pagados» (de recibos), igual que la tarjeta «Pagados» (QA defecto 16)', () => {
    expect(tEs('periods.closedPaid', { pagadas: 0, count: 2 })).toBe('Cerrado · 0 de 2 pagados')
    expect(tEs('closed.paidCard')).toBe('Pagados')
    expect(tEn('periods.closedPaid', { pagadas: 0, count: 2 })).toBe('Closed · 0 of 2 paid')
  })
  it('«Sólo quien llegó» explica qué falta, sin «Muy pronto» (QA defecto 17)', () => {
    for (const texto of [tEs('grid.attendedHelp'), tEn('grid.attendedHelp')]) expect(texto).not.toMatch(/muy pronto|coming soon/i)
    expect(tEs('grid.attendedHelp')).toMatch(/check-in quede registrado en el aparato; hoy se cuenta a quien reservó/)
  })
  it('un ajuste del recibo dice que su fecha es la de captura (QA defecto 9)', () => {
    expect(tEs('period.capturedOn', { fecha: '3 oct 2026' })).toBe('3 oct 2026 (captura)')
    expect(tEn('period.capturedOn', { fecha: 'Oct 3, 2026' })).toBe('Oct 3, 2026 (entered)')
    expect(tEs('period.detailColumns.concept')).toBe('Concepto')
  })
  it('diferencias: persona, monto y el mes destino en español natural; las mismas llaves en inglés (Bloque B)', () => {
    expect(tEs('differences.pendingLine', { persona: 'Ana Martínez', monto: '+$40.00' })).toBe('Diferencia pendiente de Ana Martínez: +$40.00')
    expect(tEs('differences.addsTo', { destino: 'octubre de 2026' })).toBe('Se suma al recibo de octubre de 2026')
    expect(tEs('differences.subtractsFrom', { destino: 'octubre de 2026' })).toBe('Se descuenta del recibo de octubre de 2026')
    expect(tEs('differences.originUnchanged', { origen: 'agosto de 2026' })).toBe('El recibo de agosto de 2026 no cambia.')
    // WCAG 2.5.3: el nombre accesible del botón empieza con su texto visible.
    expect(tEs('differences.settleFor', { accion: 'Liquidar en octubre de 2026', clase: 'Reformer', fecha: '4 ago 2026, 8:00 a.m.' })).toBe(
      'Liquidar en octubre de 2026: Reformer del 4 ago 2026, 8:00 a.m.',
    )
    expect(tEs('period.loadMoreError')).toBe('No se pudo cargar más.')
    expect(tEs('differences.settleIn', { periodo: 'octubre de 2026' })).toBe('Liquidar en octubre de 2026')
    expect(tEs('differences.lateClass', { periodo: 'agosto de 2026' })).toBe('Esta clase llegó después del cierre de agosto de 2026: se paga como diferencia.')
    expect(Object.keys(en.differences).sort()).toEqual(Object.keys(es.differences).sort())
    for (const texto of [...Object.values(es.differences), ...Object.values(en.differences)]) expect(texto).not.toMatch(/muy pronto|coming soon/i)
  })
})
