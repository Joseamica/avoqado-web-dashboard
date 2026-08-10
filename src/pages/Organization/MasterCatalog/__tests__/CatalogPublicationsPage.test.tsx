import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CatalogPublicationsPage from '../CatalogPublicationsPage'
import * as catalogApi from '@/features/master-catalog/api'

vi.mock('@/features/master-catalog/api', async importOriginal => {
  const actual = await importOriginal<typeof catalogApi>()
  return {
    ...actual,
    listCatalogPublications: vi.fn(),
    previewCatalogPublication: vi.fn(),
    confirmCatalogPublication: vi.fn(),
    recoverCatalogPublication: vi.fn(),
  }
})
vi.mock('@/features/master-catalog/use-master-catalog-access', () => ({
  useMasterCatalogAccess: () => ({ canMutateContent: true }),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key }),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/organizations/org-1/master-catalog/publications']}>
      <Routes>
        <Route path="/organizations/:orgId/master-catalog/publications" element={<CatalogPublicationsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CatalogPublicationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(catalogApi.listCatalogPublications).mockResolvedValue({ items: [], nextCursor: null })
  })

  it('shows before/after, approved override provenance and blocks UNDECIDED or stale previews', async () => {
    vi.mocked(catalogApi.previewCatalogPublication).mockResolvedValue({
      publicationBatchId: 'pub-1',
      operation: 'CATALOG_FIELDS_PUBLISH',
      previewToken: 'pub-token',
      targetHash: 'e'.repeat(64),
      expiresAt: '2000-01-01T00:00:00.000Z',
      canConfirm: false,
      lines: [
        {
          catalogItemId: 'item-1',
          venueId: 'venue-1',
          productId: 'product-1',
          bindingId: 'binding-1',
          status: 'LOCAL_DIVERGENCE',
          fieldMask: ['name'],
          canonicalTargetHash: 'f'.repeat(64),
          diagnosticCode: null,
          diagnostic: null,
          fields: [
            {
              field: 'name',
              before: 'Local',
              proposed: 'Corporativo',
              after: 'Local',
              decision: 'APPROVE_LOCAL_OVERRIDE',
              overrideId: 'override-1',
            },
            { field: 'description', before: 'Antes', proposed: 'Después', after: 'Después', decision: 'UNDECIDED', overrideId: null },
          ],
        },
      ],
    } as never)
    renderPage()

    expect(await screen.findByText('Aún no hay publicaciones.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('ID del artículo'), { target: { value: 'item-1' } })
    fireEvent.change(screen.getByLabelText('ID de la sucursal'), { target: { value: 'venue-1' } })
    fireEvent.change(screen.getByLabelText('ID del producto'), { target: { value: 'product-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preparar publicación' }))

    await screen.findByText('Local')
    expect(screen.getByText('Corporativo')).toBeInTheDocument()
    expect(screen.getByText('Override aprobado')).toBeInTheDocument()
    expect(screen.getByText('Sin decisión')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar publicación' })).toBeDisabled()
  })

  it('recovers an idempotent publication explicitly instead of retrying the mutation', async () => {
    vi.mocked(catalogApi.recoverCatalogPublication).mockResolvedValue({
      publicationBatchId: 'pub-applied',
      operation: 'CATALOG_FIELDS_PUBLISH',
      state: 'APPLIED',
      lines: [],
    } as never)
    renderPage()

    fireEvent.change(screen.getByLabelText('Clave de idempotencia'), { target: { value: 'publish-2026-08-09' } })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar resultado' }))

    await waitFor(() =>
      expect(catalogApi.recoverCatalogPublication).toHaveBeenCalledWith('org-1', 'CATALOG_FIELDS_PUBLISH', 'publish-2026-08-09'),
    )
    expect(await screen.findByText('APPLIED')).toBeInTheDocument()
    expect(catalogApi.previewCatalogPublication).not.toHaveBeenCalled()
  })
})
