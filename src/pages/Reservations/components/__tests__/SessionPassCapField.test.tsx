import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

type Tier = { hasFeatureAccess: (f: string) => boolean; isLoading: boolean; isResolved: boolean }
const tier = vi.hoisted(() => ({ current: { hasFeatureAccess: (_f: string) => true, isLoading: false, isResolved: true } as Tier }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useVenueTier: () => tier.current }))
const access = vi.hoisted(() => ({ allowed: ['reservations:manage-passes'] }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => access.allowed.includes(p) }) }))
const svc = vi.hoisted(() => ({ setSessionPassCap: vi.fn() }))
vi.mock('@/services/passes.service', () => svc)
const toastSpy = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastSpy }) }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key) }),
}))

import { SessionPassCapField } from '../SessionPassCapField'

const LABEL = 'classSession.sessionPassCap.label'
const SAVE = 'classSession.sessionPassCap.save'
// El texto real del server (`passCapacity.service.ts`, assertSpots).
const BAD_SPOTS = 'Los lugares para pases van de 0 a 500.'

let client: QueryClient
function renderField(sessionCap: number | null = 2) {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SessionPassCapField venueId="v1" sessionId="s9" passes={{ taken: 1, cap: 3, sessionCap }} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  tier.current = { hasFeatureAccess: () => true, isLoading: false, isResolved: true }
  access.allowed = ['reservations:manage-passes']
  svc.setSessionPassCap.mockResolvedValue({ saved: true })
})

describe('SessionPassCapField', () => {
  // vaciar = null (vuelve a la regla del día/horario o a la general); invalida sólo el grupo 'rules'
  it('vaciar el campo guarda null e invalida capacity, calendario y sesión', async () => {
    const user = userEvent.setup()
    renderField(2)
    const spy = vi.spyOn(client, 'invalidateQueries')
    const input = screen.getByLabelText(LABEL)
    expect(input).toHaveValue(2)
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: SAVE }))
    await waitFor(() => expect(svc.setSessionPassCap).toHaveBeenCalledWith('v1', 's9', null))
    await waitFor(() => expect(spy).toHaveBeenCalled())
    const keys = spy.mock.calls.map(c => c[0]?.queryKey)
    expect(keys).toEqual([
      ['passes', 'v1', 'capacity'],
      ['class-sessions', 'v1'],
      ['class-session', 'v1'],
    ])
    expect(toastSpy).toHaveBeenCalledWith({ title: 'classSession.sessionPassCap.saved' })
  })

  // 0 es «esta clase no se ofrece a pases», no «vacío»
  it('0 guarda 0', async () => {
    const user = userEvent.setup()
    renderField(null)
    const input = screen.getByLabelText(LABEL)
    expect(input).toHaveValue(null)
    await user.type(input, '0')
    await user.click(screen.getByRole('button', { name: SAVE }))
    await waitFor(() => expect(svc.setSessionPassCap).toHaveBeenCalledWith('v1', 's9', 0))
  })

  // sin cambios no hay nada que guardar; fuera de rango tampoco, y se dice por qué
  it('Guardar sólo se habilita con un cambio válido', async () => {
    const user = userEvent.setup()
    renderField(2)
    const button = screen.getByRole('button', { name: SAVE })
    const input = screen.getByLabelText(LABEL)
    expect(button).toBeDisabled()
    expect(input).toHaveAttribute('aria-invalid', 'false')
    expect(input).toHaveAccessibleDescription('classSession.sessionPassCap.hint:{"taken":1}')
    await user.clear(input)
    await user.type(input, '501')
    expect(button).toBeDisabled()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('classSession.sessionPassCap.invalid')
    await user.clear(input)
    await user.type(input, '4')
    expect(button).toBeEnabled()
  })

  // Enter dentro del diálogo de la clase mandaría el formulario de la clase: aquí guarda los lugares
  it('Enter guarda los lugares', async () => {
    const user = userEvent.setup()
    renderField(2)
    const input = screen.getByLabelText(LABEL)
    await user.clear(input)
    await user.type(input, '5{Enter}')
    await waitFor(() => expect(svc.setSessionPassCap).toHaveBeenCalledWith('v1', 's9', 5))
  })

  // R2b-17: el onSuccess y el onError DEVUELVEN la recarga ⇒ campo y botón siguen deshabilitados hasta que el calendario
  // y la sesión se refrescaron. Quitar cualquiera de los dos `return` deja el campo habilitado y esto falla.
  it.each([
    ['ok', true],
    ['error', false],
  ])('guardar (%s) ⇒ deshabilitado hasta que termina la recarga', async (_label, ok) => {
    const user = userEvent.setup()
    if (!ok) svc.setSessionPassCap.mockRejectedValue({ response: { status: 400, data: { message: BAD_SPOTS } } })
    renderField(2)
    let release: () => void = () => {}
    const pending = new Promise<void>(resolve => (release = resolve))
    vi.spyOn(client, 'invalidateQueries').mockReturnValue(pending)
    const input = screen.getByLabelText(LABEL)
    await user.clear(input)
    await user.type(input, '4')
    await user.click(screen.getByRole('button', { name: SAVE }))
    await waitFor(() => expect(client.invalidateQueries).toHaveBeenCalled())
    expect(screen.getByLabelText(LABEL)).toBeDisabled()
    expect(screen.getByRole('button', { name: SAVE })).toBeDisabled()
    await act(async () => release())
    await waitFor(() => expect(screen.getByLabelText(LABEL)).toBeEnabled())
  })

  // el mensaje del server tal cual y lo tecleado se queda para corregirlo
  it('si el server rechaza ⇒ su mensaje tal cual en un toast y lo tecleado se queda', async () => {
    const user = userEvent.setup()
    svc.setSessionPassCap.mockRejectedValue({ response: { status: 400, data: { message: BAD_SPOTS } } })
    renderField(2)
    const input = screen.getByLabelText(LABEL)
    await user.clear(input)
    await user.type(input, '4')
    await user.click(screen.getByRole('button', { name: SAVE }))
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith({ variant: 'destructive', title: BAD_SPOTS }))
    await waitFor(() => expect(screen.getByLabelText(LABEL)).toBeEnabled())
    expect(screen.getByLabelText(LABEL)).toHaveValue(4)
  })

  // sin permiso: se ve el dato, no el campo
  it('sin reservations:manage-passes muestra los pases de la clase en sólo lectura', () => {
    access.allowed = []
    renderField(2)
    expect(screen.queryByLabelText(LABEL)).not.toBeInTheDocument()
    expect(screen.getByText('classSession.passes:{"taken":1,"cap":3}')).toBeInTheDocument()
    expect(screen.getByText('classSession.sessionPassCap.readOnly')).toBeInTheDocument()
  })

  // P1-2: editar el cupo es de pago; recibir `passes` NO demuestra tener el plan. Sin plan comprobado: sólo lectura con el motivo
  it('con el plan sin comprobar, o sin el plan: sólo lectura con el motivo, sin campo', () => {
    tier.current = { hasFeatureAccess: () => true, isLoading: false, isResolved: false }
    const r1 = renderField(2)
    expect(screen.queryByLabelText(LABEL)).not.toBeInTheDocument()
    expect(screen.getByText('classSession.sessionPassCap.planUnresolved')).toBeInTheDocument()
    r1.unmount()
    tier.current = { hasFeatureAccess: () => false, isLoading: false, isResolved: true }
    renderField(2)
    expect(screen.queryByLabelText(LABEL)).not.toBeInTheDocument()
    expect(screen.getByText('classSession.sessionPassCap.planRequired')).toBeInTheDocument()
  })

  // mientras el plan carga no se acusa «no tienes el plan»: sólo el dato
  it('con el plan cargando: sólo el dato, sin motivo ni campo', () => {
    tier.current = { hasFeatureAccess: () => true, isLoading: true, isResolved: false }
    renderField(2)
    expect(screen.queryByLabelText(LABEL)).not.toBeInTheDocument()
    expect(screen.getByText('classSession.passes:{"taken":1,"cap":3}')).toBeInTheDocument()
    expect(screen.queryByText('classSession.sessionPassCap.planRequired')).not.toBeInTheDocument()
    expect(screen.queryByText('classSession.sessionPassCap.planUnresolved')).not.toBeInTheDocument()
  })
})
