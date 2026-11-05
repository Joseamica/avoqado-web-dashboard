/**
 * La campana es por negocio (decisión «A» del founder): con varios negocios, cada uno ve sólo sus avisos
 * (más los anuncios de Avoqado de la persona). Provider REAL, servicio y socket simulados.
 */
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (...a: unknown[]) => void
const h = vi.hoisted(() => ({
  handlers: {} as Record<string, (...a: unknown[]) => void>,
  svc: {
    getNotifications: vi.fn(),
    markAllAsRead: vi.fn(),
    deleteAllNotifications: vi.fn(),
    markAsRead: vi.fn(),
    deleteNotification: vi.fn(),
  },
}))

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/context/SocketContext', () => ({
  useSocket: () => ({
    isConnected: true,
    socket: {
      on: (e: string, fn: Handler) => void (h.handlers[e] = fn),
      off: (e: string) => void delete h.handlers[e],
    },
  }),
}))
const venues = [
  { id: 'v-galeterie', slug: 'galeterie', name: 'Galeterie' },
  { id: 'v-mindform', slug: 'mindform', name: 'Mindform' },
]
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, allVenues: venues, activeVenue: null }) }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueSlug: 'galeterie', venueBasePath: '/venues', fullBasePath: '/venues/galeterie' }),
}))
vi.mock('@/utils/notification.utils', async importOriginal => ({
  ...(await importOriginal<typeof import('@/utils/notification.utils')>()),
  showBrowserNotification: vi.fn(),
}))
vi.mock('@/services/notification.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/notification.service')>()),
  ...h.svc,
}))

import { NotificationProvider, useNotifications } from '../NotificationContext'
import { NotificationsPage } from '@/components/notifications/NotificationsPage'

const aviso = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: `Aviso ${id}`,
  message: 'm',
  type: 'ALERT',
  isRead: false,
  priority: 'NORMAL',
  createdAt: '2026-11-04T12:00:00.000Z',
  ...extra,
})
const respuesta = (avisos: ReturnType<typeof aviso>[], unreadCount = avisos.filter(a => !a.isRead).length) => ({
  notifications: avisos,
  unreadCount,
  pagination: { page: 1, limit: 20, total: avisos.length, totalPages: 1 },
})

let ir: (to: string) => void = () => {}
function Sonda() {
  const n = useNotifications()
  const navigate = useNavigate()
  ir = to => navigate(to)
  return (
    <div>
      <span data-testid="ids">{n.notifications.map(x => x.id).join(',')}</span>
      <span data-testid="count">{n.unreadCount}</span>
      <span data-testid="error">{n.error ?? ''}</span>
      <span data-testid="loading">{String(n.loading)}</span>
      <button onClick={() => n.markAllAsRead()}>marcar</button>
    </div>
  )
}

function montar(ruta: string, hijo: React.ReactNode = <Sonda />) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[ruta]}>
        <NotificationProvider>
          {hijo}
          <Sonda2 />
        </NotificationProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
// sólo para capturar `navigate` cuando el hijo no es la sonda
function Sonda2() {
  const navigate = useNavigate()
  ir = to => navigate(to)
  return null
}

const llamadas = () => h.svc.getNotifications.mock.calls
const ultimoNegocio = () => llamadas()[llamadas().length - 1]?.[2]
// la lista vacía del servidor llega después de armarse el socket; si no, pisaría el aviso en vivo
const esperarLista = async () => {
  await waitFor(() => expect(h.svc.getNotifications).toHaveBeenCalled())
  await act(async () => {})
}
const ids = () => screen.getByTestId('ids').textContent
const cuenta = () => screen.getByTestId('count').textContent

beforeEach(() => {
  vi.clearAllMocks()
  for (const k of Object.keys(h.handlers)) delete h.handlers[k]
  h.svc.getNotifications.mockResolvedValue(respuesta([]))
})

describe('campana por negocio · pedir la lista', () => {
  it('pide la lista con el negocio de la URL', async () => {
    montar('/venues/galeterie/home')
    await waitFor(() => expect(llamadas().length).toBeGreaterThan(0))
    expect(ultimoNegocio()).toBe('v-galeterie')
  })

  it('también en /wl/venues/galeterie/home', async () => {
    montar('/wl/venues/galeterie/home')
    await waitFor(() => expect(llamadas().length).toBeGreaterThan(0))
    expect(ultimoNegocio()).toBe('v-galeterie')
  })

  it('con un slug que aún no está en la lista de negocios NO pide (sería la lista de todos)', async () => {
    montar('/venues/desconocido/home')
    await new Promise(r => setTimeout(r, 50))
    expect(llamadas()).toHaveLength(0)
  })

  it('en pantallas de organización no manda negocio', async () => {
    montar('/organizations/o1/home')
    await waitFor(() => expect(llamadas().length).toBeGreaterThan(0))
    expect(ultimoNegocio()).toBeUndefined()
  })

  it('al cambiar de negocio vuelve a pedir', async () => {
    montar('/venues/galeterie/home')
    await waitFor(() => expect(ultimoNegocio()).toBe('v-galeterie'))
    act(() => ir('/venues/mindform/home'))
    await waitFor(() => expect(ultimoNegocio()).toBe('v-mindform'))
  })

  it('mientras la del nuevo negocio tarda, la lista está vacía (no la del anterior)', async () => {
    h.svc.getNotifications.mockResolvedValueOnce(respuesta([aviso('g1')]))
    montar('/venues/galeterie/home')
    await waitFor(() => expect(ids()).toBe('g1'))
    h.svc.getNotifications.mockReturnValueOnce(new Promise(() => {}))
    act(() => ir('/venues/mindform/home'))
    await waitFor(() => expect(ids()).toBe(''))
    expect(cuenta()).toBe('0')
  })

  it('mientras carga la del nuevo negocio dice «cargando», nunca el vacío', async () => {
    h.svc.getNotifications.mockResolvedValueOnce(respuesta([aviso('g1')]))
    montar('/venues/galeterie/home')
    await waitFor(() => expect(ids()).toBe('g1'))
    expect(screen.getByTestId('loading').textContent).toBe('false')
    let soltar: (v: unknown) => void = () => {}
    h.svc.getNotifications.mockReturnValueOnce(new Promise(r => (soltar = r)))
    act(() => ir('/venues/mindform/home'))
    await waitFor(() => expect(ids()).toBe(''))
    expect(screen.getByTestId('loading').textContent).toBe('true')
    await act(async () => soltar(respuesta([aviso('m1')])))
    await waitFor(() => expect(ids()).toBe('m1'))
    expect(screen.getByTestId('loading').textContent).toBe('false')
  })

  it('si la del nuevo negocio falla, queda vacía con su error', async () => {
    h.svc.getNotifications.mockResolvedValueOnce(respuesta([aviso('g1')]))
    montar('/venues/galeterie/home')
    await waitFor(() => expect(ids()).toBe('g1'))
    h.svc.getNotifications.mockRejectedValueOnce(new Error('sin red'))
    act(() => ir('/venues/mindform/home'))
    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('sin red'))
    expect(ids()).toBe('')
    expect(cuenta()).toBe('0')
  })
})

describe('campana por negocio · acciones', () => {
  it('borrar todas (botón real de NotificationsPage) manda el negocio', async () => {
    h.svc.getNotifications.mockResolvedValue(respuesta([aviso('g1')]))
    h.svc.deleteAllNotifications.mockResolvedValue({ deleted: 1 })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    montar('/venues/galeterie/notifications', <NotificationsPage />)
    await userEvent.click(await screen.findByRole('button', { name: /deleteAll/ }))
    await waitFor(() => expect(h.svc.deleteAllNotifications).toHaveBeenCalledWith('v-galeterie'))
  })

  it('marcar todo de A que responde después de cambiar a B no marca B como leído', async () => {
    h.svc.getNotifications.mockResolvedValueOnce(respuesta([aviso('g1')]))
    let soltar: (v: unknown) => void = () => {}
    h.svc.markAllAsRead.mockReturnValue(new Promise(r => (soltar = r)))
    montar('/venues/galeterie/home')
    await waitFor(() => expect(ids()).toBe('g1'))
    await userEvent.click(screen.getByText('marcar'))
    expect(h.svc.markAllAsRead).toHaveBeenCalledWith('v-galeterie')

    h.svc.getNotifications.mockResolvedValue(respuesta([aviso('m1'), aviso('m2')]))
    act(() => ir('/venues/mindform/home'))
    await waitFor(() => expect(ids()).toBe('m1,m2'))
    expect(cuenta()).toBe('2')

    await act(async () => soltar({ count: 1 }))
    expect(cuenta()).toBe('2')
    expect(ids()).toBe('m1,m2')
  })

  it('confirmar como leído un id que no está en la lista no baja el contador', async () => {
    h.svc.getNotifications.mockResolvedValue(respuesta([aviso('g1')]))
    montar('/venues/galeterie/home')
    await waitFor(() => expect(cuenta()).toBe('1'))
    act(() => h.handlers['notification:updated']({ id: 'de-otro-negocio', isRead: true }))
    expect(cuenta()).toBe('1')
    act(() => h.handlers['notification:updated']({ id: 'g1', isRead: true }))
    expect(cuenta()).toBe('0')
    // ya leído: otra confirmación tampoco resta
    act(() => h.handlers['notification:updated']({ id: 'g1', isRead: true }))
    expect(cuenta()).toBe('0')
  })
})

describe('campana por negocio · avisos en vivo', () => {
  it('un aviso en vivo de otro negocio no entra ni sube el contador, aunque sea ANNOUNCEMENT', async () => {
    montar('/venues/galeterie/home')
    await waitFor(() => expect(h.handlers['notification_new']).toBeDefined())
    await esperarLista()
    act(() => h.handlers['notification_new']({ id: 'x1', venueId: 'v-mindform', type: 'ANNOUNCEMENT', title: 't', message: 'm', priority: 'NORMAL', isRead: false }))
    act(() => h.handlers['notification_new']({ id: 'x2', venueId: 'v-mindform', type: 'ALERT', title: 't', message: 'm', priority: 'NORMAL', isRead: false }))
    expect(ids()).toBe('')
    expect(cuenta()).toBe('0')
    act(() => h.handlers['notification_new']({ id: 'g9', venueId: 'v-galeterie', type: 'ALERT', title: 't', message: 'm', priority: 'NORMAL', isRead: false }))
    expect(ids()).toBe('g9')
    expect(cuenta()).toBe('1')
  })

  it('en pantallas de organización entran los avisos de cualquier negocio', async () => {
    montar('/organizations/o1/home')
    await waitFor(() => expect(h.handlers['notification_new']).toBeDefined())
    await esperarLista()
    act(() => h.handlers['notification_new']({ id: 'x1', venueId: 'v-mindform', type: 'ALERT', title: 't', message: 'm', priority: 'NORMAL', isRead: false }))
    expect(ids()).toBe('x1')
  })
})
