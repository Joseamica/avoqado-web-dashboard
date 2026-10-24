import { beforeEach, describe, expect, it, vi } from 'vitest'
import { capturarBoletoDeAlta, tomarBoletoDeAlta } from '../boleto-de-alta-capture'

beforeEach(() => {
  sessionStorage.clear()
  tomarBoletoDeAlta()
})

describe('capturarBoletoDeAlta', () => {
  it('guarda el boleto, lo borra de la URL y se toma una sola vez', () => {
    window.history.replaceState(null, '', '/auth/entrar#boleto=abc')
    capturarBoletoDeAlta()
    expect(window.location.href).not.toContain('abc')
    expect(window.location.pathname).toBe('/auth/entrar')
    expect(tomarBoletoDeAlta()).toBe('abc')
    expect(tomarBoletoDeAlta()).toBeNull()
  })

  it('no toca otras rutas', () => {
    window.history.replaceState(null, '', '/login#boleto=abc')
    capturarBoletoDeAlta()
    expect(window.location.hash).toBe('#boleto=abc')
    expect(tomarBoletoDeAlta()).toBeNull()
  })

  it('si el sessionStorage está bloqueado, lo guarda en memoria', () => {
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    window.history.replaceState(null, '', '/auth/entrar#boleto=xyz')
    capturarBoletoDeAlta()
    expect(window.location.href).not.toContain('xyz')
    expect(tomarBoletoDeAlta()).toBe('xyz')
    set.mockRestore()
    get.mockRestore()
  })
})

describe('dashboard-main', () => {
  it('captura el boleto ANTES de iniciar PostHog', () => {
    const fuente = readFileSync(resolve(__dirname, '../../dashboard-main.tsx'), 'utf8')
    const a = fuente.indexOf('capturarBoletoDeAlta()')
    const b = fuente.indexOf('initPostHog()')
    expect(a).toBeGreaterThan(-1)
    expect(a).toBeLessThan(b)
  })
})
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
