// Reporte «Descuentos» (encargo f998c8): agrupado por motivo exacto del servidor, filtro por motivo, paginación y estados.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import reports from '@/locales/es/reports.json'
import AppliedDiscounts from '../AppliedDiscounts'

const m = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/iq' }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ activeVenue: { timezone: 'America/Mexico_City' } }) }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ formatDateTime: (v: string) => `F:${v}` }),
  getLast7Days: () => ({ from: new Date('2026-11-09T06:00:00Z'), to: new Date('2026-11-16T05:59:59Z') }),
}))
vi.mock('@/components/date-range-picker', () => ({ DateRangePicker: () => null }))
vi.mock('@/components/PageTitleWithInfo', () => ({ PageTitleWithInfo: ({ title }: { title: string }) => <h1>{title}</h1> }))
vi.mock('@/services/reports/appliedDiscounts.service', () => ({
  SIN_MOTIVO: '__SIN_MOTIVO__',
  fetchAppliedDiscounts: (...a: unknown[]) => m.fetch(...a),
  appliedDiscountsKeys: { report: (f: unknown) => ['applied-discounts', f] },
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const raw = key.split('.').reduce<any>((obj, part) => obj?.[part], reports)
      return typeof raw === 'string' ? raw.replace(/\{\{(\w+)\}\}/g, (_, p) => String(opts?.[p] ?? '')) : key
    },
    i18n: { language: 'es' },
  }),
}))

const reporte = (extra: Record<string, unknown> = {}) => ({
  from: '2026-11-09T06:00:00Z',
  to: '2026-11-16T05:59:59Z',
  totales: { count: 3, amount: 45.5 },
  porMotivo: [
    { reason: 'Queja del cliente', count: 2, amount: 30 },
    { reason: null, count: 1, amount: 15.5 },
  ],
  motivosRecortados: false,
  rows: [
    {
      id: 'od-1',
      createdAt: '2026-11-15T18:00:00Z',
      orderId: 'o1',
      orderNumber: 'A-12',
      name: 'Ajuste de precio',
      type: 'FIXED_AMOUNT',
      amount: 20,
      reason: 'Queja del cliente',
      reasonComment: 'tardó la orden',
      appliedBy: 'Ana López',
      authorizedBy: 'Beto',
    },
  ],
  pagination: { page: 1, pageSize: 50, total: 120, totalPages: 3 },
  ...extra,
})

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AppliedDiscounts />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AppliedDiscounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.fetch.mockResolvedValue(reporte())
  })

  it('muestra el total, una tarjeta por motivo (con «Sin motivo») y la fila con motivo, comentario y quién', async () => {
    renderPage()
    expect(await screen.findByText('Descuentos dados')).toBeInTheDocument()
    expect(screen.getAllByText('Queja del cliente').length).toBeGreaterThan(0)
    expect(screen.getByText('Sin motivo')).toBeInTheDocument()
    expect(screen.getByText('tardó la orden')).toBeInTheDocument()
    expect(screen.getByText('Ana López')).toBeInTheDocument()
    expect(screen.getByText('Página 1 de 3 · 120 descuentos')).toBeInTheDocument()
    expect(m.fetch).toHaveBeenCalledWith(expect.objectContaining({ venueId: 'v1', page: 1, pageSize: 50 }))
  })

  it('tocar un motivo filtra la lista desde la página 1; tocar «Sin motivo» manda el valor especial', async () => {
    renderPage()
    const tarjeta = await screen.findByRole('button', { pressed: false, name: /Queja del cliente/ })
    fireEvent.click(tarjeta)
    await waitFor(() => expect(m.fetch).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'Queja del cliente', page: 1 })))
    fireEvent.click(screen.getByRole('button', { name: /Sin motivo/ }))
    await waitFor(() => expect(m.fetch).toHaveBeenLastCalledWith(expect.objectContaining({ reason: '__SIN_MOTIVO__' })))
  })

  it('«Siguiente» pide la página 2 (el total nunca se trunca)', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(m.fetch).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })))
  })

  it('periodo sin descuentos: lo dice (no es un error)', async () => {
    m.fetch.mockResolvedValue(
      reporte({
        rows: [],
        porMotivo: [],
        totales: { count: 0, amount: 0 },
        pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 },
      }),
    )
    renderPage()
    expect(await screen.findByText('No se dieron descuentos en el periodo.')).toBeInTheDocument()
  })
})
