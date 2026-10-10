import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGet = vi.fn()
const mockPost = vi.fn()
vi.mock('@/api', () => ({ default: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) } }))

import * as s from '@/services/shopify.service'

const B = '/api/v1/dashboard/venues/v1/shopify'
beforeEach(() => {
  mockGet.mockReset().mockResolvedValue({ data: { success: true, data: 'ok' } })
  mockPost.mockReset().mockResolvedValue({ data: { success: true, data: 'ok' } })
})

describe('servicio del conector Shopify', () => {
  it('desenvuelve { success, data } del resumen', async () => {
    await expect(s.getShopifyOverview('v1')).resolves.toBe('ok')
    expect(mockGet).toHaveBeenCalledWith(B)
  })

  it('conectar manda el dominio limpio; confirmar manda SÓLO intent y ubicación (el nombre lo pone el servidor)', async () => {
    await s.startShopifyConnect('v1', '  Mi-Tienda.myshopify.com ')
    expect(mockPost).toHaveBeenCalledWith(`${B}/connect/start`, { shopDomain: 'mi-tienda.myshopify.com' })
    await s.getShopifyLocations('v1', 'intent-1')
    expect(mockGet).toHaveBeenCalledWith(`${B}/connect/locations`, { params: { intent: 'intent-1' } })
    await s.confirmShopifyConnect('v1', { intent: 'intent-1', locationId: 'gid://shopify/Location/1' })
    expect(mockPost).toHaveBeenCalledWith(`${B}/connect/confirm`, { intent: 'intent-1', locationId: 'gid://shopify/Location/1' })
  })

  it('las listas piden páginas de 20 con búsqueda y filtros del SERVIDOR; una búsqueda vacía no viaja', async () => {
    await s.getShopifyConnectReview('v1', { offset: 20, filtro: 'NUEVOS' })
    expect(mockGet).toHaveBeenCalledWith(`${B}/connect/review`, { params: { offset: 20, limit: 20, filtro: 'NUEVOS' } })
    await s.listShopifyReviews('v1', { offset: 0, q: '  ' })
    expect(mockGet).toHaveBeenCalledWith(`${B}/reviews`, { params: { offset: 0, limit: 20, q: undefined } })
    await s.listShopifyIssues('v1', { offset: 40, q: 'gorra', reason: 'SIN_SKU' })
    expect(mockGet).toHaveBeenCalledWith(`${B}/issues`, { params: { offset: 40, limit: 20, q: 'gorra', reason: 'SIN_SKU' } })
  })

  it('🔴 el sondeo de las elecciones en camino pide SÓLO esos ids, en una petición (R2-4)', async () => {
    await s.getShopifyReviewEnvios('v1', ['r1', 'r2'])
    expect(mockGet).toHaveBeenCalledWith(`${B}/reviews/envios`, { params: { ids: 'r1,r2' } })
  })

  it('resolver manda la elección con las cantidades que se vieron', async () => {
    await s.resolveShopifyReview('v1', 'r1', { choice: 'AVOQADO', expectedAvoqadoQty: '5', expectedShopifyQty: 4 })
    expect(mockPost).toHaveBeenCalledWith(`${B}/reviews/r1/resolve`, { choice: 'AVOQADO', expectedAvoqadoQty: '5', expectedShopifyQty: 4 })
  })

  it('reautorizar, aplicar, desconectar y cuadrar van cada uno a su ruta', async () => {
    await s.reauthorizeShopify('v1')
    await s.applyShopifyConnect('v1')
    await s.disconnectShopify('v1')
    await s.resyncShopify('v1')
    expect(mockPost.mock.calls.map(c => c[0])).toEqual([`${B}/reauthorize/start`, `${B}/connect/apply`, `${B}/disconnect`, `${B}/resync`])
  })
})

/** Un error de axios como lo arma el manejador global del server: `{ message, code? }`. */
const http = (status: number, data?: unknown) => Object.assign(new Error('Request failed'), { response: { status, data } })

describe('qué texto y qué acción lleva cada error del servidor (L9, V3, T6, N2)', () => {
  it.each<[string, s.ShopifyErrorAccion | null]>([
    ['SHOPIFY_REAUTORIZAR_SIN_TIENDA', 'CONECTAR'],
    ['SHOPIFY_INTENT_EXPIRADO', 'VOLVER_A_EMPEZAR'],
    ['SHOPIFY_INTENT_YA_USADO', 'VOLVER_A_EMPEZAR'],
    ['SHOPIFY_INTENT_NO_EXISTE', 'VOLVER_A_EMPEZAR'],
    ['SHOPIFY_REVISION_CAMBIO', 'RELEER'],
    ['SHOPIFY_REVISION_YA_RESUELTA', 'RELEER'],
    ['SHOPIFY_NO_RESPONDE', 'REINTENTAR_LUEGO'],
    ['SHOPIFY_CAMBIOS_EN_CAMINO', 'REINTENTAR_LUEGO'],
    ['SHOPIFY_ENVIO_EN_CAMINO', 'REINTENTAR_LUEGO'],
    ['SHOPIFY_FALTA_PERMISO', 'REAUTORIZAR'],
    ['SHOPIFY_EN_PAUSA', 'REAUTORIZAR'],
    ['SHOPIFY_SOLO_PILOTO', null],
    // C7-M(1): perder el acceso, que la conexión ya no esté activa o que ya exista otra ⇒ lo que se ve está viejo: se vuelve a leer.
    ['SHOPIFY_NO_ACTIVA', 'RELEER'],
    ['SHOPIFY_SIN_PLAN', 'RELEER'],
    ['SHOPIFY_YA_CONECTADA', 'RELEER'],
    ['SHOPIFY_DIFERENCIA_NO_ENTERA', null],
    ['FEATURE_NO_SE_VENDE_SUELTA', null],
  ])('%s ⇒ su propio texto y la acción %s', (code, accion) => {
    expect(s.explicarErrorShopify(http(409, { message: 'texto del server', code }))).toEqual({ clave: `errors.codes.${code}`, accion })
  })

  it('🔴 sin plan (403 de checkFeatureAccess, en inglés) ⇒ el texto del piloto, nunca el mensaje del server', () => {
    const e = http(403, { error: 'Feature not available', message: 'Please subscribe', featureCode: 'SHOPIFY_INTEGRATION' })
    expect(s.explicarErrorShopify(e)).toEqual({ clave: 'errors.planRequired', accion: 'RELEER' })
  })

  it('🔴 SHOPIFY_SIN_PLAN (el server dice «actívalo») ⇒ también el texto del piloto (N2)', () => {
    expect(s.explicarErrorShopify(http(403, { message: 'actívalo', code: 'SHOPIFY_SIN_PLAN' })).clave).toBe('errors.codes.SHOPIFY_SIN_PLAN')
  })

  it('un 403 sin código (permiso del rol, mensaje en inglés) ⇒ texto propio de permiso', () => {
    expect(s.explicarErrorShopify(http(403, { error: 'Forbidden', message: 'No access to this venue' }))).toEqual({
      clave: 'errors.forbidden',
      accion: null,
    })
  })

  it('un código SHOPIFY_ que la pantalla no conoce ⇒ el mensaje en español del server', () => {
    expect(s.explicarErrorShopify(http(409, { message: 'Algo nuevo del server', code: 'SHOPIFY_ALGO_NUEVO' }))).toEqual({
      clave: 'errors.generic',
      texto: 'Algo nuevo del server',
      accion: null,
    })
  })

  it('un 400 de validación (español) ⇒ el mensaje del server', () => {
    expect(s.explicarErrorShopify(http(400, { message: 'Error de validación: El límite máximo es 50' })).texto).toBe(
      'Error de validación: El límite máximo es 50',
    )
  })

  it('🔴 Z6: código desconocido ajeno, 5xx, HTML de un 502 o sin red ⇒ el genérico (nunca jerga de axios)', () => {
    for (const e of [
      http(409, { message: 'Some English', code: 'OTHER_CODE' }),
      http(500, { message: 'boom' }),
      http(502, '<html>'),
      new Error('Network Error'),
      undefined,
    ]) {
      expect(s.explicarErrorShopify(e)).toEqual({ clave: 'errors.generic', accion: null })
    }
  })

  it('textoDeErrorShopify traduce la clave o usa el texto del server', () => {
    const t = (k: string) => `t:${k}`
    expect(s.textoDeErrorShopify(t, http(409, { code: 'SHOPIFY_NO_ACTIVA' }))).toBe('t:errors.codes.SHOPIFY_NO_ACTIVA')
    expect(s.textoDeErrorShopify(t, http(409, { message: 'Del server', code: 'SHOPIFY_X' }))).toBe('Del server')
    expect(s.textoDeErrorShopify(t, new Error('Network Error'))).toBe('t:errors.generic')
  })
})
