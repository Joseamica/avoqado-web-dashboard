import { describe, expect, it } from 'vitest'
import { claseDeConflicto, conflictoDelOrigen, destinosEnConflicto, mensajeDelServidor, resultadoIncierto } from '../errores'

const error409 = (code: string, details?: unknown) =>
  Object.assign(new Error('Request failed with status code 409'), {
    response: { status: 409, data: { message: `msg ${code}`, code, details } },
  })
const conEstado = (status: number) => ({ response: { status, data: {} } })

describe('errores de la pantalla del cliente', () => {
  it('BUSY se reintenta; CONFLICT y cualquier otro 409 son conflicto; otros estados, nada', () => {
    expect(claseDeConflicto(error409('CUSTOMER_DISPLAY_BUSY'))).toBe('ocupado')
    expect(claseDeConflicto(error409('CUSTOMER_DISPLAY_CONFLICT'))).toBe('conflicto')
    expect(claseDeConflicto(error409('ALGO_NUEVO'))).toBe('conflicto')
    expect(claseDeConflicto(conEstado(400))).toBeNull()
    expect(claseDeConflicto(new Error('Network Error'))).toBeNull()
  })
  it('lee los destinos en conflicto y si el que cambió fue el origen', () => {
    expect(destinosEnConflicto(error409('CUSTOMER_DISPLAY_CONFLICT', { conflicts: ['t2', 7, 't3'] }))).toEqual(['t2', 't3'])
    expect(destinosEnConflicto(error409('CUSTOMER_DISPLAY_CONFLICT'))).toEqual([])
    expect(conflictoDelOrigen(error409('CUSTOMER_DISPLAY_CONFLICT', { source: true, terminalId: 't1' }))).toBe(true)
    expect(conflictoDelOrigen(error409('CUSTOMER_DISPLAY_CONFLICT', { conflicts: ['t2'] }))).toBe(false)
  })
  it('🔴 el mensaje es el del SERVIDOR; el respaldo sólo si no mandó texto (nunca el de axios)', () => {
    expect(mensajeDelServidor(error409('CUSTOMER_DISPLAY_CONFLICT'), 'respaldo')).toBe('msg CUSTOMER_DISPLAY_CONFLICT')
    expect(mensajeDelServidor(new Error('Request failed with status code 502'), 'respaldo')).toBe('respaldo')
  })
  it('🔴 sólo un rechazo que PRUEBA que no se escribió nada es confirmado; un 500 genérico NO (Codex r2: app.ts:505 no acredita rollback)', () => {
    expect(resultadoIncierto(new Error('Network Error'))).toBe(true)
    expect(resultadoIncierto(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }))).toBe(true)
    for (const s of [500, 502, 503, 504, 524, 408, 418]) expect(resultadoIncierto(conEstado(s)), String(s)).toBe(true)
    for (const s of [400, 401, 403, 404, 409, 422, 429]) expect(resultadoIncierto(conEstado(s)), String(s)).toBe(false)
  })
})
