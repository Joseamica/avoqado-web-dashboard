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
    expect(tEs('vigencia.part', { count: 1, periodo: 'octubre de 2026' })).toBe('1 clase en octubre de 2026')
    expect(tEs('vigencia.effectTotal', { count: 1 })).toBe('Cambia el pago de 1 clase.')
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
  it('el efecto de una vigencia dice la verdad por periodo, sin «de este periodo» ni «las anteriores se quedan» (I-2)', () => {
    const lista = tEs('vigencia.list', {
      inicio: tEs('vigencia.part', { count: 12, periodo: 'septiembre de 2026' }),
      ultimo: tEs('vigencia.partMore', { count: 3, periodo: 'octubre de 2026' }),
    })
    // «en», no «de»: «3 de octubre» se leería como una fecha.
    expect(tEs('vigencia.effect', { lista })).toBe('Cambia el pago de 12 clases en septiembre de 2026 y 3 en octubre de 2026.')
    expect(tEs('vigencia.effect', { lista: tEs('vigencia.part', { count: 3, periodo: 'octubre de 2026' }) })).toBe(
      'Cambia el pago de 3 clases en octubre de 2026.',
    )
    expect(tEs('vigencia.partSemi', { count: 3, periodo: '16–30 de septiembre de 2026' })).toBe('3 clases en la quincena 16–30 de septiembre de 2026')
    expect(tEs('vigencia.effectNone')).toBe('No cambia el pago de ninguna clase todavía.')
    // Lo que el server no recorrió no se afirma; y el singular concuerda.
    expect(tEs('vigencia.notCountedMonths', { count: 1 })).toBe('No se contó 1 mes anterior que sigue abierto; también puede cambiar.')
    expect(tEs('vigencia.notCountedMonths', { count: 2 })).toBe('No se contaron 2 meses anteriores que siguen abiertos; también pueden cambiar.')
    expect(tEs('vigencia.notCountedPeriods', { count: 1 })).toBe('No se contó 1 periodo anterior que sigue abierto; también puede cambiar.')
    expect(tEs('vigencia.closedUnchanged')).toBe('Los meses ya cerrados no cambian.')
    expect(tEs('vigencia.useDate', { fecha: '1 sep 2026' })).toBe('Usar el 1 sep 2026')
    for (const texto of [JSON.stringify(es), JSON.stringify(en)]) expect(texto).not.toMatch(/se quedan como estaban|stay as they were/)
    expect(Object.keys(en.vigencia).sort()).toEqual(Object.keys(es.vigencia).sort())
  })
  it('volver a pagar una clase excluida no promete valores cuando los campos están vacíos (ronda hora de fin)', () => {
    expect(tEs('adjust.reincludeNote')).toMatch(/si los dejas vacíos, con el conteo del sistema y el monto de la tabla/)
    expect(tEn('adjust.reincludeNote')).toMatch(/“This class is not paid”/)
    expect(tEn('adjust.reincludeNote')).not.toMatch(/«|»/)
  })
  it('diferencias: persona, monto y el mes destino en español natural; las mismas llaves en inglés (Bloque B)', () => {
    // «Por liquidar» (sin liquidar) y «falta pagarla» (liquidada, sin pagar): «pendiente» ya no significa dos cosas (QA B-8).
    expect(tEs('differences.pendingLine', { persona: 'Ana Martínez', monto: '+$40.00' })).toBe('Diferencia por liquidar de Ana Martínez: +$40.00')
    expect(tEs('classCard.lineReconcile', { periodo: 'octubre de 2026', persona: 'Ana Martínez', monto: '+$40.00' })).toBe(
      'Liquidada en octubre de 2026 · Ana Martínez: +$40.00',
    )
    expect(tEs('classCard.linePending')).toBe('falta pagarla')
    expect(tEs('differences.noLevelFor', { persona: 'Carlos Rodríguez', fecha: '15 jul 2026' })).toBe('Carlos Rodríguez no tenía nivel el 15 jul 2026')
    expect(tEs('differences.alreadySettledElsewhere')).toBe('Esta diferencia ya se liquidó (desde otra pantalla). No se agregó nada.')
    expect(tEs('differences.cause.CONTEO', { antes: 8, ahora: 10 })).toBe('Conteo corregido: 8 → 10')
    expect(tEs('differences.cause.COACH_SALE', { coach: 'Ana Martínez' })).toBe('Ya no da esta clase (ahora: Ana Martínez)')
    // REINCLUIDA: no se pagaba al cerrar (excluida o cancelada) y ahora sí; TARDIA queda para la clase creada después.
    expect(tEs('differences.cause.REINCLUIDA')).toBe('Clase que no se pagaba al cerrar y ahora sí')
    expect(tEn('differences.cause.REINCLUIDA')).toBe("Class that wasn't paid at closing and now counts")
    expect(tEs('differences.cause.TARDIA')).toBe('Clase registrada después del cierre')
    expect(tEs('differences.banner', { count: 1 })).toBe('1 diferencia por liquidar')
    expect(tEs('differences.banner', { count: 3 })).toBe('3 diferencias por liquidar')
    // El aviso de HUELLA_CAMBIO no repite su título en la descripción (QA B-7).
    expect(tEs('differences.changedHelp')).not.toMatch(/montos cambiaron/i)
    expect(tEs('period.negativeBalance')).toBe('Saldo en contra: recibió de más en periodos anteriores. Avoqado no cobra ni descuenta solo.')
    // «Marcar todos» con signos mezclados: lo que de verdad pasa, sin un neto (pulido 3).
    expect(tEs('closed.paysOne', { monto: '$570.00', nombre: 'Ana Martínez' })).toBe('Pagas $570.00 a Ana Martínez.')
    expect(tEs('closed.owesOne', { nombre: 'Carlos Rodríguez', monto: '$360.00' })).toBe('Carlos Rodríguez queda con saldo en contra de $360.00.')
    expect(tEs('closed.owesMany', { count: 2, monto: '$400.00' })).toBe('2 recibos quedan con saldo en contra por $400.00.')
    expect(tEs('closed.markAllMixedConfirm', { count: 2 })).toBe('Registrar 2 recibos')
    expect(es.differences).not.toHaveProperty('seeThem')
    expect(tEs('closed.settleNegativeTitle', { nombre: 'Carlos Rodríguez', monto: '−$360.00' })).toBe(
      '¿Registrar como saldado el recibo de Carlos Rodríguez (−$360.00)?',
    )
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
    expect(Object.keys(en.differences.cause).sort()).toEqual(Object.keys(es.differences.cause).sort())
    for (const texto of [...Object.values(es.differences), ...Object.values(en.differences)]) expect(JSON.stringify(texto)).not.toMatch(/muy pronto|coming soon/i)
  })
})
