/**
 * Tarjetas de regalo (fase 1a) — consultas y acciones del panel.
 *
 * - Ninguna LECTURA se gatea por plan (R9: sólo vender y prender). Todas piden `giftCards:read`, como el server: un negocio
 *   que bajó de plan sigue viendo saldos, historial y reportes (spec §6). Sin el permiso no sale ni una petición (ni un 403).
 * - Las claves cuelgan de ['gift-cards', venueId]: cada grupo de invalidación es un prefijo. Una lista que nace en una clave
 *   nueva sin su invalidación se queda vieja en silencio (bounded-data-and-query-load.md).
 * - Las acciones del gerente llevan `operationKey` en el CUERPO, generada UNA vez por operación con `useEnvioUnico`
 *   (huella = el contenido). El reintento de red de `src/api.ts` reenvía la MISMA config (misma llave) y un reintento manual
 *   tras quedar en duda (sin respuesta, 5xx) también; tras una respuesta definitiva la llave se tira. El server deduplica por
 *   [venueId, operationKey] y rechaza la misma llave con otro contenido (R12).
 */
import { useCallback } from 'react'
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAccess } from '@/hooks/use-access'
import { useEnvioUnico } from '@/pages/Commissions/envioUnico'
import {
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
  ConfirmacionDeLiberar,
  GiftCardListStatus,
  GiftCardOperation,
  GiftCardOperationResult,
  UpdateGiftCardSettingsInput,
} from '@/types/giftCard'

/** Código de la función, espejo EXACTO de basePlan.service.ts del server (un nombre distinto falla en silencio). */
export const GIFT_CARDS_FEATURE = 'GIFT_CARDS'
/** Página de la lista: el server recorta a 100; 50 llena la pantalla con «Cargar más». */
export const GIFT_CARDS_PAGE_SIZE = 50
/** Renglones de la libreta por página en la hoja de detalle. */
export const GIFT_CARD_ACTIVITY_PAGE_SIZE = 25
export const PENDING_ACCOUNTING_PAGE_SIZE = 50

/** Los cuatro estados del server más `EXPIRED` (ACTIVE con `expiresAt < ahora`; decisión 1 del coordinador). */
export type GiftCardListFilters = { search: string; status: GiftCardListStatus[] }
/** Qué cambió, para invalidar SÓLO lo que lo lee. */
export type GiftCardChange = { kind: 'settings' } | { kind: 'card'; giftCardId: string } | { kind: 'sale' }

export const giftCardKeys = {
  all: (venueId: string | undefined) => ['gift-cards', venueId] as const,
  settings: (venueId: string | undefined) => ['gift-cards', venueId, 'settings'] as const,
  listAll: (venueId: string | undefined) => ['gift-cards', venueId, 'list'] as const,
  list: (venueId: string | undefined, filters: GiftCardListFilters) => ['gift-cards', venueId, 'list', filters] as const,
  detailAll: (venueId: string | undefined) => ['gift-cards', venueId, 'detail'] as const,
  detail: (venueId: string | undefined, giftCardId: string) => ['gift-cards', venueId, 'detail', giftCardId] as const,
  reportsAll: (venueId: string | undefined) => ['gift-cards', venueId, 'reports'] as const,
  summary: (venueId: string | undefined, from: string, to: string) => ['gift-cards', venueId, 'reports', 'summary', from, to] as const,
  aging: (venueId: string | undefined, at: string) => ['gift-cards', venueId, 'reports', 'aging', at] as const,
  pending: (venueId: string | undefined, from: string, to: string) => ['gift-cards', venueId, 'reports', 'pending', from, to] as const,
}

/** Consultas pesadas: locales a estas queries, nunca en el QueryClient compartido. */
const HEAVY = { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } as const

/** Lo que pide el server para TODA lectura de tarjetas: un negocio y `giftCards:read`. */
function usePuedeLeer(venueId: string | undefined): boolean {
  const { can } = useAccess()
  return !!venueId && can('giftCards:read')
}

export function useGiftCardSettings(venueId: string | undefined) {
  const enabled = usePuedeLeer(venueId)
  return useQuery({ queryKey: giftCardKeys.settings(venueId), queryFn: () => getGiftCardSettings(venueId!), enabled, ...HEAVY })
}

/** Lista paginada en el server. Búsqueda y estados van en la clave ⇒ `keepPreviousData`: teclear no desmonta la tabla. */
export function useGiftCardList(venueId: string | undefined, filters: GiftCardListFilters) {
  const enabled = usePuedeLeer(venueId)
  return useInfiniteQuery({
    queryKey: giftCardKeys.list(venueId, filters),
    queryFn: ({ pageParam, signal }) =>
      listGiftCards(
        venueId!,
        { page: pageParam, pageSize: GIFT_CARDS_PAGE_SIZE, search: filters.search || undefined, status: filters.status },
        signal,
      ),
    initialPageParam: 1,
    getNextPageParam: last => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    enabled,
    placeholderData: keepPreviousData,
    ...HEAVY,
  })
}

/** Detalle + libreta por cursor. Sólo corre con una tarjeta abierta (la hoja cerrada no pide nada). */
export function useGiftCardDetail(venueId: string | undefined, giftCardId: string | null) {
  const enabled = usePuedeLeer(venueId) && !!giftCardId
  return useInfiniteQuery({
    queryKey: giftCardKeys.detail(venueId, giftCardId ?? ''),
    queryFn: ({ pageParam, signal }) =>
      getGiftCardDetail(venueId!, giftCardId!, { cursor: pageParam ?? undefined, limit: GIFT_CARD_ACTIVITY_PAGE_SIZE }, signal),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.activities.nextCursor ?? undefined,
    enabled,
    staleTime: 15_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export function useGiftCardSummary(venueId: string | undefined, from: string, to: string) {
  const enabled = usePuedeLeer(venueId) && !!from && !!to
  return useQuery({
    queryKey: giftCardKeys.summary(venueId, from, to),
    queryFn: () => getGiftCardSummary(venueId!, { from, to }),
    enabled,
    ...HEAVY,
  })
}

export function useGiftCardAging(venueId: string | undefined, at: string) {
  const enabled = usePuedeLeer(venueId) && !!at
  return useQuery({ queryKey: giftCardKeys.aging(venueId, at), queryFn: () => getGiftCardAging(venueId!, at), enabled, ...HEAVY })
}

export function useGiftCardPendingAccounting(venueId: string | undefined, from: string, to: string) {
  const enabled = usePuedeLeer(venueId) && !!from && !!to
  return useInfiniteQuery({
    queryKey: giftCardKeys.pending(venueId, from, to),
    queryFn: ({ pageParam }) =>
      listGiftCardPendingAccounting(venueId!, { page: pageParam, pageSize: PENDING_ACCOUNTING_PAGE_SIZE, from, to }),
    initialPageParam: 1,
    getNextPageParam: last => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    enabled,
    placeholderData: keepPreviousData,
    ...HEAVY,
  })
}

/**
 * Invalida SÓLO lo que lee lo que cambió y devuelve la promesa para que la acción la ESPERE: así el botón sigue ocupado
 * hasta que llegaron los datos nuevos y nadie vuelve a tocar sobre valores viejos.
 *   'settings' — ajustes y tipos de pago (prender crea el tender de sistema «Tarjeta de regalo», R4).
 *   'card'     — la lista, el detalle de ESA tarjeta y los reportes (un ajuste mueve el saldo vivo y la antigüedad).
 *   'sale'     — cancelar una venta toca TODAS sus tarjetas: la lista, todos los detalles y los reportes.
 */
export function useInvalidateGiftCards(): (venueId: string, change: GiftCardChange) => Promise<unknown> {
  const queryClient = useQueryClient()
  return useCallback(
    (venueId: string, change: GiftCardChange) => {
      const keys: ReadonlyArray<readonly unknown[]> =
        change.kind === 'settings'
          ? [giftCardKeys.settings(venueId), ['tender-types', venueId]]
          : change.kind === 'card'
            ? [giftCardKeys.listAll(venueId), giftCardKeys.detail(venueId, change.giftCardId), giftCardKeys.reportsAll(venueId)]
            : [giftCardKeys.listAll(venueId), giftCardKeys.detailAll(venueId), giftCardKeys.reportsAll(venueId)]
      return Promise.all(keys.map(queryKey => queryClient.invalidateQueries({ queryKey })))
    },
    [queryClient],
  )
}

/** PUT parcial de los ajustes. Idempotente por contenido (mismo cuerpo ⇒ mismo resultado), así que el reintento de api.ts no daña. */
export function useUpdateGiftCardSettings(venueId: string | undefined) {
  const invalidate = useInvalidateGiftCards()
  return useMutation({
    mutationFn: (input: UpdateGiftCardSettingsInput) => updateGiftCardSettings(venueId!, input),
    onSuccess: () => (venueId ? invalidate(venueId, { kind: 'settings' }) : undefined),
  })
}

/** La huella de una operación: misma tarjeta (o venta) + mismo contenido ⇒ misma llave hasta una respuesta definitiva. */
export const huellaDeOperacion = (alcance: string, contenido: unknown): string => `gift-card:${alcance}:${JSON.stringify(contenido)}`

/**
 * Ajustar, bloquear, desbloquear o reponer UNA tarjeta. `operar` devuelve `undefined` si ya hay otra operación en vuelo
 * (candado síncrono de useEnvioUnico: un doble clic no manda dos). Pase lo que pase, la pantalla vuelve a leer: si quedó en
 * duda y sí se aplicó, se ve en el historial.
 */
export function useGiftCardOperation(venueId: string | undefined, giftCardId: string) {
  const { enviar, enviando } = useEnvioUnico()
  const invalidate = useInvalidateGiftCards()
  const operar = useCallback(
    async (op: GiftCardOperation): Promise<GiftCardOperationResult | undefined> => {
      if (!venueId) return undefined
      try {
        const r = await enviar(huellaDeOperacion(giftCardId, op), paso =>
          paso('operacion', operationKey => operateGiftCard(venueId, giftCardId, { ...op, operationKey })),
        )
        if (r) await invalidate(venueId, { kind: 'card', giftCardId })
        return r
      } catch (err) {
        void invalidate(venueId, { kind: 'card', giftCardId })
        throw err
      }
    },
    [venueId, giftCardId, enviar, invalidate],
  )
  return { operar, enviando }
}

/**
 * Empezar o detener la cancelación de una venta de tarjetas (spec §5.6). Cada una es su propia operación con su llave.
 * Liberar pide la confirmación EXPLÍCITA de que la devolución NO se hizo (F6): un *timeout* no lo prueba.
 */
export function useGiftCardSaleCancel(venueId: string | undefined, orderId: string) {
  const { enviar, enviando } = useEnvioUnico()
  const invalidate = useInvalidateGiftCards()
  const correr = useCallback(
    async (accion: 'cancel-sale' | 'release-cancel', confirmacion?: ConfirmacionDeLiberar): Promise<unknown> => {
      if (!venueId) return undefined
      if (accion === 'release-cancel' && confirmacion?.confirmacionNoDevuelto !== true) return undefined
      try {
        const r = await enviar(huellaDeOperacion(orderId, { accion }), paso =>
          // `<unknown>`: las dos ramas responden distinto ({ giftCardIds } / { released }); sin él, TS fija T con la primera.
          paso<unknown>(accion, operationKey =>
            accion === 'cancel-sale'
              ? startGiftCardSaleCancel(venueId, orderId, operationKey)
              : releaseGiftCardSaleCancel(venueId, orderId, operationKey, { confirmacionNoDevuelto: true }),
          ),
        )
        if (r) await invalidate(venueId, { kind: 'sale' })
        return r
      } catch (err) {
        void invalidate(venueId, { kind: 'sale' })
        throw err
      }
    },
    [venueId, orderId, enviar, invalidate],
  )
  const iniciar = useCallback(() => correr('cancel-sale'), [correr])
  const liberar = useCallback((confirmacion: ConfirmacionDeLiberar) => correr('release-cancel', confirmacion), [correr])
  return { iniciar, liberar, enviando }
}
