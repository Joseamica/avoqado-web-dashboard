// E6a-fix F9 (QA H4): la tabla «Resumen de Comisiones» decía el estado de los resúmenes VIEJOS («Pagado», «Calculado»), que
// contradice al recibo de Pago al personal (Carlos «Pagado» con su recibo pendiente). El pago vive en el recibo.
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TeamCommissionTable from '../TeamCommissionTable'

const m = vi.hoisted(() => ({ summaries: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: object) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }) }))
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueSlug: 'x', fullBasePath: '/venues/x' }) }))
vi.mock('@/hooks/useCommissions', () => ({ useCommissionSummariesPage: () => m.summaries() }))
// La tabla real: encabezados y celdas tal cual las definen las columnas.
vi.mock('@/components/data-table', () => ({
  default: ({ columns, data }: { columns: Array<{ header: ReactNode; cell: (c: unknown) => ReactNode; id?: string; accessorKey?: string }>; data: unknown[] }) => (
    <table>
      <thead>
        <tr>{columns.map(c => <th key={c.id ?? c.accessorKey}>{c.header}</th>)}</tr>
      </thead>
      <tbody>
        {data.map((original, i) => (
          <tr key={i}>{columns.map(c => <td key={c.id ?? c.accessorKey}>{c.cell({ row: { original } })}</td>)}</tr>
        ))}
      </tbody>
    </table>
  ),
}))

const resumen = (status: string) => ({
  id: `s-${status}`,
  staffId: 'st1',
  staff: { firstName: 'Carlos', lastName: 'Rodríguez', staffVenueId: 'sv1' },
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
  totalCommissions: 37.77,
  netAmount: 37.77,
  status,
})

beforeEach(() => vi.clearAllMocks())

describe('TeamCommissionTable', () => {
  it('🔴 no dice el estado del resumen viejo (ni «Pagado» ni «Calculado»): el pago vive en el recibo', () => {
    m.summaries.mockReturnValue({ data: { items: [resumen('PAID'), resumen('CALCULATED')] }, isLoading: false })
    render(<TeamCommissionTable />)
    expect(screen.queryByText('table.status')).toBeNull()
    expect(screen.queryByText('status.PAID')).toBeNull()
    expect(screen.queryByText('status.CALCULATED')).toBeNull()
    // Lo demás sigue: quién, cuándo y cuánto calculó el motor.
    expect(screen.getAllByText('Carlos Rodríguez')).toHaveLength(2)
    expect(screen.getByText('table.commission')).toBeInTheDocument()
  })

  it('no ofrece aprobar ni pagar: la única acción es ver el detalle', () => {
    m.summaries.mockReturnValue({ data: { items: [resumen('PENDING_APPROVAL')] }, isLoading: false })
    render(<TeamCommissionTable />)
    expect(screen.queryByText(/approve|pay|aprobar|pagar/i)).toBeNull()
  })

  // E6a-fix2 C6 (full-testing E6a): los montos de esta tabla son lo CALCULADO por el motor y no siempre coinciden con lo que
  // se paga (devoluciones de hoy, comisiones ya pagadas por el flujo viejo). Con Pago al personal activo se dice y se enlaza.
  it('🔴 con Pago al personal activo, debajo del título dice que es lo calculado y lleva al recibo', () => {
    m.summaries.mockReturnValue({ data: { items: [resumen('CALCULATED')] }, isLoading: false })
    render(<TeamCommissionTable staffPayActive puedeVerRecibos />)
    expect(screen.getByText(/summary\.calculatedNote/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'overview.goToStaffPay' })).toHaveAttribute('href', '/venues/x/servicio-pago#periodos')
  })

  it('🔴 también sin resúmenes todavía (estado vacío)', () => {
    m.summaries.mockReturnValue({ data: { items: [] }, isLoading: false })
    render(<TeamCommissionTable staffPayActive puedeVerRecibos />)
    expect(screen.getByText(/summary\.calculatedNote/)).toBeInTheDocument()
  })

  it('sin Pago al personal activo no lo dice; sin permiso de verlo, la línea va sin enlace', () => {
    m.summaries.mockReturnValue({ data: { items: [resumen('CALCULATED')] }, isLoading: false })
    const { unmount } = render(<TeamCommissionTable />)
    expect(screen.queryByText(/summary\.calculatedNote/)).toBeNull()
    unmount()
    render(<TeamCommissionTable staffPayActive />)
    expect(screen.getByText(/summary\.calculatedNote/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'overview.goToStaffPay' })).toBeNull()
  })

  // E6a-fix3: el servidor topa la tabla a 500 renglones y manda `total`. Si hay más de los recibidos, se dice (nunca recorte mudo).
  it('🔴 si el servidor topó la tabla, dice «Mostrando N de total»', () => {
    m.summaries.mockReturnValue({ data: { items: [resumen('CALCULATED'), resumen('PAID')], total: 730 }, isLoading: false })
    render(<TeamCommissionTable />)
    expect(screen.getByText('summary.showing:{"n":2,"total":730}')).toBeInTheDocument()
  })
  it('sin total, o con todos los renglones, no dice nada', () => {
    m.summaries.mockReturnValue({ data: { items: [resumen('CALCULATED')], total: 1 }, isLoading: false })
    const { unmount } = render(<TeamCommissionTable />)
    expect(screen.queryByText(/summary\.showing/)).toBeNull()
    unmount()
    m.summaries.mockReturnValue({ data: { items: [resumen('CALCULATED')] }, isLoading: false })
    render(<TeamCommissionTable />)
    expect(screen.queryByText(/summary\.showing/)).toBeNull()
  })
})
