import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate, type NavigateFunction } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

describe('el refresco de la ficha no borra lo que se está editando (hz:a5fa2439:D4)', () => {
  const FICHA = {
    id: 'device-1',
    name: 'PC de caja',
    serialNumber: null,
    type: 'POS_ANDROID',
    status: 'ACTIVE',
    venueId: 'venue-1',
    modelIdentifier: 'Windows 11',
    version: '2.30.0-escritorio',
    lastHeartbeat: '2026-11-25T12:00:00.000Z',
    customerDisplayInverted: false,
    deviceDiagnostics: { performance: 'LIGHT', drawingMode: 'FAST', forced: true, receivedAt: '2026-11-25T12:00:00.000Z' },
  }
  let servidor: Record<string, unknown>
  /** Mientras exista, la lectura de la ficha espera: así se ve la página ANTES de que llegue el refetch. */
  let retenida: Promise<void> | null

  /** Retiene las lecturas de la ficha hasta llamar lo que devuelve; entonces contestan con lo último del SERVIDOR. */
  function retenerLaFicha(): () => void {
    let soltar = () => {}
    retenida = new Promise(resolve => {
      soltar = () => {
        retenida = null
        resolve()
      }
    })
    return soltar
  }

  beforeEach(() => {
    sesion.role = 'OWNER'
    contexto.venueId = 'venue-1'
    servidor = { ...FICHA }
    retenida = null
    apiGet.mockImplementation(async (path: string) => {
      if (path === '/api/v1/dashboard/venues/venue-1/tpv/device-1') {
        if (retenida) await retenida
        return { data: servidor }
      }
      // La ficha de una computadora pide su pantalla del cliente: aquí no tiene ninguna.
      if (path.endsWith('/customer-display')) return { data: { data: null } }
      return { data: { data: [] } }
    })
    apiPut.mockImplementation(async (_path: string, body: { name: string }) => {
      servidor = { ...servidor, name: body.name }
      return { data: servidor }
    })
  })

  const campoNombre = () => screen.getByLabelText('detail.terminalName') as HTMLInputElement

  async function abrirEdicionYTeclear(vista: ReturnType<typeof renderDetail>, nombre: string) {
    fireEvent.click(await screen.findByRole('button', { name: 'common:edit' }))
    fireEvent.change(campoNombre(), { target: { value: nombre } })
    expect(campoNombre().value).toBe(nombre)
    return vista
  }

  /**
   * El latido o el refresco de 15 s: la misma ficha vuelve del SERVIDOR con otro latido y otra medición. Espera a que la
   * página la PINTE (el nivel nuevo de «Rendimiento»): TanStack avisa a la página en un turno posterior al refetch.
   */
  async function refresco(vista: ReturnType<typeof renderDetail>, nivel: 'INSUFFICIENT' | 'FLUID', cambios: Record<string, unknown> = {}) {
    servidor = {
      ...servidor,
      ...cambios,
      lastHeartbeat: new Date(Date.parse(String(servidor.lastHeartbeat)) + 30_000).toISOString(),
      deviceDiagnostics: { ...FICHA.deviceDiagnostics, performance: nivel },
    }
    await act(() => vista.queryClient.refetchQueries({ queryKey: ['tpv', 'venue-1', 'device-1'] }))
    expect(await screen.findByText(`device.performance.${nivel}`)).toBeInTheDocument()
  }

  it('lo tecleado se conserva aunque llegue la misma ficha con otro latido y otra medición', async () => {
    const vista = await abrirEdicionYTeclear(renderDetail(), 'Caja 2')
    await refresco(vista, 'INSUFFICIENT')
    expect(campoNombre().value).toBe('Caja 2')
  })

  it('al cancelar, el campo vuelve al valor más reciente del SERVIDOR', async () => {
    const vista = await abrirEdicionYTeclear(renderDetail(), 'Caja 2')
    await refresco(vista, 'FLUID', { name: 'Caja renombrada en otro lado' })
    expect(campoNombre().value).toBe('Caja 2')

    fireEvent.click(screen.getAllByRole('button', { name: 'common:cancel' })[0])
    fireEvent.click(await screen.findByRole('button', { name: 'common:edit' }))
    expect(campoNombre().value).toBe('Caja renombrada en otro lado')
  })

  it('al guardar queda el valor guardado', async () => {
    await abrirEdicionYTeclear(renderDetail(), 'Caja 2')
    fireEvent.click(screen.getByRole('button', { name: 'detail.saveChanges' }))
    await waitFor(() => expect(apiPut).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'detail.saveChanges' })).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getAllByText('Caja 2').length).toBeGreaterThan(0))

    fireEvent.click(await screen.findByRole('button', { name: 'common:edit' }))
    expect(campoNombre().value).toBe('Caja 2')
  })

  /** Guarda «Caja 2» con el refetch retenido y vuelve a abrir «Editar» antes de que llegue. */
  async function guardarYReabrirAntesDelRefetch() {
    await abrirEdicionYTeclear(renderDetail(), 'Caja 2')
    const soltar = retenerLaFicha()
    fireEvent.click(screen.getByRole('button', { name: 'detail.saveChanges' }))
    await waitFor(() => expect(apiPut).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'detail.saveChanges' })).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'common:edit' }))
    return soltar
  }

  /** Suelta el refetch retenido (con otra medición, para saber cuándo ya se pintó) y espera a que la página lo pinte. */
  async function llegaElRefetch(soltar: () => void) {
    servidor = { ...servidor, deviceDiagnostics: { ...FICHA.deviceDiagnostics, performance: 'FLUID' } }
    await act(async () => soltar())
    expect(await screen.findByText('device.performance.FLUID')).toBeInTheDocument()
  }

  it('volver a «Editar» justo después de guardar trae lo recién guardado, no lo de antes', async () => {
    const soltar = await guardarYReabrirAntesDelRefetch()
    expect(campoNombre().value).toBe('Caja 2')

    // Con la edición abierta, el refetch que llega no pisa lo que se vuelve a teclear.
    fireEvent.change(campoNombre(), { target: { value: 'Caja 3' } })
    await llegaElRefetch(soltar)
    expect(campoNombre().value).toBe('Caja 3')
  })

  it('un segundo «Guardar» sin tocar nada manda el nombre nuevo, no revierte al anterior', async () => {
    const soltar = await guardarYReabrirAntesDelRefetch()
    await llegaElRefetch(soltar)
    fireEvent.click(screen.getByRole('button', { name: 'detail.saveChanges' }))
    await waitFor(() => expect(apiPut).toHaveBeenCalledTimes(2))
    expect(apiPut.mock.calls[1][1].name).toBe('Caja 2')
  })

  it('sin edición abierta, un refresco con otro nombre se ve en la ficha, como hoy', async () => {
    const vista = renderDetail()
    expect((await screen.findAllByText('PC de caja')).length).toBeGreaterThan(0)
    await refresco(vista, 'FLUID', { name: 'Caja de la barra' })
    await waitFor(() => expect(screen.getAllByText('Caja de la barra').length).toBeGreaterThan(0))
    expect(screen.queryByText('PC de caja')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'common:edit' }))
    expect(campoNombre().value).toBe('Caja de la barra')
  })
})
