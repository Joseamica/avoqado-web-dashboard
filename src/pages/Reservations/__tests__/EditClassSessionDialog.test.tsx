import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EditClassSessionDialog } from '../components/EditClassSessionDialog'

const m = vi.hoisted(() => ({ session: vi.fn(), team: vi.fn(), update: vi.fn(), preview: vi.fn(), undo: vi.fn() }))
const access = vi.hoisted(() => ({ allowed: ['reservations:read', 'reservations:update'] as string[] }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // El título de «Sí llegó» lleva nombre, clase y hora, y «y N más» lleva el número: se ven en la salida para poder afirmarlos.
    t: (k: string, o?: { defaultValue?: string }) =>
      o?.defaultValue ?? ((k === 'undoNoShow.title' || k === 'undoNoShow.rosterMore') && o ? `${k}:${JSON.stringify(o)}` : k),
    i18n: { language: 'es' },
  }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => access.allowed.includes(p) }) }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ venueTimezone: 'America/Mexico_City', formatTime: (d: string) => d.split('T')[1].substring(0, 5) }),
}))
vi.mock('@/services/reservation.service', () => ({
  default: { previewUndoNoShow: (...a: unknown[]) => m.preview(...a), undoNoShow: (...a: unknown[]) => m.undo(...a) },
}))
vi.mock('../components/PagoDeClaseCard', () => ({ PagoDeClaseCard: () => <div>tarjeta de pago</div> }))
// El TimePicker real llama onChange al elegir de su lista AUNQUE sea la misma hora (time-picker.tsx: handleSelect no
// compara); este doble hace lo mismo con cada cambio, para probar que elegir la misma hora no mueve nada.
vi.mock('@/components/ui/time-picker', () => ({
  TimePicker: ({ id, value, onChange, disabled }: { id?: string; value?: string; onChange?: (t: string) => void; disabled?: boolean }) => (
    <>
      <input id={id} value={value ?? ''} disabled={disabled} onChange={e => onChange?.(e.target.value)} />
      {/* Como elegir de la lista la hora que ya está: onChange con el MISMO valor. */}
      <button type="button" onClick={() => onChange?.(value ?? '')}>
        {`elegir otra vez ${id}`}
      </button>
    </>
  ),
}))
vi.mock('@/services/team.service', () => ({ teamService: { getTeamMembers: () => m.team() } }))
vi.mock('@/services/classSession.service', () => ({
  default: {
    getClassSession: () => m.session(),
    updateClassSession: (...a: unknown[]) => m.update(...a),
  },
}))

const ANA = { staffId: 's-ana', firstName: 'Ana', lastName: 'Martínez' }
const clase = (extra: Record<string, unknown> = {}) => ({
  id: 's1',
  startsAt: '2026-09-28T14:00:00.000Z',
  endsAt: '2026-09-28T15:00:00.000Z',
  capacity: 12,
  enrolled: 8,
  status: 'SCHEDULED',
  assignedStaffId: 's-ana',
  assignedStaff: { id: 's-ana', firstName: 'Ana', lastName: 'Martínez' },
  internalNotes: '',
  product: { name: 'Yoga', duration: 60 },
  reservations: Array.from({ length: 8 }, (_, i) => ({ id: `r${i}`, guestName: `Cliente ${i}`, partySize: 1 })),
  ...extra,
})
/** Una promesa que se suelta a mano: el equipo llega DESPUÉS de la clase (la carrera de «Abrir la clase», QA N1). */
function diferida<T>() {
  let soltar: (v: T) => void = () => undefined
  const promesa = new Promise<T>(r => {
    soltar = r
  })
  return { promesa, soltar }
}
const pintar = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    qc,
    ...render(
      <QueryClientProvider client={qc}>
        <EditClassSessionDialog open onOpenChange={vi.fn()} sessionId="s1" />
      </QueryClientProvider>,
    ),
  }
}
const escribirNota = () =>
  fireEvent.change(screen.getByLabelText(/form\.fields\.internalNotes/), { target: { value: 'Llegó tarde la instructora' } })

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue(clase())
  m.team.mockResolvedValue({ data: [ANA] })
  m.update.mockResolvedValue(clase())
  access.allowed = ['reservations:read', 'reservations:update']
})

describe('EditClassSessionDialog', () => {
  it('el cuerpo se desplaza y el pie («Guardar») queda fuera de él, siempre a la vista (QA bloque B, defecto 1)', async () => {
    pintar()
    const cuerpo = await screen.findByTestId('class-session-body')
    expect(cuerpo).toHaveClass('overflow-y-auto', 'min-h-0', 'flex-1')
    // El diálogo no pasa de la pantalla.
    expect(screen.getByRole('dialog').className).toMatch(/max-h-\[90dvh\]/)
    // La tarjeta de pago y los asistentes van DENTRO del cuerpo; «Guardar» y «Cancelar», fuera.
    expect(cuerpo).toContainElement(screen.getByText('tarjeta de pago'))
    expect(cuerpo).toContainElement(screen.getByText('Cliente 7'))
    expect(cuerpo).not.toContainElement(screen.getByRole('button', { name: 'actions.save' }))
  })

  it('si el equipo llega DESPUÉS de la clase, el campo muestra a la coach y guardar NO le quita la coach (QA N1)', async () => {
    const equipo = diferida<{ data: (typeof ANA)[] }>()
    m.team.mockReturnValue(equipo.promesa)
    pintar()
    await screen.findByTestId('class-session-body')
    equipo.soltar({ data: [ANA] })
    await waitFor(() => expect(screen.getByRole('combobox', { name: /form\.fields\.staff/ })).toHaveTextContent('Ana Martínez'))
    escribirNota()
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))
    await waitFor(() => expect(m.update).toHaveBeenCalled())
    const cuerpo = m.update.mock.calls[0][2]
    expect(cuerpo).not.toHaveProperty('assignedStaffId')
    expect(cuerpo.internalNotes).toBe('Llegó tarde la instructora')
  })

  it('aun sin el nombre de la coach en la clase, el valor no se «corrige» a vacío mientras llega el equipo', async () => {
    m.session.mockResolvedValue(clase({ assignedStaff: null }))
    const equipo = diferida<{ data: (typeof ANA)[] }>()
    m.team.mockReturnValue(equipo.promesa)
    pintar()
    await screen.findByTestId('class-session-body')
    equipo.soltar({ data: [ANA] })
    await waitFor(() => expect(screen.getByRole('combobox', { name: /form\.fields\.staff/ })).toHaveTextContent('Ana Martínez'))
  })

  it('una coach que no está en la lista del equipo se sigue viendo, y guardar sin tocar el campo no la manda', async () => {
    m.team.mockResolvedValue({ data: [] })
    pintar()
    await waitFor(() => expect(screen.getByRole('combobox', { name: /form\.fields\.staff/ })).toHaveTextContent('Ana Martínez'))
    escribirNota()
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))
    await waitFor(() => expect(m.update).toHaveBeenCalled())
    expect(m.update.mock.calls[0][2]).not.toHaveProperty('assignedStaffId')
  })

  it('una clase de 50 min con un producto de 60: abrir y guardar una nota NO toca su horario (ni startsAt ni endsAt)', async () => {
    m.session.mockResolvedValue(clase({ startsAt: '2026-09-28T14:00:00.000Z', endsAt: '2026-09-28T14:50:00.000Z' }))
    pintar()
    await screen.findByTestId('class-session-body')
    await waitFor(() => expect(screen.getByLabelText(/form\.fields\.internalNotes/)).toBeInTheDocument())
    escribirNota()
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))
    await waitFor(() => expect(m.update).toHaveBeenCalled())
    const cuerpo = m.update.mock.calls[0][2]
    expect(cuerpo).not.toHaveProperty('startsAt')
    expect(cuerpo).not.toHaveProperty('endsAt')
    expect(cuerpo).not.toHaveProperty('capacity')
  })

  it('cambiar la hora de inicio SÍ recalcula el fin con la duración del producto y manda el horario nuevo', async () => {
    m.session.mockResolvedValue(clase({ startsAt: '2026-09-28T14:00:00.000Z', endsAt: '2026-09-28T14:50:00.000Z' }))
    pintar()
    const inicio = (await screen.findByLabelText(/form\.fields\.startTime/)) as HTMLInputElement
    await waitFor(() => expect(inicio).toHaveValue('08:00'))
    fireEvent.change(inicio, { target: { value: '09:00' } })
    fireEvent.blur(inicio)
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))
    await waitFor(() => expect(m.update).toHaveBeenCalled())
    // 09:00 en CDMX = 15:00 UTC; producto de 60 min ⇒ 16:00 UTC.
    expect(m.update.mock.calls[0][2]).toMatchObject({ startsAt: '2026-09-28T15:00:00.000Z', endsAt: '2026-09-28T16:00:00.000Z' })
  })

  it('elegir la MISMA hora de inicio no recalcula el fin ni manda el horario', async () => {
    m.session.mockResolvedValue(clase({ startsAt: '2026-09-28T14:00:00.000Z', endsAt: '2026-09-28T14:50:00.000Z' }))
    pintar()
    const inicio = (await screen.findByLabelText(/form\.fields\.startTime/)) as HTMLInputElement
    await waitFor(() => expect(inicio).toHaveValue('08:00'))
    fireEvent.click(screen.getByRole('button', { name: 'elegir otra vez edit-startTime' }))
    escribirNota()
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))
    await waitFor(() => expect(m.update).toHaveBeenCalled())
    expect(m.update.mock.calls[0][2]).not.toHaveProperty('startsAt')
    expect(m.update.mock.calls[0][2]).not.toHaveProperty('endsAt')
  })

  it('la nota sólo viaja si cambió: cambiar sólo el horario no reescribe la nota (otra persona pudo editarla)', async () => {
    m.session.mockResolvedValue(clase({ internalNotes: 'Nota de otra persona' }))
    pintar()
    const inicio = (await screen.findByLabelText(/form\.fields\.startTime/)) as HTMLInputElement
    await waitFor(() => expect(inicio).toHaveValue('08:00'))
    fireEvent.change(inicio, { target: { value: '09:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))
    await waitFor(() => expect(m.update).toHaveBeenCalled())
    expect(m.update.mock.calls[0][2]).toHaveProperty('startsAt')
    expect(m.update.mock.calls[0][2]).not.toHaveProperty('internalNotes')
  })

  it('si la clase se vuelve a pedir con el diálogo abierto, lo que se estaba editando NO se pierde', async () => {
    const { qc } = pintar()
    await screen.findByTestId('class-session-body')
    escribirNota()
    m.session.mockResolvedValue(clase({ internalNotes: 'Nota que llegó del server', capacity: 15 }))
    await qc.refetchQueries({ queryKey: ['class-session', 'v1', 's1'] })
    // La pantalla ya pinta el dato nuevo (cupo 15)…
    await waitFor(() => expect(screen.getByText('8/15')).toBeInTheDocument())
    // …y aun así la nota que se estaba escribiendo sigue ahí.
    expect(screen.getByLabelText(/form\.fields\.internalNotes/)).toHaveValue('Llegó tarde la instructora')
  })

  it('sin cambios sin guardar, un dato nuevo del server sí se muestra', async () => {
    const { qc } = pintar()
    await screen.findByTestId('class-session-body')
    m.session.mockResolvedValue(clase({ internalNotes: 'Nota que llegó del server' }))
    await qc.refetchQueries({ queryKey: ['class-session', 'v1', 's1'] })
    await waitFor(() => expect(screen.getByLabelText(/form\.fields\.internalNotes/)).toHaveValue('Nota que llegó del server'))
  })

  it('quitar la coach A PROPÓSITO («Sin asignar») sí manda null', async () => {
    pintar()
    await waitFor(() => expect(screen.getByRole('combobox', { name: /form\.fields\.staff/ })).toHaveTextContent('Ana Martínez'))
    // El <select> nativo que Radix pone para el formulario: es el camino del cambio que hace la persona.
    const nativo = document.querySelector('select') as HTMLSelectElement
    fireEvent.change(nativo, { target: { value: 'none' } })
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))
    await waitFor(() => expect(m.update).toHaveBeenCalled())
    expect(m.update.mock.calls[0][2]).toHaveProperty('assignedStaffId', null)
  })
// D4 — las faltas viven APARTE de los asistentes (`noShows`): se listan debajo, con «Sí llegó», aunque la clase ya haya terminado.
describe('EditClassSessionDialog — lista de faltas y «Sí llegó»', () => {
  const falta = (extra: Record<string, unknown> = {}) => ({
    id: 'n1',
    confirmationCode: 'RES-N1',
    partySize: 1,
    guestName: 'Karla R.',
    guestPhone: '+5215550001111',
    customer: null,
    noShowAt: '2026-09-28T14:10:00.000Z',
    status: 'NO_SHOW',
    aggregatorBooking: null,
    ...extra,
  })

  it('pinta las faltas debajo de los asistentes con su etiqueta y «Sí llegó», sin tocar el cupo', async () => {
    m.session.mockResolvedValue(clase({ noShows: [falta()] }))
    pintar()

    const cuerpo = await screen.findByTestId('class-session-body')
    const fila = within(cuerpo).getByText('Karla R.').closest('div[class*="rounded-md"]') as HTMLElement
    expect(within(fila).getByText('status.NO_SHOW')).toBeInTheDocument()
    expect(within(fila).getByRole('button', { name: 'undoNoShow.button' })).toBeInTheDocument()
    // Los asistentes y el cupo siguen igual que antes (8/12): una falta no cuenta.
    expect(within(cuerpo).getByText('Cliente 7')).toBeInTheDocument()
    expect(within(cuerpo).getByText('8/12')).toBeInTheDocument()
  })

  it('una clase COMPLETED sigue enseñando las faltas con «Sí llegó» (la corrección se hace después de la clase)', async () => {
    m.session.mockResolvedValue(clase({ status: 'COMPLETED', noShows: [falta()] }))
    pintar()

    expect(await screen.findByRole('button', { name: 'undoNoShow.button' })).toBeInTheDocument()
    // Ya no se puede editar la clase…
    expect(screen.queryByRole('button', { name: 'actions.save' })).toBeNull()
  })

  it('una falta de un pase (aggregatorBooking) lleva la etiqueta «Pase» y NO lleva «Sí llegó»', async () => {
    m.session.mockResolvedValue(clase({ noShows: [falta({ aggregatorBooking: { id: 'a1', provider: 'TOTALPASS' } })] }))
    pintar()

    await screen.findByText('Karla R.')
    expect(screen.getByText('undoNoShow.pass')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'undoNoShow.button' })).toBeNull()
  })

  it('sin reservations:update se ve la falta pero no «Sí llegó»', async () => {
    access.allowed = ['reservations:read']
    m.session.mockResolvedValue(clase({ noShows: [falta()] }))
    pintar()

    await screen.findByText('Karla R.')
    expect(screen.queryByRole('button', { name: 'undoNoShow.button' })).toBeNull()
  })

  it('si hay más faltas que las que trae la lista (noShowsTotal > noShows.length) cierra con «y N más»', async () => {
    m.session.mockResolvedValue(clase({ noShows: [falta(), falta({ id: 'n2', guestName: 'Pedro G.' })], noShowsTotal: 5 }))
    pintar()

    expect(await screen.findByText('undoNoShow.rosterMore:{"count":3}')).toBeInTheDocument()
  })

  it.each([
    ['el total es igual a lo que trae la lista', { noShows: [falta()], noShowsTotal: 1 }],
    ['el servidor no manda el total (server anterior)', { noShows: [falta()] }],
  ])('sin «y N más» cuando %s', async (_caso, extra) => {
    m.session.mockResolvedValue(clase(extra))
    pintar()

    await screen.findByText('Karla R.')
    expect(screen.queryByText(/^undoNoShow\.rosterMore/)).toBeNull()
  })

  it('una clase sin faltas (o de un server anterior, sin `noShows`) no pinta la sección', async () => {
    m.session.mockResolvedValue(clase())
    pintar()

    await screen.findByTestId('class-session-body')
    expect(screen.queryByText('undoNoShow.rosterTitle')).toBeNull()
  })

  it('«Sí llegó» desde la lista confirma, deshace esa reserva y refresca la clase', async () => {
    m.session.mockResolvedValue(clase({ noShows: [falta({ customer: { id: 'c1', firstName: 'Karla', lastName: 'Rodríguez', phone: null } })] }))
    m.preview.mockResolvedValue({ plan: { creditToReconsume: 1, clearFee: false, restoreDeposit: false, pending: [] } })
    m.undo.mockResolvedValue({
      outcome: 'UNDONE',
      reservation: {},
      plan: {},
      correction: { id: 'c1', pending: [], resolvedAt: null },
    })
    const { qc } = pintar()
    const invalidar = vi.spyOn(qc, 'invalidateQueries')
    fireEvent.click(await screen.findByRole('button', { name: 'undoNoShow.button' }))

    const dialogo = await screen.findByRole('alertdialog')
    expect(m.preview).toHaveBeenCalledWith('v1', 'n1')
    // La confirmación nombra a la persona, la clase y la hora de la CLASE (14:00 UTC en el mock).
    expect(within(dialogo).getByText('undoNoShow.title:{"name":"Karla Rodríguez","className":"Yoga","time":"14:00"}')).toBeInTheDocument()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'undoNoShow.confirm' }))

    await waitFor(() => expect(m.undo).toHaveBeenCalledWith('v1', 'n1'))
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['class-session', 'v1', 's1'] }))
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['reservation', 'v1', 'n1'] })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['reservations', 'v1'] })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['class-sessions', 'v1'] })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['reservation-calendar', 'v1'] })
  })
})
})
