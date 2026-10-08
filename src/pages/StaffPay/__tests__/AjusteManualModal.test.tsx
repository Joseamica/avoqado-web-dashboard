import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AjusteManualModal } from '../components/AjusteManualModal'
import { hoyEnSede } from '../hoyEnSede'
import { sumarMeses } from '../rangos'

const m = vi.hoisted(() => ({ add: vi.fn(), toast: vi.fn(), equipo: vi.fn(), reporte: vi.fn(), vistaPrevia: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: any) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatCalendarDate: (d: string) => d }) }))
vi.mock('../useNombreSede', () => ({ useNombreSede: () => (id: string) => id }))
vi.mock('@/components/ui/full-screen-modal', () => ({
  FullScreenModal: ({ open, children, actions }: { open: boolean; children: ReactNode; actions?: ReactNode }) => (open ? <div>{actions}{children}</div> : null),
}))
vi.mock('@tanstack/react-query', async orig => ({ ...(await orig<object>()), useQuery: () => m.equipo() }))
// El combobox real (Popover + cmdk) no se deja manejar en jsdom: cada resultado es un botón.
vi.mock('@/components/search-combobox', () => ({
  SearchCombobox: ({ items, onSelect, value, onChange, inputId }: any) => (
    <div>
      <input id={inputId} value={value} onChange={e => onChange(e.target.value)} />
      {items.map((i: any) => (
        <button key={i.id} type="button" onClick={() => onSelect(i)}>
          {i.label}
          {i.description ? ` - ${i.description}` : ''}
        </button>
      ))}
    </div>
  ),
}))
vi.mock('@/hooks/useStaffPay', () => ({
  useAddAdjustment: () => ({ mutateAsync: m.add, isPending: false }),
  useStaffPayReport: (...a: unknown[]) => m.reporte(...a),
  useAdjustmentPreview: (...a: unknown[]) => m.vistaPrevia(...a),
}))
vi.mock('@/components/ui/select', () => import('@/test/nativeSelectShim'))

const persona = (staffId: string, firstName: string, lastName: string, email: string) => ({ staffId, firstName, lastName, email })
const CARLA = { data: { data: [persona('s1', 'Carla', 'QA', 'carla@estudio.mx')], meta: { totalCount: 1, hasNextPage: false } } }

const llenar = (tipo: 'manualAdjust.bonus' | 'manualAdjust.deduction' = 'manualAdjust.deduction') => {
  fireEvent.click(screen.getByRole('button', { name: /Carla QA/ }))
  fireEvent.click(screen.getByRole('button', { name: tipo }))
  fireEvent.change(screen.getByLabelText('manualAdjust.amount'), { target: { value: '150' } })
  fireEvent.change(screen.getByLabelText('manualAdjust.reason'), { target: { value: 'Llegó tarde' } })
}

beforeEach(() => {
  vi.clearAllMocks()
  m.equipo.mockReturnValue(CARLA)
  m.reporte.mockReturnValue({ data: undefined })
  m.vistaPrevia.mockReturnValue({ data: undefined })
})

describe('AjusteManualModal', () => {
  it('un descuento se manda negativo, con sede, motivo y una clave única', async () => {
    m.add.mockResolvedValue({ id: 'e1', periodo: { start: '2026-10-01', end: '2026-10-31' } })
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    llenar()
    fireEvent.click(screen.getByRole('button', { name: 'manualAdjust.save' }))
    await waitFor(() => expect(m.add).toHaveBeenCalledWith(expect.objectContaining({ staffId: 's1', sede: 'v1', amount: -150, reason: 'Llegó tarde' })))
    expect(m.add.mock.calls[0][0].clientKey).toMatch(/.{8,}/)
  })
  it('cada persona trae su correo para distinguir a dos con el mismo nombre', () => {
    m.equipo.mockReturnValue({ data: { data: [persona('s1', 'Carla', 'QA', 'carla@estudio.mx'), persona('s2', 'Carla', 'QA', 'carla.qa@gmail.com')] } })
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    expect(screen.getByRole('button', { name: 'Carla QA - carla@estudio.mx' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Carla QA - carla.qa@gmail.com' })).toBeInTheDocument()
  })
  it('con más resultados de los que caben, dice cuántos hay y pide escribir el nombre', () => {
    m.equipo.mockReturnValue({ data: { data: [persona('s1', 'Carla', 'QA', 'c@x.mx')], meta: { totalCount: 120, hasNextPage: true } } })
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    expect(screen.getByText(/manualAdjust\.moreResults/)).toHaveTextContent('"n":1,"total":120')
  })
  it('antes de guardar dice qué va a pasar: a quién y cuánto se resta', () => {
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} etiqueta="octubre 2026" />)
    llenar()
    const resumen = screen.getByText(/manualAdjust\.summaryDeduction/)
    expect(resumen).toHaveTextContent('Carla QA')
    expect(resumen).toHaveTextContent('octubre 2026')
  })
  it('la persona elegida sigue elegida aunque la búsqueda ya no la traiga', async () => {
    m.add.mockResolvedValue({ id: 'e1', periodo: { start: '2026-10-01', end: '2026-10-31' } })
    const { rerender } = render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    llenar()
    m.equipo.mockReturnValue({ data: { data: [persona('s2', 'Luis', 'Pérez', 'luis@x.mx')] } })
    rerender(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    expect(screen.getByText(/manualAdjust\.selected/)).toHaveTextContent('Carla QA')
    fireEvent.click(screen.getByRole('button', { name: 'manualAdjust.save' }))
    await waitFor(() => expect(m.add).toHaveBeenCalledWith(expect.objectContaining({ staffId: 's1' })))
  })
  it('si el server falla, reintentar manda la MISMA clave (el server no crea dos)', async () => {
    m.add.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Se cayó' } } })
    m.add.mockResolvedValueOnce({ id: 'e1', periodo: { start: '2026-10-01', end: '2026-10-31' } })
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    llenar('manualAdjust.bonus')
    fireEvent.click(screen.getByRole('button', { name: 'manualAdjust.save' }))
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Se cayó', variant: 'destructive' })))
    fireEvent.click(screen.getByRole('button', { name: 'manualAdjust.save' }))
    await waitFor(() => expect(m.add).toHaveBeenCalledTimes(2))
    expect(m.add.mock.calls[1][0].clientKey).toBe(m.add.mock.calls[0][0].clientKey)
    expect(m.add.mock.calls[1][0].amount).toBe(150)
    // La fecha destino viaja SIEMPRE y es la misma en el reintento (Codex bloque A #1): no la decide el reloj del server.
    expect(m.add.mock.calls[0][0].fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(m.add.mock.calls[1][0].fecha).toBe(m.add.mock.calls[0][0].fecha)
  })
  it('con la fecha del periodo abierto, manda ESA fecha', async () => {
    m.add.mockResolvedValue({ id: 'e1', periodo: { start: '2026-10-01', end: '2026-10-31' } })
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} fecha="2026-10-01" etiqueta="octubre 2026" />)
    llenar()
    fireEvent.click(screen.getByRole('button', { name: 'manualAdjust.save' }))
    await waitFor(() => expect(m.add).toHaveBeenCalledWith(expect.objectContaining({ fecha: '2026-10-01' })))
  })
  it('sin etiqueta (desde un periodo cerrado), el resumen dice la fecha exacta a la que va', () => {
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} fecha="2026-11-01" />)
    llenar()
    expect(screen.getByText(/manualAdjust\.summaryDeduction/)).toHaveTextContent('2026-11-01')
  })
  it('el buscador de persona se llama «Persona» (label conectado al input)', () => {
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    expect(screen.getByLabelText('manualAdjust.person')).toBeInstanceOf(HTMLInputElement)
  })
  it('un monto con más de 2 decimales o más grande que el tope se dice en línea, sin vista previa engañosa ni «Guardar» (A12)', () => {
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} etiqueta="octubre 2026" />)
    llenar('manualAdjust.bonus')
    for (const malo of ['10.005', '1000000000000', '-5']) {
      fireEvent.change(screen.getByLabelText('manualAdjust.amount'), { target: { value: malo } })
      expect(screen.getByText('manualAdjust.amountInvalid')).toBeInTheDocument()
      expect(screen.queryByText(/manualAdjust\.summaryBonus/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'manualAdjust.save' })).toBeDisabled()
    }
    fireEvent.change(screen.getByLabelText('manualAdjust.amount'), { target: { value: '10.01' } })
    expect(screen.queryByText('manualAdjust.amountInvalid')).not.toBeInTheDocument()
    expect(screen.getByText(/manualAdjust\.summaryBonus/)).toHaveTextContent('$10.01')
    expect(screen.getByRole('button', { name: 'manualAdjust.save' })).toBeEnabled()
  })
  it('«.5» vale ($0.50); y el aviso no parpadea mientras se teclea «0» o «0.»: espera a salir del campo', () => {
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} etiqueta="octubre 2026" />)
    llenar('manualAdjust.bonus')
    const monto = screen.getByLabelText('manualAdjust.amount')
    fireEvent.change(monto, { target: { value: '.5' } })
    expect(screen.queryByText('manualAdjust.amountInvalid')).not.toBeInTheDocument()
    expect(screen.getByText(/manualAdjust\.summaryBonus/)).toHaveTextContent('$0.50')
    for (const medio of ['0.', '0']) {
      fireEvent.change(monto, { target: { value: medio } })
      expect(screen.queryByText('manualAdjust.amountInvalid')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'manualAdjust.save' })).toBeDisabled()
    }
    fireEvent.blur(monto)
    expect(screen.getByText('manualAdjust.amountInvalid')).toBeInTheDocument()
  })
  it('teclear «0.05» no hace parpadear el aviso en «0.0»; y tras un primer blur, volver a «0» no avisa a la primera tecla', () => {
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} etiqueta="octubre 2026" />)
    llenar('manualAdjust.bonus')
    const monto = screen.getByLabelText('manualAdjust.amount')
    for (const paso of ['0', '0.0', '0.05']) {
      fireEvent.change(monto, { target: { value: paso } })
      expect(screen.queryByText('manualAdjust.amountInvalid')).not.toBeInTheDocument()
    }
    fireEvent.change(monto, { target: { value: '0' } })
    fireEvent.blur(monto)
    expect(screen.getByText('manualAdjust.amountInvalid')).toBeInTheDocument()
    // Se vuelve a escribir: «0.0» está a medias otra vez, el aviso espera al siguiente blur.
    fireEvent.change(monto, { target: { value: '0.0' } })
    expect(screen.queryByText('manualAdjust.amountInvalid')).not.toBeInTheDocument()
    fireEvent.change(monto, { target: { value: '0.05' } })
    expect(screen.getByText(/manualAdjust\.summaryBonus/)).toHaveTextContent('$0.05')
  })
  it('un 400 del server se dice en línea y legible (sin «Error de validación: amount:»)', async () => {
    m.add.mockRejectedValue({ response: { status: 400, data: { message: 'Error de validación: amount: Máximo dos decimales' } } })
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    llenar('manualAdjust.bonus')
    fireEvent.click(screen.getByRole('button', { name: 'manualAdjust.save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Máximo dos decimales')
    expect(m.toast).not.toHaveBeenCalled()
  })
  // E6a-fix F10 (contrato con el server): ajustar un periodo anterior al inicio ⇒ 409 ANTES_DEL_INICIO con su mensaje.
  it('un ajuste a un periodo anterior al inicio (409 ANTES_DEL_INICIO) dice el mensaje del servidor y no cierra', async () => {
    const onOpenChange = vi.fn()
    m.add.mockRejectedValue({
      response: { status: 409, data: { code: 'ANTES_DEL_INICIO', message: 'Pago al personal está activo desde el 1 sep 2026: ese periodo es anterior' } },
    })
    render(<AjusteManualModal open onOpenChange={onOpenChange} sedes={['v1']} />)
    llenar()
    fireEvent.click(screen.getByRole('button', { name: 'manualAdjust.save' }))
    await waitFor(() =>
      expect(m.toast).toHaveBeenCalledWith({ title: 'Pago al personal está activo desde el 1 sep 2026: ese periodo es anterior', variant: 'destructive' }),
    )
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('un periodo de hace más de 12 meses no admite ajustes: se dice antes de guardar (A6)', () => {
    const vieja = sumarMeses(hoyEnSede('America/Mexico_City'), -13)
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} fecha={vieja} />)
    llenar()
    expect(screen.getByRole('alert')).toHaveTextContent(/manualAdjust\.outOfRange/)
    expect(screen.getByRole('button', { name: 'manualAdjust.save' })).toBeDisabled()
  })
  it('el 400 FECHA_FUERA_DE_RANGO también se explica en línea', async () => {
    m.add.mockRejectedValue({
      response: { status: 400, data: { code: 'FECHA_FUERA_DE_RANGO', message: 'La fecha debe estar entre el 4 oct 2025 y el 31 oct 2026', details: { desde: '2025-10-04', hasta: '2026-10-31' } } },
    })
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    llenar()
    fireEvent.click(screen.getByRole('button', { name: 'manualAdjust.save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La fecha debe estar entre el 4 oct 2025 y el 31 oct 2026')
  })
  it('doble clic síncrono en «Guardar ajuste» manda UNA sola vez', () => {
    m.add.mockReturnValue(new Promise(() => undefined))
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    llenar()
    const guardar = screen.getByRole('button', { name: 'manualAdjust.save' })
    fireEvent.click(guardar)
    fireEvent.click(guardar)
    expect(m.add).toHaveBeenCalledTimes(1)
  })
  it('sin motivo o con monto vacío no deja guardar', () => {
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    expect(screen.getByRole('button', { name: 'manualAdjust.save' })).toBeDisabled()
  })

  it('desde un periodo cerrado (sin sedes ni etiqueta) lee el periodo destino: nombra su mes y ofrece TODAS sus sedes (QA defecto 7)', () => {
    m.reporte.mockReturnValue({ data: { periodo: { start: '2026-10-01', end: '2026-10-31', periodicidad: 'MONTHLY', estado: 'OPEN' }, venueIds: ['v1', 'v2'] } })
    render(<AjusteManualModal open onOpenChange={() => {}} fecha="2026-10-03" />)
    // El periodo de la MISMA fecha que se manda, sin filtro de sede.
    expect(m.reporte).toHaveBeenLastCalledWith({ offset: 0, limit: 1, fecha: '2026-10-03' }, true)
    expect(screen.getByRole('option', { name: 'v2' })).toBeInTheDocument()
    llenar()
    expect(screen.getByText(/manualAdjust\.summaryDeduction/)).toHaveTextContent('octubre de 2026')
  })

  it('desde la vista abierta (con sus sedes) no pide el periodo otra vez', () => {
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} fecha="2026-10-01" etiqueta="octubre 2026" />)
    expect(m.reporte).not.toHaveBeenCalledWith(expect.anything(), true)
  })

  // ── E5a (B13): el aviso de devoluciones pendientes de la persona, antes de guardar ──
  const vistaDe = (avisoPendientes: unknown, staffId = 's1') => ({
    data: {
      periodo: { start: '2026-10-01', end: '2026-10-31', estado: 'OPEN' },
      staffId,
      persona: 'Carla QA',
      sede: 'v1',
      sedeNombre: 'Wellness',
      amount: '-150.00',
      reason: 'Llegó tarde',
      huella: 'h'.repeat(64),
      avisoPendientes,
    },
  })
  const destino = (tipo: 'AL_CERRAR' | 'PERIODO_POSTERIOR_A', start: string, end: string, total: string) => ({
    seDescuenta: tipo === 'AL_CERRAR' ? { tipo, periodo: { start, end } } : { tipo, origen: { start, end } },
    n: 1,
    total,
    porSede: [{ venueId: 'v1', n: 1, total }],
  })

  it('la vista previa del ajuste se pide sólo con el formulario completo, con lo que se guardaría', () => {
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} fecha="2026-10-01" etiqueta="octubre 2026" />)
    expect(m.vistaPrevia).toHaveBeenLastCalledWith(null, true)
    // Persona y monto, sin motivo: el server lo rechazaría (motivo de 3+ letras), así que no se pide.
    fireEvent.click(screen.getByRole('button', { name: /Carla QA/ }))
    fireEvent.click(screen.getByRole('button', { name: 'manualAdjust.deduction' }))
    fireEvent.change(screen.getByLabelText('manualAdjust.amount'), { target: { value: '150' } })
    fireEvent.change(screen.getByLabelText('manualAdjust.reason'), { target: { value: 'Ll' } })
    expect(m.vistaPrevia).toHaveBeenLastCalledWith(null, true)
    fireEvent.change(screen.getByLabelText('manualAdjust.reason'), { target: { value: 'Llegó tarde' } })
    expect(m.vistaPrevia).toHaveBeenLastCalledWith({ sede: 'v1', staffId: 's1', amount: -150, reason: 'Llegó tarde', fecha: '2026-10-01' }, true)
  })

  it('con devoluciones pendientes de UN destino, avisa en el resumen que se descontarán solas', () => {
    m.vistaPrevia.mockReturnValue(vistaDe({ n: 1, total: '-50.00', porDestino: [destino('AL_CERRAR', '2026-10-01', '2026-10-31', '-50.00')], items: [], truncado: false }))
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} fecha="2026-10-01" etiqueta="octubre 2026" />)
    llenar()
    const aviso = screen.getByText(/manualAdjust\.pendingOne/)
    expect(aviso).toHaveTextContent('Carla QA')
    expect(aviso).toHaveTextContent('−$50.00')
    expect(aviso).toHaveTextContent('period.pendingAtClose')
    expect(aviso).toHaveTextContent('octubre de 2026')
    // Avisa, no bloquea.
    expect(screen.getByRole('button', { name: 'manualAdjust.save' })).toBeEnabled()
  })

  it('con varios destinos, el total y una línea por destino', () => {
    m.vistaPrevia.mockReturnValue(
      vistaDe({
        n: 2,
        total: '-80.00',
        porDestino: [destino('AL_CERRAR', '2026-10-01', '2026-10-31', '-50.00'), destino('PERIODO_POSTERIOR_A', '2026-09-01', '2026-09-30', '-30.00')],
        items: [],
        truncado: false,
      }),
    )
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} fecha="2026-10-01" etiqueta="octubre 2026" />)
    llenar()
    expect(screen.getByText(/manualAdjust\.pendingMany/)).toHaveTextContent('−$80.00')
    const lineas = screen.getAllByText(/period\.pendingLine/)
    expect(lineas).toHaveLength(2)
    expect(lineas[1]).toHaveTextContent('period.pendingAfter')
    expect(lineas[1]).toHaveTextContent('septiembre de 2026')
  })

  it('sin pendientes, si la vista previa falla o si es de OTRA persona (cambió la elección), no hay aviso y se puede guardar', () => {
    m.vistaPrevia.mockReturnValue(vistaDe({ n: 0, total: '0.00', porDestino: [], items: [], truncado: false }))
    const { unmount } = render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    llenar()
    expect(screen.queryByText(/manualAdjust\.pending/)).toBeNull()
    unmount()
    m.vistaPrevia.mockReturnValue({ data: undefined, isError: true, error: { response: { status: 403 } } })
    const otro = render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    llenar()
    expect(screen.queryByText(/manualAdjust\.pending/)).toBeNull()
    expect(screen.getByRole('button', { name: 'manualAdjust.save' })).toBeEnabled()
    otro.unmount()
    m.vistaPrevia.mockReturnValue(vistaDe({ n: 1, total: '-50.00', porDestino: [destino('AL_CERRAR', '2026-10-01', '2026-10-31', '-50.00')], items: [], truncado: false }, 's2'))
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    llenar()
    expect(screen.queryByText(/manualAdjust\.pending/)).toBeNull()
  })
})
