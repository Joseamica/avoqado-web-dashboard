import { describe, expect, it } from 'vitest'

import es from '@/locales/es/reports.json'
import en from '@/locales/en/reports.json'
import { estadoDeLinea, type EstadoDeLinea } from '@/services/bankReconciliation.service'

/**
 * D24: una línea del estado de cuenta que espera la comisión de su día (`costoPendiente`) no está «sin conciliar»: la tabla dice
 * «Esperando comisión». Sin la marca (o con un servidor viejo que no la manda), el estado de siempre.
 */
describe('estadoDeLinea (D24)', () => {
  it('con la comisión por calcular, «Esperando comisión» aunque venga UNMATCHED', () => {
    expect(estadoDeLinea({ matchStatus: 'UNMATCHED', costoPendiente: true })).toBe('PENDING_FEE')
    expect(es.bankReconciliation.statuses.PENDING_FEE).toBe('Esperando comisión')
    expect(en.bankReconciliation.statuses.PENDING_FEE).toBe('Waiting for fee')
  })

  it('sin la marca (o sin el campo): el estado que manda el servidor, como siempre', () => {
    const estados: EstadoDeLinea[] = ['UNMATCHED', 'MATCHED', 'DUPLICATE', 'CONFIRMED']
    for (const e of estados) {
      expect(estadoDeLinea({ matchStatus: e as Exclude<EstadoDeLinea, 'PENDING_FEE'>, costoPendiente: false })).toBe(e)
      expect(estadoDeLinea({ matchStatus: e as Exclude<EstadoDeLinea, 'PENDING_FEE'> })).toBe(e)
      expect(es.bankReconciliation.statuses[e]).toBeTruthy()
    }
  })
})
