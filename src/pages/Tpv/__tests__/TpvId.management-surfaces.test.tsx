import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AxiosError, type AxiosAdapter } from 'axios'
import { MemoryRouter, Route, Routes, useNavigate, type NavigateFunction } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TpvId from '../TpvId'

const { apiGet, apiPost, toast, sesion, contexto } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  toast: vi.fn(),
  sesion: { role: 'OWNER' },
  contexto: { venueId: 'venue-1' },
}))

vi.mock('@/api', () => ({
  default: {
    get: apiGet,
    post: apiPost,
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

// E1: la página, el servicio y TanStack son reales; sólo la frontera HTTP entrega datos controlados.
describe('E1 soporte suelta la terminal sin decidir el resultado de la venta', () => {
  const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const previousVenueId = 'clvenueanterior00000000001'
  const endpoint = `/api/v1/dashboard/superadmin/terminals/payment-requests/${requestId}/release`
  const detailKey = ['superadmin-terminal', 'device-1']
  const reason = 'La terminal ya fue revisada por soporte'
  const releaseButton = () => screen.getByRole('button', { name: 'paymentRelease.action', hidden: true })
  const confirmButton = () => within(screen.getByRole('alertdialog')).getByRole('button', { name: 'paymentRelease.confirm' })
  const reasonInput = () => screen.getByRole('textbox', { name: 'paymentRelease.reason' })
  const initialBlocker = {
    requestId,
    venueId: previousVenueId,
    amount: 123.45,
    status: 'UNKNOWN',
    createdAt: '2026-10-22T20:00:00.000Z',
    ageMinutes: 17,
  }
  let blocker: Record<string, unknown> | null | undefined
  let canConfigure: boolean

  const terminalReads = () => apiGet.mock.calls.filter(([path]) => path === '/api/v1/dashboard/superadmin/terminals/device-1').length
  const assertNoSuccess = () => {
    expect(toast.mock.calls.some(([value]) => value.title === 'paymentRelease.success')).toBe(false)
  }
  async function openConfirmation() {
    fireEvent.click(await screen.findByRole('button', { name: 'paymentRelease.action' }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  }
  async function submitReason(value = reason) {
    await openConfirmation()
    fireEvent.change(reasonInput(), { target: { value } })
    fireEvent.click(confirmButton())
  }
  function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>(done => {
      resolve = done
    })
    return { promise, resolve }
  }

  beforeEach(() => {
    contexto.venueId = 'venue-1'
    sesion.role = 'SUPERADMIN'
    canConfigure = true
    blocker = { ...initialBlocker }
    apiGet.mockReset()
    apiPost.mockReset()
    toast.mockReset()
    apiGet.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/v1/dashboard/superadmin/terminals/')) {
        const id = path.split('/').pop()
        return { data: { data: { id, venueId: contexto.venueId, assignedMerchantIds: [], blockingPaymentRequest: blocker } } }
      }
      if (path.includes('/tpv/')) {
        return {
          data: {
            id: path.split('/').pop(),
            name: 'Terminal de caja',
            serialNumber: 'PAX-E1',
            type: 'TPV_ANDROID',
            status: 'ACTIVE',
            venueId: contexto.venueId,
            activatedAt: '2026-10-01T00:00:00.000Z',
            customerDisplayInverted: false,
            capabilities: {
              requiresActivation: true,
              canManagePaymentConfiguration: canConfigure,
              canAcceptTerminalPaymentRequests: true,
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
        }
      }
      return { data: { data: [] } }
    })
    apiPost.mockResolvedValue({ data: { success: true, released: true, status: 'TIMED_OUT', message: 'Terminal liberada. La venta sigue protegida.' } })
  })

  it('muestra identidad, monto en pesos, edad y estado sólo a soporte habilitado', async () => {
    renderDetail()
    await screen.findByRole('button', { name: 'paymentRelease.action' })
    const panel = screen.getByText('paymentRelease.title').closest('section')!
    expect(panel).toHaveTextContent(requestId)
    expect(panel).toHaveTextContent(previousVenueId)
    expect(panel).toHaveTextContent(/123[.,]45/)
    expect(panel).toHaveTextContent('paymentRelease.age (17)')
    expect(panel).toHaveTextContent('paymentRelease.status.UNKNOWN')
    expect(releaseButton()).toHaveAttribute('data-tour', 'tpv-payment-release-open')
    expect(apiPost).not.toHaveBeenCalled()
  })

  it.each(['OWNER', 'ADMIN', 'MANAGER', 'WAITER', 'VIEWER'])('%s no ve ni consulta la acción interna aunque tenga permisos del venue', async role => {
    sesion.role = role
    renderDetail()
    await screen.findByTestId('customer-display-section')
    expect(screen.queryByRole('button', { name: 'paymentRelease.action' })).not.toBeInTheDocument()
    expect(terminalReads()).toBe(0)
    expect(apiPost).not.toHaveBeenCalled()
  })

  it('SUPERADMIN sin capacidad de configurar cobros no consulta ni ofrece la acción', async () => {
    canConfigure = false
    renderDetail()
    await screen.findByTestId('customer-display-section')
    expect(screen.queryByRole('button', { name: 'paymentRelease.action' })).not.toBeInTheDocument()
    expect(terminalReads()).toBe(0)
  })

  it.each([undefined, null])('backend anterior o sin bloqueador (%s) no inventa un cobro pendiente', async value => {
    blocker = value
    const { queryClient } = renderDetail()
    await waitFor(() => expect(queryClient.getQueryState(detailKey)?.status).toBe('success'))
    expect(screen.queryByText('paymentRelease.title')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'paymentRelease.action' })).not.toBeInTheDocument()
    expect(apiPost).not.toHaveBeenCalled()
  })

  it.each(['requestId', 'venueId'])('si falta %s no inventa una identidad para el POST', async field => {
    delete blocker![field]
    const { queryClient } = renderDetail()
    await waitFor(() => expect(queryClient.getQueryState(detailKey)?.status).toBe('success'))
    const action = screen.queryByRole('button', { name: 'paymentRelease.action' })
    if (action) expect(action).toBeDisabled()
    expect(apiPost).not.toHaveBeenCalled()
  })

  it('abrir exige confirmación; cancelar con motivo no escribe', async () => {
    renderDetail()
    await openConfirmation()
    expect(screen.getByText('paymentRelease.confirmDescription')).toBeInTheDocument()
    expect(confirmButton()).toBeDisabled()
    fireEvent.change(reasonInput(), { target: { value: reason } })
    expect(reasonInput()).toHaveAttribute('data-tour', 'tpv-payment-release-reason')
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'common:cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(apiPost).not.toHaveBeenCalled()
  })

  it.each([
    ['vacío', ''],
    ['espacios', '   '],
    ['una letra', ' a '],
    ['dos letras', ' ab '],
    ['301 caracteres', 'x'.repeat(301)],
  ])('no deja confirmar motivo inválido tras trim (%s)', async (_label, value) => {
    renderDetail()
    await openConfirmation()
    fireEvent.change(reasonInput(), { target: { value } })
    expect(confirmButton()).toBeDisabled()
    fireEvent.click(confirmButton())
    expect(apiPost).not.toHaveBeenCalled()
  })

  it.each(['  abc  ', `  ${'x'.repeat(300)}  `])('acepta el límite válido tras trim y manda sólo el contrato autorizado (%#)', async value => {
    renderDetail()
    await submitReason(value)
    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1))
    expect(apiPost).toHaveBeenCalledWith(endpoint, { venueId: previousVenueId, reason: value.trim() })
  })

  it('soltar refresca ambas lecturas y el bloqueador desaparece sin recargar; la venta sigue protegida', async () => {
    apiPost.mockImplementation(async () => {
      blocker = null
      return { data: { success: true, released: true, status: 'TIMED_OUT', message: 'Terminal liberada. La venta sigue protegida.' } }
    })
    renderDetail()
    await submitReason()
    await waitFor(() => expect(screen.queryByText('paymentRelease.title')).not.toBeInTheDocument())
    expect(terminalReads()).toBeGreaterThanOrEqual(2)
    expect(lecturasDelAparato()).toBeGreaterThanOrEqual(2)
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'paymentRelease.success' }))
    expect(JSON.stringify(toast.mock.calls)).not.toContain('no se cobró')
  })

  it.each([
    { success: false, released: false, status: 'UNKNOWN' },
    { success: false, released: false, status: 'COMPLETED', paymentId: 'pago-existente' },
    { success: true, released: false, status: 'TIMED_OUT' },
    { success: false, released: true, status: 'TIMED_OUT' },
  ])('HTTP 200 no demuestra liberación: %j conserva motivo, muestra razón y refresca', async result => {
    const message = 'No se liberó: ese cobro requiere conciliación.'
    apiPost.mockResolvedValue({ data: { ...result, message } })
    renderDetail()
    await submitReason()
    await waitFor(() => expect(terminalReads()).toBeGreaterThanOrEqual(2))
    expect(screen.getByRole('alertdialog')).toHaveTextContent(message)
    expect(reasonInput()).toHaveValue(reason)
    expect(releaseButton()).toBeInTheDocument()
    assertNoSuccess()
  })

  it('error de red conserva motivo y selección para reintentar exactamente el mismo cobro', async () => {
    apiPost.mockRejectedValueOnce(new Error('Network Error'))
    renderDetail()
    await submitReason()
    await screen.findByText('paymentRelease.error')
    expect(reasonInput()).toHaveValue(reason)
    assertNoSuccess()
    fireEvent.click(confirmButton())
    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(2))
    expect(apiPost.mock.calls[0]).toEqual([endpoint, { venueId: previousVenueId, reason }])
    expect(apiPost.mock.calls[1]).toEqual(apiPost.mock.calls[0])
  })

  it('doble toque durante vuelo deja una sola petición y el motivo queda congelado', async () => {
    const pending = deferred<{ data: { success: boolean; released: boolean; status: string } }>()
    apiPost.mockReturnValue(pending.promise)
    renderDetail()
    await openConfirmation()
    fireEvent.change(reasonInput(), { target: { value: reason } })
    const button = confirmButton()
    fireEvent.click(button)
    fireEvent.click(button)
    expect(apiPost).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()
    expect(reasonInput()).toBeDisabled()
    expect(apiPost).toHaveBeenCalledWith(endpoint, { venueId: previousVenueId, reason })
    await act(async () => {
      pending.resolve({ data: { success: false, released: false, status: 'UNKNOWN' } })
    })
  })

  it.each(['requestId', 'venueId'])('si cambia %s del bloqueador, invalida el diálogo antes de escribir', async field => {
    const { queryClient } = renderDetail()
    await openConfirmation()
    fireEvent.change(reasonInput(), { target: { value: reason } })
    blocker = { ...initialBlocker, [field]: field === 'requestId' ? 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' : 'clvenuesiguiente000000001' }
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: detailKey })
    })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(apiPost).not.toHaveBeenCalled()
    await openConfirmation()
    expect(reasonInput()).toHaveValue('')
  })

  it('si el cobro ya no aparta la terminal al refrescar, invalida la confirmación sin escribir', async () => {
    const { queryClient } = renderDetail()
    await openConfirmation()
    fireEvent.change(reasonInput(), { target: { value: reason } })
    blocker = null
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: detailKey })
    })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'paymentRelease.action' })).not.toBeInTheDocument()
    expect(apiPost).not.toHaveBeenCalled()
  })

  it.each(['terminal', 'venue'])('cambiar %s con diálogo abierto descarta la confirmación anterior', async kind => {
    const page = renderDetail()
    await openConfirmation()
    fireEvent.change(reasonInput(), { target: { value: reason } })
    if (kind === 'terminal') page.navigateTo('/venues/test-venue/devices/device-2')
    else {
      contexto.venueId = 'venue-2'
      page.refreshContext()
    }
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(apiPost).not.toHaveBeenCalled()
    await openConfirmation()
    expect(reasonInput()).toHaveValue('')
  })

  it.each(['terminal', 'venue', 'request'])('una respuesta vieja no aplica éxito ni borra el cobro del nuevo contexto (%s)', async kind => {
    const pending = deferred<{ data: { success: boolean; released: boolean; status: string } }>()
    apiPost.mockReturnValue(pending.promise)
    const page = renderDetail()
    await submitReason()
    const nextId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    blocker = { ...initialBlocker, requestId: nextId }
    if (kind === 'terminal') page.navigateTo('/venues/test-venue/devices/device-2')
    else if (kind === 'venue') {
      contexto.venueId = 'venue-2'
      page.refreshContext()
    } else {
      await act(async () => {
        await page.queryClient.refetchQueries({ queryKey: detailKey })
      })
    }
    await screen.findByText(nextId)
    await act(async () => {
      pending.resolve({ data: { success: true, released: true, status: 'TIMED_OUT' } })
    })
    expect(screen.getByText(nextId)).toBeInTheDocument()
    expect(apiPost).toHaveBeenCalledTimes(1)
    expect(apiPost).toHaveBeenCalledWith(endpoint, { venueId: previousVenueId, reason })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    assertNoSuccess()
  })

  it('cliente Axios REAL: efecto comprometido + respuesta perdida reenvía una vez; released:false refresca sin éxito falso', async () => {
    const { default: realApi } = await vi.importActual<typeof import('@/api')>('@/api')
    const sent: { url?: string; body: unknown; retry: unknown }[] = []
    let committedEffects = 0
    const adapter: AxiosAdapter = async config => {
      sent.push({ url: config.url, body: JSON.parse(config.data), retry: (config as typeof config & { _retry?: boolean })._retry })
      if (sent.length === 1) {
        // El efecto ocurre ANTES de perder la respuesta: el GET posterior tiene otra verdad.
        committedEffects += 1
        blocker = null
        throw new AxiosError('Network Error', 'ERR_NETWORK', config)
      }
      return {
        config,
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { success: false, released: false, status: 'TIMED_OUT', message: 'Este cobro ya no aparta la terminal. La venta sigue pendiente.' },
      }
    }
    // Se delega el POST al cliente productivo: NO se sustituye el interceptor ni su temporizador de 1 s.
    apiPost.mockImplementation((path: string, body: unknown) => realApi.post(path, body, { adapter }))
    renderDetail()
    await submitReason()
    await waitFor(() => expect(sent).toHaveLength(2), { timeout: 4000 })
    await waitFor(() => expect(screen.queryByText('paymentRelease.title')).not.toBeInTheDocument())
    expect(committedEffects).toBe(1)
    expect(apiPost).toHaveBeenCalledTimes(1)
    expect(sent.map(({ url, body }) => ({ url, body }))).toEqual([
      { url: endpoint, body: { venueId: previousVenueId, reason } },
      { url: endpoint, body: { venueId: previousVenueId, reason } },
    ])
    expect(sent[0].retry).toBeUndefined()
    expect(sent[1].retry).toBe(true)
    expect(terminalReads()).toBeGreaterThanOrEqual(2)
    expect(lecturasDelAparato()).toBeGreaterThanOrEqual(2)
    assertNoSuccess()
    expect(JSON.stringify(toast.mock.calls)).not.toContain('no se cobró')
  }, 10000)
})

const CLAVE_DEL_APARATO = ['tpv', 'venue-1', 'device-1']
const RUTA_DEL_APARATO = '/api/v1/dashboard/venues/venue-1/tpv/device-1'
const lecturasDelAparato = () => apiGet.mock.calls.filter(([ruta]) => ruta === RUTA_DEL_APARATO).length

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

describe('device detail management surfaces', () => {
  beforeEach(() => {
    sesion.role = 'OWNER'
    contexto.venueId = 'venue-1'
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
