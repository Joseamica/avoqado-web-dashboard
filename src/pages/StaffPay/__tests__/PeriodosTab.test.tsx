import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PeriodosTab } from '../components/PeriodosTab'

const mockFetchNext = vi.fn()

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: any) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('../components/PeriodoAbiertoTab', () => ({ PeriodoAbiertoTab: ({ fecha }: { fecha: string }) => <div>abierto {fecha}</div> }))
vi.mock('../components/PeriodoCerradoView', () => ({ PeriodoCerradoView: ({ periodId }: { periodId: string }) => <div>cerrado {periodId}</div> }))
vi.mock('@/hooks/useStaffPay', () => ({
  useStaffPayPeriods: () => ({
    data: { periodicidad: 'MONTHLY', puedeCambiarPeriodicidad: false, items: [
      { id: null, start: '2026-10-01', end: '2026-10-31', estado: 'OPEN', personas: 0, pagadas: 0, total: '0.00' },
      { id: 'p9', start: '2026-09-01', end: '2026-09-30', estado: 'CLOSED', personas: 4, pagadas: 2, total: '36620.00' },
    ], antesDe: '2026-09-01' },
    isLoading: false,
    hasNextPage: true,
    fetchNextPage: mockFetchNext,
    isFetchingNextPage: false,
  }),
  useSetPeriodicity: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

describe('PeriodosTab', () => {
  it('abre en el periodo abierto actual y explica por qué ya no se cambia la periodicidad', () => {
    render(<PeriodosTab activa />)
    expect(screen.getByText('abierto 2026-10-01')).toBeInTheDocument()
    expect(screen.getByText('periods.periodicityLocked')).toBeInTheDocument()
  })

  it('con más de una página ofrece ver los periodos anteriores (nada se recorta en silencio)', () => {
    render(<PeriodosTab activa />)
    fireEvent.click(screen.getByRole('button', { name: 'periods.loadOlder' }))
    expect(mockFetchNext).toHaveBeenCalled()
  })
})
