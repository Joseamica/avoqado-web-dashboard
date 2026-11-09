import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosAdapter } from 'axios'
import { MemoryRouter, Route, Routes, useNavigate, type NavigateFunction } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import TpvId from '../TpvId'

const { apiGet, apiPatch, apiPost, apiPut, toast, sesion, contexto } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  toast: vi.fn(),
  sesion: { role: 'OWNER' },
  contexto: { venueId: 'venue-1' },
}))

vi.mock('@/api', () => ({
  default: {
    get: apiGet,
    post: apiPost,
    put: apiPut,
    patch: apiPatch,
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
    venueId: contexto.venueId,
    venueSlug: 'test-venue',
    venue: { timezone: 'America/Mexico_City' },
    fullBasePath: '/venues/test-venue',
  }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string; count?: number }) =>
      typeof fallback === 'string'
        ? fallback
        : fallback?.defaultValue ?? (fallback?.count === undefined ? key : `${key} (${fallback.count})`),
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

function renderDetail() {
  // `retryDelay: 0`: la consulta del aparato reintenta 3 veces (su propio `retry`) y aquí no se esperan 7 s de verdad.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } })

  let navigateTo: NavigateFunction
  function NavigationProbe() {
    navigateTo = useNavigate()
    return <TpvId />
  }
  const view = () => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/venues/test-venue/devices/device-1']}>
        <Routes>
          <Route path="/venues/:slug/devices/:tpvId" element={<NavigationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
  const pintado = render(view())
  return {
    ...pintado,
    queryClient,
    navigateTo: (path: string) => act(() => navigateTo(path)),
    refreshContext: () => pintado.rerender(view()),
  }
}


describe('formulario Editar de un aparato', () => {
  beforeEach(() => {
    sesion.role = 'OWNER'
    contexto.venueId = 'venue-1'
    apiGet.mockReset()
    apiPut.mockReset()
    apiPut.mockResolvedValue({ data: {} })
    apiGet.mockImplementation(async (path: string) => {
      if (path.includes('/tpv/')) {
        return {
          data: {
            id: 'device-1',
            name: 'PC de caja',
            serialNumber: null,
            type: 'TPV_ANDROID',
            status: 'ACTIVE',
            config: { secreto: true },
            venueId: contexto.venueId,
            activatedAt: '2026-10-01T00:00:00.000Z',
            customerDisplayInverted: false,
          },
        }
      }
      return { data: { data: [] } }
    })
  })

  async function guardarConNombre() {
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'common:edit' }))
    fireEvent.change(await screen.findByDisplayValue('PC de caja'), { target: { value: 'PC 2' } })
    fireEvent.click(screen.getByRole('button', { name: 'detail.saveChanges' }))
    await waitFor(() => expect(apiPut).toHaveBeenCalledTimes(1))
    return apiPut.mock.calls[0]
  }

  it('una PC sin número de serie guarda el formulario Editar', async () => {
    const [url, body] = await guardarConNombre()
    expect(url).toBe('/api/v1/dashboard/venues/venue-1/tpv/device-1')
    expect(body.name).toBe('PC 2')
    expect(body).not.toHaveProperty('serialNumber')
  })

  it('Editar no manda config', async () => {
    const [, body] = await guardarConNombre()
    expect(body).not.toHaveProperty('config')
  })
})
