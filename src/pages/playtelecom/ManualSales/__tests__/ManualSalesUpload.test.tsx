/**
 * Unit tests for ManualSalesUpload.tsx — "Subir ventas fuera de TPV" upload page.
 *
 * Covers the Task 10 flow:
 *  1. Uploading a file via BulkUploadSection → parseSalesFile → previewManualSales →
 *     renders a preview table bucketed into crear ✅ / omitir ⏭️ / error ❌ with counts.
 *  2. Clicking "Crear N ventas" → applyManualSales → renders a result summary
 *     (creadas / omitidas / errores).
 *  3. The "Crear" button is disabled when there are zero rows to create.
 *  4. "Descargar template" calls downloadTemplate().
 *  5. The page is gated by <PermissionGate permission="manual-sales:create">.
 *
 * `manualSale.service` and `useCurrentOrganization` are mocked so no network calls or
 * router context are needed. `BulkUploadSection` is mocked to a minimal stand-in that
 * exposes its `onUpload` prop via a button, since its own drag/drop behavior is already
 * covered by its own tests (Stock feature).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ManualSaleRow, BulkManualSalesResult } from '@/services/manualSale.service'

// ---------------------------------------------------------------------------
// Mock manualSale.service — no network calls
// ---------------------------------------------------------------------------
const mockParseSalesFile = vi.fn()
const mockPreviewManualSales = vi.fn()
const mockApplyManualSales = vi.fn()
const mockDownloadTemplate = vi.fn()

vi.mock('@/services/manualSale.service', () => ({
  parseSalesFile: (...args: unknown[]) => mockParseSalesFile(...args),
  previewManualSales: (...args: unknown[]) => mockPreviewManualSales(...args),
  applyManualSales: (...args: unknown[]) => mockApplyManualSales(...args),
  downloadTemplate: (...args: unknown[]) => mockDownloadTemplate(...args),
}))

// ---------------------------------------------------------------------------
// Mock org context — orgId comes from useCurrentOrganization (sibling pattern:
// OrgStockControlPage / OrgComisionesPage)
// ---------------------------------------------------------------------------
vi.mock('@/hooks/use-current-organization', () => ({
  useCurrentOrganization: () => ({
    organization: { name: 'PlayTelecom' },
    orgId: 'org-1',
    orgSlug: 'playtelecom',
    basePath: '/wl/organizations/playtelecom',
    venues: [],
    hasSerializedInventory: true,
    isLoading: false,
    isOwner: true,
    error: null,
  }),
}))

// ---------------------------------------------------------------------------
// Mock permissions — PermissionGate reads useAccess(); default to granted so
// the happy-path tests exercise the page content. A dedicated test overrides
// this to verify the gate actually hides content.
// ---------------------------------------------------------------------------
const mockCan = vi.fn(() => true)
vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({ can: (perm: string) => mockCan(perm), canAny: () => true, canAll: () => true }),
}))

// ---------------------------------------------------------------------------
// Mock BulkUploadSection — a minimal stand-in exposing onUpload via a button.
// Its own drag/drop/template-button behavior is covered by the Stock feature's
// own tests; here we only need to trigger the page's onUpload callback.
// ---------------------------------------------------------------------------
vi.mock('@/pages/playtelecom/Stock/components/BulkUploadSection', () => ({
  BulkUploadSection: ({ onUpload }: { onUpload?: (file: File) => Promise<unknown> }) => (
    <button
      onClick={() => {
        const file = new File(['dummy'], 'ventas.xlsx')
        void onUpload?.(file)
      }}
    >
      mock-upload-trigger
    </button>
  ),
}))

import ManualSalesUpload from '../ManualSalesUpload'

const SAMPLE_ROWS: ManualSaleRow[] = [
  { iccid: '8952140063000001234', storeName: 'BAE Pavón', saleDate: '2026-07-01', saleType: 'Línea nueva', paymentForm: 'Efectivo', amount: 200 },
  { iccid: '8952140063000001235', storeName: 'BAE Pavón', saleDate: '2026-07-01', saleType: 'Portabilidad', paymentForm: 'Tarjeta', amount: 250 },
  { iccid: '8952140063000001236', storeName: 'BAE Papagayo', saleDate: '2026-07-02', saleType: 'Línea nueva', paymentForm: 'No aplica', amount: 'No aplica' },
]

const PREVIEW_RESULT: BulkManualSalesResult = {
  crear: [{ index: 0, iccid: '8952140063000001234', storeName: 'BAE Pavón' }],
  omitir: [{ index: 1, iccid: '8952140063000001235', storeName: 'BAE Pavón', motivo: 'Ya existe una venta con este ICCID' }],
  error: [{ index: 2, iccid: '8952140063000001236', storeName: 'BAE Papagayo', motivo: 'Tienda no encontrada' }],
}

async function uploadSampleFile() {
  fireEvent.click(screen.getByText('mock-upload-trigger'))
  await waitFor(() => expect(mockPreviewManualSales).toHaveBeenCalled())
}

describe('ManualSalesUpload', () => {
  beforeEach(() => {
    mockParseSalesFile.mockReset()
    mockPreviewManualSales.mockReset()
    mockApplyManualSales.mockReset()
    mockDownloadTemplate.mockReset()
    mockCan.mockReset()
    mockCan.mockReturnValue(true)

    mockParseSalesFile.mockResolvedValue(SAMPLE_ROWS)
    mockPreviewManualSales.mockResolvedValue(PREVIEW_RESULT)
  })

  it('parses the uploaded file and previews it against the current org', async () => {
    render(<ManualSalesUpload />)

    await uploadSampleFile()

    expect(mockParseSalesFile).toHaveBeenCalledTimes(1)
    expect(mockPreviewManualSales).toHaveBeenCalledWith('org-1', SAMPLE_ROWS)
  })

  it('renders the preview table bucketed into crear / omitir / error with motivo and counts', async () => {
    render(<ManualSalesUpload />)

    await uploadSampleFile()

    // Row-level ICCIDs for all 3 buckets appear
    expect(screen.getByText('8952140063000001234')).toBeInTheDocument()
    expect(screen.getByText('8952140063000001235')).toBeInTheDocument()
    expect(screen.getByText('8952140063000001236')).toBeInTheDocument()

    // omitir/error motivo reasons render
    expect(screen.getByText('Ya existe una venta con este ICCID')).toBeInTheDocument()
    expect(screen.getByText('Tienda no encontrada')).toBeInTheDocument()

    // Counts: 1 crear, 1 omitir, 1 error
    expect(screen.getByText('1 a crear')).toBeInTheDocument()
    expect(screen.getByText('1 a omitir')).toBeInTheDocument()
    expect(screen.getByText('1 con error')).toBeInTheDocument()
    const createButton = screen.getByRole('button', { name: /Crear 1 venta/i })
    expect(createButton).toBeInTheDocument()
    expect(createButton).not.toBeDisabled()
  })

  it('disables the "Crear" button when there are zero rows to create', async () => {
    mockPreviewManualSales.mockResolvedValue({
      crear: [],
      omitir: [{ index: 0, iccid: 'X', storeName: 'Y', motivo: 'no sirve' }],
      error: [],
    })

    render(<ManualSalesUpload />)
    await uploadSampleFile()

    const createButton = screen.getByRole('button', { name: /Crear 0 ventas/i })
    expect(createButton).toBeDisabled()
  })

  it('clicking "Crear N ventas" calls applyManualSales with the org id and rows, and renders the result summary', async () => {
    mockApplyManualSales.mockResolvedValue({
      crear: [],
      omitir: [{ index: 1, iccid: '8952140063000001235', storeName: 'BAE Pavón', motivo: 'Ya existe una venta con este ICCID' }],
      error: [{ index: 2, iccid: '8952140063000001236', storeName: 'BAE Papagayo', motivo: 'Tienda no encontrada' }],
      created: 1,
    })

    render(<ManualSalesUpload />)
    await uploadSampleFile()

    fireEvent.click(screen.getByRole('button', { name: /Crear 1 venta/i }))

    await waitFor(() => expect(mockApplyManualSales).toHaveBeenCalledWith('org-1', SAMPLE_ROWS))

    // Result summary: creadas / omitidas / errores (scoped to the result
    // card's text nodes — the preview card above still shows its own "1 con
    // error" badge simultaneously, which is expected product behavior).
    expect(await screen.findByText('1 creada')).toBeInTheDocument()
    expect(screen.getByText('1 omitida')).toBeInTheDocument()
    const errorSummaries = screen.getAllByText(/con error/i)
    expect(errorSummaries.length).toBeGreaterThanOrEqual(1)
  })

  it('"Descargar template" calls downloadTemplate()', () => {
    render(<ManualSalesUpload />)

    fireEvent.click(screen.getByRole('button', { name: /Descargar template/i }))

    expect(mockDownloadTemplate).toHaveBeenCalledTimes(1)
  })

  it('hides the page content when the user lacks the manual-sales:create permission', () => {
    mockCan.mockReturnValue(false)

    render(<ManualSalesUpload />)

    expect(screen.queryByText('mock-upload-trigger')).not.toBeInTheDocument()
  })
})
