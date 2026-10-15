/**
 * El cable entre el reintento REAL de `src/api.ts` y `resultadoIncierto` (B2 r2). `errores.test.ts` arma el error a mano con
 * `config._retry`; esta prueba usa la instancia de axios de verdad, con un adaptador falso, para que renombrar la marca en
 * `api.ts` (o un axios que ya no la conserve al repetir la petición) truene aquí y no en producción. No toca `api.ts`.
 */
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import api from '@/api'
import { claseDeConflicto, resultadoIncierto } from '../errores'

const RUTA = '/api/v1/dashboard/venues/v1/terminals/t1/customer-display'
const adaptadorOriginal = api.defaults.adapter
afterEach(() => {
  api.defaults.adapter = adaptadorOriginal
})

const sinRed = (config: InternalAxiosRequestConfig) => new AxiosError('Network Error', AxiosError.ERR_NETWORK, config)
const conflicto409 = (config: InternalAxiosRequestConfig) => {
  const response: AxiosResponse = {
    status: 409,
    statusText: 'Conflict',
    headers: {},
    config,
    data: { message: 'Alguien más guardó este diseño mientras lo editabas.', code: 'CUSTOMER_DISPLAY_CONFLICT' },
  }
  return new AxiosError('Request failed with status code 409', AxiosError.ERR_BAD_REQUEST, config, undefined, response)
}

/** Lo que rechazó la promesa; si no rechazó, la prueba falla. */
async function errorDe(peticion: Promise<unknown>): Promise<unknown> {
  try {
    await peticion
  } catch (error) {
    return error
  }
  throw new Error('la petición no falló')
}

describe('reintento REAL de `@/api` → resultadoIncierto', () => {
  it('🔴 sin red y el reintento automático contesta 409 ⇒ la marca llega (`_retry`), es INCIERTO y no tiene clase de conflicto', async () => {
    const llamadas: InternalAxiosRequestConfig[] = []
    api.defaults.adapter = async config => {
      llamadas.push(config)
      throw llamadas.length === 1 ? sinRed(config) : conflicto409(config)
    }
    const error = await errorDe(api.put(RUTA, { expectedEditToken: 'd1:1', design: { theme: 'DARK' } }))
    expect(llamadas).toHaveLength(2) // la primera se perdió y `api.ts` la repitió sola
    expect((error as { config?: { _retry?: unknown } }).config?._retry).toBe(true)
    expect(resultadoIncierto(error)).toBe(true)
    expect(claseDeConflicto(error)).toBeNull()
  }, 10_000)

  it('un 409 directo (sin reintento) es un conflicto CONFIRMADO', async () => {
    let llamadas = 0
    api.defaults.adapter = async config => {
      llamadas += 1
      throw conflicto409(config)
    }
    const error = await errorDe(api.put(RUTA, { expectedEditToken: 'd1:1', design: { theme: 'DARK' } }))
    expect(llamadas).toBe(1)
    expect(resultadoIncierto(error)).toBe(false)
    expect(claseDeConflicto(error)).toBe('conflicto')
  })
})
