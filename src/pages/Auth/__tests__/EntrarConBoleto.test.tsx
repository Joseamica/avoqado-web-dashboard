import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const orden: string[] = []
let respuesta: () => Promise<unknown> = () => Promise.resolve()
let boleto: string | null = 'abc'
const navigate = vi.fn((...a: unknown[]) => orden.push(`navigate:${JSON.stringify(a)}`))
const track = vi.fn((...a: unknown[]) => orden.push(`track:${JSON.stringify(a)}`))

vi.mock('@/services/auth.service', () => ({
  entrarConBoleto: (b: string) => {
    orden.push(`entrar:${b}`)
    return respuesta()
  },
}))
vi.mock('@/lib/boleto-de-alta-capture', () => ({ tomarBoletoDeAlta: () => boleto }))
vi.mock('@/lib/posthog', () => ({ track: (...a: unknown[]) => track(...a) }))
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    refetchQueries: (o: unknown) => {
      orden.push(`status:${JSON.stringify(o)}`)
      return Promise.resolve()
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
  respuesta = () => Promise.resolve()
})

describe('EntrarConBoleto', () => {
  it('canjea UNA vez, refresca la sesión, mide y va a /setup', async () => {
    pintar()
    await waitFor(() => expect(navigate).toHaveBeenCalled())
    expect(orden).toEqual([
      'entrar:abc',
      'status:{"queryKey":["status"]}',
      'track:["alta_entrada",{"via":"codigo"}]',
      'navigate:["/setup",{"replace":true}]',
    ])
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
