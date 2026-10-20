// Full-testing v2 · FAIL #2 (R3): un turno de sólo tarjetas de regalo tiene 0 órdenes de venta. El API ya decía
// `stats.totalOrders: 0`, pero el respaldo `stats.totalOrders || orders.length` lo tomaba como «no vino» y pintaba «1 Órdenes».
// 0 es un número válido: sólo se cae a la lista cuando el server no lo manda.
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ turno: {} as Record<string, unknown> }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }),
}))
vi.mock('@/api', () => ({ default: { get: () => Promise.resolve({ data: m.turno }) } }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => false }) }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', venue: { timezone: 'America/Mexico_City' } }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))
vi.mock('@/context/BreadcrumbContext', () => ({ useBreadcrumb: () => ({ setCustomSegment: () => {}, clearCustomSegment: () => {} }) }))
vi.mock('@/hooks/use-shift-socket-events', () => ({ useShiftSocketEvents: () => {} }))
vi.mock('@/hooks/use-payment-socket-events', () => ({ usePaymentSocketEvents: () => {} }))
vi.mock('./components/CashReconciliationSummary', () => ({ CashReconciliationSummary: () => null }))
vi.mock('./components/ShiftCashDrawerCard', () => ({ ShiftCashDrawerCard: () => null }))

import ShiftId from './ShiftId'

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/venues/demo/shifts/s1']}>
        <Routes>
          <Route path="/venues/:slug/shifts/:shiftId" element={<ShiftId />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** El número de la caja «Órdenes» de la barra de arriba (va justo antes de su etiqueta). */
async function ordenesDeLaBarra() {
  const etiqueta = await screen.findByText('detail.stats.orders')
  return etiqueta.previousElementSibling?.textContent
}

describe('ShiftId · barra de arriba', () => {
  it('🔴 un turno de sólo tarjetas: el API dice 0 órdenes y se pinta 0, aunque la lista traiga la cuenta de tarjetas', async () => {
    m.turno = {
      id: 's1',
      turnId: 7,
      status: 'CLOSED',
      totalSales: 0,
      totalTips: 0,
      stats: { totalPayments: 1, totalOrders: 0, totalProducts: 0, avgOrderValue: 0 },
      payments: [],
      // Un server anterior al arreglo mandaba la cuenta de tarjetas en la lista: el conteo del server manda.
      orders: [
        { id: 'o1', orderNumber: 'GC-1', total: 800, subtotal: 800, items: [], itemsCount: 1, createdAt: '2026-10-19T15:00:00.000Z' },
      ],
      topProducts: [],
      staffBreakdown: [],
      paymentMethodBreakdown: [],
      cardBrandBreakdown: [],
    }
    pintar()
    expect(await ordenesDeLaBarra()).toBe('0')
  })

  it('sin `stats.totalOrders` (server viejo) se cuenta la lista', async () => {
    m.turno = {
      id: 's1',
      turnId: 7,
      status: 'CLOSED',
      totalSales: 150,
      totalTips: 0,
      stats: {},
      payments: [],
      orders: [
        { id: 'o1', orderNumber: 'A-1', total: 150, subtotal: 150, items: [], itemsCount: 1, createdAt: '2026-10-19T15:00:00.000Z' },
      ],
      topProducts: [],
      staffBreakdown: [],
      paymentMethodBreakdown: [],
      cardBrandBreakdown: [],
    }
    pintar()
    expect(await ordenesDeLaBarra()).toBe('1')
  })
})
