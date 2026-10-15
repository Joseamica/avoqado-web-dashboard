import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TpvId from '../TpvId'

const { apiGet, sesion } = vi.hoisted(() => ({ apiGet: vi.fn(), sesion: { role: 'OWNER' } }))

vi.mock('@/api', () => ({
  default: {
    get: apiGet,
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { role: sesion.role } }),
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
vi.mock('../customer-display/CustomerDisplaySection', () => ({
  CustomerDisplaySection: (props: { deviceType?: string }) => <div data-testid="customer-display-section" data-type={props.deviceType} />,
}))

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
    sesion.role = 'OWNER'
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

  it('monta la sección de la pantalla del cliente con el tipo del aparato (la sección decide qué ve un iPad)', async () => {
    renderDetail()
    expect(await screen.findByTestId('customer-display-section')).toHaveAttribute('data-type', 'POS_IOS')
  })

  it('sin nada de superadmin, Información NO deja un tercio vacío: la columna principal ocupa todo el ancho', async () => {
    renderDetail()
    const principal = (await screen.findByTestId('customer-display-section')).parentElement!
    const rejilla = principal.parentElement!
    expect(rejilla.children).toHaveLength(1) // ninguna columna derecha vacía
    expect(rejilla).not.toHaveClass('xl:grid-cols-3')
    expect(principal).not.toHaveClass('xl:col-span-2')
  })

  it('con el bloque de superadmin, la columna derecha sigue ahí (2/3 + 1/3)', async () => {
    sesion.role = 'SUPERADMIN'
    const aparato = (await apiGet.getMockImplementation()?.('')) as { data: Record<string, any> } | undefined
    apiGet.mockResolvedValue({
      data: { ...(aparato?.data ?? {}), capabilities: { ...aparato!.data.capabilities, requiresActivation: true }, activatedAt: null },
    })
    renderDetail()
    const principal = (await screen.findByTestId('customer-display-section')).parentElement!
    const rejilla = principal.parentElement!
    expect(rejilla).toHaveClass('xl:grid-cols-3')
    expect(principal).toHaveClass('xl:col-span-2')
    expect(rejilla.children).toHaveLength(2)
    expect(rejilla.children[1]).toHaveTextContent('device.sections.superadmin')
  })
})
