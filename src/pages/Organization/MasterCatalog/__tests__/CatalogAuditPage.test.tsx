import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CatalogAuditPage from '../CatalogAuditPage'
import * as catalogApi from '@/features/master-catalog/api'

vi.mock('@/features/master-catalog/api', async importOriginal => {
  const actual = await importOriginal<typeof catalogApi>()
  return { ...actual, listCatalogAudit: vi.fn(), listCatalogAuditActions: vi.fn() }
})
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key }),
}))

describe('CatalogAuditPage', () => {
  beforeEach(() => {
    vi.mocked(catalogApi.listCatalogAuditActions).mockResolvedValue(['CATALOG_ITEM_UPDATED'])
    vi.mocked(catalogApi.listCatalogAudit).mockResolvedValue({
      logs: [
        {
          id: 'log-1',
          action: 'CATALOG_ITEM_UPDATED',
          entity: 'CatalogItem',
          entityId: 'item-1',
          createdAt: '2026-08-09T12:00:00.000Z',
          staff: { firstName: 'Ana', lastName: 'Pérez' },
          venue: null,
        },
      ],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    } as never)
  })

  it('renders organization audit rows with actor, entity and deterministic timestamp columns', async () => {
    render(
      <MemoryRouter initialEntries={['/organizations/org-1/master-catalog/audit']}>
        <Routes>
          <Route path="/organizations/:orgId/master-catalog/audit" element={<CatalogAuditPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('CATALOG_ITEM_UPDATED')).toBeInTheDocument()
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText('CatalogItem')).toBeInTheDocument()
    expect(screen.getByRole('table')).toHaveAccessibleName('Bitácora del catálogo maestro')
    expect(catalogApi.listCatalogAudit).toHaveBeenCalledWith('org-1', expect.objectContaining({ page: 1, pageSize: 25 }))
  })

  it('navigates audit pages in both directions using server pagination authority', async () => {
    // El servidor tarda un poco, como el real: los botones dependen de su respuesta, no de la llamada.
    vi.mocked(catalogApi.listCatalogAudit).mockImplementation(async (_organizationId, input) => {
      await new Promise(resolve => setTimeout(resolve, 30))
      return {
        logs: [],
        pagination: { page: input.page ?? 1, pageSize: 25, total: 50, totalPages: 2 },
      } as never
    })
    render(
      <MemoryRouter initialEntries={['/organizations/org-1/master-catalog/audit']}>
        <Routes>
          <Route path="/organizations/:orgId/master-catalog/audit" element={<CatalogAuditPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const previous = await screen.findByRole('button', { name: 'Página anterior' })
    const next = screen.getByRole('button', { name: 'Siguiente página' })
    expect(previous).toBeDisabled()
    expect(screen.getByText('No hay eventos para estos filtros.')).toBeInTheDocument()
    // Se toca cada botón hasta que la respuesta del servidor lo enciende: un clic en un botón apagado no hace nada.
    await waitFor(() => expect(next).toBeEnabled())
    fireEvent.click(next)
    expect(catalogApi.listCatalogAudit).toHaveBeenLastCalledWith('org-1', expect.objectContaining({ page: 2 }))
    await waitFor(() => expect(previous).toBeEnabled())
    expect(next).toBeDisabled()
    fireEvent.click(previous)
    expect(catalogApi.listCatalogAudit).toHaveBeenLastCalledWith('org-1', expect.objectContaining({ page: 1 }))
    await waitFor(() => expect(previous).toBeDisabled())
    expect(next).toBeEnabled()
  })
})
