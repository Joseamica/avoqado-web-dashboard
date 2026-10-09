import { describe, expect, it } from 'vitest'
import {
  anotarTanda,
  claveDelCuadre,
  claveDelEnvio,
  enviosPuedenAvanzar,
  fusionarEnvios,
  idsPendientes,
  intervaloDelResumen,
  siguienteTanda,
  textoProximoIntento,
  SHOPIFY_ERROR_MS,
  SHOPIFY_PROGRESS_MS,
  SHOPIFY_WAIT_MAX_MS,
} from '@/hooks/use-shopify'
import { conexionDetenida, SHOPIFY_ENVIOS_MAX, type ShopifyConnection, type ShopifyOverview, type ShopifyReview } from '@/types/shopify'

const c = (o: Partial<ShopifyConnection> = {}): ShopifyConnection => ({
  fase: 'ACTIVE',
  pausedFrom: null,
  estado: 'ACTIVA',
  shopDomain: 'x.myshopify.com',
  locationName: 'Tienda',
  importacion: { variantes: 0, error: null },
  aplicacion: null,
  conteos: { emparejados: 0, pendientes: 0, atorados: 0, inciertos: 0, porRevisar: 0, sinPareja: 0 },
  retrasoMin: null,
  cuadre: { pendiente: false, ultimo: null },
  proximoIntento: null,
  ...o,
})
const conteos = (pendientes: number) => ({ emparejados: 1, pendientes, atorados: 0, inciertos: 0, porRevisar: 0, sinPareja: 0 })
const o = (connection: ShopifyConnection | null, planActive = true): ShopifyOverview => ({ planActive, connection })
const pausada = (x: Partial<ShopifyConnection> = {}) => c({ fase: 'PAUSED', pausedFrom: 'ACTIVE', estado: 'PAUSADA', ...x })
const revocada = (x: Partial<ShopifyConnection> = {}) => c({ estado: 'REVOCADA', ...x })

describe('cuándo se vuelve a pedir el resumen', () => {
  it.each<[string, ShopifyOverview | undefined, number | false]>([
    ['sin datos', undefined, false],
    ['sin conexión', o(null), false],
    ['importando', o(c({ fase: 'CONNECTING', estado: 'IMPORTANDO' })), SHOPIFY_PROGRESS_MS],
    [
      'importando con una variante que falló (no es terminal: el worker reintenta)',
      o(c({ fase: 'CONNECTING', estado: 'IMPORTANDO', importacion: { variantes: 3, error: 'VARIANTE_FALLO' } })),
      SHOPIFY_PROGRESS_MS,
    ],
    [
      '🔴 importación detenida por catálogo muy grande (N7)',
      o(c({ fase: 'CONNECTING', estado: 'IMPORTANDO', importacion: { variantes: 0, error: 'CATALOGO_MUY_GRANDE' } })),
      false,
    ],
    [
      '🔴 aplicación detenida por falta de permiso (N7)',
      o(c({ fase: 'REVIEWING', estado: 'APLICANDO', importacion: { variantes: 9, error: 'FALTA_PERMISO' } })),
      false,
    ],
    [
      '🔴 importación detenida por el catálogo maestro',
      o(c({ fase: 'CONNECTING', estado: 'IMPORTANDO', importacion: { variantes: 12, error: 'CATALOGO_MAESTRO' } })),
      false,
    ],
    ['lista para revisar: espera a una persona', o(c({ fase: 'REVIEWING', estado: 'POR_APLICAR' })), false],
    ['activa sin nada en curso', o(c()), false],
    ['🔴 activa con un cuadre pedido (N6)', o(c({ cuadre: { pendiente: true, ultimo: null } })), SHOPIFY_PROGRESS_MS],
    ['activa con cambios en camino', o(c({ conteos: conteos(2) })), SHOPIFY_PROGRESS_MS],
    [
      '🔴 activa con cambios en camino pero SIN permiso: el worker no la toma (R2-4)',
      o(c({ conteos: conteos(2), importacion: { variantes: 9, error: 'FALTA_PERMISO' } })),
      false,
    ],
    ['🔴 activa con un cuadre pedido pero el plan inactivo (R2-4)', o(c({ cuadre: { pendiente: true, ultimo: null } }), false), false],
    ['pausada con cambios en camino (no se mueven: no se sondea)', o(pausada({ conteos: conteos(2) })), false],
    ['🔴 Z3: pausada con un cuadre pedido es ESTABLE (no se sondea)', o(pausada({ cuadre: { pendiente: true, ultimo: null } })), false],
    [
      '🔴 Z2: revocada con cambios en camino (detenida: no se sondea)',
      o(revocada({ conteos: conteos(3), cuadre: { pendiente: true, ultimo: null } })),
      false,
    ],
  ])('%s', (_caso, overview, esperado) => {
    expect(intervaloDelResumen(overview)).toBe(esperado)
  })

  it('🔴 con la última petición en error, el sondeo se espacia (sin tormenta de reintentos)', () => {
    expect(intervaloDelResumen(o(c({ conteos: conteos(2) })), { conError: true })).toBe(SHOPIFY_ERROR_MS)
    expect(intervaloDelResumen(o(c()), { conError: true })).toBe(false)
  })

  it('🔴 Y3: si el worker anunció su próximo intento, se espera a esa hora (con tope), no se pregunta cada 5 s', () => {
    const ahora = Date.parse('2026-10-09T18:00:00.000Z')
    const en = (ms: number) => new Date(ahora + ms).toISOString()
    const con = (ms: number) => o(c({ conteos: conteos(2), proximoIntento: en(ms) }))
    expect(intervaloDelResumen(con(20_000), { ahora })).toBe(20_000)
    expect(intervaloDelResumen(con(10 * 60_000), { ahora })).toBe(SHOPIFY_WAIT_MAX_MS)
    expect(intervaloDelResumen(con(1_000), { ahora })).toBe(SHOPIFY_PROGRESS_MS)
    expect(intervaloDelResumen(con(-60_000), { ahora })).toBe(SHOPIFY_PROGRESS_MS)
  })
})

describe('conexión detenida (Z2) y si los envíos pueden avanzar', () => {
  it.each<[string, ShopifyConnection, boolean]>([
    ['activa', c(), false],
    ['revocada', revocada(), true],
    ['falta permiso', c({ importacion: { variantes: 1, error: 'FALTA_PERMISO' } }), true],
    ['catálogo muy grande', c({ estado: 'IMPORTANDO', importacion: { variantes: 0, error: 'CATALOGO_MUY_GRANDE' } }), true],
    ['catálogo maestro', c({ estado: 'IMPORTANDO', importacion: { variantes: 0, error: 'CATALOGO_MAESTRO' } }), true],
    ['un error que el worker reintenta (no detiene)', c({ estado: 'IMPORTANDO', importacion: { variantes: 0, error: 'ERROR' } }), false],
    ['pausada (no es detenida: se reanuda sola)', pausada(), false],
  ])('%s', (_caso, conexion, detenida) => {
    expect(conexionDetenida(conexion)).toBe(detenida)
  })

  it('los envíos sólo avanzan con el plan activo, ACTIVA y sin error permanente', () => {
    expect(enviosPuedenAvanzar(o(c()))).toBe(true)
    expect(enviosPuedenAvanzar(o(c(), false))).toBe(false)
    expect(enviosPuedenAvanzar(o(pausada()))).toBe(false)
    expect(enviosPuedenAvanzar(o(revocada()))).toBe(false)
    expect(enviosPuedenAvanzar(o(c({ importacion: { variantes: 1, error: 'FALTA_PERMISO' } })))).toBe(false)
    expect(enviosPuedenAvanzar(undefined)).toBe(false)
    expect(enviosPuedenAvanzar(o(null))).toBe(false)
  })
})

describe('qué se dice del cuadre (Z3, L7)', () => {
  it.each<[string, ShopifyOverview, string | null]>([
    ['sin cuadre pedido', o(c()), null],
    ['activa con cuadre pedido', o(c({ cuadre: { pendiente: true, ultimo: null } })), 'status.resyncing'],
    [
      '🔴 pausada con cuadre pedido ⇒ «se cuadrará al reanudar», nunca «en curso»',
      o(pausada({ cuadre: { pendiente: true, ultimo: null } })),
      'status.resyncOnResume',
    ],
    [
      '🔴 activa con cuadre pedido pero sin acceso al piloto ⇒ tampoco «en curso»',
      o(c({ cuadre: { pendiente: true, ultimo: null } }), false),
      'status.resyncOnResume',
    ],
    ['🔴 Z2: detenida ⇒ no se pinta como avance', o(revocada({ cuadre: { pendiente: true, ultimo: null } })), null],
  ])('%s', (_caso, overview, clave) => {
    expect(claveDelCuadre(overview)).toBe(clave)
  })
})

const fila = (id: string, envio: ShopifyReview['envio'], x: Partial<ShopifyReview> = {}): ShopifyReview => ({
  id,
  status: envio ? 'RESOLVED' : 'OPEN',
  reason: 'DIFERENCIA',
  avoqadoQty: '1',
  shopifyQty: 1,
  atorados: 0,
  suggestion: 'SHOPIFY',
  choice: envio ? 'AVOQADO' : null,
  envio,
  createdAt: '2026-10-08T12:00:00.000Z',
  product: { id: `p-${id}`, name: id, sku: null },
  ...x,
})

describe('qué se dice de una elección ya hecha (Z7, L7)', () => {
  it.each<[string, ShopifyReview, ShopifyOverview, string | null]>([
    ['abierta: nada (se elige)', fila('a', null), o(c()), null],
    ['en camino con la conexión viva', fila('a', 'PENDIENTE'), o(c()), 'review.envio.PENDIENTE'],
    ['🔴 en camino con la conexión pausada ⇒ en pausa', fila('a', 'PENDIENTE'), o(pausada()), 'review.envioEnPausa'],
    ['🔴 en camino con la conexión detenida ⇒ en pausa', fila('a', 'PENDIENTE'), o(revocada()), 'review.envioEnPausa'],
    ['🔴 en camino sin acceso al piloto ⇒ en pausa', fila('a', 'PENDIENTE'), o(c(), false), 'review.envioEnPausa'],
    ['atorada', fila('a', 'ATORADO'), o(c()), 'review.envio.ATORADO'],
    ['llegó', fila('a', 'ENVIADO'), o(c()), 'review.envio.ENVIADO'],
    [
      '🔴 resuelta sin envío en camino: sólo lo que eligió, NUNCA «llegó»',
      fila('a', null, { status: 'RESOLVED', choice: 'AVOQADO' }),
      o(c()),
      'review.elegiste.AVOQADO',
    ],
    [
      'resuelta con el número de Shopify (no viaja nada)',
      fila('a', null, { status: 'RESOLVED', choice: 'SHOPIFY' }),
      o(c()),
      'review.elegiste.SHOPIFY',
    ],
  ])('%s', (_caso, item, overview, clave) => {
    expect(claveDelEnvio(item, overview)).toBe(clave)
  })
})

describe('«Lo vuelve a intentar a las HH:MM» (L6, Y3)', () => {
  const t = (k: string, v?: Record<string, unknown>) => `${k}|${v?.time}`
  // La hora la da `formatTime` de useVenueDateTime (zona del NEGOCIO); aquí sólo se comprueba que se use.
  const hora = (iso: string) => `hora(${iso})`
  it('con próximo intento ⇒ el texto con la hora del negocio', () => {
    expect(textoProximoIntento(c({ proximoIntento: '2026-10-09T18:05:00.000Z' }), hora, t)).toBe(
      'status.retryAt|hora(2026-10-09T18:05:00.000Z)',
    )
  })
  it('sin próximo intento, sin conexión o detenida ⇒ nada', () => {
    expect(textoProximoIntento(c(), hora, t)).toBeNull()
    expect(textoProximoIntento(null, hora, t)).toBeNull()
    expect(textoProximoIntento(revocada({ proximoIntento: '2026-10-09T18:05:00.000Z' }), hora, t)).toBeNull()
  })
})

describe('sondeo por tandas de las elecciones en camino (Codex R2-4, R3-3)', () => {
  const visto = (id: string, envio: ShopifyReview['envio'], at: number) => ({
    id,
    status: 'RESOLVED' as const,
    choice: 'AVOQADO' as const,
    envio,
    at,
  })
  const ids = Array.from({ length: 60 }, (_, n) => `r${String(n).padStart(2, '0')}`)

  it('🔴 lo observado DESPUÉS de recibir la página gana; lo de antes no, y las demás filas no cambian', () => {
    const a = fila('a', 'PENDIENTE')
    const b = fila('b', 'PENDIENTE')
    const c2 = fila('c', null)
    const filas = [
      { item: a, at: 100 },
      { item: b, at: 300 },
      { item: c2, at: 100 },
    ]
    expect(fusionarEnvios(filas, { a: visto('a', 'ENVIADO', 200), b: visto('b', 'ENVIADO', 200) })).toEqual([
      { ...a, envio: 'ENVIADO' },
      b,
      c2,
    ])
  })

  it('sin nada observado, las filas quedan igual', () => {
    const a = fila('a', 'PENDIENTE')
    expect(fusionarEnvios([{ item: a, at: 1 }], undefined)).toEqual([a])
  })

  it('🔴 Z7: una revisión que el server ya no devuelve deja de estar en camino (null), conserva su elección y no se vuelve a preguntar', () => {
    const a = fila('a', 'PENDIENTE')
    const fundidas = fusionarEnvios([{ item: a, at: 1 }], { a: { id: 'a', desaparecida: true, at: 2 } })
    expect(fundidas).toEqual([{ ...a, envio: null }])
    expect(idsPendientes(fundidas)).toEqual([])
  })

  it('🔴 Z7: lo que contesta una tanda se anota sobre lo previo; un id pedido que no volvió queda desaparecido', () => {
    const previo = { z: visto('z', 'ENVIADO', 1) }
    const r = anotarTanda(previo, ['b', 'a'], [{ id: 'a', status: 'RESOLVED', choice: 'AVOQADO', envio: 'ENVIADO' }], 5)
    expect(r).toEqual({ z: previo.z, a: visto('a', 'ENVIADO', 5), b: { id: 'b', desaparecida: true, at: 5 } })
  })

  it('una respuesta con un id que NO se pidió no se anota', () => {
    expect(anotarTanda({}, ['a'], [{ id: 'x', status: 'OPEN', choice: null, envio: null }], 5)).toEqual({
      a: { id: 'a', desaparecida: true, at: 5 },
    })
  })

  it('🔴 las pendientes salen del estado ACTUALIZADO: una que ya llegó deja de preguntarse', () => {
    const filas = [fila('b', 'PENDIENTE'), fila('a', 'PENDIENTE'), fila('c', 'ENVIADO'), fila('d', null)].map(item => ({ item, at: 1 }))
    expect(idsPendientes(fusionarEnvios(filas, { b: visto('b', 'ENVIADO', 2) }))).toEqual(['a'])
  })

  it('hasta 50 pendientes, una sola tanda con todas', () => {
    expect(siguienteTanda(ids.slice(0, 10), 'r05')).toEqual(ids.slice(0, 10))
  })

  it('🔴 con 60, la primera tanda son las primeras 50', () => {
    expect(siguienteTanda(ids, null)).toEqual(ids.slice(0, 50))
  })

  it('🔴 la siguiente tanda avanza después de la última preguntada y da la vuelta, sin pasar de 50', () => {
    const tanda = siguienteTanda(ids, 'r49')
    expect(tanda).toEqual([...ids.slice(50), ...ids.slice(0, 40)])
    expect(tanda).toHaveLength(SHOPIFY_ENVIOS_MAX)
  })
})
