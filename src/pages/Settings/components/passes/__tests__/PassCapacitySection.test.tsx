import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PassCapacityView } from '@/types/passes'

vi.mock('@/hooks/use-tier-feature-access', () => ({
  useVenueTier: () => ({ hasFeatureAccess: () => true, isLoading: false, isResolved: true }),
}))
// usePassCapacity sólo consulta con `reservations:read` (usePassesAccess).
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
const svc = vi.hoisted(() => ({
  getPassCapacity: vi.fn(),
  setDefaultPassCap: vi.fn(),
  upsertWeeklyPassCap: vi.fn(),
  deletePassCapRule: vi.fn(),
}))
vi.mock('@/services/passes.service', () => svc)
const toastSpy = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastSpy }) }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key) }),
}))

import { PassCapacitySection } from '../PassCapacitySection'

const CAPACITY: PassCapacityView = {
  defaultMaxSpots: 3,
  weekly: [{ id: 'r1', weekday: 6, startMinute: 540, maxSpots: 1 }],
  suggestions: [
    { weekday: 6, startMinute: 540, suggestedMaxSpots: 1, weeksOfData: 8, p75Occupancy: 11, capacity: 13, applied: true },
    { weekday: 1, startMinute: 420, suggestedMaxSpots: 3, weeksOfData: 4, p75Occupancy: 8, capacity: 12, applied: false },
  ],
}
// Lo que trae el refetch tras aplicar la sugerencia de los lunes 07:00: la excepción nueva y la sugerencia ya aplicada.
// DISTINTA de CAPACITY a propósito: con datos idénticos TanStack conserva la referencia y la prueba no probaría nada.
const AFTER_APPLY: PassCapacityView = {
  ...CAPACITY,
  weekly: [...CAPACITY.weekly, { id: 'r2', weekday: 1, startMinute: 420, maxSpots: 3 }],
  suggestions: CAPACITY.suggestions.map(s => ({ ...s, applied: true })),
}
// Los textos reales del server (`passCapacity.service.ts`).
const TOO_MANY = 'Ya tienes 150 excepciones de lugares. Borra alguna antes de agregar otra.'
const RULE_GONE = 'Esa regla ya no existe.'
const BAD_SPOTS = 'Los lugares para pases van de 0 a 500.'
// El renglón de la excepción de los sábados 09:00 (y el nombre de su botón de borrar).
const SAT_RULE = 'days.6 · 09:00 · capacity.weekly.spots:{"count":1}'
const DELETE_SAT = `capacity.weekly.deleteRule:${JSON.stringify({ rule: SAT_RULE })}`

function renderSection(canManage = true, connected = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PassCapacitySection venueId="v1" canManage={canManage} connected={connected} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  svc.getPassCapacity.mockResolvedValue(CAPACITY)
  svc.setDefaultPassCap.mockResolvedValue({ saved: true }) // la API devuelve { saved: true }, no la capacidad
  svc.upsertWeeklyPassCap.mockResolvedValue({ id: 'r2', weekday: 1, startMinute: 420, maxSpots: 3 })
  svc.deletePassCapRule.mockResolvedValue({ deleted: true })
})

describe('PassCapacitySection', () => {
  it('vaciar el tope general manda null (todos los lugares libres)', async () => {
    const user = userEvent.setup()
    renderSection()
    const input = await screen.findByLabelText('capacity.default.label')
    expect(input).toHaveValue(3)
    await user.clear(input)
    expect(input).toHaveValue(null)
    await user.click(screen.getByRole('button', { name: 'capacity.default.save' }))
    await waitFor(() => expect(svc.setDefaultPassCap).toHaveBeenCalledWith('v1', null))
  })

  // 0 es un valor, no «vacío»
  it('0 en el tope general manda 0', async () => {
    const user = userEvent.setup()
    renderSection()
    const input = await screen.findByLabelText('capacity.default.label')
    await user.clear(input)
    await user.type(input, '0')
    await user.click(screen.getByRole('button', { name: 'capacity.default.save' }))
    await waitFor(() => expect(svc.setDefaultPassCap).toHaveBeenCalledWith('v1', 0))
  })

  // Fuera de 0-500 el botón no basta: se dice por qué no se puede guardar.
  it('un tope general fuera de 0-500 no se puede guardar y se dice por qué', async () => {
    const user = userEvent.setup()
    renderSection()
    const input = await screen.findByLabelText('capacity.default.label')
    await user.clear(input)
    expect(input).toHaveAttribute('aria-invalid', 'false')
    expect(input).toHaveAccessibleDescription('capacity.default.hint')
    await user.type(input, '600')
    expect(screen.getByText('capacity.default.invalid')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('capacity.default.invalid')
    expect(screen.getByRole('button', { name: 'capacity.default.save' })).toBeDisabled()
  })

  // T10 ronda 1 (H4): «-» o «e» no es «vacío» (que guardaría «todos los lugares libres»): es inválido y no se guarda.
  // jsdom no implementa `validity.badInput` de type="number": se simula lo que hace el navegador (valor '' + badInput).
  it('lo que no es número en el tope general no se lee como vacío: inválido y sin guardar', async () => {
    renderSection()
    const input = await screen.findByLabelText('capacity.default.label')
    Object.defineProperty(input, 'validity', { configurable: true, value: { badInput: true } })
    fireEvent.change(input, { target: { value: '' } })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('capacity.default.invalid')
    expect(screen.getByRole('button', { name: 'capacity.default.save' })).toBeDisabled()
  })

  // H9: el onSuccess/onError de guardar el tope DEVUELVE la recarga: mientras capacity no regresa, nada se puede tocar
  // (si no, el dueño editaría sobre el valor viejo). Quitar el `return` deja el campo habilitado y esto falla.
  it.each([
    ['ok', true],
    ['error', false],
  ])('guardar el tope (%s) ⇒ el campo sigue deshabilitado hasta que llega la capacidad nueva', async (_label, ok) => {
    const user = userEvent.setup()
    let release: (view: PassCapacityView) => void = () => {}
    svc.getPassCapacity.mockResolvedValueOnce(CAPACITY).mockReturnValueOnce(new Promise<PassCapacityView>(resolve => (release = resolve)))
    if (!ok) svc.setDefaultPassCap.mockRejectedValue({ response: { status: 400, data: { message: BAD_SPOTS } } })
    renderSection()
    const input = await screen.findByLabelText('capacity.default.label')
    await user.clear(input)
    await user.type(input, '7')
    await user.click(screen.getByRole('button', { name: 'capacity.default.save' }))
    await waitFor(() => expect(svc.getPassCapacity).toHaveBeenCalledTimes(2))
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(screen.getByLabelText('capacity.default.label')).toBeDisabled()
    await act(async () => release({ ...CAPACITY, defaultMaxSpots: ok ? 7 : 3 }))
    await waitFor(() => expect(screen.getByLabelText('capacity.default.label')).toBeEnabled())
  })

  // El mensaje del server tal cual, lo tecleado se queda para corregirlo y la capacidad se recarga (R2b-17).
  it('si el server rechaza el tope general ⇒ su mensaje tal cual, lo tecleado se queda y se recarga', async () => {
    const user = userEvent.setup()
    svc.setDefaultPassCap.mockRejectedValue({ response: { status: 400, data: { message: BAD_SPOTS } } })
    renderSection()
    const input = await screen.findByLabelText('capacity.default.label')
    await user.clear(input)
    await user.type(input, '7')
    await user.click(screen.getByRole('button', { name: 'capacity.default.save' }))
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', title: BAD_SPOTS })))
    await waitFor(() => expect(svc.getPassCapacity).toHaveBeenCalledTimes(2))
    expect(screen.getByLabelText('capacity.default.label')).toHaveValue(7)
  })

  // la excepción se pinta con día, hora y lugares; borrar pide confirmación
  it('lista las excepciones y borrar pasa por confirmación', async () => {
    const user = userEvent.setup()
    renderSection()
    // El texto exacto del renglón (la sugerencia de los sábados 09:00 también dice «09:00»: un regex suelto daría dos elementos)
    expect(await screen.findByText(SAT_RULE)).toBeInTheDocument()
    // H4: el botón y la confirmación dicen CUÁL se borra
    await user.click(screen.getByRole('button', { name: DELETE_SAT }))
    expect(await screen.findByText(`capacity.weekly.deleteBody:${JSON.stringify({ rule: SAT_RULE })}`)).toBeInTheDocument()
    expect(svc.deletePassCapRule).not.toHaveBeenCalled()
    await user.click(await screen.findByRole('button', { name: 'capacity.weekly.deleteConfirm' }))
    await waitFor(() => expect(svc.deletePassCapRule).toHaveBeenCalledWith('v1', 'r1'))
  })

  // Otro administrador ya la borró: el 404 se dice tal cual y la recarga del onError (R2b-17) quita el renglón viejo.
  it('borrar una regla que ya no existe ⇒ el mensaje del server tal cual y la lista se recarga sin ella', async () => {
    const user = userEvent.setup()
    svc.getPassCapacity.mockResolvedValueOnce(CAPACITY).mockResolvedValueOnce({ ...CAPACITY, weekly: [] })
    svc.deletePassCapRule.mockRejectedValue({ response: { status: 404, data: { message: RULE_GONE } } })
    renderSection()
    await user.click(await screen.findByRole('button', { name: DELETE_SAT }))
    await user.click(await screen.findByRole('button', { name: 'capacity.weekly.deleteConfirm' }))
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', title: RULE_GONE })))
    expect(await screen.findByText('capacity.weekly.empty')).toBeInTheDocument()
  })

  // H7: la lista va de lunes a domingo, como el diálogo (el server la manda con el domingo primero)
  it('las excepciones se listan de lunes a domingo', async () => {
    svc.getPassCapacity.mockResolvedValue({
      ...CAPACITY,
      weekly: [
        { id: 'r0', weekday: 0, startMinute: null, maxSpots: 2 },
        { id: 'r1', weekday: 1, startMinute: 540, maxSpots: 1 },
        { id: 'r6', weekday: 6, startMinute: 600, maxSpots: 4 },
      ],
    })
    renderSection()
    await screen.findByText(/^days\.0 · /)
    expect(screen.getAllByText(/^days\.\d · /).map(el => el.textContent?.slice(0, 6))).toEqual(['days.1', 'days.6', 'days.0'])
  })

  // H8: sin ninguna conexión viva, se dice que las reglas esperan a que se conecte TotalPass
  it('sin conexión viva ⇒ «se aplican en cuanto conectes TotalPass»; conectada, no', async () => {
    const { unmount } = renderSection(true, false)
    expect(await screen.findByText('capacity.notConnected')).toBeInTheDocument()
    unmount()
    renderSection(true, true)
    await screen.findByText('capacity.title')
    expect(screen.queryByText('capacity.notConnected')).not.toBeInTheDocument()
  })

  // la sugerencia dice su porqué y Aplicar crea la excepción; la ya aplicada no tiene botón
  it('sugerencias: porqué + Aplicar crea la excepción; la aplicada se marca', async () => {
    const user = userEvent.setup()
    renderSection()
    expect(
      await screen.findByText('capacity.suggestions.line:{"day":"daysPlural.1","time":"07:00","pct":67,"count":3}'),
    ).toBeInTheDocument()
    expect(screen.getByText('capacity.suggestions.applied')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'capacity.suggestions.apply' })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'capacity.suggestions.apply' }))
    await waitFor(() => expect(svc.upsertWeeklyPassCap).toHaveBeenCalledWith('v1', { weekday: 1, startMinute: 420, maxSpots: 3 }))
  })

  // H3: si ya hay una excepción para ese día y hora con OTRO valor, la sugerencia dice cuántos hay hoy antes de reemplazarla
  it('sugerencia sobre una excepción existente con otro valor ⇒ dice cuántos lugares hay hoy', async () => {
    svc.getPassCapacity.mockResolvedValue({
      ...CAPACITY,
      weekly: [...CAPACITY.weekly, { id: 'r9', weekday: 1, startMinute: 420, maxSpots: 5 }],
    })
    renderSection()
    expect(await screen.findByText('capacity.weekly.replaces:{"count":5}')).toBeInTheDocument()
    // la de los sábados ya está aplicada (mismo valor): no se dice nada
    expect(screen.getAllByText(/^capacity\.weekly\.replaces/)).toHaveLength(1)
  })

  // sin datos suficientes se dice con todas sus letras
  it('sin sugerencias ⇒ «todavía no hay datos suficientes»', async () => {
    svc.getPassCapacity.mockResolvedValue({ ...CAPACITY, suggestions: [] })
    renderSection()
    expect(await screen.findByText('capacity.suggestions.empty')).toBeInTheDocument()
  })

  // «+ Agregar» abre el diálogo y guardar llama al server
  it('«+ Agregar» abre el diálogo y guardar crea la excepción', async () => {
    const user = userEvent.setup()
    renderSection()
    await user.click(await screen.findByRole('button', { name: 'capacity.weekly.add' }))
    fireEvent.change(screen.getByLabelText('capacity.dialog.time'), { target: { value: '18:30' } })
    fireEvent.change(screen.getByLabelText('capacity.dialog.spots'), { target: { value: '2' } })
    await user.click(screen.getByRole('button', { name: 'common:save' }))
    await waitFor(() => expect(svc.upsertWeeklyPassCap).toHaveBeenCalledWith('v1', { weekday: 1, startMinute: 1110, maxSpots: 2 }))
  })

  // Con 150 excepciones el server no deja agregar otra: su mensaje tal cual DENTRO del diálogo (el modal tapa la lista que
  // hay que corregir; un toast se iría en 5 s), y el diálogo sigue abierto con lo tecleado (H1).
  it('excepción 151 ⇒ el mensaje del server tal cual dentro del diálogo, que no se cierra', async () => {
    const user = userEvent.setup()
    svc.upsertWeeklyPassCap.mockRejectedValue({
      response: { status: 400, data: { message: TOO_MANY, code: 'PASS_CAPACITY_TOO_MANY_RULES' } },
    })
    renderSection()
    await user.click(await screen.findByRole('button', { name: 'capacity.weekly.add' }))
    fireEvent.change(screen.getByLabelText('capacity.dialog.time'), { target: { value: '18:30' } })
    fireEvent.change(screen.getByLabelText('capacity.dialog.spots'), { target: { value: '2' } })
    await user.click(screen.getByRole('button', { name: 'common:save' }))
    expect(await within(screen.getByRole('dialog')).findByText(TOO_MANY)).toBeInTheDocument()
    expect(toastSpy).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
    await waitFor(() => expect(svc.getPassCapacity).toHaveBeenCalledTimes(2))
    expect(screen.getByLabelText('capacity.dialog.spots')).toHaveValue(2)
    // al cerrar y volver a abrir, el error viejo ya no está
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    await user.click(await screen.findByRole('button', { name: 'capacity.weekly.add' }))
    expect(await screen.findByLabelText('capacity.dialog.spots')).toHaveValue(null)
    expect(screen.queryByText(TOO_MANY)).not.toBeInTheDocument()
  })

  // el refetch tras aplicar una sugerencia trae OTRA respuesta y NO pisa el tope general a medio teclear
  // (con una respuesta idéntica TanStack conservaría la referencia y esto pasaría también con el defecto)
  it('aplicar una sugerencia no borra el tope general que el dueño tecleó y no guardó', async () => {
    const user = userEvent.setup()
    svc.getPassCapacity.mockResolvedValueOnce(CAPACITY).mockResolvedValueOnce(AFTER_APPLY)
    renderSection()
    const input = await screen.findByLabelText('capacity.default.label')
    await user.clear(input)
    await user.type(input, '7')
    await user.click(screen.getByRole('button', { name: 'capacity.suggestions.apply' }))
    await waitFor(() => expect(svc.upsertWeeklyPassCap).toHaveBeenCalled())
    // la respuesta NUEVA ya está en pantalla (la excepción de los lunes que creó la sugerencia)…
    expect(await screen.findByText('days.1 · 07:00 · capacity.weekly.spots:{"count":3}')).toBeInTheDocument()
    // …se deja que React termine de aplicarla (renders y efectos pendientes)…
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    // …y el borrador tecleado sigue ahí (el tope general del server sigue en 3)
    expect(screen.getByLabelText('capacity.default.label')).toHaveValue(7)
  })

  // sin borrador, un tope general NUEVO del server sí llega al campo (no se ignora la respuesta fresca)
  it('sin borrador, el tope general muestra el valor nuevo que trae el servidor', async () => {
    const user = userEvent.setup()
    // otro administrador cambió el tope general a 5 mientras esta pantalla estaba abierta
    svc.getPassCapacity.mockResolvedValueOnce(CAPACITY).mockResolvedValueOnce({ ...AFTER_APPLY, defaultMaxSpots: 5 })
    renderSection()
    expect(await screen.findByLabelText('capacity.default.label')).toHaveValue(3)
    await user.click(screen.getByRole('button', { name: 'capacity.suggestions.apply' }))
    await waitFor(() => expect(screen.getByLabelText('capacity.default.label')).toHaveValue(5))
  })

  it('sin permiso: input, Guardar, Agregar, Borrar y Aplicar deshabilitados', async () => {
    renderSection(false)
    expect(await screen.findByLabelText('capacity.default.label')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'capacity.default.save' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'capacity.weekly.add' })).toBeDisabled()
    expect(screen.getByRole('button', { name: DELETE_SAT })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'capacity.suggestions.apply' })).toBeDisabled()
  })
})
