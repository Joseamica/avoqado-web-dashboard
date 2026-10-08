import { Suspense } from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isChunkLoadError, lazyWithRetry, reloadForChunkError } from '../lazyWithRetry'

afterEach(() => sessionStorage.clear())

describe('reloadForChunkError', () => {
  it('recarga una vez y no vuelve a recargar antes de 30 s', () => {
    const reload = vi.fn()
    const t0 = 1_000_000

    expect(reloadForChunkError(reload, t0)).toBe(true)
    expect(reloadForChunkError(reload, t0 + 5_000)).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)

    // Un deploy posterior, ya fuera de la ventana, sí vuelve a recargar.
    expect(reloadForChunkError(reload, t0 + 31_000)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('🔴 que otra pantalla cargue bien NO reabre la ventana (era el bucle de dashboardv2, 8-oct)', async () => {
    const reload = vi.fn()
    const t0 = Date.now()
    reloadForChunkError(reload, t0)

    // Tras la recarga, el menú (otra pieza diferida) carga bien...
    const Menu = lazyWithRetry(async () => ({ default: () => <p>menú</p> }))
    render(
      <Suspense fallback={null}>
        <Menu />
      </Suspense>,
    )
    await screen.findByText('menú')

    // ...y Pagos vuelve a fallar: no debe recargar otra vez.
    expect(reloadForChunkError(reload, t0 + 3_000)).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('sin sessionStorage no recarga, porque no podría frenar el bucle', () => {
    const reload = vi.fn()
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    expect(reloadForChunkError(reload, Date.now())).toBe(false)
    expect(reload).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('isChunkLoadError', () => {
  it('reconoce errores de pieza faltante, en Error o en el error de ruta', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/x.js'))).toBe(true)
    expect(isChunkLoadError(new SyntaxError("Unexpected token '<'"))).toBe(true)
    expect(isChunkLoadError({ statusText: 'Loading chunk 12 failed' })).toBe(true)
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(isChunkLoadError(null)).toBe(false)
  })
})
