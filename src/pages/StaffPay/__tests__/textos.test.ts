import i18next from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'
import es from '@/locales/es/staffPay.json'
import en from '@/locales/en/staffPay.json'
import { textoDeCuenta } from '../cuenta'
import { cuandoSeDescuenta, lineaDePendiente } from '../pendientes'
import { nombreVisible } from '../personaBorrada'

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
  // E6a-fix2 C2 y K2 (full-testing E6a): cada bloqueo por permiso dice qué permiso, con su nombre (nunca el código interno), y a
  // quién pedírselo. El de propinas no lo decía; el de organización, además, dice que hace falta en TODAS las sedes.
  it('🔴 los bloqueos de permiso nombran el permiso y a quién pedírselo, sin códigos internos', () => {
    const bloqueos = ['tips.noPermission', 'orgPermission', 'activation.noPermission', 'closed.noPermission', 'period.closeNoPermission']
    for (const k of bloqueos) {
      expect(tEs(k), k).toContain('«Cerrar periodos y registrar pagos»')
      expect(tEs(k), k).toContain('Pídeselo al dueño del negocio.')
      expect(tEs(k), k).not.toMatch(/staffpay:/)
      expect(tEn(k), k).toMatch(/Ask the business owner/)
    }
    expect(tEs('orgPermission')).toContain('en todas las sedes de la organización')
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
  it('full-testing: montos, rangos y respuestas perdidas dicen qué pasó en español natural', () => {
    expect(tEs('manualAdjust.amountInvalid')).toBe('Escribe un monto mayor a $0 y de hasta $1,000,000.00, con máximo 2 decimales.')
    expect(tEs('manualAdjust.outOfRange', { desde: '4 oct 2025' })).toBe('Un ajuste sólo puede ir a un periodo de los últimos 12 meses (desde el 4 oct 2025).')
    expect(tEs('vigencia.outOfRange', { desde: '3 oct 2024', hasta: '3 oct 2028' })).toBe('La vigencia debe estar entre el 3 oct 2024 y el 3 oct 2028.')
    expect(tEs('differences.networkRetry')).toMatch(/no se liquida dos veces/)
    expect(tEs('closed.networkCheck')).toMatch(/no se registra dos veces/)
    for (const k of ['amountInvalid', 'outOfRange']) expect(en.manualAdjust).toHaveProperty(k)
    for (const k of ['networkRetry', 'settledLine']) expect(en.differences).toHaveProperty(k)
    expect(en.closed).toHaveProperty('networkCheck')
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
  it('es y en tienen las mismas llaves en los grupos nuevos (todos los niveles)', () => {
    const llaves = (o: unknown, pre = ''): string[] =>
      o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => llaves(v, `${pre}${k}.`)) : [pre.slice(0, -1)]
    // Sin el grupo, `llaves(undefined)` sale igual en los dos idiomas: primero se exige que exista.
    for (const g of ['activation', 'tips', 'sedes', 'rules', 'period', 'manualAdjust', 'close'] as const) {
      expect(llaves(es[g]).length).toBeGreaterThan(1)
      expect(llaves(en[g]).sort()).toEqual(llaves(es[g]).sort())
    }
    expect(en.tabs).toHaveProperty('venues')
    expect(es.tabs.venues).toBe('Sedes')
    expect(llaves(en.classCard).sort()).toEqual(llaves(es.classCard).sort())
  })
  it('reglas de clase (E4): el motivo en la tarjeta, «menos de 1 h» con 0 h, y la clase fuera del sobre', () => {
    expect(tEs('classCard.coverBonus', { horas: 3, monto: '+$100.00' })).toBe('Suplencia avisada 3 h antes: +$100.00')
    expect(tEs('classCard.coverBonusUnderHour', { monto: '+$100.00' })).toBe('Suplencia avisada con menos de 1 h: +$100.00')
    expect(tEs('classCard.lateCancel', { horas: 2 })).toBe('Cancelada 2 h antes: se paga el sueldo base')
    expect(tEs('classCard.lateCancelUnderHour')).toBe('Cancelada con menos de 1 h de aviso: se paga el sueldo base')
    expect(tEn('classCard.coverBonus', { horas: 3, monto: '+$100.00' })).toBe('Cover assigned 3 h before: +$100.00')
    expect(tEn('classCard.lateCancelUnderHour')).toBe('Cancelled with less than 1 h notice: base pay applies')
    expect(tEs('classCard.outOfEnvelope', { sede: 'Wellness', fecha: '20 oct 2026' })).toBe(
      'La sede Wellness no estaba activa en pago al personal el 20 oct 2026: esta clase no entra al recibo.',
    )
    expect(tEs('classCard.wouldPay', { monto: '$570.00' })).toBe('Si la activas desde ese día, se pagarían $570.00.')
    expect(tEs('classCard.goToVenues')).toBe('Ver sedes')
    expect(tEs('rules.error.coverAmount', { max: '$100,000.00' })).toBe('El monto extra va de $0.01 a $100,000.00, con hasta dos decimales.')
    expect(tEs('rules.error.lateHours', { max: 168 })).toBe('Las horas de la cancelación van de 1 a 168, sin decimales.')
    // Ningún texto de la tarjeta dice «0 h antes».
    for (const texto of [JSON.stringify(es.classCard), JSON.stringify(en.classCard)]) expect(texto).not.toMatch(/\b0 h\b/)
  })
  it('sedes: la cuenta se lee con singular, plural y lista natural; neto, y sin un tipo en cero (diseño r5.4)', () => {
    const cuenta = (cl: number, co: number, pr: number, sv = 0) => ({
      clases: { n: cl, total: `${cl * 500}.00`, pendientesDeValoracion: sv },
      comisiones: { n: co, total: `${co * 30}.00` },
      propinas: { n: pr, total: `${pr * 30}.00` },
    })
    expect(textoDeCuenta(tEs, cuenta(3, 41, 18), 'es')).toBe('3 clases ($1,500.00), 41 comisiones ($1,230.00) y 18 propinas ($540.00)')
    expect(textoDeCuenta(tEn, cuenta(3, 41, 18), 'en')).toBe('3 classes ($1,500.00), 41 commissions ($1,230.00), and 18 tips ($540.00)')
    expect(textoDeCuenta(tEs, cuenta(0, 1, 0), 'es')).toBe('1 comisión ($30.00)')
    expect(textoDeCuenta(tEs, cuenta(1, 0, 0, 2), 'es')).toBe('1 clase ($500.00) y 2 clases que todavía no se pueden valorar')
    expect(tEs('sedes.fuera.sinActivar', { desde: '1 oct 2026', cuenta: '41 comisiones ($1,230.00)' })).toBe(
      'Lo que queda fuera desde el 1 oct 2026: 41 comisiones ($1,230.00). Actívala para que entre.',
    )
    // Concordancia: con UNA sola cosa ningún texto antepone un verbo plural a la cuenta («quedan fuera 1 comisión»).
    const una = textoDeCuenta(tEs, cuenta(0, 1, 0), 'es')
    const unaEn = textoDeCuenta(tEn, cuenta(0, 1, 0), 'en')
    expect(tEs('sedes.fuera.antesDe', { desde: '1 oct', cuenta: una })).toBe('Lo que queda fuera, de antes del 1 oct: 1 comisión ($30.00).')
    expect(tEs('sedes.dialogo.entran', { cuenta: una, fecha: '5 oct', sede: 'Roma' })).toBe(
      'Lo que entra desde el 5 oct a las 00:00 (hora de Roma): 1 comisión ($30.00).',
    )
    expect(tEs('sedes.dialogo.quedanFuera', { cuenta: una, fecha: '5 oct' })).toBe('Lo que queda fuera, de antes del 5 oct: 1 comisión ($30.00).')
    expect(tEs('sedes.dialogo.dejanDeEntrar', { cuenta: una, fecha: '5 oct' })).toBe('Lo que deja de entrar, de después del 5 oct: 1 comisión ($30.00).')
    expect(tEs('sedes.dialogo.permanecen', { cuenta: una, fecha: '5 oct' })).toBe('Lo que sigue entrando hasta el 5 oct: 1 comisión ($30.00).')
    expect(tEs('sedes.aviso.sinActivar', { sede: 'Roma', desde: '1 oct', cuenta: una })).toBe(
      'Roma no está activa. Lo que queda fuera desde el 1 oct: 1 comisión ($30.00).',
    )
    expect(tEn('sedes.fuera.sinActivar', { desde: 'Oct 1', cuenta: unaEn })).toBe('What is left out since Oct 1: 1 commission ($30.00). Turn it on so it counts.')
    expect(tEn('sedes.fuera.antesDe', { desde: 'Oct 1', cuenta: unaEn })).toBe('What is left out, from before Oct 1: 1 commission ($30.00).')
    expect(tEn('sedes.dialogo.entran', { cuenta: unaEn, fecha: 'Oct 5', sede: 'Roma' })).toBe('What counts from Oct 5 at 00:00 (Roma time): 1 commission ($30.00).')
    expect(tEn('sedes.dialogo.quedanFuera', { cuenta: unaEn, fecha: 'Oct 5' })).toBe('What is left out, from before Oct 5: 1 commission ($30.00).')
    expect(tEn('sedes.dialogo.dejanDeEntrar', { cuenta: unaEn, fecha: 'Oct 5' })).toBe('What stops counting, from after Oct 5: 1 commission ($30.00).')
    expect(tEn('sedes.dialogo.permanecen', { cuenta: unaEn, fecha: 'Oct 5' })).toBe('What still counts up to Oct 5: 1 commission ($30.00).')
    expect(tEn('sedes.aviso.sinActivar', { sede: 'Roma', desde: 'Oct 1', cuenta: unaEn })).toBe('Roma is not active. What is left out since Oct 1: 1 commission ($30.00).')
    // Una o varias sedes sin plan: el verbo concuerda.
    expect(tEs('sedes.aviso.sinPlan', { sedes: 'Condesa', count: 1 })).toMatch(/^Condesa sigue activa sin plan/)
    expect(tEs('sedes.aviso.sinPlan', { sedes: 'Condesa y Roma', count: 2 })).toMatch(/^Condesa y Roma siguen activas sin plan/)
    expect(tEn('sedes.aviso.sinPlan', { sedes: 'Condesa and Roma', count: 2 })).toMatch(/^Condesa and Roma are still active/)
    expect(tEs('sedes.aviso.mas', { count: 1 })).toBe('y 1 sede más')
    // Nunca «de este periodo»: lo que está fuera puede venir de periodos anteriores sin cerrar (ruling progress.md:309).
    for (const texto of [JSON.stringify(es.sedes), JSON.stringify(en.sedes)]) expect(texto).not.toMatch(/de este periodo|this period/i)
    // E6a-fix F14 (QA H12): una sede trae clases, no sólo ventas: sus textos no dicen «vendido» (3 clases «vendidas»).
    for (const texto of [JSON.stringify(es.sedes), JSON.stringify(en.sedes)]) expect(texto).not.toMatch(/vend|sold|sells?\b/i)
    expect(tEs('sedes.dialogo.entranNada', { fecha: '7 oct' })).toBe('Todavía no hay nada desde el 7 oct: entra todo lo de ahora en adelante.')
    expect(tEn('sedes.dialogo.entranNada', { fecha: 'Oct 7' })).toBe('There is nothing since Oct 7 yet: everything from now on counts.')
  })

  it('recibo de la fase 3 (E5a): persona dada de baja, total sin clases, tipos y devoluciones pendientes en español natural', () => {
    expect(tEs('period.formerStaff')).toBe('Persona dada de baja')
    expect(tEn('period.formerStaff')).toBe('Former staff member')
    // El literal del server se traduce; un nombre real, no.
    expect(nombreVisible(tEn, 'Persona dada de baja')).toBe('Former staff member')
    expect(nombreVisible(tEn, '  ')).toBe('Former staff member')
    expect(nombreVisible(tEn, null)).toBe('Former staff member')
    expect(nombreVisible(tEn, 'Ana López')).toBe('Ana López')
    expect(tEs('period.detailSummaryTotal', { total: '$730.00' })).toBe('Total $730.00')
    expect(tEs('period.salesSection')).toBe('Comisiones y propinas')
    expect(tEs('period.byType.COMISION')).toBe('Comisiones')
    expect(tEn('period.byType.PROPINA')).toBe('Tips')
    const nombre = (p: { start: string }) => (p.start === '2026-10-01' ? 'octubre de 2026' : 'septiembre de 2026')
    const alCerrar = { seDescuenta: { tipo: 'AL_CERRAR' as const, periodo: { start: '2026-10-01', end: '2026-10-31' } }, n: 2, total: '-50.00', porSede: [] }
    const despues = { seDescuenta: { tipo: 'PERIODO_POSTERIOR_A' as const, origen: { start: '2026-09-01', end: '2026-09-30' } }, n: 1, total: '-30.00', porSede: [] }
    expect(lineaDePendiente(tEs, alCerrar, nombre)).toBe('−$50.00 se descontará solo al cerrar el periodo de octubre de 2026.')
    expect(lineaDePendiente(tEs, despues, nombre)).toBe('−$30.00 se descontará solo al cerrar un periodo posterior al de septiembre de 2026 (ése ya se cerró).')
    expect(lineaDePendiente(tEn, alCerrar, () => 'October 2026')).toBe('−$50.00 will be deducted automatically when the October 2026 period closes.')
    expect(
      tEs('manualAdjust.pendingOne', { persona: 'Carla QA', monto: '−$50.00', cuando: cuandoSeDescuenta(tEs, alCerrar.seDescuenta, nombre) }),
    ).toBe('Carla QA tiene −$50.00 en devoluciones que se descontarán solas al cerrar el periodo de octubre de 2026. Si este ajuste es por eso, no lo registres.')
    expect(tEs('manualAdjust.pendingMany', { persona: 'Carla QA', monto: '−$80.00' })).toBe(
      'Carla QA tiene −$80.00 en devoluciones que se descontarán solas. Si este ajuste es por eso, no lo registres:',
    )
  })

  it('cierre de la fase 3 (E5b): singular y plural, lo que congela, los avisos y nada de «Muy pronto»', () => {
    expect(tEs('close.commissions', { count: 1 })).toBe('1 comisión')
    expect(tEs('close.tips', { count: 230 })).toBe('230 propinas')
    expect(tEs('close.classes', { count: 1 })).toBe('1 clase')
    expect(tEn('close.commissions', { count: 41 })).toBe('41 commissions')
    expect(tEs('close.tipsWithoutOwner', { count: 1, total: '$80.00' })).toMatch(/^1 propina sin persona \(\$80\.00\) no entra al recibo/)
    expect(tEs('close.tipsWithoutOwner', { count: 3, total: '$240.00' })).toMatch(/^3 propinas sin persona \(\$240\.00\) no entran al recibo/)
    expect(tEs('close.willFreezeSales', { count: 1, lista: '1 comisión', personas: '1 persona', sedes: 'Prado Norte', total: '$90.00' })).toBe(
      'Se congela 1 comisión de 1 persona en Prado Norte: $90.00.',
    )
    expect(tEs('close.willFreezeSales', { count: 3, lista: '1 clase y 2 propinas', personas: '2 personas', sedes: 'Roma', total: '$600.00' })).toBe(
      'Se congelan 1 clase y 2 propinas de 2 personas en Roma: $600.00.',
    )
    expect(tEs('close.reversals', { count: 1 })).toBe('Incluye 1 comisión anulada que se descuenta.')
    // Resolución 16 (progress.md: «E5b debe decir cobros o devoluciones»), con el verbo que concuerda.
    expect(tEs('close.commissionsToReview', { count: 1 })).toBe('1 cobro o devolución con comisión por revisar: no entra hasta resolverla.')
    expect(tEs('close.commissionsToReview', { count: 2 })).toBe('2 cobros o devoluciones con comisión por revisar: no entran hasta resolverlas.')
    expect(tEs('close.empty')).toBe('No hay nada que pagar en este periodo: se cierra en $0.')
    // El bloqueo en rojo, según haya otra sede con plan (diseño r4.7), con el verbo que concuerda.
    expect(tEs('close.block.SEDE_ACTIVA_SIN_PLAN_otras', { count: 1, sedes: 'Wellness' })).toBe(
      'Wellness sigue activa en pago al personal y ya no tiene el plan. Desactívala indicando su último día: con eso se puede cerrar.',
    )
    expect(tEs('close.block.SEDE_ACTIVA_SIN_PLAN_otras', { count: 2, sedes: 'Wellness y Roma' })).toMatch(/^Wellness y Roma siguen activas .* Desactívalas/)
    expect(tEs('close.block.SEDE_ACTIVA_SIN_PLAN_ninguna', { count: 1, sedes: 'Wellness' })).toBe(
      'Wellness sigue activa en pago al personal y ya no tiene el plan. Renueva el plan para cerrar: desactivarla no libera el cierre.',
    )
    expect(tEn('close.block.SEDE_ACTIVA_SIN_PLAN_ninguna', { count: 2, sedes: 'Wellness and Roma' })).toMatch(/^Wellness and Roma are still active/)
    expect(tEs('close.deactivateSede', { sede: 'Wellness' })).toBe('Desactivar Wellness')
    // Por sede: «no entra en este cierre», nunca «de este periodo» (ruling progress.md:309: incluye sobrantes de cerrados).
    expect(tEs('close.bySede.fuera', { cuenta: '1 comisión ($30.00)' })).toBe('No entra en este cierre: 1 comisión ($30.00).')
    expect(tEs('close.bySede.entra', { cuenta: '3 clases ($1,500.00)' })).toBe('Entra: 3 clases ($1,500.00).')
    expect(tEn('close.bySede.fuera', { cuenta: '1 commission ($30.00)' })).toBe('Not in this close: 1 commission ($30.00).')
    for (const g of [es.close.bySede, en.close.bySede]) expect(JSON.stringify(g)).not.toMatch(/de este periodo|this period/i)
    expect(tEs('close.pendingTitle')).toBe('Devoluciones que este cierre no descuenta')
    for (const texto of [JSON.stringify(es), JSON.stringify(en)]) expect(texto).not.toMatch(/muy pronto|coming soon/i)
  })

  it('E4-fix: la cancelada tarde dice que el conteo corregido no aplica; sin permiso, las reglas dicen cuál falta', () => {
    expect(tEs('classCard.overrideNotApplied')).toBe('El conteo corregido no aplica: la clase se canceló tarde y se paga el sueldo base.')
    expect(tEn('classCard.overrideNotApplied')).toBe('The corrected count does not apply: the class was cancelled late and base pay applies.')
    // E5a-fix: el motivo de la corrección se conserva como dato, sin decir «Ajustado».
    expect(tEs('classCard.overrideReason', { reason: 'Llegaron 8' })).toBe('Motivo de la corrección: Llegaron 8')
    expect(tEn('classCard.overrideReason', { reason: 'Llegaron 8' })).toBe('Reason for the correction: Llegaron 8')
    for (const texto of [tEs('classCard.overrideReason', { reason: 'x' }), tEn('classCard.overrideReason', { reason: 'x' })])
      expect(texto).not.toMatch(/ajustad|adjusted/i)
    expect(tEs('rules.noPermission')).toBe('Para cambiar las reglas necesitas el permiso «Configurar pago al personal». Pídeselo al dueño del negocio.')
    expect(tEn('rules.noPermission')).toMatch(/“Manage staff pay”/)
  })
})
