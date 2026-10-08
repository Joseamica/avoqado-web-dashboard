import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import type { PrintStation } from '@/services/printStations.service'
import { ProbarRuteoModal } from '../RoutingSimulator'

const h = vi.hoisted(() => ({
  products: [] as { id: string; name: string; categoryId: string | null; printStationId: string | null }[],
  preview: vi.fn(),
}))

vi.mock('@/services/printStations.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/printStations.service')>()),
  getRouting: () => Promise.resolve({ categories: [], products: h.products, unroutedCategories: 0, hasDefault: true }),
  previewRouting: h.preview,
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
  h.preview.mockResolvedValue({ plans: [], unrouted: false })
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

  it('sin productos lo dice al abrir el selector, sin cargar catálogo al montar', async () => {
    h.products = []
    pintar()
    await userEvent.click(screen.getByRole('button', { name: 'Agregar producto' }))
    await userEvent.click(screen.getByRole('combobox', { name: 'Producto 1' }))
    expect(await screen.findByText('Aún no hay productos')).toBeInTheDocument()
  })

  it('al quitar la primera fila conserva filtro, selección y cantidad de la segunda para simular', async () => {
    h.products.push({ id: 'pr2', name: 'Agua', categoryId: 'c1', printStationId: null })
    const user = userEvent.setup()
    pintar()
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }))
    const first = screen.getByRole('combobox', { name: 'Producto 1' })
    await user.click(first)
    await user.click(await screen.findByRole('option', { name: 'Taco' }))
    await user.clear(screen.getByRole('spinbutton', { name: 'Cantidad' }))
    await user.type(screen.getByRole('spinbutton', { name: 'Cantidad' }), '2')

    await user.click(screen.getByRole('button', { name: 'Agregar producto' }))
    const second = screen.getByRole('combobox', { name: 'Producto 2' })
    await user.click(second)
    await user.click(await screen.findByRole('option', { name: 'Agua' }))
    const quantities = screen.getAllByRole('spinbutton', { name: 'Cantidad' })
    await user.clear(quantities[1])
    await user.type(quantities[1], '7')
    await user.type(first, 'filtro taco')
    await user.type(second, 'filtro agua')
    await user.click(quantities[1])
    expect(first).toHaveValue('filtro taco')
    expect(second).toHaveValue('filtro agua')
    expect(screen.getByText('Seleccionado: Taco')).toBeInTheDocument()
    expect(screen.getByText('Seleccionado: Agua')).toBeInTheDocument()
    expect(quantities[0]).toHaveValue(2)
    expect(quantities[1]).toHaveValue(7)

    await user.click(screen.getByRole('button', { name: 'Quitar producto 1' }))
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
    expect(screen.getByRole('combobox', { name: 'Producto 1' })).toHaveValue('filtro agua')
    expect(screen.queryByText('Seleccionado: Taco')).not.toBeInTheDocument()
    expect(screen.getByText('Seleccionado: Agua')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Cantidad' })).toHaveValue(7)
    await user.click(screen.getByRole('button', { name: 'Simular' }))
    await waitFor(() => expect(h.preview).toHaveBeenCalledWith('v1', { items: [{ productId: 'pr2', quantity: 7 }] }))
  })
})
