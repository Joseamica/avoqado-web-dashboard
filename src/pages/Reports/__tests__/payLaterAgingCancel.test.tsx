/**
 * «Cancelar orden» en Cuentas por cobrar (Amaena, 30-oct): sólo con `orders:cancel-unpaid`, en una cuenta sin nada pagado y
 * que no es de mesa; pide el motivo y lo manda a la ruta del servidor. Un «ya estaba cancelada» (el reintento del cliente
 * HTTP) cuenta como hecho.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import reports from '@/locales/es/reports.json'
import orders from '@/locales/es/orders.json'
import PayLaterAging from '../PayLaterAging'

const m = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), toast: vi.fn(), permissions: [] as string[] }))
vi.mock('@/api', () => ({ default: { get: (...a: unknown[]) => m.get(...a), post: (...a: unknown[]) => m.post(...a) } }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => m.permissions.includes(p) }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (v: string) => v }) }))
vi.mock('react-i18next', () => ({
  useTranslation: (ns: string) => ({
    t: (key: string | string[], opts?: Record<string, unknown>) => {
      const k = Array.isArray(key) ? key[0] : String(key)
      const raw = k.split('.').reduce<any>((obj, part) => obj?.[part], ns === 'orders' ? orders : reports)
      return typeof raw === 'string' ? raw.replace(/\{\{(\w+)\}\}/g, (_, p) => String(opts?.[p] ?? '')) : k
    },
    i18n: { language: 'es' },
  }),
}))

function cuenta(datos: Partial<{ paidAmount: number; tableName: string | null }> = {}) {
  return {
    id: 'o1',
    orderNumber: 'ORD-77',
    total: 250,
    paidAmount: datos.paidAmount ?? 0,
    remainingBalance: 250 - (datos.paidAmount ?? 0),
    daysOld: 9,
    createdAt: '2026-10-21T18:00:00Z',
    tableName: datos.tableName ?? null,
    customerId: null,
    customer: { name: 'Ana', phone: null },
  }
}

function reporte(order = cuenta()) {
  return {
    data: {
      success: true,
      data: {
        summary: {
          aging_0_30_total: order.remainingBalance,
          aging_0_30_count: 1,
          aging_31_60_total: 0,
          aging_31_60_count: 0,
          aging_61_90_total: 0,
          aging_61_90_count: 0,
          aging_90_plus_total: 0,
          aging_90_plus_count: 0,
          total_balance: order.remainingBalance,
          total_count: 1,
        },
        orders: { aging_0_30: [order], aging_31_60: [], aging_61_90: [], aging_90_plus: [] },
      },
    },
  }
}

function montar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PayLaterAging />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { invalidate }
}

async function abrirMenu(user: ReturnType<typeof userEvent.setup>) {
  await screen.findAllByText('ORD-77')
  const botones = screen.getAllByRole('button').filter(b => b.getAttribute('aria-haspopup') === 'menu')
  await user.click(botones[botones.length - 1])
}

const CANCELAR = reports.payLaterAging.rowActions.cancel

beforeEach(() => {
  vi.clearAllMocks()
  m.permissions = ['orders:cancel-unpaid']
  m.get.mockResolvedValue(reporte())
  m.post.mockResolvedValue({ data: { success: true } })
})

describe('Cuentas por cobrar — Cancelar orden', () => {
  it('pide el motivo y lo manda a la ruta del servidor; la lista se refresca', async () => {
    const user = userEvent.setup()
    const { invalidate } = montar()
    await abrirMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: CANCELAR }))

    const confirmar = await screen.findByRole('button', { name: reports.payLaterAging.cancelOrder.confirm })
    expect(confirmar).toBeDisabled()
    await user.type(screen.getByLabelText(reports.payLaterAging.cancelOrder.reasonLabel), '  La abrí por error  ')
    expect(confirmar).toBeEnabled()
    await user.click(confirmar)

    await waitFor(() =>
      expect(m.post).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/orders/o1/cancel', { reason: 'La abrí por error' }),
    )
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: reports.payLaterAging.cancelOrder.successTitle })))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['pay-later-aging', 'v1'] })
  })

  it('«ya estaba cancelada» (el reintento) cuenta como hecho, no como error', async () => {
    m.post.mockRejectedValue({ response: { status: 409, data: { code: 'ORDER_ALREADY_CANCELLED', message: 'Esta cuenta ya estaba cancelada.' } } })
    const user = userEvent.setup()
    montar()
    await abrirMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: CANCELAR }))
    await user.type(screen.getByLabelText(reports.payLaterAging.cancelOrder.reasonLabel), 'duplicada')
    await user.click(screen.getByRole('button', { name: reports.payLaterAging.cancelOrder.confirm }))

    await waitFor(() => expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: reports.payLaterAging.cancelOrder.alreadyTitle })))
    expect(m.toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
  })

  it('el rechazo del servidor (tiene pagos) se lee tal cual', async () => {
    m.post.mockRejectedValue({ response: { status: 400, data: { message: 'Esta cuenta tiene pagos registrados. Reembólsalos antes de cancelarla.' } } })
    const user = userEvent.setup()
    montar()
    await abrirMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: CANCELAR }))
    await user.type(screen.getByLabelText(reports.payLaterAging.cancelOrder.reasonLabel), 'error')
    await user.click(screen.getByRole('button', { name: reports.payLaterAging.cancelOrder.confirm }))

    await waitFor(() =>
      expect(m.toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive', title: reports.payLaterAging.cancelOrder.errorTitle }),
      ),
    )
  })

  it.each([
    ['sin el permiso', () => (m.permissions = [])],
    ['con un abono', () => m.get.mockResolvedValue(reporte(cuenta({ paidAmount: 50 })))],
    ['de mesa', () => m.get.mockResolvedValue(reporte(cuenta({ tableName: '7' })))],
  ])('%s no aparece «Cancelar orden»', async (_caso, preparar) => {
    preparar()
    const user = userEvent.setup()
    montar()
    await abrirMenu(user)
    await screen.findByRole('menuitem', { name: reports.payLaterAging.rowActions.settle })
    expect(screen.queryByRole('menuitem', { name: CANCELAR })).toBeNull()
  })
})
