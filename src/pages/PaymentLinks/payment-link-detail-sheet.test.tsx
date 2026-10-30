import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PaymentLink } from '@/services/paymentLink.service'
import { PaymentLinkDetailSheet } from './PaymentLinkDetailSheet'

// Al entrar a una liga se ve su estado («Pagada» si es de un solo uso y ya se cobró) y sus pagos, cada uno con «Ver recibo»
// (lleva al detalle del pago, donde vive su recibo). Founder, 28-oct.
const mocks = vi.hoisted(() => ({ get: vi.fn(), navigate: vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts && 'shown' in opts ? `${key}:${opts.shown}/${opts.total}` : key),
    i18n: { language: 'es' },
  }),
}))
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'venue-a', fullBasePath: '/venues/a' }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDateTime: (iso: string) => `fecha:${iso}` }) }))
vi.mock('@/services/paymentLink.service', () => ({ default: { getPaymentLink: mocks.get } }))

const liga = (o: Partial<PaymentLink> = {}) =>
  ({
    id: 'l1',
    shortCode: 'ABC',
    title: 'Anticipo boda',
    amountType: 'FIXED',
    amount: 500,
    currency: 'MXN',
    status: 'ACTIVE',
    isReusable: false,
    paymentCount: 1,
    totalCollected: 500,
    lastPaidAt: '2026-10-27T18:05:00.000Z',
    ...o,
  }) as PaymentLink

const pintar = (link: PaymentLink, onEdit = vi.fn()) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PaymentLinkDetailSheet link={link} open onOpenChange={vi.fn()} onEdit={onEdit} onCopy={vi.fn()} />
    </QueryClientProvider>,
  )

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('detalle de una liga', () => {
  it('de un solo uso ya cobrada dice «Pagada» y su pago lleva al recibo', async () => {
    mocks.get.mockResolvedValue({
      data: {
        ...liga(),
        completedPayments: [{ id: 'cs1', amount: 500, completedAt: '2026-10-27T18:05:00.000Z', paymentId: 'pay-1' }],
        completedPaymentsTotal: 1,
      },
    })
    pintar(liga())

    expect(screen.getByText('status.used')).toBeInTheDocument()
    const verRecibo = await screen.findByRole('button', { name: 'detail.viewReceipt' })
    // La fecha sale dos veces: en «Pagada el» y en el renglón del pago.
    expect(screen.getAllByText('fecha:2026-10-27T18:05:00.000Z')).toHaveLength(2)
    fireEvent.click(verRecibo)
    expect(mocks.navigate).toHaveBeenCalledWith('/venues/a/payments/pay-1')
  })

  it('una liga activa sin pagos lo dice y deja editar', async () => {
    mocks.get.mockResolvedValue({ data: { ...liga(), completedPayments: [], completedPaymentsTotal: 0 } })
    const onEdit = vi.fn()
    pintar(liga({ paymentCount: 0, totalCollected: 0, lastPaidAt: null }), onEdit)

    expect(screen.getByText('status.active')).toBeInTheDocument()
    expect(await screen.findByText('detail.noPayments')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'detail.edit' }))
    expect(onEdit).toHaveBeenCalledWith('l1')
  })

  it('con más pagos que los que se muestran avisa cuántos son', async () => {
    const pagos = Array.from({ length: 50 }, (_, i) => ({
      id: `cs${i}`,
      amount: 100,
      completedAt: '2026-10-28T20:40:00.000Z',
      paymentId: `pay-${i}`,
    }))
    mocks.get.mockResolvedValue({ data: { ...liga({ isReusable: true }), completedPayments: pagos, completedPaymentsTotal: 57 } })
    pintar(liga({ isReusable: true, paymentCount: 57 }))

    expect(await screen.findByText('detail.shownOf:50/57')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'detail.viewReceipt' })).toHaveLength(50)
  })

  it('una archivada muestra su estado y su pago, pero no se puede editar', async () => {
    mocks.get.mockResolvedValue({
      data: {
        ...liga({ status: 'ARCHIVED' }),
        completedPayments: [{ id: 'cs1', amount: 500, completedAt: '2026-10-27T18:05:00.000Z', paymentId: 'pay-1' }],
        completedPaymentsTotal: 1,
      },
    })
    pintar(liga({ status: 'ARCHIVED' }))

    expect(screen.getByText('status.archived')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'detail.viewReceipt' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'detail.edit' })).not.toBeInTheDocument()
  })

  it('si no cargan los pagos lo dice y deja reintentar', async () => {
    mocks.get
      .mockRejectedValueOnce(new Error('red'))
      .mockResolvedValue({ data: { ...liga(), completedPayments: [], completedPaymentsTotal: 0 } })
    pintar(liga())

    fireEvent.click(await screen.findByRole('button', { name: 'detail.retry' }))
    expect(await screen.findByText('detail.noPayments')).toBeInTheDocument()
  })
})
