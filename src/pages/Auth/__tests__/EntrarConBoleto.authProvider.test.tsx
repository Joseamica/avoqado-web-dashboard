import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getAuthStatus = vi.fn()
const entrarConBoleto = vi.fn()
vi.mock('@/services/auth.service', async () => ({
  ...(await vi.importActual<object>('@/services/auth.service')),
  getAuthStatus: () => getAuthStatus(),
  entrarConBoleto: (b: string) => entrarConBoleto(b),
}))
vi.mock('@/lib/boleto-de-alta-capture', () => ({ tomarBoletoDeAlta: () => 'abc' }))
vi.mock('@/lib/posthog', () => ({ track: vi.fn(), identifyUser: vi.fn(), resetUser: vi.fn() }))
vi.mock('@/services/liveDemo.service', () => ({ isLiveDemoEnvironment: () => false }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

import { AuthProvider } from '@/context/AuthContext'
import EntrarConBoleto from '../EntrarConBoleto'

const usuario = { id: 'u1', role: 'OWNER', venues: [], email: 'a@b.c' }
const pintar = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/auth/entrar']}>
        <AuthProvider>
          <Routes>
            <Route path="/auth/entrar" element={<EntrarConBoleto />} />
            <Route path="/setup" element={<div>SETUP</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  getAuthStatus.mockReset()
  entrarConBoleto.mockReset()
})

describe('EntrarConBoleto dentro del AuthProvider real', () => {
  it('no pide status antes del canje ni con foco de ventana durante el canje; al terminar va a /setup autenticado', async () => {
    let terminarCanje!: () => void
    entrarConBoleto.mockImplementation(() => new Promise<void>(r => (terminarCanje = r)))
    getAuthStatus.mockResolvedValue({ authenticated: true, user: usuario })
    pintar()
    await waitFor(() => expect(entrarConBoleto).toHaveBeenCalledTimes(1))
    expect(getAuthStatus).not.toHaveBeenCalled() // (a)
    fireEvent.focus(window)
    window.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('online'))
    await new Promise(r => setTimeout(r, 30))
    expect(getAuthStatus).not.toHaveBeenCalled() // (b)
    expect(screen.queryByText('SETUP')).toBeNull()
    terminarCanje()
    await waitFor(() => expect(screen.getByText('SETUP')).toBeInTheDocument()) // (c)
    expect(getAuthStatus).toHaveBeenCalledTimes(1)
    expect(entrarConBoleto).toHaveBeenCalledTimes(1)
  })
})
