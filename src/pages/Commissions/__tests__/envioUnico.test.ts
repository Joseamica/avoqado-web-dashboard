// ft-graves, D-D1: reglas de la clave de una operación que crea algo. La clave es de la OPERACIÓN, no del clic.
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { olvidarPendientes, quedoEnDuda, useEnvioUnico, type Paso } from '../envioUnico'

const sinRespuesta = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })
const conEstado = (status: number) => Object.assign(new Error(`status ${status}`), { response: { status, data: {} } })

const montar = () => renderHook(() => useEnvioUnico()).result
/** Corre la operación y anota la clave de cada paso; `falla` decide qué lanza cada paso. */
const correr = async (
  envio: ReturnType<typeof montar>,
  huella: string,
  pasos: string[],
  falla: (paso: string) => unknown = () => null,
) => {
  const claves: Record<string, string> = {}
  await act(async () => {
    await envio.current
      .enviar(huella, async (paso: Paso) => {
        for (const nombre of pasos) {
          await paso(nombre, async clave => {
            claves[nombre] = clave
            const error = falla(nombre)
            if (error) throw error
          })
        }
      })
      .catch(() => {})
  })
  return claves
}

beforeEach(() => olvidarPendientes())

describe('useEnvioUnico', () => {
  it('dos envíos en el mismo instante corren la operación UNA vez', async () => {
    const envio = montar()
    let veces = 0
    await act(async () => {
      const a = envio.current.enviar('h', async () => {
        veces++
      })
      const b = envio.current.enviar('h', async () => {
        veces++
      })
      await Promise.all([a, b])
    })
    expect(veces).toBe(1)
  })

  it('sin respuesta, el siguiente intento con el MISMO cuerpo manda la MISMA clave', async () => {
    const envio = montar()
    const primero = await correr(envio, 'h', ['esquema'], () => sinRespuesta())
    const segundo = await correr(envio, 'h', ['esquema'])
    expect(segundo.esquema).toBe(primero.esquema)
  })

  it('un 5xx también deja la operación en duda: misma clave', async () => {
    const envio = montar()
    const primero = await correr(envio, 'h', ['esquema'], () => conEstado(502))
    const segundo = await correr(envio, 'h', ['esquema'])
    expect(segundo.esquema).toBe(primero.esquema)
  })

  it('tras un 4xx (definitivo) el siguiente intento lleva clave nueva', async () => {
    const envio = montar()
    const primero = await correr(envio, 'h', ['esquema'], () => conEstado(400))
    const segundo = await correr(envio, 'h', ['esquema'])
    expect(segundo.esquema).not.toBe(primero.esquema)
  })

  it('tras un éxito, otro intento con lo mismo es otra operación: clave nueva', async () => {
    const envio = montar()
    const primero = await correr(envio, 'h', ['esquema'])
    const segundo = await correr(envio, 'h', ['esquema'])
    expect(segundo.esquema).not.toBe(primero.esquema)
  })

  it('si el cuerpo cambió, clave nueva aunque el intento anterior quedara en duda', async () => {
    const envio = montar()
    const primero = await correr(envio, 'h1', ['esquema'], () => sinRespuesta())
    const segundo = await correr(envio, 'h2', ['esquema'])
    expect(segundo.esquema).not.toBe(primero.esquema)
  })

  it('en varios pasos, lo ya creado conserva su clave y el paso con 4xx lleva una nueva', async () => {
    const envio = montar()
    const primero = await correr(envio, 'h', ['esquema', 'excepcion'], p => (p === 'excepcion' ? conEstado(400) : null))
    const segundo = await correr(envio, 'h', ['esquema', 'excepcion'])
    expect(segundo.esquema).toBe(primero.esquema)
    expect(segundo.excepcion).not.toBe(primero.excepcion)
  })

  it('cerrar y volver a abrir (otro componente) con el mismo cuerpo en duda reusa la clave', async () => {
    const primero = await correr(montar(), 'h', ['esquema'], () => sinRespuesta())
    const segundo = await correr(montar(), 'h', ['esquema'])
    expect(segundo.esquema).toBe(primero.esquema)
  })

  it('quedoEnDuda: sin respuesta o 5xx sí; 4xx no', () => {
    expect(quedoEnDuda(sinRespuesta())).toBe(true)
    expect(quedoEnDuda(conEstado(503))).toBe(true)
    expect(quedoEnDuda(conEstado(409))).toBe(false)
    expect(quedoEnDuda(conEstado(400))).toBe(false)
  })
})
