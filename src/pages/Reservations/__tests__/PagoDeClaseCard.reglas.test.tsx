import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { conSigno } from '@/pages/StaffPay/conSigno'
import { Currency } from '@/utils/currency'
import { PagoDeClaseCard } from '../components/PagoDeClaseCard'

/**
 * La tarjeta de pago de la clase con lo que agregó la fase 3 (E4): el motivo de una regla de clase (spec §6.6) y la clase
 * fuera del sobre (B11, `FUERA_DEL_SOBRE`). Archivo aparte de `PagoDeClaseCard.test.tsx`, que ya pasa de 500 líneas.
 */
const m = vi.hoisted(() => ({ pay: vi.fn(), diff: vi.fn(), can: vi.fn() }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: any) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x' }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => m.can(p) }) }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({
    venueTimezone: 'America/Mexico_City',
    formatCalendarDate: (d: string) => d,
    formatDate: (d: string) => d.slice(0, 10),
  }),
}))
vi.mock('@/pages/StaffPay/components/LiquidarDialog', () => ({ LiquidarDialog: () => null, MotivoPorResolver: () => null }))
vi.mock('../components/AjustePagoClaseModal', () => ({ AjustePagoClaseModal: () => null }))
vi.mock('@/hooks/useStaffPay', () => ({
  useStaffPayAccess: (enabled?: boolean) => ({ data: enabled ? { enabled: true, activado: true, startDate: '2026-09-01' } : undefined }),
  useClassPay: (...a: unknown[]) => m.pay(...a),
  useClassDifference: (...a: unknown[]) => m.diff(...a),
}))

const conRouter = (ui: ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>)

/** La forma real de `PagoDeClase` (D3d + B11): los campos de siempre, `regla`, `montoSiEntrara` y `sede`. */
const pago = (extra: Record<string, unknown> = {}) => ({
  classSessionId: 's1',
  estado: 'OK',
  motivo: null,
  monto: '570.00',
  conteo: 8,
  conteoCalculado: 8,
  maxCount: 10,
  countMode: 'BOOKED',
  staffName: 'Ana',
  payLevelName: 'Head Coach',
  regla: null,
  ajuste: null,
  anclada: false,
  llegoTarde: false,
  periodoOrigen: null,
  lineas: [],
  montoSiEntrara: null,
  sede: null,
  ...extra,
})
const mostrar = (p: Record<string, unknown>) => {
  m.pay.mockReturnValue({ data: pago(p), isLoading: false, isError: false })
  conRouter(<PagoDeClaseCard sessionId="s1" />)
}

describe('PagoDeClaseCard: reglas de clase y clase fuera del sobre (fase 3, E4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.can.mockReturnValue(true)
    m.diff.mockReturnValue({ data: undefined, isLoading: false, isError: false })
  })

  it('dice por qué sube el monto: suplencia avisada con poco tiempo; el bono sale de la regla (spec §6.6)', () => {
    mostrar({ monto: '670.00', regla: { tipo: 'SUPLENCIA', horas: 3, bono: '100.00' } })
    const texto = screen.getByText(/classCard\.coverBonus/)
    expect(texto).toHaveTextContent('"horas":3')
    expect(texto).toHaveTextContent(conSigno('100.00'))
    expect(screen.queryByText(/classCard\.lateCancel/)).toBeNull()
  })

  it('una cancelada con poco aviso se paga y dice por qué (spec §6.6)', () => {
    mostrar({ monto: '430.00', conteo: 0, regla: { tipo: 'CANCELACION_TARDIA', horas: 2 } })
    expect(screen.getByText(/classCard\.lateCancel/)).toHaveTextContent('"horas":2')
    expect(screen.queryByText(/classCard\.coverBonus/)).toBeNull()
  })

  it('sin regla no dice ningún motivo', () => {
    mostrar({ regla: null })
    expect(screen.queryByText(/classCard\.(coverBonus|lateCancel)/)).toBeNull()
  })

  it('con 0 h de aviso dice «menos de 1 h», nunca «0 h antes» (pre-flight E4 #3, valoracion.ts:15)', () => {
    mostrar({ monto: '670.00', regla: { tipo: 'SUPLENCIA', horas: 0, bono: '100.00' } })
    const sup = screen.getByText(/classCard\.coverBonusUnderHour/)
    expect(sup).toHaveTextContent(conSigno('100.00'))
    expect(sup).not.toHaveTextContent('"horas"')
    expect(screen.queryByText(/classCard\.coverBonus:/)).toBeNull()
  })

  it('una cancelada con 0 h de aviso también dice «menos de 1 h»', () => {
    mostrar({ monto: '430.00', conteo: 0, regla: { tipo: 'CANCELACION_TARDIA', horas: 0 } })
    expect(screen.getByText('classCard.lateCancelUnderHour')).toBeInTheDocument()
    expect(screen.queryByText(/classCard\.lateCancel:/)).toBeNull()
  })

  it('cancelada tarde con conteo corregido: no dice lugares ni «el sistema contó» — se paga la fila de 0 (pre-flight E4 #4)', () => {
    mostrar({
      monto: '430.00',
      conteo: 0,
      conteoCalculado: 0,
      regla: { tipo: 'CANCELACION_TARDIA', horas: 2 },
      ajuste: { payCountOverride: 8, payAmountOverride: null, payExcluded: false, reason: 'Llegaron 8', at: '2026-10-01T10:00:00Z' },
    })
    expect(screen.getByText(/classCard\.lateCancel/)).toBeInTheDocument()
    expect(screen.queryByText(/classCard\.seats/)).toBeNull()
    expect(screen.queryByText(/classCard\.calculated/)).toBeNull()
    expect(screen.getByText(Currency(430))).toBeInTheDocument()
  })

  it('sin regla, el conteo corregido sí dice lugares y «el sistema contó»', () => {
    mostrar({
      conteo: 8,
      conteoCalculado: 6,
      ajuste: { payCountOverride: 8, payAmountOverride: null, payExcluded: false, reason: 'x', at: null },
    })
    expect(screen.getByText(/classCard\.seats/)).toBeInTheDocument()
    expect(screen.getByText(/classCard\.calculated/)).toBeInTheDocument()
  })

  it('fuera del sobre: dice que la sede no estaba activa ese día, cuánto se pagaría y lleva a Sedes; sin botones de ajuste (pre-flight E4 #2)', () => {
    mostrar({
      estado: 'FUERA_DEL_SOBRE',
      monto: null,
      montoSiEntrara: '570.00',
      sede: { nombre: 'Wellness', fecha: '2026-10-20' },
    })
    expect(screen.getByText(/classCard\.outOfEnvelope/)).toHaveTextContent(JSON.stringify({ sede: 'Wellness', fecha: '2026-10-20' }))
    expect(screen.getByText(/classCard\.wouldPay/)).toHaveTextContent(Currency(570))
    expect(screen.getByRole('link', { name: 'classCard.goToVenues' })).toHaveAttribute('href', '/venues/x/servicio-pago#sedes')
    for (const b of ['classCard.fixCount', 'classCard.fixAmount', 'classCard.exclude'])
      expect(screen.queryByRole('button', { name: b })).toBeNull()
    // Ni monto grande, ni motivo de excepción, ni diferencia: la clase no entra al recibo.
    expect(screen.queryByText(Currency(570), { selector: 'p.text-2xl' })).toBeNull()
    expect(screen.queryByText(/^reasons\./)).toBeNull()
    expect(m.diff).toHaveBeenCalledWith('v1', 's1', false)
  })

  it('fuera del sobre sin monto calculable: no promete cuánto se pagaría', () => {
    mostrar({ estado: 'FUERA_DEL_SOBRE', monto: null, montoSiEntrara: null, sede: { nombre: 'Wellness', fecha: '2026-10-20' } })
    expect(screen.getByText(/classCard\.outOfEnvelope/)).toBeInTheDocument()
    expect(screen.queryByText(/classCard\.wouldPay/)).toBeNull()
    expect(screen.getByRole('link', { name: 'classCard.goToVenues' })).toBeInTheDocument()
  })
})
