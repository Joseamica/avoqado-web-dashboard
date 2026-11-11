/**
 * Tienda híbrida, parte 2 (D1): la tarjeta del pedido y la del folio dicen de qué clienta son («Con cuenta: Ana L.») y qué beneficios
 * trae la cuenta, en verde. Se prueba con las cadenas REALES de `onlineOrdering.json` (es y en). Un SERVIDOR viejo no manda `cliente`
 * ni `beneficios`: ahí no se enseña nada y nada truena.
 */
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18next from 'i18next'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import enOnline from '@/locales/en/onlineOrdering.json'
import esOnline from '@/locales/es/onlineOrdering.json'
import type { FolioOrder, InboxOrder } from '@/types/onlineOrdering'

vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatTime: (d: string) => `T(${d})` }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))
const getSettings = vi.fn()
const getToPay = vi.fn()
vi.mock('@/services/onlineOrdering.service', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/onlineOrdering.service')>()
  return { ...actual, getSettings: (...a: unknown[]) => getSettings(...a), getToPay: (...a: unknown[]) => getToPay(...a) }
})

import { FolioSections } from '../components/FolioSections'
import { OrderCard } from '../components/OrderCard'

const i18n = i18next.createInstance()
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'es',
    fallbackLng: false,
    ns: ['onlineOrdering'],
    defaultNS: 'onlineOrdering',
    resources: { es: { onlineOrdering: esOnline }, en: { onlineOrdering: enOnline } },
    interpolation: { escapeValue: false },
  })
})
beforeEach(async () => {
  await i18n.changeLanguage('es')
})

const order = (over: Partial<FolioOrder> = {}): FolioOrder => ({
  orderId: 'o1',
  onlineOrderId: 'oo1',
  orderNumber: '101',
  status: 'ACCEPTED',
  paymentMode: 'PAY_AT_PICKUP',
  customerName: 'Ana López',
  customerPhone: null,
  note: null,
  createdAt: '2026-11-10T18:00:00.000Z',
  acceptDeadlineAt: '2026-11-10T18:30:00.000Z',
  estimatedReadyAt: null,
  total: 69,
  remaining: 69,
  paymentStatus: 'PENDING',
  needsPrint: false,
  items: [
    { name: 'Latte', quantity: 1, note: null, modifiers: [] },
    { name: 'Shake', quantity: 1, note: null, modifiers: [] },
  ],
  ...over,
})
const conCuenta: Partial<InboxOrder> = {
  cliente: { id: 'c1', nombre: 'Ana L.' },
  beneficios: [{ nombre: 'Premio de sellos', monto: 45 }],
  beneficiosTotal: 1,
}

const card = (o: InboxOrder) =>
  render(
    <I18nextProvider i18n={i18n}>
      <OrderCard order={o} skewMs={0} canAnswer canCancel busy={false} onAction={() => {}} />
    </I18nextProvider>,
  )

/** El renglón de un beneficio: nombre y monto, como lo lee la persona. */
const renglones = () =>
  within(screen.getByTestId('beneficios'))
    .getAllByRole('listitem')
    .map(li => li.textContent)

describe('OrderCard: de quién es y qué beneficio lleva', () => {
  it('con cliente y beneficios muestra «Con cuenta: Ana L.» y «Premio de sellos −$45.00» en verde (token, sin colores fijos)', () => {
    card(order(conCuenta))
    expect(screen.getByText('Con cuenta: Ana L.')).toBeInTheDocument()
    expect(renglones()).toEqual(['Premio de sellos −$45.00'])
    const caja = screen.getByTestId('beneficios')
    expect(caja.className).toMatch(/--success/)
    expect(caja.className).not.toMatch(/emerald|green-|lime-/)
  })

  it('sin los campos (SERVIDOR viejo) no muestra nada y no truena', () => {
    card(order())
    expect(screen.queryByText(/Con cuenta/)).toBeNull()
    expect(screen.queryByTestId('beneficios')).toBeNull()
    expect(screen.getByText('$69.00')).toBeInTheDocument()
  })

  it('R2: de la ficha sólo sale el nombre corto; el teléfono escrito en el pedido se ve como antes de D1 (no viene de la ficha)', () => {
    card(order({ ...conCuenta, customerPhone: '+525512345678' }))
    expect(screen.getByText('Con cuenta: Ana L.').textContent).toBe('Con cuenta: Ana L.')
    expect(screen.getAllByText('+525512345678')).toHaveLength(1)
  })

  it('cliente null y lista vacía tampoco enseñan nada', () => {
    card(order({ cliente: null, beneficios: [], beneficiosTotal: 0 }))
    expect(screen.queryByText(/Con cuenta/)).toBeNull()
    expect(screen.queryByTestId('beneficios')).toBeNull()
  })

  it('beneficios sin cuenta (descuento del catálogo) sí se desglosan; la cuenta sin beneficios sólo dice de quién es', () => {
    const { unmount } = card(order({ beneficios: [{ nombre: '2x1 martes', monto: 30.5 }], beneficiosTotal: 1 }))
    expect(screen.queryByText(/Con cuenta/)).toBeNull()
    expect(renglones()).toEqual(['2x1 martes −$30.50'])
    unmount()
    card(order({ cliente: { id: 'c1', nombre: 'Ana L.' }, beneficios: [], beneficiosTotal: 0 }))
    expect(screen.getByText('Con cuenta: Ana L.')).toBeInTheDocument()
    expect(screen.queryByTestId('beneficios')).toBeNull()
  })

  it('R1: si la cuenta trae más de los que se publican, dice «y N más» (nunca los esconde)', () => {
    const diez = Array.from({ length: 10 }, (_, i) => ({ nombre: `Cupón ${i + 1}`, monto: 1 }))
    card(order({ beneficios: diez, beneficiosTotal: 12 }))
    expect(renglones()).toHaveLength(10)
    expect(within(screen.getByTestId('beneficios')).getByText('y 2 más')).toBeInTheDocument()
  })

  it('un folio de «Nadie» se nombra «Folio W7K3P»; un pedido de «Mi equipo» sigue con «#101»', () => {
    const { unmount } = card(order({ orderNumber: 'W7K3P', requiresAcceptance: false }))
    expect(screen.getByText('Folio W7K3P')).toBeInTheDocument()
    expect(screen.queryByText('#W7K3P')).toBeNull()
    unmount()
    card(order({ requiresAcceptance: true }))
    expect(screen.getByText('#101')).toBeInTheDocument()
  })

  it('en inglés', async () => {
    await i18n.changeLanguage('en')
    card(order({ ...conCuenta, beneficios: [{ nombre: 'Stamp reward', monto: 45 }], beneficiosTotal: 3 }))
    expect(screen.getByText('Customer account: Ana L.')).toBeInTheDocument()
    expect(renglones()).toEqual(['Stamp reward −$45.00'])
    expect(screen.getByText('and 2 more')).toBeInTheDocument()
  })
})

describe('FolioSections: «Por pagar» y «Por entregar» dicen lo mismo', () => {
  const toPay = (pagar: FolioOrder[], entregar: FolioOrder[]) => ({
    serverTime: '2026-11-10T18:05:00.000Z',
    enabled: true,
    requiresAcceptance: false,
    showTile: true,
    pollSeconds: 10,
    counts: { toPay: pagar.length, toDeliver: entregar.length },
    toPay: pagar,
    toDeliver: entregar,
    nextCursors: { toPay: null, toDeliver: null },
    store: null,
  })
  const folios = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <I18nextProvider i18n={i18n}>
          <FolioSections venueId="v1" canAnswer canCancel busy={false} hidden={new Map()} onAct={() => {}} />
        </I18nextProvider>
      </QueryClientProvider>,
    )

  it('cada tarjeta de folio trae «Con cuenta» y su desglose; la que no tiene cuenta, nada', async () => {
    getSettings.mockResolvedValue({ requiresAcceptance: false })
    getToPay.mockResolvedValue(
      toPay(
        [order({ orderId: 'f1', orderNumber: 'W7K3P', requiresAcceptance: false, ...conCuenta })],
        [
          order({
            orderId: 'f2',
            orderNumber: 'W8M2C',
            requiresAcceptance: false,
            status: 'ACCEPTED',
            paymentStatus: 'PAID',
            remaining: 0,
          }),
        ],
      ),
    )
    folios()
    const f1 = await screen.findByTestId('folio-f1')
    expect(within(f1).getByText('Con cuenta: Ana L.')).toBeInTheDocument()
    expect(within(within(f1).getByTestId('beneficios')).getByRole('listitem').textContent).toBe('Premio de sellos −$45.00')
    const f2 = screen.getByTestId('folio-f2')
    expect(within(f2).queryByText(/Con cuenta/)).toBeNull()
    expect(within(f2).queryByTestId('beneficios')).toBeNull()
  })
})
