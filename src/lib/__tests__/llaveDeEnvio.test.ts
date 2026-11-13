import { afterEach, describe, expect, it } from 'vitest'
import {
  envioEnDuda,
  guardarEnvioEnDuda,
  llaveNueva,
  llavePara,
  olvidarEnvioEnDuda,
  olvidarTodosLosEnviosEnDuda,
} from '../llaveDeEnvio'

describe('llave de envío con su envío en duda (D1)', () => {
  afterEach(() => olvidarTodosLosEnviosEnDuda())

  const contador = () => {
    let n = 0
    return () => `llave-${++n}`
  }

  it('sin envío en duda, cada envío estrena llave', () => {
    const nueva = contador()
    expect(llavePara('pago-manual:v1', 'h1', nueva)).toEqual({ llave: 'llave-1', reusada: false })
    expect(llavePara('pago-manual:v1', 'h1', nueva)).toEqual({ llave: 'llave-2', reusada: false })
  })

  it('🔴 con un envío en duda, el MISMO contenido reusa su llave (el servidor devuelve lo ya registrado)', () => {
    guardarEnvioEnDuda('pago-manual:v1', { huella: 'h1', llave: 'k-1', monto: 100, desde: Date.now() })
    expect(llavePara('pago-manual:v1', 'h1', contador())).toEqual({ llave: 'k-1', reusada: true })
  })

  it('otro contenido estrena llave; otro ámbito no ve el envío en duda', () => {
    guardarEnvioEnDuda('pago-manual:v1', { huella: 'h1', llave: 'k-1', monto: 100, desde: Date.now() })
    expect(llavePara('pago-manual:v1', 'h2', contador()).reusada).toBe(false)
    expect(llavePara('pago-manual:v2', 'h1', contador()).reusada).toBe(false)
  })

  it('el envío en duda sobrevive en sessionStorage (cerrar el diálogo, salir de Pagos, recargar)', () => {
    guardarEnvioEnDuda('reembolso:v1:p1', { huella: 'h1', llave: 'k-1', monto: 50, desde: Date.now() })
    expect(JSON.parse(sessionStorage.getItem('avq-envios-en-duda:v1') ?? '{}')['reembolso:v1:p1'].llave).toBe('k-1')
  })

  it('«Es otro» (olvidar) hace que el mismo contenido estrene llave', () => {
    guardarEnvioEnDuda('pago-manual:v1', { huella: 'h1', llave: 'k-1', monto: 100, desde: Date.now() })
    olvidarEnvioEnDuda('pago-manual:v1')
    expect(llavePara('pago-manual:v1', 'h1', contador()).reusada).toBe(false)
  })

  it('a las 24 h el envío en duda vence', () => {
    const hace25h = Date.now() - 25 * 60 * 60 * 1000
    guardarEnvioEnDuda('pago-manual:v1', { huella: 'h1', llave: 'k-1', monto: 100, desde: hace25h })
    expect(envioEnDuda('pago-manual:v1')).toBeNull()
  })

  it('la llave real cabe en lo que acepta el servidor', () => {
    expect(llaveNueva()).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
  })
})
