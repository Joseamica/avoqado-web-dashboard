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

describe('orden de la captura', () => {
  it('index.html corre document-privacy.js (que captura) antes de gtag, oaiq y la app', () => {
    const html = readFileSync(resolve(__dirname, '../../../index.html'), 'utf8')
    const cap = html.indexOf('/document-privacy.js')
    for (const despues of ["gtag('config'", "oaiq('init'", 'dashboard-main']) {
      const i = html.indexOf(despues)
      if (i > -1) expect(cap).toBeLessThan(i)
    }
    expect(cap).toBeGreaterThan(-1)
    const js = readFileSync(resolve(__dirname, '../../../public/document-privacy.js'), 'utf8')
    expect(js).toContain("'/auth/entrar'")
    expect(js).toContain('avq_boleto_alta')
  })

  it('dashboard-main la repite antes de initPostHog (cinturón)', () => {
    const fuente = readFileSync(resolve(__dirname, '../../dashboard-main.tsx'), 'utf8')
    expect(fuente.indexOf('capturarBoletoDeAlta()')).toBeLessThan(fuente.indexOf('initPostHog()'))
  })

  it('tomarBoletoDeAlta lee y borra el respaldo global del head', () => {
    window.__avqBoletoAlta = 'g1'
    expect(tomarBoletoDeAlta()).toBe('g1')
    expect(window.__avqBoletoAlta).toBeUndefined()
  })
})
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
