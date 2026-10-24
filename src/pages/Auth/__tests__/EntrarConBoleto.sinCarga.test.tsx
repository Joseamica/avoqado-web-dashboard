import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

const getAuthStatus = vi.fn()
const entrarConBoleto = vi.fn()
vi.mock('@/services/auth.service', () => ({
  AUTH_STATUS_QUERY_KEY: ['status'],
  getAuthStatus: () => getAuthStatus(),
  entrarConBoleto: (b: string) => entrarConBoleto(b),
}))
const tomar = vi.fn(() => 'abc')
vi.mock('@/lib/boleto-de-alta-capture', () => ({ tomarBoletoDeAlta: () => tomar() }))
vi.mock('@/lib/posthog', () => ({ track: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

import EntrarConBoleto from '../EntrarConBoleto'

// Imita a AuthProvider: mientras la query de status carga sin datos, cambia los hijos por una pantalla de carga.
const Proveedor = ({ children }: { children: ReactNode }) => {
  const { isLoading } = useQuery({ queryKey: ['status'], queryFn: () => getAuthStatus(), retry: false })
  return isLoading ? <div>LOADING</div> : <>{children}</>
}

const pintar = (qc: QueryClient) =>
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/auth/entrar']}>
        <Proveedor>
          <Routes>
            <Route path="/auth/entrar" element={<EntrarConBoleto />} />
            <Route path="/setup" element={<div>SETUP</div>} />
          </Routes>
        </Proveedor>
      </MemoryRouter>
    </QueryClientProvider>,
  )

beforeEach(() => {
  getAuthStatus.mockReset()
  entrarConBoleto.mockReset()
  tomar.mockClear()
})

describe('EntrarConBoleto no provoca cargas en la query de status', () => {
  it('con el status en error y sin datos, canjear y refrescar no desmontan la página ni piden status antes del canje', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    getAuthStatus.mockRejectedValueOnce(new Error('Network Error')) // primer status del proveedor: falla
    entrarConBoleto.mockResolvedValue(undefined)
    getAuthStatus.mockResolvedValue({ authenticated: true })
    const vistos: string[] = []
    entrarConBoleto.mockImplementation(async () => void vistos.push(`canje tras ${getAuthStatus.mock.calls.length} status`))
    pintar(qc)
    await waitFor(() => expect(screen.getByText('SETUP')).toBeInTheDocument())
    expect(tomar).toHaveBeenCalledTimes(1) // la página se montó UNA vez (no la desmontó la pantalla de carga)
    expect(entrarConBoleto).toHaveBeenCalledTimes(1)
    expect(vistos).toEqual(['canje tras 1 status']) // solo el primero (ya fallido); ninguno nuevo antes del canje
    expect(getAuthStatus).toHaveBeenCalledTimes(2) // 1 fallido + 1 de refrescar
  })
})
