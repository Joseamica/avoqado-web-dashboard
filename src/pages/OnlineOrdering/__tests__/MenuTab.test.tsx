import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, o?: Record<string, unknown>) => (o ? `${key}|${Object.values(o).join(',')}` : key) }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'venue-1' }) }))
const toast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))

const getMenuCategories = vi.fn()
const getMenuProducts = vi.fn()
const setMenuAvailability = vi.fn()
vi.mock('@/services/onlineOrdering.service', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/onlineOrdering.service')>()
  return {
    ...actual,
    getMenuCategories: (...a: unknown[]) => getMenuCategories(...a),
    getMenuProducts: (...a: unknown[]) => getMenuProducts(...a),
    setMenuAvailability: (...a: unknown[]) => setMenuAvailability(...a),
  }
})

import { MenuTab } from '../components/MenuTab'

const summary = {
  categories: [
    { id: 'cat-1', name: 'Tacos', active: true, total: 10, online: 4, onlineWithoutPhoto: 1 },
    { id: 'cat-2', name: 'Bebidas', active: true, total: 5, online: 0, onlineWithoutPhoto: 0 },
  ],
  totals: { total: 15, online: 4, onlineWithoutPhoto: 1 },
  truncated: false,
}
const prod = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: `Producto ${id}`,
  price: 45,
  imageUrl: 'http://x/y.jpg',
  active: true,
  availableOnline: false,
  categoryId: 'cat-1',
  ...over,
})

const renderTab = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const spy = vi.spyOn(qc, 'invalidateQueries')
  render(
    <QueryClientProvider client={qc}>
      <MenuTab />
    </QueryClientProvider>,
  )
  return { spy }
}

describe('MenuTab', () => {
  beforeEach(() => {
    getMenuCategories.mockReset().mockResolvedValue(summary)
    getMenuProducts
      .mockReset()
      .mockResolvedValue({ items: [prod('p1'), prod('p2', { imageUrl: null, active: false })], nextCursor: null, total: 2 })
    setMenuAvailability.mockReset().mockResolvedValue({ updated: 1 })
    toast.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it('muestra los totales del servidor y online/total por categoría', async () => {
    renderTab()
    expect(await screen.findByText('menu.summary.online|4,15')).toBeInTheDocument()
    expect(screen.getByText('menu.summary.noPhoto|1')).toBeInTheDocument()
    expect(screen.getByText('menu.category.count|4,10')).toBeInTheDocument()
  })

  it('el interruptor de una categoría manda categoryIds e invalida categorías y productos', async () => {
    const { spy } = renderTab()
    await userEvent.click(await screen.findByRole('switch', { name: 'menu.category.toggle|Tacos' }))
    await waitFor(() => expect(setMenuAvailability).toHaveBeenCalledWith('venue-1', { availableOnline: true, categoryIds: ['cat-1'] }))
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
  })

  it('al elegir una categoría pide sus productos (limit 50), con foto/Sin foto/Inactivo', async () => {
    renderTab()
    await userEvent.click(await screen.findByText('Tacos'))
    await screen.findByText('Producto p1')
    expect(getMenuProducts).toHaveBeenCalledWith('venue-1', expect.objectContaining({ categoryId: 'cat-1', limit: 50 }))
    expect(screen.getByText('menu.product.noPhoto')).toBeInTheDocument()
    expect(screen.getByText('menu.product.inactive')).toBeInTheDocument()
  })

  it('el interruptor de un producto manda productIds e invalida', async () => {
    const { spy } = renderTab()
    await userEvent.click(await screen.findByText('Tacos'))
    await userEvent.click(await screen.findByRole('switch', { name: 'menu.product.toggle|Producto p1' }))
    await waitFor(() => expect(setMenuAvailability).toHaveBeenCalledWith('venue-1', { availableOnline: true, productIds: ['p1'] }))
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
  })

  it('un error del servidor sale en un toast', async () => {
    setMenuAvailability.mockRejectedValue({ response: { data: { error: 'No se pudo' } } })
    renderTab()
    await userEvent.click(await screen.findByText('Tacos'))
    await userEvent.click(await screen.findByRole('switch', { name: 'menu.product.toggle|Producto p1' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'No se pudo', variant: 'destructive' })))
  })

  it('«Cargar más» usa nextCursor', async () => {
    getMenuProducts
      .mockResolvedValueOnce({ items: [prod('p1')], nextCursor: 'c2', total: 2 })
      .mockResolvedValueOnce({ items: [prod('p2')], nextCursor: null, total: 2 })
    renderTab()
    await userEvent.click(await screen.findByText('Tacos'))
    await userEvent.click(await screen.findByRole('button', { name: 'menu.product.loadMore' }))
    await screen.findByText('Producto p2')
    expect(getMenuProducts).toHaveBeenLastCalledWith('venue-1', expect.objectContaining({ cursor: 'c2' }))
    expect(screen.getByText('Producto p1')).toBeInTheDocument()
  })

  it('la búsqueda consulta al servidor tras 300 ms y conserva el foco', async () => {
    renderTab()
    await userEvent.click(await screen.findByText('Tacos'))
    await screen.findByText('Producto p1')
    await userEvent.click(screen.getByRole('button', { name: 'menu.product.searchToggle' }))
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'pas' } })
    expect(getMenuProducts).not.toHaveBeenCalledWith('venue-1', expect.objectContaining({ search: 'pas' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    await waitFor(() =>
      expect(getMenuProducts).toHaveBeenCalledWith('venue-1', expect.objectContaining({ categoryId: 'cat-1', search: 'pas' })),
    )
    expect(screen.getByRole('textbox')).toHaveFocus()
  })

  it('«Mostrar todo el menú» confirma antes de llamar', async () => {
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'menu.bulk.showAll' }))
    expect(setMenuAvailability).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByRole('button', { name: 'menu.bulk.confirm' }))
    await waitFor(() => expect(setMenuAvailability).toHaveBeenCalledWith('venue-1', { availableOnline: true, allProducts: true }))
  })

  it('«Quitar todo de línea» confirma y manda availableOnline:false', async () => {
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'menu.bulk.hideAll' }))
    await userEvent.click(await screen.findByRole('button', { name: 'menu.bulk.confirm' }))
    await waitFor(() => expect(setMenuAvailability).toHaveBeenCalledWith('venue-1', { availableOnline: false, allProducts: true }))
  })
})
