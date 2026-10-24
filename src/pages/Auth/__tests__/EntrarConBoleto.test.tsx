import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const orden: string[] = []
let respuesta: () => Promise<unknown> = () => Promise.resolve()
let boleto: string | null = 'abc'
const navigate = vi.fn((...a: unknown[]) => orden.push(`navigate:${JSON.stringify(a)}`))
const track = vi.fn((...a: unknown[]) => orden.push(`track:${JSON.stringify(a)}`))

let enVuelo = 0
let estado: () => Promise<unknown> = () => Promise.resolve({ authenticated: true })
vi.mock('@/services/auth.service', () => ({
  AUTH_STATUS_QUERY_KEY: ['status'],
  getAuthStatus: () => estado(),
  entrarConBoleto: (b: string) => {
    orden.push(`entrar:${b}`)
    return respuesta()
  },
}))
vi.mock('@/lib/boleto-de-alta-capture', () => ({ tomarBoletoDeAlta: () => boleto }))
vi.mock('@/lib/posthog', () => ({ track: (...a: unknown[]) => track(...a) }))
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    isFetching: () => enVuelo,
    setQueryData: (k: unknown) => orden.push(`set:${JSON.stringify(k)}`),
    cancelQueries: (o: unknown) => {
      orden.push(`cancel:${JSON.stringify(o)}`)
      return Promise.resolve()
    },
    fetchQuery: (o: { queryKey: unknown; queryFn: () => Promise<unknown> }) => {
      orden.push(`status:${JSON.stringify(o.queryKey)}`)
      return o.queryFn()
    },
  }),
}))
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<object>('react-router-dom')),
  useNavigate: () => navigate,
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

import EntrarConBoleto from '../EntrarConBoleto'

const pintar = () =>
  render(
    <StrictMode>
      <MemoryRouter initialEntries={['/auth/entrar']}>
        <Routes>
          <Route path="/auth/entrar" element={<EntrarConBoleto />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  )

beforeEach(() => {
  orden.length = 0
  navigate.mockClear()
  track.mockClear()
  boleto = 'abc'
  enVuelo = 0
  respuesta = () => Promise.resolve()
  estado = () => Promise.resolve({ authenticated: true })
})

describe('EntrarConBoleto', () => {
  it('canjea UNA vez, refresca la sesión, mide y va a /setup', async () => {
    pintar()
    await waitFor(() => expect(navigate).toHaveBeenCalled())
    expect(orden).toEqual([
      'entrar:abc',
      'cancel:{"queryKey":["status"]}',
      'set:["status"]',
      'track:["alta_entrada",{"via":"codigo"}]',
      'navigate:["/setup",{"replace":true}]',
    ])
  })

  it('espera a que termine el status que ya iba en vuelo ANTES de canjear', async () => {
    let soltar!: () => void
    const primero = new Promise(r => (soltar = () => r({ authenticated: false })))
    let llamadas = 0
    estado = () => (llamadas++ === 0 ? primero : Promise.resolve({ authenticated: true }))
    enVuelo = 1
    pintar()
    await waitFor(() => expect(orden).toContain('status:["status"]'))
    await new Promise(r => setTimeout(r, 20))
    expect(orden.filter(o => o.startsWith('entrar:'))).toEqual([])
    soltar()
    await waitFor(() => expect(navigate).toHaveBeenCalled())
    expect(orden.findIndex(o => o.startsWith('entrar:'))).toBeGreaterThan(0)
  })

  it('si el refresco de sesión falla no mide ni navega, y Reintentar solo refresca (no recanjea)', async () => {
    estado = () => Promise.reject(new Error('Network Error'))
    pintar()
    expect(await screen.findByText('entrarConBoleto.offlineTitle')).toBeInTheDocument()
    expect(track).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
    estado = () => Promise.resolve({ authenticated: true })
    fireEvent.click(screen.getByText('entrarConBoleto.retry'))
    await waitFor(() => expect(navigate).toHaveBeenCalled())
    expect(orden.filter(o => o.startsWith('entrar:'))).toEqual(['entrar:abc'])
  })

  it('si tras refrescar no hay sesión no mide ni navega', async () => {
    estado = () => Promise.resolve({ authenticated: false })
    pintar()
    expect(await screen.findByText('entrarConBoleto.offlineTitle')).toBeInTheDocument()
    expect(track).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it.each([
    ['410', { response: { status: 410, data: { code: 'BOLETO_USADO' } } }],
    ['404', { response: { status: 404 } }],
    ['429', { response: { status: 429 } }],
  ])('con %s muestra la tarjeta de acceso vencido', async (_n, err) => {
    respuesta = () => Promise.reject(Object.assign(new Error('x'), err))
    pintar()
    expect(await screen.findByText('entrarConBoleto.usedTitle')).toBeInTheDocument()
    expect(screen.getByText('entrarConBoleto.login').closest('a')).toHaveAttribute('href', '/login')
    expect(screen.getByText('entrarConBoleto.forgot').closest('a')).toHaveAttribute('href', '/auth/forgot-password')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('sin respuesta del servidor (red) ofrece reintentar con el MISMO boleto', async () => {
    respuesta = () => Promise.reject(new Error('Network Error'))
    pintar()
    expect(await screen.findByText('entrarConBoleto.offlineTitle')).toBeInTheDocument()
    expect(screen.queryByText('entrarConBoleto.usedTitle')).toBeNull()
    respuesta = () => Promise.resolve()
    fireEvent.click(screen.getByText('entrarConBoleto.retry'))
    await waitFor(() => expect(navigate).toHaveBeenCalled())
    expect(orden.filter(o => o.startsWith('entrar:'))).toEqual(['entrar:abc', 'entrar:abc'])
  })

  it('sin boleto no llama al servidor y muestra la tarjeta', async () => {
    boleto = null
    pintar()
    expect(await screen.findByText('entrarConBoleto.usedTitle')).toBeInTheDocument()
    expect(orden).toEqual([])
  })
})
