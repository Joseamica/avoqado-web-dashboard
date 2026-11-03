/** Cuentas por cobrar: una lista que ya estaba vacía no puede tapar el fallo de la recarga con su «sin pendientes» (Codex r1). */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configure, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PayLaterAging from '../PayLaterAging'

const m = vi.hoisted(() => {
  const t = (k: string) => k
  return { get: vi.fn(), i18n: { t, i18n: { language: 'es' } } }
})
vi.mock('@/api', () => ({ default: { get: (...a: unknown[]) => m.get(...a), post: vi.fn() } }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (v: string) => v }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => m.i18n }))

vi.setConfig({ testTimeout: 30_000 })
configure({ asyncUtilTimeout: 10_000 })

const vacio = {
  data: {
    success: true,
    data: {
      summary: {
        aging_0_30_total: 0,
        aging_0_30_count: 0,
        aging_31_60_total: 0,
        aging_31_60_count: 0,
        aging_61_90_total: 0,
        aging_61_90_count: 0,
        aging_90_plus_total: 0,
        aging_90_plus_count: 0,
        total_balance: 0,
        total_count: 0,
      },
      orders: { aging_0_30: [], aging_31_60: [], aging_61_90: [], aging_90_plus: [] },
    },
  },
}

let client: QueryClient
function montar() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PayLaterAging />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => client?.clear())

describe('Cuentas por cobrar si falla la carga', () => {
  it('sin pendientes de verdad, celebra y no avisa', async () => {
    m.get.mockResolvedValue(vacio)
    montar()

    expect(await screen.findByText('payLaterAging.empty.title')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('si falla la primera carga avisa, sin celebrar', async () => {
    m.get.mockRejectedValue({ response: { status: 500 } })
    montar()

    expect(await screen.findByRole('alert')).toHaveTextContent('loadFailure.empty')
    expect(screen.queryByText('payLaterAging.empty.title')).not.toBeInTheDocument()
  })

  it('si la lista estaba vacía y falla la recarga, avisa en vez de seguir celebrando', async () => {
    m.get.mockResolvedValue(vacio)
    montar()
    await screen.findByText('payLaterAging.empty.title')

    m.get.mockRejectedValue({ response: { status: 500 } })
    void client.invalidateQueries()

    expect(await screen.findByRole('alert')).toHaveTextContent('loadFailure.empty')
    expect(screen.queryByText('payLaterAging.empty.title')).not.toBeInTheDocument()
  })
})
