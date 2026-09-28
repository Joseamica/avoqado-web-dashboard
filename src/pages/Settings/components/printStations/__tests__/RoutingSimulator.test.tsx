import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import type { PrintStation } from '@/services/printStations.service'
import { ProbarRuteoModal } from '../RoutingSimulator'

const h = vi.hoisted(() => ({ products: [] as { id: string; name: string; categoryId: string | null; printStationId: string | null }[] }))

vi.mock('@/services/printStations.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/printStations.service')>()),
  getRouting: () => Promise.resolve({ categories: [], products: h.products, unroutedCategories: 0, hasDefault: true }),
}))
vi.mock('@/hooks/use-tier-feature-access', () => ({
  useTierFeatureAccess: () => ({ hasAccess: true, requiredTier: 'PRO', isLoading: false, isResolved: true }),
}))
vi.mock('@/hooks/use-terminology', () => ({ useTerminology: () => ({ term: (k: string) => k }) }))

beforeAll(async () => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
  await i18n.changeLanguage('es')
})
beforeEach(() => {
  h.products = [{ id: 'pr1', name: 'Taco', categoryId: 'c1', printStationId: null }]
})

const estaciones: PrintStation[] = []

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ProbarRuteoModal venueId="v1" stations={estaciones} onClose={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ProbarRuteoModal', () => {
  it('abre el simulador de la pestaña Ruteo con los productos del menú', async () => {
    pintar()
    expect(await screen.findByText('Simular una comanda')).toBeInTheDocument()
    // FullScreenModal repite el título en un <h2> y en su descripción sr-only (mismo gotcha de la Task 3):
    // se apunta al heading para no ambigüar entre los dos nodos con el mismo texto.
    expect(screen.getByRole('heading', { name: '¿A dónde va cada comanda?' })).toBeInTheDocument()
  })

  it('sin productos en el menú lo dice en vez de un simulador vacío', async () => {
    h.products = []
    pintar()
    expect(await screen.findByText(/Aún no hay categorías/)).toBeInTheDocument()
  })
})
