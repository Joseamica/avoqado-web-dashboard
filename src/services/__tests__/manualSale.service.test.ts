/**
 * Unit tests for manualSale.service.ts — "Subir ventas fuera de TPV".
 *
 * Covers:
 *  - parseSalesFile: maps Isaac's real sheet layout (1 blank leading row, then a
 *    Spanish-header row, then data rows) to typed ManualSaleRow[], with saleDate
 *    normalized to YYYY-MM-DD regardless of whether the cell is a real Excel Date
 *    or a plain string.
 *  - previewManualSales / applyManualSales: POST to the org-scoped Task 6 endpoints
 *    via the shared `@/api` axios instance, with the `/api/v1/` prefix, and return
 *    `data` from the `{ success, data }` envelope.
 *
 * The api module is mocked so no network calls are made.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ExcelJS from 'exceljs'
import { parseSalesFile, previewManualSales, applyManualSales } from '@/services/manualSale.service'

// ---------------------------------------------------------------------------
// Mock the `api` axios instance
// ---------------------------------------------------------------------------
const mockPost = vi.fn()
vi.mock('@/api', () => ({
  default: { post: (...args: unknown[]) => mockPost(...args) },
}))

beforeEach(() => {
  mockPost.mockReset()
})

/**
 * Builds an in-memory .xlsx File matching the operator's real sheet: a BLANK
 * leading row, then the Spanish header row, then data rows — plus extra columns
 * (Estado, Mes, Estado Avoqado, Sucursal Avoqado) that must be ignored.
 */
async function buildSampleWorkbookFile(): Promise<File> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Ventas')

  sheet.addRow([]) // blank leading row, as in Isaac's file
  sheet.addRow([
    'ID SIM',
    'Tipo de SIM',
    'ID Promotor',
    'Promotor',
    'ID Tienda',
    'Nombre de la Tienda',
    'Fecha',
    'Tipo de Venta',
    'Forma de Pago',
    'Monto de Venta',
    'Estado', // extra column — must be ignored
    'Mes', // extra column — must be ignored
    'Estado Avoqado', // extra column — must be ignored
    'Sucursal Avoqado', // extra column — must be ignored
  ])
  sheet.addRow([
    '8952140063000001234',
    'Prepago',
    'P001',
    'Juan Perez',
    '898',
    'BAE Unidad Pavón (898)',
    new Date(2026, 5, 15), // real Excel Date cell — June 15, 2026
    'Línea nueva',
    'Efectivo',
    150.5,
    'Activo',
    'Junio',
    'Confirmado',
    'BAE Unidad Pavón',
  ])
  sheet.addRow([
    '8952140063000005678',
    'Pospago',
    'P002',
    'Maria Lopez',
    '899',
    'BAE Papagayo (899)',
    '2026-06-16', // plain string date cell (no coercion by Excel)
    'Portabilidad',
    'Tarjeta',
    '200',
    'Activo',
    'Junio',
    'Pendiente',
    'BAE Papagayo',
  ])

  const buffer = await workbook.xlsx.writeBuffer()
  return new File([buffer as ArrayBuffer], 'ventas.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

describe('parseSalesFile', () => {
  it('maps the blank-row + Spanish-header sheet to typed ManualSaleRow[]', async () => {
    const file = await buildSampleWorkbookFile()

    const rows = await parseSalesFile(file)

    expect(rows).toHaveLength(2)

    expect(rows[0]).toEqual({
      iccid: '8952140063000001234',
      simType: 'Prepago',
      promoterCode: 'P001',
      promoterName: 'Juan Perez',
      storeId: '898',
      storeName: 'BAE Unidad Pavón (898)',
      saleDate: '2026-06-15',
      saleType: 'Línea nueva',
      paymentForm: 'Efectivo',
      amount: 150.5,
    })

    expect(rows[1]).toEqual({
      iccid: '8952140063000005678',
      simType: 'Pospago',
      promoterCode: 'P002',
      promoterName: 'Maria Lopez',
      storeId: '899',
      storeName: 'BAE Papagayo (899)',
      saleDate: '2026-06-16',
      saleType: 'Portabilidad',
      paymentForm: 'Tarjeta',
      amount: '200',
    })
  })

  it('ignores extra columns (Estado, Mes, Estado Avoqado, Sucursal Avoqado)', async () => {
    const file = await buildSampleWorkbookFile()

    const rows = await parseSalesFile(file)

    for (const row of rows) {
      expect(row).not.toHaveProperty('Estado')
      expect(row).not.toHaveProperty('Mes')
      expect(row).not.toHaveProperty('Estado Avoqado')
      expect(row).not.toHaveProperty('Sucursal Avoqado')
    }
  })
})

describe('previewManualSales', () => {
  const previewResponse = {
    crear: [{ index: 0, iccid: 'ICCID1', storeName: 'BAE Pavón' }],
    omitir: [],
    error: [],
  }

  it('POSTs to the org-scoped preview endpoint with the /api/v1/ prefix and returns data', async () => {
    mockPost.mockResolvedValue({ data: { success: true, data: previewResponse } })

    const rows = [
      {
        iccid: 'ICCID1',
        storeName: 'BAE Pavón',
        saleDate: '2026-06-15',
        saleType: 'Línea nueva',
        paymentForm: 'Efectivo',
        amount: 150.5,
      },
    ]

    const result = await previewManualSales('org-1', rows)

    expect(mockPost).toHaveBeenCalledWith('/api/v1/dashboard/organizations/org-1/manual-sales/preview', { rows })
    expect(result).toEqual(previewResponse)
  })
})

describe('applyManualSales', () => {
  const applyResponse = {
    crear: [],
    omitir: [],
    error: [],
    created: 1,
  }

  it('POSTs to the org-scoped apply endpoint with the /api/v1/ prefix and returns data', async () => {
    mockPost.mockResolvedValue({ data: { success: true, data: applyResponse } })

    const rows = [
      {
        iccid: 'ICCID1',
        storeName: 'BAE Pavón',
        saleDate: '2026-06-15',
        saleType: 'Línea nueva',
        paymentForm: 'Efectivo',
        amount: 150.5,
      },
    ]

    const result = await applyManualSales('org-1', rows)

    expect(mockPost).toHaveBeenCalledWith('/api/v1/dashboard/organizations/org-1/manual-sales', { rows })
    expect(result).toEqual(applyResponse)
  })
})
