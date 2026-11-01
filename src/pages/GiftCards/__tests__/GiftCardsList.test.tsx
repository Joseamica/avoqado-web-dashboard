import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GiftCardListPage, GiftCardRow } from '@/types/giftCard'

const q = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('@/hooks/use-gift-cards', () => ({ GIFT_CARDS_PAGE_SIZE: 50, useGiftCardList: () => q.current }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (d: string) => d }) }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: unknown) =>
      o && typeof o === 'object'
        ? `${k}(${Object.entries(o)
            .map(([a, b]) => `${a}=${String(b)}`)
            .join(',')})`
        : k,
  }),
}))
vi.mock('../components/GiftCardDetailSheet', () => ({ GiftCardDetailSheet: () => null }))

import { GiftCardsList } from '../components/GiftCardsList'

const FILA: GiftCardRow = {
  id: 'g1',
  last4: '4821',
  status: 'ACTIVE',
  initialAmount: 1500,
  balance: 1200,
  createdAt: '2026-10-10T18:00:00.000Z',
  activatedAt: '2026-10-10T18:01:00.000Z',
  expiresAt: null,
  deliveryChannel: 'WHATSAPP',
  deliveryStatus: 'PENDING',
  recipientName: 'Ana',
  purchaserName: 'Luis',
  source: 'POS',
  customer: null,
  order: { id: 'o1', orderNumber: 'A-1042' },
}
const PAGINA: GiftCardListPage = { items: [FILA], page: 1, pageSize: 50, total: 60, totalBalance: 70000 }
const consulta = (over: Record<string, unknown> = {}) => ({
  data: undefined,
  isLoading: false,
  isError: false,
  error: null,
  isPlaceholderData: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  isFetching: false,
  fetchNextPage: vi.fn(),
  refetch: vi.fn(),
  ...over,
})

beforeEach(() => {
  q.current = consulta()
})

describe('GiftCardsList · saldo a favor', () => {
  it('un sobre de saldo a favor dice «Saldo a favor de {cliente}»; una tarjeta normal o un server viejo, nada', () => {
    q.current = consulta({
      data: { pages: [{ ...PAGINA, items: [{ ...FILA, storeCredit: { customerId: 'c1', customerName: 'Ana López' } }] }], pageParams: [1] },
    })
    const a = render(<GiftCardsList venueId="v1" />)
    expect(screen.getByText('list.storeCreditOf(name=Ana López)')).toBeInTheDocument()
    // D-2: ni «de {carga inicial}»
    expect(screen.queryByText(/list\.balanceOf/)).toBeNull()
    a.unmount()
    q.current = consulta({ data: { pages: [{ ...PAGINA, items: [{ ...FILA, storeCredit: null }, { ...FILA, id: 'g2' }] }], pageParams: [1] } })
    render(<GiftCardsList venueId="v1" />)
    expect(screen.queryByText(/list\.storeCreditOf/)).toBeNull()
  })
})

describe('GiftCardsList · pie de la lista (lote ⭐)', () => {
  it('en la primera carga no sale «Mostrando 0 de 0» debajo del esqueleto', () => {
    q.current = consulta({ isLoading: true, isFetching: true })
    render(<GiftCardsList venueId="v1" />)
    expect(screen.queryByText(/^list\.showing/)).not.toBeInTheDocument()
  })

  it('con filas, el pie dice cuántas de cuántas', () => {
    q.current = consulta({ data: { pages: [PAGINA], pageParams: [1] }, hasNextPage: true })
    render(<GiftCardsList venueId="v1" />)
    expect(screen.getByText('list.showing(shown=1,total=60)')).toBeInTheDocument()
  })

  it('🔴 «Cargar más» enseña un spinner y se apaga mientras trae la página siguiente', () => {
    q.current = consulta({ data: { pages: [PAGINA], pageParams: [1] }, hasNextPage: true, isFetchingNextPage: true, isFetching: true })
    render(<GiftCardsList venueId="v1" />)
    const boton = screen.getByRole('button', { name: 'list.loadMore' })
    expect(boton).toBeDisabled()
    expect(boton.querySelector('.animate-spin')).not.toBeNull()
  })
})
