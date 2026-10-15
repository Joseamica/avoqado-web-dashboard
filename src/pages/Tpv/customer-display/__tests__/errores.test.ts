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
  describe('🔴 reintento automático de `src/api.ts` (marca `config._retry`): el PRIMER intento pudo haber guardado', () => {
    const reintentado = <T extends object>(error: T, retry: unknown = true) => Object.assign(error, { config: { _retry: retry } })
    it('un 409 de un reintento es INCIERTO: el token cambió por nuestra propia escritura perdida', () => {
      expect(resultadoIncierto(reintentado(error409('CUSTOMER_DISPLAY_CONFLICT')))).toBe(true)
      expect(resultadoIncierto(reintentado(error409('CUSTOMER_DISPLAY_BUSY')))).toBe(true)
    })
    it('un 429 de un reintento es INCIERTO: el primero pudo pasar y el segundo topar el límite', () => {
      expect(resultadoIncierto(reintentado(conEstado(429)))).toBe(true)
    })
    it('un 409 SIN reintento sigue siendo un conflicto confirmado', () => {
      const sinReintento = error409('CUSTOMER_DISPLAY_CONFLICT')
      expect(resultadoIncierto(sinReintento)).toBe(false)
      expect(claseDeConflicto(sinReintento)).toBe('conflicto')
      expect(resultadoIncierto(reintentado(error409('CUSTOMER_DISPLAY_CONFLICT'), false))).toBe(false)
      expect(resultadoIncierto(reintentado(conEstado(429), 'true'))).toBe(false) // sólo el `true` que pone api.ts
    })
    it('el resto de los rechazos de un reintento siguen confirmados (el mismo cuerpo también se habría rechazado)', () => {
      for (const s of [400, 401, 403, 404, 422]) expect(resultadoIncierto(reintentado(conEstado(s))), String(s)).toBe(false)
    })
  })
})
