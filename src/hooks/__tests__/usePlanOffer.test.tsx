import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'

const get = vi.hoisted(() => vi.fn())
vi.mock('@/api', () => ({ default: {}, publicApi: { get } }))

import { useNombreDelPlan, useNombresDelPlan, usePlanOffer } from '../usePlanOffer'

const precio = { netCents: 100, grossCents: 116 }
const plan = (displayName: string) => ({ displayName, onSale: true, requiresCard: true, trialDays: 5, monthly: precio, annual: precio })
const oferta = (offerVersion: number | null, pro = 'Pro') => ({
  success: true,
  data: { offerVersion, FREE: { displayName: 'Gratis' }, PRO: plan(pro), PREMIUM: plan('Premium') },
})

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient()
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('usePlanOffer', () => {
  beforeEach(() => {
    get.mockReset()
    void i18n.changeLanguage('es')
  })

  it('200 con la v2: servidor con el nombre del editor', async () => {
    get.mockResolvedValue({ data: oferta(2, 'Plus') })
    const { result } = renderHook(() => usePlanOffer(), { wrapper })
    expect(result.current.estado).toBe('cargando')
    await waitFor(() => expect(result.current.estado).toBe('servidor'))
    expect(result.current).toMatchObject({ offerVersion: 2, PRO: { displayName: 'Plus' } })
  })

  it('200 con la v1: offerVersion null', async () => {
    get.mockResolvedValue({ data: oferta(null) })
    const { result } = renderHook(() => usePlanOffer(), { wrapper })
    await waitFor(() => expect(result.current.estado).toBe('servidor'))
    expect(result.current).toMatchObject({ offerVersion: null })
  })

  it.each([404, 503, 'red'])('error %s: sinDato', async codigo => {
    get.mockRejectedValue(codigo === 'red' ? new Error('Network Error') : { response: { status: codigo } })
    const { result } = renderHook(() => usePlanOffer(), { wrapper })
    await waitFor(() => expect(result.current.estado).toBe('sinDato'), { timeout: 4000 })
  })
})

describe('useNombreDelPlan', () => {
  it('v1 e inglés: «Free», no «Gratis»', async () => {
    await i18n.changeLanguage('en')
    get.mockResolvedValue({ data: oferta(null) })
    const { result } = renderHook(() => useNombreDelPlan('FREE'), { wrapper })
    await waitFor(() => expect(get).toHaveBeenCalled())
    expect(result.current).toBe('Free')
  })

  it('v2 «Plus»: el nombre del editor', async () => {
    get.mockResolvedValue({ data: oferta(2, 'Plus') })
    const { result } = renderHook(() => useNombreDelPlan('PRO'), { wrapper })
    await waitFor(() => expect(result.current).toBe('Plus'))
  })

  it('sin datos: el nombre localizado', async () => {
    await i18n.changeLanguage('es')
    get.mockImplementation(() => Promise.reject(new Error('Network Error')))
    const { result } = renderHook(() => ({ n: useNombreDelPlan('PREMIUM'), ...usePlanOffer() }), { wrapper })
    await waitFor(() => expect(result.current.estado).toBe('sinDato'), { timeout: 4000 })
    expect(result.current.n).toBe('Premium')
  })

  it('M5: un nivel desconocido cae al nombre localizado en vez de tronar (aunque haya v2)', async () => {
    get.mockResolvedValue({ data: oferta(2, 'Plus') })
    const { result } = renderHook(() => ({ oferta: usePlanOffer(), nombre: useNombresDelPlan() }), { wrapper })
    await waitFor(() => expect(result.current.oferta.estado).toBe('servidor'))
    expect(() => result.current.nombre('GRATIS')).not.toThrow()
    expect(result.current.nombre('PRO')).toBe('Plus')
  })
})
