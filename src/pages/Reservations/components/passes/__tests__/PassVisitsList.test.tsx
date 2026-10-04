import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { passesKeys } from '@/hooks/use-passes'
import type { PassConnectionStatus, PassIntegrationsOverview, PassVisitView, PassVisitsPage } from '@/types/passes'

const PLAN_OK = { hasFeatureAccess: () => true, isLoading: false, isResolved: true }
const tier = vi.hoisted(() => ({ current: { hasFeatureAccess: (): boolean => true, isLoading: false, isResolved: true } }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useVenueTier: () => tier.current }))
const access = vi.hoisted(() => ({ allowed: ['reservations:read', 'reservations:update'] }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => access.allowed.includes(p) }) }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({
    formatDateTime: (d: string) => `dt:${d}`,
    formatTime: (d: string) => `t:${d}`,
    formatDate: (d: string) => `d:${d}`,
    venueTimezone: 'America/Mexico_City',
  }),
}))
const svc = vi.hoisted(() => ({
  listPassVisits: vi.fn(),
  confirmPassVisit: vi.fn(),
  rejectPassVisit: vi.fn(),
  getPassIntegrationsOverview: vi.fn(),
}))
vi.mock('@/services/passes.service', () => svc)
const toastSpy = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastSpy }) }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key) }),
}))

import { PassVisitsList } from '../PassVisitsList'

// Los textos reales del server (`passVisits.service.ts`): la UI los muestra tal cual.
const CONNECTION_NOT_ACTIVE =
  'La conexión con TotalPass no está activa: no se puede confirmar ahora. Revisa la conexión en Configuración › Integraciones › Pases.'
const CONFIRM_DEADLINE_PASSED = 'El plazo para confirmar este check-in ya venció; el proveedor no pagará esta visita.'
const REJECT_EXPIRED = 'Este check-in ya venció; no hace falta rechazarlo.'
const CHECK_IN_NOT_UNDONE = 'La reserva de este socio ya tiene un cobro registrado: reembolsa ese cobro y después rechaza el check-in.'
const conflict = (message: string, code: string) => ({ response: { status: 409, data: { success: false, message, code } } })

const inMs = (ms: number) => new Date(Date.now() + ms).toISOString()
const visit = (over: Partial<PassVisitView> = {}): PassVisitView => ({
  id: 'vis1',
  provider: 'TOTALPASS',
  status: 'PENDING',
  memberName: 'Ana López',
  startedAt: '2030-01-10T11:55:00Z',
  deadlineAt: inMs(60 * 60_000),
  confirmedAt: null,
  confirmedBy: null,
  lastError: null,
  reservation: { id: 'r1', classSessionId: 's1', startsAt: '2030-01-10T12:00:00Z', productName: 'Yoga' },
  canConfirm: true,
  canReject: true,
  ...over,
})
const page = (items: PassVisitView[], over: Partial<PassVisitsPage> = {}): PassVisitsPage => ({
  items,
  total: items.length,
  hasMore: false,
  nextOffset: null,
  ...over,
})
const overview = (totalpass: PassConnectionStatus | null): PassIntegrationsOverview => ({
  planActive: true,
  connections: [
    {
      provider: 'TOTALPASS',
      available: true,
      status: totalpass,
      externalPlaceName: 'Estudio de prueba',
      confirmMode: 'ON_VENUE_CHECKIN',
      lastError: null,
      plans: [],
      productLinks: [],
      updatedAt: null,
    },
    {
      provider: 'WELLHUB',
      available: false,
      status: null,
      externalPlaceName: null,
      confirmMode: 'AUTO',
      lastError: null,
      plans: [],
      productLinks: [],
      updatedAt: null,
    },
  ],
  classProducts: { items: [], total: 0 },
})
/** Una promesa que el test resuelve cuando quiere: deja un refetch «en vuelo». */
function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>(r => {
    resolve = r
  })
  return { promise, resolve }
}

type Props = Parameters<typeof PassVisitsList>[0]
const ui = (props: Partial<Props> = {}) => (
  <PassVisitsList venueId="v1" tab="pending" provider={null} dateRange={{ from: null, to: null }} {...props} />
)
function renderList(props: Partial<Props> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const result = render(<QueryClientProvider client={client}>{ui(props)}</QueryClientProvider>)
  return {
    ...result,
    rerender: (next: Partial<Props>) => result.rerender(<QueryClientProvider client={client}>{ui(next)}</QueryClientProvider>),
  }
}

beforeEach(() => {
  tier.current = PLAN_OK
  access.allowed = ['reservations:read', 'reservations:update']
  svc.listPassVisits.mockResolvedValue(page([visit()]))
  svc.confirmPassVisit.mockResolvedValue(visit({ status: 'CONFIRMED', canConfirm: false, canReject: false }))
  svc.rejectPassVisit.mockResolvedValue(visit({ status: 'REJECTED', canConfirm: false, canReject: false }))
  svc.getPassIntegrationsOverview.mockResolvedValue(overview('ACTIVE'))
})
afterEach(() => vi.useRealTimers())

describe('PassVisitsList', () => {
  // La prueba obligatoria «escribir y VER el resultado» (el server ya la devolvió CONFIRMED).
  it('confirmar un pendiente (respuesta CONFIRMED) lo quita de Pendientes sin recargar', async () => {
    const user = userEvent.setup()
    svc.listPassVisits.mockResolvedValueOnce(page([visit()])).mockResolvedValue(page([]))
    renderList()
    expect(await screen.findByText('Ana López')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'visits.confirm' }))
    await waitFor(() => expect(svc.confirmPassVisit).toHaveBeenCalledWith('v1', 'vis1'))
    await waitFor(() => expect(screen.queryByText('Ana López')).not.toBeInTheDocument())
    expect(screen.getByText('visits.empty.pending')).toBeInTheDocument()
    expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: 'visits.confirmed' }))
    expect(svc.listPassVisits).toHaveBeenCalledTimes(2)
  })

  // P1-3 + P1-4: el server encoló la validación y devolvió PENDING: la fila se queda con «confirmación solicitada» y SIN
  // botones; el refresco de 30 s (sin tocar nada) la saca cuando TotalPass la confirmó.
  it('respuesta PENDING ⇒ «confirmación solicitada» sin botones; el refresco periódico la saca al quedar CONFIRMED', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: delay => vi.advanceTimersByTime(delay) })
    svc.confirmPassVisit.mockResolvedValue(visit({ status: 'PENDING', canConfirm: false, canReject: false }))
    svc.listPassVisits.mockResolvedValueOnce(page([visit()])).mockResolvedValueOnce(page([visit()])).mockResolvedValue(page([]))
    renderList()
    expect(await screen.findByText('Ana López')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'visits.confirm' }))
    expect(await screen.findByText('visits.confirmRequested:{"provider":"providers.TOTALPASS"}')).toBeInTheDocument()
    expect(screen.getByText('Ana López')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'visits.confirm' })).not.toBeInTheDocument()
    expect(toastSpy).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'visits.confirmed' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    await waitFor(() => expect(screen.queryByText('Ana López')).not.toBeInTheDocument())
    expect(svc.listPassVisits).toHaveBeenCalledTimes(3)
  })

  // P1-3: el server la devolvió ya vencida (el job la marcó EXPIRED antes de que llegara el clic).
  it('respuesta EXPIRED ⇒ aviso de que venció, no «confirmado»', async () => {
    const user = userEvent.setup()
    svc.confirmPassVisit.mockResolvedValue(visit({ status: 'EXPIRED', canConfirm: false, canReject: false }))
    renderList()
    await user.click(await screen.findByRole('button', { name: 'visits.confirm' }))
    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive', title: 'visits.confirmExpired:{"provider":"providers.TOTALPASS"}' }),
      ),
    )
    expect(toastSpy).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'visits.confirmed' }))
  })

  // P1-3: ya estaba resuelta (otra recepción o el portal la confirmaron antes): es éxito, no un error.
  it('respuesta ALREADY_CONFIRMED ⇒ éxito', async () => {
    const user = userEvent.setup()
    svc.confirmPassVisit.mockResolvedValue(visit({ status: 'ALREADY_CONFIRMED', canConfirm: false, canReject: false }))
    renderList()
    await user.click(await screen.findByRole('button', { name: 'visits.confirm' }))
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: 'visits.confirmed' })))
  })

  // P1-3: rechazar pasa por confirmación; sólo REJECTED es éxito, otro estado se dice con el estado real.
  it('rechazar: pide confirmación; REJECTED ⇒ éxito; otro estado ⇒ aviso con el estado real', async () => {
    const user = userEvent.setup()
    renderList()
    await user.click(await screen.findByRole('button', { name: 'visits.reject' }))
    expect(svc.rejectPassVisit).not.toHaveBeenCalled()
    await user.click(await screen.findByRole('button', { name: 'visits.rejectConfirm' }))
    await waitFor(() => expect(svc.rejectPassVisit).toHaveBeenCalledWith('v1', 'vis1'))
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: 'visits.rejected' })))

    toastSpy.mockClear()
    svc.rejectPassVisit.mockResolvedValue(visit({ status: 'CONFIRMED', canConfirm: false, canReject: false }))
    await user.click(await screen.findByRole('button', { name: 'visits.reject' }))
    await user.click(await screen.findByRole('button', { name: 'visits.rejectConfirm' }))
    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive', title: 'visits.unexpectedStatus:{"status":"visits.status.CONFIRMED"}' }),
      ),
    )
    expect(toastSpy).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'visits.rejected' }))
  })

  // P2-8: tras confirmar, los botones siguen deshabilitados hasta que el refetch de la lista terminó.
  it('los botones no se rehabilitan hasta que la lista nueva llegó', async () => {
    const user = userEvent.setup()
    const refetch = deferred<PassVisitsPage>()
    svc.listPassVisits.mockResolvedValueOnce(page([visit()])).mockReturnValueOnce(refetch.promise)
    renderList()
    await user.click(await screen.findByRole('button', { name: 'visits.confirm' }))
    await waitFor(() => expect(svc.listPassVisits).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: 'visits.confirm' })).toBeDisabled()
    refetch.resolve(page([]))
    await waitFor(() => expect(screen.queryByText('Ana López')).not.toBeInTheDocument())
  })

  // R2b-17: el error del server se muestra TAL CUAL y el onError DEVUELVE la recarga de la lista: los botones siguen apagados
  // hasta que la lista nueva llegó (sin el `return`, se rehabilitarían sobre la fila vieja).
  it('confirmar con el plazo vencido en el server ⇒ su mensaje tal cual, y la lista se recarga antes de rehabilitar', async () => {
    const user = userEvent.setup()
    const refetch = deferred<PassVisitsPage>()
    svc.confirmPassVisit.mockRejectedValue(conflict(CONFIRM_DEADLINE_PASSED, 'PASS_VISIT_EXPIRED'))
    svc.listPassVisits.mockResolvedValueOnce(page([visit()])).mockReturnValueOnce(refetch.promise)
    renderList()
    await user.click(await screen.findByRole('button', { name: 'visits.confirm' }))
    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', title: CONFIRM_DEADLINE_PASSED })),
    )
    await waitFor(() => expect(svc.listPassVisits).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: 'visits.confirm' })).toBeDisabled()
    refetch.resolve(page([visit({ status: 'EXPIRED', canConfirm: false, canReject: false })]))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'visits.confirm' })).not.toBeInTheDocument())
  })

  // R2b-17: los dos 409 de rechazar salen tal cual (no se pudo deshacer la asistencia; ya venció) y la lista se recarga.
  it('rechazar con un 409 del server ⇒ su mensaje tal cual y la lista se recarga', async () => {
    const user = userEvent.setup()
    svc.rejectPassVisit.mockRejectedValueOnce(conflict(CHECK_IN_NOT_UNDONE, 'PASS_VISIT_CHECK_IN_NOT_UNDONE'))
    renderList()
    await user.click(await screen.findByRole('button', { name: 'visits.reject' }))
    await user.click(await screen.findByRole('button', { name: 'visits.rejectConfirm' }))
    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', title: CHECK_IN_NOT_UNDONE })),
    )
    await waitFor(() => expect(svc.listPassVisits).toHaveBeenCalledTimes(2))

    svc.rejectPassVisit.mockRejectedValueOnce(conflict(REJECT_EXPIRED, 'PASS_VISIT_EXPIRED'))
    await user.click(await screen.findByRole('button', { name: 'visits.reject' }))
    await user.click(await screen.findByRole('button', { name: 'visits.rejectConfirm' }))
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', title: REJECT_EXPIRED })))
    await waitFor(() => expect(svc.listPassVisits).toHaveBeenCalledTimes(3))
    expect(toastSpy).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'visits.rejected' }))
  })

  // R2b-23: con la conexión del proveedor no activa, Confirmar se apaga y se dice por qué; Rechazar no cambia.
  it('conexión de TotalPass no activa ⇒ Confirmar deshabilitado con la explicación; Rechazar sigue', async () => {
    svc.getPassIntegrationsOverview.mockResolvedValue(overview('PAUSED'))
    renderList()
    expect(await screen.findByText('visits.connectionInactive:{"provider":"providers.TOTALPASS"}')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'visits.confirm' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'visits.reject' })).toBeEnabled()
  })

  // R2b-23: si la vista general estaba vieja, el 409 PASS_CONNECTION_NOT_ACTIVE se muestra tal cual y la vuelve a pedir.
  it('409 PASS_CONNECTION_NOT_ACTIVE ⇒ su mensaje tal cual, y la fila se pone al día con la conexión', async () => {
    const user = userEvent.setup()
    svc.getPassIntegrationsOverview.mockResolvedValueOnce(overview('ACTIVE')).mockResolvedValue(overview('REVOKED'))
    svc.confirmPassVisit.mockRejectedValue(conflict(CONNECTION_NOT_ACTIVE, 'PASS_CONNECTION_NOT_ACTIVE'))
    renderList()
    await user.click(await screen.findByRole('button', { name: 'visits.confirm' }))
    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', title: CONNECTION_NOT_ACTIVE })),
    )
    expect(await screen.findByText('visits.connectionInactive:{"provider":"providers.TOTALPASS"}')).toBeInTheDocument()
    expect(svc.getPassIntegrationsOverview).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: 'visits.confirm' })).toBeDisabled()
  })

  // P1-4: vence en pantalla ⇒ se apagan los botones y se vuelve a pedir la lista (el server ya la venció).
  it('cuando el plazo vence en pantalla se apagan los botones y se vuelve a pedir la lista', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    svc.listPassVisits.mockResolvedValueOnce(page([visit({ deadlineAt: inMs(2_000) })])).mockResolvedValue(page([]))
    renderList()
    expect(await screen.findByText('Ana López')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'visits.confirm' })).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })
    await waitFor(() => expect(svc.listPassVisits).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByText('Ana López')).not.toBeInTheDocument())
  })

  // El server la mandó con canConfirm pero el plazo ya pasó: sin botones aunque la lista no cambie.
  it('con el plazo ya vencido al llegar no hay botones y se dice que venció', async () => {
    svc.listPassVisits.mockResolvedValue(page([visit({ deadlineAt: inMs(-60_000) })]))
    renderList()
    expect(await screen.findByText('Ana López')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'visits.confirm' })).not.toBeInTheDocument()
    expect(screen.getByText('visits.expiredLabel')).toBeInTheDocument()
  })

  // P1-4: llega una visita nueva sin que nadie toque nada (refresco de 30 s en primer plano).
  it('una llegada nueva aparece sola a los 30 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    svc.listPassVisits.mockResolvedValueOnce(page([])).mockResolvedValue(page([visit()]))
    renderList()
    expect(await screen.findByText('visits.empty.pending')).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(await screen.findByText('Ana López')).toBeInTheDocument()
  })

  it('sin permiso de actualizar: se ve la cuenta regresiva pero no los botones', async () => {
    access.allowed = ['reservations:read']
    renderList()
    expect(await screen.findByText('Ana López')).toBeInTheDocument()
    expect(screen.getByText(/^visits\.deadlineAt:/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'visits.confirm' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'visits.reject' })).not.toBeInTheDocument()
  })

  // Tres estados distinguibles.
  it('vacío por defecto ≠ sin resultados con filtros ≠ error del servidor', async () => {
    svc.listPassVisits.mockResolvedValue(page([]))
    const { unmount } = renderList()
    expect(await screen.findByText('visits.empty.pending')).toBeInTheDocument()
    unmount()
    const r2 = renderList({ provider: 'WELLHUB' })
    expect(await screen.findByText('visits.noMatches')).toBeInTheDocument()
    r2.unmount()
    svc.listPassVisits.mockRejectedValue({ response: { status: 500, data: { message: 'Se cayó la base' } } })
    renderList()
    // retry: 1 del hook ⇒ el error tarda ~1 s más que el límite por defecto de findByText (P2-14).
    expect(await screen.findByText('Se cayó la base', {}, { timeout: 5_000 })).toBeInTheDocument()
  })

  // P1-6: cambiar de filtro conserva la tabla anterior, lo dice, y no deja actuar ni concluir «vacío» hasta la respuesta nueva.
  it('al cambiar de filtro: tabla anterior + «Actualizando…», sin botones ni «sin resultados» hasta que responde el filtro nuevo', async () => {
    const next = deferred<PassVisitsPage>()
    svc.listPassVisits.mockResolvedValueOnce(page([visit()])).mockReturnValueOnce(next.promise)
    const { rerender } = renderList()
    expect(await screen.findByText('Ana López')).toBeInTheDocument()
    rerender({ provider: 'WELLHUB' })
    await waitFor(() => expect(svc.listPassVisits).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Ana López')).toBeInTheDocument()
    expect(screen.getByText('visits.updating')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'visits.confirm' })).not.toBeInTheDocument()
    expect(screen.queryByText('visits.noMatches')).not.toBeInTheDocument()
    // H3: el total es del filtro ANTERIOR: no se presenta como definitivo.
    expect(screen.queryByText(/^visits\.total/)).not.toBeInTheDocument()
    next.resolve(page([]))
    expect(await screen.findByText('visits.noMatches')).toBeInTheDocument()
    expect(screen.queryByText('visits.updating')).not.toBeInTheDocument()
    expect(screen.getByText('visits.total:{"count":0}')).toBeInTheDocument()
  })

  // P2-7: los filtros viajan tal cual: estado de la pestaña, proveedor y los DÍAS elegidos (AAAA-MM-DD, `to` inclusivo).
  it('manda status, provider y los días del filtro (AAAA-MM-DD, sin UTC ni sumar un día), paginado', async () => {
    renderList({ tab: 'expired', provider: 'TOTALPASS', dateRange: { from: '2030-01-10', to: '2030-01-12' } })
    await waitFor(() =>
      expect(svc.listPassVisits).toHaveBeenCalledWith('v1', {
        status: 'EXPIRED',
        provider: 'TOTALPASS',
        from: '2030-01-10',
        to: '2030-01-12',
        limit: 50,
        offset: 0,
      }),
    )
  })

  it('muestra el total y «Cargar más» pide la siguiente página', async () => {
    const user = userEvent.setup()
    svc.listPassVisits
      .mockResolvedValueOnce(page([visit()], { total: 51, hasMore: true, nextOffset: 50 }))
      .mockResolvedValueOnce(page([visit({ id: 'vis2', memberName: 'Beto' })], { total: 51 }))
    renderList()
    expect(await screen.findByText('visits.total:{"count":51}')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'visits.loadMore' }))
    expect(await screen.findByText('Beto')).toBeInTheDocument()
    expect(svc.listPassVisits.mock.calls[1][1]).toMatchObject({ offset: 50 })
  })

  // P2-11: una llegada entre dos páginas corre las posiciones y la segunda repite el último de la primera.
  it('páginas solapadas no repiten la visita', async () => {
    const user = userEvent.setup()
    svc.listPassVisits
      .mockResolvedValueOnce(page([visit()], { total: 2, hasMore: true, nextOffset: 1 }))
      .mockResolvedValueOnce(page([visit(), visit({ id: 'vis2', memberName: 'Beto' })], { total: 3 }))
    renderList()
    expect(await screen.findByText('Ana López')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'visits.loadMore' }))
    expect(await screen.findByText('Beto')).toBeInTheDocument()
    expect(screen.getAllByText('Ana López')).toHaveLength(1)
  })

  it('muestra el último error de la fila', async () => {
    svc.listPassVisits.mockResolvedValue(
      page([visit({ status: 'EXPIRED', lastError: 'TotalPass HTTP 503', canConfirm: false, canReject: false })]),
    )
    renderList({ tab: 'expired' })
    expect(await screen.findByText('visits.lastError:{"error":"TotalPass HTTP 503"}')).toBeInTheDocument()
  })

  // Un rechazo guarda «Rechazada por el estudio» en lastError: no es un error y no se pinta como tal.
  it('en un rechazado no se pinta la nota del rechazo como «último error»', async () => {
    svc.listPassVisits.mockResolvedValue(
      page([visit({ status: 'REJECTED', lastError: 'Rechazada por el estudio', canConfirm: false, canReject: false })]),
    )
    renderList({ tab: 'rejected' })
    expect(await screen.findByText('visits.status.REJECTED')).toBeInTheDocument()
    expect(screen.queryByText(/visits\.lastError/)).not.toBeInTheDocument()
  })

  // P3-17: confirmedBy trae un código (AUTO/VENUE), no un nombre.
  it('confirmada: AUTO y VENUE se traducen, nunca se pinta el código', async () => {
    svc.listPassVisits.mockResolvedValue(
      page([
        visit({ id: 'a', status: 'CONFIRMED', confirmedBy: 'AUTO', canConfirm: false, canReject: false }),
        visit({ id: 'b', memberName: 'Beto', status: 'CONFIRMED', confirmedBy: 'VENUE', canConfirm: false, canReject: false }),
      ]),
    )
    renderList({ tab: 'confirmed' })
    expect(await screen.findByText('visits.confirmedBy.AUTO')).toBeInTheDocument()
    expect(screen.getByText('visits.confirmedBy.VENUE')).toBeInTheDocument()
    expect(screen.queryByText(/^(AUTO|VENUE)$/)).not.toBeInTheDocument()
  })

  // H1: un refresco que falla con la lista ya cargada no la tapa: las filas y el diálogo abierto se quedan, con un aviso en línea.
  it('un refresco fallido conserva las filas y el diálogo de rechazo abierto, con un aviso en línea', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: delay => vi.advanceTimersByTime(delay) })
    svc.listPassVisits
      .mockResolvedValueOnce(page([visit()]))
      .mockRejectedValue({ response: { status: 500, data: { message: 'Se cayó la base' } } })
    renderList()
    await user.click(await screen.findByRole('button', { name: 'visits.reject' }))
    expect(await screen.findByText('visits.rejectTitle')).toBeInTheDocument()
    // El refresco de 30 s falla, y también su único reintento (retry: 1).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })
    expect(await screen.findByText('visits.refreshError')).toBeInTheDocument()
    expect(screen.getByText('Se cayó la base')).toBeInTheDocument()
    // H7: la frase larga NO va en el título del Alert (line-clamp-1 la cortaría con «…» en celular).
    expect(screen.getByText('visits.refreshError').closest('[data-slot="alert-title"]')).toBeNull()
    expect(screen.getByText('Ana López')).toBeInTheDocument()
    expect(screen.getByText('visits.rejectTitle')).toBeInTheDocument()
    expect(screen.queryByText('visits.loadError')).not.toBeInTheDocument()

    // R2b-27: el aviso trae «Reintentar»; si la consulta ya responde, la lista se pone al día y el aviso se va.
    svc.listPassVisits.mockResolvedValue(page([visit({ memberName: 'Ana Actualizada' })]))
    await user.click(screen.getByRole('button', { name: 'common:cancel' })) // el diálogo modal tapa la página: se cierra antes
    await user.click(screen.getByRole('button', { name: 'common:retry' }))
    expect(await screen.findByText('Ana Actualizada')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('visits.refreshError')).not.toBeInTheDocument())
  })

  // R2b-27 (c): la rama «nunca llegó una lista» es la de pantalla completa (distinta del aviso en línea): sin filas ni «Reintentar» del aviso.
  it('sin datos y con error: error de pantalla (visits.loadError) con el mensaje del server, sin el aviso en línea', async () => {
    svc.listPassVisits.mockRejectedValue({ response: { status: 500, data: { message: 'Se cayó la base' } } })
    renderList()
    expect(await screen.findByText('visits.loadError', {}, { timeout: 5_000 })).toBeInTheDocument()
    expect(screen.getByText('Se cayó la base')).toBeInTheDocument()
    expect(screen.queryByText('visits.refreshError')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'common:retry' })).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  // R2b-27 (a): StrictMode (dev) monta, desmonta y vuelve a montar. Con filas YA vencidas desde la caché, el cleanup tiene que soltar
  // el timer de vencimiento; si no, la segunda pasada ve la ref llena, no programa nada y esa instancia nunca recarga por vencimiento.
  it('StrictMode con filas ya vencidas en caché: igual hay una recarga por vencimiento', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const expired = visit({ deadlineAt: inMs(-60_000) })
    client.setQueryData(passesKeys.visits('v1', { status: 'PENDING' }), { pages: [page([expired])], pageParams: [0] })
    svc.listPassVisits.mockResolvedValue(page([]))
    render(
      <StrictMode>
        <QueryClientProvider client={client}>{ui()}</QueryClientProvider>
      </StrictMode>,
    )
    expect(screen.getByText('Ana López')).toBeInTheDocument()
    await waitFor(() => expect(svc.listPassVisits).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByText('Ana López')).not.toBeInTheDocument())
  })

  // H2: mientras el plan no se comprueba la consulta está apagada: eso no es «no hay check-ins».
  it('con la consulta apagada (plan sin comprobar): «Cargando», ni vacío ni total, y no se pide nada', () => {
    tier.current = { hasFeatureAccess: () => true, isLoading: true, isResolved: false }
    renderList()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('visits.empty.pending')).not.toBeInTheDocument()
    expect(screen.queryByText(/^visits\.total/)).not.toBeInTheDocument()
    expect(svc.listPassVisits).not.toHaveBeenCalled()
  })

  // H4: varias filas que vencen a la vez piden la lista UNA vez (no una por fila), y nada más después.
  it('tres filas que vencen juntas ⇒ una sola recarga', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const deadlineAt = inMs(2_000)
    svc.listPassVisits
      .mockResolvedValueOnce(
        page([
          visit({ deadlineAt }),
          visit({ id: 'vis2', memberName: 'Beto', deadlineAt }),
          visit({ id: 'vis3', memberName: 'Caro', deadlineAt }),
        ]),
      )
      .mockResolvedValue(page([]))
    renderList()
    expect(await screen.findByText('Caro')).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })
    await waitFor(() => expect(screen.queryByText('Ana López')).not.toBeInTheDocument())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(svc.listPassVisits).toHaveBeenCalledTimes(2)
  })

  // H5: cada botón sigue a su propia bandera del server.
  it('Confirmar sigue a canConfirm y Rechazar a canReject', async () => {
    svc.listPassVisits.mockResolvedValue(
      page([visit({ canConfirm: false, canReject: true }), visit({ id: 'vis2', memberName: 'Beto', canConfirm: true, canReject: false })]),
    )
    renderList()
    const ana = within((await screen.findByText('Ana López')).closest('tr')!)
    expect(ana.queryByRole('button', { name: 'visits.confirm' })).not.toBeInTheDocument()
    expect(ana.getByRole('button', { name: 'visits.reject' })).toBeInTheDocument()
    const beto = within(screen.getByText('Beto').closest('tr')!)
    expect(beto.getByRole('button', { name: 'visits.confirm' })).toBeInTheDocument()
    expect(beto.queryByRole('button', { name: 'visits.reject' })).not.toBeInTheDocument()
  })

  // H8: rechazar no se puede deshacer: el diálogo dice de quién es el check-in y de qué clase.
  it('el diálogo de rechazo dice de quién es el check-in y de qué clase', async () => {
    const user = userEvent.setup()
    svc.listPassVisits.mockResolvedValue(page([visit(), visit({ id: 'vis2', memberName: null, reservation: null })]))
    renderList()
    const rejects = await screen.findAllByRole('button', { name: 'visits.reject' })
    await user.click(rejects[0])
    expect(
      await screen.findByText('visits.rejectWho:{"member":"Ana López","class":"Yoga","time":"dt:2030-01-10T12:00:00Z"}'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'common:cancel' }))
    await waitFor(() => expect(screen.queryByText('visits.rejectTitle')).not.toBeInTheDocument())
    await user.click(rejects[1])
    expect(await screen.findByText('visits.rejectWhoNoClass:{"member":"visits.unknownMember"}')).toBeInTheDocument()
  })

  // H9: la confirmación solicitada no se resolvió y el server dejó un motivo: se dice, en vez de «en unos segundos».
  it('una fila «solicitada» que vuelve PENDING con lastError dice que se está reintentando y por qué', async () => {
    const user = userEvent.setup()
    svc.confirmPassVisit.mockResolvedValue(visit({ status: 'PENDING' }))
    svc.listPassVisits.mockResolvedValueOnce(page([visit()])).mockResolvedValue(page([visit({ lastError: 'TotalPass HTTP 503' })]))
    renderList()
    await user.click(await screen.findByRole('button', { name: 'visits.confirm' }))
    expect(
      await screen.findByText('visits.retrying:{"provider":"providers.TOTALPASS","error":"TotalPass HTTP 503"}'),
    ).toBeInTheDocument()
    expect(screen.queryByText('visits.confirmRequested:{"provider":"providers.TOTALPASS"}')).not.toBeInTheDocument()
    expect(screen.queryByText(/^visits\.lastError/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'visits.confirm' })).not.toBeInTheDocument()
  })
})
