/**
 * Conector Shopify — consultas del dashboard. Las claves cuelgan de ['shopify', venueId]. Qué refresca qué:
 * - una mutación de la conexión (conectar, aplicar, desconectar, resolver) invalida TODO el prefijo;
 * - «Cuadrar ahora» invalida SÓLO el resumen, que se sondea mientras `cuadre.pendiente`; al terminar (o al cambiar
 *   `cuadre.ultimo`), la página invalida las listas (Codex N6).
 * - Las consultas infinitas NUNCA se sondean (un refetch suyo vuelve a pedir TODAS las páginas cargadas, Codex R2-4). Las
 *   elecciones en camino de «Por revisar» se preguntan aparte, por tandas de ≤ 50 ids sobre el estado actualizado
 *   (`useShopifyEnviosEnCamino`, R3-3), y se funden por id sobre las filas cargadas.
 * - El resumen tampoco se sondea si nada puede avanzar (plan inactivo, pausada, detenida, Z2/Z3, R2-4). Si la última
 *   petición falló, se espacia a 30 s; si el worker anunció su próximo intento, se espera a esa hora (tope 60 s). Con la
 *   pestaña oculta React Query no sondea (`refetchIntervalInBackground` apagado).
 * El resumen y las listas no pasan por el candado del plan en el server (la pausa se ve): corren con `inventory:read`. La
 * vista previa y las ubicaciones piden `settings:manage`, como el server. Al cambiar de sucursal la página reinicia sus
 * componentes (`key={venueId}`), así que `keepPreviousData` nunca muestra filas de otra sucursal (N12).
 */
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAccess } from '@/hooks/use-access'
import { useVenueDateTime } from '@/utils/datetime'
import {
  getShopifyConnectReview,
  getShopifyLocations,
  getShopifyOverview,
  getShopifyReviewEnvios,
  listShopifyIssues,
  listShopifyReviews,
} from '@/services/shopify.service'
import {
  conexionDetenida,
  SHOPIFY_ENVIOS_MAX,
  type ConnectReviewFiltro,
  type Pagina,
  type ShopifyConnection,
  type ShopifyIssueReason,
  type ShopifyOverview,
  type ShopifyReview,
  type ShopifyReviewEnvio,
} from '@/types/shopify'

export const shopifyKeys = {
  all: (venueId: string | undefined) => ['shopify', venueId] as const,
  overview: (venueId: string | undefined) => ['shopify', venueId, 'overview'] as const,
  locations: (venueId: string | undefined, intent: string | null) => ['shopify', venueId, 'locations', intent] as const,
  connectReview: (venueId: string | undefined, filtro: ConnectReviewFiltro) => ['shopify', venueId, 'connect-review', filtro] as const,
  reviewsAll: (venueId: string | undefined) => ['shopify', venueId, 'reviews'] as const,
  reviews: (venueId: string | undefined, q: string) => ['shopify', venueId, 'reviews', q] as const,
  reviewEnvios: (venueId: string | undefined) => ['shopify', venueId, 'review-envios'] as const,
  issuesAll: (venueId: string | undefined) => ['shopify', venueId, 'issues'] as const,
  issues: (venueId: string | undefined, q: string, reason: ShopifyIssueReason | null) => ['shopify', venueId, 'issues', q, reason] as const,
}

/** Consultas pesadas: locales a estas queries, nunca en el QueryClient compartido. */
const HEAVY = { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } as const
/** Mientras hay algo en curso que el dueño espera ver terminar, se vuelve a pedir cada 5 s. */
export const SHOPIFY_PROGRESS_MS = 5_000
/** Tras una petición fallida: sin tormenta de reintentos mientras el server o la red se recuperan. */
export const SHOPIFY_ERROR_MS = 30_000
/** Tope de espera hasta el próximo intento anunciado del worker: la pantalla no se queda más de un minuto sin mirar. */
export const SHOPIFY_WAIT_MAX_MS = 60_000

/** Sólo con el plan activo, ACTIVA y sin error permanente avanzan los envíos a Shopify (el worker no toma lo demás). */
export function enviosPuedenAvanzar(o: ShopifyOverview | null | undefined): boolean {
  const c = o?.connection
  return !!o && !!c && o.planActive && c.estado === 'ACTIVA' && !conexionDetenida(c)
}

/**
 * Cuándo se vuelve a pedir el resumen: sólo si algo PUEDE avanzar solo. Con el plan inactivo, pausada o detenida (revocada o
 * un error permanente) el worker no toma la sucursal, así que no se sondea (N7, R2-4, Z2, Z3). Si no: importar o aplicar
 * avanzan solos; ya activa, un cuadre pedido o cambios en camino. `conError` espacia; `proximoIntento` se respeta (Y3).
 */
export function intervaloDelResumen(
  o: ShopifyOverview | null | undefined,
  { conError = false, ahora = Date.now() }: { conError?: boolean; ahora?: number } = {},
): number | false {
  const c = o?.connection
  if (!o || !c || !o.planActive || conexionDetenida(c)) return false
  const avanza =
    c.estado === 'IMPORTANDO' || c.estado === 'APLICANDO' || (c.estado === 'ACTIVA' && (c.cuadre.pendiente || c.conteos.pendientes > 0))
  if (!avanza) return false
  if (conError) return SHOPIFY_ERROR_MS
  const espera = c.proximoIntento ? Date.parse(c.proximoIntento) - ahora : NaN
  return espera > SHOPIFY_PROGRESS_MS ? Math.min(espera, SHOPIFY_WAIT_MAX_MS) : SHOPIFY_PROGRESS_MS
}

/**
 * Qué se dice del cuadre pedido (Z3, L7): «en curso» sólo si de verdad corre (ACTIVA con acceso); pausada o sin acceso, el
 * pedido es estable ⇒ «se cuadrará al reanudar»; detenida, nada (no es avance, Z2). Clave del namespace `shopify`.
 */
export function claveDelCuadre(o: ShopifyOverview | null | undefined): 'status.resyncing' | 'status.resyncOnResume' | null {
  const c = o?.connection
  if (!o || !c || !c.cuadre.pendiente || conexionDetenida(c)) return null
  return enviosPuedenAvanzar(o) ? 'status.resyncing' : 'status.resyncOnResume'
}

/**
 * Qué se dice de una elección ya hecha (Z7, L7). En camino con la conexión que no avanza (pausada, detenida o sin acceso)
 * ⇒ «En pausa: se enviará al reanudar». Sin envío (`null`) ya NO está en camino: sólo se dice qué eligió, nunca «llegó».
 */
export function claveDelEnvio(item: ShopifyReview, o: ShopifyOverview | null | undefined): string | null {
  if (item.status !== 'RESOLVED') return null
  if (item.envio === 'PENDIENTE') return enviosPuedenAvanzar(o) ? 'review.envio.PENDIENTE' : 'review.envioEnPausa'
  if (item.envio) return `review.envio.${item.envio}`
  return item.choice ? `review.elegiste.${item.choice}` : null
}

/** «Lo vuelve a intentar a las HH:MM» con la hora del NEGOCIO (`formatTime` de useVenueDateTime). Nada si no hay o está detenida. */
export function textoProximoIntento(
  c: ShopifyConnection | null | undefined,
  formatTime: (iso: string) => string,
  t: (clave: string, valores?: Record<string, unknown>) => string,
): string | null {
  if (!c?.proximoIntento || conexionDetenida(c)) return null
  return t('status.retryAt', { time: formatTime(c.proximoIntento) })
}

/** El texto del próximo intento listo para pintar (L6). */
export function useShopifyProximoIntento(c: ShopifyConnection | null | undefined): string | null {
  const { t } = useTranslation('shopify')
  const { formatTime } = useVenueDateTime()
  return textoProximoIntento(c, formatTime, (k, v) => t(k, v))
}

/** Una fila de «Por revisar» con el momento en que llegó SU página (para saber qué es más nuevo al fundir). */
export type FilaCargada = { item: ShopifyReview; at: number }
/** Lo que el sondeo vio de una revisión, y cuándo. `desaparecida`: se pidió y el server ya no la devuelve (Z7). */
export type EnvioObservado = (ShopifyReviewEnvio | { id: string; desaparecida: true }) & { at: number }
export type EnviosObservados = Record<string, EnvioObservado>

/**
 * Funde por id lo observado sobre las filas cargadas: gana lo observado DESPUÉS de recibir la página (R3-3). Una revisión
 * que desapareció ya no está en camino (`envio: null`) y conserva lo demás (Z7).
 */
export function fusionarEnvios(filas: FilaCargada[], observados: EnviosObservados | undefined): ShopifyReview[] {
  return filas.map(({ item, at }) => {
    const o = observados?.[item.id]
    if (!o || o.at < at) return item
    return 'desaparecida' in o ? { ...item, envio: null } : { ...item, status: o.status, choice: o.choice, envio: o.envio }
  })
}

/**
 * Anota lo que contestó una tanda sobre lo ya observado: cada id pedido que el server no devolvió queda desaparecido (una
 * revisión purgada o de otra sucursal: ya no está en camino, Z7); el orden de la respuesta no importa.
 */
export function anotarTanda(previo: EnviosObservados, tanda: string[], items: ShopifyReviewEnvio[], at: number): EnviosObservados {
  const vistos: EnviosObservados = Object.fromEntries(tanda.map(id => [id, { id, desaparecida: true as const, at }]))
  for (const e of items) if (tanda.includes(e.id)) vistos[e.id] = { ...e, at }
  return { ...previo, ...vistos }
}

/** Las elecciones que siguen en camino según el estado ACTUALIZADO, sin repetir y ordenadas. */
export function idsPendientes(items: ShopifyReview[]): string[] {
  return [...new Set(items.filter(i => i.envio === 'PENDIENTE').map(i => i.id))].sort()
}

/**
 * La siguiente tanda de ≤ 50 (R3-3): con más pendientes que el tope, empieza después de la última que se preguntó y da la
 * vuelta, así ninguna se queda sin preguntar aunque una tanda tarde o no cambie.
 */
export function siguienteTanda(pendientes: string[], despuesDe: string | null): string[] {
  const orden = [...new Set(pendientes)].sort()
  if (orden.length <= SHOPIFY_ENVIOS_MAX) return orden
  const i = despuesDe === null ? -1 : orden.findIndex(id => id > despuesDe)
  const desde = i < 0 ? 0 : i
  return [...orden.slice(desde), ...orden.slice(0, desde)].slice(0, SHOPIFY_ENVIOS_MAX)
}

export function useShopifyOverview(venueId: string | undefined) {
  const { can } = useAccess()
  return useQuery({
    queryKey: shopifyKeys.overview(venueId),
    queryFn: () => getShopifyOverview(venueId!),
    enabled: !!venueId && can('inventory:read'),
    ...HEAVY,
    refetchInterval: query => intervaloDelResumen(query.state.data, { conError: query.state.status === 'error' }),
  })
}

/** El intent es de un solo uso y vence: un 409 no se reintenta solo (se dice y se vuelve a empezar). */
export function useShopifyLocations(venueId: string | undefined, intent: string | null) {
  const { can } = useAccess()
  return useQuery({
    queryKey: shopifyKeys.locations(venueId, intent),
    queryFn: () => getShopifyLocations(venueId!, intent!),
    enabled: !!venueId && !!intent && can('settings:manage'),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  })
}

export function useShopifyConnectReview(venueId: string | undefined, filtro: ConnectReviewFiltro, enabled: boolean) {
  const { can } = useAccess()
  return useInfiniteQuery({
    queryKey: shopifyKeys.connectReview(venueId, filtro),
    queryFn: ({ pageParam }) => getShopifyConnectReview(venueId!, { offset: pageParam, filtro }),
    initialPageParam: 0,
    getNextPageParam: last => last.nextOffset ?? undefined,
    placeholderData: keepPreviousData,
    enabled: !!venueId && enabled && can('settings:manage'),
    ...HEAVY,
  })
}

export function useShopifyReviews(venueId: string | undefined, q: string, enabled: boolean) {
  const { can } = useAccess()
  return useInfiniteQuery({
    queryKey: shopifyKeys.reviews(venueId, q),
    // Cada página guarda cuándo llegó: el sondeo de envíos sólo gana sobre lo que es más viejo que lo que vio (R3-3).
    queryFn: async ({ pageParam }): Promise<Pagina<ShopifyReview> & { recibidoEn: number }> => ({
      ...(await listShopifyReviews(venueId!, { offset: pageParam, q })),
      recibidoEn: Date.now(),
    }),
    initialPageParam: 0,
    getNextPageParam: last => last.nextOffset ?? undefined,
    placeholderData: keepPreviousData,
    enabled: !!venueId && enabled && can('inventory:read'),
    ...HEAVY,
  })
}

/**
 * Sondeo ACOTADO de «Por revisar» (Codex R2-4, R3-3). Una petición cada 5 s con ≤ 50 ids, NUNCA las páginas cargadas:
 * - qué preguntar se elige sobre el estado ACTUALIZADO (lo ya observado cuenta), por tandas que avanzan y dan la vuelta;
 * - lo observado se acumula en la caché de esta sucursal y se conserva al cambiar de tanda; un id que el server ya no
 *   devuelve se marca desaparecido (deja de estar en camino y de preguntarse, Z7);
 * - se sigue mientras alguna fila cargada siga en camino, y sólo si `vivo` (`enviosPuedenAvanzar(resumen)`); tras un error,
 *   cada 30 s;
 * - una petición lenta no se encima con otra (React Query no lanza la siguiente mientras ésta vuela).
 * `filas` debe venir memoizada (`useMemo`). Devuelve las filas ya fundidas.
 */
export function useShopifyEnviosEnCamino(venueId: string | undefined, filas: FilaCargada[], vivo: boolean): ShopifyReview[] {
  const qc = useQueryClient()
  const { can } = useAccess()
  const key = shopifyKeys.reviewEnvios(venueId)
  const pendientes = idsPendientes(fusionarEnvios(filas, qc.getQueryData<EnviosObservados>(key)))
  const pendientesRef = useRef(pendientes)
  const ultimaPreguntada = useRef<string | null>(null)
  useEffect(() => {
    pendientesRef.current = pendientes
  })
  const activo = !!venueId && vivo && pendientes.length > 0 && can('inventory:read')
  const q = useQuery({
    queryKey: key,
    queryFn: async (): Promise<EnviosObservados> => {
      const previo = qc.getQueryData<EnviosObservados>(key) ?? {}
      const tanda = siguienteTanda(pendientesRef.current, ultimaPreguntada.current)
      if (tanda.length === 0) return previo
      ultimaPreguntada.current = tanda[tanda.length - 1]
      const { items } = await getShopifyReviewEnvios(venueId!, tanda)
      return anotarTanda(previo, tanda, items, Date.now())
    },
    enabled: activo,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchInterval: query => (activo ? (query.state.status === 'error' ? SHOPIFY_ERROR_MS : SHOPIFY_PROGRESS_MS) : false),
  })
  return useMemo(() => fusionarEnvios(filas, q.data), [filas, q.data])
}

export function useShopifyIssues(venueId: string | undefined, q: string, reason: ShopifyIssueReason | null, enabled: boolean) {
  const { can } = useAccess()
  return useInfiniteQuery({
    queryKey: shopifyKeys.issues(venueId, q, reason),
    queryFn: ({ pageParam }) => listShopifyIssues(venueId!, { offset: pageParam, q, reason: reason ?? undefined }),
    initialPageParam: 0,
    getNextPageParam: last => last.nextOffset ?? undefined,
    placeholderData: keepPreviousData,
    enabled: !!venueId && enabled && can('inventory:read'),
    ...HEAVY,
  })
}

/** Todo lo del conector (conectar, aplicar, desconectar, resolver; y la acción CONECTAR/RELEER de un error). */
export function useInvalidateShopify() {
  const qc = useQueryClient()
  return useCallback((venueId: string | undefined) => qc.invalidateQueries({ queryKey: shopifyKeys.all(venueId) }), [qc])
}

/** Sólo el resumen: «Cuadrar ahora» (el cuadre corre después, en el worker). */
export function useInvalidateShopifyResumen() {
  const qc = useQueryClient()
  return useCallback((venueId: string | undefined) => qc.invalidateQueries({ queryKey: shopifyKeys.overview(venueId) }), [qc])
}

/** Las dos listas que cambia un cuadre: al terminar el cuadre pedido. */
export function useInvalidateShopifyListas() {
  const qc = useQueryClient()
  return useCallback(
    (venueId: string | undefined) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: shopifyKeys.reviewsAll(venueId) }),
        qc.invalidateQueries({ queryKey: shopifyKeys.issuesAll(venueId) }),
      ]),
    [qc],
  )
}
