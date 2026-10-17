import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  summary: {} as Record<string, unknown>,
  aging: {} as Record<string, unknown>,
  pending: {} as Record<string, unknown>,
  /** El último rango con que se llamó a cada consulta (funciones normales, no vi.fn: `mockReset` las vaciaría). */
  rangos: {} as Record<string, unknown[]>,
}))
vi.mock('@/hooks/use-gift-cards', () => ({
  useGiftCardSummary: (...a: unknown[]) => ((h.rangos.summary = a), h.summary),
  useGiftCardAging: () => h.aging,
  useGiftCardPendingAccounting: (...a: unknown[]) => ((h.rangos.pending = a), h.pending),
}))
const svc = vi.hoisted(() => ({ downloadGiftCardBalancesCsv: vi.fn() }))
vi.mock('@/services/giftCard.service', () => svc)
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/demo' }) }))
const toast = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
// Con `amount` se pinta junto a la llave, para leer el total de pendientes.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o?.amount ? `${k} ${String(o.amount)}` : k) }),
}))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ venueTimezone: 'America/Mexico_City', formatDateTime: (d: string) => `fecha ${d}`, formatDate: (d: string) => d }),
}))

import { Currency } from '@/utils/currency'
import type { GiftCardAging, GiftCardSummary, PendingAccountingPage, PendingAccountingRow } from '@/types/giftCard'
import { GiftCardReports } from '../components/GiftCardReports'

/** Formas de C4 TAL CUAL (F3). */
const SUMMARY: GiftCardSummary = {
  from: '2026-10-01', to: '2026-10-14', timezone: 'America/Mexico_City', sold: { cards: 4, amount: 6000 },
  redeemed: { movements: 3, amount: 1350, reversed: 100, net: 1250 }, cancelled: { cards: 1, amount: 500 },
  adjustments: { increments: 100, decrements: 50, net: 50 }, liveBalance: { cards: 3, amount: 4250, expiredAmount: 0, asOf: '2026-10-14T18:00:00.000Z' },
}
/** Sin `expiredAmount` (auditoría r1, C-4). */
const AGING: GiftCardAging = { at: '2026-10-14', timezone: 'America/Mexico_City', buckets: [{ bucket: '0-30', cards: 3, amount: 4250 }], total: { cards: 3, amount: 4250 } }
const CERO = { count: 0, amount: 0, tipAmount: 0 }
const AVISO = 'Estos cobros no generan póliza automática: regístralos a mano en la contabilidad.'
/** Nota 13 del coordinador: la página trae `notice`. */
const SIN_PENDIENTES: PendingAccountingPage = {
  items: [], page: 1, pageSize: 50, total: 0, from: '2026-10-01', to: '2026-10-14',
  totals: { VENTA_DE_TARJETAS: CERO, CANCELACION_DE_VENTA: CERO, COBRO_CON_SALDO: CERO, REVERSO_DE_SALDO: CERO },
  notice: AVISO,
}
const fila = (over: Partial<PendingAccountingRow>): PendingAccountingRow => ({
  paymentId: 'p1', createdAt: '2026-10-10T18:00:00.000Z', kind: 'VENTA_DE_TARJETAS', amount: 1000, tipAmount: 0, method: 'CASH',
  tenderLabel: null, order: { id: 'o1', orderNumber: 'A-1001' }, ...over,
})
const listo = (data: unknown) => ({ data, isLoading: false, isError: false, error: null, refetch: vi.fn() })
const pendientes = (page: PendingAccountingPage) => ({
  data: { pages: [page], pageParams: [1] },
  isLoading: false, isError: false, isPlaceholderData: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn(),
})
const pintar = () =>
  render(
    <MemoryRouter>
      <GiftCardReports venueId="v1" />
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  h.summary = listo(SUMMARY)
  h.aging = listo(AGING)
  h.pending = pendientes(SIN_PENDIENTES)
})

describe('GiftCardReports', () => {
  it('las tarjetas de cifras salen del agregado del server', () => {
    pintar()
    expect(screen.getByText(Currency(6000))).toBeInTheDocument()
    expect(screen.getAllByText(Currency(4250)).length).toBeGreaterThan(0)
  })

  it('🔴 un resumen que falla dice que falló (nunca $0) y «Reintentar» lo vuelve a pedir', () => {
    const refetch = vi.fn()
    h.summary = { data: undefined, isLoading: false, isError: true, error: {}, refetch }
    pintar()
    expect(screen.getByText('reports.summaryError')).toBeInTheDocument()
    expect(screen.queryByText(Currency(0))).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'reports.retry' })[0])
    expect(refetch).toHaveBeenCalled()
  })

  it('🔴 notas 10/12 · un error del resumen SIN `code` (401/500 en inglés) no pinta su message crudo', () => {
    h.summary = { data: undefined, isLoading: false, isError: true, error: { response: { status: 500, data: { message: 'Internal server error' } } }, refetch: vi.fn() }
    pintar()
    expect(screen.getByText('reports.summaryError')).toBeInTheDocument()
    expect(screen.queryByText('Internal server error')).not.toBeInTheDocument()
  })

  it('🔴 con el resumen ya cargado, una relectura que falla deja las cifras (no la cambia por el error)', () => {
    h.summary = { data: SUMMARY, isLoading: false, isError: true, error: {}, refetch: vi.fn() }
    h.aging = { data: AGING, isLoading: false, isError: true, error: {}, refetch: vi.fn() }
    pintar()
    expect(screen.getByText(Currency(6000))).toBeInTheDocument()
    expect(screen.queryByText('reports.summaryError')).not.toBeInTheDocument()
    expect(screen.queryByText('reports.aging.error')).not.toBeInTheDocument()
  })

  it('sin pendientes en el periodo, lo dice (no una tabla vacía)', () => {
    pintar()
    expect(screen.getByText('reports.pending.empty')).toBeInTheDocument()
  })

  it('🔴 nota 3 · el aviso del server va arriba de la tabla, y una venta devuelta entera sale con su cancelación (netean $0)', () => {
    h.pending = pendientes({
      ...SIN_PENDIENTES,
      items: [
        fila({ paymentId: 'p2', kind: 'CANCELACION_DE_VENTA', amount: -1000, createdAt: '2026-10-10T19:00:00.000Z' }),
        fila({ paymentId: 'p1', kind: 'VENTA_DE_TARJETAS', amount: 1000 }),
      ],
      total: 2,
      totals: { ...SIN_PENDIENTES.totals, VENTA_DE_TARJETAS: { count: 1, amount: 1000, tipAmount: 0 }, CANCELACION_DE_VENTA: { count: 1, amount: -1000, tipAmount: 0 } },
    })
    pintar()
    const aviso = screen.getByText(AVISO)
    expect(aviso.compareDocumentPosition(screen.getByRole('table', { name: 'reports.pending.title' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('reports.pending.kind.VENTA_DE_TARJETAS')).toBeInTheDocument()
    expect(screen.getByText('reports.pending.kind.CANCELACION_DE_VENTA')).toBeInTheDocument()
    expect(screen.getByText(`−${Currency(1000)}`)).toBeInTheDocument()
    expect(screen.getByText(`reports.pending.totals ${Currency(0)}`)).toBeInTheDocument()
  })

  it('«Descargar saldos» descarga el CSV SÓLO tras el clic, con un nombre de respaldo con la fecha del negocio', async () => {
    pintar()
    expect(svc.downloadGiftCardBalancesCsv).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'reports.export.button' }))
    await waitFor(() =>
      expect(svc.downloadGiftCardBalancesCsv).toHaveBeenCalledWith('v1', expect.stringMatching(/^saldos-tarjetas-de-regalo-\d{4}-\d{2}-\d{2}\.csv$/)),
    )
  })

  it('si la descarga falla con un error CON `code`, lo dice con el texto del server', async () => {
    svc.downloadGiftCardBalancesCsv.mockRejectedValue({ response: { status: 403, data: { code: 'FORBIDDEN', message: 'Sin permiso' } } })
    pintar()
    fireEvent.click(screen.getByRole('button', { name: 'reports.export.button' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'reports.export.error', description: 'Sin permiso', variant: 'destructive' }))
  })

  it('🔴 notas 10/12 · si la descarga falla SIN `code`, el texto genérico (nunca el message crudo)', async () => {
    svc.downloadGiftCardBalancesCsv.mockRejectedValue({ response: { status: 401, data: { message: 'Unauthorized' } } })
    pintar()
    fireEvent.click(screen.getByRole('button', { name: 'reports.export.button' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'reports.export.error', description: 'errors.generic', variant: 'destructive' }))
  })

  it('«Desde» después de «Hasta» se explica y no se piden reportes con ese rango', () => {
    pintar()
    fireEvent.change(screen.getByLabelText('reports.from'), { target: { value: '2030-01-01' } })
    expect(screen.getByText('reports.rangeError')).toBeInTheDocument()
    // Rango vacío = consulta apagada (los hooks piden `!!from && !!to`).
    expect(h.rangos.summary).toEqual(['v1', '', ''])
    expect(h.rangos.pending).toEqual(['v1', '', ''])
  })
})
