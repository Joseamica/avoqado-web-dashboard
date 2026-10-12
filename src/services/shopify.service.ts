/**
 * Conector Shopify — API del dashboard. Montada en /api/v1/dashboard/venues/:venueId/shopify (avoqado-server, plan C2).
 * `inventory:read` lee · `settings:manage` conecta, reautoriza, aplica, desconecta, ve la vista previa y pide el cuadre ·
 * `inventory:adjust` resuelve. Conectar, reautorizar, ubicaciones, confirmar, aplicar, cuadrar y resolver piden además
 * acceso a SHOPIFY_INTEGRATION; leer, la vista previa y desconectar no: apagado se ve. El server envuelve todo en
 * `{ success, data }` y sus errores en `{ message, code? }`.
 */
import api from '@/api'
import { textoDelServidor } from '@/utils/apiError'
import {
  SHOPIFY_ERROR_CODES,
  SHOPIFY_FEATURE,
  type ConnectReviewFiltro,
  type Pagina,
  type ShopifyChoice,
  type ShopifyConnectChoice,
  type ShopifyConnectReview,
  type ShopifyErrorCode,
  type ShopifyIssue,
  type ShopifyIssueReason,
  type ShopifyLocation,
  type ShopifyOverview,
  type ShopifyResolveResult,
  type ShopifyReview,
  type ShopifyReviewEnvio,
  type ShopifyVistaConexion,
} from '@/types/shopify'

/** Página del server: ≤ 50; 20 cabe en pantalla con «Cargar más». */
export const SHOPIFY_PAGE_SIZE = 20
const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/shopify`
const texto = (q?: string) => q?.trim() || undefined

export const getShopifyOverview = async (venueId: string): Promise<ShopifyOverview> => (await api.get(base(venueId))).data.data

export const startShopifyConnect = async (venueId: string, shopDomain: string): Promise<{ url: string }> =>
  (await api.post(`${base(venueId)}/connect/start`, { shopDomain: shopDomain.trim().toLowerCase() })).data.data

/** Misma tienda de la conexión: el dueño no vuelve a escribir el dominio. */
export const reauthorizeShopify = async (venueId: string): Promise<{ url: string }> =>
  (await api.post(`${base(venueId)}/reauthorize/start`)).data.data

/**
 * 5a: conectar (`CONNECT` ⇒ `{ intent }`, y sigue la ubicación de siempre) o cambiar las llaves (`REAUTHORIZE` ⇒
 * `{ reautorizada: true }`) con la app que la tienda creó en su Dev Dashboard. El secret sólo viaja en este cuerpo: nada lo
 * devuelve ni se guarda en el navegador.
 */
export const connectShopifyOwnApp = async (
  venueId: string,
  purpose: 'CONNECT' | 'REAUTHORIZE',
  llaves: { shopDomain: string; clientId: string; clientSecret: string },
): Promise<{ intent: string } | { reautorizada: true }> =>
  (
    await api.post(`${base(venueId)}/${purpose === 'CONNECT' ? 'connect' : 'reauthorize'}/credentials`, {
      shopDomain: llaves.shopDomain.trim().toLowerCase(),
      clientId: llaves.clientId.trim(),
      clientSecret: llaves.clientSecret.trim(),
    })
  ).data.data

export const getShopifyLocations = async (venueId: string, intent: string): Promise<ShopifyLocation[]> =>
  (await api.get(`${base(venueId)}/connect/locations`, { params: { intent } })).data.data

/** Sólo la ubicación: el NOMBRE lo pone el servidor desde Shopify (Codex #22). */
export const confirmShopifyConnect = async (
  venueId: string,
  body: { intent: string; locationId: string },
): Promise<{ locationLinkId: string }> => (await api.post(`${base(venueId)}/connect/confirm`, body)).data.data

export const getShopifyConnectReview = async (
  venueId: string,
  o: { offset: number; filtro: ConnectReviewFiltro },
): Promise<ShopifyConnectReview> =>
  (await api.get(`${base(venueId)}/connect/review`, { params: { offset: o.offset, limit: SHOPIFY_PAGE_SIZE, filtro: o.filtro } })).data.data

export const applyShopifyConnect = async (venueId: string): Promise<{ solicitado: true }> =>
  (await api.post(`${base(venueId)}/connect/apply`)).data.data

/**
 * D1: guarda la elección de productos (o una para todos los que faltan) con la conexión y los números que el dueño VIO; si
 * ya cambiaron, 409 SHOPIFY_REVISION_CAMBIO o SHOPIFY_CONEXION_CAMBIO (RELEER). Se manda `elecciones` O `todos`, nunca los dos.
 */
export const saveShopifyConnectChoices = async (
  venueId: string,
  body: { vista: ShopifyVistaConexion; elecciones?: ShopifyConnectChoice[]; todos?: ShopifyChoice },
): Promise<{ guardadas: number; porDecidir: number }> => (await api.post(`${base(venueId)}/connect/choices`, body)).data.data

/** `desconectado: false` = no había nada que desconectar (L17). */
export const disconnectShopify = async (venueId: string): Promise<{ desconectado: boolean }> =>
  (await api.post(`${base(venueId)}/disconnect`)).data.data

export const resyncShopify = async (venueId: string): Promise<{ programado: true }> => (await api.post(`${base(venueId)}/resync`)).data.data

export const listShopifyReviews = async (venueId: string, o: { offset: number; q?: string }): Promise<Pagina<ShopifyReview>> =>
  (await api.get(`${base(venueId)}/reviews`, { params: { offset: o.offset, limit: SHOPIFY_PAGE_SIZE, q: texto(o.q) } })).data.data

/** Sondeo acotado (Codex R2-4): el estado de ≤ 50 elecciones en camino, en UNA petición; nunca las páginas de la lista. */
export const getShopifyReviewEnvios = async (venueId: string, ids: string[]): Promise<{ items: ShopifyReviewEnvio[] }> =>
  (await api.get(`${base(venueId)}/reviews/envios`, { params: { ids: ids.join(',') } })).data.data

/** Manda las cantidades que el dueño VIO: si ya no son las vigentes, el server contesta 409 SHOPIFY_REVISION_CAMBIO. */
export const resolveShopifyReview = async (
  venueId: string,
  reviewId: string,
  body: { choice: ShopifyChoice; expectedAvoqadoQty: string; expectedShopifyQty: number },
): Promise<ShopifyResolveResult> => (await api.post(`${base(venueId)}/reviews/${reviewId}/resolve`, body)).data.data

export const listShopifyIssues = async (
  venueId: string,
  o: { offset: number; q?: string; reason?: ShopifyIssueReason },
): Promise<Pagina<ShopifyIssue>> =>
  (await api.get(`${base(venueId)}/issues`, { params: { offset: o.offset, limit: SHOPIFY_PAGE_SIZE, q: texto(o.q), reason: o.reason } }))
    .data.data

// ─── Errores ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Qué hace la pantalla después del texto (L9, V3, T6):
 * - CONECTAR: ya no hay conexión que reautorizar ⇒ invalidar el resumen (`useInvalidateShopify`) y mostrar «Conectar».
 * - VOLVER_A_EMPEZAR: el intent venció, ya se usó o no existe ⇒ botón «Volver a empezar» (un OAuth nuevo).
 * - RELEER: lo que se vio ya no es lo vigente ⇒ invalidar y volver a leer; nunca reintentar a ciegas.
 * - REAUTORIZAR: falta un permiso o la conexión está en pausa/revocada ⇒ botón «Volver a dar permiso».
 * - REINTENTAR_LUEGO: algo va en camino o Shopify no contestó ⇒ decirlo y dejar intentar en un minuto (sin reintento solo).
 */
export type ShopifyErrorAccion = 'CONECTAR' | 'VOLVER_A_EMPEZAR' | 'RELEER' | 'REAUTORIZAR' | 'REINTENTAR_LUEGO'
const ACCIONES: Partial<Record<ShopifyErrorCode, ShopifyErrorAccion>> = {
  SHOPIFY_REAUTORIZAR_SIN_TIENDA: 'CONECTAR',
  SHOPIFY_INTENT_NO_EXISTE: 'VOLVER_A_EMPEZAR',
  SHOPIFY_INTENT_DE_OTRA_PERSONA: 'VOLVER_A_EMPEZAR',
  SHOPIFY_INTENT_YA_USADO: 'VOLVER_A_EMPEZAR',
  SHOPIFY_INTENT_SIN_AUTORIZAR: 'VOLVER_A_EMPEZAR',
  SHOPIFY_INTENT_EXPIRADO: 'VOLVER_A_EMPEZAR',
  // Codex C2: el intent nació antes de que otra sucursal cambiara las llaves; con las de hoy se empieza de nuevo.
  SHOPIFY_LLAVES_CAMBIARON: 'VOLVER_A_EMPEZAR',
  SHOPIFY_REVISION_CAMBIO: 'RELEER',
  SHOPIFY_REVISION_YA_RESUELTA: 'RELEER',
  SHOPIFY_REVISION_NO_EXISTE: 'RELEER',
  SHOPIFY_CANTIDAD_INVALIDA: 'RELEER',
  SHOPIFY_SIN_PAREJA: 'RELEER',
  SHOPIFY_PAREJA_SUSPENDIDA: 'RELEER',
  SHOPIFY_NO_EN_REVISION: 'RELEER',
  // D1: faltan decisiones (una venta invalidó una) o la conexión que se veía ya no es la vigente ⇒ se vuelve a leer la lista.
  SHOPIFY_FALTAN_DECISIONES: 'RELEER',
  SHOPIFY_CONEXION_CAMBIO: 'RELEER',
  SHOPIFY_SIN_CONEXION: 'RELEER',
  // C7-M(1): sin acceso, conexión no activa o ya conectada ⇒ el resumen que se vio está viejo: se vuelve a leer.
  SHOPIFY_NO_ACTIVA: 'RELEER',
  SHOPIFY_SIN_PLAN: 'RELEER',
  SHOPIFY_YA_CONECTADA: 'RELEER',
  SHOPIFY_FALTA_PERMISO: 'REAUTORIZAR',
  SHOPIFY_EN_PAUSA: 'REAUTORIZAR',
  SHOPIFY_NO_RESPONDE: 'REINTENTAR_LUEGO',
  SHOPIFY_CAMBIOS_EN_CAMINO: 'REINTENTAR_LUEGO',
  SHOPIFY_ENVIO_EN_CAMINO: 'REINTENTAR_LUEGO',
  // 5a: las llaves de la app de la tienda se corrigen en el mismo bloque (sin acción extra); `SHOPIFY_NO_RESPONDE` ya reintenta luego.
}
/**
 * Codex C5: Shopify rechazó las llaves de la app de la tienda. Con el bloque de llaves a la vista se corrigen ahí (sin acción); en el
 * asistente (ubicaciones o confirmar, cuando la llave del intent se renueva) no hay formulario: se empieza de nuevo y se vuelven a pegar.
 */
const LLAVES_RECHAZADAS: ReadonlySet<ShopifyErrorCode> = new Set<ShopifyErrorCode>([
  'SHOPIFY_APP_SECRET_INVALIDO',
  'SHOPIFY_APP_CLIENT_ID_INVALIDO',
  'SHOPIFY_APP_OTRA_ORGANIZACION',
  'SHOPIFY_APP_RECHAZADA',
  'SHOPIFY_TIENDA_NO_EXISTE',
  'SHOPIFY_APP_FALTAN_PERMISOS',
])

/** Clave relativa al namespace `shopify`; `texto` (si viene) es el mensaje en español del server y gana sobre la clave. */
export type ShopifyErrorVista = { clave: string; texto?: string; accion: ShopifyErrorAccion | null }
type RespuestaDeError = { response?: { status?: number; data?: unknown } }

/**
 * Cómo se dice un error del conector. En orden:
 * 1. 403 del candado del plan (`featureCode`, mensaje en inglés que dice «subscribe») ⇒ el texto del piloto (N2) y RELEER:
 *    el acceso se perdió a media sesión, el resumen (`planActive`) ya no es el que se ve.
 * 2. Un código conocido ⇒ su texto (y su acción). `SHOPIFY_SIN_PLAN` también es texto de piloto, nunca «actívalo».
 *    `SHOPIFY_APP_FALTAN_PERMISOS` lleva el texto del server, que nombra los permisos que faltan (la clave queda de respaldo).
 * 3. Otro 403 (el del permiso del rol, en inglés) ⇒ texto propio de permiso.
 * 4. Un `SHOPIFY_*` nuevo o un 400 de validación ⇒ el mensaje del server, que es español.
 * 5. Lo demás (5xx, HTML de un 502, sin red, código ajeno) ⇒ el genérico, nunca la jerga de axios (Z6).
 * `sinFormularioDeLlaves` (Codex C5): el error llegó donde no hay bloque de llaves (ubicaciones, confirmar); un rechazo de las llaves
 * lleva entonces «Volver a empezar».
 * `esComercio` (5a): la tienda está conectada con SU app; a esa app le falta el permiso en su versión (agregarlo, publicarla y
 * aprobarla), no un «acepta todo» de OAuth: `SHOPIFY_FALTA_PERMISO` dice entonces el texto de la app de la tienda.
 */
export function explicarErrorShopify(e: unknown, o: { sinFormularioDeLlaves?: boolean; esComercio?: boolean } = {}): ShopifyErrorVista {
  const r = (e as RespuestaDeError | null | undefined)?.response
  const data = (r?.data && typeof r.data === 'object' ? r.data : {}) as { code?: unknown; featureCode?: unknown }
  const code = typeof data.code === 'string' ? data.code : undefined
  if (r?.status === 403 && data.featureCode === SHOPIFY_FEATURE) return { clave: 'errors.planRequired', accion: 'RELEER' }
  if (code && (SHOPIFY_ERROR_CODES as readonly string[]).includes(code)) {
    const conocido = code as ShopifyErrorCode
    const accion = o.sinFormularioDeLlaves && LLAVES_RECHAZADAS.has(conocido) ? 'VOLVER_A_EMPEZAR' : (ACCIONES[conocido] ?? null)
    const clave = o.esComercio && conocido === 'SHOPIFY_FALTA_PERMISO' ? 'connect.appPropia.faltaPermiso' : `errors.codes.${code}`
    const vista: ShopifyErrorVista = { clave, accion }
    // Faltan permisos: el texto del server nombra CUÁLES (la clave fija no puede); sin texto, la clave.
    const texto = code === 'SHOPIFY_APP_FALTAN_PERMISOS' ? textoDelServidor(e) : undefined
    return texto ? { ...vista, texto } : vista
  }
  if (r?.status === 403) return { clave: 'errors.forbidden', accion: null }
  const delServidor = code?.startsWith('SHOPIFY_') || r?.status === 400 ? textoDelServidor(e) : undefined
  return delServidor ? { clave: 'errors.generic', texto: delServidor, accion: null } : { clave: 'errors.generic', accion: null }
}

/** El texto listo para pintar; `t` es el de `useTranslation('shopify')`. */
export const textoDeErrorShopify = (t: (clave: string) => string, e: unknown, o: { esComercio?: boolean } = {}): string => {
  const v = explicarErrorShopify(e, o)
  return v.texto ?? t(v.clave)
}
