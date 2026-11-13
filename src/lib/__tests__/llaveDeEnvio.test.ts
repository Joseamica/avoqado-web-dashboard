import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { esFolioDeOtraOperacion, llaveNueva, useCandado, useLlaveDeLaVentana } from '../llaveDeEnvio'

/** D1 (founder 13-nov: «A, una ventana = un folio»). */
describe('la llave de una ventana (D1, opción A)', () => {
  it('se queda igual mientras la ventana siga abierta', () => {
    const { result, rerender } = renderHook(({ abierta }) => useLlaveDeLaVentana(abierta), { initialProps: { abierta: true } })
    const primera = result.current.llave
    rerender({ abierta: true })
    rerender({ abierta: true })
    expect(result.current.llave).toBe(primera)
  })

  it('cerrar y volver a abrir estrena llave', () => {
    const { result, rerender } = renderHook(({ abierta }) => useLlaveDeLaVentana(abierta), { initialProps: { abierta: true } })
    const primera = result.current.llave
    rerender({ abierta: false })
    rerender({ abierta: true })
    expect(result.current.llave).not.toBe(primera)
  })

  it('«estrenar» (tras un éxito confirmado) cambia la llave sin cerrar', () => {
    const { result } = renderHook(() => useLlaveDeLaVentana(true))
    const primera = result.current.llave
    act(() => result.current.estrenar())
    expect(result.current.llave).not.toBe(primera)
  })

  it('la llave cabe en lo que acepta el servidor', () => {
    expect(llaveNueva()).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
  })
})

describe('el candado del doble clic', () => {
  it('🔴 dos llamadas en el mismo instante: sólo corre la primera; al terminar se puede otra vez', async () => {
    const { result } = renderHook(() => useCandado())
    let corridas = 0
    let soltar: () => void = () => {}
    const trabajo = () =>
      new Promise<void>(r => {
        corridas += 1
        soltar = r
      })
    const primera = result.current(trabajo)
    const segunda = result.current(trabajo)
    expect(await segunda).toBeUndefined()
    soltar()
    await primera
    expect(corridas).toBe(1)
    const tercera = result.current(trabajo)
    soltar()
    await tercera
    expect(corridas).toBe(2)
  })
})

describe('«ese folio ya es de otra operación»', () => {
  it('reconoce el 409 IDEMPOTENCY_KEY_REUSED del servidor y nada más', () => {
    expect(esFolioDeOtraOperacion({ response: { status: 409, data: { code: 'IDEMPOTENCY_KEY_REUSED' } } })).toBe(true)
    expect(esFolioDeOtraOperacion({ response: { status: 409, data: { code: 'OTRA_COSA' } } })).toBe(false)
    expect(esFolioDeOtraOperacion({ code: 'ERR_NETWORK' })).toBe(false)
  })
})
