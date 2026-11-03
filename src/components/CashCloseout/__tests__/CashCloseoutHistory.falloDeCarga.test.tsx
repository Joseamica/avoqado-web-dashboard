/** Historial de cortes de caja: si falla la carga no es que no haya cortes, y una página que falla no puede dejarte atorado (Codex r0). */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configure, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const t = (k: string) => k
  return { historial: vi.fn(), i18n: { t, i18n: { language: 'es' } } }
})
vi.mock('react-i18next', () => ({ useTranslation: () => mocks.i18n }))
vi.mock('@/services/cashCloseout.service', () => ({ getCloseoutHistory: (...a: unknown[]) => mocks.historial(...a) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: () => 'hoy', formatDateTime: () => 'hoy', venueTimezone: 'America/Mexico_City' }) }))

import { CashCloseoutHistory } from '../CashCloseoutHistory'

vi.setConfig({ testTimeout: 30_000 })
configure({ asyncUtilTimeout: 10_000 })

const corte = {
  id: 'c1',
  periodStart: '2026-11-01T00:00:00Z',
  periodEnd: '2026-11-02T00:00:00Z',
  createdAt: '2026-11-02T00:00:00Z',
  expectedAmount: 100,
  actualAmount: 100,
  variance: 0,
  variancePercent: 0,
  depositMethod: 'BANK_DEPOSIT',
  closedBy: { firstName: 'Ana', lastName: 'Ruiz' },
}
const pagina = (page: number) => ({ data: [corte], pagination: { page, totalPages: 3, total: 11 } })

let client: QueryClient
function montar() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <CashCloseoutHistory venueId="v1" />
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => client?.clear())

describe('Historial de cortes si falla la carga', () => {
  it('no dice «no hay cortes»: avisa y deja reintentar', async () => {
    mocks.historial.mockRejectedValue({ response: { status: 500 } })
    montar()

    expect(await screen.findByRole('alert')).toHaveTextContent('loadFailure.empty')
    expect(screen.queryByText('history.empty')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'history.backToFirstPage' })).not.toBeInTheDocument()
  })

  it('un negocio sin cortes sigue diciendo que no hay', async () => {
    mocks.historial.mockResolvedValue({ data: [], pagination: { page: 1, totalPages: 0, total: 0 } })
    montar()

    expect(await screen.findByText('history.empty')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('si falla la página 2 se puede regresar a la primera', async () => {
    mocks.historial.mockResolvedValueOnce(pagina(1))
    montar()
    await screen.findByText(/history\.page/)

    mocks.historial.mockRejectedValueOnce({ response: { status: 500 } })
    fireEvent.click(document.querySelector('.lucide-chevron-right')!.closest('button')!)
    expect(await screen.findByRole('alert')).toHaveTextContent('loadFailure.empty')

    mocks.historial.mockResolvedValue(pagina(1))
    fireEvent.click(screen.getByRole('button', { name: 'history.backToFirstPage' }))

    expect(await screen.findByText(/history\.page/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(mocks.historial.mock.lastCall?.[1]).toBe(1)
  })
})
