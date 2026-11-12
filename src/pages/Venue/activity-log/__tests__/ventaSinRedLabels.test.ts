import { describe, expect, it } from 'vitest'
import es from '@/locales/es/organization.json'
import en from '@/locales/en/organization.json'
import { actionTone, toDetailRows } from '../formatActivity'

type Bitacora = {
  activityLog: { actions: Record<string, string>; detailKeys: Record<string, string>; entities: Record<string, string> }
}

// Contrato del SERVIDOR: `avisoDeVentaSinRed.ts` (`avisarContandoFallas`) escribe `VENTA_SIN_RED_<AVISO>` sobre la entidad
// `VentaSinRed` con `data: { terminalSerial, montoCents, motivo, orderId }`. `montoCents` viene en CENTAVOS.
// D30: `FEATURE_ENABLED_BY_ADMIN` / `FEATURE_DISABLED_BY_ADMIN` empiezan a guardar `data: { featureCode }`.
const ACCIONES = {
  VENTA_SIN_RED_RECHAZADA: ['terminalSerial', 'montoCents', 'motivo', 'orderId'],
  VENTA_SIN_RED_REINTENTANDO: ['terminalSerial', 'montoCents', 'motivo', 'orderId'],
  VENTA_SIN_RED_PRECIO_CAMBIADO: ['terminalSerial', 'montoCents', 'motivo', 'orderId'],
  VENTA_SIN_RED_TURNO_CERRADO: ['terminalSerial', 'montoCents', 'motivo', 'orderId'],
  FEATURE_ENABLED_BY_ADMIN: ['featureCode'],
  FEATURE_DISABLED_BY_ADMIN: ['featureCode'],
} as const

describe('bitácora: ventas sin internet y funciones prendidas por admin', () => {
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
    it(`${lng}: la entidad VentaSinRed se lee`, () => {
      expect(b.entities.VentaSinRed).toEqual(expect.stringMatching(/\S/))
    })
  }

  it('las etiquetas en español son las acordadas', () => {
    const b = (es as unknown as Bitacora).activityLog
    expect(b.actions.VENTA_SIN_RED_RECHAZADA).toBe('Venta sin internet no registrada')
    expect(b.actions.VENTA_SIN_RED_REINTENTANDO).toBe('Venta sin internet que aún no sube')
    expect(b.actions.VENTA_SIN_RED_PRECIO_CAMBIADO).toBe('Venta sin internet que no cuadra con lo cobrado')
    expect(b.actions.VENTA_SIN_RED_TURNO_CERRADO).toBe('Venta sin internet de un turno ya cerrado')
    expect(b.entities.VentaSinRed).toBe('Venta sin internet')
    expect(b.detailKeys.montoCents).toBe('Monto cobrado (MXN)')
    expect(b.detailKeys.featureCode).toBe('Función')
  })

  it('🔴 las cuatro piden que el dueño revise (ámbar), como el cobro sin internet con diferencia; ninguna es neutra ni roja', () => {
    for (const accion of Object.keys(ACCIONES).filter(a => a.startsWith('VENTA_SIN_RED_'))) {
      expect(actionTone(accion), accion).toBe('attention')
    }
  })

  it('🔴 un monto en centavos con etiqueta en pesos se muestra en pesos', () => {
    const labelOf = (k: string) => (es as unknown as Bitacora).activityLog.detailKeys[k] ?? null
    const rows = toDetailRows({ montoCents: 12550, amountCents: 12550, motivo: 'respuesta 403' }, labelOf, () => '—')
    expect(rows.find(r => r.key === 'montoCents')).toMatchObject({ label: 'Monto cobrado (MXN)', value: '125.50' })
    // Sin etiqueta se ve el nombre crudo del campo («amountCents»): el valor sigue crudo para no contradecirlo.
    expect(rows.find(r => r.key === 'amountCents')).toMatchObject({ label: 'amountCents', value: '12550' })
  })
})
