import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EditClassSessionDialog } from '../components/EditClassSessionDialog'

const m = vi.hoisted(() => ({ session: vi.fn(), team: vi.fn(), update: vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k, i18n: { language: 'es' } }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ venueTimezone: 'America/Mexico_City' }) }))
vi.mock('../components/PagoDeClaseCard', () => ({ PagoDeClaseCard: () => <div>tarjeta de pago</div> }))
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
  return render(
    <QueryClientProvider client={qc}>
      <EditClassSessionDialog open onOpenChange={vi.fn()} sessionId="s1" />
    </QueryClientProvider>,
  )
}
const escribirNota = () =>
  fireEvent.change(screen.getByLabelText(/form\.fields\.internalNotes/), { target: { value: 'Llegó tarde la instructora' } })

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue(clase())
  m.team.mockResolvedValue({ data: [ANA] })
  m.update.mockResolvedValue(clase())
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
})
