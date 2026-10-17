import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/api', () => ({ default: m }))
vi.mock('@/utils/export', () => ({ triggerDownload: vi.fn() }))

import { triggerDownload } from '@/utils/export'
import {
  downloadGiftCardBalancesCsv,
  getGiftCardAging,
  getGiftCardDetail,
  getGiftCardSettings,
  getGiftCardSummary,
  listGiftCardPendingAccounting,
  listGiftCards,
  operateGiftCard,
  releaseGiftCardSaleCancel,
  startGiftCardSaleCancel,
  updateGiftCardSettings,
} from '@/services/giftCard.service'
import type {
  GiftCardActivityRow,
  GiftCardAging,
  GiftCardDetail,
  GiftCardListPage,
  GiftCardRow,
  GiftCardSummary,
  PendingAccountingPage,
} from '@/types/giftCard'

const ok = (data: unknown) => ({ data: { success: true, data } })
const BASE = '/api/v1/dashboard/venues/v1/gift-cards'

/** Formas EXACTAS de la red (C4, `giftCardReports.service.ts`): montos en pesos como número. El panel las usa TAL CUAL (F3). */
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
  deliveryStatus: 'SENT',
  recipientName: 'Ana López',
  purchaserName: 'Luis Pérez',
  source: 'POS',
  customer: null,
  order: { id: 'o1', orderNumber: 'A-1042' },
}
const mov = (over: Partial<GiftCardActivityRow>): GiftCardActivityRow => ({
  id: 'a1',
  type: 'ACTIVATE',
  amount: 1500,
  balanceAfter: 1500,
  reason: null,
  note: null,
  createdAt: '2026-10-10T18:01:00.000Z',
  staff: { id: 's1', name: 'Caja 1' },
  paymentId: null,
  refundPaymentId: null,
  orderId: 'o1',
  ...over,
})
const DETALLE: GiftCardDetail = {
  ...FILA,
  status: 'BLOCKED',
  validityMonths: null,
  termsVersion: '2026-10-14',
  message: null,
  recipientPhone: null,
  recipientEmail: null,
  purchaserContact: null,
  deliveredAt: null,
  deactivatedAt: null,
  hasRedeem: false,
  canReplaceCode: true,
  // Nota 1 del coordinador: con `reason: null` (bloqueada por otro motivo) el server manda su texto en `message`.
  cancel: {
    allowed: false,
    reason: null,
    message: 'Una de las tarjetas de esta venta está bloqueada por otro motivo; desbloquéala antes de cancelar la venta.',
  },
  // El bloqueo VIGENTE lo calcula el server (auditoría r1, D-2): la libreta de esta página ni siquiera trae el BLOCK.
  currentBlock: { reason: 'SUSPICIOUS_ACTIVITY', note: 'Dos intentos raros', at: '2026-10-12T10:00:00.000Z' },
  activities: { items: [mov({})], nextCursor: 'c-2', total: 40 },
}
const RESUMEN: GiftCardSummary = {
  from: '2026-10-01',
  to: '2026-10-14',
  timezone: 'America/Mexico_City',
  sold: { cards: 4, amount: 6000 },
  redeemed: { movements: 3, amount: 1350, reversed: 100, net: 1250 },
  cancelled: { cards: 1, amount: 500 },
  adjustments: { increments: 100, decrements: 50, net: 50 },
  liveBalance: { cards: 3, amount: 4250, expiredAmount: 0, asOf: '2026-10-14T18:00:00.000Z' },
}
/** Sin `expiredAmount`: «vencido al corte» se retiró de la 1a (auditoría r1, C-4). */
const ANTIGUEDAD: GiftCardAging = {
  at: '2026-10-14',
  timezone: 'America/Mexico_City',
  buckets: [
    { bucket: '0-30', cards: 2, amount: 3000 },
    { bucket: '366+', cards: 1, amount: 1250 },
  ],
  total: { cards: 3, amount: 4250 },
}
const PENDIENTES: PendingAccountingPage = {
  items: [
    {
      paymentId: 'p1',
      createdAt: '2026-10-10T18:01:00.000Z',
      kind: 'VENTA_DE_TARJETAS',
      amount: 1500,
      tipAmount: 0,
      method: 'CASH',
      tenderLabel: null,
      order: { id: 'o1', orderNumber: 'A-1042' },
    },
    {
      paymentId: 'p2',
      createdAt: '2026-10-11T18:01:00.000Z',
      kind: 'REVERSO_DE_SALDO',
      amount: -200,
      tipAmount: 0,
      method: 'OTHER',
      tenderLabel: 'Tarjeta de regalo',
      order: { id: 'o9', orderNumber: 'A-1050' },
    },
  ],
  page: 1,
  pageSize: 50,
  total: 2,
  from: '2026-10-01',
  to: '2026-10-14',
  totals: {
    VENTA_DE_TARJETAS: { count: 1, amount: 1500, tipAmount: 0 },
    CANCELACION_DE_VENTA: { count: 0, amount: 0, tipAmount: 0 },
    COBRO_CON_SALDO: { count: 0, amount: 0, tipAmount: 0 },
    REVERSO_DE_SALDO: { count: 1, amount: -200, tipAmount: 0 },
  },
  // Nota 1 del coordinador: el aviso al contador lo manda el server (el panel lo pinta, no lo copia al locale).
  notice: 'Estos cobros no generan póliza automática: regístralos a mano en la contabilidad.',
}

beforeEach(() => vi.clearAllMocks())

describe('giftCard.service', () => {
  it('ajustes: GET a /settings y PUT parcial; desenvuelve data con `hasCards` (C3)', async () => {
    m.get.mockResolvedValue(ok({ enabled: false, termsVersion: '2026-10-14', hasCards: false }))
    m.put.mockResolvedValue(ok({ enabled: true, hasCards: true }))
    const s = await getGiftCardSettings('v1')
    expect([s.termsVersion, s.hasCards]).toEqual(['2026-10-14', false])
    expect(m.get).toHaveBeenCalledWith(`${BASE}/settings`)
    const r = await updateGiftCardSettings('v1', { enabled: true, aceptaTerminos: true })
    expect(m.put).toHaveBeenCalledWith(`${BASE}/settings`, { enabled: true, aceptaTerminos: true })
    expect([r.enabled, r.hasCards]).toEqual([true, true])
  })

  it('lista: página, tamaño, búsqueda y estados (con EXPIRED) separados por coma; vacíos no viajan; la página llega TAL CUAL', async () => {
    const pagina: GiftCardListPage = { items: [FILA], page: 2, pageSize: 50, total: 51, totalBalance: 61200.5 }
    m.get.mockResolvedValue(ok(pagina))
    const signal = new AbortController().signal
    // F3: una sola representación — lo que manda C4 es lo que pinta la lista (`last4`, `order`, `totalBalance`).
    expect(await listGiftCards('v1', { page: 2, pageSize: 50, search: '4821', status: ['ACTIVE', 'EXPIRED'] }, signal)).toEqual(pagina)
    expect(m.get).toHaveBeenLastCalledWith(BASE, {
      params: { page: 2, pageSize: 50, search: '4821', status: 'ACTIVE,EXPIRED' },
      signal,
    })
    await listGiftCards('v1', { page: 1, pageSize: 50, search: '', status: [] })
    expect(m.get).toHaveBeenLastCalledWith(BASE, {
      params: { page: 1, pageSize: 50, search: undefined, status: undefined },
      signal: undefined,
    })
  })

  it('detalle: la primera página sin cursor; las siguientes con el cursor del server; llega TAL CUAL, con `cancel` y `currentBlock`', async () => {
    m.get.mockResolvedValue(ok(DETALLE))
    const d = await getGiftCardDetail('v1', 'g1', { limit: 25 })
    expect(d).toEqual(DETALLE)
    expect(d.currentBlock?.reason).toBe('SUSPICIOUS_ACTIVITY')
    expect(m.get).toHaveBeenLastCalledWith(`${BASE}/g1`, { params: { cursor: undefined, limit: 25 }, signal: undefined })
    await getGiftCardDetail('v1', 'g1', { cursor: 'c-2', limit: 25 })
    expect(m.get).toHaveBeenLastCalledWith(`${BASE}/g1`, { params: { cursor: 'c-2', limit: 25 }, signal: undefined })
  })

  it('🔴 operación: la llave viaja en el CUERPO junto con la operación (el reintento de api.ts reenvía la misma)', async () => {
    m.post.mockResolvedValue(ok({ activityIds: ['a1'] }))
    const r = await operateGiftCard('v1', 'g1', { operationKey: 'k-12345678', tipo: 'BLOQUEAR', reason: 'SUSPICIOUS_ACTIVITY' })
    expect(m.post).toHaveBeenCalledWith(`${BASE}/g1/operations`, {
      operationKey: 'k-12345678',
      tipo: 'BLOQUEAR',
      reason: 'SUSPICIOUS_ACTIVITY',
    })
    expect(r.activityIds).toEqual(['a1'])
  })

  it('cancelar la venta: iniciar manda su llave; 🔴 liberar manda la llave Y `confirmacionNoDevuelto: true` (F6)', async () => {
    m.post.mockResolvedValueOnce(ok({ giftCardIds: ['g1', 'g2'] })).mockResolvedValueOnce(ok({ released: true }))
    expect(await startGiftCardSaleCancel('v1', 'o1', 'k-aaaaaaaa')).toEqual({ giftCardIds: ['g1', 'g2'] })
    expect(m.post).toHaveBeenLastCalledWith(`${BASE}/orders/o1/cancel-sale`, { operationKey: 'k-aaaaaaaa' })
    await releaseGiftCardSaleCancel('v1', 'o1', 'k-bbbbbbbb', { confirmacionNoDevuelto: true })
    expect(m.post).toHaveBeenLastCalledWith(`${BASE}/orders/o1/release-cancel`, {
      operationKey: 'k-bbbbbbbb',
      confirmacionNoDevuelto: true,
    })
  })

  it('reportes: resumen con from/to, antigüedad con at, pendientes paginados con el rango (las dos fechas, siempre); llegan TAL CUAL', async () => {
    m.get.mockResolvedValueOnce(ok(RESUMEN)).mockResolvedValueOnce(ok(ANTIGUEDAD)).mockResolvedValueOnce(ok(PENDIENTES))
    expect(await getGiftCardSummary('v1', { from: '2026-10-01', to: '2026-10-14' })).toEqual(RESUMEN)
    expect(m.get).toHaveBeenLastCalledWith(`${BASE}/summary`, { params: { from: '2026-10-01', to: '2026-10-14' } })
    expect(await getGiftCardAging('v1', '2026-10-14')).toEqual(ANTIGUEDAD)
    expect(m.get).toHaveBeenLastCalledWith(`${BASE}/aging`, { params: { at: '2026-10-14' } })
    expect(await listGiftCardPendingAccounting('v1', { page: 1, pageSize: 50, from: '2026-10-01', to: '2026-10-14' })).toEqual(PENDIENTES)
    expect(m.get).toHaveBeenLastCalledWith(`${BASE}/pending-accounting`, {
      params: { page: 1, pageSize: 50, from: '2026-10-01', to: '2026-10-14' },
    })
  })

  it('CSV: pide un blob y lo descarga con el nombre que manda el server', async () => {
    const csv = new Blob(['ultimos4,saldo'])
    m.get.mockResolvedValue({
      data: csv,
      headers: { 'content-disposition': 'attachment; filename="saldos-tarjetas-de-regalo-2026-10-14.csv"' },
    })
    await downloadGiftCardBalancesCsv('v1', 'respaldo.csv')
    expect(m.get).toHaveBeenCalledWith(`${BASE}/export.csv`, { responseType: 'blob' })
    expect(triggerDownload).toHaveBeenCalledWith(csv, 'saldos-tarjetas-de-regalo-2026-10-14.csv')
  })

  it('CSV: sin content-disposition usa el nombre de respaldo', async () => {
    const csv = new Blob(['x'])
    m.get.mockResolvedValue({ data: csv })
    await downloadGiftCardBalancesCsv('v1', 'respaldo.csv')
    expect(triggerDownload).toHaveBeenCalledWith(csv, 'respaldo.csv')
  })

  it('CSV: si falla, el cuerpo del error (un Blob) se deja como JSON y no se descarga nada', async () => {
    const cuerpo = { message: 'No tienes permiso para ver tarjetas de regalo.' }
    // jsdom no trae `Blob.text()` (los navegadores sí): se le pone a la instancia, como en staffPay.fase2.service.test.ts.
    const blob = Object.assign(new Blob([JSON.stringify(cuerpo)]), { text: async () => JSON.stringify(cuerpo) })
    m.get.mockRejectedValue(Object.assign(new Error('403'), { response: { status: 403, data: blob } }))
    const err = await downloadGiftCardBalancesCsv('v1', 'x.csv').catch(e => e)
    expect(err.response.data).toEqual(cuerpo)
    expect(triggerDownload).not.toHaveBeenCalled()
  })
})
