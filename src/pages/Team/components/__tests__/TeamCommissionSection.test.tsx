// E6a-fix F9, hermano: el historial de comisiones de una persona (Equipo › persona) mostraba el mismo estado del resumen
// viejo que contradice al recibo de Pago al personal.
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TeamCommissionSection from '../TeamCommissionSection'

const m = vi.hoisted(() => ({ stats: vi.fn(), staff: vi.fn(), can: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: object) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }) }))
vi.mock('react-router-dom', () => ({ Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a> }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ fullBasePath: '/venues/x' }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: m.can }) }))
vi.mock('@/hooks/useCommissions', () => ({
  useStaffCommissions: () => m.staff(),
  useCommissionStats: () => ({ data: m.stats() }),
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

const SUMMARY = { id: 's1', staffId: 'st1', periodStart: '2026-09-01', periodEnd: '2026-09-30', totalCommissions: 37.77, totalBonuses: 0, netAmount: 37.77, status: 'PAID' }
const staff = (extra: object = {}) => ({
  data: { stats: { thisMonth: 0, lastMonth: 37.77, total: 37.77 }, summaries: [SUMMARY], ...extra },
  isLoading: false,
})
beforeEach(() => {
  vi.clearAllMocks()
  m.staff.mockReturnValue(staff())
  m.stats.mockReturnValue({ staffPayActive: false })
  m.can.mockReturnValue(true)
})

describe('TeamCommissionSection', () => {
  it('🔴 el historial no dice el estado del resumen viejo («Pagado»): el pago vive en el recibo', () => {
    render(<TeamCommissionSection staffId="st1" />)
    expect(screen.getByText('staff.history')).toBeInTheDocument()
    expect(screen.queryByText('table.status')).toBeNull()
    expect(screen.queryByText('status.PAID')).toBeNull()
    expect(screen.getByText('summary.netAmount')).toBeInTheDocument()
  })

  // E6a-fix3 C6 (hermano): el historial de la persona es lo CALCULADO igual que «Resumen de Comisiones».
  it('🔴 con Pago al personal activo, el historial dice que es lo calculado y lleva al recibo', () => {
    m.stats.mockReturnValue({ staffPayActive: true })
    render(<TeamCommissionSection staffId="st1" />)
    expect(screen.getByText(/summary\.calculatedNote/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'overview.goToStaffPay' })).toHaveAttribute('href', '/venues/x/servicio-pago#periodos')
  })
  it('sin permiso de ver recibos, la línea va sin enlace; sin Pago al personal activo, no se dice', () => {
    m.stats.mockReturnValue({ staffPayActive: true })
    m.can.mockImplementation((p: string) => p !== 'staffpay:read')
    const { unmount } = render(<TeamCommissionSection staffId="st1" />)
    expect(screen.getByText(/summary\.calculatedNote/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'overview.goToStaffPay' })).toBeNull()
    unmount()
    m.stats.mockReturnValue({ staffPayActive: false })
    render(<TeamCommissionSection staffId="st1" />)
    expect(screen.queryByText(/summary\.calculatedNote/)).toBeNull()
  })
  it('🔴 también sin historial todavía (estado vacío)', () => {
    m.stats.mockReturnValue({ staffPayActive: true })
    m.staff.mockReturnValue(staff({ summaries: [] }))
    render(<TeamCommissionSection staffId="st1" />)
    expect(screen.getByText(/summary\.calculatedNote/)).toBeInTheDocument()
  })
})
