import { describe, expect, it } from 'vitest'
import { reintentarSalvoSinPermiso } from '../reintentoSinPermiso'

describe('reintentarSalvoSinPermiso', () => {
  it('🔴 un 403 o un 401 no se reintenta nunca', () => {
    expect(reintentarSalvoSinPermiso(0, { response: { status: 403 } })).toBe(false)
    expect(reintentarSalvoSinPermiso(0, { response: { status: 401 } })).toBe(false)
  })
  it('cualquier otro fallo conserva los 3 reintentos de siempre', () => {
    expect(reintentarSalvoSinPermiso(0, { response: { status: 500 } })).toBe(true)
    expect(reintentarSalvoSinPermiso(2, new Error('red'))).toBe(true)
    expect(reintentarSalvoSinPermiso(3, new Error('red'))).toBe(false)
  })
})
