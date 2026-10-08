import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ActivarPagoAlPersonal } from '../components/ActivarPagoAlPersonal'

const m = vi.hoisted(() => ({
  activar: vi.fn(),
  can: vi.fn(),
  toast: vi.fn(),
  acceso: vi.fn(),
  releerAcceso: vi.fn(),
  sedes: vi.fn(),
  releerSedes: vi.fn(),
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: any) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: m.can }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ venueTimezone: 'America/Mexico_City', formatCalendarDate: (d: string) => `dia(${d})` }) }))
vi.mock('@/hooks/useStaffPay', () => ({
  useActivateStaffPay: () => ({ mutateAsync: m.activar, isPending: false }),
  useStaffPayAccess: () => ({ data: m.acceso(), refetch: m.releerAcceso }),
  useStaffPaySedes: () => ({ refetch: m.releerSedes, ...m.sedes() }),
}))
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, disabled, children }: any) => (
    <select aria-label="periodicidad" value={value} disabled={disabled} onChange={e => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}))
vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ open, children }: any) => (open ? <div role="alertdialog">{children}</div> : null),
  AlertDialogContent: ({ children }: any) => <>{children}</>,
  AlertDialogHeader: ({ children }: any) => <>{children}</>,
  AlertDialogFooter: ({ children }: any) => <>{children}</>,
  AlertDialogTitle: ({ children }: any) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: any) => <p>{children}</p>,
  AlertDialogCancel: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  AlertDialogAction: ({ children, ...p }: any) => <button {...p}>{children}</button>,
}))

const CERO = { clases: { n: 0, total: '0.00', pendientesDeValoracion: 0 }, comisiones: { n: 0, total: '0.00' }, propinas: { n: 0, total: '0.00' } }
const sede = (venueId: string, nombre: string, tienePlan: boolean) => ({
  venueId,
  nombre,
  zona: 'America/Mexico_City',
  tienePlan,
  estado: tienePlan ? 'SIN_ACTIVAR' : 'SIN_PLAN',
  desde: null,
  hasta: null,
  minimo: null,
  puedeActivar: false,
  puedeDesactivar: false,
  fueraEstePeriodo: CERO,
})
const conSedes = (...sedes: ReturnType<typeof sede>[]) => ({
  data: { activado: false, startDate: null, periodo: null, sedes },
  isLoading: false,
  isError: false,
  error: null,
})
const ACCESO = { enabled: true, activado: false, startDate: null, propinasEncendidas: false, periodicidad: 'MONTHLY', periodicidadFija: false }
const boton = () => screen.getByRole('button', { name: 'activation.button' })

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-20T18:00:00Z')) // 20-oct en CDMX
  m.can.mockReturnValue(true)
  m.acceso.mockReturnValue(ACCESO)
  m.sedes.mockReturnValue(conSedes(sede('s1', 'Centro', true), sede('s2', 'Norte', false)))
})
afterEach(() => vi.useRealTimers())

describe('ActivarPagoAlPersonal (spec §7.1, §11)', () => {
  it('explica qué hace y desde cuándo entra lo de las sedes, según la periodicidad', () => {
    render(<ActivarPagoAlPersonal />)
    expect(screen.getByText('activation.what')).toBeInTheDocument()
    expect(screen.getByText(/activation\.since/)).toHaveTextContent('dia(2026-10-01)')
    fireEvent.change(screen.getByLabelText('periodicidad'), { target: { value: 'SEMIMONTHLY' } })
    expect(screen.getByText(/activation\.since/)).toHaveTextContent('dia(2026-10-16)')
  })

  it('activar confirma la periodicidad aunque sea la mensual de fábrica, y manda la elegida, la fecha que vio y las sedes', async () => {
    m.activar.mockResolvedValue({ startDate: '2026-10-01', yaActivado: false })
    render(<ActivarPagoAlPersonal />)
    fireEvent.click(boton())
    expect(m.activar).not.toHaveBeenCalled() // primero la confirmación
    expect(screen.getByRole('alertdialog')).toHaveTextContent('periods.short.MONTHLY')
    fireEvent.click(screen.getAllByRole('button', { name: 'activation.button' })[1])
    await waitFor(() => expect(m.activar).toHaveBeenCalledWith({ periodicidad: 'MONTHLY', inicioEsperado: '2026-10-01', sedes: ['s1'] }))
    expect(m.toast).toHaveBeenCalledWith({ title: 'activation.done:{"fecha":"dia(2026-10-01)"}' })
  })

  // E6a-fix F12 (QA H9): doble clic en «Activar» mandaba 2 POST (el servidor es idempotente, pero creaba la petición de más).
  it('🔴 dos clics seguidos en «Activar» de la confirmación mandan UNA sola activación (candado síncrono)', async () => {
    m.activar.mockReturnValue(new Promise(() => undefined))
    render(<ActivarPagoAlPersonal />)
    fireEvent.click(boton())
    const confirmar = screen.getAllByRole('button', { name: 'activation.button' })[1]
    fireEvent.click(confirmar)
    fireEvent.click(confirmar)
    expect(m.activar).toHaveBeenCalledTimes(1)
  })

  it('tras un rechazo, el candado se suelta: se puede volver a activar', async () => {
    m.activar.mockRejectedValueOnce({ response: { status: 409, data: { code: 'INICIO_CAMBIO', message: 'Cambió' } } })
    m.activar.mockResolvedValueOnce({ startDate: '2026-10-01', yaActivado: false })
    render(<ActivarPagoAlPersonal />)
    fireEvent.click(boton())
    fireEvent.click(screen.getAllByRole('button', { name: 'activation.button' })[1])
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith({ title: 'Cambió', variant: 'destructive' }))
    fireEvent.click(boton())
    fireEvent.click(screen.getAllByRole('button', { name: 'activation.button' })[1])
    await waitFor(() => expect(m.activar).toHaveBeenCalledTimes(2))
  })

  it('sin staffpay:close no hay botón y dice a quién pedírselo', () => {
    m.can.mockReturnValue(false)
    render(<ActivarPagoAlPersonal />)
    expect(screen.queryByRole('button', { name: 'activation.button' })).toBeNull()
    expect(screen.getByText('activation.noPermission')).toBeInTheDocument()
  })

  it('las sedes con el plan vienen marcadas; las sin plan, apagadas y con su porqué; manda sólo las marcadas', async () => {
    m.sedes.mockReturnValue(conSedes(sede('s1', 'Centro', true), sede('s2', 'Norte', true), sede('s3', 'Sur', false)))
    m.activar.mockResolvedValue({ startDate: '2026-10-01', yaActivado: false })
    render(<ActivarPagoAlPersonal />)
    expect(screen.getByRole('checkbox', { name: 'Centro' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Norte' })).toBeChecked()
    const sur = screen.getByRole('checkbox', { name: 'Sur' })
    expect(sur).not.toBeChecked()
    expect(sur).toBeDisabled()
    expect(sur).toHaveAccessibleDescription('activation.venueNoPlan')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Norte' }))
    expect(screen.getByRole('checkbox', { name: 'Norte' })).not.toBeChecked()
    fireEvent.click(boton())
    fireEvent.click(screen.getAllByRole('button', { name: 'activation.button' })[1])
    await waitFor(() => expect(m.activar).toHaveBeenCalledWith({ periodicidad: 'MONTHLY', inicioEsperado: '2026-10-01', sedes: ['s1'] }))
  })

  it('sin ninguna sede marcada no deja activar, y dice por qué', () => {
    render(<ActivarPagoAlPersonal />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Centro' }))
    expect(boton()).toBeDisabled()
    expect(screen.getByText('activation.noVenues')).toBeInTheDocument()
    fireEvent.click(boton())
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('si la lista de sedes no carga, lo dice, deja reintentar y no deja activar', () => {
    m.sedes.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('red') })
    render(<ActivarPagoAlPersonal />)
    expect(screen.getByText('activation.venuesError')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'period.retry' }))
    expect(m.releerSedes).toHaveBeenCalled()
    expect(boton()).toBeDisabled()
  })

  it('con periodos guardados (periodicidad fija) arranca en la guardada y no deja cambiarla (E1d)', async () => {
    m.acceso.mockReturnValue({ ...ACCESO, periodicidad: 'SEMIMONTHLY', periodicidadFija: true })
    m.activar.mockResolvedValue({ startDate: '2026-10-16', yaActivado: false })
    render(<ActivarPagoAlPersonal />)
    const selector = screen.getByLabelText('periodicidad')
    expect(selector).toHaveValue('SEMIMONTHLY')
    expect(selector).toBeDisabled()
    expect(screen.getByText(/activation\.since/)).toHaveTextContent('dia(2026-10-16)')
    fireEvent.click(boton())
    fireEvent.click(screen.getAllByRole('button', { name: 'activation.button' })[1])
    await waitFor(() => expect(m.activar).toHaveBeenCalledWith({ periodicidad: 'SEMIMONTHLY', inicioEsperado: '2026-10-16', sedes: ['s1'] }))
  })

  it('sin periodos guardados arranca en la periodicidad guardada y sí deja cambiarla', () => {
    m.acceso.mockReturnValue({ ...ACCESO, periodicidad: 'SEMIMONTHLY', periodicidadFija: false })
    render(<ActivarPagoAlPersonal />)
    const selector = screen.getByLabelText('periodicidad')
    expect(selector).toHaveValue('SEMIMONTHLY')
    expect(selector).toBeEnabled()
    fireEvent.change(selector, { target: { value: 'MONTHLY' } })
    expect(screen.getByText(/activation\.since/)).toHaveTextContent('dia(2026-10-01)')
  })

  it('409 INICIO_CAMBIO (pasó la medianoche del cambio de periodo): dice el porqué, cierra la confirmación y la fecha se recalcula', async () => {
    vi.setSystemTime(new Date('2026-11-01T05:59:00Z')) // 31-oct 23:59 en CDMX
    m.activar.mockImplementation(async () => {
      vi.setSystemTime(new Date('2026-11-01T06:01:00Z')) // ya es 1-nov en CDMX
      throw { response: { status: 409, data: { message: 'La fecha de inicio cambió; vuelve a revisar.', code: 'INICIO_CAMBIO' } } }
    })
    render(<ActivarPagoAlPersonal />)
    expect(screen.getByText(/activation\.since/)).toHaveTextContent('dia(2026-10-01)')
    fireEvent.click(boton())
    fireEvent.click(screen.getAllByRole('button', { name: 'activation.button' })[1])
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith({ title: 'La fecha de inicio cambió; vuelve a revisar.', variant: 'destructive' }))
    expect(m.activar).toHaveBeenCalledWith({ periodicidad: 'MONTHLY', inicioEsperado: '2026-10-01', sedes: ['s1'] })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByText(/activation\.since/)).toHaveTextContent('dia(2026-11-01)')
  })

  it('409 PERIODICIDAD_FIJA (otro guardó periodos mientras tanto): al releer el acceso, el selector vuelve a la guardada y se bloquea', async () => {
    m.acceso.mockReturnValue({ ...ACCESO, periodicidad: 'MONTHLY', periodicidadFija: false })
    m.activar.mockRejectedValue({
      response: { status: 409, data: { message: 'La periodicidad ya no se puede cambiar: ya hay periodos guardados. Activa con la que ya tienes.', code: 'PERIODICIDAD_FIJA' } },
    })
    const { rerender } = render(<ActivarPagoAlPersonal />)
    fireEvent.change(screen.getByLabelText('periodicidad'), { target: { value: 'SEMIMONTHLY' } })
    fireEvent.click(boton())
    fireEvent.click(screen.getAllByRole('button', { name: 'activation.button' })[1])
    await waitFor(() => expect(m.releerAcceso).toHaveBeenCalled())
    m.acceso.mockReturnValue({ ...ACCESO, periodicidad: 'MONTHLY', periodicidadFija: true })
    rerender(<ActivarPagoAlPersonal />)
    expect(screen.getByLabelText('periodicidad')).toHaveValue('MONTHLY')
    expect(screen.getByLabelText('periodicidad')).toBeDisabled()
    expect(screen.getByText('activation.periodicityFixed')).toBeInTheDocument()
    expect(screen.getByText(/activation\.since/)).toHaveTextContent('dia(2026-10-01)')
  })

  it('409 SEDE_SIN_PLAN: dice qué sede (mensaje del servidor) y vuelve a leer el acceso y las sedes', async () => {
    m.activar.mockRejectedValue({
      response: { status: 409, data: { message: 'La sede Centro no tiene Pago al personal en su plan: contrátalo para activarla', code: 'SEDE_SIN_PLAN', details: { venueIds: ['s1'] } } },
    })
    render(<ActivarPagoAlPersonal />)
    fireEvent.click(boton())
    fireEvent.click(screen.getAllByRole('button', { name: 'activation.button' })[1])
    await waitFor(() =>
      expect(m.toast).toHaveBeenCalledWith({ title: 'La sede Centro no tiene Pago al personal en su plan: contrátalo para activarla', variant: 'destructive' }),
    )
    expect(m.releerSedes).toHaveBeenCalled()
    expect(m.releerAcceso).toHaveBeenCalled()
  })

  describe('inicio que dice el servidor (E1d, inicioAlActivar)', () => {
    const activar = async () => {
      fireEvent.click(boton())
      fireEvent.click(screen.getAllByRole('button', { name: 'activation.button' })[1])
    }
    it('periodicidad fija y guardada: usa la fecha del servidor en el texto y en inicioEsperado', async () => {
      vi.setSystemTime(new Date('2026-10-07T18:00:00Z'))
      m.acceso.mockReturnValue({ ...ACCESO, periodicidad: 'MONTHLY', periodicidadFija: true, inicioAlActivar: '2026-10-16' })
      m.activar.mockResolvedValue({ startDate: '2026-10-16', yaActivado: false })
      render(<ActivarPagoAlPersonal />)
      expect(screen.getByText(/activation\.since/)).toHaveTextContent('dia(2026-10-16)')
      await activar()
      await waitFor(() => expect(m.activar).toHaveBeenCalledWith({ periodicidad: 'MONTHLY', inicioEsperado: '2026-10-16', sedes: ['s1'] }))
    })
    it('sin el campo (servidor viejo): el cálculo de siempre', async () => {
      vi.setSystemTime(new Date('2026-10-07T18:00:00Z'))
      m.activar.mockResolvedValue({ startDate: '2026-10-01', yaActivado: false })
      render(<ActivarPagoAlPersonal />)
      expect(screen.getByText(/activation\.since/)).toHaveTextContent('dia(2026-10-01)')
      await activar()
      await waitFor(() => expect(m.activar).toHaveBeenCalledWith({ periodicidad: 'MONTHLY', inicioEsperado: '2026-10-01', sedes: ['s1'] }))
    })
    it('no fija y el dueño elige otra periodicidad que la guardada: se usa el cálculo, no la fecha del servidor', async () => {
      vi.setSystemTime(new Date('2026-10-07T18:00:00Z'))
      m.acceso.mockReturnValue({ ...ACCESO, periodicidad: 'MONTHLY', periodicidadFija: false, inicioAlActivar: '2026-10-16' })
      m.activar.mockResolvedValue({ startDate: '2026-10-01', yaActivado: false })
      render(<ActivarPagoAlPersonal />)
      fireEvent.change(screen.getByLabelText('periodicidad'), { target: { value: 'SEMIMONTHLY' } })
      expect(screen.getByText(/activation\.since/)).toHaveTextContent('dia(2026-10-01)')
      await activar()
      await waitFor(() => expect(m.activar).toHaveBeenCalledWith({ periodicidad: 'SEMIMONTHLY', inicioEsperado: '2026-10-01', sedes: ['s1'] }))
    })
  })
})
