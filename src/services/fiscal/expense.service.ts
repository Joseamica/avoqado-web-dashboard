/**
 * Buzón de CFDIs / Gastos service (Capa B fiscal) — gated PREMIUM (bundle con CFDI).
 *
 *   GET  /api/v1/dashboard/venues/:venueId/accounting/expenses?period=&paymentStatus=&proveedorRfc=
 *   POST …/accounting/expenses                       body: ver NewExpense (montos en CENTAVOS enteros)
 *   POST …/accounting/expenses/generate-policies?period=YYYY-MM
 *   GET  …/accounting/diot?period=YYYY-MM
 *
 * Money en CENTAVOS enteros. El IVA se vuelve acreditable cuando el gasto está PAGADO (cash-basis).
 */
import api from '@/api'

export type ExpenseMetodoPago = 'PUE' | 'PPD'
export type ExpensePaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID'
export type ExpenseCategoria = 'COSTO_MERCANCIA' | 'GASTO_GENERAL' | 'ARRENDAMIENTO' | 'COMBUSTIBLE' | 'HONORARIOS' | 'SERVICIOS' | 'OTRO'
export type DiotTipoTercero = 'NACIONAL' | 'EXTRANJERO' | 'GLOBAL'

export interface ExpenseDTO {
  id: string
  proveedorRfc: string
  proveedorNombre: string
  tipoTercero: DiotTipoTercero
  comprobanteTipo: string
  metodoPago: ExpenseMetodoPago
  categoria: ExpenseCategoria
  fechaEmision: string
  fechaPago: string | null
  subtotalCents: number
  descuentoCents: number
  ivaCents: number
  iva16Cents: number
  iva8Cents: number
  iepsCents: number
  isrRetenidoCents: number
  ivaRetenidoCents: number
  totalCents: number
  deducible: boolean
  ivaAcreditable: boolean
  paymentStatus: ExpensePaymentStatus
  paidCents: number
  paidPeriod: string | null
  posted: boolean
  uuid: string | null
  serie: string | null
  folio: string | null
  source: string
  status: string
  createdAt: string
}

export interface ExpensesResponse {
  needsFiscalSetup: boolean
  organizationId: string | null
  rfc: string | null
  expenses: ExpenseDTO[]
  summary: { count: number; totalCents: number; ivaCents: number; deducibleCents: number }
}

export interface NewExpense {
  proveedorRfc: string
  proveedorNombre: string
  fechaEmision: string
  subtotalCents: number
  ivaCents?: number
  totalCents: number
  descuentoCents?: number
  iepsCents?: number
  ivaRetenidoCents?: number
  isrRetenidoCents?: number
  metodoPago?: ExpenseMetodoPago
  categoria?: ExpenseCategoria
  fechaPago?: string | null
  paid?: boolean
  deducible?: boolean
  ivaAcreditable?: boolean
  uuid?: string | null
  folio?: string | null
}

export interface GenerateExpensePoliciesResult {
  needsFiscalSetup: boolean
  missingMappings: string[]
  period: string | null
  candidates: number
  posted: number
  alreadyPosted: number
  skipped: number
}

export interface DiotRow {
  proveedorRfc: string
  proveedorNombre: string
  tipoTercero: DiotTipoTercero
  tipoTerceroCodigo: string
  base16Cents: number
  iva16Cents: number
  base8Cents: number
  iva8Cents: number
  base0Cents: number
  exentoCents: number
  ivaRetenidoCents: number
  ivaAcreditableCents: number
  comprobantes: number
}

export interface DiotResponse {
  needsFiscalSetup: boolean
  organizationId: string | null
  rfc: string | null
  period: string
  rows: DiotRow[]
  totals: {
    proveedores: number
    comprobantes: number
    base16Cents: number
    iva16Cents: number
    base8Cents: number
    iva8Cents: number
    base0Cents: number
    exentoCents: number
    ivaRetenidoCents: number
    ivaAcreditableCents: number
  }
  cuadraConIvaFlujo: boolean
}

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/accounting/expenses`

export async function getExpenses(
  venueId: string,
  filters: { period?: string; paymentStatus?: ExpensePaymentStatus; proveedorRfc?: string } = {},
): Promise<ExpensesResponse> {
  const res = await api.get<ExpensesResponse>(base(venueId), { params: filters })
  return res.data
}

export async function createExpense(venueId: string, expense: NewExpense): Promise<ExpenseDTO> {
  const res = await api.post<ExpenseDTO>(base(venueId), expense)
  return res.data
}

/** Importa un gasto desde el XML (texto) de un CFDI recibido. */
export async function importExpenseXml(venueId: string, xml: string): Promise<ExpenseDTO> {
  const res = await api.post<ExpenseDTO>(`${base(venueId)}/import-xml`, { xml })
  return res.data
}

export async function generateExpensePolicies(venueId: string, period?: string): Promise<GenerateExpensePoliciesResult> {
  const res = await api.post<GenerateExpensePoliciesResult>(`${base(venueId)}/generate-policies`, null, { params: period ? { period } : {} })
  return res.data
}

export async function getDiot(venueId: string, period?: string): Promise<DiotResponse> {
  const res = await api.get<DiotResponse>(`/api/v1/dashboard/venues/${venueId}/accounting/diot`, { params: period ? { period } : {} })
  return res.data
}

export interface MarkPaidResult {
  needsFiscalSetup: boolean
  notFound: boolean
  alreadyPaid: boolean
  marked: boolean
  paymentPosted: boolean
  missingMappings: string[]
}

export async function markExpensePaid(venueId: string, expenseId: string, fechaPago: string, formaPago?: string | null): Promise<MarkPaidResult> {
  const res = await api.post<MarkPaidResult>(`${base(venueId)}/${expenseId}/pay`, { fechaPago, formaPago })
  return res.data
}

export const expenseKeys = {
  all: ['expenses'] as const,
  list: (venueId: string | null, filters?: Record<string, string | undefined>) => [...expenseKeys.all, venueId, filters ?? 'all'] as const,
  diot: (venueId: string | null, period: string) => ['diot', venueId, period] as const,
}
