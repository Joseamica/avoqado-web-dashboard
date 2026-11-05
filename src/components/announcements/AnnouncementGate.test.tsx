import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Link, Outlet, RouterProvider, createMemoryRouter } from 'react-router-dom'
import { delay, http, HttpResponse } from 'msw'
import { server } from '@/test/setup'
import type { Announcement } from '@/services/announcement.service'
import { almacenLocalConMemoria } from './__tests__/almacenLocal'
import { AnnouncementGate } from './AnnouncementGate'

const sesion = vi.hoisted(() => ({ user: { id: 'staff-ana' } as { id: string } | null }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: sesion.user }) }))

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const first: Announcement = {
  id: 'c0000000000000000000000001',
  title: 'Nueva función de prueba',
  body: 'Disponible para este negocio.',
  priority: 'NORMAL',
  showAsBanner: false,
  showAsModal: true,
}
const second: Announcement = { ...first, id: 'c0000000000000000000000002', title: 'Otro anuncio pendiente' }
let pending: Announcement | null
let requests: number
let failing: boolean
let dismissed: string[]
const clients: QueryClient[] = []

beforeEach(() => {
  pending = null
  requests = 0
  failing = false
  dismissed = []
  sesion.user = { id: 'staff-ana' }
  almacenLocalConMemoria()
  server.use(
    http.get('*/api/v1/dashboard/announcements/home', () => {
      requests++
      return failing
        ? HttpResponse.json({ message: 'Fallo temporal' }, { status: 500 })
        : HttpResponse.json({ success: true, data: { banner: null, modal: pending } })
    }),
    http.post('*/api/v1/dashboard/announcements/:id/dismiss', ({ params }) => {
      dismissed.push(String(params.id))
      return HttpResponse.json({ success: true })
    }),
  )
})

afterEach(() => {
  cleanup()
  clients.forEach(client => client.clear())
  clients.length = 0
})

function mount(cached = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  clients.push(client)
  if (cached) client.setQueryData(['announcements', 'home'], { banner: null, modal: null }, { updatedAt: 1 })
  function Layout() {
    return (
      <>
        <Link to="/venues/prueba/reports">Reportes</Link>
        <Link to="/venues/prueba/settings">Ajustes</Link>
        <Outlet />
        <AnnouncementGate />
      </>
    )
  }
  const router = createMemoryRouter([
    {
      path: '/venues/:slug',
      element: <Layout />,
      children: [
        { path: 'reports', element: <h1>Reporte de prueba</h1> },
        { path: 'settings', element: <h1>Ajustes de prueba</h1> },
      ],
    },
  ], { initialEntries: ['/venues/prueba/reports'] })
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)
  return { client, router, user: userEvent.setup() }
}

describe('AnnouncementGate — anuncios pendientes al navegar', () => {
  it('muestra un anuncio ya disponible al entrar', async () => {
    pending = first
    mount()
    expect(await screen.findByRole('dialog', { name: first.title })).toHaveTextContent(first.title)
  })

  it('al cambiar de pantalla muestra el anuncio publicado después de la primera consulta, aunque siga fresca', async () => {
    const { client, user } = mount()
    await waitFor(() => expect(client.getQueryState(['announcements', 'home'])?.status).toBe('success'))
    pending = first
    await user.click(screen.getByRole('link', { name: 'Ajustes' }))
    expect(screen.getByRole('heading', { name: 'Ajustes de prueba', hidden: true })).toBeInTheDocument()
    expect(await screen.findByRole('dialog')).toHaveTextContent(first.title)
  })

  it('cerrar un anuncio no impide mostrar otro nuevo al navegar', async () => {
    pending = first
    const { user } = mount()
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Ahora no' }))
    await waitFor(() => expect(dismissed).toEqual([first.id]))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    pending = second
    await user.click(screen.getByRole('link', { name: 'Ajustes' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent(second.title)
  })

  it('no vuelve a mostrar el mismo anuncio cerrado aunque una respuesta todavía lo incluya', async () => {
    pending = first
    const { user } = mount()
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Ahora no' }))
    await waitFor(() => expect(dismissed).toEqual([first.id]))
    const previousRequests = requests
    await user.click(screen.getByRole('link', { name: 'Ajustes' }))
    await waitFor(() => expect(requests).toBeGreaterThan(previousRequests))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('vuelve a intentar la consulta en la siguiente pantalla después de un fallo temporal', async () => {
    failing = true
    const { client, user } = mount()
    await waitFor(() => expect(client.getQueryState(['announcements', 'home'])?.status).toBe('error'))
    failing = false
    pending = first
    await user.click(screen.getByRole('link', { name: 'Ajustes' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent(first.title)
  })

  it('cambiar sólo filtros o pestañas de la misma pantalla no dispara otra consulta', async () => {
    const { client, router } = mount()
    await waitFor(() => expect(client.getQueryState(['announcements', 'home'])?.status).toBe('success'))
    const previousRequests = requests
    await act(async () => { await router.navigate('/venues/prueba/reports?search=abc#detalle') })
    expect(requests).toBe(previousRequests)
  })

  it('reutiliza la consulta en curso al entrar con caché vencida, sin duplicar peticiones', async () => {
    server.use(http.get('*/api/v1/dashboard/announcements/home', async () => {
      requests++
      await delay(30)
      return HttpResponse.json({ success: true, data: { banner: null, modal: first } })
    }))
    mount(true)
    expect(await screen.findByRole('dialog', { name: first.title })).toBeInTheDocument()
    expect(requests).toBe(1)
  })

  // ── 15b: el cierre sin red se recuerda ────────────────────────────────────────
  const clave = 'avoqado:anuncios-cerrados:staff-ana'

  it('un cierre sin red no vuelve a enseñar la ventana tras recargar', async () => {
    server.use(http.post('*/api/v1/dashboard/announcements/:id/dismiss', () => HttpResponse.error()))
    pending = first
    const primero = mount()
    await screen.findByRole('dialog')
    await primero.user.click(screen.getByRole('button', { name: 'Ahora no' }))
    await waitFor(() => expect(JSON.parse(localStorage.getItem(clave)!)).toEqual([{ id: first.id, sincronizado: false }]))
    cleanup()
    mount()
    await waitFor(() => expect(requests).toBeGreaterThan(1))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('volver al negocio antes de 60 s no reabre la ventana cerrada', async () => {
    server.use(http.post('*/api/v1/dashboard/announcements/:id/dismiss', () => HttpResponse.error()))
    pending = first
    const { client, user } = mount()
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Ahora no' }))
    await waitFor(() => expect(localStorage.getItem(clave)).toContain(first.id))
    // la caché sigue trayendo el anuncio (frescura de 60 s) y el componente se vuelve a montar
    client.setQueryData(['announcements', 'home'], { banner: null, modal: first })
    cleanup()
    const cliente2 = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    clients.push(cliente2)
    cliente2.setQueryData(['announcements', 'home'], { banner: null, modal: first })
    const router = createMemoryRouter([{ path: '/venues/:slug', element: <><Outlet /><AnnouncementGate /></>, children: [{ path: 'reports', element: <h1>R</h1> }] }], { initialEntries: ['/venues/prueba/reports'] })
    render(<QueryClientProvider client={cliente2}><RouterProvider router={router} /></QueryClientProvider>)
    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('al volver la red se manda el cierre y queda marcado como sincronizado (no se borra)', async () => {
    localStorage.setItem(clave, JSON.stringify([{ id: first.id, sincronizado: false }]))
    const cuerpos: unknown[] = []
    server.use(http.post('*/api/v1/dashboard/announcements/:id/dismiss', async ({ request, params }) => {
      cuerpos.push(await request.json())
      dismissed.push(String(params.id))
      return HttpResponse.json({ success: true })
    }))
    mount()
    await waitFor(() => expect(dismissed).toEqual([first.id]))
    expect(cuerpos).toEqual([{ staffId: 'staff-ana' }])
    await waitFor(() => expect(JSON.parse(localStorage.getItem(clave)!)).toEqual([{ id: first.id, sincronizado: true }]))
  })

  it('un 409 deja el cierre pendiente', async () => {
    localStorage.setItem(clave, JSON.stringify([{ id: first.id, sincronizado: false }]))
    server.use(http.post('*/api/v1/dashboard/announcements/:id/dismiss', () =>
      HttpResponse.json({ code: 'CIERRE_DE_OTRA_PERSONA' }, { status: 409 })))
    mount()
    await waitFor(() => expect(requests).toBeGreaterThan(0))
    await new Promise(r => setTimeout(r, 50))
    expect(JSON.parse(localStorage.getItem(clave)!)).toEqual([{ id: first.id, sincronizado: false }])
  })

  it('el cierre pendiente de otra persona no se manda con la sesión actual', async () => {
    localStorage.setItem('avoqado:anuncios-cerrados:staff-beto', JSON.stringify([{ id: first.id, sincronizado: false }]))
    mount()
    await waitFor(() => expect(requests).toBeGreaterThan(0))
    await new Promise(r => setTimeout(r, 50))
    expect(dismissed).toEqual([])
  })

  it('al volver a estar en línea reintenta los pendientes', async () => {
    mount()
    await waitFor(() => expect(requests).toBeGreaterThan(0))
    localStorage.setItem(clave, JSON.stringify([{ id: first.id, sincronizado: false }]))
    window.dispatchEvent(new Event('online'))
    await waitFor(() => expect(dismissed).toEqual([first.id]))
  })

  it('un valor corrupto en localStorage se trata como lista vacía', async () => {
    localStorage.setItem(clave, '{no es json')
    pending = first
    mount()
    expect(await screen.findByRole('dialog')).toHaveTextContent(first.title)
  })
})
