import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useClaseDelEnlace } from '../useClaseDelEnlace'

const m = vi.hoisted(() => ({ get: vi.fn(), toast: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/services/classSession.service', () => ({ default: { getClassSession: (...a: unknown[]) => m.get(...a) } }))

const ID = 'cmusk8etn06jwc9579afamwp9'
function montar(url: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  const abrir = vi.fn()
  const r = renderHook(
    () => {
      useClaseDelEnlace('v1', abrir)
      return useLocation()
    },
    { wrapper },
  )
  return { abrir, r, qc }
}

beforeEach(() => vi.clearAllMocks())

describe('?clase= del calendario', () => {
  it('abre la clase cuando carga, con la misma llave que el diálogo, y quita el parámetro', async () => {
    m.get.mockResolvedValue({ id: ID })
    const { abrir, r, qc } = montar(`/cal?clase=${ID}&vista=semana`)
    await waitFor(() => expect(abrir).toHaveBeenCalledWith(ID))
    expect(m.get).toHaveBeenCalledWith('v1', ID)
    expect(qc.getQueryData(['class-session', 'v1', ID])).toEqual({ id: ID })
    expect(r.result.current.search).toBe('?vista=semana')
    expect(m.toast).not.toHaveBeenCalled()
  })

  it('si la clase no carga (borrada, de otra sede), avisa y NO abre un diálogo vacío', async () => {
    m.get.mockRejectedValue(Object.assign(new Error('404'), { response: { status: 404 } }))
    const { abrir } = montar(`/cal?clase=${ID}`)
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'classSession.linkNotFound' })))
    expect(abrir).not.toHaveBeenCalled()
  })

  it('un id sin forma de id se ignora: ni se pide ni se abre, y el parámetro se quita', async () => {
    const { abrir, r } = montar('/cal?clase=no-es-un-id')
    await waitFor(() => expect(r.result.current.search).toBe(''))
    expect(m.get).not.toHaveBeenCalled()
    expect(abrir).not.toHaveBeenCalled()
  })
})
