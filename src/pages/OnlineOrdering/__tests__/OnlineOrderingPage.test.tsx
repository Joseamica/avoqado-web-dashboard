import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const mockStatus = vi.fn()
vi.mock('@/hooks/use-online-ordering-status', () => ({ useOnlineOrderingStatus: () => mockStatus() }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'venue-1', fullBasePath: '/venues/t' }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatTime: (d: string) => d }) }))
vi.mock('@/components/billing/FeatureGate', () => ({
  FeatureGate: ({ feature, children }: { feature: string; children: ReactNode }) => (
    <div data-testid="feature-gate" data-feature={feature}>
      {children}
    </div>
  ),
}))
const getInbox = vi.fn()
vi.mock('@/services/onlineOrdering.service', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/onlineOrdering.service')>()
  return { ...actual, getInbox: (...a: unknown[]) => getInbox(...a) }
})

vi.mock('../components/SettingsTab', () => ({ SettingsTab: () => <div data-testid="settings-tab" /> }))

import OnlineOrderingPage from '../OnlineOrderingPage'

const status = (over: Record<string, unknown> = {}) => ({
  hasPlan: true,
  tierLoading: false,
  canManage: true,
  canAnswer: true,
  canCancel: true,
  canPause: true,
  keepsStoreOpen: true,
  ...over,
})

const EMPTY_INBOX = {
  serverTime: '2026-10-17T18:00:00.000Z',
  counts: { pending: 0, accepted: 0, ready: 0, active: 0, done: 0 },
  orders: [],
  truncated: false,
  nextCursor: null,
  store: null,
}

const setVisibility = (v: DocumentVisibilityState) =>
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v })

let qc: QueryClient
const renderPage = (hash = '') => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/venues/t/online-ordering${hash}`]}>
        <OnlineOrderingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('OnlineOrderingPage', () => {
  beforeEach(() => {
    mockStatus.mockReset()
    getInbox.mockReset()
    getInbox.mockResolvedValue(EMPTY_INBOX)
    setVisibility('visible')
  })
  afterEach(() => setVisibility('visible'))

  it('🔴 la página monta UN solo sondeo de bandeja, y con la pestaña oculta no manda el latido', async () => {
    setVisibility('hidden')
    mockStatus.mockReturnValue(status())
    renderPage()
    await vi.waitFor(() => expect(getInbox).toHaveBeenCalled())
    const queries = qc.getQueryCache().findAll({ queryKey: ['online-ordering', 'venue-1', 'inbox'] })
    expect(queries).toHaveLength(1)
    expect(queries[0].getObserversCount()).toBe(1)
    expect(getInbox).toHaveBeenCalledTimes(1)
    expect(getInbox).toHaveBeenCalledWith('venue-1', { tray: false })
  })

  it('🔴 keepsStoreOpen === false (p. ej. SUPERADMIN) ⇒ getInbox con tray:false', async () => {
    mockStatus.mockReturnValue(status({ keepsStoreOpen: false }))
    renderPage()
    await vi.waitFor(() => expect(getInbox).toHaveBeenCalledWith('venue-1', { tray: false }))
    expect(getInbox).not.toHaveBeenCalledWith('venue-1', { tray: true })
  })

  it('la pestaña visible con keepsStoreOpen manda el latido', async () => {
    mockStatus.mockReturnValue(status())
    renderPage()
    await vi.waitFor(() => expect(getInbox).toHaveBeenCalledWith('venue-1', { tray: true }))
  })

  it('por omisión muestra la Bandeja, sin FeatureGate', () => {
    mockStatus.mockReturnValue(status())
    renderPage()
    expect(screen.getByText('page.title')).toBeInTheDocument()
    expect(screen.getByTestId('tab-content-tray')).toBeInTheDocument()
    expect(screen.queryByTestId('feature-gate')).toBeNull()
  })

  it('sin plan: la Bandeja se ve con el aviso y la consulta de bandeja no depende del plan', async () => {
    mockStatus.mockReturnValue(status({ hasPlan: false }))
    renderPage()
    expect(screen.getByText('page.noPlanNotice')).toBeInTheDocument()
    expect(screen.getByTestId('tab-content-tray')).toBeInTheDocument()
    await vi.waitFor(() => expect(getInbox).toHaveBeenCalled())
  })

  it('#menu y #configuracion van dentro del FeatureGate ONLINE_ORDERING', () => {
    mockStatus.mockReturnValue(status({ hasPlan: false }))
    renderPage('#menu')
    expect(screen.getByTestId('feature-gate')).toHaveAttribute('data-feature', 'ONLINE_ORDERING')
    expect(screen.getByTestId('tab-content-menu')).toBeInTheDocument()
  })

  it('#configuracion con permiso', () => {
    mockStatus.mockReturnValue(status())
    renderPage('#configuracion')
    expect(screen.getByTestId('tab-content-settings')).toBeInTheDocument()
  })

  it('hacer clic en una pestaña cambia el hash y la pestaña visible', async () => {
    mockStatus.mockReturnValue(status())
    renderPage()
    expect(screen.getByTestId('tab-content-tray')).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByText('tabs.settings'))
    fireEvent.click(screen.getByText('tabs.settings'))
    expect(await screen.findByTestId('tab-content-settings')).toBeInTheDocument()
    expect(screen.queryByTestId('tab-content-tray')).toBeNull()
    expect(screen.getByRole('tab', { name: 'tabs.settings' })).toHaveAttribute('data-state', 'active')
  })

  it('sólo orders:read: Bandeja visible y, en las otras pestañas, la línea del permiso', () => {
    mockStatus.mockReturnValue(status({ canManage: false, canAnswer: false, canCancel: false, canPause: false, keepsStoreOpen: false }))
    const { unmount } = renderPage()
    expect(screen.getByTestId('tab-content-tray')).toBeInTheDocument()
    unmount()
    renderPage('#menu')
    expect(screen.getByText('page.needManage')).toBeInTheDocument()
    expect(screen.queryByTestId('tab-content-menu')).toBeNull()
  })
})
