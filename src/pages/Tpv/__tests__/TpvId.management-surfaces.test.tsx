import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
// La sección guarda un «borrador» en su estado: si la página la desmonta, el texto se pierde (como el del editor real).
vi.mock('../customer-display/CustomerDisplaySection', async () => {
  const { useState } = await import('react')
  return {
    CustomerDisplaySection: (props: { deviceType?: string; lastHeartbeat?: string | null }) => {
      const [borrador, setBorrador] = useState('')
      return (
        <div data-testid="customer-display-section" data-type={props.deviceType} data-latido={String(props.lastHeartbeat)}>
          <input aria-label="borrador-del-editor" value={borrador} onChange={e => setBorrador(e.target.value)} />
        </div>
      )
    },
  }
})

const CLAVE_DEL_APARATO = ['tpv', 'venue-1', 'device-1']
const RUTA_DEL_APARATO = '/api/v1/dashboard/venues/venue-1/tpv/device-1'
const lecturasDelAparato = () => apiGet.mock.calls.filter(([ruta]) => ruta === RUTA_DEL_APARATO).length

function renderDetail() {
  // `retryDelay: 0`: la consulta del aparato reintenta 3 veces (su propio `retry`) y aquí no se esperan 7 s de verdad.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } })

  const pintado = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/venues/test-venue/devices/device-1']}>
        <Routes>
          <Route path="/venues/:slug/devices/:tpvId" element={<TpvId />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...pintado, queryClient }
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

  it('🔴 le pasa a la sección el latido de la página (el que usa el encabezado), para que la tarjeta no diga lo contrario (Codex #3)', async () => {
    const aparato = (await apiGet.getMockImplementation()?.('')) as { data: Record<string, any> }
    apiGet.mockResolvedValue({ data: { ...aparato.data, lastHeartbeat: '2026-10-15T09:00:00.000Z' } })
    renderDetail()
    expect(await screen.findByTestId('customer-display-section')).toHaveAttribute('data-latido', '2026-10-15T09:00:00.000Z')
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

  describe('🔴 un error de FONDO de la página no desmonta la sección ni su editor (Codex #1 · revisión final I2)', () => {
    it.each([
      ['un 500 (tras agotar los 3 reintentos)', { response: { status: 500 } }, 1 + 1 + 3],
      ['un 404 (el aparato ya no aparece; no se reintenta)', { response: { status: 404 } }, 1 + 1],
    ])('%s: la sección y el borrador siguen, y se avisa sin bloquear', async (_n, falla, lecturas) => {
      const { queryClient } = renderDetail()
      const borrador = await screen.findByLabelText('borrador-del-editor')
      fireEvent.change(borrador, { target: { value: 'texto sin guardar' } })
      apiGet.mockRejectedValue(falla)
      await act(async () => {
        await queryClient.refetchQueries({ queryKey: CLAVE_DEL_APARATO })
      })
      expect(lecturasDelAparato()).toBe(lecturas)
      expect(await screen.findByText('detail.errors.refreshError')).toBeInTheDocument()
      expect(screen.getByLabelText('borrador-del-editor')).toHaveValue('texto sin guardar')
      expect(screen.queryByText('detail.errors.loadError')).not.toBeInTheDocument()
      expect(screen.queryByText('detail.notFound')).not.toBeInTheDocument()
    })

    it('cuando la siguiente lectura sale bien, el aviso se va y el borrador sigue', async () => {
      const { queryClient } = renderDetail()
      fireEvent.change(await screen.findByLabelText('borrador-del-editor'), { target: { value: 'texto sin guardar' } })
      const aparato = (await apiGet.getMockImplementation()?.('')) as { data: Record<string, any> }
      apiGet.mockRejectedValue({ response: { status: 500 } })
      await act(async () => {
        await queryClient.refetchQueries({ queryKey: CLAVE_DEL_APARATO })
      })
      expect(await screen.findByText('detail.errors.refreshError')).toBeInTheDocument()
      apiGet.mockResolvedValue(aparato)
      await act(async () => {
        await queryClient.refetchQueries({ queryKey: CLAVE_DEL_APARATO })
      })
      // TanStack avisa a la pantalla en el siguiente turno: se espera a que el aviso se vaya.
      await waitFor(() => expect(screen.queryByText('detail.errors.refreshError')).not.toBeInTheDocument())
      expect(screen.getByLabelText('borrador-del-editor')).toHaveValue('texto sin guardar')
    })

    it.each([
      ['un error', { response: { status: 500 } }, 'detail.errors.loadError'],
      ['un 404', { response: { status: 404 } }, 'detail.notFound'],
    ])('SIN datos previos, %s sigue siendo la página completa (nada que conservar)', async (_n, falla, texto) => {
      apiGet.mockRejectedValue(falla)
      renderDetail()
      expect(await screen.findByText(texto)).toBeInTheDocument()
      expect(screen.queryByTestId('customer-display-section')).not.toBeInTheDocument()
      expect(screen.queryByText('detail.errors.refreshError')).not.toBeInTheDocument()
    })
  })
})
