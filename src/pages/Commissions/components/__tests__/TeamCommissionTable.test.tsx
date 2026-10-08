// E6a-fix F9 (QA H4): la tabla «Resumen de Comisiones» decía el estado de los resúmenes VIEJOS («Pagado», «Calculado»), que
// contradice al recibo de Pago al personal (Carlos «Pagado» con su recibo pendiente). El pago vive en el recibo.
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TeamCommissionTable from '../TeamCommissionTable'

const m = vi.hoisted(() => ({ summaries: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueSlug: 'x', fullBasePath: '/venues/x' }) }))
vi.mock('@/hooks/useCommissions', () => ({ useCommissionSummaries: () => m.summaries() }))
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
    m.summaries.mockReturnValue({ data: [resumen('PAID'), resumen('CALCULATED')], isLoading: false })
    render(<TeamCommissionTable />)
    expect(screen.queryByText('table.status')).toBeNull()
    expect(screen.queryByText('status.PAID')).toBeNull()
    expect(screen.queryByText('status.CALCULATED')).toBeNull()
    // Lo demás sigue: quién, cuándo y cuánto calculó el motor.
    expect(screen.getAllByText('Carlos Rodríguez')).toHaveLength(2)
    expect(screen.getByText('table.commission')).toBeInTheDocument()
  })

  it('no ofrece aprobar ni pagar: la única acción es ver el detalle', () => {
    m.summaries.mockReturnValue({ data: [resumen('PENDING_APPROVAL')], isLoading: false })
    render(<TeamCommissionTable />)
    expect(screen.queryByText(/approve|pay|aprobar|pagar/i)).toBeNull()
  })
})
