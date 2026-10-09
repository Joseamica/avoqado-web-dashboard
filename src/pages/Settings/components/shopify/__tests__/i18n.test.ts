/**
 * Paridad es/en del namespace `shopify` y las claves DINÁMICAS (prefijos que el código completa en tiempo de ejecución),
 * que el lint no puede seguir. fr no se soporta (founder, 28-sep-2026). Patrón: passes/__tests__/i18n.test.ts.
 */
import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import {
  CONNECT_REVIEW_FILTROS,
  IMPORT_ERRORS_PERMANENTES,
  SHOPIFY_AVISOS,
  SHOPIFY_CALLBACK_ERRORS,
  SHOPIFY_ENVIOS,
  SHOPIFY_ERROR_CODES,
  SHOPIFY_ESTADOS,
  SHOPIFY_ISSUE_REASONS,
  SHOPIFY_REVIEW_REASONS,
} from '@/types/shopify'

const LOCALES = path.resolve(__dirname, '../../../../../locales')
const IDIOMAS = ['es', 'en'] as const
const bundle = (lng: string, ns: string) =>
  JSON.parse(fs.readFileSync(path.join(LOCALES, lng, `${ns}.json`), 'utf-8')) as Record<string, unknown>
const aplanar = (o: Record<string, unknown>, p = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? aplanar(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`],
  )
const valor = (o: unknown, ruta: string) => ruta.split('.').reduce((n: any, k) => n?.[k], o)
const textos = (lng: string) => {
  const b = bundle(lng, 'shopify')
  return aplanar(b).map(k => String(valor(b, k)))
}

/** Prefijos dinámicos, con los valores REALES que el código puede producir. */
const DINAMICAS: Record<string, readonly string[]> = {
  estado: SHOPIFY_ESTADOS,
  'preview.filtros': CONNECT_REVIEW_FILTROS,
  'review.reasons': SHOPIFY_REVIEW_REASONS,
  'review.envio': SHOPIFY_ENVIOS,
  'review.elegiste': ['AVOQADO', 'SHOPIFY'],
  'issues.reasons': SHOPIFY_ISSUE_REASONS,
  'issues.reasonNames': SHOPIFY_ISSUE_REASONS,
  'errors.codes': SHOPIFY_ERROR_CODES,
  'connect.callbackErrors': [...SHOPIFY_CALLBACK_ERRORS, 'generic'],
  'connect.importErrors': [...IMPORT_ERRORS_PERMANENTES, 'generic'],
  'avisos.items': SHOPIFY_AVISOS.flatMap(a => [`${a}.title`, `${a}.body`]),
}
/** Claves que devuelven las funciones de `use-shopify` y `shopify.service` (el lint no las ve). */
const DE_LOS_AYUDANTES = [
  'status.resyncing',
  'status.resyncOnResume',
  'status.retryAt',
  'review.envioEnPausa',
  'errors.generic',
  'errors.planRequired',
  'errors.forbidden',
]

/**
 * Acciones de ActivityLog que escribe el servidor para Shopify (L16). Lista del server:
 * `grep -rnE "action:[^,]*SHOPIFY" src` en avoqado-server (servicios de commerce-channels/shopify y mcp/tools/shopify.ts).
 */
const ACCIONES_DE_AUDITORIA = [
  'SHOPIFY_APPLY_REQUESTED',
  'SHOPIFY_CATALOG_IMPORTED',
  'SHOPIFY_CONNECTED',
  'SHOPIFY_CONNECT_STARTED',
  'SHOPIFY_CREDENTIAL_RENEWED',
  'SHOPIFY_DISCONNECTED',
  'SHOPIFY_PAUSED',
  'SHOPIFY_PERMISSION_MISSING',
  'SHOPIFY_POR_REVISAR_EMAILED',
  'SHOPIFY_PRODUCT_ARCHIVED',
  'SHOPIFY_PRODUCT_RESTORED',
  'SHOPIFY_REAUTHORIZED',
  'SHOPIFY_RESUMED',
  'SHOPIFY_RESYNC_REQUESTED',
  'SHOPIFY_REVIEW_CLOSED',
  'SHOPIFY_REVIEW_OPENED',
  'SHOPIFY_REVIEW_RESOLVED',
  'SHOPIFY_STOCK_APPLIED',
  'SHOPIFY_STOCK_INITIALIZED',
  'SHOPIFY_STORE_REVOKED',
  'SHOPIFY_SYNC_STARTED',
  'MCP_SHOPIFY_CONNECT_APPLIED',
  'MCP_SHOPIFY_DISCONNECTED',
  'MCP_SHOPIFY_RESYNC',
  'MCP_SHOPIFY_REVIEW_RESOLVED',
]

describe('i18n del conector Shopify', () => {
  it('🔴 es y en tienen exactamente las MISMAS claves', () => {
    const [es, en] = IDIOMAS.map(l => aplanar(bundle(l, 'shopify')).sort())
    expect(en).toEqual(es)
  })

  it.each(IDIOMAS)('%s: cada clave dinámica y de los ayudantes existe y no está vacía', lng => {
    const b = bundle(lng, 'shopify')
    const claves = [...Object.entries(DINAMICAS).flatMap(([p, vs]) => vs.map(v => `${p}.${v}`)), ...DE_LOS_AYUDANTES]
    const faltan = claves.filter(k => typeof valor(b, k) !== 'string' || !(valor(b, k) as string).trim())
    expect(faltan).toEqual([])
  })

  it.each(IDIOMAS)('%s: ningún texto vende Shopify: ni Premium, ni subir de plan, ni comprar (Fase 1: piloto, Codex N2)', lng => {
    const vende = /premium|upgrade|sub(e|ir) de plan|compra|contrat|suscr|subscri|\bbuy\b/i
    expect(textos(lng).filter(t => vende.test(t))).toEqual([])
  })

  it.each(IDIOMAS)('🔴 %s: el texto del piloto y el de sin acceso no hablan de plan (un Premium pagado choca con SOLO_PILOTO)', lng => {
    const b = bundle(lng, 'shopify')
    const claves = [
      'errors.codes.SHOPIFY_SOLO_PILOTO',
      'errors.codes.SHOPIFY_SIN_PLAN',
      'errors.planRequired',
      'connect.soloPiloto',
      'piloto.body',
    ]
    expect(claves.filter(k => /\bplan\b|premium|\bsube\b/i.test(String(valor(b, k))))).toEqual([])
  })

  it('🔴 L22: el aviso de un conteo no aplicado explica los DOS motivos (en camino ⇒ minutos; duda ⇒ «Por revisar» primero)', () => {
    expect(String(valor(bundle('es', 'shopify'), 'avisos.items.CONTEO_NO_APLICADO.body'))).toMatch(/minutos[\s\S]*«Por revisar»/)
    expect(String(valor(bundle('en', 'shopify'), 'avisos.items.CONTEO_NO_APLICADO.body'))).toMatch(/minutes[\s\S]*«To review»/)
  })

  it('🔴 C7-M: el texto de la importación dice «reintentamos solos» y la bitácora «Se pidió aplicar el stock de Shopify»', () => {
    const es = bundle('es', 'shopify')
    expect(String(valor(es, 'connect.importErrors.generic'))).toMatch(/La reintentamos solos;/)
    expect(String(valor(bundle('es', 'organization'), 'activityLog.actions.SHOPIFY_APPLY_REQUESTED'))).toBe(
      'Se pidió aplicar el stock de Shopify',
    )
    expect(String(valor(bundle('en', 'organization'), 'activityLog.actions.SHOPIFY_APPLY_REQUESTED'))).toBe(
      'Applying the Shopify stock was requested',
    )
  })

  it.each(IDIOMAS)(
    '%s: apagado se explica y dice a quién pedirlo: sin permiso de ajustar inventario no se elige y se nombra al dueño o administrador',
    lng => {
      expect(String(valor(bundle(lng, 'shopify'), 'review.readOnlyResolve'))).toMatch(
        lng === 'es' ? /dueño o a un administrador/ : /owner or an administrator/,
      )
    },
  )

  it.each(IDIOMAS)('%s: la tarjeta de Integraciones tiene sus textos', lng => {
    const c = valor(bundle(lng, 'venue'), 'edit.integrations.catalog.shopify') as Record<string, string>
    expect(Object.keys(c).sort()).toEqual(['description', 'pilot', 'title'])
  })

  it.each(IDIOMAS)('🔴 %s: cada acción de auditoría de Shopify tiene su etiqueta en la bitácora (L16)', lng => {
    const etiquetas = valor(bundle(lng, 'organization'), 'activityLog.actions') as Record<string, string>
    expect(ACCIONES_DE_AUDITORIA.filter(a => !etiquetas[a]?.trim())).toEqual([])
  })
})
