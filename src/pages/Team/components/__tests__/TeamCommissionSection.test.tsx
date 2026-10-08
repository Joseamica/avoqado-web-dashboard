// E6a-fix F9, hermano: el historial de comisiones de una persona (Equipo › persona) mostraba el mismo estado del resumen
// viejo que contradice al recibo de Pago al personal.
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import TeamCommissionSection from '../TeamCommissionSection'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('@/hooks/useCommissions', () => ({
  useStaffCommissions: () => ({
    data: {
      stats: { thisMonth: 0, lastMonth: 37.77, total: 37.77 },
      summaries: [
        { id: 's1', staffId: 'st1', periodStart: '2026-09-01', periodEnd: '2026-09-30', totalCommissions: 37.77, totalBonuses: 0, netAmount: 37.77, status: 'PAID' },
      ],
    },
    isLoading: false,
  }),
}))
vi.mock('@/components/data-table', () => ({
  default: ({ columns, data }: { columns: Array<{ header: ReactNode; cell: (c: unknown) => ReactNode; accessorKey?: string }>; data: unknown[] }) => (
    <table>
      <thead>
        <tr>{columns.map(c => <th key={c.accessorKey}>{c.header}</th>)}</tr>
      </thead>
      <tbody>
        {data.map((original, i) => (
          <tr key={i}>{columns.map(c => <td key={c.accessorKey}>{c.cell({ row: { original } })}</td>)}</tr>
        ))}
      </tbody>
    </table>
  ),
}))

describe('TeamCommissionSection', () => {
  it('🔴 el historial no dice el estado del resumen viejo («Pagado»): el pago vive en el recibo', () => {
    render(<TeamCommissionSection staffId="st1" />)
    expect(screen.getByText('staff.history')).toBeInTheDocument()
    expect(screen.queryByText('table.status')).toBeNull()
    expect(screen.queryByText('status.PAID')).toBeNull()
    expect(screen.getByText('summary.netAmount')).toBeInTheDocument()
  })
})
