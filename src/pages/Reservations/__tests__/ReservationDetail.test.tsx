import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { BreadcrumbProvider } from '@/context/BreadcrumbContext'
import { Currency } from '@/utils/currency'
import type { Reservation, ReservationStatus } from '@/types/reservation'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: unknown) => {
      if (params && typeof params === 'object') {
        const p = params as Record<string, unknown>
        if (typeof p.code === 'string') return `${key}:${p.code}`
        // Los textos de «Sí llegó» llevan variables (nombre, clase, hora, cuántas): se ven en la salida para poder afirmarlas.
        const vars = Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'defaultValue'))
        if (key.startsWith('undoNoShow') && Object.keys(vars).length > 0) return `${key}:${JSON.stringify(vars)}`
      }
      return key
    },
    i18n: { language: 'en' },
  }),
}))

vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({
    venueId: 'test-venue',
    fullBasePath: '/venues/test',
    slug: 'test',
  }),
}))

vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({
    formatDate: (d: string) => d?.split('T')[0] || d,
    formatTime: (d: string) => d?.split('T')[1]?.substring(0, 5) || d,
  }),
}))

const toast = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))

// «Sí llegó» y «Marcar resuelto» sólo con reservations:update (molde de PassVisitsList).
const access = vi.hoisted(() => ({ allowed: ['reservations:read', 'reservations:update'] as string[] }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => access.allowed.includes(p) }) }))

let mockReservation: Reservation | null = null

const svc = vi.hoisted(() => ({
  getReservation: vi.fn(),
  previewUndoNoShow: vi.fn(),
  undoNoShow: vi.fn(),
  resolveNoShowCorrection: vi.fn(),
}))
vi.mock('@/services/reservation.service', () => ({ default: svc, reservationService: svc }))

import ReservationDetail from '../ReservationDetail'

function createTestReservation(status: ReservationStatus): Reservation {
  return {
    id: 'res-test-1',
    venueId: 'test-venue',
    confirmationCode: 'RES-TEST01',
    cancelSecret: 'secret',
    status,
    channel: 'DASHBOARD',
    startsAt: '2026-03-15T14:00:00.000Z',
    endsAt: '2026-03-15T15:00:00.000Z',
    duration: 60,
    customerId: null,
    customer: null,
    guestName: 'Test Guest',
    guestPhone: '+5215551234567',
    guestEmail: 'test@guest.com',
    partySize: 2,
    tableId: null,
    table: null,
    productId: null,
    product: null,
    classSessionId: null,
    assignedStaffId: null,
    assignedStaff: null,
    createdById: null,
    createdBy: null,
    depositAmount: null,
    depositStatus: null,
    confirmedAt: status !== 'PENDING' ? '2026-03-15T10:00:00.000Z' : null,
    checkedInAt: ['CHECKED_IN', 'COMPLETED'].includes(status) ? '2026-03-15T14:05:00.000Z' : null,
    completedAt: status === 'COMPLETED' ? '2026-03-15T15:00:00.000Z' : null,
    cancelledAt: status === 'CANCELLED' ? '2026-03-15T13:00:00.000Z' : null,
    noShowAt: status === 'NO_SHOW' ? '2026-03-15T14:30:00.000Z' : null,
    cancelledBy: null,
    cancellationReason: null,
    specialRequests: null,
    internalNotes: null,
    tags: [],
    statusLog: [{ status, at: '2026-03-15T10:00:00.000Z', by: null }],
    createdAt: '2026-03-15T09:00:00.000Z',
    updatedAt: '2026-03-15T10:00:00.000Z',
  }
}

const renderDetail = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const utils = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/venues/test/reservations/res-test-1']}>
        <BreadcrumbProvider>
          <Routes>
            <Route path="/venues/:slug/reservations/:reservationId" element={<ReservationDetail />} />
          </Routes>
        </BreadcrumbProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await screen.findByText(/^detail\.title/)
  return { qc, ...utils }
}

beforeEach(() => {
  svc.getReservation.mockImplementation(async () => mockReservation)
  access.allowed = ['reservations:read', 'reservations:update']
})

describe('ReservationDetail — Action Buttons by Status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PENDING: shows Confirm and Cancel; hides Check-in, Complete', async () => {
    mockReservation = createTestReservation('PENDING')
    await renderDetail()

    expect(screen.getByText('actions.confirm')).toBeDefined()
    expect(screen.getByText('actions.cancel')).toBeDefined()
    expect(screen.getByText('actions.reschedule')).toBeDefined()
    expect(screen.queryByText('actions.checkIn')).toBeNull()
    expect(screen.queryByText('actions.complete')).toBeNull()
  })

  it('CONFIRMED: shows Check-in, Cancel, Reschedule, No-Show; hides Confirm', async () => {
    mockReservation = createTestReservation('CONFIRMED')
    await renderDetail()

    expect(screen.getByText('actions.checkIn')).toBeDefined()
    expect(screen.getByText('actions.cancel')).toBeDefined()
    expect(screen.getByText('actions.reschedule')).toBeDefined()
    expect(screen.getByText('actions.markNoShow')).toBeDefined()
    expect(screen.queryByText('actions.confirm')).toBeNull()
  })

  it('CHECKED_IN: shows Complete; hides Confirm, Check-in', async () => {
    mockReservation = createTestReservation('CHECKED_IN')
    await renderDetail()

    expect(screen.getByText('actions.complete')).toBeDefined()
    expect(screen.queryByText('actions.confirm')).toBeNull()
    expect(screen.queryByText('actions.checkIn')).toBeNull()
    // Cancel and Reschedule should also be hidden for CHECKED_IN
    expect(screen.queryByText('actions.cancel')).toBeNull()
    expect(screen.queryByText('actions.reschedule')).toBeNull()
  })

  it('COMPLETED: no action buttons', async () => {
    mockReservation = createTestReservation('COMPLETED')
    await renderDetail()

    expect(screen.queryByText('actions.confirm')).toBeNull()
    expect(screen.queryByText('actions.checkIn')).toBeNull()
    expect(screen.queryByText('actions.complete')).toBeNull()
    expect(screen.queryByText('actions.cancel')).toBeNull()
    expect(screen.queryByText('actions.reschedule')).toBeNull()
    expect(screen.queryByText('actions.markNoShow')).toBeNull()
  })

  it('CANCELLED: no action buttons', async () => {
    mockReservation = createTestReservation('CANCELLED')
    await renderDetail()

    expect(screen.queryByText('actions.confirm')).toBeNull()
    expect(screen.queryByText('actions.checkIn')).toBeNull()
    expect(screen.queryByText('actions.complete')).toBeNull()
    expect(screen.queryByText('actions.cancel')).toBeNull()
  })

  it('NO_SHOW: ningún botón de las otras transiciones; con reservations:update sólo aparece «Sí llegó»', async () => {
    mockReservation = createTestReservation('NO_SHOW')
    await renderDetail()

    expect(screen.queryByText('actions.confirm')).toBeNull()
    expect(screen.queryByText('actions.checkIn')).toBeNull()
    expect(screen.queryByText('actions.complete')).toBeNull()
    expect(screen.queryByText('actions.cancel')).toBeNull()
    expect(screen.queryByText('actions.reschedule')).toBeNull()
    expect(screen.queryByText('actions.markNoShow')).toBeNull()
    expect(screen.getByRole('button', { name: 'undoNoShow.button' })).toBeInTheDocument()
  })

  it('NO_SHOW sin reservations:update: no hay «Sí llegó»', async () => {
    access.allowed = ['reservations:read']
    mockReservation = createTestReservation('NO_SHOW')
    await renderDetail()

    expect(screen.queryByRole('button', { name: 'undoNoShow.button' })).toBeNull()
  })

  it.each(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED'] as const)('%s: «Sí llegó» no aparece', async status => {
    mockReservation = createTestReservation(status)
    await renderDetail()

    expect(screen.queryByRole('button', { name: 'undoNoShow.button' })).toBeNull()
  })
})

// Regression — multi-service appointments (Square pattern) must list EVERY
// booked service, not just the lead one. This is the exact bug from prod:
// a booking of "Baby Boomer + Manicure/Pedicure/Spa (Gel semipermanente)"
// showed only the modifier because the 2nd service lived in productIds[] and
// was never rendered. See avoqado-server reservation.dashboard.service
// `attachServices`.
describe('ReservationDetail — Services breakdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists ALL booked services with their nested modifiers (multi-service)', async () => {
    mockReservation = {
      ...createTestReservation('CONFIRMED'),
      productId: 'svc-baby-boomer',
      product: { id: 'svc-baby-boomer', name: 'Baby Boomer', price: 150 },
      productIds: ['svc-baby-boomer', 'svc-mani-pedi-spa'],
      services: [
        { id: 'svc-baby-boomer', name: 'Baby Boomer', price: 150, duration: 25 },
        { id: 'svc-mani-pedi-spa', name: 'Manicure + Pedicure + Spa', price: 800, duration: 70 },
      ],
      modifiers: [
        {
          id: 'mod-gel',
          productId: 'svc-mani-pedi-spa',
          name: 'Gel semipermanente',
          quantity: 1,
          price: 220,
          createdAt: '2026-03-15T09:00:00.000Z',
        },
      ],
    }
    await renderDetail()

    // BOTH services render (the old bug dropped the second one)
    expect(screen.getByText('Baby Boomer')).toBeDefined()
    expect(screen.getByText('Manicure + Pedicure + Spa')).toBeDefined()
    // The modifier still renders, tagged to its service
    expect(screen.getByText(/Gel semipermanente/)).toBeDefined()
    // Services section header is shown
    expect(screen.getByText('detail.sections.services')).toBeDefined()
  })

  it('falls back to the single product for legacy single-service rows', async () => {
    mockReservation = {
      ...createTestReservation('CONFIRMED'),
      productId: 'svc-legacy',
      product: { id: 'svc-legacy', name: 'Corte de cabello', price: 200 },
      // no `services` / `productIds` — legacy shape
    }
    await renderDetail()

    expect(screen.getByText('Corte de cabello')).toBeDefined()
    expect(screen.getByText('detail.sections.services')).toBeDefined()
  })
})

// D4 — «Sí llegó»: deshacer un «No asistió» con una confirmación que dice exactamente qué se revierte, y el pendiente que
// una persona tiene que resolver (con «Marcar resuelto»). Los renglones y los textos de pendientes son del plan.
describe('ReservationDetail — «Sí llegó» (deshacer un No Show)', () => {
  const PLAN_LIMPIO = { creditToReconsume: 0, clearFee: false, restoreDeposit: false, pending: [] as string[] }
  const noShow = () => ({ ...createTestReservation('NO_SHOW'), classSessionId: 'sess-1', product: { id: 'p1', name: 'Yoga', price: null } })
  const corregida = (correction: Partial<NonNullable<Reservation['noShowCorrection']>> = {}): Reservation => ({
    ...createTestReservation('CHECKED_IN'),
    classSessionId: 'sess-1',
    product: { id: 'p1', name: 'Yoga', price: null },
    noShowCorrection: { pending: ['CLASS_UNPAID'], resolvedAt: null, source: 'DASHBOARD', createdAt: '2026-03-15T14:40:00.000Z', ...correction },
  })
  const tocarSiLlego = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'undoNoShow.button' }))
    return screen.findByRole('alertdialog')
  }

  beforeEach(() => {
    vi.clearAllMocks()
    svc.previewUndoNoShow.mockResolvedValue({ plan: PLAN_LIMPIO })
  })

  it('pide la vista previa y la confirmación enseña SÓLO los renglones que aplican (clase y multa, no depósito)', async () => {
    mockReservation = noShow()
    svc.previewUndoNoShow.mockResolvedValue({ plan: { creditToReconsume: 1, clearFee: true, restoreDeposit: false, pending: [] } })
    await renderDetail()

    const dialogo = await tocarSiLlego()

    expect(svc.previewUndoNoShow).toHaveBeenCalledWith('test-venue', 'res-test-1')
    expect(within(dialogo).getByText('undoNoShow.title:{"name":"Test Guest","className":"Yoga","time":"14:00"}')).toBeInTheDocument()
    expect(within(dialogo).getByText('undoNoShow.rows.credit:{"count":1}')).toBeInTheDocument()
    expect(within(dialogo).getByText('undoNoShow.rows.fee')).toBeInTheDocument()
    expect(within(dialogo).getByText('undoNoShow.rows.log')).toBeInTheDocument()
    expect(within(dialogo).queryByText('undoNoShow.rows.deposit')).toBeNull()
    // Sin pendientes en el plan: no se asusta a nadie con una sección de pendientes.
    expect(within(dialogo).queryByText('undoNoShow.pendingIntro')).toBeNull()
    expect(svc.undoNoShow).not.toHaveBeenCalled()
  })

  it('cuando el plan trae pendientes, la confirmación los dice con su texto (y el depósito sí aparece si aplica)', async () => {
    mockReservation = noShow()
    svc.previewUndoNoShow.mockResolvedValue({ plan: { creditToReconsume: 0, clearFee: false, restoreDeposit: true, pending: ['CLASS_UNPAID'] } })
    await renderDetail()

    const dialogo = await tocarSiLlego()

    expect(within(dialogo).getByText('undoNoShow.rows.deposit')).toBeInTheDocument()
    expect(within(dialogo).queryByText(/undoNoShow\.rows\.credit/)).toBeNull()
    expect(within(dialogo).queryByText('undoNoShow.rows.fee')).toBeNull()
    expect(within(dialogo).getByText('undoNoShow.pendingIntro')).toBeInTheDocument()
    expect(within(dialogo).getByText('undoNoShow.pending.CLASS_UNPAID')).toBeInTheDocument()
  })

  it('con monto de multa, monto de depósito y nombre del paquete, los renglones los dicen (formato de dinero del repo)', async () => {
    mockReservation = noShow()
    svc.previewUndoNoShow.mockResolvedValue({
      plan: { creditToReconsume: 1, clearFee: true, restoreDeposit: true, pending: [], feeAmount: 50, depositAmount: 100, packName: 'Paquete 5 clases' },
    })
    await renderDetail()

    const dialogo = await tocarSiLlego()

    expect(within(dialogo).getByText('undoNoShow.rows.creditPack:{"count":1,"packName":"Paquete 5 clases"}')).toBeInTheDocument()
    expect(within(dialogo).getByText(`undoNoShow.rows.feeAmount:{"amount":"${Currency(50)}"}`)).toBeInTheDocument()
    expect(within(dialogo).getByText(`undoNoShow.rows.depositAmount:{"amount":"${Currency(100)}"}`)).toBeInTheDocument()
    // Los renglones genéricos no se repiten cuando ya hay uno con el dato.
    expect(within(dialogo).queryByText(/^undoNoShow\.rows\.credit:/)).toBeNull()
    expect(within(dialogo).queryByText('undoNoShow.rows.fee')).toBeNull()
    expect(within(dialogo).queryByText('undoNoShow.rows.deposit')).toBeNull()
  })

  it('con los datos en null (o un plan viejo que no trae las llaves) los renglones quedan genéricos', async () => {
    mockReservation = noShow()
    svc.previewUndoNoShow.mockResolvedValue({
      plan: { creditToReconsume: 2, clearFee: true, restoreDeposit: true, pending: [], feeAmount: null, depositAmount: null, packName: null },
    })
    await renderDetail()

    const dialogo = await tocarSiLlego()

    expect(within(dialogo).getByText('undoNoShow.rows.credit:{"count":2}')).toBeInTheDocument()
    expect(within(dialogo).getByText('undoNoShow.rows.fee')).toBeInTheDocument()
    expect(within(dialogo).getByText('undoNoShow.rows.deposit')).toBeInTheDocument()
  })

  it('«Cancelar» cierra sin escribir nada', async () => {
    mockReservation = noShow()
    await renderDetail()
    const dialogo = await tocarSiLlego()

    fireEvent.click(within(dialogo).getByRole('button', { name: 'cancel' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(svc.undoNoShow).not.toHaveBeenCalled()
  })

  it('«Sí, llegó» deshace, avisa «Llegada corregida», refresca las listas y deja el pendiente a la vista', async () => {
    mockReservation = noShow()
    svc.previewUndoNoShow.mockResolvedValue({ plan: { ...PLAN_LIMPIO, pending: ['CLASS_UNPAID'] } })
    svc.undoNoShow.mockImplementation(async () => {
      mockReservation = corregida()
      return { outcome: 'UNDONE', reservation: mockReservation, plan: PLAN_LIMPIO, correction: { id: 'c1', pending: ['CLASS_UNPAID'], resolvedAt: null } }
    })
    const { qc } = await renderDetail()
    const invalidar = vi.spyOn(qc, 'invalidateQueries')
    const dialogo = await tocarSiLlego()

    fireEvent.click(within(dialogo).getByRole('button', { name: 'undoNoShow.confirm' }))

    await waitFor(() => expect(svc.undoNoShow).toHaveBeenCalledWith('test-venue', 'res-test-1'))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'undoNoShow.success' })))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    for (const queryKey of [
      ['reservation', 'test-venue', 'res-test-1'],
      ['reservations', 'test-venue'],
      ['class-session', 'test-venue', 'sess-1'],
      ['class-sessions', 'test-venue'],
      ['reservation-calendar', 'test-venue'],
    ]) {
      expect(invalidar).toHaveBeenCalledWith({ queryKey })
    }
    // La reserva se vuelve a leer: ya no es un No Show y el aviso del pendiente queda visible.
    expect(await screen.findByRole('button', { name: 'undoNoShow.resolve' })).toBeInTheDocument()
    expect(screen.getByText('undoNoShow.pending.CLASS_UNPAID')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'undoNoShow.button' })).toBeNull()
  })

  it('tras deshacer con un pendiente abierto, el aviso de éxito lleva el texto del pendiente (desde la lista la fila desaparece)', async () => {
    mockReservation = noShow()
    svc.undoNoShow.mockResolvedValue({
      outcome: 'UNDONE',
      reservation: noShow(),
      plan: PLAN_LIMPIO,
      correction: { id: 'c1', pending: ['CLASS_UNPAID', 'FEE_CAPTURED'], resolvedAt: null },
    })
    await renderDetail()
    const dialogo = await tocarSiLlego()

    fireEvent.click(within(dialogo).getByRole('button', { name: 'undoNoShow.confirm' }))

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        title: 'undoNoShow.success',
        description: 'undoNoShow.pending.CLASS_UNPAID · undoNoShow.pending.FEE_CAPTURED',
      }),
    )
  })

  it('tras deshacer SIN pendientes (o con la corrección ya resuelta), el aviso de éxito no lleva descripción', async () => {
    mockReservation = noShow()
    svc.undoNoShow.mockResolvedValue({
      outcome: 'UNDONE',
      reservation: noShow(),
      plan: PLAN_LIMPIO,
      correction: { id: 'c1', pending: ['CLASS_UNPAID'], resolvedAt: '2026-03-15T15:00:00.000Z' },
    })
    await renderDetail()
    const dialogo = await tocarSiLlego()

    fireEvent.click(within(dialogo).getByRole('button', { name: 'undoNoShow.confirm' }))

    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'undoNoShow.success', description: undefined }))
  })

  it('si otra persona ya la había corregido (ALREADY_UNDONE) lo dice y no anuncia un éxito nuevo', async () => {
    mockReservation = noShow()
    svc.undoNoShow.mockResolvedValue({
      outcome: 'ALREADY_UNDONE',
      reservation: noShow(),
      plan: PLAN_LIMPIO,
      correction: { id: 'c1', pending: [], resolvedAt: null },
    })
    await renderDetail()
    const dialogo = await tocarSiLlego()

    fireEvent.click(within(dialogo).getByRole('button', { name: 'undoNoShow.confirm' }))

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'undoNoShow.alreadyUndone' })))
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'undoNoShow.success' }))
  })

  it('si el servidor rechaza el deshacer (409 NOT_APPLICABLE), sale el texto traducido —no el crudo del servidor—, el diálogo se cierra y se refresca', async () => {
    mockReservation = noShow()
    svc.undoNoShow.mockRejectedValue({ response: { status: 409, data: { code: 'NO_SHOW_UNDO_NOT_APPLICABLE', message: 'La reservacion cambio mientras se corregia' } } })
    const { qc } = await renderDetail()
    const invalidar = vi.spyOn(qc, 'invalidateQueries')
    const dialogo = await tocarSiLlego()

    fireEvent.click(within(dialogo).getByRole('button', { name: 'undoNoShow.confirm' }))

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'undoNoShow.notApplicable', variant: 'destructive' })),
    )
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ description: 'La reservacion cambio mientras se corregia' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['reservation', 'test-venue', 'res-test-1'] })
  })

  it('un código que el panel no conoce sí muestra el mensaje del servidor (último recurso)', async () => {
    mockReservation = noShow()
    svc.undoNoShow.mockRejectedValue({ response: { status: 500, data: { code: 'ALGO_NUEVO', message: 'Mensaje crudo del servidor' } } })
    await renderDetail()
    const dialogo = await tocarSiLlego()

    fireEvent.click(within(dialogo).getByRole('button', { name: 'undoNoShow.confirm' }))

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Mensaje crudo del servidor', variant: 'destructive' })))
  })

  it('una reserva de un pase (409 PASS_BOOKING en la vista previa) no abre la confirmación: dice que se corrige desde su app', async () => {
    mockReservation = noShow()
    svc.previewUndoNoShow.mockRejectedValue({
      response: { status: 409, data: { code: 'NO_SHOW_UNDO_PASS_BOOKING', message: 'Esta reserva vino de un pase (TotalPass/Wellhub); corrígela desde su app' } },
    })
    await renderDetail()

    fireEvent.click(screen.getByRole('button', { name: 'undoNoShow.button' }))

    expect(await screen.findByText('undoNoShow.passBooking')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'undoNoShow.confirm' })).toBeNull()
    expect(svc.undoNoShow).not.toHaveBeenCalled()
  })

  it('si la vista previa dice que ya no aplica (409 NOT_APPLICABLE: otra persona la corrigió), se avisa y la pantalla se vuelve a leer', async () => {
    mockReservation = noShow()
    svc.previewUndoNoShow.mockRejectedValue({
      response: { status: 409, data: { code: 'NO_SHOW_UNDO_NOT_APPLICABLE', message: 'Esta reservacion ya se corrigio una vez' } },
    })
    const { qc } = await renderDetail()
    const invalidar = vi.spyOn(qc, 'invalidateQueries')

    fireEvent.click(screen.getByRole('button', { name: 'undoNoShow.button' }))

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'undoNoShow.notApplicable', variant: 'destructive' })),
    )
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['reservation', 'test-venue', 'res-test-1'] })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('con una corrección SIN resolver muestra la franja con sus pendientes y «Marcar resuelto»; al resolver desaparece', async () => {
    mockReservation = corregida({ pending: ['CREDIT_NOT_RECONSUMED', 'FEE_CAPTURED'] })
    svc.resolveNoShowCorrection.mockImplementation(async () => {
      mockReservation = corregida({ pending: ['CREDIT_NOT_RECONSUMED', 'FEE_CAPTURED'], resolvedAt: '2026-03-15T15:00:00.000Z' })
      return { resolvedAt: '2026-03-15T15:00:00.000Z' }
    })
    const { qc } = await renderDetail()
    const invalidar = vi.spyOn(qc, 'invalidateQueries')

    expect(screen.getByText('undoNoShow.pending.CREDIT_NOT_RECONSUMED')).toBeInTheDocument()
    expect(screen.getByText('undoNoShow.pending.FEE_CAPTURED')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'undoNoShow.resolve' }))

    await waitFor(() => expect(svc.resolveNoShowCorrection).toHaveBeenCalledWith('test-venue', 'res-test-1'))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'undoNoShow.resolve' })).toBeNull())
    expect(screen.queryByText('undoNoShow.pending.FEE_CAPTURED')).toBeNull()
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'undoNoShow.resolved' }))
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['reservation', 'test-venue', 'res-test-1'] })
  })

  it('sin reservations:update la franja se ve (es información) pero «Marcar resuelto» no', async () => {
    access.allowed = ['reservations:read']
    mockReservation = corregida()
    await renderDetail()

    expect(screen.getByText('undoNoShow.pending.CLASS_UNPAID')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'undoNoShow.resolve' })).toBeNull()
  })

  it('una corrección limpia (sin pendientes) o ya resuelta no pone franja: sólo la notita «corregido»', async () => {
    mockReservation = corregida({ pending: [] })
    const limpia = await renderDetail()
    expect(screen.queryByRole('button', { name: 'undoNoShow.resolve' })).toBeNull()
    expect(screen.getByText(/^undoNoShow\.correctedNote/)).toBeInTheDocument()
    limpia.unmount()

    mockReservation = corregida({ pending: ['CLASS_UNPAID'], resolvedAt: '2026-03-15T15:00:00.000Z' })
    await renderDetail()
    expect(screen.queryByRole('button', { name: 'undoNoShow.resolve' })).toBeNull()
    expect(screen.queryByText('undoNoShow.pending.CLASS_UNPAID')).toBeNull()
  })

  it('la notita dice quién corrigió: por la persona, por el kiosco (sin nombre y source KIOSK) o sin «por» si no hay a quién nombrar', async () => {
    mockReservation = corregida({ pending: [], actorName: 'Ana' })
    const conPersona = await renderDetail()
    expect(screen.getByText('undoNoShow.correctedNote:{"date":"2026-03-15","time":"14:40","actor":"Ana"}')).toBeInTheDocument()
    conPersona.unmount()

    mockReservation = corregida({ pending: [], actorName: null, source: 'KIOSK' })
    const conKiosco = await renderDetail()
    expect(screen.getByText('undoNoShow.correctedNote:{"date":"2026-03-15","time":"14:40","actor":"undoNoShow.kiosk"}')).toBeInTheDocument()
    conKiosco.unmount()

    mockReservation = corregida({ pending: [], actorName: null, source: 'DASHBOARD' })
    await renderDetail()
    expect(screen.getByText('undoNoShow.correctedNoteNoActor:{"date":"2026-03-15","time":"14:40"}')).toBeInTheDocument()
  })

  it('una reserva que nunca se corrigió no muestra franja ni notita', async () => {
    mockReservation = createTestReservation('CONFIRMED')
    await renderDetail()

    expect(screen.queryByRole('button', { name: 'undoNoShow.resolve' })).toBeNull()
    expect(screen.queryByText(/^undoNoShow\.correctedNote/)).toBeNull()
  })

  // Doble clic (full-testing, 28-oct): el `isPending` de React llega después del segundo clic, así que `disabled` no alcanza.
  // `fireEvent.click` seguidos = el segundo clic sale antes de que React vuelva a pintar. Cada prueba también comprueba que
  // el candado se SUELTA al terminar (si no, el botón quedaría muerto tras un error).
  describe('doble clic: una sola petición', () => {
    const diferida = () => {
      let rechazar!: (error: unknown) => void
      const promesa = new Promise<never>((_resolver, reject) => {
        rechazar = reject
      })
      return { promesa, rechazar }
    }
    const ERROR_CUALQUIERA = { response: { status: 500, data: { code: 'ALGO_NUEVO', message: 'Mensaje del servidor' } } }

    it('«Sí llegó» (vista previa): dos clics seguidos piden UNA vista previa; al terminar se puede volver a pedir', async () => {
      mockReservation = noShow()
      const primera = diferida()
      svc.previewUndoNoShow.mockReturnValueOnce(primera.promesa)
      await renderDetail()
      const boton = screen.getByRole('button', { name: 'undoNoShow.button' })

      fireEvent.click(boton)
      fireEvent.click(boton)
      await waitFor(() => expect(svc.previewUndoNoShow).toHaveBeenCalledTimes(1))
      primera.rechazar(ERROR_CUALQUIERA)
      await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })))
      expect(svc.previewUndoNoShow).toHaveBeenCalledTimes(1)

      await waitFor(() => expect(screen.getByRole('button', { name: 'undoNoShow.button' })).toBeEnabled())
      await tocarSiLlego()
      expect(svc.previewUndoNoShow).toHaveBeenCalledTimes(2)
    })

    it('«Sí, llegó» (aplicar): dos clics seguidos deshacen UNA vez; al terminar se puede volver a intentar', async () => {
      mockReservation = noShow()
      const primera = diferida()
      svc.undoNoShow.mockReturnValueOnce(primera.promesa)
      await renderDetail()
      const dialogo = await tocarSiLlego()
      const confirmar = within(dialogo).getByRole('button', { name: 'undoNoShow.confirm' })

      fireEvent.click(confirmar)
      fireEvent.click(confirmar)
      await waitFor(() => expect(svc.undoNoShow).toHaveBeenCalledTimes(1))
      primera.rechazar(ERROR_CUALQUIERA)
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
      expect(svc.undoNoShow).toHaveBeenCalledTimes(1)

      // El `isPending` vuelve a React un instante después de cerrar el diálogo: se espera el botón habilitado, no el candado.
      await waitFor(() => expect(screen.getByRole('button', { name: 'undoNoShow.button' })).toBeEnabled())
      const otraVez = await tocarSiLlego()
      fireEvent.click(within(otraVez).getByRole('button', { name: 'undoNoShow.confirm' }))
      await waitFor(() => expect(svc.undoNoShow).toHaveBeenCalledTimes(2))
    })

    it('«Marcar resuelto»: dos clics seguidos resuelven UNA vez; al terminar se puede volver a intentar', async () => {
      mockReservation = corregida()
      const primera = diferida()
      svc.resolveNoShowCorrection.mockReturnValueOnce(primera.promesa)
      await renderDetail()
      const boton = screen.getByRole('button', { name: 'undoNoShow.resolve' })

      fireEvent.click(boton)
      fireEvent.click(boton)
      await waitFor(() => expect(svc.resolveNoShowCorrection).toHaveBeenCalledTimes(1))
      primera.rechazar(ERROR_CUALQUIERA)
      await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })))
      expect(svc.resolveNoShowCorrection).toHaveBeenCalledTimes(1)

      await waitFor(() => expect(screen.getByRole('button', { name: 'undoNoShow.resolve' })).toBeEnabled())
      fireEvent.click(screen.getByRole('button', { name: 'undoNoShow.resolve' }))
      await waitFor(() => expect(svc.resolveNoShowCorrection).toHaveBeenCalledTimes(2))
    })
  })
})
