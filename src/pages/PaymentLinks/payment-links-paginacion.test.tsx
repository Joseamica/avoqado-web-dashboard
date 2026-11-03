import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PaymentLinks from './PaymentLinks'

// La lista pagina, filtra por pestaña y cuenta en el servidor. Antes pedía sin página, el servidor mandaba sólo 20
// y el navegador filtraba y contaba esas 20: las ligas más viejas no salían en ninguna pestaña.
const mocks = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'venue-a', fullBasePath: '/venues/a' }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: () => '', formatDateTime: () => '' }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useLocation: () => ({ search: '', pathname: '/', hash: '' }) }))
vi.mock('@/services/ecommerceMerchant.service', () => ({ ecommerceMerchantAPI: { listByVenue: async () => [{ chargesEnabled: true }] } }))
vi.mock('@/services/paymentLink.service', () => ({ default: { getPaymentLinks: mocks.list } }))
vi.mock('@/components/StatusFilterTabs', () => ({
  StatusFilterTabs: ({
    tabs,
    onTabChange,
  }: {
    tabs: Array<{ value: string; label: string; count?: number }>
    onTabChange: (v: string) => void
  }) => (
    <div>
      {tabs.map(tab => (
        <button key={tab.value} onClick={() => onTabChange(tab.value)}>{`${tab.label}=${tab.count}`}</button>
      ))}
    </div>
  ),
}))
vi.mock('@/components/SummaryCards', () => ({
  SummaryCards: ({ cards }: { cards: Array<{ label: string; value: number }> }) => (
    <div>
      {cards.map(i => (
        <span key={i.label}>{`${i.label}=${i.value}`}</span>
      ))}
    </div>
  ),
}))
vi.mock('@/components/data-table', () => ({
  default: ({
    rowCount,
    setPagination,
  }: {
    rowCount: number
    setPagination?: (u: (p: { pageIndex: number; pageSize: number }) => unknown) => void
  }) => (
    <div>
      <span>{`filas=${rowCount}`}</span>
      <button onClick={() => setPagination?.(p => ({ ...p, pageIndex: p.pageIndex + 1 }))}>siguiente</button>
    </div>
  ),
}))
vi.mock('./CreatePaymentLinkDialog', () => ({ default: () => null }))
vi.mock('./SharePaymentLinkDialog', () => ({ SharePaymentLinkDialog: () => null }))
vi.mock('@/pages/Venue/components/EcommerceMerchantWizard', () => ({ EcommerceMerchantWizard: () => null }))

const pagina = {
  paymentLinks: [],
  total: 45,
  counts: { all: 45, active: 30, used: 10, paused: 3, expired: 2 },
  summary: { totalCollected: 1550.5, paidLinks: 9 },
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const pintar = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PaymentLinks />
    </QueryClientProvider>,
  )

describe('lista de ligas: paginación y pestañas en el servidor', () => {
  it('pide la primera página de la pestaña al servidor y pinta sus contadores, total y tarjetas', async () => {
    mocks.list.mockResolvedValue(pagina)
    pintar()

    expect(await screen.findByText('filas=45')).toBeInTheDocument()
    expect(mocks.list).toHaveBeenCalledWith('venue-a', { view: 'all', statuses: undefined, search: undefined, limit: 20, offset: 0 })
    expect(screen.getByText('statusTabs.used=10')).toBeInTheDocument()
    expect(screen.getByText('statusTabs.all=45')).toBeInTheDocument()
    expect(screen.getByText('summaryCards.links=45')).toBeInTheDocument()
    expect(screen.getByText('summaryCards.collected=1550.5')).toBeInTheDocument()
    expect(screen.getByText('summaryCards.usageRate=20')).toBeInTheDocument()
  })

  it('la página siguiente pide offset 20; cambiar de pestaña vuelve a la primera página de esa pestaña', async () => {
    mocks.list.mockResolvedValue(pagina)
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'siguiente' }))
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith('venue-a', expect.objectContaining({ view: 'all', offset: 20 })))

    fireEvent.click(screen.getByRole('button', { name: 'statusTabs.used=10' }))
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith('venue-a', expect.objectContaining({ view: 'used', offset: 0 })))
  })

  it('si la página actual deja de existir (se archivaron ligas), regresa a la última que sí tiene', async () => {
    mocks.list.mockImplementation(async (_venue: string, { offset }: { offset: number }) =>
      offset === 0 ? pagina : { ...pagina, total: 15, paymentLinks: [] },
    )
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'siguiente' }))
    await waitFor(() => expect(mocks.list).toHaveBeenCalledWith('venue-a', expect.objectContaining({ offset: 20 })))
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith('venue-a', expect.objectContaining({ offset: 0 })))
  })
})
