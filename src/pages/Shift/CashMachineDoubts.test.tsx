// Máquina de efectivo · fase 1a · B2 (R4-4): «Cobros de la máquina en duda». Lista acotada del SERVIDOR (≤ 100 por página, con
// total y cursor): se ve el total, «Cargar más» trae la siguiente página con el cursor y nunca se recorta en silencio.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Currency } from '@/utils/currency'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, o?: Record<string, unknown>) => (o ? `${key}${JSON.stringify(o)}` : key) }),
}))
const h = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api', () => ({ default: { get: h.get, post: vi.fn() } }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ venueTimezone: 'America/Mexico_City', formatDateTime: (d: string) => `FECHA(${d})` }),
}))
vi.mock('@/components/PageTitleWithInfo', () => ({ PageTitleWithInfo: ({ title }: { title: string }) => <h1>{title}</h1> }))

import CashMachineDoubts from './CashMachineDoubts'

const fila = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `inc${n}`,
  referenceCC: `AQ00000000000${n}`,
  status: 'ABIERTO',
  deviceId: 'd1',
  createdAt: `2026-11-20T19:0${n}:00.000Z`,
  dueCents: 15000 + n,
  saleCents: 13000 + n,
  tipCents: 2000,
  startedAt: `2026-11-20T18:5${n}:00.000Z`,
  lastSeen: null,
  pedido: { items: [{ name: 'Café', quantity: 2 }, { promotionRef: { promotionId: 'p' } }] },
  saleShiftId: null,
  ...extra,
})

function pintar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <CashMachineDoubts />
    </QueryClientProvider>,
  )
}

const D = 'cashMachineDoubts.'
const texto = () => document.body.textContent ?? ''

describe('CashMachineDoubts', () => {
  beforeEach(() => {
    h.get.mockReset()
  })

  it('pide sólo las ABIERTAS de la sucursal, con su límite', async () => {
    h.get.mockResolvedValueOnce({ data: { success: true, data: [fila(1)], total: 1, nextCursor: null } })
    pintar()
    await screen.findByText('AQ000000000001')
    expect(h.get).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/cash-machine/doubts', {
      params: { status: 'ABIERTO', limit: 50 },
    })
  })

  it('enseña folio, inicio, venta, propina, debía y el carrito, con el total', async () => {
    h.get.mockResolvedValueOnce({ data: { success: true, data: [fila(1)], total: 1, nextCursor: null } })
    pintar()
    await screen.findByText('AQ000000000001')
    expect(texto()).toContain(`${D}showing${JSON.stringify({ shown: 1, total: 1 })}`)
    expect(texto()).toContain('FECHA(2026-11-20T18:51:00.000Z)')
    expect(texto()).toContain(Currency(130.01))
    expect(texto()).toContain(Currency(20))
    expect(texto()).toContain(Currency(150.01))
    expect(texto()).toContain('2× Café')
    expect(texto()).toContain(`${D}promotionLine`)
    expect(screen.queryByRole('button', { name: `${D}loadMore` })).not.toBeInTheDocument()
  })

  it('«Cargar más» trae la siguiente página con el cursor y no repite filas', async () => {
    h.get
      .mockResolvedValueOnce({ data: { success: true, data: [fila(1), fila(2)], total: 3, nextCursor: 'cursor-1' } })
      .mockResolvedValueOnce({ data: { success: true, data: [fila(2), fila(3)], total: 3, nextCursor: null } })
    pintar()
    await screen.findByText('AQ000000000002')
    expect(texto()).toContain(`${D}showing${JSON.stringify({ shown: 2, total: 3 })}`)
    fireEvent.click(screen.getByRole('button', { name: `${D}loadMore` }))
    await screen.findByText('AQ000000000003')
    expect(h.get).toHaveBeenLastCalledWith('/api/v1/dashboard/venues/v1/cash-machine/doubts', {
      params: { status: 'ABIERTO', limit: 50, cursor: 'cursor-1' },
    })
    expect(screen.getAllByText('AQ000000000002')).toHaveLength(1)
    expect(texto()).toContain(`${D}showing${JSON.stringify({ shown: 3, total: 3 })}`)
    expect(screen.queryByRole('button', { name: `${D}loadMore` })).not.toBeInTheDocument()
  })

  it('sin dudas: lo dice (no es lo mismo que un error)', async () => {
    h.get.mockResolvedValueOnce({ data: { success: true, data: [], total: 0, nextCursor: null } })
    pintar()
    expect(await screen.findByText(`${D}empty`)).toBeInTheDocument()
    expect(screen.queryByText(`${D}loadError`)).not.toBeInTheDocument()
  })

  it('si la lista no carga: lo dice y deja reintentar', async () => {
    h.get.mockRejectedValue(new Error('red')) // la consulta reintenta UNA vez (retry: 1) antes de rendirse
    pintar()
    expect(await screen.findByText(`${D}loadError`, undefined, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.queryByText(`${D}empty`)).not.toBeInTheDocument()
    h.get.mockReset()
    h.get.mockResolvedValueOnce({ data: { success: true, data: [fila(1)], total: 1, nextCursor: null } })
    fireEvent.click(screen.getByRole('button', { name: `${D}retry` }))
    await screen.findByText('AQ000000000001')
  })

  it('«Resolver» abre la ventana de ese folio', async () => {
    h.get.mockResolvedValueOnce({ data: { success: true, data: [fila(1), fila(2)], total: 2, nextCursor: null } })
    pintar()
    await screen.findByText('AQ000000000002')
    fireEvent.click(screen.getAllByRole('button', { name: `${D}resolveButton` })[1])
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent(`${D}resolve.title${JSON.stringify({ folio: 'AQ000000000002' })}`))
  })
})
