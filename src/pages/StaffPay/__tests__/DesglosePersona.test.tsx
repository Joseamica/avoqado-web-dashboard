import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DesglosePersona } from '../components/DesglosePersona'
import { monto } from '../conSigno'

const m = vi.hoisted(() => ({ recibo: vi.fn(), detalle: vi.fn() }))
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
  useStaffPayDetail: () => m.detalle(),
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

const detalle = (items: unknown[]) => ({ data: { pages: [{ items, nextCursor: null }] }, isLoading: false, isError: false, hasNextPage: false })
const clase = (id: string, startsAt: string, x: Record<string, unknown> = {}) => ({
  classSessionId: id, venueId: 'w', productName: `Yoga ${id}`, startsAt, fechaLocal: startsAt.slice(0, 10), staffId: 'a', staffName: 'Ana',
  payLevelName: 'Coach', countMode: 'BOOKED', conteoCalculado: 6, conteo: 6, tieneAjuste: false, estado: 'OK', motivo: null, monto: '300.00', ...x,
})

beforeEach(() => {
  vi.clearAllMocks()
  m.detalle.mockReturnValue(detalle([]))
})

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

  it('periodo abierto: comisiones y propinas van en su sección, no en «Ajustes del periodo»; sin clases no dice «0 clases»', () => {
    m.recibo.mockReturnValue(
      recibo(
        [
          { tipo: 'COMISION', fecha: '2026-10-03', hora: '13:05', sede: 'Wellness', concepto: 'Comisión 3 % · venta #1234 · $3,000.00', lugares: null, monto: '90.00' },
          { tipo: 'PROPINA', fecha: '2026-10-03', hora: null, sede: 'Wellness', concepto: 'Propinas del 3 oct 2026 · 18 cobros', lugares: null, monto: '540.00' },
          { tipo: 'AJUSTE', fecha: '2026-10-04', hora: null, sede: 'Wellness', concepto: 'Bono por cubrir', lugares: null, monto: '100.00' },
        ],
        '730.00',
      ),
    )
    render(<DesglosePersona staffId="g" staffName="Grace" clases={0} total="730.00" fecha="2026-10-01" onClose={vi.fn()} />)
    const ventas = screen.getByText('period.salesSection').parentElement!
    expect(ventas).toHaveTextContent('Comisión 3 % · venta #1234')
    expect(ventas).toHaveTextContent('Propinas del 3 oct 2026 · 18 cobros')
    expect(ventas).not.toHaveTextContent('Bono por cubrir')
    const ajustes = screen.getByText('period.periodAdjustments').parentElement!
    expect(ajustes).toHaveTextContent('Bono por cubrir')
    expect(ajustes).not.toHaveTextContent('Comisión 3 %')
    expect(ajustes).not.toHaveTextContent('Propinas del 3 oct')
    // Un pago no lleva «+» (es lo que gana); el ajuste sí lleva su signo.
    expect(ventas).toHaveTextContent('$90.00')
    expect(ventas).not.toHaveTextContent('+$')
    expect(ajustes).toHaveTextContent('+$100.00')
    expect(screen.getByText(/period\.detailSummaryTotal/)).toBeInTheDocument()
  })

  // E6a-fix F11 (QA H6): en una tienda nadie tiene clases; el desglose de alguien con comisiones o propinas no abre diciendo
  // «Esta persona no tiene clases terminadas en este periodo.».
  it('🔴 sin clases pero con comisiones o propinas: no dice «no tiene clases terminadas» ni pinta una tabla de clases vacía', () => {
    m.recibo.mockReturnValue(
      recibo([{ tipo: 'COMISION', fecha: '2026-10-03', hora: '13:05', sede: 'Tienda', concepto: 'Comisión 3 % · venta #1234', lugares: null, monto: '90.00' }], '90.00'),
    )
    render(<DesglosePersona staffId="g" staffName="Grace" clases={0} total="90.00" fecha="2026-10-01" onClose={vi.fn()} />)
    expect(screen.queryByText('period.detailEmpty')).toBeNull()
    expect(screen.queryByText('period.detailColumns.class')).toBeNull()
    expect(screen.getByText('period.salesSection')).toBeInTheDocument()
  })

  it('🔴 sólo con ajustes tampoco dice «no tiene clases terminadas»', () => {
    m.recibo.mockReturnValue(recibo([{ tipo: 'AJUSTE', fecha: '2026-10-04', hora: null, sede: 'Tienda', concepto: 'Bono', lugares: null, monto: '50.00' }], '50.00'))
    render(<DesglosePersona staffId="g" staffName="Grace" clases={0} total="50.00" fecha="2026-10-01" onClose={vi.fn()} />)
    expect(screen.queryByText('period.detailEmpty')).toBeNull()
  })

  it('sin NADA (ni clases, ni ventas, ni ajustes): sí lo dice', () => {
    m.recibo.mockReturnValue(recibo([], '0.00'))
    render(<DesglosePersona staffId="g" staffName="Grace" clases={0} total="0.00" fecha="2026-10-01" onClose={vi.fn()} />)
    expect(screen.getByText('period.detailEmpty')).toBeInTheDocument()
  })

  it('mientras el recibo carga no se adelanta a decir que no hay nada', () => {
    m.recibo.mockReturnValue({ data: undefined, isLoading: true, isError: false, hasNextPage: false })
    render(<DesglosePersona staffId="g" staffName="Grace" clases={0} total="90.00" fecha="2026-10-01" onClose={vi.fn()} />)
    expect(screen.queryByText('period.detailEmpty')).toBeNull()
  })

  // E6a-fix F14 (QA H7): el desglose abierto ponía las clases como venían del cursor (9, 11, 8…) y sin la regla que movió el
  // pago, que el recibo cerrado, el PDF y el Excel sí dicen.
  it('🔴 periodo abierto: las clases van por fecha y dicen la regla que movió su pago, como el recibo cerrado', () => {
    m.detalle.mockReturnValue(
      detalle([
        clase('c11', '2026-09-11T15:00:00.000Z'),
        clase('c08', '2026-09-08T15:00:00.000Z', { regla: { tipo: 'CANCELACION_TARDIA', horas: 1 } }),
        clase('c09', '2026-09-07T15:00:00.000Z', { regla: { tipo: 'SUPLENCIA', horas: 2, bono: '100.00' }, monto: '400.00' }),
        clase('c10', '2026-09-10T15:00:00.000Z', { regla: { tipo: 'SUPLENCIA', horas: 0, bono: '100.00' } }),
      ]),
    )
    m.recibo.mockReturnValue(recibo([], '1300.00'))
    render(<DesglosePersona staffId="a" staffName="Ana" clases={4} total="1300.00" fecha="2026-09-01" onClose={vi.fn()} />)
    const filas = screen.getAllByText(/^Yoga c/).map(el => el.textContent!.slice(0, 8))
    expect(filas).toEqual(['Yoga c09', 'Yoga c08', 'Yoga c10', 'Yoga c11'])
    expect(screen.getByText(/^Yoga c09/).closest('td')).toHaveTextContent('classCard.coverBonus:{"horas":2,"monto":"+$100.00"}')
    expect(screen.getByText(/^Yoga c08/).closest('td')).toHaveTextContent('classCard.lateCancel:{"horas":1}')
    expect(screen.getByText(/^Yoga c10/).closest('td')).toHaveTextContent('classCard.coverBonusUnderHour:{"monto":"+$100.00"}')
    expect(screen.getByText(/^Yoga c11/).closest('td')).not.toHaveTextContent('classCard.')
  })

  it('recibo cerrado: totales por tipo arriba, una devolución de comisión con «−» y, sin nombre, «Persona dada de baja»', () => {
    const base = recibo(
      [
        { tipo: 'CLASE', fecha: '2026-09-04', hora: '08:00', sede: 'Wellness', concepto: 'Reformer', lugares: 8, monto: '570.00' },
        { tipo: 'COMISION', fecha: '2026-09-10', hora: '12:00', sede: 'Wellness', concepto: 'Devolución · Comisión 3 % · venta #1240', lugares: null, monto: '-40.00' },
      ],
      '530.00',
    )
    m.recibo.mockReturnValue({
      ...base,
      data: {
        ...base.data,
        totalesPorTipo: { CLASE: '570.00', COMISION: '-40.00' },
      },
    })
    render(<DesglosePersona staffId="x" staffName="" clases={1} total="530.00" fecha="2026-09-01" cerrado onClose={vi.fn()} />)
    expect(screen.getByText(/period\.detailTitle/)).toHaveTextContent('period.formerStaff')
    expect(screen.getByText('period.byType.CLASE')).toBeInTheDocument()
    expect(screen.getByText('period.byType.COMISION')).toBeInTheDocument()
    expect(screen.queryByText('period.byType.PROPINA')).toBeNull()
    expect(screen.getAllByText(monto('-40.00')).length).toBeGreaterThan(0)
    // En la tabla: la devolución con el «−» de la app (no el guion de Intl) y la clase sin «+».
    expect(screen.getByText(/^Devolución · Comisión/).closest('tr')!.lastElementChild).toHaveTextContent(monto('-40.00'))
    expect(screen.getByText('Reformer').closest('tr')!.lastElementChild!.textContent).toBe('$570.00')
  })

  it('el server manda el LITERAL «Persona dada de baja»: se traduce como cualquier persona borrada (pre-flight E5a #2)', () => {
    m.recibo.mockReturnValue(recibo([], '0.00'))
    render(<DesglosePersona staffId="x" staffName="Persona dada de baja" clases={0} total="0.00" fecha="2026-09-01" cerrado onClose={vi.fn()} />)
    expect(screen.getByText(/period\.detailTitle/)).toHaveTextContent('"name":"period.formerStaff"')
  })

  it('un solo tipo en el recibo no repite su total arriba (ya es el total)', () => {
    const base = recibo([{ tipo: 'CLASE', fecha: '2026-09-04', hora: '08:00', sede: 'Wellness', concepto: 'Reformer', lugares: 8, monto: '570.00' }], '570.00')
    m.recibo.mockReturnValue({ ...base, data: { ...base.data, totalesPorTipo: { CLASE: '570.00' } } })
    render(<DesglosePersona staffId="a" staffName="Ana" clases={1} total="570.00" fecha="2026-09-01" cerrado onClose={vi.fn()} />)
    expect(screen.queryByText('period.byType.CLASE')).toBeNull()
  })

  it('los totales por tipo van en un orden fijo (clases, comisiones, propinas, diferencias, ajustes), no en el del JSON', () => {
    const base = recibo([], '700.00')
    m.recibo.mockReturnValue({ ...base, data: { ...base.data, totalesPorTipo: { AJUSTE: '100.00', PROPINA: '30.00', CLASE: '570.00' } } })
    render(<DesglosePersona staffId="a" staffName="Ana" clases={1} total="700.00" fecha="2026-09-01" cerrado onClose={vi.fn()} />)
    const tipos = screen.getAllByText(/^period\.byType\./).map(x => x.textContent)
    expect(tipos).toEqual(['period.byType.CLASE', 'period.byType.PROPINA', 'period.byType.AJUSTE'])
  })

  const PENDIENTES = {
    n: 3,
    total: '-80.00',
    porDestino: [
      { seDescuenta: { tipo: 'AL_CERRAR', periodo: { start: '2026-11-01', end: '2026-11-30' } }, n: 2, total: '-50.00', porSede: [{ venueId: 'v1', n: 2, total: '-50.00' }] },
      { seDescuenta: { tipo: 'PERIODO_POSTERIOR_A', origen: { start: '2026-09-01', end: '2026-09-30' } }, n: 1, total: '-30.00', porSede: [{ venueId: 'v1', n: 1, total: '-30.00' }] },
    ],
    items: [],
    truncado: false,
  }

  it('recibo abierto: las devoluciones pendientes van aparte, una línea por destino, sin sumarse al total (pre-flight E5a #1)', () => {
    const base = recibo([{ tipo: 'AJUSTE', fecha: '2026-10-04', hora: null, sede: 'Wellness', concepto: 'Bono por cubrir', lugares: null, monto: '100.00' }], '100.00')
    m.recibo.mockReturnValue({ ...base, data: { ...base.data, pendientes: PENDIENTES } })
    render(<DesglosePersona staffId="a" staffName="Ana" clases={0} total="100.00" fecha="2026-10-01" onClose={vi.fn()} />)
    const seccion = screen.getByText('period.pendingTitle').parentElement!
    const lineas = seccion.querySelectorAll('li')
    expect(lineas).toHaveLength(2)
    expect(lineas[0]).toHaveTextContent('−$50.00')
    expect(lineas[0]).toHaveTextContent('period.pendingAtClose')
    expect(lineas[0]).toHaveTextContent('noviembre de 2026')
    expect(lineas[1]).toHaveTextContent('−$30.00')
    expect(lineas[1]).toHaveTextContent('period.pendingAfter')
    expect(lineas[1]).toHaveTextContent('septiembre de 2026')
    // No es un ajuste de este recibo: no aparece entre los «Ajustes del periodo».
    expect(screen.getByText('period.periodAdjustments').parentElement!).not.toHaveTextContent('−$50.00')
  })

  it('sin pendientes (null en una página con cursor, o ninguna) no hay sección; en un recibo cerrado tampoco', () => {
    const base = recibo([], '0.00')
    m.recibo.mockReturnValue({ ...base, data: { ...base.data, pendientes: null } })
    const { unmount } = render(<DesglosePersona staffId="a" staffName="Ana" clases={0} total="0.00" fecha="2026-10-01" onClose={vi.fn()} />)
    expect(screen.queryByText('period.pendingTitle')).toBeNull()
    unmount()
    m.recibo.mockReturnValue({ ...base, data: { ...base.data, pendientes: { ...PENDIENTES, n: 0, total: '0.00', porDestino: [] } } })
    const otro = render(<DesglosePersona staffId="a" staffName="Ana" clases={0} total="0.00" fecha="2026-10-01" onClose={vi.fn()} />)
    expect(screen.queryByText('period.pendingTitle')).toBeNull()
    otro.unmount()
    m.recibo.mockReturnValue({ ...base, data: { ...base.data, periodo: { ...base.data.periodo, estado: 'CLOSED' }, pendientes: PENDIENTES } })
    render(<DesglosePersona staffId="a" staffName="Ana" clases={0} total="0.00" fecha="2026-09-01" cerrado onClose={vi.fn()} />)
    expect(screen.queryByText('period.pendingTitle')).toBeNull()
  })
})
