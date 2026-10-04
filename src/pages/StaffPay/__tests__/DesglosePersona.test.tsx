import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DesglosePersona } from '../components/DesglosePersona'

const m = vi.hoisted(() => ({ recibo: vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: any) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({
    formatDateTime: (d: string) => d,
    formatDate: (d: string) => d,
    formatCalendarDate: (d: string) => `dia(${d})`,
  }),
}))
vi.mock('../useNombreSede', () => ({ useNombreSede: () => (id: string) => id }))
vi.mock('@/services/staffPay.service', () => ({ staffPayService: {} }))
vi.mock('@/hooks/useStaffPay', () => ({
  useStaffPayDetail: () => ({ data: { pages: [{ items: [], nextCursor: null }] }, isLoading: false, isError: false, hasNextPage: false }),
  useStaffReceipt: () => m.recibo(),
}))

const recibo = (renglones: unknown[], total: string) => ({
  data: {
    persona: 'Carlos',
    periodo: { id: null, start: '2026-10-01', end: '2026-10-31', estado: 'OPEN' },
    renglones,
    total,
    cantidad: renglones.length,
    siguiente: null,
    pagadoEn: null,
    parcial: false,
  },
  isLoading: false,
  isError: false,
  hasNextPage: false,
})

beforeEach(() => vi.clearAllMocks())

describe('DesglosePersona', () => {
  it('en «Ajustes del periodo» la diferencia NO repite su fecha (ya viene en el concepto); el ajuste sí lleva la de captura', () => {
    m.recibo.mockReturnValue(
      recibo(
        [
          {
            tipo: 'DIFERENCIA',
            fecha: '2026-09-28',
            hora: null,
            sede: 'Wellness',
            concepto: 'Diferencia · Yoga (clase grupal) del 28 sep 2026 (clase de septiembre)',
            lugares: 10,
            monto: '40.00',
          },
          {
            tipo: 'AJUSTE',
            fecha: '2026-10-03',
            hora: null,
            sede: 'Wellness',
            concepto: 'Bono por cubrir',
            lugares: null,
            monto: '100.00',
          },
        ],
        '140.00',
      ),
    )
    render(<DesglosePersona staffId="a" staffName="Ana" clases={0} total="140.00" fecha="2026-10-01" onClose={vi.fn()} />)
    expect(screen.getByText('Diferencia · Yoga (clase grupal) del 28 sep 2026 (clase de septiembre)')).toBeInTheDocument()
    expect(screen.queryByText('dia(2026-09-28)')).not.toBeInTheDocument()
    expect(screen.getByText('period.capturedOn:{"fecha":"dia(2026-10-03)"}')).toBeInTheDocument()
    expect(screen.queryByText('period.negativeBalance')).not.toBeInTheDocument()
  })

  it('un recibo en negativo lo explica sin inventar una regla (QA B-6)', () => {
    m.recibo.mockReturnValue(
      recibo(
        [
          {
            tipo: 'DIFERENCIA',
            fecha: '2026-08-19',
            hora: null,
            sede: 'Wellness',
            concepto: 'Diferencia: Yoga',
            lugares: 7,
            monto: '-440.00',
          },
        ],
        '-360.00',
      ),
    )
    render(<DesglosePersona staffId="c" staffName="Carlos" clases={0} total="-360.00" fecha="2026-10-01" onClose={vi.fn()} />)
    expect(screen.getByRole('note')).toHaveTextContent('period.negativeBalance')
  })
})
