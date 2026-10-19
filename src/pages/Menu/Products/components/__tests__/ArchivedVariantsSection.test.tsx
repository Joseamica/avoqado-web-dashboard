/**
 * Variantes de producto, bloque 2 (Tarea 7): las archivadas de una familia (lista nueva ⇒ regla de datos acotados).
 * Cerrada no pide nada; abierta pide la página 1 y «Cargar más» la siguiente; error, vacío y cargando se distinguen.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const grupos = vi.hoisted(() => ({ getArchivedVariants: vi.fn() }))
vi.mock('@/services/productGroups.service', () => grupos)
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (d: string) => `fecha:${d}` }) }))

import type { ProductGroupDetail } from '@/types/productGroup'
import { ArchivedVariantsSection } from '../ArchivedVariantsSection'

const familia = { id: 'g1', name: 'Playera', archivedCount: 2 } as ProductGroupDetail
const a1 = { id: 'p8', name: 'Playera · XS', sku: 'PL-XS', archivedAt: '2026-10-01T12:00:00.000Z' }
const a2 = { id: 'p9', name: 'Playera · XXL', sku: 'PL-XXL', archivedAt: '2026-09-01T12:00:00.000Z' }

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <ArchivedVariantsSection venueId="v1" familia={familia} />
    </QueryClientProvider>,
  )
}
const abrir = () => fireEvent.click(screen.getByRole('button', { name: /archivadas\.titulo/ }))

beforeEach(() => {
  grupos.getArchivedVariants.mockImplementation((_v: string, _g: string, p: { page: number }) =>
    Promise.resolve({ items: p.page === 1 ? [a1] : [a2], total: 2, page: p.page, pageSize: 1 }),
  )
})

describe('ArchivedVariantsSection', () => {
  it('cerrada no pide nada; al abrir pide la página 1 y «Cargar más» trae la siguiente', async () => {
    pintar()
    expect(grupos.getArchivedVariants).not.toHaveBeenCalled()
    abrir()
    expect(await screen.findByText('Playera · XS')).toBeInTheDocument()
    expect(screen.getByText('PL-XS · fecha:2026-10-01T12:00:00.000Z')).toBeInTheDocument()
    expect(grupos.getArchivedVariants).toHaveBeenCalledWith('v1', 'g1', { page: 1, pageSize: 25 })
    fireEvent.click(screen.getByRole('button', { name: 'archivadas.cargarMas' }))
    expect(await screen.findByText('Playera · XXL')).toBeInTheDocument()
    expect(screen.getByText('Playera · XS')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'archivadas.cargarMas' })).not.toBeInTheDocument()
  })

  it('un error no se ve como «no hay archivadas» y deja reintentar', async () => {
    grupos.getArchivedVariants.mockRejectedValue({ response: { status: 500 } })
    pintar()
    abrir()
    // useArchivedVariants reintenta una vez (retry: 1, ~1 s) antes de dar el error.
    expect(await screen.findByText('archivadas.error', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.queryByText('archivadas.vacio')).not.toBeInTheDocument()
    grupos.getArchivedVariants.mockResolvedValue({ items: [a1], total: 1, page: 1, pageSize: 25 })
    fireEvent.click(screen.getByRole('button', { name: 'familia.reintentar' }))
    expect(await screen.findByText('Playera · XS')).toBeInTheDocument()
  })

  it('vacía lo dice', async () => {
    grupos.getArchivedVariants.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 })
    pintar()
    abrir()
    expect(await screen.findByText('archivadas.vacio')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('archivadas.cargando')).not.toBeInTheDocument())
  })
})
