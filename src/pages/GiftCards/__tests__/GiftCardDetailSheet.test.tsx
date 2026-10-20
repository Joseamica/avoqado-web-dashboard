import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GiftCardDetail } from '@/types/giftCard'

const q = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('@/hooks/use-gift-cards', () => ({ useGiftCardDetail: () => q.current }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/demo' }) }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ formatDateTime: (d: string) => `fecha ${d}`, formatDate: (d: string) => `día ${d}` }),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o?.last4 ? `${k} ${String(o.last4)}` : k) }),
}))
vi.mock('../components/GiftCardManagerActions', () => ({ GiftCardManagerActions: () => <div data-testid="acciones" /> }))

import { Currency } from '@/utils/currency'
import { GiftCardDetailSheet } from '../components/GiftCardDetailSheet'

/** El detalle de C4 TAL CUAL (F3): plano, con `cancel` y `currentBlock` del server. */
const DETAIL: GiftCardDetail = {
  id: 'g1', last4: '4821', status: 'ACTIVE', initialAmount: 1500, balance: 1200, createdAt: '2026-10-10T18:00:00.000Z',
  activatedAt: '2026-10-10T18:01:00.000Z', expiresAt: null, deliveryChannel: 'WHATSAPP', deliveryStatus: 'SENT',
  recipientName: 'Ana López', purchaserName: 'Luis Pérez', source: 'POS', customer: null, order: { id: 'o1', orderNumber: 'A-1042' },
  validityMonths: null, termsVersion: '2026-10-14', message: null, recipientPhone: null, recipientEmail: null, purchaserContact: null,
  deliveredAt: null, deactivatedAt: null, hasRedeem: true, canReplaceCode: false,
  // Nota 13 del coordinador: `cancel` trae `message` (el texto del server cuando no se puede cancelar).
  cancel: { allowed: false, reason: 'ALREADY_USED', message: 'No se puede cancelar: una tarjeta de esta venta ya se usó.' },
  currentBlock: null,
  activities: {
    items: [
      { id: 'a3', type: 'BLOCK', amount: 0, balanceAfter: 1200, reason: 'SUSPICIOUS_ACTIVITY', note: 'Dos intentos raros', staff: { id: 's9', name: 'Gerente' }, paymentId: null, refundPaymentId: null, orderId: null, createdAt: '2026-10-12T10:00:00.000Z' },
      { id: 'a2', type: 'REDEEM', amount: 300, balanceAfter: 1200, reason: null, note: null, staff: { id: 's1', name: 'Caja 1' }, paymentId: 'p9', refundPaymentId: null, orderId: 'o9', createdAt: '2026-10-11T12:00:00.000Z' },
      { id: 'a1', type: 'ACTIVATE', amount: 1500, balanceAfter: 1500, reason: null, note: null, staff: { id: 's1', name: 'Caja 1' }, paymentId: null, refundPaymentId: null, orderId: 'o1', createdAt: '2026-10-10T18:01:00.000Z' },
    ],
    nextCursor: 'c-2',
    total: 40,
  },
}
const listo = (over: Record<string, unknown> = {}) => ({
  data: { pages: [DETAIL], pageParams: [null] },
  isLoading: false,
  isError: false,
  hasNextPage: true,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
  refetch: vi.fn(),
  ...over,
})
const pintar = () =>
  render(
    <MemoryRouter>
      <GiftCardDetailSheet venueId="v1" giftCardId="g1" onClose={vi.fn()} />
    </MemoryRouter>,
  )

beforeEach(() => {
  q.current = listo()
})

describe('GiftCardDetailSheet', () => {
  it('enseña los últimos 4 (nunca el código), el saldo y la libreta con su signo', () => {
    pintar()
    expect(screen.getByTestId('acciones')).toBeInTheDocument()
    expect(screen.getByText('detail.title •••• 4821')).toBeInTheDocument()
    expect(screen.getByText(Currency(1200))).toBeInTheDocument()
    expect(screen.getByText('activity.BLOCK')).toBeInTheDocument()
    expect(screen.getByText('reason.SUSPICIOUS_ACTIVITY')).toBeInTheDocument()
    expect(screen.getByText(`−${Currency(300)}`)).toBeInTheDocument()
    // un bloqueo no mueve dinero
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toMatch(/[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}/)
  })

  it('el folio de la venta lleva a la venta; en la libreta, sólo el renglón de ESA venta dice su folio', () => {
    pintar()
    expect(screen.getByRole('link', { name: 'A-1042' })).toHaveAttribute('href', '/venues/demo/orders/o1')
    expect(screen.getByText('detail.inOrder')).toBeInTheDocument()
  })

  it('🔴 bloqueada: el motivo sale de `currentBlock` del server aunque el BLOCK no venga en la primera página (auditoría r1, D-2)', () => {
    const bloqueada: GiftCardDetail = {
      ...DETAIL,
      status: 'BLOCKED',
      currentBlock: { reason: 'LOST_CARD', note: null, at: '2026-09-01T10:00:00.000Z' },
      // 25 ajustes después del bloqueo: la primera página de la libreta ya no trae el BLOCK.
      activities: { items: [DETAIL.activities.items[1]], nextCursor: 'c-2', total: 40 },
    }
    q.current = listo({ data: { pages: [bloqueada], pageParams: [null] } })
    pintar()
    expect(screen.getByText('detail.blockedBecause')).toBeInTheDocument()
  })

  it('«Ver más movimientos» pide la siguiente página de la libreta', () => {
    const fetchNextPage = vi.fn()
    q.current = listo({ fetchNextPage })
    pintar()
    fireEvent.click(screen.getByRole('button', { name: 'detail.loadMore' }))
    expect(fetchNextPage).toHaveBeenCalled()
  })

  it('un error sin datos se dice con «Reintentar» (nunca una tarjeta en blanco)', () => {
    const refetch = vi.fn()
    q.current = { data: undefined, isLoading: false, isError: true, error: { response: { data: { message: 'Se cayó' } } }, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch }
    pintar()
    expect(screen.getByText('detail.loadError')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'detail.retry' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('notas 10 y 12: un error SIN `code` (un 401/500 en inglés) enseña el texto genérico, nunca el `message` crudo', () => {
    q.current = { data: undefined, isLoading: false, isError: true, error: { response: { status: 500, data: { message: 'Internal server error' } } }, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn() }
    pintar()
    expect(screen.getByText('errors.generic')).toBeInTheDocument()
    expect(screen.queryByText('Internal server error')).not.toBeInTheDocument()
  })

  it('con datos ya cargados, una relectura fallida NO tapa la tarjeta: se queda y avisa en línea', () => {
    q.current = listo({ isError: true, error: { response: { status: 500, data: {} } } })
    pintar()
    expect(screen.getByText(Currency(1200))).toBeInTheDocument()
    expect(screen.queryByText('detail.loadError')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('detail.loadMoreError')
  })

  it('🔴 en la 1a ningún canal pinta estado de envío (todo nace PENDING y nada lo mueve): sólo el canal (lote ⭐ r1)', () => {
    for (const canal of ['WHATSAPP', 'EMAIL', 'PRINTED', 'CUSTOMER_CARD', 'HANDED_TO_BUYER'] as const) {
      q.current = listo({ data: { pages: [{ ...DETAIL, deliveryChannel: canal, deliveryStatus: 'PENDING' }], pageParams: [null] } })
      const { unmount } = pintar()
      expect(screen.getByText(`delivery.${canal}`)).toBeInTheDocument()
      expect(screen.queryByText('detail.facts.deliveryValue')).not.toBeInTheDocument()
      expect(screen.queryByText(/^deliveryStatus\./)).not.toBeInTheDocument()
      unmount()
    }
  })

  it('full-testing v2 #6: la nota del historial parte las palabras largas (500 letras sin espacios no desbordan la hoja)', () => {
    pintar()
    // El renglón ya tiene `min-w-0`; sin `break-words`, una palabra de 500 letras empuja la hoja hacia la derecha a 375 px.
    expect(screen.getByText('detail.note')).toHaveClass('break-words')
  })
})
