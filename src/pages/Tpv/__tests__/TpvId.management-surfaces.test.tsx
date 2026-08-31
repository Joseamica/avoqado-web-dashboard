import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TpvId from '../TpvId'

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }))

vi.mock('@/api', () => ({
  default: {
    get: apiGet,
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'OWNER' } }),
}))

vi.mock('@/context/BreadcrumbContext', () => ({
  useBreadcrumb: () => ({ setCustomSegment: vi.fn(), clearCustomSegment: vi.fn() }),
}))

vi.mock('@/context/SocketContext', () => ({
  useSocket: () => ({ socket: null, joinVenueRoom: vi.fn(), leaveVenueRoom: vi.fn() }),
}))

vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({ can: () => true, canAny: () => true, canAll: () => true }),
}))

vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({
    venueId: 'venue-1',
    venueSlug: 'test-venue',
    venue: { timezone: 'America/Mexico_City' },
    fullBasePath: '/venues/test-venue',
  }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : fallback?.defaultValue ?? key,
    i18n: { language: 'es' },
  }),
}))

vi.mock('../components/CommandHistoryTable', () => ({ CommandHistoryTable: () => <div /> }))
vi.mock('../components/DisplayModeRequestControl', () => ({
  DisplayModeRequestControl: () => <div />,
  getDisplayModeRefetchInterval: () => false,
}))
vi.mock('../components/MessagesTab', () => ({ MessagesTab: () => <div /> }))
vi.mock('../components/RemoteCommandPanel', () => ({ RemoteCommandPanel: () => <div /> }))
vi.mock('@/pages/Settings/components/TpvSettingsForm', () => ({ TpvSettingsForm: () => <div /> }))

function renderDetail() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/venues/test-venue/devices/device-1']}>
        <Routes>
          <Route path="/venues/:slug/devices/:tpvId" element={<TpvId />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('device detail management surfaces', () => {
  beforeEach(() => {
    apiGet.mockResolvedValue({
      data: {
        id: 'device-1',
        name: 'Apple iPad15,7',
        serialNumber: 'ios-device',
        type: 'POS_IOS',
        brand: 'Apple',
        model: 'iPad15,7',
        status: 'INACTIVE',
        venueId: 'venue-1',
        activatedAt: null,
        customerDisplayInverted: false,
        selfRegistered: true,
        capabilities: {
          requiresActivation: false,
          canManagePaymentConfiguration: false,
          canAcceptTerminalPaymentRequests: false,
          customerDisplay: {
            presence: 'UNSUPPORTED',
            invertibility: 'UNSUPPORTED',
            canRequestInversion: false,
            observedAt: null,
            stale: false,
          },
          supportedRemoteCommands: [],
        },
      },
    })
  })

  it('does not show avoqado-tpv tabs for a POS iOS device', async () => {
    renderDetail()

    expect(await screen.findByRole('button', { name: 'Información' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'commands.remoteCommands' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mensajes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'tpvSettings.title' })).not.toBeInTheDocument()
  })
})
