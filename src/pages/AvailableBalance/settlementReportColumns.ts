import { DateTime } from 'luxon'
import type { ReportKind } from '@/services/settlementReport.service'

const c = (id: string, required = false) => ({ id, labelKey: `settlementReport.columns.${id}`, required })
export const COLUMNAS: Record<ReportKind, Array<{ id: string; labelKey: string; required?: boolean }>> = {
  transactions: [
    ...['venue', 'folio', 'fechaCobro', 'terminal', 'autorizacion', 'ultimos4', 'tipoTarjeta', 'operacion', 'marca', 'consumo', 'propina', 'total', 'comision', 'ivaComision', 'totalComision', 'montoADepositar'].map(id => c(id)),
    c('fechaDeposito', true),
  ],
  deposits: [c('venue'), c('fechaDeposito', true), ...['periodo', 'consumo', 'propinas', 'total', 'comision', 'ivaComision', 'totalComision', 'depositoNeto'].map(id => c(id))],
}

export function rangoRapido(tipo: 'esteMes' | 'mesPasado' | 'ultimos30', venueTimezone: string, hoy: Date = new Date()) {
  const ahora = DateTime.fromJSDate(hoy).setZone(venueTimezone)
  const f = (d: DateTime) => d.toFormat('yyyy-LL-dd')
  if (tipo === 'esteMes') return { startDate: f(ahora.startOf('month')), endDate: f(ahora) }
  if (tipo === 'mesPasado') {
    const m = ahora.minus({ months: 1 })
    return { startDate: f(m.startOf('month')), endDate: f(m.endOf('month')) }
  }
  return { startDate: f(ahora.minus({ days: 29 })), endDate: f(ahora) }
}

export function diasDelRango(startDate: string, endDate: string): number {
  return Math.round(DateTime.fromISO(endDate, { zone: 'utc' }).diff(DateTime.fromISO(startDate, { zone: 'utc' }), 'days').days) + 1
}

export function motivoDeBloqueo(a: {
  dias: number
  candidatos: number | undefined
  format: 'xlsx' | 'csv'
  caps: { xlsx: number; csv: number } | undefined
}) {
  if (!(a.dias >= 1) || a.dias > 92) return { key: 'rangoLargo' as const }
  if (a.candidatos === undefined || !a.caps) return null
  if (a.candidatos > a.caps.csv) return { key: 'demasiados' as const, count: a.candidatos }
  if (a.format === 'xlsx' && a.candidatos > a.caps.xlsx) return { key: 'demasiadosExcel' as const, count: a.candidatos }
  return null
}
