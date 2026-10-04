import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PassCapacityView } from '@/types/passes'

vi.mock('@/hooks/use-tier-feature-access', () => ({ useVenueTier: () => ({ hasFeatureAccess: () => true, isLoading: false, isResolved: true }) }))
// usePassCapacity sólo consulta con `reservations:read` (usePassesAccess).
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
const svc = vi.hoisted(() => ({ getPassCapacity: vi.fn(), setDefaultPassCap: vi.fn(), upsertWeeklyPassCap: vi.fn(), deletePassCapRule: vi.fn() }))
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

function renderSection(canManage = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PassCapacitySection venueId="v1" canManage={canManage} />
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
    await user.type(input, '600')
    expect(screen.getByText('capacity.default.invalid')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'capacity.default.save' })).toBeDisabled()
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
    expect(await screen.findByText('days.6 · 09:00 · capacity.weekly.spots:{"count":1}')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'capacity.weekly.delete' }))
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
    await user.click(await screen.findByRole('button', { name: 'capacity.weekly.delete' }))
    await user.click(await screen.findByRole('button', { name: 'capacity.weekly.deleteConfirm' }))
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', title: RULE_GONE })))
    expect(await screen.findByText('capacity.weekly.empty')).toBeInTheDocument()
  })

  // la sugerencia dice su porqué y Aplicar crea la excepción; la ya aplicada no tiene botón
  it('sugerencias: porqué + Aplicar crea la excepción; la aplicada se marca', async () => {
    const user = userEvent.setup()
    renderSection()
    expect(await screen.findByText('capacity.suggestions.line:{"day":"daysPlural.1","time":"07:00","pct":67,"spots":3}')).toBeInTheDocument()
    expect(screen.getByText('capacity.suggestions.applied')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'capacity.suggestions.apply' })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'capacity.suggestions.apply' }))
    await waitFor(() => expect(svc.upsertWeeklyPassCap).toHaveBeenCalledWith('v1', { weekday: 1, startMinute: 420, maxSpots: 3 }))
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

  // Con 150 excepciones el server no deja agregar otra: su mensaje tal cual y el diálogo sigue abierto con lo tecleado.
  it('excepción 151 ⇒ el mensaje del server tal cual y el diálogo no se cierra', async () => {
    const user = userEvent.setup()
    svc.upsertWeeklyPassCap.mockRejectedValue({ response: { status: 400, data: { message: TOO_MANY, code: 'PASS_CAPACITY_TOO_MANY_RULES' } } })
    renderSection()
    await user.click(await screen.findByRole('button', { name: 'capacity.weekly.add' }))
    fireEvent.change(screen.getByLabelText('capacity.dialog.time'), { target: { value: '18:30' } })
    fireEvent.change(screen.getByLabelText('capacity.dialog.spots'), { target: { value: '2' } })
    await user.click(screen.getByRole('button', { name: 'common:save' }))
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', title: TOO_MANY })))
    await waitFor(() => expect(svc.getPassCapacity).toHaveBeenCalledTimes(2))
    expect(screen.getByLabelText('capacity.dialog.spots')).toHaveValue(2)
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
    expect(screen.getByRole('button', { name: 'capacity.weekly.delete' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'capacity.suggestions.apply' })).toBeDisabled()
  })
})
