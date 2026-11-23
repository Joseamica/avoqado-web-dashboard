/**
 * D679 · Las pantallas de compras y movimientos con un Ilimitado (Inventario 1, N16, N17 y N19). Por dentro el saldo es 99,999:
 * ninguna enseña ese número, una compra reembolsada no dice «usó», y un Ilimitado no se ajusta.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CreditPackPurchase, CreditTransaction } from '@/types/creditPack'

const estables = vi.hoisted(() => ({
  i18n: {
    t: (k: string, o?: Record<string, unknown> | string) =>
      typeof o === 'object' ? [k, ...Object.entries(o).flatMap(([c, v]) => (c === 'defaultValue' ? [] : [String(v)]))].join(':') : k,
    i18n: { language: 'es' },
  },
}))
const paquetes = vi.hoisted(() => ({
  getPurchases: vi.fn(),
  getTransactions: vi.fn(),
  redeemItem: vi.fn(),
  adjustBalance: vi.fn(),
  refundPurchase: vi.fn(),
}))

vi.mock('react-i18next', () => ({ useTranslation: () => estables.i18n }))
vi.mock('@/services/creditPack.service', () => ({ default: paquetes }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (d: string) => `F(${d})` }) }))

import CreditPackPurchasesTab from '../CreditPackPurchases'
import CreditPackTransactionsTab from '../CreditPackTransactions'

const VENCE = '2026-12-22T06:00:00.000Z'
const NUMERO_POR_DENTRO = /99999|99,999|99998|99997|99996/

const compra = (over: Partial<CreditPackPurchase>): CreditPackPurchase => ({
  id: 'c1',
  venueId: 'v1',
  customerId: 'cu1',
  customer: { id: 'cu1', firstName: 'Ana', lastName: 'López' },
  creditPackId: 'pk1',
  creditPack: { name: 'Ilimitado mensual' },
  purchasedAt: '2026-11-22T06:00:00.000Z',
  expiresAt: VENCE,
  status: 'ACTIVE',
  amountPaid: 2500,
  itemBalances: [],
  createdAt: '2026-11-22T06:00:00.000Z',
  ...over,
})

function pintar(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  paquetes.getPurchases.mockResolvedValue({
    data: [
      compra({
        id: 'activa',
        itemBalances: [
          {
            id: 'b-ilim',
            productId: 'p1',
            product: { id: 'p1', name: 'Lagree', type: 'CLASS' },
            originalQuantity: 99999,
            remainingQuantity: 99996,
            unlimited: true,
          },
          { id: 'b-shake', productId: 'p2', product: { id: 'p2', name: 'Shake', type: 'FOOD' }, originalQuantity: 5, remainingQuantity: 3 },
        ],
        faltas: { noLlego: 1, cancelTarde: 2 },
      }),
      compra({
        id: 'reembolsada',
        status: 'REFUNDED',
        customer: { id: 'cu2', firstName: 'Bea' },
        itemBalances: [
          {
            id: 'b-ilim-2',
            productId: 'p1',
            product: { id: 'p1', name: 'Lagree', type: 'CLASS' },
            originalQuantity: 99999,
            remainingQuantity: 0,
            unlimited: true,
          },
        ],
        faltas: { noLlego: 0, cancelTarde: 0 },
      }),
    ],
    meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
  })
})

describe('Compras con un Ilimitado (N16, N17)', () => {
  async function abrirLasDos() {
    const vista = pintar(<CreditPackPurchasesTab />)
    await screen.findByText('Ana López')
    const filas = screen.getAllByRole('row').slice(1)
    for (const fila of filas) fireEvent.click(within(fila).getAllByRole('button')[0])
    await screen.findByText('unlimited.refunded')
    return vista
  }

  it('dice «Ilimitado · vence el … · usó 3», «Ilimitado · reembolsado» y las faltas; nunca 99,999', async () => {
    const { container } = await abrirLasDos()
    expect(screen.getByText(`unlimited.active:F(${VENCE}):3`)).toBeInTheDocument()
    expect(screen.getByText('unlimited.refunded')).toBeInTheDocument()
    expect(screen.getByText('unlimited.faltas:1:2')).toBeInTheDocument()
    // El saldo normal del mismo paquete sigue como hoy.
    expect(screen.getByText('purchases.remaining:3:5')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(NUMERO_POR_DENTRO)
    expect(container.textContent).not.toMatch(/unlimited\.active:[^ ]*:99/)
  })

  it('un Ilimitado no tiene «Ajustar»; el saldo normal sí', async () => {
    await abrirLasDos()
    expect(screen.getAllByRole('button', { name: /actions\.redeem/ })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /actions\.adjust/ })).toHaveLength(1)
  })

  it('el diálogo de canje dice «Ilimitado · vence el …» sin máximo ni restante', async () => {
    await abrirLasDos()
    fireEvent.click(screen.getAllByRole('button', { name: /actions\.redeem/ })[0])
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText(`unlimited.expiresOn:F(${VENCE})`)).toBeInTheDocument()
    expect(within(dialogo).queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(dialogo.textContent).not.toMatch(NUMERO_POR_DENTRO)
  })
})

describe('Movimientos de un Ilimitado (N19)', () => {
  it('la compra dice «Ilimitado», la anulación «Ilimitado anulado» y el canje −1 como hoy', async () => {
    const ilimitado = { unlimited: true, product: { id: 'p1', name: 'Lagree' } }
    const mov = (over: Partial<CreditTransaction>): CreditTransaction => ({
      id: over.id ?? 't',
      venueId: 'v1',
      customerId: 'cu1',
      customer: { firstName: 'Ana' },
      type: 'REDEEM',
      quantity: -1,
      creditItemBalance: ilimitado,
      createdAt: '2026-11-22T10:00:00.000Z',
      ...over,
    })
    paquetes.getTransactions.mockResolvedValue({
      data: [
        mov({ id: 't1', type: 'PURCHASE', quantity: 99999 }),
        mov({ id: 't2', type: 'REDEEM', quantity: -1 }),
        mov({ id: 't3', type: 'REFUND', quantity: -99998, reason: 'Reembolso' }),
      ],
      meta: { page: 1, limit: 20, total: 3, totalPages: 1 },
    })
    const { container } = pintar(<CreditPackTransactionsTab />)
    expect(await screen.findByText('unlimited.label')).toBeInTheDocument()
    expect(screen.getByText('unlimited.voided')).toBeInTheDocument()
    expect(screen.getByText('-1')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(NUMERO_POR_DENTRO)
  })
})
