import { describe, expect, it } from 'vitest'
import { CONTRASENA_MAX, CONTRASENA_MIN, contrasenaNuevaZod, esContrasenaComun } from '../contrasenaNueva'

const t = ((k: string) => k) as never
const schema = contrasenaNuevaZod(t)
const mensaje = (p: string) => {
  const r = schema.safeParse(p)
  return r.success ? null : r.error.issues[0].message
}

describe('contrasenaNueva', () => {
  it('el mínimo es 8 y el tope 128', () => {
    expect(CONTRASENA_MIN).toBe(8)
    expect(CONTRASENA_MAX).toBe(128)
  })

  it("'abcdefgh' es válida (sin mayúscula, número ni símbolo)", () => {
    expect(mensaje('abcdefgh')).toBeNull()
  })

  it("'12345678' es inválida por común", () => {
    expect(esContrasenaComun('12345678')).toBe(true)
    expect(mensaje('12345678')).toBe('auth:contrasenaNueva.comun')
  })

  it('la lista de comunes no distingue mayúsculas', () => {
    expect(esContrasenaComun('PassWord123')).toBe(true)
    expect(esContrasenaComun('abcdefgh')).toBe(false)
  })

  it("'corta' es inválida por corta", () => {
    expect(mensaje('corta')).toBe('auth:contrasenaNueva.min')
  })

  it('más de 128 caracteres es inválida; exactamente 128 sirve', () => {
    expect(mensaje('a'.repeat(129))).toBe('auth:contrasenaNueva.max')
    expect(mensaje('a'.repeat(128))).toBeNull()
  })
})
