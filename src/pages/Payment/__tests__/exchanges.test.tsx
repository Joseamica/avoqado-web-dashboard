import { Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useRoutes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import reports from '@/locales/es/reports.json'
import payment from '@/locales/es/payment.json'
import Exchanges from '../Exchanges'
import { createVenueRoutes } from '@/routes/venueRoutes'

const m = vi.hoisted(() => ({ get: vi.fn(), permissions: ['payments:read'] }))
vi.mock('@/api', () => ({ default: { get: (...args: unknown[]) => m.get(...args) } }))
vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({ can: (p: string) => m.permissions.includes(p), isLoading: false, role: 'MANAGER' }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/wl/venues/iq' }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDateTime: (v: string) => v }) }))
vi.mock('react-i18next', () => ({
  useTranslation: (ns: string) => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const raw = key.split('.').reduce<any>((obj, part) => obj?.[part], ns === 'payment' ? payment : reports)
      return typeof raw === 'string' ? raw.replace(/\{\{(\w+)\}\}/g, (_, p) => String(opts?.[p] ?? '')) : key
    },
    i18n: { language: 'es' },
  }),
}))
const originalOrderId = 'c1234567890123456789012345'
const item = (id: string) => ({
  id,
  status: 'COMPLETED',
  createdAt: '2026-10-26',
  originalOrderId,
  newOrderId: 'o2',
  originalOrderNumber: 'ORD-001',
  newOrderNumber: `ORD-${id}`,
  staffName: null,
  differenceCents: 0,
  reviewReason: null,
  reviewedAt: null,
})
const page = (ids = ['x1'], nextCursor: string | null = null) => ({ data: { data: { items: ids.map(item), total: 51, nextCursor } } })
function Routes() {
  return useRoutes([{ path: '/wl/venues/iq', children: createVenueRoutes() }])
}
function mount(route = `/wl/venues/iq/payments/exchanges?order=${originalOrderId}`, actualRoutes = false) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })}>
        <Suspense fallback={null}>{actualRoutes ? <Routes /> : <Exchanges />}</Suspense>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}
beforeEach(() => {
  m.permissions = ['payments:read']
  m.get.mockResolvedValue(page())
})
describe('Exchanges page', () => {
  it('is reachable through the shared venue routes with payments:read without reports:read', async () => {
    mount(undefined, true)
    expect(await screen.findByRole('heading', { level: 1, name: 'Cambios' })).toBeVisible()
    expect(m.get).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/exchanges', {
      params: { pendingReview: false, originalOrderId, limit: 25 },
    })
    expect(await screen.findByRole('link', { name: 'ORD-001 → ORD-x1' })).toHaveAttribute('href', `/wl/venues/iq/orders/${originalOrderId}`)
  })
  it('does not fetch or show exchanges through the actual route without payments:read', async () => {
    m.permissions = []
    mount(undefined, true)
    await screen.findByText('routeProtection.accessDenied')
    expect(m.get).not.toHaveBeenCalled()
  })
  it('starts with pending reviews without an order, switches on the server and resets the cursor', async () => {
    m.get.mockResolvedValueOnce(page(['x1'], 'first-cursor')).mockResolvedValueOnce(page(['x2']))
    mount('/wl/venues/iq/payments/exchanges')
    fireEvent.click(await screen.findByRole('button', { name: 'Cargar más' }))
    await screen.findByText('ORD-001 → ORD-x2')
    fireEvent.click(screen.getByRole('button', { name: /Estado.*Por revisar/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }))
    await waitFor(() => expect(m.get.mock.lastCall?.[1].params).toEqual({ pendingReview: false, limit: 25 }))
    expect(m.get.mock.calls[1][1].params.cursor).toBe('first-cursor')
  })
  it('can reach all 51 exchanges for the overflow order and clear the order filter', async () => {
    m.get
      .mockResolvedValueOnce(
        page(
          Array.from({ length: 25 }, (_, i) => `x${i}`),
          'page2',
        ),
      )
      .mockResolvedValueOnce(
        page(
          Array.from({ length: 25 }, (_, i) => `x${i + 25}`),
          'page3',
        ),
      )
      .mockResolvedValueOnce(page(['x50']))
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Cargar más' }))
    await screen.findByText('Mostrando 50 de 51')
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }))
    expect(await screen.findByText('Mostrando 51 de 51')).toBeVisible()
    expect(screen.getByText('ORD-001 → ORD-x50')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtro de venta' }))
    await waitFor(() => expect(m.get.mock.lastCall?.[1].params).toEqual({ pendingReview: false, limit: 25 }))
  })
})
