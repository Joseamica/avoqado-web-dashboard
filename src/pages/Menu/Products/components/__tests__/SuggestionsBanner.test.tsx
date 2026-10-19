/**
 * Variantes de producto, bloque 2 (Tarea 11): el aviso «Encontramos N grupos de productos que parecen variantes» en la lista de Productos.
 * Sólo con plan resuelto + `menu:update` + total > 0; se cierra por negocio (localStorage con try/catch: si el navegador lo niega, sólo
 * se cierra en la sesión). `t` pega los valores con «:». vitest corre con mockReset: las respuestas van en beforeEach.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { productGroupKeys } from '@/features/product-variants/queryKeys'

const grupos = vi.hoisted(() => ({ getGroupSuggestions: vi.fn() }))
const estables = vi.hoisted(() => ({
  acceso: { hasAccess: true, isResolved: true, isLoading: false, requiredTier: 'PRO' as const },
  permisos: { puedeActualizar: true },
  i18n: {
    t: (k: string, o?: Record<string, unknown>) =>
      [k, ...Object.entries(o ?? {}).flatMap(([c, v]) => (c === 'defaultValue' ? [] : [String(v)]))].join(':'),
    i18n: { language: 'es' },
  },
}))
vi.mock('@/services/productGroups.service', () => grupos)
vi.mock('@/hooks/use-tier-feature-access', () => ({ useTierFeatureAccess: () => estables.acceso }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => p === 'menu:update' && estables.permisos.puedeActualizar }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => estables.i18n }))

import { SuggestionsBanner } from '../SuggestionsBanner'

// `src/test/setup.ts` cambia localStorage por vi.fn() (y mockReset los deja sin comportamiento): aquí vuelven a guardar en un Map.
const memoria = new Map<string, string>()
const respuesta = (total: number) => ({ items: [], total, page: 1, pageSize: 20 })
const LLAVE = 'variants:sugerencias-cerradas:v1'

function pintar(venueId = 'v1') {
  const onRevisar = vi.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const ui = (id: string) => (
    <QueryClientProvider client={qc}>
      <SuggestionsBanner venueId={id} onRevisar={onRevisar} />
    </QueryClientProvider>
  )
  const vista = render(ui(venueId))
  const estado = (id = venueId) => qc.getQueryState(productGroupKeys.suggestions(id))?.status
  return { onRevisar, vista, estado, otraVez: (id = venueId) => vista.rerender(ui(id)) }
}

beforeEach(() => {
  memoria.clear()
  vi.mocked(localStorage.getItem).mockImplementation(k => memoria.get(k) ?? null)
  vi.mocked(localStorage.setItem).mockImplementation((k, v) => void memoria.set(k, String(v)))
  estables.acceso = { hasAccess: true, isResolved: true, isLoading: false, requiredTier: 'PRO' }
  estables.permisos.puedeActualizar = true
  grupos.getGroupSuggestions.mockResolvedValue(respuesta(3))
})

describe('SuggestionsBanner', () => {
  it('con plan, permiso y sugerencias dice cuántos grupos y «Revisar» abre el diálogo', async () => {
    const { onRevisar } = pintar()
    expect(await screen.findByText('fuentes.aviso:3')).toBeInTheDocument()
    expect(grupos.getGroupSuggestions).toHaveBeenCalledWith('v1', { page: 1, pageSize: 20 })
    fireEvent.click(screen.getByRole('button', { name: 'fuentes.avisoRevisar' }))
    expect(onRevisar).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['sin plan', () => (estables.acceso = { hasAccess: false, isResolved: true, isLoading: false, requiredTier: 'PRO' })],
    ['con el plan sin resolver', () => (estables.acceso = { hasAccess: true, isResolved: false, isLoading: true, requiredTier: 'PRO' })],
    ['sin el permiso menu:update', () => (estables.permisos.puedeActualizar = false)],
  ])('%s: no se muestra y ni siquiera pide las sugerencias', async (_caso, preparar) => {
    preparar()
    pintar()
    await new Promise(r => setTimeout(r, 30))
    expect(screen.queryByText(/fuentes\.aviso/)).not.toBeInTheDocument()
    expect(grupos.getGroupSuggestions).not.toHaveBeenCalled()
  })

  it('sin sugerencias (total 0) no se muestra, una vez que la consulta SÍ respondió', async () => {
    grupos.getGroupSuggestions.mockResolvedValue(respuesta(0))
    const { estado } = pintar()
    await waitFor(() => expect(estado()).toBe('success'))
    expect(screen.queryByText(/fuentes\.aviso/)).not.toBeInTheDocument()
  })

  it('si la consulta falla (después de su reintento) tampoco se muestra', async () => {
    grupos.getGroupSuggestions.mockRejectedValue({ response: { status: 409, data: { message: 'catálogo maestro' } } })
    const { estado } = pintar()
    // `useGroupSuggestions` trae retry: 1 (1 s): hay que esperar al estado de error de verdad, no a la primera llamada.
    await waitFor(() => expect(estado()).toBe('error'), { timeout: 4000 })
    expect(grupos.getGroupSuggestions).toHaveBeenCalledTimes(2)
    expect(screen.queryByText(/fuentes\.aviso/)).not.toBeInTheDocument()
  })

  it('cerrarlo se recuerda por negocio: no vuelve al remontar, pero otro negocio sí lo ve', async () => {
    const { vista } = pintar()
    await screen.findByText('fuentes.aviso:3')
    fireEvent.click(screen.getByRole('button', { name: 'fuentes.avisoCerrar' }))
    expect(screen.queryByText(/fuentes\.aviso:/)).not.toBeInTheDocument()
    expect(memoria.get(LLAVE)).toBe('1')

    vista.unmount()
    const siguiente = pintar()
    await new Promise(r => setTimeout(r, 30))
    expect(screen.queryByText(/fuentes\.aviso:/)).not.toBeInTheDocument()

    // mismo componente montado, cambia el negocio: el de v2 nunca se cerró
    siguiente.otraVez('v2')
    expect(await screen.findByText('fuentes.aviso:3')).toBeInTheDocument()
    expect(memoria.has('variants:sugerencias-cerradas:v2')).toBe(false)
  })

  it('si el navegador niega localStorage el aviso se ve y se cierra en la sesión sin romper nada', async () => {
    const denegado = () => {
      throw new Error('denegado')
    }
    vi.mocked(localStorage.getItem).mockImplementation(denegado)
    const guardar = vi.mocked(localStorage.setItem).mockImplementation(denegado)
    pintar()
    expect(await screen.findByText('fuentes.aviso:3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'fuentes.avisoCerrar' }))
    expect(guardar).toHaveBeenCalled()
    expect(screen.queryByText(/fuentes\.aviso:/)).not.toBeInTheDocument()
  })
})
