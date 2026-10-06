import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import { RoutingTab } from '../RoutingTab'
import { ProbarRuteoModal } from '../RoutingSimulator'
const h = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  preview: vi.fn(),
  fail: false,
  assignedCategories: {} as Record<string, string | null>,
  assignedProducts: {} as Record<string, string | null>,
}))
vi.mock('@/services/printStations.service', async original => ({
  ...(await original<typeof import('@/services/printStations.service')>()),
  getRouting: (...args: unknown[]) => h.get(...args),
  getPrintStations: () => Promise.resolve([{ id: 's1', name: 'Cocina', active: true }]),
  updateRouting: (...args: unknown[]) => h.save(...args),
  previewRouting: (...args: unknown[]) => h.preview(...args),
}))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useTierFeatureAccess: () => ({ hasAccess: true }) }))
vi.mock('@/hooks/use-terminology', () => ({ useTerminology: () => ({ term: (k: string) => k }) }))
beforeAll(async () => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.scrollIntoView = () => {}
  await i18n.changeLanguage('es')
})
beforeEach(() => {
  h.fail = false
  h.assignedCategories = {}
  h.assignedProducts = {}
  h.get.mockReset().mockImplementation((_venue, query) => {
    if (!query?.section) throw new Error('legacy catalog requested')
    if (h.fail) return Promise.reject(new Error('network'))
    const page = query.page ?? 1
    const category = {
      id: page === 1 ? 'c1' : 'c2',
      name: page === 1 ? 'Bebidas' : 'Comidas',
      printStationId: h.assignedCategories[page === 1 ? 'c1' : 'c2'] ?? null,
      productCount: 2,
    }
    const product = {
      id: query.search ? 'p3' : page === 1 ? 'p1' : 'p2',
      name: query.search ? 'Pan' : page === 1 ? 'Café' : 'Té',
      printStationId: null,
      categoryId: 'c1',
    }
    return Promise.resolve({
      categories: query.section === 'categories' ? [category] : [],
      products: query.section === 'products' ? [product] : [],
      hasDefault: true,
      unroutedCategories: 0,
      pagination: { page, pageSize: 50, total: 51, totalPages: 2 },
    })
  })
  h.save.mockReset().mockImplementation((_venue, body) => {
    for (const entry of body.categories ?? []) h.assignedCategories[entry.id] = entry.printStationId
    for (const entry of body.products ?? []) h.assignedProducts[entry.id] = entry.printStationId
    return Promise.resolve({ categoriesUpdated: 1, productsUpdated: 1 })
  })
  h.preview.mockReset().mockResolvedValue({ plans: [], unrouted: false })
})
function mount(venue = 'v1', modal = false) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const tree = (id: string) => (
    <QueryClientProvider client={qc}>
      {modal ? <ProbarRuteoModal venueId={id} stations={[]} onClose={() => {}} /> : <RoutingTab venueId={id} />}
    </QueryClientProvider>
  )
  return { ...render(tree(venue)), changeVenue: (id: string) => tree(id), qc }
}
async function chooseStation(row: HTMLElement) {
  await userEvent.click(within(row).getByRole('combobox'))
  await userEvent.click(screen.getByRole('option', { name: 'Cocina' }))
}
describe('CFG02 routing pages through real UI', () => {
  it('requests only categories on mount; expanded category lazily fetches products and exposes totals/pages', async () => {
    mount()
    await screen.findByText('Bebidas')
    expect(h.get).toHaveBeenCalledWith('v1', expect.objectContaining({ section: 'categories', page: 1 }))
    expect(h.get.mock.calls.some(([, q]) => q.section === 'products')).toBe(false)
    expect(screen.getByText('51 categorías')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ver productos' }))
    expect(await screen.findByText('Café')).toBeInTheDocument()
    expect(h.get).toHaveBeenCalledWith('v1', expect.objectContaining({ section: 'products', categoryId: 'c1', page: 1 }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente página de productos' }))
    expect(await screen.findByText('Té')).toBeInTheDocument()
  })
  it('saves category and product drafts outside current page and refreshes every routing variant', async () => {
    const { qc } = mount()
    const invalidation = vi.spyOn(qc, 'invalidateQueries')
    await screen.findByText('Bebidas')
    await chooseStation(screen.getByTestId('routing-category-c1'))
    await userEvent.click(screen.getByRole('button', { name: 'Ver productos' }))
    await screen.findByText('Café')
    await chooseStation(screen.getByTestId('routing-product-p1'))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente página de categorías' }))
    await screen.findByText('Comidas')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ruteo' }))
    await waitFor(() =>
      expect(h.save).toHaveBeenCalledWith('v1', {
        categories: [{ id: 'c1', printStationId: 's1' }],
        products: [{ id: 'p1', printStationId: 's1' }],
      }),
    )
    expect(invalidation).toHaveBeenCalledWith({ queryKey: ['printRouting', 'v1'] })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar ruteo' })).toBeDisabled())
    await userEvent.click(screen.getByRole('button', { name: 'Página anterior de categorías' }))
    await screen.findByText('Bebidas')
    await waitFor(() => expect(within(screen.getByTestId('routing-category-c1')).getByRole('combobox')).toHaveTextContent('Cocina'))
  })
  it('debounced search resets page, keeps focus and drafts; venue change clears them', async () => {
    const view = mount()
    await screen.findByText('Bebidas')
    await chooseStation(screen.getByTestId('routing-category-c1'))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente página de categorías' }))
    await screen.findByText('Comidas')
    const search = screen.getByRole('textbox', { name: 'Buscar categorías' })
    await userEvent.type(search, 'Beb')
    await waitFor(() => expect(h.get).toHaveBeenCalledWith('v1', expect.objectContaining({ page: 1, search: 'Beb' })))
    expect(search).toHaveFocus()
    expect(search).toHaveValue('Beb')
    expect(screen.getByRole('button', { name: 'Guardar ruteo' })).toBeEnabled()
    view.rerender(view.changeVenue('v2'))
    await waitFor(() => expect(h.get).toHaveBeenCalledWith('v2', expect.objectContaining({ page: 1 })))
    expect(screen.getByRole('button', { name: 'Guardar ruteo' })).toBeDisabled()
  })
  it('modal never downloads products until selector opens; selection survives a different search and preview keeps payload', async () => {
    mount('v1', true)
    expect(await screen.findByText('Simular una comanda')).toBeInTheDocument()
    expect(h.get).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Agregar producto' }))
    const search = screen.getByRole('combobox', { name: 'Producto 1' })
    await userEvent.click(search)
    await userEvent.click(await screen.findByRole('option', { name: 'Café' }))
    expect(screen.getByText('Seleccionado: Café')).toBeInTheDocument()
    await userEvent.clear(search)
    await userEvent.type(search, 'Pan')
    await waitFor(() => expect(h.get).toHaveBeenCalledWith('v1', expect.objectContaining({ section: 'products', search: 'Pan' })))
    expect(screen.getByText('Seleccionado: Café')).toBeInTheDocument()
    const more = await screen.findByRole('button', { name: 'Cargar más' })
    expect(more).toBeVisible()
    await userEvent.click(more)
    await waitFor(() => expect(h.get).toHaveBeenCalledWith('v1', expect.objectContaining({ section: 'products', search: 'Pan', page: 2 })))
    expect(screen.getByText('Seleccionado: Café')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Simular' }))
    await waitFor(() => expect(h.preview).toHaveBeenCalledWith('v1', { items: [{ productId: 'p1', quantity: 1 }] }))
  })
  it('load failures stay visible with retry and search mounted', async () => {
    h.fail = true
    mount()
    expect(await screen.findByText('No se pudo cargar el ruteo', {}, { timeout: 3500 })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Buscar categorías' })).toBeInTheDocument()
    h.fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Bebidas')).toBeInTheDocument()
  })
  it('distinguishes an empty category catalog from a search without matches', async () => {
    h.get.mockImplementation(() =>
      Promise.resolve({
        categories: [],
        products: [],
        hasDefault: true,
        unroutedCategories: 0,
        pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
      }),
    )
    mount()
    expect(await screen.findByText(/Aún no hay categorías/)).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar categorías' }), 'zzzz')
    expect(await screen.findByText('Sin resultados para esta búsqueda')).toBeInTheDocument()
    expect(screen.queryByText(/Aún no hay categorías/)).not.toBeInTheDocument()
  })
  it('shows lazy product failures with retry and keeps category draft', async () => {
    const original = h.get.getMockImplementation()!
    let failed = true
    h.get.mockImplementation((venue, query) =>
      query.section === 'products' && failed ? Promise.reject(new Error('products network')) : original(venue, query),
    )
    mount()
    await screen.findByText('Bebidas')
    await chooseStation(screen.getByTestId('routing-category-c1'))
    await userEvent.click(screen.getByRole('button', { name: 'Ver productos' }))
    expect(await screen.findByText('No se pudo cargar el ruteo', {}, { timeout: 3500 })).toBeInTheDocument()
    failed = false
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Café')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar ruteo' })).toBeEnabled()
  })
  it('arrows and Enter select a real product and preview receives its id', async () => {
    mount('v1', true)
    await userEvent.click(screen.getByRole('button', { name: 'Agregar producto' }))
    const input = screen.getByLabelText('Producto 1')
    await userEvent.click(input)
    await screen.findByRole('option', { name: 'Café' })
    await userEvent.keyboard('{ArrowDown}{ArrowUp}{Enter}')
    expect(screen.getByText('Seleccionado: Café')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Simular' }))
    await waitFor(() => expect(h.preview).toHaveBeenCalledWith('v1', { items: [{ productId: 'p1', quantity: 1 }] }))
  })
  it('keeps focus after opening and arrows, searches typed text and previews the searched product id', async () => {
    mount('v1', true)
    await userEvent.click(screen.getByRole('button', { name: 'Agregar producto' }))
    const input = screen.getByLabelText('Producto 1')
    await userEvent.click(input)
    await screen.findByRole('option', { name: 'Café' })
    expect(input).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(input).toHaveFocus()
    await userEvent.keyboard('pan')
    expect(input).toHaveValue('pan')
    await waitFor(() => expect(h.get).toHaveBeenCalledWith('v1', expect.objectContaining({ section: 'products', search: 'pan' })))
    await screen.findByRole('option', { name: 'Pan' })
    expect(input).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(screen.getByText('Seleccionado: Pan')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Simular' }))
    await waitFor(() => expect(h.preview).toHaveBeenCalledWith('v1', { items: [{ productId: 'p3', quantity: 1 }] }))
  })
  it('long product labels survive reopening with a valid search, visible retry and unchanged preview id', async () => {
    const name = 'Café ' + 'a'.repeat(120)
    let networkDown = false
    h.get.mockImplementation((_venue, query) => {
      if (query.search?.length > 100) return Promise.reject({ response: { status: 400 } })
      if (networkDown) return Promise.reject(new Error('network'))
      return Promise.resolve({
        categories: [],
        products: [{ id: 'long1', name, categoryId: null, printStationId: null }],
        hasDefault: true,
        unroutedCategories: 0,
        pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
      })
    })
    const { qc } = mount('v1', true)
    await userEvent.click(screen.getByRole('button', { name: 'Agregar producto' }))
    const input = screen.getByLabelText('Producto 1')
    await userEvent.click(input)
    await userEvent.click(await screen.findByRole('option', { name }))
    expect(screen.getByText(`Seleccionado: ${name}`)).toBeInTheDocument()
    await new Promise(resolve => setTimeout(resolve, 350))
    networkDown = true
    await qc.invalidateQueries({ queryKey: ['printRouting', 'v1'] })
    await userEvent.click(input)
    expect(await screen.findByText('No se pudo cargar el ruteo', {}, { timeout: 3500 })).toBeInTheDocument()
    expect(h.get.mock.calls.every(([, query]) => (query.search?.length ?? 0) <= 100)).toBe(true)
    expect(input.getAttribute('value')?.length ?? 0).toBeLessThanOrEqual(100)
    networkDown = false
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('option', { name })).toBeInTheDocument()
    expect(screen.getByText(`Seleccionado: ${name}`)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Simular' }))
    await waitFor(() => expect(h.preview).toHaveBeenCalledWith('v1', { items: [{ productId: 'long1', quantity: 1 }] }))
  })
})
