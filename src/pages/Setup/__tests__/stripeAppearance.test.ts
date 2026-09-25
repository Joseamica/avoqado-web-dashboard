/**
 * El formulario de tarjeta (iframe de Stripe) sigue el tema del dashboard: sin esto se pintaba un
 * bloque blanco en medio del alta en modo oscuro.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PALETA_DE_RESPALDO, aparienciaDeTarjeta, useAparienciaDeTarjeta } from '../offer/stripeAppearance'

afterEach(() => document.documentElement.classList.remove('dark'))

describe('aparienciaDeTarjeta', () => {
  it('modo oscuro ⇒ tema night con el fondo y el texto del dashboard', () => {
    const a = aparienciaDeTarjeta(PALETA_DE_RESPALDO.oscuro, true)
    expect(a.theme).toBe('night')
    expect(a.variables?.colorBackground).toBe(PALETA_DE_RESPALDO.oscuro.fondo)
    expect(a.variables?.colorText).toBe(PALETA_DE_RESPALDO.oscuro.texto)
  })

  it('modo claro ⇒ tema stripe, con la tipografía del dashboard', () => {
    const a = aparienciaDeTarjeta(PALETA_DE_RESPALDO.claro, false)
    expect(a.theme).toBe('stripe')
    expect(a.variables?.fontFamily).toMatch(/Geist/)
  })

  it('el foco lleva un anillo del color del token --ring, no el azul de Stripe', () => {
    const a = aparienciaDeTarjeta({ ...PALETA_DE_RESPALDO.claro, anillo: '#112233' }, false)
    expect(a.rules?.['.Input:focus']?.boxShadow).toContain('rgba(17, 34, 51')
  })
})

describe('useAparienciaDeTarjeta', () => {
  it('🔴 sigue la clase dark del <html>, también si el tema cambia con la pantalla abierta', async () => {
    const { result } = renderHook(() => useAparienciaDeTarjeta())
    expect(result.current.theme).toBe('stripe')

    await act(async () => {
      document.documentElement.classList.add('dark')
      await Promise.resolve()
    })
    expect(result.current.theme).toBe('night')

    await act(async () => {
      document.documentElement.classList.remove('dark')
      await Promise.resolve()
    })
    expect(result.current.theme).toBe('stripe')
  })
})
