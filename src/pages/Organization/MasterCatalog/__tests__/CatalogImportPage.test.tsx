import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CatalogImportPage from '../CatalogImportPage'
import * as catalogApi from '@/features/master-catalog/api'

vi.mock('@/features/master-catalog/api', async importOriginal => {
  const actual = await importOriginal<typeof catalogApi>()
  return { ...actual, previewCatalogImport: vi.fn(), confirmCatalogImport: vi.fn() }
})
vi.mock('@/features/master-catalog/use-master-catalog-access', () => ({
  useMasterCatalogAccess: () => ({ canMutateContent: true }),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key }),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/organizations/org-1/master-catalog/imports']}>
      <Routes>
        <Route path="/organizations/:orgId/master-catalog/imports" element={<CatalogImportPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CatalogImportPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps master import distinct from menu replacement and blocks confirmation while any row is invalid', async () => {
    vi.mocked(catalogApi.previewCatalogImport).mockResolvedValue({
      importBatchId: 'batch-1',
      canConfirm: false,
      previewToken: null,
      targetHash: 'a'.repeat(64),
      expiresAt: '2026-08-10T01:00:00.000Z',
      errors: [{ sheet: 'Items', row: 2, column: 'unit', code: 'CATALOG_FIELD_REQUIRED', message: 'Falta unidad' }],
      errorCount: 1,
      errorsTruncated: false,
      blockingReasons: [{ code: 'CATALOG_IMPORT_VALIDATION_FAILED', message: 'Hay filas inválidas' }],
    } as never)
    renderPage()

    expect(screen.getByText('Importación del catálogo maestro')).toBeInTheDocument()
    expect(screen.getByText(/no reemplaza el menú local/i)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Archivo XLSX'), {
      target: {
        files: [new File(['xlsx'], 'catalogo.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })],
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Revisar archivo' }))

    await screen.findByText('Falta unidad')
    expect(screen.getByRole('button', { name: 'Confirmar importación' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Descargar errores' })).toHaveAttribute(
      'href',
      '/api/v1/dashboard/organizations/org-1/master-catalog/imports/batch-1/errors.xlsx',
    )
  })

  it('exposes one explicit final action and sends the one-time preview token', async () => {
    vi.mocked(catalogApi.previewCatalogImport).mockResolvedValue({
      importBatchId: 'batch-ready',
      canConfirm: true,
      previewToken: 'token-once',
      targetHash: 'b'.repeat(64),
      expiresAt: '2099-08-10T01:00:00.000Z',
      errors: [],
      errorCount: 0,
      errorsTruncated: false,
      blockingReasons: [],
    } as never)
    vi.mocked(catalogApi.confirmCatalogImport).mockResolvedValue({
      importBatchId: 'batch-ready',
      state: 'APPLIED',
      appliedItemIds: ['item-1'],
    })
    renderPage()

    fireEvent.change(screen.getByLabelText('Archivo XLSX'), {
      target: {
        files: [new File(['xlsx'], 'catalogo.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })],
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Revisar archivo' }))
    const confirm = await screen.findByRole('button', { name: 'Confirmar importación' })
    expect(screen.getAllByRole('button', { name: 'Confirmar importación' })).toHaveLength(1)
    fireEvent.click(confirm)

    await waitFor(() =>
      expect(catalogApi.confirmCatalogImport).toHaveBeenCalledWith('org-1', {
        importBatchId: 'batch-ready',
        previewToken: 'token-once',
        confirm: true,
        idempotencyKey: expect.any(String),
      }),
    )
  })
})
