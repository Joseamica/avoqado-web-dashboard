/**
 * P1-5 (Codex): guardar los lugares para pases invalida ['class-session', venueId]; el diálogo NO debe reinicializar el
 * formulario con esa respuesta y borrar lo que el dueño tenía a medio escribir.
 * C2 (ronda 2): y SIN borrador, la respuesta fresca sí debe reemplazar a la que había en la caché al reabrir.
 * Las respuestas del refetch son DISTINTAS a propósito (C3): con datos idénticos TanStack conserva la referencia, el efecto
 * no vuelve a correr y la prueba pasaría también con el defecto. Prueba con el formulario REAL (react-hook-form + zod).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Radix (Select, Dialog) en jsdom: funciones/clases planas, nunca vi.fn() (mockReset: true las vaciaría).
Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub

vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/test', venue: { timezone: 'America/Mexico_City' } }),
}))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({
    venueTimezone: 'America/Mexico_City',
    formatDateTime: (d: string) => d,
    formatTime: (d: string) => d,
    formatDate: (d: string) => d,
  }),
}))
vi.mock('@/hooks/use-tier-feature-access', () => ({
  useVenueTier: () => ({ hasFeatureAccess: () => true, isLoading: false, isResolved: true }),
}))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
const toastSpy = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastSpy }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
// El TimePicker del repo es un popover propio; aquí basta un input: lo que se prueba es el reset del formulario.
vi.mock('@/components/ui/time-picker', () => ({
  TimePicker: (p: { id: string; value?: string; onChange: (v: string) => void }) => (
    <input id={p.id} value={p.value ?? ''} onChange={e => p.onChange(e.target.value)} />
  ),
}))
const team = vi.hoisted(() => ({ getTeamMembers: vi.fn() }))
vi.mock('@/services/team.service', () => ({ teamService: team }))
const sessions = vi.hoisted(() => ({
  getClassSession: vi.fn(),
  updateClassSession: vi.fn(),
  cancelClassSession: vi.fn(),
  removeAttendee: vi.fn(),
}))
vi.mock('@/services/classSession.service', () => ({ default: sessions }))
const passes = vi.hoisted(() => ({ setSessionPassCap: vi.fn() }))
vi.mock('@/services/passes.service', () => passes)

import { EditClassSessionDialog } from '../EditClassSessionDialog'

const SESSION = {
  id: 's9',
  venueId: 'v1',
  productId: 'p1',
  product: { id: 'p1', name: 'Yoga', price: 150, maxParticipants: null, duration: null },
  startsAt: '2030-01-10T15:00:00.000Z',
  endsAt: '2030-01-10T16:00:00.000Z',
  capacity: 12,
  enrolled: 3,
  available: 9,
  status: 'SCHEDULED' as const,
  assignedStaffId: null,
  assignedStaff: null,
  internalNotes: '',
  createdAt: '2030-01-01T00:00:00.000Z',
  updatedAt: '2030-01-01T00:00:00.000Z',
  passes: { taken: 1, cap: 3, sessionCap: 2 },
  reservations: [],
}

const NOTES = /form\.fields\.internalNotes/
const PASS_CAP = 'classSession.sessionPassCap.label'

let client: QueryClient
// `cached` = reabrir una sesión ya vista: la caché trae la versión anterior y el diálogo la pinta mientras llega la fresca (C2).
function renderDialog(cached?: typeof SESSION) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  if (cached) client.setQueryData(['class-session', 'v1', 's9'], cached)
  return render(
    <QueryClientProvider client={client}>
      <EditClassSessionDialog open onOpenChange={() => {}} sessionId="s9" />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  team.getTeamMembers.mockResolvedValue({ data: [] })
  sessions.getClassSession.mockResolvedValue(SESSION)
  sessions.updateClassSession.mockResolvedValue(SESSION)
  passes.setSessionPassCap.mockResolvedValue({ saved: true })
})

describe('EditClassSessionDialog + lugares para pases', () => {
  // P1-5 (C3, ronda 2: el refetch trae OTRO passes.sessionCap, no la misma respuesta)
  it('guardar los lugares para pases NO borra las notas que el dueño tenía a medio escribir', async () => {
    const user = userEvent.setup()
    sessions.getClassSession
      .mockResolvedValueOnce(SESSION)
      .mockResolvedValueOnce({ ...SESSION, passes: { taken: 1, cap: 1, sessionCap: 1 } })
    renderDialog()
    const notes = await screen.findByLabelText(NOTES)
    await user.type(notes, 'traer tapetes extra')
    const cap = screen.getByLabelText(PASS_CAP)
    await user.clear(cap)
    await user.type(cap, '1')
    await user.click(screen.getByRole('button', { name: 'classSession.sessionPassCap.save' }))
    await waitFor(() => expect(passes.setSessionPassCap).toHaveBeenCalledWith('v1', 's9', 1))
    // la invalidación de ['class-session', venueId] trajo la respuesta NUEVA a la caché…
    await waitFor(() => expect(client.getQueryData(['class-session', 'v1', 's9'])).toMatchObject({ passes: { sessionCap: 1 } }))
    // …se deja que el diálogo la pinte y corra sus efectos (TanStack avisa a los componentes en un setTimeout 0)…
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    // …y el formulario conservó lo tecleado (con el reset() en cada respuesta, las notas quedaban vacías)
    expect(screen.getByLabelText(NOTES)).toHaveValue('traer tapetes extra')
  })

  // C2 (ronda 2; Codex lo reprodujo): al reabrir, el formulario se pinta con la caché (cupo 12) y llega la respuesta fresca
  // (cupo 7) SIN que el dueño toque nada ⇒ se muestra la fresca. Si la ignorara, «Guardar» otro cambio reenviaría el 12.
  it('reabrir sin tocar nada: la respuesta fresca reemplaza a la de la caché', async () => {
    sessions.getClassSession.mockResolvedValue({ ...SESSION, capacity: 7, passes: { taken: 1, cap: 3, sessionCap: 5 } })
    renderDialog(SESSION)
    // primero se pinta lo que había en la caché…
    expect(screen.getByLabelText('classSession.fields.capacity')).toHaveValue(12)
    // …y al llegar la respuesta fresca, el formulario y el campo de lugares para pases la muestran
    await waitFor(() => expect(screen.getByLabelText('classSession.fields.capacity')).toHaveValue(7))
    await waitFor(() => expect(screen.getByLabelText(PASS_CAP)).toHaveValue(5))
  })

  // y sí se inicializa al abrir (lo que el reset siempre hizo bien)
  it('al abrir carga la fecha y el cupo de la sesión', async () => {
    renderDialog()
    expect(await screen.findByLabelText('classSession.fields.capacity')).toHaveValue(12)
    expect(screen.getByLabelText('form.fields.date')).toHaveValue('2030-01-10')
  })

  // Enter en el campo de lugares guarda los lugares; no manda el formulario de la clase (que la guardaría y cerraría
  // el diálogo sin guardar los lugares)
  it('Enter en lugares para pases guarda los lugares, no la clase', async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.type(await screen.findByLabelText(NOTES), 'notas')
    const cap = screen.getByLabelText(PASS_CAP)
    await user.clear(cap)
    await user.type(cap, '1{Enter}')
    await waitFor(() => expect(passes.setSessionPassCap).toHaveBeenCalledWith('v1', 's9', 1))
    expect(sessions.updateClassSession).not.toHaveBeenCalled()
  })

  // sin conector (o clase no ligada / cancelada): el server manda passes: null ⇒ ni campo ni línea
  it('sin pases (null) no hay campo de lugares', async () => {
    sessions.getClassSession.mockResolvedValue({ ...SESSION, passes: null })
    renderDialog()
    await screen.findByLabelText('classSession.fields.capacity')
    expect(screen.queryByLabelText(PASS_CAP)).not.toBeInTheDocument()
    expect(screen.queryByText('classSession.passes')).not.toBeInTheDocument()
  })

  // clase terminada: el server sigue mandando sus pases (historial) ⇒ se ven, sin campo para editarlos
  it('clase completada: los pases se ven en sólo lectura, sin campo', async () => {
    sessions.getClassSession.mockResolvedValue({ ...SESSION, status: 'COMPLETED' })
    renderDialog()
    expect(await screen.findByText('classSession.passes')).toBeInTheDocument()
    expect(screen.queryByLabelText(PASS_CAP)).not.toBeInTheDocument()
  })
})
