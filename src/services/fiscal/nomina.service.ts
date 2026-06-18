/**
 * Nómina (Capa B fiscal) service — empleados + corrida de nómina. Gated PREMIUM (CFDI).
 *   GET/POST /api/v1/dashboard/venues/:venueId/accounting/payroll/employees
 *   GET      …/accounting/payroll/preview?period=&periodicidad=
 *   POST     …/accounting/payroll/run   body: { period?, periodicidad?, fechaPago }
 * Money en CENTAVOS enteros. La nómina es una ESTIMACIÓN; el cálculo definitivo lo hace el nominista.
 */
import api from '@/api'

export type PayrollPeriodicity = 'SEMANAL' | 'QUINCENAL' | 'MENSUAL'

export interface EmployeeDTO {
  id: string
  nombre: string
  rfcEmpleado: string
  curp: string | null
  nss: string | null
  puesto: string | null
  salarioMensualBrutoCents: number
  sbcMensualCents: number | null
  periodicidadPago: PayrollPeriodicity
  fechaIngreso: string | null
  activo: boolean
}

export interface EmployeesResponse {
  needsFiscalSetup: boolean
  rfc: string | null
  employees: EmployeeDTO[]
}

export interface NewEmployee {
  nombre: string
  rfcEmpleado: string
  salarioMensualBrutoCents: number
  curp?: string | null
  nss?: string | null
  puesto?: string | null
  sbcMensualCents?: number | null
  periodicidadPago?: PayrollPeriodicity
  fechaIngreso?: string | null
}

export interface PayrollPreviewLine {
  employeeId: string
  nombre: string
  rfcEmpleado: string
  totalPercepcionesCents: number
  isrRetenidoCents: number
  subsidioCents: number
  subsidioEntregadoCents: number
  imssObreroCents: number
  netoCents: number
}

export interface PayrollTotals {
  empleados: number
  percepcionesCents: number
  isrCents: number
  subsidioCents: number
  subsidioEntregadoCents: number
  imssCents: number
  netoCents: number
}

export interface PayrollPreviewResponse {
  needsFiscalSetup: boolean
  rfc: string | null
  period: string
  periodicidad: PayrollPeriodicity
  lines: PayrollPreviewLine[]
  totals: PayrollTotals
}

export interface RunPayrollResult {
  needsFiscalSetup: boolean
  missingMappings: string[]
  alreadyExists: boolean
  payrollRunId: string | null
  posted: boolean
  totals: PayrollTotals
}

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/accounting/payroll`

export async function getEmployees(venueId: string): Promise<EmployeesResponse> {
  const res = await api.get<EmployeesResponse>(`${base(venueId)}/employees`)
  return res.data
}

export async function createEmployee(venueId: string, employee: NewEmployee): Promise<EmployeeDTO> {
  const res = await api.post<EmployeeDTO>(`${base(venueId)}/employees`, employee)
  return res.data
}

export async function getPayrollPreview(venueId: string, period: string, periodicidad: PayrollPeriodicity): Promise<PayrollPreviewResponse> {
  const res = await api.get<PayrollPreviewResponse>(`${base(venueId)}/preview`, { params: { period, periodicidad } })
  return res.data
}

export async function runPayroll(venueId: string, period: string, periodicidad: PayrollPeriodicity, fechaPago: string): Promise<RunPayrollResult> {
  const res = await api.post<RunPayrollResult>(`${base(venueId)}/run`, { period, periodicidad, fechaPago })
  return res.data
}

export const nominaKeys = {
  all: ['nomina'] as const,
  employees: (venueId: string | null) => [...nominaKeys.all, 'employees', venueId] as const,
  preview: (venueId: string | null, period: string, periodicidad: PayrollPeriodicity) => [...nominaKeys.all, 'preview', venueId, period, periodicidad] as const,
}
