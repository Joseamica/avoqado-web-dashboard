// src/services/manualSale.service.ts

import api from '@/api'
import ExcelJS from 'exceljs'

/**
 * "Subir ventas fuera de TPV" — bulk upload of SIM sales made outside the TPV
 * (PlayTelecom / Walmart). This service is the frontend counterpart of the
 * org-scoped backend endpoints built in Tasks 5/6/7:
 *
 *   POST /api/v1/dashboard/organizations/:orgId/manual-sales/preview  (dry run)
 *   POST /api/v1/dashboard/organizations/:orgId/manual-sales          (applies)
 *
 * Both endpoints validate against `bulkManualSalesSchema` on the server
 * (`src/schemas/dashboard/manualSale.schema.ts`) — the raw string/number shape
 * below mirrors `ManualSaleRowInput` exactly (iccid/storeName/saleDate/saleType/
 * paymentForm/amount required, promoterCode/promoterName/storeId/simType
 * optional, amount is `number | string`).
 */

/** One row as it arrives from the operator's Excel/CSV sheet (raw, unresolved). */
export interface ManualSaleRow {
  /** "ID SIM" — the ICCID printed/encoded on the SIM. */
  iccid: string
  /** "ID Promotor" (employeeCode). May be empty — resolver falls back to promoterName. */
  promoterCode?: string
  /** "Promotor" — full name, used as a fallback when promoterCode is empty. */
  promoterName?: string
  /** "ID Tienda" — numeric id embedded in the store name, e.g. "898". */
  storeId?: string
  /** "Nombre de la Tienda" */
  storeName: string
  /** "Fecha" — venue-local calendar day, normalized to YYYY-MM-DD. */
  saleDate: string
  /** "Tipo de Venta" — e.g. "Línea nueva" | "Portabilidad". */
  saleType: string
  /** "Forma de Pago" — e.g. "Efectivo" | "Tarjeta" | "No aplica". */
  paymentForm: string
  /** "Monto de Venta" — a number, a numeric string, or the literal "No aplica". */
  amount: number | string
  /** "Tipo de SIM" — optional; falls back to the item's existing category. */
  simType?: string
}

/** One row's classification result, as returned by the backend (Task 5). */
export interface RowResult {
  index: number
  iccid: string
  storeName: string
  motivo?: string
}

/** `{ crear, omitir, error, created? }` — shared shape of preview + apply responses. */
export interface BulkManualSalesResult {
  crear: RowResult[]
  omitir: RowResult[]
  error: RowResult[]
  created?: number
}

/** Spanish sheet header → `ManualSaleRow` field. Extra columns are ignored. */
const HEADER_TO_FIELD: Record<string, keyof ManualSaleRow> = {
  'ID SIM': 'iccid',
  'Tipo de SIM': 'simType',
  'ID Promotor': 'promoterCode',
  Promotor: 'promoterName',
  'ID Tienda': 'storeId',
  'Nombre de la Tienda': 'storeName',
  Fecha: 'saleDate',
  'Tipo de Venta': 'saleType',
  'Forma de Pago': 'paymentForm',
  'Monto de Venta': 'amount',
}

/** Fields that must always come out of the parser as strings, never numbers. */
const STRING_FIELDS = new Set<keyof ManualSaleRow>([
  'iccid',
  'promoterCode',
  'promoterName',
  'storeId',
  'storeName',
  'saleDate',
  'saleType',
  'paymentForm',
  'simType',
])

/**
 * Reads a File's contents as an ArrayBuffer via `FileReader`. Used instead of
 * `File.prototype.arrayBuffer()` for broader runtime compatibility (older
 * browsers and some test/jsdom environments don't implement the newer Blob
 * method, but `FileReader` is universally supported).
 */
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo'))
    reader.readAsArrayBuffer(file)
  })
}

/** Formats a JS Date as a local calendar day string YYYY-MM-DD (for locally-parsed strings). */
function formatDateOnly(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Formats an ExcelJS date cell as its calendar day YYYY-MM-DD using UTC components.
 *
 * ExcelJS reads a date-only cell (which carries no timezone) as UTC midnight — e.g. the
 * cell "22/05/2026" comes back as `2026-05-22T00:00:00.000Z`. Formatting that with LOCAL
 * getters in a browser west of UTC (America/Mexico_City, -06) yields the PREVIOUS day
 * (2026-05-21) — an off-by-one that filed every sale one day early. UTC getters read back
 * the exact day the operator typed.
 */
function formatExcelDateUTC(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Normalizes a raw "Fecha" cell (Excel Date, string, or number) to YYYY-MM-DD. */
function normalizeSaleDate(rawValue: unknown): string {
  if (rawValue instanceof Date) {
    return formatExcelDateUTC(rawValue)
  }

  const asString = String(rawValue ?? '').trim()

  // Already ISO-shaped (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss...) → take the date part.
  const isoMatch = asString.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoMatch) {
    return isoMatch[1]
  }

  // Fallback: let the runtime parse it (e.g. "6/15/2026"), then reformat.
  const parsed = new Date(asString)
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateOnly(parsed)
  }

  return asString
}

/** Reads a raw cell value out of exceljs's `Cell`, unwrapping rich-text/formula shapes. */
function readCellValue(cellValue: ExcelJS.CellValue): unknown {
  if (cellValue === null || cellValue === undefined) {
    return undefined
  }

  // Formula cell → use the computed result.
  if (typeof cellValue === 'object' && 'result' in (cellValue as unknown as Record<string, unknown>)) {
    return (cellValue as unknown as { result: unknown }).result
  }

  // Rich text cell → concatenate the runs' plain text.
  if (typeof cellValue === 'object' && 'richText' in (cellValue as unknown as Record<string, unknown>)) {
    const richText = (cellValue as unknown as { richText: Array<{ text: string }> }).richText
    return richText.map(run => run.text).join('')
  }

  // Hyperlink cell → use the visible text.
  if (typeof cellValue === 'object' && 'text' in (cellValue as unknown as Record<string, unknown>)) {
    return (cellValue as unknown as { text: unknown }).text
  }

  return cellValue
}

/**
 * Parses an .xlsx (or .csv opened as a single-sheet workbook) file into typed
 * `ManualSaleRow[]`.
 *
 * Mirrors the operator's real sheet layout (Isaac's file): a BLANK leading row,
 * then a HEADER row with Spanish column names, then data rows. Extra columns
 * (Estado, Mes, Estado Avoqado, Sucursal Avoqado, ...) are ignored — only the
 * headers present in `HEADER_TO_FIELD` are mapped.
 */
export async function parseSalesFile(file: File): Promise<ManualSaleRow[]> {
  const buffer = await readFileAsArrayBuffer(file)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const sheet = workbook.worksheets[0]
  if (!sheet) {
    throw new Error('El archivo no contiene ninguna hoja')
  }

  // Find the header row: the first row containing at least one known Spanish
  // header. This tolerates the blank leading row (and any other leading blank
  // rows) without hardcoding "row 2".
  let headerRowNumber: number | null = null
  let columnToField: Map<number, keyof ManualSaleRow> | null = null

  for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber)
    const candidateMap = new Map<number, keyof ManualSaleRow>()

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const headerText = String(readCellValue(cell.value) ?? '').trim()
      const field = HEADER_TO_FIELD[headerText]
      if (field) {
        candidateMap.set(colNumber, field)
      }
    })

    if (candidateMap.size > 0) {
      headerRowNumber = rowNumber
      columnToField = candidateMap
      break
    }
  }

  if (headerRowNumber === null || !columnToField) {
    throw new Error('No se encontró una fila de encabezados válida en el archivo')
  }

  const rows: ManualSaleRow[] = []

  for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber)
    if (row.cellCount === 0) continue // skip fully blank rows

    const parsedRow: Partial<Record<keyof ManualSaleRow, unknown>> = {}
    let hasAnyValue = false

    columnToField.forEach((field, colNumber) => {
      const rawValue = readCellValue(row.getCell(colNumber).value)
      if (rawValue === undefined || rawValue === '') return

      hasAnyValue = true

      if (field === 'saleDate') {
        parsedRow[field] = normalizeSaleDate(rawValue)
      } else if (field === 'amount') {
        // Keep numbers as numbers, everything else (numeric strings, "No aplica") as-is.
        parsedRow[field] = typeof rawValue === 'number' ? rawValue : String(rawValue).trim()
      } else if (STRING_FIELDS.has(field)) {
        parsedRow[field] = String(rawValue).trim()
      } else {
        parsedRow[field] = rawValue
      }
    })

    if (!hasAnyValue) continue // skip rows that are blank across every mapped column

    rows.push(parsedRow as ManualSaleRow)
  }

  return rows
}

/**
 * Dry run — POSTs the parsed rows to the org-scoped preview endpoint and
 * returns the classified `{ crear, omitir, error }` result WITHOUT writing
 * anything on the backend.
 */
export async function previewManualSales(orgId: string, rows: ManualSaleRow[]): Promise<BulkManualSalesResult> {
  const response = await api.post(`/api/v1/dashboard/organizations/${orgId}/manual-sales/preview`, { rows })
  return response.data.data
}

/**
 * Applies the upload — POSTs the parsed rows to the org-scoped apply endpoint,
 * which creates one complete sale per (deduped) row and returns
 * `{ crear, omitir, error, created }`.
 */
export async function applyManualSales(orgId: string, rows: ManualSaleRow[]): Promise<BulkManualSalesResult> {
  const response = await api.post(`/api/v1/dashboard/organizations/${orgId}/manual-sales`, { rows })
  return response.data.data
}

/** Exact header order the operator's real sheet uses, for the blank template download. */
const TEMPLATE_HEADERS = [
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
] as const

/**
 * Generates and downloads a blank .xlsx template with exactly the headers the
 * operator's sheet uses (no blank leading row — a fresh template starts clean;
 * `parseSalesFile` already tolerates a leading blank row for real-world files
 * that do have one, like Isaac's).
 */
export async function downloadTemplate(): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Ventas')

  sheet.addRow([...TEMPLATE_HEADERS])
  sheet.getRow(1).font = { bold: true }
  sheet.columns = TEMPLATE_HEADERS.map(header => ({ width: Math.max(header.length + 4, 14) }))

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'plantilla-ventas-fuera-de-tpv.xlsx'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
