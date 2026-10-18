import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const mockStatus = vi.fn()
vi.mock('@/hooks/use-online-ordering-status', () => ({ useOnlineOrderingStatus: () => mockStatus() }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'venue-1', fullBasePath: '/venues/t' }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
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

const renderPage = (hash = '') => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
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
    getInbox.mockResolvedValue({ orders: [], counts: {} })
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
