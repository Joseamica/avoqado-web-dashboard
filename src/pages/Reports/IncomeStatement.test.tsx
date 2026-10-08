import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'
import { useIncomeStatement } from '@/hooks/useIncomeStatement'
import IncomeStatement from './IncomeStatement'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key} ${Object.values(opts).join(' ')}` : key),
    i18n: { language: 'es' },
  }),
}))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', venue: { name: 'X', timezone: 'America/Mexico_City' } }),
}))
vi.mock('@/hooks/useIncomeStatement', () => ({ useIncomeStatement: vi.fn() }))
vi.mock('@/components/date-range-picker', () => ({ DateRangePicker: () => null }))
vi.mock('@/utils/export', () => ({ exportToExcel: vi.fn(), generateFilename: () => 'f' }))

const estado = (o: Partial<ReturnType<typeof useIncomeStatement>>) =>
  vi.mocked(useIncomeStatement).mockReturnValue({
    data: undefined,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...o,
  } as ReturnType<typeof useIncomeStatement>)
const reporte = (revenue: Record<string, unknown>, metrics: Record<string, number>) => ({
  venueId: 'v1',
  venueName: 'X',
  currency: 'MXN',
  timezone: 'America/Mexico_City',
  period: { from: '2026-06-01', to: '2026-06-30' },
  taxRateAssumed: 0.16,
  revenue: { grossSalesCents: 0, refundsCents: 0, netRevenueCents: 0, taxableBaseCents: 0, ivaCents: 0, ...revenue },
  tips: { totalCents: 0 },
  metrics: { salesCount: 0, refundCount: 0, averageTicketCents: 0, ...metrics },
})

// Las tarjetas (`MetricCard`) llevan tooltip, y Radix exige el `TooltipProvider` que la app pone en su raíz: se pone aquí también.
const pantalla = () =>
  render(
    <TooltipProvider>
      <IncomeStatement />
    </TooltipProvider>,
  )

describe('IncomeStatement · los errores, «sin ventas» ≠ «sin movimientos» y la línea de las devoluciones (Codex r5 R5-8, R5-10; fallo 6)', () => {
  // Con llaves: un `beforeEach` que DEVUELVE una función hace que Vitest la llame como limpieza tras cada prueba; sin ellas
  // devolvería el doble y, en el hook, su promesa rechazada tumbaba la prueba después de pasar.
  beforeEach(() => {
    vi.mocked(useIncomeStatement).mockReset()
  })

  it('🔴 REPORT_TOO_LARGE: muestra el mensaje que mandó el servidor', () => {
    estado({
      isError: true,
      error: { response: { data: { code: 'REPORT_TOO_LARGE', message: 'La venta F-9 tiene demasiados renglones…' } } } as never,
    })
    pantalla()
    expect(screen.getByText('La venta F-9 tiene demasiados renglones…')).toBeInTheDocument()
  })

  it('control · otro error: el texto genérico', () => {
    estado({ isError: true, error: new Error('Network Error') as never })
    pantalla()
    expect(screen.getByText('accountingError.body')).toBeInTheDocument()
  })

  it('🔴 un mes sólo con devoluciones muestra el reporte (no «Sin ventas»), con la línea fija', () => {
    estado({
      data: reporte(
        { refundsCents: 5000, netRevenueCents: -5000, taxableBaseCents: -4310, ivaCents: -690, taxByRate: { '0.16': -690 } },
        { refundCount: 1 },
      ) as never,
    })
    pantalla()
    expect(screen.queryByText('incomeStatement.zeroTitle')).not.toBeInTheDocument()
    expect(screen.getByText('incomeStatement.refunds')).toBeInTheDocument()
    expect(screen.getByTestId('aviso-iva-por-tasa')).toHaveTextContent('ivaPorTasa.notaFacturas')
  })

  it('control · sin ventas ni devoluciones: el estado vacío de siempre, sin la línea', () => {
    estado({ data: reporte({}, {}) as never })
    pantalla()
    expect(screen.getByText('incomeStatement.zeroTitle')).toBeInTheDocument()
    expect(screen.queryByTestId('aviso-iva-por-tasa')).not.toBeInTheDocument()
  })
})
