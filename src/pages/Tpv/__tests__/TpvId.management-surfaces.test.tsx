import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import TpvId from '../TpvId'

const { apiGet, apiPatch, sesion } = vi.hoisted(() => ({ apiGet: vi.fn(), apiPatch: vi.fn(), sesion: { role: 'OWNER' } }))

vi.mock('@/api', () => ({
  default: {
    get: apiGet,
    post: vi.fn(),
    put: vi.fn(),
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

describe('SUPERADMIN: las cuentas de comercio de la terminal (el SERVIDOR reemplaza la lista completa)', () => {
  // Radix Select usa pointer capture, que jsdom no trae. Funciones planas: `mockReset: true` vaciaría un vi.fn().
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}

  const CUENTAS = [
    { id: 'cuenta-a', displayName: 'Cuenta A', provider: { name: 'Blumon' } },
    { id: 'cuenta-b', displayName: 'Cuenta B', provider: { name: 'AngelPay' } },
  ]
  const lecturas = (falla?: RegExp) => (url: string) => {
    if (falla?.test(url)) return Promise.reject(new Error('500'))
    if (/superadmin\/terminals\/device-1/.test(url)) return Promise.resolve({ data: { data: { id: 'device-1', assignedMerchantIds: ['cuenta-a'] } } })
    if (/superadmin\/merchant-accounts/.test(url)) return Promise.resolve({ data: { data: CUENTAS } })
    return Promise.resolve({
      data: {
        id: 'device-1',
        name: 'Terminal',
        serialNumber: 'ABC',
        type: 'TPV_ANDROID',
        status: 'ACTIVE',
        venueId: 'venue-1',
        activatedAt: '2026-10-01T00:00:00.000Z',
        capabilities: {
          requiresActivation: false,
          canManagePaymentConfiguration: true,
          canAcceptTerminalPaymentRequests: true,
          customerDisplay: { presence: 'UNSUPPORTED', invertibility: 'UNSUPPORTED', canRequestInversion: false, observedAt: null, stale: false },
          supportedRemoteCommands: [],
        },
      },
    })
  }
  const vincularB = async () => {
    const user = userEvent.setup()
    const selector = screen.queryByText('Seleccionar cuenta...')?.closest('button')
    if (selector) {
      await user.click(selector)
      await user.click(await screen.findByRole('option', { name: /Cuenta B/ }))
    }
    const vincular = screen.queryByRole('button', { name: /Vincular cuenta/ })
    if (vincular) await user.click(vincular)
  }
  const asentar = () => act(async () => void (await new Promise(r => setTimeout(r, 30))))

  beforeEach(() => {
    sesion.role = 'SUPERADMIN'
    apiPatch.mockResolvedValue({ data: { data: {} } })
  })
  afterEach(() => onlineManager.setOnline(true))

  it('🔴 con la terminal sin leer avisa y vincular no le quita las cuentas que ya tiene', async () => {
    apiGet.mockImplementation(lecturas(/superadmin\/terminals\/device-1/))
    renderDetail()
    await screen.findByText('device.sections.superadmin')
    await asentar()
    await vincularB()
    await asentar()
    expect(apiPatch).not.toHaveBeenCalled()
    expect(screen.getByText('loadFailure.empty')).toBeInTheDocument()
    expect(screen.queryByText('No hay cuentas de comercio asignadas')).toBeNull()
  })

  it('con el catálogo de cuentas sin leer no dice que no hay ni ofrece vincular', async () => {
    apiGet.mockImplementation(lecturas(/superadmin\/merchant-accounts/))
    renderDetail()
    await screen.findByText('device.sections.superadmin')
    await asentar()
    expect(screen.getByText('loadFailure.empty')).toBeInTheDocument()
    expect(screen.queryByText('No hay cuentas de comercio asignadas')).toBeNull()
    expect(screen.queryByRole('button', { name: /Vincular cuenta/ })).toBeNull()
  })

  it('con la lectura sana vincular suma a las que ya tiene y quitar conserva las demás', async () => {
    apiGet.mockImplementation(lecturas())
    renderDetail()
    await screen.findByText('Seleccionar cuenta...')
    await vincularB()
    await waitFor(() => expect(apiPatch).toHaveBeenCalledTimes(1))
    expect(apiPatch.mock.calls[0][1]).toEqual({ assignedMerchantIds: ['cuenta-a', 'cuenta-b'] })
    expect(screen.queryByText('loadFailure.empty')).toBeNull()
  })

  it('si la red se cae justo después de leer el aparato, avisa y no ofrece vincular', async () => {
    const sana = lecturas()
    apiGet.mockImplementation((url: string) => {
      if (url.includes('/tpv/device-1')) onlineManager.setOnline(false)
      return sana(url)
    })
    renderDetail()
    expect((await screen.findAllByText('loadFailure.empty')).length).toBeGreaterThan(0)
    expect(screen.queryByText('No hay cuentas de comercio asignadas')).toBeNull()
    expect(screen.queryByRole('button', { name: /Vincular cuenta/ })).toBeNull()
  })
})
