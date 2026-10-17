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
import { olvidar, quedoEnDuda, useEnvioUnico } from '@/pages/Commissions/envioUnico'
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

/**
 * Lo que pide el server para TODA lectura de tarjetas: un negocio y `giftCards:read`. `esperando` = los permisos todavía no
 * llegan (recarga en frío: la guardia deja pasar y `can()` da false); ver `cargandoSiEspera`.
 */
function usePuedeLeer(venueId: string | undefined): { puede: boolean; esperando: boolean } {
  const { can, isLoading } = useAccess()
  return { puede: !!venueId && can('giftCards:read'), esperando: !!venueId && isLoading }
}

/**
 * D6 r1 (M2): con los permisos en camino la consulta queda apagada y SIN datos, que en TanStack v5 no es «cargando» ni
 * «error»: las pantallas caían un instante en «no se pudo cargar» o «aún no hay». Aquí cuenta como cargando, así lo heredan
 * todas. Con datos ya en caché se enseñan (nunca se tapan con un «cargando»).
 */
function cargandoSiEspera<Q extends { isLoading: boolean; data: unknown }>(query: Q, esperando: boolean): Q {
  return esperando && query.data === undefined ? { ...query, isLoading: true } : query
}

export function useGiftCardSettings(venueId: string | undefined) {
  const { puede: enabled, esperando } = usePuedeLeer(venueId)
  const query = useQuery({ queryKey: giftCardKeys.settings(venueId), queryFn: () => getGiftCardSettings(venueId!), enabled, ...HEAVY })
  return cargandoSiEspera(query, esperando)
}

/** Lista paginada en el server. Búsqueda y estados van en la clave ⇒ `keepPreviousData`: teclear no desmonta la tabla. */
export function useGiftCardList(venueId: string | undefined, filters: GiftCardListFilters) {
  const { puede: enabled, esperando } = usePuedeLeer(venueId)
  const query = useInfiniteQuery({
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
  return cargandoSiEspera(query, esperando)
}

/** Detalle + libreta por cursor. Sólo corre con una tarjeta abierta (la hoja cerrada no pide nada). */
export function useGiftCardDetail(venueId: string | undefined, giftCardId: string | null) {
  const { puede, esperando } = usePuedeLeer(venueId)
  const enabled = puede && !!giftCardId
  const query = useInfiniteQuery({
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
  return cargandoSiEspera(query, esperando && !!giftCardId)
}

export function useGiftCardSummary(venueId: string | undefined, from: string, to: string) {
  const { puede, esperando } = usePuedeLeer(venueId)
  const enabled = puede && !!from && !!to
  const query = useQuery({
    queryKey: giftCardKeys.summary(venueId, from, to),
    queryFn: () => getGiftCardSummary(venueId!, { from, to }),
    enabled,
    ...HEAVY,
  })
  return cargandoSiEspera(query, esperando && !!from && !!to)
}

export function useGiftCardAging(venueId: string | undefined, at: string) {
  const { puede, esperando } = usePuedeLeer(venueId)
  const enabled = puede && !!at
  const query = useQuery({ queryKey: giftCardKeys.aging(venueId, at), queryFn: () => getGiftCardAging(venueId!, at), enabled, ...HEAVY })
  return cargandoSiEspera(query, esperando && !!at)
}

export function useGiftCardPendingAccounting(venueId: string | undefined, from: string, to: string) {
  const { puede, esperando } = usePuedeLeer(venueId)
  const enabled = puede && !!from && !!to
  const query = useInfiniteQuery({
    queryKey: giftCardKeys.pending(venueId, from, to),
    queryFn: ({ pageParam }) =>
      listGiftCardPendingAccounting(venueId!, { page: pageParam, pageSize: PENDING_ACCOUNTING_PAGE_SIZE, from, to }),
    initialPageParam: 1,
    getNextPageParam: last => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    enabled,
    placeholderData: keepPreviousData,
    ...HEAVY,
  })
  return cargandoSiEspera(query, esperando && !!from && !!to)
}

/**
 * Invalida SÓLO lo que lee lo que cambió y devuelve la promesa de la relectura. Los ajustes la esperan; las acciones del gerente
 * NO (D4 r1, I2: su diálogo termina con la respuesta del server; «liberar» la lee después para decir lo que el server muestra).
 *   'settings' — ajustes y tipos de pago (prender crea el tender de sistema «Tarjeta de regalo», R4).
 *   'card'     — la lista, el detalle de ESA tarjeta y los reportes (un ajuste mueve el saldo vivo y la antigüedad).
 *   'sale'     — cancelar una venta toca TODAS sus tarjetas, y bloquear/desbloquear una cambia el `cancel` de sus hermanas:
 *                la lista, todos los detalles y los reportes.
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

/**
 * D4 r1 (I1): el CUERPO exacto de cada intento que quedó EN DUDA (sin respuesta, 5xx o «en curso»), por tarjeta (o venta) y
 * acción. Como su llave en envioUnico, vive fuera de los componentes: cerrar, desmontar o reabrir el diálogo NO lo pierde, y
 * rehacerlo con la misma llave lo deduplica el server (exactamente una vez). Mover un saldo dos veces es peor que tragarse una
 * vez un ajuste idéntico deliberado. Se borra con el éxito, con una respuesta definitiva o con «Descartar este intento».
 */
const enDuda = new Map<string, unknown>()
/** Sólo para las pruebas: olvida los intentos en duda. */
export const olvidarIntentosEnDuda = () => enDuda.clear()
/** En duda, el intento se queda; ante una respuesta definitiva se va (su llave ya la tiró envioUnico). */
const anotarFallo = (k: string, intento: unknown, err: unknown) => {
  if (quedoEnDuda(err)) enDuda.set(k, intento)
  else enDuda.delete(k)
}

/** La huella de una operación: misma tarjeta (o venta) + mismo contenido ⇒ misma llave hasta una respuesta definitiva. */
export const huellaDeOperacion = (alcance: string, contenido: unknown): string => `gift-card:${alcance}:${JSON.stringify(contenido)}`
type AccionDeVenta = 'cancel-sale' | 'release-cancel'
/** Lo que se recuerda de un intento de cancelar o liberar que quedó en duda: la «foto» de la cancelación al intentarlo. */
type IntentoDeVenta = { estado: string }

/**
 * Ajustar, bloquear, desbloquear o reponer UNA tarjeta. `operar` devuelve `undefined` si ya hay otra operación en vuelo
 * (candado síncrono de useEnvioUnico: un doble clic no manda dos). Pase lo que pase la pantalla vuelve a leer, SIN esperarlo
 * (D4 r1, I2: esperar la relectura dejaba el botón vivo tras el éxito y un segundo clic era otra operación con llave nueva).
 * En duda, el cuerpo queda en `intentoEnDuda(tipo)` (y su llave en envioUnico) hasta el éxito, una respuesta definitiva o
 * `descartarIntento(tipo)` («Descartar este intento»). Bloquear y desbloquear se dejan atrás uno al otro: tras uno que salió
 * bien, repetir el otro con su llave vieja haría que el server respondiera «hecho» sin hacerlo.
 */
export function useGiftCardOperation(venueId: string | undefined, giftCardId: string) {
  const { enviar, enviando } = useEnvioUnico()
  const invalidate = useInvalidateGiftCards()
  const llaveDe = useCallback((tipo: GiftCardOperation['tipo']) => `${giftCardId}:${tipo}`, [giftCardId])
  const intentoEnDuda = useCallback(
    (tipo: GiftCardOperation['tipo']) => enDuda.get(llaveDe(tipo)) as GiftCardOperation | undefined,
    [llaveDe],
  )
  const descartarIntento = useCallback(
    (tipo: GiftCardOperation['tipo']) => {
      const previo = intentoEnDuda(tipo)
      if (previo) olvidar(huellaDeOperacion(giftCardId, previo))
      enDuda.delete(llaveDe(tipo))
    },
    [giftCardId, intentoEnDuda, llaveDe],
  )
  const operar = useCallback(
    async (op: GiftCardOperation): Promise<GiftCardOperationResult | undefined> => {
      if (!venueId) return undefined
      // Bloquear o desbloquear cambia el `cancel` de las HERMANAS de la venta (r1, M4): se releen todos los detalles.
      const cambio: GiftCardChange = op.tipo === 'BLOQUEAR' || op.tipo === 'DESBLOQUEAR' ? { kind: 'sale' } : { kind: 'card', giftCardId }
      try {
        const r = await enviar(huellaDeOperacion(giftCardId, op), paso =>
          paso('operacion', operationKey => operateGiftCard(venueId, giftCardId, { ...op, operationKey })),
        )
        if (r) {
          enDuda.delete(llaveDe(op.tipo))
          if (op.tipo === 'BLOQUEAR') descartarIntento('DESBLOQUEAR')
          if (op.tipo === 'DESBLOQUEAR') descartarIntento('BLOQUEAR')
          void invalidate(venueId, cambio)
        }
        return r
      } catch (err) {
        anotarFallo(llaveDe(op.tipo), op, err)
        void invalidate(venueId, cambio)
        throw err
      }
    },
    [venueId, giftCardId, enviar, invalidate, llaveDe, descartarIntento],
  )
  return { operar, enviando, intentoEnDuda, descartarIntento }
}

/**
 * Empezar o detener la cancelación de una venta de tarjetas (spec §5.6). Cada una es su propia operación con su llave, y su
 * huella lleva la «foto» de la cancelación al intentar (`estado`, de `estadoDeCancelacion`; D4 r1, I1.3): si la foto cambió
 * —otra cancelación, otra liberación o cualquier movimiento: la libreta sólo crece— ya es OTRA operación, con llave nueva.
 * Así una llave vieja de liberar nunca se repite sobre una cancelación nueva (el server respondería «liberada» sin liberar).
 * Liberar pide la confirmación EXPLÍCITA de que la devolución NO se hizo (F6): un *timeout* no lo prueba.
 * En duda, el intento queda en `intentoEnDuda(accion, estadoActual)` (sólo mientras la foto siga igual) hasta el éxito, una
 * respuesta definitiva o `descartarIntento(accion)`. Cuando una sale bien, la otra de ESA venta se descarta (r1, M3).
 * Devuelve `{ refresco }`: la relectura NO se espera para cerrar (I2), pero «liberar» la lee para no decir «se pueden usar
 * otra vez» si el server las sigue mostrando bloqueadas.
 */
export function useGiftCardSaleCancel(venueId: string | undefined, orderId: string) {
  const { enviar, enviando } = useEnvioUnico()
  const invalidate = useInvalidateGiftCards()
  const llaveDe = useCallback((accion: AccionDeVenta) => `${orderId}:${accion}`, [orderId])
  const huellaDe = useCallback((accion: AccionDeVenta, estado: string) => huellaDeOperacion(orderId, { accion, estado }), [orderId])
  const intentoEnDuda = useCallback(
    (accion: AccionDeVenta, estadoActual: string) => {
      const previo = enDuda.get(llaveDe(accion)) as IntentoDeVenta | undefined
      return previo?.estado === estadoActual ? previo : undefined
    },
    [llaveDe],
  )
  const descartarIntento = useCallback(
    (accion: AccionDeVenta) => {
      const previo = enDuda.get(llaveDe(accion)) as IntentoDeVenta | undefined
      if (previo) olvidar(huellaDe(accion, previo.estado))
      enDuda.delete(llaveDe(accion))
    },
    [llaveDe, huellaDe],
  )
  const correr = useCallback(
    async (accion: AccionDeVenta, estado: string, confirmacion?: ConfirmacionDeLiberar): Promise<{ refresco: Promise<unknown> } | undefined> => {
      if (!venueId) return undefined
      if (accion === 'release-cancel' && confirmacion?.confirmacionNoDevuelto !== true) return undefined
      try {
        const r = await enviar(huellaDe(accion, estado), paso =>
          // `<unknown>`: las dos ramas responden distinto ({ giftCardIds } / { released }); sin él, TS fija T con la primera.
          paso<unknown>(accion, operationKey =>
            accion === 'cancel-sale'
              ? startGiftCardSaleCancel(venueId, orderId, operationKey)
              : releaseGiftCardSaleCancel(venueId, orderId, operationKey, { confirmacionNoDevuelto: true }),
          ),
        )
        if (!r) return undefined
        enDuda.delete(llaveDe(accion))
        descartarIntento(accion === 'cancel-sale' ? 'release-cancel' : 'cancel-sale')
        return { refresco: invalidate(venueId, { kind: 'sale' }) }
      } catch (err) {
        anotarFallo(llaveDe(accion), { estado } satisfies IntentoDeVenta, err)
        void invalidate(venueId, { kind: 'sale' })
        throw err
      }
    },
    [venueId, orderId, enviar, invalidate, llaveDe, huellaDe, descartarIntento],
  )
  const iniciar = useCallback((estado: string) => correr('cancel-sale', estado), [correr])
  const liberar = useCallback(
    (confirmacion: ConfirmacionDeLiberar, estado: string) => correr('release-cancel', estado, confirmacion),
    [correr],
  )
  return { iniciar, liberar, enviando, intentoEnDuda, descartarIntento }
}
