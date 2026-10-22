/**
 * Tarjetas de regalo (fase 1a) — API del panel. Montada en /api/v1/dashboard/venues/:venueId/gift-cards (avoqado-server,
 * Parte C). Ninguna ruta de lectura pide plan (R9): sólo `giftCards:read`. El server envuelve todo en `{ success, data }`:
 * cada función desenvuelve `response.data.data` y lo devuelve TAL CUAL (F3 de la auditoría r1: una sola representación, los
 * tipos de C3/C4 de `@/types/giftCard`; sin traductores). Los reintentos de red ya los hace `src/api.ts` (con la MISMA
 * config, así que la `operationKey` del cuerpo viaja igual); aquí no se repiten.
 */
import api from '@/api'
import type {
  ConfirmacionDeLiberar,
  GiftCardAging,
  GiftCardDetail,
  GiftCardListPage,
  GiftCardListQuery,
  GiftCardOperation,
  GiftCardOperationResult,
  GiftCardResendBody,
  GiftCardResendResult,
  GiftCardSettingsView,
  GiftCardSummary,
  PendingAccountingPage,
  UpdateGiftCardSettingsInput,
} from '@/types/giftCard'

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/gift-cards`

/** GET /settings — con defaults si el negocio nunca configuró nada. Sin candado de plan. */
export const getGiftCardSettings = async (venueId: string): Promise<GiftCardSettingsView> =>
  (await api.get(`${base(venueId)}/settings`)).data.data

/** PUT /settings — parcial. Prender manda `aceptaTerminos: true`; el server rechaza sin plan (403) o sin términos (400). */
export const updateGiftCardSettings = async (venueId: string, input: UpdateGiftCardSettingsInput): Promise<GiftCardSettingsView> =>
  (await api.put(`${base(venueId)}/settings`, input)).data.data

/** GET / — paginada en el server (tope 100). Los estados viajan separados por coma; búsqueda y estados vacíos no viajan. */
export async function listGiftCards(venueId: string, q: GiftCardListQuery, signal?: AbortSignal): Promise<GiftCardListPage> {
  const r = await api.get(base(venueId), {
    params: {
      page: q.page,
      pageSize: q.pageSize,
      search: q.search || undefined,
      status: q.status && q.status.length > 0 ? q.status.join(',') : undefined,
    },
    signal,
  })
  return r.data.data
}

/** GET /:giftCardId — la tarjeta, su venta, su bloqueo vigente (`currentBlock`) y UNA página de su libreta (cursor del server). */
export async function getGiftCardDetail(
  venueId: string,
  giftCardId: string,
  q: { cursor?: string; limit: number },
  signal?: AbortSignal,
): Promise<GiftCardDetail> {
  const r = await api.get(`${base(venueId)}/${giftCardId}`, { params: { cursor: q.cursor || undefined, limit: q.limit }, signal })
  return r.data.data
}

/** POST /:giftCardId/operations — ajuste, bloqueo, desbloqueo o reposición. La llave va en el CUERPO (R12). */
export const operateGiftCard = async (
  venueId: string,
  giftCardId: string,
  body: GiftCardOperation & { operationKey: string },
): Promise<GiftCardOperationResult> => (await api.post(`${base(venueId)}/${giftCardId}/operations`, body)).data.data

/**
 * POST /:giftCardId/resend (1b S7, `giftCards:manage`; contrato 1b § 8) — sin destino reenvía al MISMO; con destino lo cambia (uno
 * nuevo repone el código y la liga). La llave va en el CUERPO: una por operación, y un reintento repite el MISMO cuerpo con la MISMA
 * llave (la del reenvío sólo se recuerda hasta el siguiente; reusarla para otra operación da 409 IDEMPOTENCY_KEY_REUSED).
 */
export const resendGiftCard = async (
  venueId: string,
  giftCardId: string,
  body: GiftCardResendBody & { operationKey: string },
): Promise<GiftCardResendResult> => (await api.post(`${base(venueId)}/${giftCardId}/resend`, body)).data.data

/** POST /orders/:orderId/cancel-sale — bloquea TODAS las tarjetas de esa venta con CANCEL_IN_PROGRESS (spec §5.6, paso 1). */
export const startGiftCardSaleCancel = async (venueId: string, orderId: string, operationKey: string): Promise<{ giftCardIds: string[] }> =>
  (await api.post(`${base(venueId)}/orders/${orderId}/cancel-sale`, { operationKey })).data.data

/**
 * POST /orders/:orderId/release-cancel — ya no se cancela: las desbloquea. F6: sólo con la confirmación EXPLÍCITA del gerente
 * de que comprobó que la devolución NO se hizo (`confirmacionNoDevuelto: true`; un *timeout* no lo prueba).
 */
export const releaseGiftCardSaleCancel = async (
  venueId: string,
  orderId: string,
  operationKey: string,
  confirmacion: ConfirmacionDeLiberar,
): Promise<{ released: true }> =>
  (await api.post(`${base(venueId)}/orders/${orderId}/release-cancel`, { operationKey, ...confirmacion })).data.data

/** GET /summary — agregados del periodo (`YYYY-MM-DD` en la zona del negocio; el server convierte). */
export const getGiftCardSummary = async (venueId: string, r: { from: string; to: string }): Promise<GiftCardSummary> =>
  (await api.get(`${base(venueId)}/summary`, { params: r })).data.data

/** GET /aging — saldo vivo a una fecha, por antigüedad (cubos de C4). */
export const getGiftCardAging = async (venueId: string, at: string): Promise<GiftCardAging> =>
  (await api.get(`${base(venueId)}/aging`, { params: { at } })).data.data

/** GET /pending-accounting — lo que el autoposteo no posteó (spec §7), paginado en el server. `from` y `to` son OBLIGATORIOS (C3). */
export const listGiftCardPendingAccounting = async (
  venueId: string,
  q: { page: number; pageSize: number; from: string; to: string },
): Promise<PendingAccountingPage> => (await api.get(`${base(venueId)}/pending-accounting`, { params: q })).data.data

/**
 * GET /export.csv — saldos vivos, SÓLO tras el clic (bounded-data: nada se precarga). El server recorre páginas acotadas.
 * El nombre sale de `content-disposition`; si no viene, el de respaldo.
 */
export async function downloadGiftCardBalancesCsv(venueId: string, fallbackName: string): Promise<void> {
  try {
    const res = await api.get(`${base(venueId)}/export.csv`, { responseType: 'blob' })
    const cd = String(res.headers?.['content-disposition'] ?? '')
    const filename = /filename="([^"]+)"/.exec(cd)?.[1] ?? fallbackName
    // Import dinámico: `@/utils/export` arrastra exceljs y papaparse; la pantalla de reportes no los necesita para pintar.
    const { triggerDownload } = await import('@/utils/export')
    triggerDownload(res.data as Blob, filename)
  } catch (err) {
    // `responseType: 'blob'` ⇒ el cuerpo de un error llega como Blob: se deja como JSON para que el aviso diga la causa real.
    const resp = (err as { response?: { data?: unknown } } | null)?.response
    if (resp?.data instanceof Blob) {
      try {
        resp.data = JSON.parse(await resp.data.text())
      } catch {
        /* no era JSON: se deja el Blob */
      }
    }
    throw err
  }
}
