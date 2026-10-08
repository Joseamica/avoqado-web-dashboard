// E6a-fix4 C-n2: lo que el servidor dice que YA se guardó con una clave (409 CLAVE_REUTILIZADA, `details.guardado`) sólo se usa
// completo; si falta algo (servidor previo, forma rara), la pantalla muestra el mensaje del servidor en vez de inventar.
import { describe, expect, it } from 'vitest'
import { ajusteYaGuardado, mismoBorrador } from '../llaveDelAjuste'

const error = (guardado?: unknown) => ({ response: { status: 409, data: { code: 'CLAVE_REUTILIZADA', message: 'Ya se guardó…', ...(guardado === undefined ? {} : { details: { guardado } }) } } })
const COMPLETO = { staffNombre: 'Waiter Venue 1', amount: '9.00', reason: 'RETEST D1 C', periodo: { start: '2026-10-01', end: '2026-10-31' } }

describe('ajusteYaGuardado', () => {
  it('lee lo guardado cuando viene completo (el monto llega como texto o número)', () => {
    expect(ajusteYaGuardado(error(COMPLETO))).toEqual({ persona: 'Waiter Venue 1', amount: 9, reason: 'RETEST D1 C', start: '2026-10-01', end: '2026-10-31' })
    expect(ajusteYaGuardado(error({ ...COMPLETO, amount: -14.29 }))?.amount).toBe(-14.29)
  })
  it.each([
    ['sin details (servidor previo)', undefined],
    ['sin periodo', { ...COMPLETO, periodo: undefined }],
    ['monto que no es número', { ...COMPLETO, amount: 'mucho' }],
    ['sin nombre', { ...COMPLETO, staffNombre: '' }],
    ['sin motivo', { ...COMPLETO, reason: undefined }],
    ['fechas que no son texto', { ...COMPLETO, periodo: { start: 20261001, end: null } }],
  ])('%s ⇒ null (se muestra el mensaje del servidor)', (_n, g) => {
    expect(ajusteYaGuardado(error(g))).toBeNull()
  })
  it('un error sin respuesta ⇒ null', () => {
    expect(ajusteYaGuardado(new Error('Network Error'))).toBeNull()
  })
})

describe('mismoBorrador', () => {
  const b = { sede: 'v1', staffId: 's1', amount: 9, reason: 'Bono' }
  it('mismo ajuste ⇔ misma sede, persona, monto con signo y motivo', () => {
    expect(mismoBorrador(b, { ...b })).toBe(true)
    expect(mismoBorrador(b, { ...b, amount: 10 })).toBe(false)
    expect(mismoBorrador(b, { ...b, amount: -9 })).toBe(false)
    expect(mismoBorrador(b, { ...b, staffId: 's2' })).toBe(false)
  })
})
