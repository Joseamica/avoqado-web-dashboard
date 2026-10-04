import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PagoDeClaseCard } from '../components/PagoDeClaseCard'
import { NivelDePagoSection } from '@/pages/Team/components/NivelDePagoSection'
import type { PagoDeClaseDto } from '@/types/staffPay'

const m = vi.hoisted(() => ({
  pay: vi.fn(),
  adjust: vi.fn(),
  assign: vi.fn(),
  modalNivel: vi.fn(),
  can: vi.fn(),
  access: vi.fn(),
  diff: vi.fn(),
  dialogo: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: any) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x' }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => m.can(p) }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({
    venueTimezone: 'America/Mexico_City',
    formatCalendarDate: (d: string) => d,
    formatDate: (d: string) => d.slice(0, 10),
  }),
}))
// El modal de pantalla completa real es Radix con portal; aquí sólo importa su contenido y sus acciones.
vi.mock('@/components/ui/full-screen-modal', () => ({
  FullScreenModal: ({ open, children, actions }: { open: boolean; children: ReactNode; actions?: ReactNode }) =>
    open ? (
      <div>
        {actions}
        {children}
      </div>
    ) : null,
}))
// Select nativo: el de Radix no se deja manejar en jsdom.
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, disabled, children }: any) => (
    <select aria-label="nivel" value={value} disabled={disabled} onChange={e => onValueChange(e.target.value)}>
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}))
// El diálogo de liquidar tiene sus propias pruebas (DiferenciasSection); aquí importa con qué clase y sede se abre.
vi.mock('@/pages/StaffPay/components/LiquidarDialog', () => ({
  LiquidarDialog: (p: unknown) => {
    m.dialogo(p)
    return <div data-testid="liquidar-dialogo" />
  },
}))
vi.mock('@/pages/StaffPay/components/AsignarNivelModal', () => ({
  AsignarNivelModal: (p: any) => {
    m.modalNivel(p)
    return <div data-testid="asignar-nivel-modal">{p.payLevelName}</div>
  },
}))
vi.mock('@/hooks/useStaffPay', () => ({
  useStaffPayAccess: (enabled?: boolean) => m.access(enabled),
  useClassPay: (...a: unknown[]) => m.pay(...a),
  useAdjustClass: () => ({ mutateAsync: m.adjust, isPending: false }),
  useClassDifference: (...a: unknown[]) => m.diff(...a),
  useStaffPayLevels: () => ({
    data: [
      { id: 'l1', name: 'Coach', sortOrder: 0, archivedAt: null },
      { id: 'l2', name: 'Head Coach', sortOrder: 1, archivedAt: null },
    ],
    isLoading: false,
  }),
  useStaffPayAssignments: () => ({
    data: [{ staffId: 'st1', payLevelId: 'l1', payLevelName: 'Coach', effectiveFrom: '2026-09-01' }],
    isLoading: false,
  }),
  useAssignLevel: () => ({ mutate: m.assign, mutateAsync: m.assign }),
}))

const conRouter = (ui: ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>)

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
  ajuste: null,
  anclada: false,
  ...extra,
})

const prenderPermisos = () => {
  m.can.mockReturnValue(true)
  // Sin diferencia que revisar por default (como react-query deshabilitado).
  m.diff.mockReturnValue({ data: undefined, isLoading: false, isError: false })
  // Igual que react-query: deshabilitado ⇒ sin datos.
  m.access.mockImplementation((enabled = true) => ({ data: enabled ? { enabled: true } : undefined }))
}

describe('PagoDeClaseCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prenderPermisos()
  })

  it('muestra monto y conteo', () => {
    m.pay.mockReturnValue({
      data: {
        estado: 'OK',
        monto: '570.00',
        conteo: 8,
        maxCount: 10,
        countMode: 'BOOKED',
        staffName: 'Ana',
        payLevelName: 'Head Coach',
        ajuste: null,
      },
    })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(screen.getByText(/570/)).toBeInTheDocument()
    expect(screen.getByText(/classCard.seats/)).toHaveTextContent('"count":8')
    // El techo de la tabla no es el cupo de la clase: dentro del techo no se menciona.
    expect(screen.queryByText(/classCard\.seatsOverCap/)).not.toBeInTheDocument()
    // El modo de conteo va junto al conteo (spec §7.2).
    expect(screen.getByText(/classCard\.mode\.BOOKED/)).toBeInTheDocument()
  })

  it('arriba del techo dice con qué fila se paga en vez de «11 de 10»', () => {
    m.pay.mockReturnValue({
      data: {
        estado: 'OK',
        monto: '650.00',
        conteo: 11,
        maxCount: 10,
        countMode: 'BOOKED',
        staffName: 'Ana',
        payLevelName: 'Head Coach',
        ajuste: null,
      },
    })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(screen.getByText(/classCard\.seats:/)).toHaveTextContent('"count":11')
    expect(screen.getByText(/classCard\.seatsOverCap/)).toHaveTextContent('"max":10')
  })

  it('sin staffpay:read no pregunta nada al servidor y no pinta nada', () => {
    m.can.mockImplementation((p: string) => p !== 'staffpay:read' && p !== 'staffpay:manage')
    m.pay.mockReturnValue({ data: undefined })
    const { container } = conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(m.access).toHaveBeenCalled()
    expect(m.access.mock.calls.every(([enabled]) => enabled === false)).toBe(true)
    expect(m.pay.mock.calls.every(([, enabled]) => enabled === false)).toBe(true)
    expect(container).toBeEmptyDOMElement()
  })

  it('con «No se paga» prendido, un conteo inválido ya no bloquea guardar', () => {
    m.pay.mockReturnValue({ data: pago() })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    fireEvent.click(screen.getByRole('button', { name: 'classCard.exclude' }))
    fireEvent.change(screen.getByLabelText('adjust.count'), { target: { value: '9.5' } })
    fireEvent.change(screen.getByLabelText('adjust.reason'), { target: { value: 'Clase interna' } })
    expect(screen.getByRole('button', { name: 'adjust.save' })).toBeEnabled()
  })

  it('una excepción se explica con su motivo', () => {
    m.pay.mockReturnValue({ data: { estado: 'EXCEPCION', motivo: 'COACH_SIN_NIVEL', monto: null, conteo: 2, maxCount: 10, ajuste: null } })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(screen.getByText('reasons.COACH_SIN_NIVEL')).toBeInTheDocument()
  })

  it('el ajuste no se puede guardar hasta que el motivo tenga 3 letras', () => {
    m.pay.mockReturnValue({ data: pago() })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    fireEvent.click(screen.getByRole('button', { name: 'classCard.fixCount' }))
    const guardar = screen.getByRole('button', { name: 'adjust.save' })
    expect(guardar).toBeDisabled()
    fireEvent.change(screen.getByLabelText('adjust.count'), { target: { value: '9' } })
    fireEvent.change(screen.getByLabelText('adjust.reason'), { target: { value: 'ab' } })
    expect(guardar).toBeDisabled()
    fireEvent.change(screen.getByLabelText('adjust.reason'), { target: { value: 'abc' } })
    expect(guardar).toBeEnabled()
    fireEvent.click(guardar)
    expect(m.adjust).toHaveBeenCalledWith({ payCountOverride: 9, payAmountOverride: null, payExcluded: false, reason: 'abc' })
  })

  const contabilizada = (extra: Record<string, unknown> = {}) =>
    pago({
      conteo: 9,
      monto: '610.00',
      anclada: true,
      periodoOrigen: { id: 'p8', start: '2026-08-01', end: '2026-08-31', estado: 'CLOSED' },
      lineas: [
        {
          concepto: 'SERVICE',
          staffId: 'a',
          staffName: 'Ana',
          monto: '570.00',
          periodo: { start: '2026-08-01', end: '2026-08-31' },
          pagadoEn: null,
        },
        {
          concepto: 'RECONCILE',
          staffId: 'a',
          staffName: 'Ana',
          monto: '40.00',
          periodo: { start: '2026-10-01', end: '2026-10-31' },
          pagadoEn: '2026-11-03T15:00:00Z',
        },
      ],
      ...extra,
    })

  it('una clase contabilizada dice su periodo de origen y cada línea con el estado de su recibo', () => {
    m.pay.mockReturnValue({ data: contabilizada({ conteoCalculado: 8 }) })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(screen.getByText(/classCard\.origin/)).toHaveTextContent('2026-08-01')
    expect(screen.getByText(/classCard\.lineService/)).toHaveTextContent('570')
    expect(screen.getByText(/classCard\.lineReconcile/)).toHaveTextContent('40')
    expect(screen.getAllByText(/classCard\.linePending|classCard\.linePaid/)).toHaveLength(2)
    expect(screen.getByText(/classCard\.linePaid/)).toHaveTextContent('2026-11-03')
  })

  it('una diferencia a favor de la coach lleva su signo y una a cargo también', () => {
    m.pay.mockReturnValue({
      data: contabilizada({
        lineas: [
          {
            concepto: 'RECONCILE',
            staffId: 'a',
            staffName: 'Ana',
            monto: '-40.00',
            periodo: { start: '2026-10-01', end: '2026-10-31' },
            pagadoEn: null,
          },
        ],
      }),
    })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(screen.getByText(/classCard\.lineReconcile/)).toHaveTextContent('−$40.00')
  })

  it('lo contabilizado no se edita: dice que no cambia y, si puede corregir, que la corrección se paga aparte', () => {
    m.pay.mockReturnValue({ data: contabilizada() })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(screen.getByText('classCard.frozen')).toBeInTheDocument()
    expect(screen.getByText('classCard.fixAsDifference')).toBeInTheDocument()
    expect(screen.getByText('classCard.today')).toBeInTheDocument()
  })

  it('corregir una clase ya contabilizada y PAGADA avisa antes de guardar que lo pagado no cambia (QA defecto 10)', () => {
    const ficha = contabilizada() as PagoDeClaseDto
    const lineas = ficha.lineas!.map(l => (l.concepto === 'SERVICE' ? { ...l, pagadoEn: '2026-09-03T15:00:00Z' } : l))
    m.pay.mockReturnValue({ data: contabilizada({ lineas }) })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(screen.queryByRole('note')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'classCard.fixCount' }))
    const aviso = screen.getByRole('note')
    expect(aviso).toHaveTextContent('adjust.alreadyPaid')
    expect(aviso).toHaveTextContent('"start":"2026-08-01","end":"2026-08-31"')
  })

  it('contabilizada pero sin pagar: dice «se contabilizó», no «se pagó»', () => {
    m.pay.mockReturnValue({ data: contabilizada() })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    fireEvent.click(screen.getByRole('button', { name: 'classCard.fixAmount' }))
    expect(screen.getByRole('note')).toHaveTextContent('adjust.alreadyCounted')
  })

  it('una clase que no está en ningún cierre no lleva el aviso', () => {
    m.pay.mockReturnValue({ data: pago() })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    fireEvent.click(screen.getByRole('button', { name: 'classCard.fixCount' }))
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('sin permiso para corregir una clase contabilizada no ofrece corregir ni promete la diferencia', () => {
    m.can.mockImplementation((p: string) => p !== 'staffpay:close')
    m.pay.mockReturnValue({ data: contabilizada() })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(screen.getByText('classCard.frozen')).toBeInTheDocument()
    expect(screen.queryByText('classCard.fixAsDifference')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'classCard.fixCount' })).not.toBeInTheDocument()
  })

  it('una clase excluida y contabilizada sin líneas dice «No se pagó: excluida» una sola vez', () => {
    m.pay.mockReturnValue({
      data: contabilizada({
        estado: 'EXCLUIDA',
        monto: null,
        lineas: [],
        ajuste: { payCountOverride: null, payAmountOverride: null, payExcluded: true, reason: 'Clase interna', at: null },
      }),
    })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(screen.getByText(/classCard\.notPaidExcluded/)).toHaveTextContent('Clase interna')
    expect(screen.queryByText(/^classCard\.excluded:/)).not.toBeInTheDocument()
    // Lo de hoy ya se dijo arriba: no queda un «Lo que corresponde hoy» sin nada debajo.
    expect(screen.queryByText('classCard.today')).not.toBeInTheDocument()
  })

  it('una clase excluida con líneas ya contabilizadas sí dice «No se paga» de hoy, bajo «Lo que corresponde hoy»', () => {
    m.pay.mockReturnValue({
      data: contabilizada({
        estado: 'EXCLUIDA',
        monto: null,
        ajuste: { payCountOverride: null, payAmountOverride: null, payExcluded: true, reason: 'Clase interna', at: null },
      }),
    })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(screen.getByText(/^classCard\.excluded:/)).toHaveTextContent('Clase interna')
    expect(screen.getAllByText('classCard.today')).toHaveLength(1)
    expect(screen.queryByText(/classCard\.notPaidExcluded/)).not.toBeInTheDocument()
  })

  it('«Lo que corresponde hoy» encabeza lo de hoy una sola vez, también si la clase no ha terminado o se canceló', () => {
    for (const estado of ['NO_TERMINADA', 'CANCELADA']) {
      m.pay.mockReturnValue({ data: contabilizada({ estado, monto: null, conteo: null }) })
      const { unmount } = conRouter(<PagoDeClaseCard sessionId="s1" />)
      expect(screen.getAllByText('classCard.today')).toHaveLength(1)
      unmount()
    }
    m.pay.mockReturnValue({ data: contabilizada() })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(screen.getAllByText('classCard.today')).toHaveLength(1)
  })

  it('con ajuste, «la diferencia queda pendiente» sólo si no se pudo calcular el monto; sin ajuste, que se paga aparte al corregir', () => {
    const ajustada = contabilizada({ ajuste: { payCountOverride: 9, payAmountOverride: null, payExcluded: false, reason: 'Eran 9', at: null } })
    // Mientras llega el monto no se dice nada: si ya se liquidó, «queda pendiente» sería falso.
    m.pay.mockReturnValue({ data: ajustada })
    m.diff.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    let r = conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(screen.queryByText('classCard.differencePending')).not.toBeInTheDocument()
    r.unmount()
    m.diff.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    r = conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(screen.getByText('differences.loadError')).toBeInTheDocument()
    expect(screen.getByText('classCard.differencePending')).toBeInTheDocument()
    const { unmount } = r
    m.diff.mockReturnValue({ data: undefined, isLoading: false, isError: false })
    expect(screen.queryByText('classCard.fixAsDifference')).not.toBeInTheDocument()
    unmount()
    m.pay.mockReturnValue({ data: contabilizada() })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(screen.getByText('classCard.fixAsDifference')).toBeInTheDocument()
    expect(screen.queryByText('classCard.differencePending')).not.toBeInTheDocument()
  })

  it('un cierre sin líneas para una clase que hoy sí se paga dice «Sin pago en ese cierre»', () => {
    m.pay.mockReturnValue({ data: contabilizada({ lineas: [] }) })
    const { unmount } = conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(screen.getByText('classCard.noPayInClose')).toBeInTheDocument()
    unmount()
    m.pay.mockReturnValue({ data: contabilizada() })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(screen.queryByText('classCard.noPayInClose')).not.toBeInTheDocument()
  })

  it('un periodo de origen todavía abierto no dice que ya se cerró', () => {
    m.pay.mockReturnValue({
      data: contabilizada({ lineas: [], periodoOrigen: { id: 'p8', start: '2026-08-01', end: '2026-08-31', estado: 'OPEN' } }),
    })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(screen.getByText(/classCard\.originOpen/)).toBeInTheDocument()
    expect(screen.queryByText(/classCard\.origin:/)).not.toBeInTheDocument()
    // Abierto no es congelado: ni «no cambia» ni «no se llegó a pagar en ese cierre».
    expect(screen.queryByText('classCard.frozen')).not.toBeInTheDocument()
    expect(screen.queryByText('classCard.noPayInClose')).not.toBeInTheDocument()
  })

  it('una clase sin periodo de origen no pinta el bloque de contabilizada', () => {
    m.pay.mockReturnValue({ data: pago() })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(screen.queryByText(/classCard\.origin/)).not.toBeInTheDocument()
    expect(screen.queryByText('classCard.frozen')).not.toBeInTheDocument()
    expect(screen.queryByText('classCard.today')).not.toBeInTheDocument()
  })

  // ── Bloque B: diferencia pendiente de la clase ──
  const fila = (persona: string, personaNombre: string, pendiente: string | null) => ({
    classSessionId: 's1', venueId: 'v1', productName: 'Reformer', startsAt: '2026-08-04T14:00:00Z', fechaLocal: '2026-08-04', fechaValoracion: '2026-08-04',
    periodoOrigenId: null, persona, personaNombre, coachActual: persona, estadoClase: pendiente === null ? 'EXCEPCION' : 'OK', motivo: pendiente === null ? 'COACH_SIN_NIVEL' : null,
    corresponde: pendiente, congelado: '0.00', conciliado: '0.00', pendiente, payLevelId: null, payLevelName: null, tableVersionId: null, countMode: 'BOOKED', conteo: 8,
  })
  const diferencia = (filas: ReturnType<typeof fila>[], extra: Record<string, unknown> = {}) => ({
    data: {
      periodoOrigen: { id: 'p8', start: '2026-08-01', end: '2026-08-31' },
      destino: { start: '2026-10-01', end: '2026-10-31', venueIds: ['v1'] },
      sedeEnDestino: true,
      filas,
      total: filas.reduce((a, f) => a + Number(f.pendiente ?? 0), 0).toFixed(2),
      bloqueada: filas.some(f => f.pendiente === null),
      huella: 'h'.repeat(64),
      ...extra,
    },
    isLoading: false,
    isError: false,
  })

  it('una clase que llegó tarde dice que se paga como diferencia, cuánto y a quién, y ofrece Liquidar', () => {
    m.pay.mockReturnValue({ data: pago({ llegoTarde: true }) })
    m.diff.mockReturnValue(diferencia([fila('a', 'Ana Martínez', '430.00')]))
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    // Se pide bajo la sede de la clase (la del calendario) y sólo porque llegó tarde.
    expect(m.diff).toHaveBeenLastCalledWith('v1', 's1', true)
    expect(screen.getByText(/differences\.lateClass:/)).toHaveTextContent('"periodo":"agosto de 2026"')
    expect(screen.getByText(/differences\.pendingLine/)).toHaveTextContent('"persona":"Ana Martínez","monto":"+$430.00"')
    const liquidar = screen.getByRole('button', { name: /differences\.settleIn/ })
    expect(liquidar).toHaveTextContent('"periodo":"octubre de 2026"')
    fireEvent.click(liquidar)
    expect(m.dialogo).toHaveBeenLastCalledWith(expect.objectContaining({ classVenueId: 'v1', sessionId: 's1', desde: 'clase' }))
  })

  it('una sustitución de igual monto (−$480 y +$480, total cero) muestra a las dos personas y el botón (Codex R1-19)', () => {
    m.pay.mockReturnValue({ data: contabilizada({ ajuste: { payCountOverride: null, payAmountOverride: null, payExcluded: false, reason: 'La cubrió Sofía', at: null } }) })
    m.diff.mockReturnValue(diferencia([fila('a', 'Ana Martínez', '-480.00'), fila('s', 'Sofía Ruiz', '480.00')]))
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    const lineas = screen.getAllByText(/differences\.pendingLine/)
    expect(lineas.map(l => l.textContent)).toEqual([
      expect.stringContaining('"persona":"Ana Martínez","monto":"−$480.00"'),
      expect.stringContaining('"persona":"Sofía Ruiz","monto":"+$480.00"'),
    ])
    expect(screen.getByRole('button', { name: /differences\.settleIn/ })).toBeInTheDocument()
    // El monto explícito reemplaza al «la diferencia queda pendiente» genérico (QA defecto 10b).
    expect(screen.queryByText('classCard.differencePending')).not.toBeInTheDocument()
  })

  it('una clase cerrada sin nada pendiente no dice «queda pendiente» ni ofrece Liquidar', () => {
    m.pay.mockReturnValue({ data: contabilizada({ ajuste: { payCountOverride: 9, payAmountOverride: null, payExcluded: false, reason: 'Eran 9', at: null } }) })
    m.diff.mockReturnValue(diferencia([fila('a', 'Ana Martínez', '0.00')]))
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(screen.queryByText(/differences\.pendingLine/)).not.toBeInTheDocument()
    expect(screen.queryByText('classCard.differencePending')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /differences\.settle/ })).not.toBeInTheDocument()
  })

  it('una clase que no está en un cierre ni llegó tarde no pide la diferencia', () => {
    m.pay.mockReturnValue({ data: pago() })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(m.diff).toHaveBeenLastCalledWith('v1', 's1', false)
    expect(screen.queryByText(/differences\./)).not.toBeInTheDocument()
  })

  it('sin staffpay:close se ve cuánto queda pendiente, pero no el botón, y dice por qué', () => {
    m.can.mockImplementation((p: string) => p !== 'staffpay:close')
    m.pay.mockReturnValue({ data: pago({ llegoTarde: true }) })
    m.diff.mockReturnValue(diferencia([fila('a', 'Ana Martínez', '430.00')]))
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(screen.getByText(/differences\.pendingLine/)).toHaveTextContent('+$430.00')
    expect(screen.queryByRole('button', { name: /differences\.settle/ })).not.toBeInTheDocument()
    expect(screen.getByText('differences.noPermission')).toBeInTheDocument()
  })

  it('una diferencia bloqueada por una excepción no ofrece Liquidar y dice que se liquida al resolverla', () => {
    m.pay.mockReturnValue({ data: pago({ llegoTarde: true, estado: 'EXCEPCION', motivo: 'COACH_SIN_NIVEL', monto: null }) })
    m.diff.mockReturnValue(diferencia([fila('a', 'Ana Martínez', null)]))
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(screen.getByText('differences.blockedCard')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /differences\.settle/ })).not.toBeInTheDocument()
  })

  it('si la diferencia no se pudo calcular, lo dice', () => {
    m.pay.mockReturnValue({ data: pago({ llegoTarde: true }) })
    m.diff.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(screen.getByText('differences.loadError')).toBeInTheDocument()
  })

  it('una clase sin coach se resuelve con «No se paga esta clase»', () => {
    m.pay.mockReturnValue({ data: pago({ estado: 'EXCEPCION', motivo: 'SIN_COACH', monto: null, staffName: null, payLevelName: null }) })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    fireEvent.click(screen.getByRole('button', { name: 'classCard.exclude' }))
    fireEvent.change(screen.getByLabelText('adjust.reason'), { target: { value: 'Clase de prueba interna' } })
    fireEvent.click(screen.getByRole('button', { name: 'adjust.save' }))
    expect(m.adjust).toHaveBeenCalledWith({
      payCountOverride: null,
      payAmountOverride: null,
      payExcluded: true,
      reason: 'Clase de prueba interna',
    })
  })
})

describe('NivelDePagoSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prenderPermisos()
  })

  it('elegir otro nivel abre la confirmación con su vista previa; no asigna directo', () => {
    render(<NivelDePagoSection staffId="st1" staffName="Ana López" />)
    expect(screen.queryByTestId('asignar-nivel-modal')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('nivel'), { target: { value: 'l2' } })
    expect(screen.getByTestId('asignar-nivel-modal')).toHaveTextContent('Head Coach')
    expect(m.modalNivel).toHaveBeenLastCalledWith(expect.objectContaining({ staffId: 'st1', payLevelId: 'l2', staffName: 'Ana López' }))
    expect(m.assign).not.toHaveBeenCalled()
  })
})
