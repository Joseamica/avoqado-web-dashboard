// src/hooks/__tests__/use-feature-price.test.tsx
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Component, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFeaturePrice } from '../use-feature-price'

const m = vi.hoisted(() => ({ features: vi.fn(), grid: vi.fn(), can: vi.fn() }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: m.can }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/services/features.service', () => ({ getVenueFeatures: (...a: unknown[]) => m.features(...a) }))
vi.mock('@/services/hybridBilling.service', () => ({ hybridBilling: { featureGrid: (...a: unknown[]) => m.grid(...a) } }))

/** UN cliente por prueba: `renderHook` llama al wrapper en cada render y un cliente nuevo perdería la caché. */
const envolver = () => {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
}
// La forma real del feature-grid (`FeatureGridOffer` de hybridBilling.service.ts).
const oferta = (codes: string[], price: number) => ({
  publicationId: 'pub_lista',
  campaignId: 'cmp_lista',
  name: 'Lista de precios',
  kind: 'FEATURES',
  planTier: null,
  price,
  renewal: 'SAME_PRICE',
  renewalPrice: null,
  promotionCycles: null,
  includedFeatureCodes: codes,
  listPrice: null,
})
const grid = (offer: unknown, listOffer: unknown = null) => ({ entries: [{ featureCode: 'SERVICE_PAY', offer, listOffer }] })
/** Lo que tumbaría la pantalla: un error al pintar el hook (el paywall nunca puede tirar la página que protege). */
const caidas: unknown[] = []
class Atrapa extends Component<{ children: ReactNode }, { caido: boolean }> {
  state = { caido: false }
  static getDerivedStateFromError() {
    return { caido: true }
  }
  componentDidCatch(e: unknown) {
    caidas.push(e)
  }
  render() {
    return this.state.caido ? null : this.props.children
  }
}
const envolverAtrapando = () => {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>
      <Atrapa>{children}</Atrapa>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  caidas.length = 0
  m.can.mockReturnValue(true)
  m.features.mockResolvedValue({ availableFeatures: [] }) // SERVICE_PAY no tiene fila `Feature` (C1a)
})

describe('useFeaturePrice — precio suelto de una función que sólo vende la lista comercial', () => {
  it('sin fila Feature, el precio sale de la oferta LIST del feature-grid que la vende sola', async () => {
    m.grid.mockResolvedValue(grid(oferta(['SERVICE_PAY'], 199)))
    const { result } = renderHook(() => useFeaturePrice('SERVICE_PAY'), { wrapper: envolver() })
    await waitFor(() => expect(result.current.price).toBe(199))
  })

  it('una oferta de varias funciones no es «contrátala sola»: vale la de lista que sí la vende sola', async () => {
    m.grid.mockResolvedValue(grid(oferta(['SERVICE_PAY', 'RESERVATIONS'], 299), oferta(['SERVICE_PAY'], 199)))
    const { result } = renderHook(() => useFeaturePrice('SERVICE_PAY'), { wrapper: envolver() })
    await waitFor(() => expect(result.current.price).toBe(199))
  })

  it('con las compras cerradas (`purchasesEnabled: false`, ofertas en null) no hay precio suelto: sólo «Incluido en Pro»', async () => {
    m.grid.mockResolvedValue({ purchasesEnabled: false, ...grid(null, null) })
    const { result } = renderHook(() => useFeaturePrice('SERVICE_PAY'), { wrapper: envolver() })
    await waitFor(() => expect(m.grid).toHaveBeenCalled())
    expect(result.current.price).toBeNull()
  })

  it('con fila Feature vendible manda ésa y no pide el feature-grid', async () => {
    m.features.mockResolvedValue({ availableFeatures: [{ code: 'SERVICE_PAY', monthlyPrice: 249, stripePriceId: 'price_x' }] })
    const { result } = renderHook(() => useFeaturePrice('SERVICE_PAY'), { wrapper: envolver() })
    await waitFor(() => expect(result.current.price).toBe(249))
    expect(m.grid).not.toHaveBeenCalled()
  })

  // E6a-fix F4: `?.` no protege de un valor que no es arreglo; el paywall tumbaba Reservations (6 pruebas rojas desde E3a).
  it('🔴 un feature-grid con `entries` que no es arreglo no tumba la pantalla: sin precio', async () => {
    m.grid.mockResolvedValue({ entries: { SERVICE_PAY: oferta(['SERVICE_PAY'], 199) } })
    const { result } = renderHook(() => useFeaturePrice('SERVICE_PAY'), { wrapper: envolverAtrapando() })
    await waitFor(() => expect(m.grid).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 20))
    expect(caidas).toEqual([])
    expect(result.current.price).toBeNull()
  })

  it('🔴 un catálogo con `availableFeatures` que no es arreglo no tumba la pantalla: se lee el feature-grid', async () => {
    m.features.mockResolvedValue({ availableFeatures: 'roto' })
    m.grid.mockResolvedValue(grid(oferta(['SERVICE_PAY'], 199)))
    const { result } = renderHook(() => useFeaturePrice('SERVICE_PAY'), { wrapper: envolverAtrapando() })
    await waitFor(() => expect(m.features).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 20))
    expect(caidas).toEqual([])
    await waitFor(() => expect(result.current.price).toBe(199))
  })

  it('sin permiso de ver precios no pide nada y no hay precio', async () => {
    m.can.mockReturnValue(false)
    const { result } = renderHook(() => useFeaturePrice('SERVICE_PAY'), { wrapper: envolver() })
    await new Promise(r => setTimeout(r, 0))
    expect(result.current.price).toBeNull()
    expect(m.features).not.toHaveBeenCalled()
    expect(m.grid).not.toHaveBeenCalled()
  })
})
