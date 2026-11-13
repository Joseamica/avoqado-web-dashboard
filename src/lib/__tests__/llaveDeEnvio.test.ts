import { describe, expect, it } from 'vitest'
import { llaveNueva, llaveParaEnvio } from '../llaveDeEnvio'

describe('llaveParaEnvio (D1)', () => {
  const contador = () => {
    let n = 0
    return () => `llave-${++n}`
  }

  it('el primer envío estrena llave', () => {
    expect(llaveParaEnvio(null, 'h1', contador())).toEqual({ huella: 'h1', llave: 'llave-1' })
  })

  it('🔴 el MISMO contenido reusa la llave: el reintento (de la persona o de api.ts) se reconoce en el servidor', () => {
    const nueva = contador()
    const primero = llaveParaEnvio(null, 'h1', nueva)
    expect(llaveParaEnvio(primero, 'h1', nueva)).toBe(primero)
  })

  it('otro contenido estrena llave (con la vieja el servidor contestaría IDEMPOTENCY_KEY_REUSED)', () => {
    const nueva = contador()
    const primero = llaveParaEnvio(null, 'h1', nueva)
    expect(llaveParaEnvio(primero, 'h2', nueva)).toEqual({ huella: 'h2', llave: 'llave-2' })
  })

  it('la llave real cabe en lo que acepta el servidor', () => {
    expect(llaveNueva()).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
  })
})
