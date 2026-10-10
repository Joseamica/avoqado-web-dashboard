/**
 * Conector Shopify — formas que devuelve el server (avoqado-server `shopify.overview.service.ts`, `shopify.connect.service.ts`)
 * y listas cerradas que la pantalla traduce. Si el server agrega un valor, se agrega aquí Y su texto en `shopify.json`: la
 * prueba de i18n lo exige.
 */
export const SHOPIFY_FEATURE = 'SHOPIFY_INTEGRATION'

/** Lo que ve el dueño. La revocación es de la TIENDA y gana sobre la fase (spec 12 bis.7). */
export const SHOPIFY_ESTADOS = ['IMPORTANDO', 'POR_APLICAR', 'APLICANDO', 'ACTIVA', 'PAUSADA', 'REVOCADA'] as const
export type ShopifyEstado = (typeof SHOPIFY_ESTADOS)[number]
export type ShopifyFase = 'CONNECTING' | 'REVIEWING' | 'ACTIVE' | 'PAUSED'

/**
 * `importacion.error` que DETIENE el trabajo hasta que alguien actúe (Codex N7): no se pinta como avance ni se sondea.
 * Es exactamente `SHOPIFY_IMPORT_ERRORES_VISIBLES` del server (= `SHOPIFY_IMPORT_ERRORES_TERMINALES`, mirror.service).
 * Cualquier otro valor (`VARIANTE_FALLO`, `ERROR`, otro código) lo reintenta el worker: texto genérico, no detenida (Z6).
 */
export const IMPORT_ERRORS_PERMANENTES = ['FALTA_PERMISO', 'CATALOGO_MUY_GRANDE', 'CATALOGO_MAESTRO'] as const
export type ImportErrorPermanente = (typeof IMPORT_ERRORS_PERMANENTES)[number]
export const esErrorPermanente = (e: string | null): e is ImportErrorPermanente =>
  !!e && (IMPORT_ERRORS_PERMANENTES as readonly string[]).includes(e)

export interface ShopifyConnection {
  fase: ShopifyFase
  pausedFrom: Exclude<ShopifyFase, 'PAUSED'> | null
  estado: ShopifyEstado
  shopDomain: string
  locationName: string
  /** `variantes` = variantes leídas (parejas + sin pareja). NO es `emparejados + sinPareja`: una suspendida cuenta una vez (Z5). */
  importacion: { variantes: number; error: string | null }
  aplicacion: { hechas: number; total: number } | null
  /**
   * Z5: `porRevisar` = sólo las OPEN; NO es el `total` de la lista «Por revisar» (ésa suma las RESOLVED en camino).
   * `sinPareja` = todas las de «Productos sin pareja», sin filtro e incluidas las suspendidas. `pendientes`, `atorados` e
   * `inciertos` son del buzón (generación vigente).
   */
  conteos: { emparejados: number; pendientes: number; atorados: number; inciertos: number; porRevisar: number; sinPareja: number }
  /** Minutos de la fila viva más vieja; null si no hay, si no está ACTIVA o si está detenida. */
  retrasoMin: number | null
  /** `pendiente` = cuadre pedido o a medias (sólo ACTIVE o PAUSED, nunca detenida); `ultimo` = última vuelta TERMINADA (ISO, Z4). */
  cuadre: { pendiente: boolean; ultimo: string | null }
  /** Cuándo lo vuelve a intentar el worker tras una unidad fallida (ISO, `nextWorkAt`); null sin espera o detenida (Y3, Z1). */
  proximoIntento: string | null
}
/** `connection: null` = nunca conectada o desconectada. */
export interface ShopifyOverview {
  planActive: boolean
  connection: ShopifyConnection | null
}

/**
 * Z2: detenida = la tienda retiró el permiso, o un error permanente. Nada avanza hasta que alguien actúe: se muestra con su
 * llamada a la acción, sin sondeo, y sus pendientes o retraso no se pintan como progreso. PAUSADA no es detenida.
 */
export const conexionDetenida = (c: ShopifyConnection): boolean => c.estado === 'REVOCADA' || esErrorPermanente(c.importacion.error)

export interface Pagina<T> {
  items: T[]
  total: number
  nextOffset: number | null
}

export type ShopifyChoice = 'AVOQADO' | 'SHOPIFY'
export const SHOPIFY_REVIEW_REASONS = ['DIFERENCIA', 'ATORADO', 'INCIERTO', 'REACTIVADA'] as const
export type ShopifyReviewReason = (typeof SHOPIFY_REVIEW_REASONS)[number]
/** Estado del envío de una elección «usar Avoqado», leído de SU fila del buzón (Codex N5), no de toda la sucursal. */
export const SHOPIFY_ENVIOS = ['PENDIENTE', 'ATORADO', 'ENVIADO'] as const
export type ShopifyEnvio = (typeof SHOPIFY_ENVIOS)[number]
export interface ShopifyReview {
  id: string
  /** OPEN = por decidir; RESOLVED = ya se eligió y su envío a Shopify sigue en camino, se atoró o acaba de llegar. */
  status: 'OPEN' | 'RESOLVED'
  /** `reason` y `suggestion` son los GUARDADOS: pueden estar viejos tras una reescritura (Z7); resolver revalida. */
  reason: ShopifyReviewReason
  /** Decimal del server como texto (`"5"`, `"2.5"`): se devuelve tal cual al resolver. */
  avoqadoQty: string
  shopifyQty: number
  atorados: number
  suggestion: ShopifyChoice
  choice: ShopifyChoice | null
  /** null en las OPEN; en una RESOLVED, null = ya NO está en camino (nunca «llegó», Z7). */
  envio: ShopifyEnvio | null
  createdAt: string
  product: { id: string; name: string; sku: string | null }
}
/** Estado vigente de una revisión para el sondeo acotado de «Por revisar» (Codex R2-4): sin cantidades ni producto. */
export interface ShopifyReviewEnvio {
  id: string
  status: 'OPEN' | 'RESOLVED'
  choice: ShopifyChoice | null
  envio: ShopifyEnvio | null
}
/** Tope de ids por vuelta del sondeo (el server rechaza más con 400). */
export const SHOPIFY_ENVIOS_MAX = 50
export type ShopifyResolveResult = { estado: 'RESUELTO' | 'ENVIO_PENDIENTE' }

export const SHOPIFY_ISSUE_REASONS = [
  'SIN_SKU',
  'SKU_REPETIDO',
  'SKU_CHOCA',
  'CODIGO_REPETIDO',
  'IDENTIDAD_EN_CONFLICTO',
  'PRODUCTO_ARCHIVADO',
  'METODO_RECETA',
  'TIPO_SIN_INVENTARIO',
  'SIN_INVENTARIO_EN_AVOQADO',
  'UNIDAD_NO_PIEZA',
  'SIN_PRECIO',
  'NIVEL_INEXISTENTE',
  'NO_RASTREADO',
  'SIN_INVENTARIO',
  'ERROR_IMPORTACION',
] as const
export type ShopifyIssueReason = (typeof SHOPIFY_ISSUE_REASONS)[number]
export interface ShopifyIssue {
  id: string
  title: string
  sku: string | null
  reason: ShopifyIssueReason
  /** Siempre null en ERROR_IMPORTACION (el server no saca el texto crudo): se usa el texto propio del motivo (Z8). */
  detail: string | null
  productId: string | null
  createdAt: string
}

export const CONNECT_REVIEW_FILTROS = ['CAMBIAN', 'NUEVOS', 'TODOS'] as const
export type ConnectReviewFiltro = (typeof CONNECT_REVIEW_FILTROS)[number]
export interface ShopifyConnectReviewItem {
  variantLinkId: string
  productId: string
  name: string
  sku: string | null
  avoqadoQty: string
  /** Lo que Shopify tenía al importar (`importedAvailable`): sólo dato secundario. */
  shopifyQty: number | null
  nuevo: boolean
  /** «Así quedará»: lo que deja «Aplicar» = lo de Shopify al importar + los cambios de la caja aún en camino (una venta resta). */
  quedara: string | null
}
export interface ShopifyConnectReview extends Pagina<ShopifyConnectReviewItem> {
  resumen: { emparejados: number; cambian: number; nuevos: number; sinPareja: number }
}
export interface ShopifyLocation {
  id: string
  name: string
  countryCode: string | null
}

/**
 * Códigos con texto propio (`errors.codes.<código>`): todos los que lanzan las rutas del conector, más el de venta suelta.
 * Uno que no esté aquí: si es `SHOPIFY_*` o un 400, el mensaje en español del server; si no, el genérico (Z6).
 */
export const SHOPIFY_ERROR_CODES = [
  // conectar
  'SHOPIFY_SOLO_PILOTO',
  'SHOPIFY_DOMINIO_INVALIDO',
  'SHOPIFY_SIN_CREDENCIALES',
  'SHOPIFY_REAUTORIZAR_SIN_TIENDA',
  'CATALOG_GOVERNANCE_REQUIRED',
  'SHOPIFY_INTENT_NO_EXISTE',
  'SHOPIFY_INTENT_DE_OTRA_PERSONA',
  'SHOPIFY_INTENT_YA_USADO',
  'SHOPIFY_INTENT_SIN_AUTORIZAR',
  'SHOPIFY_INTENT_EXPIRADO',
  'SHOPIFY_DEMASIADAS_UBICACIONES',
  'SHOPIFY_YA_CONECTADA',
  'SHOPIFY_UBICACION_YA_LIGADA',
  'SHOPIFY_TIENDA_DE_OTRA_EMPRESA',
  'SHOPIFY_UBICACION_INVALIDA',
  'SHOPIFY_ENVIO_EN_CAMINO',
  // aplicar, cuadrar
  'SHOPIFY_SIN_CONEXION',
  'SHOPIFY_NO_EN_REVISION',
  'SHOPIFY_NO_ACTIVA',
  // resolver
  'SHOPIFY_CANTIDAD_INVALIDA',
  'SHOPIFY_REVISION_NO_EXISTE',
  'SHOPIFY_REVISION_YA_RESUELTA',
  'SHOPIFY_REVISION_CAMBIO',
  'SHOPIFY_SIN_PAREJA',
  'SHOPIFY_PAREJA_SUSPENDIDA',
  'SHOPIFY_SIN_NIVEL',
  'SHOPIFY_SIN_INVENTARIO',
  'SHOPIFY_CAMBIOS_EN_CAMINO',
  'SHOPIFY_DIFERENCIA_NO_ENTERA',
  'SHOPIFY_EN_PAUSA',
  // en varias rutas
  'SHOPIFY_SIN_PLAN',
  'SHOPIFY_FALTA_PERMISO',
  'SHOPIFY_NO_RESPONDE',
  'FEATURE_NO_SE_VENDE_SUELTA',
] as const
export type ShopifyErrorCode = (typeof SHOPIFY_ERROR_CODES)[number]

/** `?error=` con el que regresa el callback de OAuth (B). Uno desconocido se dice con el texto genérico. */
export const SHOPIFY_CALLBACK_ERRORS = ['FIRMA', 'INTENT', 'USADO', 'EXPIRADO', 'TIENDA', 'INTERCAMBIO', 'DENEGADO'] as const
/** Avisos de la campanita (`ShopifyAviso` del server, notify.service): la página explica cada uno con su texto y qué hacer. */
export const SHOPIFY_AVISOS = [
  'REVOCADA',
  'ATORADOS',
  'RETRASO',
  'SOBREVENTA',
  'POR_REVISAR',
  'FALTA_PERMISO',
  'CONTEO_NO_APLICADO',
  'BARRIDO_OMITIDO',
] as const
