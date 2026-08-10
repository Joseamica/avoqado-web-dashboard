import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CatalogBindingsPage from '../CatalogBindingsPage'
import * as catalogApi from '@/features/master-catalog/api'

vi.mock('@/features/master-catalog/api', async importOriginal => {
  const actual = await importOriginal<typeof catalogApi>()
  return { ...actual, previewCatalogBindings: vi.fn(), confirmCatalogBindings: vi.fn() }
})
vi.mock('@/features/master-catalog/use-master-catalog-access', () => ({
  useMasterCatalogAccess: () => ({ canMutateContent: true }),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key }),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/organizations/org-1/master-catalog/bindings']}>
      <Routes>
        <Route path="/organizations/:orgId/master-catalog/bindings" element={<CatalogBindingsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CatalogBindingsPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders LINK, CREATE and SKIP decisions with conflicts blocking the only confirmation action', async () => {
    vi.mocked(catalogApi.previewCatalogBindings).mockResolvedValue({
      bindingBatchId: 'binding-1',
      previewToken: 'binding-token',
      targetHash: 'c'.repeat(64),
      expiresAt: '2099-08-10T01:00:00.000Z',
      canConfirm: false,
      lines: [
        {
          catalogItemId: 'item-1',
          venueId: 'venue-1',
          proposal: 'LINK',
          decision: null,
          status: 'READY',
          errorCode: null,
          candidates: [],
          readiness: 'READY',
        },
        {
          catalogItemId: 'item-2',
          venueId: 'venue-1',
          proposal: 'CREATE',
          decision: null,
          status: 'READY',
          errorCode: null,
          candidates: [],
          readiness: 'NOT_REQUIRED',
        },
        {
          catalogItemId: 'item-3',
          venueId: 'venue-1',
          proposal: 'SKIP',
          decision: null,
          status: 'CONFLICT',
          errorCode: 'CATALOG_BINDING_CONFLICT',
          candidates: [],
          readiness: 'INVALID',
        },
      ],
    } as never)
    renderPage()

    fireEvent.change(screen.getByLabelText('ID del artículo'), { target: { value: 'item-1' } })
    fireEvent.change(screen.getByLabelText('ID de la sucursal'), { target: { value: 'venue-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preparar asignaciones' }))

    await screen.findByText('LINK')
    expect(screen.getByText('CREATE')).toBeInTheDocument()
    expect(screen.getByText('SKIP')).toBeInTheDocument()
    expect(screen.getByText('CATALOG_BINDING_CONFLICT')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar asignaciones' })).toBeDisabled()
  })

  it('confirms only after a ready preview with its bearer', async () => {
    vi.mocked(catalogApi.previewCatalogBindings).mockResolvedValue({
      bindingBatchId: 'binding-ready',
      previewToken: 'binding-token',
      targetHash: 'd'.repeat(64),
      expiresAt: '2099-08-10T01:00:00.000Z',
      canConfirm: true,
      lines: [
        {
          catalogItemId: 'item-1',
          venueId: 'venue-1',
          proposal: 'SKIP',
          decision: { decision: 'SKIP' },
          status: 'READY',
          errorCode: null,
          candidates: [],
          readiness: 'NOT_REQUIRED',
        },
      ],
    } as never)
    vi.mocked(catalogApi.confirmCatalogBindings).mockResolvedValue({ bindingBatchId: 'binding-ready', state: 'APPLIED', lines: [] })
    renderPage()

    fireEvent.change(screen.getByLabelText('ID del artículo'), { target: { value: 'item-1' } })
    fireEvent.change(screen.getByLabelText('ID de la sucursal'), { target: { value: 'venue-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preparar asignaciones' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar asignaciones' }))

    await waitFor(() =>
      expect(catalogApi.confirmCatalogBindings).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ bindingBatchId: 'binding-ready', previewToken: 'binding-token', confirm: true }),
      ),
    )
  })
})
