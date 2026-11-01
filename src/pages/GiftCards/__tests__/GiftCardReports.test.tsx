import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import i18next from 'i18next'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

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
// «llave(a=1,b=2)»: se lee qué llave se usó y con qué valores (los totales por tipo, el conteo).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: unknown) =>
      o && typeof o === 'object' ? `${k}(${Object.entries(o).map(([a, b]) => `${a}=${String(b)}`).join(',')})` : k,
  }),
}))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ venueTimezone: 'America/Mexico_City', formatDateTime: (d: string) => `fecha ${d}`, formatDate: (d: string) => d }),
}))

import { Currency } from '@/utils/currency'
import type { GiftCardAging, GiftCardSummary, PendingAccountingPage, PendingAccountingRow } from '@/types/giftCard'
import en from '@/locales/en/giftCards.json'
import es from '@/locales/es/giftCards.json'
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
  it('saldo a favor: una línea aparte de «Vendidas», con su monto; un server viejo (sin storeCredit) no la pinta', () => {
    h.summary = listo({ ...SUMMARY, storeCredit: { cards: 2, movements: 5, amount: 800 } })
    const a = pintar()
    expect(screen.getByText('reports.cards.storeCredit(count=5)')).toBeInTheDocument()
    expect(screen.getByText(Currency(800))).toBeInTheDocument()
    // lo vendido sigue siendo lo vendido
    expect(screen.getByText('reports.cards.sold(count=4)')).toBeInTheDocument()
    a.unmount()
    h.summary = listo(SUMMARY)
    pintar()
    expect(screen.queryByText(/reports\.cards\.storeCredit/)).toBeNull()
  })

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
    expect(screen.getByText('reports.pending.totals(count=2)')).toBeInTheDocument()
  })

  it('🔴 I2 · los totales van POR TIPO, tal como los manda el server (nunca la suma de venta + pago con saldo)', () => {
    h.pending = pendientes({
      ...SIN_PENDIENTES,
      items: [
        fila({ paymentId: 'p2', kind: 'COBRO_CON_SALDO', amount: 300, tipAmount: 30, order: { id: 'o2', orderNumber: 'A-1002' } }),
        fila({ paymentId: 'p1', kind: 'VENTA_DE_TARJETAS', amount: 1000 }),
      ],
      total: 2,
      totals: { ...SIN_PENDIENTES.totals, VENTA_DE_TARJETAS: { count: 1, amount: 1000, tipAmount: 0 }, COBRO_CON_SALDO: { count: 1, amount: 300, tipAmount: 30 } },
    })
    pintar()
    expect(screen.getByText('reports.pending.totals(count=2)')).toBeInTheDocument()
    expect(screen.getByText(`reports.pending.byKind(kind=reports.pending.kind.VENTA_DE_TARJETAS,n=1,amount=${Currency(1000)})`)).toBeInTheDocument()
    expect(
      screen.getByText(`reports.pending.byKindWithTip(kind=reports.pending.kind.COBRO_CON_SALDO,n=1,amount=${Currency(300)},tip=${Currency(30)})`),
    ).toBeInTheDocument()
    // Los tipos en cero no se listan, y la suma de los cuatro ya no existe.
    expect(screen.queryByText(/kind=reports\.pending\.kind\.REVERSO_DE_SALDO/)).not.toBeInTheDocument()
    expect(screen.queryByText(new RegExp(Currency(1300).replace(/[$.]/g, '\\$&')))).not.toBeInTheDocument()
  })

  it('🔴 I3 · la tabla enseña la propina que también salió del saldo', () => {
    h.pending = pendientes({
      ...SIN_PENDIENTES,
      items: [fila({ paymentId: 'p2', kind: 'COBRO_CON_SALDO', amount: 300, tipAmount: 30 })],
      total: 1,
      totals: { ...SIN_PENDIENTES.totals, COBRO_CON_SALDO: { count: 1, amount: 300, tipAmount: 30 } },
    })
    pintar()
    const tabla = screen.getByRole('table', { name: 'reports.pending.title' })
    expect(within(tabla).getByRole('columnheader', { name: 'reports.pending.columns.tip' })).toBeInTheDocument()
    expect(within(tabla).getByText(Currency(30))).toBeInTheDocument()
  })

  it('🔴 M4 · al cambiar el rango, la tabla del rango anterior se ve atenuada y ocupada mientras llega la nueva', () => {
    h.pending = { ...pendientes({ ...SIN_PENDIENTES, items: [fila({})], total: 1 }), isPlaceholderData: true }
    pintar()
    expect(screen.getByRole('table', { name: 'reports.pending.title' }).closest('[aria-busy="true"]')).not.toBeNull()
  })

  it('🔴 M4 · si «Cargar más» falla, lo dice y deja las filas que ya había', () => {
    h.pending = { ...pendientes({ ...SIN_PENDIENTES, items: [fila({})], total: 60 }), hasNextPage: true, isError: true, isFetchNextPageError: true }
    pintar()
    expect(screen.getByText('reports.pending.loadMoreError')).toBeInTheDocument()
    expect(screen.getByText('reports.pending.kind.VENTA_DE_TARJETAS')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'reports.pending.loadMore' })).toBeInTheDocument()
  })

  it('🔴 M5 · con «Al día» vacío, pide una fecha en vez de quedar en blanco', () => {
    pintar()
    fireEvent.change(screen.getByLabelText('reports.aging.at'), { target: { value: '' } })
    expect(screen.getByText('reports.aging.pickDate')).toBeInTheDocument()
    expect(screen.queryByText('reports.aging.total')).not.toBeInTheDocument()
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

// Task 5: el aviso al contador es texto fijo del server (español); con el panel en inglés sale `reports.pending.notice`.
describe('GiftCardReports · aviso de pendientes con el panel en inglés', () => {
  const conPendientes = () => {
    h.pending = pendientes({ ...SIN_PENDIENTES, items: [fila({})], total: 1, totals: { ...SIN_PENDIENTES.totals, VENTA_DE_TARJETAS: { count: 1, amount: 1000, tipAmount: 0 } } })
  }
  beforeAll(async () => {
    await i18next.init({ lng: 'en', fallbackLng: 'en', resources: { en: { giftCards: en } } })
  })
  afterAll(async () => {
    await i18next.changeLanguage('es')
  })

  it('en inglés, el aviso de pendientes usa reports.pending.notice (no el texto del server)', () => {
    conPendientes()
    pintar()
    const aviso = screen.getByText('reports.pending.notice')
    expect(aviso.closest('[data-tour="gift-cards-pending-notice"]')).not.toBeNull()
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
  })

  it('sin `notice` del server no aparece aviso (el idioma no lo inventa)', () => {
    h.pending = pendientes({ ...SIN_PENDIENTES, items: [fila({})], total: 1, notice: '' })
    const { container } = pintar()
    expect(container.querySelector('[data-tour="gift-cards-pending-notice"]')).toBeNull()
  })

  it('la llave existe de verdad en es y en en, con el mismo sentido (contabilidad a mano, costo de ventas ya en póliza)', () => {
    expect(en.reports.pending.notice).toMatch(/journal|accounting/i)
    expect(es.reports.pending.notice).toBe(
      'Estos cobros no generan póliza automática: regístralos a mano en la contabilidad. El costo de la mercancía que se pagó con saldo ya está en la póliza de costo de ventas; falta el ingreso del canje y, en la venta de tarjetas, el saldo que se le debe al cliente.',
    )
  })
})
