import { describe, expect, it } from 'vitest'
import es from '@/locales/es/organization.json'
import en from '@/locales/en/organization.json'
import { actionTone } from '../formatActivity'

type Bitacora = { activityLog: { actions: Record<string, string>; detailKeys: Record<string, string> } }

// Contrato del SERVIDOR: `order.mobile.service.ts` (COBRO_SIN_RED_CON_DIFERENCIA, D5 mesas sin red) y
// `avisoDeSobrepago.ts` (SOBREPAGO_DETECTADO). Las dos van sobre `Order` y guardan importes en pesos.
const ACCIONES = {
  COBRO_SIN_RED_CON_DIFERENCIA: ['paymentId', 'saldoEsperado', 'saldoDelServidor', 'diferencia', 'aparato'],
  SOBREPAGO_DETECTADO: ['paymentId', 'totalPaid', 'orderTotal', 'overpaidBy', 'wasAlreadyPaid'],
} as const

describe('bitácora: cobro sin red con diferencia y sobrepago', () => {
  for (const [lng, bundle] of [
    ['es', es],
    ['en', en],
  ] as const) {
    const b = (bundle as unknown as Bitacora).activityLog
    for (const [accion, campos] of Object.entries(ACCIONES)) {
      it(`${lng}: ${accion} y sus campos se leen`, () => {
        expect(b.actions[accion], accion).toEqual(expect.stringMatching(/\S/))
        for (const c of campos) expect(b.detailKeys[c], c).toEqual(expect.stringMatching(/\S/))
      })
    }
  }

  it('las etiquetas en español son las acordadas', () => {
    const b = (es as unknown as Bitacora).activityLog
    expect(b.actions.COBRO_SIN_RED_CON_DIFERENCIA).toBe('Cobro sin internet con diferencia')
    expect(b.detailKeys.saldoEsperado).toMatch(/^Saldo que esperaba el aparato/)
    expect(b.detailKeys.saldoDelServidor).toMatch(/^Saldo en el servidor/)
  })

  it('🔴 una diferencia de dinero se pinta para revisar, como su hermana del sobrepago (nunca neutra)', () => {
    expect(actionTone('COBRO_SIN_RED_CON_DIFERENCIA')).toBe('attention')
    expect(actionTone('SOBREPAGO_DETECTADO')).toBe('attention')
  })
})
