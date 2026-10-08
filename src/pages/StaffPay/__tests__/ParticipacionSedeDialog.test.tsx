import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ParticipacionSedeDialog } from '../components/ParticipacionSedeDialog'

const m = vi.hoisted(() => ({ preview: vi.fn(), activar: vi.fn(), desactivar: vi.fn(), toast: vi.fn(), pedidas: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: any) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatCalendarDate: (d: string) => `dia(${d})` }) }))
vi.mock('@/hooks/useStaffPay', () => ({
  useParticipationPreview: (sedeId: string, accion: string, fecha?: string) => { m.pedidas(sedeId, accion, fecha); return m.preview(fecha) },
  useActivateSede: () => ({ mutateAsync: m.activar, isPending: false }),
  useDeactivateSede: () => ({ mutateAsync: m.desactivar, isPending: false }),
}))

const cero = { clases: { n: 0, total: '0.00', pendientesDeValoracion: 0 }, comisiones: { n: 0, total: '0.00' }, propinas: { n: 0, total: '0.00' } }
const sede = { venueId: 'b', nombre: 'Condesa', zona: 'America/Mexico_City', tienePlan: true, estado: 'SIN_ACTIVAR', desde: null, hasta: null,
  minimo: '2026-10-01', puedeActivar: true, puedeDesactivar: false, fueraEstePeriodo: cero } as any
const activa = { ...sede, estado: 'ACTIVA_SIN_PLAN', desde: '2026-10-10', puedeActivar: false, puedeDesactivar: true }
const vista = (x: Record<string, unknown>) => ({ data: { fecha: '2026-10-20', minimo: '2026-10-01', maximo: '2026-10-20', zona: 'America/Mexico_City', ...x }, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() })
const boton = (nombre: RegExp) => screen.getByRole('button', { name: nombre })

beforeEach(() => vi.clearAllMocks())

describe('ParticipacionSedeDialog — pantalla 2 del founder (diseño r3.7(2), r5.4)', () => {
  it('activar: pide la vista previa de la fecha elegida y dice qué entra y qué queda fuera', () => {
    m.preview.mockImplementation((f?: string) => vista({ accion: 'activar', fecha: f ?? '2026-10-20',
      entran: { ...cero, comisiones: { n: 3, total: '90.00' } }, quedanFuera: { ...cero, propinas: { n: 18, total: '540.00' } } }))
    render(<ParticipacionSedeDialog sede={sede} accion="activar" onClose={vi.fn()} />)
    expect(m.pedidas).toHaveBeenLastCalledWith('b', 'activar', undefined) // primero «hoy» (lo resuelve el servidor)
    fireEvent.change(screen.getByLabelText('sedes.dialogo.desde'), { target: { value: '2026-10-05' } })
    expect(m.pedidas).toHaveBeenLastCalledWith('b', 'activar', '2026-10-05')
    expect(screen.getByText(/sedes\.dialogo\.entran/)).toHaveTextContent('dia(2026-10-05)')
    expect(screen.getByText(/sedes\.dialogo\.quedanFuera/)).toHaveTextContent('sedes.cuenta.propinas')
    expect(screen.getByText('sedes.dialogo.ajuste')).toBeInTheDocument()
    // El campo sólo deja elegir dentro del rango que dio el servidor, y lo dice.
    expect(screen.getByLabelText('sedes.dialogo.desde')).toHaveAttribute('min', '2026-10-01')
    expect(screen.getByLabelText('sedes.dialogo.desde')).toHaveAttribute('max', '2026-10-20')
    expect(screen.getByText(/sedes\.dialogo\.rango/)).toHaveTextContent('dia(2026-10-01)')
  })

  it('activar sin nada vendido ni nada fuera: lo dice con sus frases, sin montos', () => {
    m.preview.mockReturnValue(vista({ accion: 'activar', entran: cero, quedanFuera: cero }))
    render(<ParticipacionSedeDialog sede={sede} accion="activar" onClose={vi.fn()} />)
    expect(screen.getByText(/sedes\.dialogo\.entranNada/)).toBeInTheDocument()
    expect(screen.getByText('sedes.dialogo.quedaFueraNada')).toBeInTheDocument()
    expect(screen.queryByText('sedes.dialogo.ajuste')).toBeNull()
  })

  it('confirmar manda la fecha de la vista previa y el «hoy» que vio (fechaEsperada)', async () => {
    m.preview.mockReturnValue(vista({ accion: 'activar', entran: cero, quedanFuera: cero }))
    m.activar.mockResolvedValue({ ventana: { venueId: 'b', desde: '2026-10-20', hasta: null }, minimo: '2026-10-01', minimoEfectivo: '2026-10-01' })
    const onClose = vi.fn()
    render(<ParticipacionSedeDialog sede={sede} accion="activar" onClose={onClose} />)
    fireEvent.click(boton(/sedes\.dialogo\.confirmarActivar/))
    await waitFor(() => expect(m.activar).toHaveBeenCalledWith({ sedeId: 'b', desde: '2026-10-20', fechaEsperada: '2026-10-20' }))
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith({ title: expect.stringContaining('sedes.dialogo.activada') }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('con otra fecha elegida: «desde» es esa fecha y fechaEsperada sigue siendo el «hoy» de la sede (maximo)', async () => {
    m.preview.mockImplementation((f?: string) => vista({ accion: 'activar', fecha: f ?? '2026-10-20', entran: cero, quedanFuera: cero }))
    m.activar.mockResolvedValue({ ventana: { venueId: 'b', desde: '2026-10-05', hasta: null }, minimo: '2026-10-01', minimoEfectivo: '2026-10-01' })
    render(<ParticipacionSedeDialog sede={sede} accion="activar" onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('sedes.dialogo.desde'), { target: { value: '2026-10-05' } })
    fireEvent.click(boton(/sedes\.dialogo\.confirmarActivar/))
    await waitFor(() => expect(m.activar).toHaveBeenCalledWith({ sedeId: 'b', desde: '2026-10-05', fechaEsperada: '2026-10-20' }))
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith({ title: 'sedes.dialogo.activada:{"sede":"Condesa","fecha":"dia(2026-10-05)"}' }))
  })

  it('dos clics seguidos mandan UNA sola activación (candado síncrono)', async () => {
    m.preview.mockReturnValue(vista({ accion: 'activar', entran: cero, quedanFuera: cero }))
    let soltar: (v: unknown) => void = () => {}
    m.activar.mockReturnValue(new Promise(r => { soltar = r }))
    render(<ParticipacionSedeDialog sede={sede} accion="activar" onClose={vi.fn()} />)
    fireEvent.click(boton(/sedes\.dialogo\.confirmarActivar/))
    fireEvent.click(boton(/sedes\.dialogo\.confirmarActivar/))
    soltar({ ventana: { venueId: 'b', desde: '2026-10-20', hasta: null }, minimo: '2026-10-01', minimoEfectivo: '2026-10-01' })
    await waitFor(() => expect(m.toast).toHaveBeenCalled())
    expect(m.activar).toHaveBeenCalledTimes(1)
  })

  it('mientras la vista previa se vuelve a pedir, no se confirma (montos de otra fecha)', () => {
    m.preview.mockReturnValue({ ...vista({ accion: 'activar', entran: cero, quedanFuera: cero }), isFetching: true })
    render(<ParticipacionSedeDialog sede={sede} accion="activar" onClose={vi.fn()} />)
    expect(boton(/sedes\.dialogo\.confirmarActivar/)).toBeDisabled()
  })

  it('409 FECHA_CAMBIO: lo dice, vuelve a pedir la vista previa y no cierra', async () => {
    const v = vista({ accion: 'activar', entran: cero, quedanFuera: cero })
    m.preview.mockReturnValue(v)
    m.activar.mockRejectedValue({ response: { status: 409, data: { code: 'FECHA_CAMBIO', message: 'La fecha de hoy cambió (ya es 21 oct 2026): vuelve a revisar', details: { hoy: '2026-10-21' } } } })
    const onClose = vi.fn()
    render(<ParticipacionSedeDialog sede={sede} accion="activar" onClose={onClose} />)
    fireEvent.click(boton(/sedes\.dialogo\.confirmarActivar/))
    await waitFor(() => expect(v.refetch).toHaveBeenCalled())
    expect(m.toast).toHaveBeenCalledWith({ title: 'La fecha de hoy cambió (ya es 21 oct 2026): vuelve a revisar', variant: 'destructive' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('409 FECHA_CAMBIO con una fecha elegida: vuelve a «hoy» (la del servidor) en lugar de releer la vieja', async () => {
    m.preview.mockImplementation((f?: string) => vista({ accion: 'activar', fecha: f ?? '2026-10-21', maximo: '2026-10-21', entran: cero, quedanFuera: cero }))
    m.activar.mockRejectedValue({ response: { status: 409, data: { code: 'FECHA_CAMBIO', message: 'La fecha de hoy cambió', details: { hoy: '2026-10-21' } } } })
    render(<ParticipacionSedeDialog sede={sede} accion="activar" onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('sedes.dialogo.desde'), { target: { value: '2026-10-05' } })
    fireEvent.click(boton(/sedes\.dialogo\.confirmarActivar/))
    await waitFor(() => expect(m.pedidas).toHaveBeenLastCalledWith('b', 'activar', undefined))
  })

  it('otro 4xx (VENTANA_SE_CRUZA, YA_ACTIVA…): el mensaje del servidor y la vista previa de nuevo; no cierra', async () => {
    const v = vista({ accion: 'activar', entran: cero, quedanFuera: cero })
    m.preview.mockReturnValue(v)
    m.activar.mockRejectedValue({ response: { status: 409, data: { code: 'YA_ACTIVA', message: 'La sede ya está activa' } } })
    const onClose = vi.fn()
    render(<ParticipacionSedeDialog sede={sede} accion="activar" onClose={onClose} />)
    fireEvent.click(boton(/sedes\.dialogo\.confirmarActivar/))
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith({ title: 'La sede ya está activa', variant: 'destructive' }))
    expect(v.refetch).toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('sin respuesta (red): el aviso genérico; no cierra', async () => {
    const v = vista({ accion: 'activar', entran: cero, quedanFuera: cero })
    m.preview.mockReturnValue(v)
    m.activar.mockRejectedValue(new Error('Network Error'))
    const onClose = vi.fn()
    render(<ParticipacionSedeDialog sede={sede} accion="activar" onClose={onClose} />)
    fireEvent.click(boton(/sedes\.dialogo\.confirmarActivar/))
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith({ title: 'errors.generic', variant: 'destructive' }))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('desactivar: «último día», dejan de entrar / permanecen; antes de su inicio dice que borra la activación', () => {
    m.preview.mockImplementation((f?: string) => vista({ accion: 'desactivar', fecha: f ?? '2026-10-20', minimo: '2026-10-09',
      dejanDeEntrar: { ...cero, comisiones: { n: 1, total: '70.00' } }, permanecen: { ...cero, comisiones: { n: 1, total: '60.00' } } }))
    render(<ParticipacionSedeDialog sede={activa} accion="desactivar" onClose={vi.fn()} />)
    expect(screen.getByText(/sedes\.dialogo\.dejanDeEntrar/)).toBeInTheDocument()
    expect(screen.getByText(/sedes\.dialogo\.permanecen/)).toBeInTheDocument()
    expect(screen.queryByText('sedes.dialogo.borraActivacion')).toBeNull()
    fireEvent.change(screen.getByLabelText('sedes.dialogo.hasta'), { target: { value: '2026-10-09' } })
    expect(screen.getByText('sedes.dialogo.borraActivacion')).toBeInTheDocument()
  })

  it('desactivar sin nada que deje de entrar: «Nada cambia con esa fecha»', () => {
    m.preview.mockReturnValue(vista({ accion: 'desactivar', dejanDeEntrar: cero, permanecen: cero }))
    render(<ParticipacionSedeDialog sede={activa} accion="desactivar" onClose={vi.fn()} />)
    expect(screen.getByText('sedes.dialogo.nadaCambia')).toBeInTheDocument()
  })

  it('confirmar desactivar manda el último día y el «hoy» que vio; si borró la activación, lo dice', async () => {
    m.preview.mockReturnValue(vista({ accion: 'desactivar', fecha: '2026-10-09', minimo: '2026-10-09', dejanDeEntrar: cero, permanecen: cero }))
    m.desactivar.mockResolvedValue({ ventana: null, minimo: '2026-10-01', minimoEfectivo: '2026-10-01' })
    const onClose = vi.fn()
    render(<ParticipacionSedeDialog sede={activa} accion="desactivar" onClose={onClose} />)
    fireEvent.click(boton(/sedes\.dialogo\.confirmarDesactivar/))
    await waitFor(() => expect(m.desactivar).toHaveBeenCalledWith({ sedeId: 'b', hasta: '2026-10-09', fechaEsperada: '2026-10-20' }))
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith({ title: expect.stringContaining('sedes.dialogo.borrada') }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('desactivar que deja la ventana: «desactivada, su último día es…» con la fecha del servidor', async () => {
    m.preview.mockReturnValue(vista({ accion: 'desactivar', dejanDeEntrar: cero, permanecen: cero }))
    m.desactivar.mockResolvedValue({ ventana: { venueId: 'b', desde: '2026-10-10', hasta: '2026-10-20' }, minimo: '2026-10-01', minimoEfectivo: '2026-10-01' })
    render(<ParticipacionSedeDialog sede={activa} accion="desactivar" onClose={vi.fn()} />)
    fireEvent.click(boton(/sedes\.dialogo\.confirmarDesactivar/))
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith({ title: 'sedes.dialogo.desactivada:{"sede":"Condesa","fecha":"dia(2026-10-20)"}' }))
  })

  it('un error de la vista previa (409 YA_ACTIVA, 400 FECHA_FUERA_DE_RANGO…) se dice y no deja confirmar', () => {
    m.preview.mockReturnValue({ data: undefined, isLoading: false, isFetching: false, isError: true, refetch: vi.fn(),
      error: { response: { status: 400, data: { code: 'FECHA_FUERA_DE_RANGO', message: 'La fecha no puede ser futura', details: { desde: '2026-10-01', hasta: '2026-10-20' } } } } })
    render(<ParticipacionSedeDialog sede={sede} accion="activar" onClose={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('La fecha no puede ser futura')
    expect(boton(/sedes\.dialogo\.confirmarActivar/)).toBeDisabled()
  })

  it('cancelar cierra sin mandar nada', () => {
    m.preview.mockReturnValue(vista({ accion: 'activar', entran: cero, quedanFuera: cero }))
    const onClose = vi.fn()
    render(<ParticipacionSedeDialog sede={sede} accion="activar" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'closed.cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(m.activar).not.toHaveBeenCalled()
  })
})
