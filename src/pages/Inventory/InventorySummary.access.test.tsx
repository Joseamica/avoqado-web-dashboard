import { act, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import InventorySummary from './InventorySummary'

const mocks = vi.hoisted(() => ({
  access: { hasAccess: false, isLoading: false },
  products: vi.fn(),
  materials: vi.fn(),
}))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useTierFeatureAccess: () => mocks.access }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/cafe' }) }))
vi.mock('@/hooks/useStockAdjustmentTour', () => ({ useStockAdjustmentTour: () => ({ start: vi.fn() }) }))
vi.mock('@/hooks/useInventoryWelcomeTour', () => ({ useInventoryWelcomeTour: () => ({ start: vi.fn() }) }))
vi.mock('@/hooks/use-unit-translation', () => ({ useUnitTranslation: () => ({ getShortLabel: (unit: string) => unit }) }))
vi.mock('@/components/data-table', () => ({ default: ({ isLoading }: { isLoading: boolean }) => <div data-testid="stock-loading">{String(isLoading)}</div> }))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: { children: ReactNode }) => children }))
vi.mock('./components/InventoryLabelModal', () => ({ InventoryLabelModal: () => null }))
vi.mock('./components/AdjustStockDialog', () => ({ AdjustStockDialog: () => null }))
vi.mock('@/services/menu.service', () => ({ getProducts: (...args: unknown[]) => mocks.products(...args) }))
vi.mock('@/services/inventory.service', async importOriginal => ({
  ...await importOriginal<typeof import('@/services/inventory.service')>(),
  rawMaterialsApi: { getAll: (...args: unknown[]) => mocks.materials(...args) },
}))

function renderSummary() {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0, gcTime: 0 } } })
  const view = () => <QueryClientProvider client={client}><MemoryRouter><InventorySummary /></MemoryRouter></QueryClientProvider>
  const result = render(view())
  return { client, rerender: () => result.rerender(view()) }
}

beforeEach(() => {
  mocks.access = { hasAccess: false, isLoading: false }
  mocks.products.mockResolvedValue([])
  mocks.materials.mockResolvedValue({ data: [] })
})

describe('InventorySummary access', () => {
  it('does not fetch behind the paywall or while access loads; fetches when access is granted', async () => {
    const { client, rerender } = renderSummary()
    await act(async () => {})
    expect(mocks.products).not.toHaveBeenCalled()
    expect(mocks.materials).not.toHaveBeenCalled()

    mocks.access = { hasAccess: true, isLoading: true }
    rerender()
    await act(async () => {})
    expect(screen.getByTestId('stock-loading')).toHaveTextContent('true')
    expect(mocks.products).not.toHaveBeenCalled()
    expect(mocks.materials).not.toHaveBeenCalled()

    mocks.access = { hasAccess: true, isLoading: false }
    rerender()
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(mocks.products).toHaveBeenCalledTimes(1)
    expect(mocks.materials).toHaveBeenCalledTimes(1)
    client.clear()
  })

  it.each([401, 403])('does not retry when the backend returns %i', async status => {
    mocks.access = { hasAccess: true, isLoading: false }
    mocks.products.mockRejectedValue({ response: { status } })
    mocks.materials.mockRejectedValue({ response: { status } })
    const { client } = renderSummary()
    await waitFor(() => expect(client.getQueryCache().getAll().every(query => query.state.status === 'error')).toBe(true))
    expect(mocks.products).toHaveBeenCalledTimes(1)
    expect(mocks.materials).toHaveBeenCalledTimes(1)
    client.clear()
  })
})
