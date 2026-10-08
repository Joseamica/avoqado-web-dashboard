/**
 * C1 · Tarea 13 (Codex C1-25) — en la lista de facturas, la fila de una global PRINCIPAL timbrada o cancelada ofrece «Emitir
 * complementaria» por SU id, de cualquier periodicidad (también de antes de cambiarla). Una complementaria, una factura individual
 * o una fila de un servidor que todavía no dice si es complementaria, no.
 */
import { describe, it, expect, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import es from '@/locales/es/cfdi.json'
import type { Cfdi } from '@/services/cfdi.service'

const traducir = (key: string, opts?: Record<string, unknown>) => {
  const raw = key.split('.').reduce<any>((o, k) => o?.[k], es as any)
  if (typeof raw !== 'string') return key
  return raw.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(opts?.[k] ?? ''))
}
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: traducir, i18n: { language: 'es' } }),
}))

const m = vi.hoisted(() => ({ filas: [] as unknown[], permisos: ['cfdi:configure', 'cfdi:issue'] as string[] }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => m.permisos.includes(p) }) }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useTierFeatureAccess: () => ({ hasAccess: true }) }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', venue: { timezone: 'America/Mexico_City' } }),
}))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (d: string) => `fecha(${d})` }) }))
vi.mock('@/hooks/use-cfdi', () => ({
  useCfdis: () => ({ data: { cfdis: m.filas, total: m.filas.length }, isLoading: false, isError: false }),
  useDownloadCfdiFile: () => ({ mutate: () => {} }),
}))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
// La tabla real (paginación, columnas guardadas) no es lo que se prueba: cada fila pinta sus celdas.
vi.mock('@/components/data-table', () => ({
  default: ({ data, columns }: { data: any[]; columns: any[] }) => (
    <div>
      {data.map(row => (
        <div key={row.id} data-testid={`fila-${row.id}`}>
          {columns.map(c => (
            <div key={c.id}>{c.cell?.({ row: { original: row } })}</div>
          ))}
        </div>
      ))}
    </div>
  ),
}))
// El menú de Radix no abre en jsdom: aquí siempre está abierto y cada opción es un botón.
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}))
vi.mock('@/components/date-range-picker', () => ({ DateRangePicker: () => null }))
vi.mock('@/components/filters', () => ({
  FilterPillBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  FilterPill: () => null,
  CheckboxFilterContent: () => null,
}))
vi.mock('../components/CancelCfdiDialog', () => ({ CancelCfdiDialog: () => null }))
vi.mock('../components/ReplaceCfdiDialog', () => ({ ReplaceCfdiDialog: () => null }))
vi.mock('../components/SendCfdiEmailDialog', () => ({ SendCfdiEmailDialog: () => null }))
vi.mock('../components/GlobalComplementariaDialog', () => ({
  GlobalComplementariaDialog: ({ emisorId, principalId }: { emisorId: string | null; principalId: string | null }) =>
    principalId ? <div data-testid="complementaria">{`${emisorId}:${principalId}`}</div> : null,
}))

import CfdiList from '../CfdiList'

const ACCION = es.globalInvoice.periods.complementary

const factura = (over: Partial<Cfdi>): Cfdi => ({
  id: 'x',
  type: 'I',
  status: 'STAMPED',
  flow: 'GLOBAL_C',
  isGlobal: true,
  orderId: null,
  receptorRfc: 'XAXX010101000',
  receptorNombre: 'PUBLICO EN GENERAL',
  serie: 'G',
  folio: '1',
  uuid: 'U',
  subtotalCents: 10000,
  taxCents: 1600,
  totalCents: 11600,
  stampedAt: '2026-10-01T10:00:00.000Z',
  createdAt: '2026-10-01T10:00:00.000Z',
  cancelStatus: null,
  xmlUrl: null,
  pdfUrl: null,
  globalPeriod: { periodicidad: '04', meses: '09', anio: 2026 },
  fiscalEmisorId: 'e1',
  complementariaDe: null,
  ...over,
})

const fila = (id: string) => screen.getByTestId(`fila-${id}`)

describe('CfdiList · «Emitir complementaria» (C1-25)', () => {
  it('🔴 la principal timbrada, la cancelada y la diaria de antes del cambio de periodicidad la traen, y abre el diálogo con SU id', () => {
    m.filas = [
      factura({ id: 'g1' }),
      factura({ id: 'g2', status: 'CANCELLED', cancelStatus: 'ACCEPTED' }),
      factura({ id: 'g3', globalPeriod: { periodicidad: '01', meses: '09', anio: 2026 } }),
    ]
    m.permisos = ['cfdi:configure', 'cfdi:issue']
    render(<CfdiList />)
    for (const id of ['g1', 'g2', 'g3']) expect(within(fila(id)).getByRole('button', { name: ACCION })).toBeInTheDocument()
    fireEvent.click(within(fila('g2')).getByRole('button', { name: ACCION }))
    expect(screen.getByTestId('complementaria').textContent).toBe('e1:g2')
  })

  it('control — una complementaria, una factura individual, una principal sin timbrar o una fila sin saber si es complementaria NO la traen', () => {
    m.filas = [
      factura({ id: 'c2', complementariaDe: 'g1' }),
      factura({ id: 'i1', isGlobal: false, flow: 'STAFF_B', orderId: 'o1', globalPeriod: null }),
      factura({ id: 'p1', status: 'VALIDATION_FAILED' }),
      factura({ id: 'viejo', complementariaDe: undefined }),
      factura({ id: 'sinEmisor', fiscalEmisorId: undefined }),
    ]
    render(<CfdiList />)
    for (const id of ['c2', 'i1', 'p1', 'viejo', 'sinEmisor'])
      expect(within(fila(id)).queryByRole('button', { name: ACCION })).not.toBeInTheDocument()
  })

  it('control — M7 (b): sin `cfdi:configure` ni la principal timbrada la trae', () => {
    m.filas = [factura({ id: 'g1' })]
    m.permisos = ['cfdi:view']
    render(<CfdiList />)
    expect(within(fila('g1')).queryByRole('button', { name: ACCION })).not.toBeInTheDocument()
  })
})
