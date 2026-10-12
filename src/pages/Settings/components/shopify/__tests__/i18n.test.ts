/**
 * Paridad es/en del namespace `shopify` y las claves DINÁMICAS (prefijos que el código completa en tiempo de ejecución),
 * que el lint no puede seguir. fr no se soporta (founder, 28-sep-2026). Patrón: passes/__tests__/i18n.test.ts.
 */
import fs from 'fs'
import path from 'path'
import i18next from 'i18next'
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
  'connect.appPropia.pasos': ['1', '2', '3', '4', '5', '6'],
}
/** Claves que devuelven las funciones de `use-shopify` y `shopify.service` (el lint no las ve). */
const DE_LOS_AYUDANTES = [
  'status.pendingSync',
  'preview.devuelta',
  'status.resyncing',
  'status.resyncOnResume',
  'status.retryAt',
  'review.envioEnPausa',
  'errors.generic',
  'errors.planRequired',
  'errors.forbidden',
  'connect.appPropia.faltaPermiso', // claveDeImportacionDetenida (Codex C6)
]

/**
 * Acciones de ActivityLog que escribe el servidor para Shopify (L16). Lista del server:
 * `grep -rnE "action:[^,]*SHOPIFY" src` en avoqado-server (servicios de commerce-channels/shopify y mcp/tools/shopify.ts).
 */
const ACCIONES_DE_AUDITORIA = [
  'SHOPIFY_APPLY_REQUESTED',
  'SHOPIFY_APPLY_RETURNED',
  'SHOPIFY_CATALOG_IMPORTED',
  'SHOPIFY_CONNECTED',
  'SHOPIFY_CONNECT_CHOICES_SAVED',
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
  'MCP_SHOPIFY_CONNECT_CHOICES_SAVED',
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

  it('🔴 L22: el aviso de un conteo no aplicado explica los DOS motivos (sincronizando ⇒ recontar al terminar; duda ⇒ «Por revisar» primero)', () => {
    // Ronda 3: sin «minutos». La retención también cubre una pareja sin iniciar o una conexión en revisión, y eso puede tardar.
    const es = String(valor(bundle('es', 'shopify'), 'avisos.items.CONTEO_NO_APLICADO.body'))
    const en = String(valor(bundle('en', 'shopify'), 'avisos.items.CONTEO_NO_APLICADO.body'))
    expect(es).toMatch(/sincronizando con Shopify, vuelve a contarlo cuando termine[\s\S]*«Por revisar»/)
    expect(en).toMatch(/syncing with Shopify, count it again once it finishes[\s\S]*«To review»/)
    expect(`${es} ${en}`).not.toMatch(/minutos|minutes/)
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

  it('🔴 «Desconectar» dice que las diferencias abiertas en «Por revisar» se cierran sin cambiar el stock de ningún producto', () => {
    expect(String(valor(bundle('es', 'shopify'), 'status.disconnectBody'))).toContain(
      'Las diferencias abiertas en «Por revisar» se cierran sin cambiar el stock de ningún producto.',
    )
    expect(String(valor(bundle('en', 'shopify'), 'status.disconnectBody'))).toContain(
      'Open differences in «To review» are closed without changing the stock of any product.',
    )
  })

  it.each(IDIOMAS)(
    '🔴 %s: Codex C6/C4: el permiso que falta a la app de la tienda nombra el botón que está en pantalla, y lo de revocar el secret anterior lo dice',
    lng => {
      const b = bundle(lng, 'shopify')
      const boton = String(valor(b, 'avisos.reauthorize'))
      const nombrado = /«([^»]+)»/.exec(String(valor(b, 'connect.appPropia.faltaPermiso')))?.[1] ?? ''
      expect(nombrado).not.toBe('')
      expect(boton.startsWith(nombrado)).toBe(true)
      expect(String(valor(b, 'connect.appPropia.revocarAnterior'))).toMatch(lng === 'es' ? /revoca el anterior/ : /revoke the previous one/)
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

  it.each(IDIOMAS)('%s: «quedan N en los dos» tiene singular y plural con el i18next real (1 no se lee «Quedan 1»)', async lng => {
    const i18n = i18next.createInstance()
    await i18n.init({
      lng,
      fallbackLng: false,
      ns: ['shopify'],
      defaultNS: 'shopify',
      resources: { [lng]: { shopify: bundle(lng, 'shopify') } },
      interpolation: { escapeValue: false },
    })
    const uno = i18n.t('preview.quedanEnLosDos', { count: 1, qty: '1' })
    const varios = i18n.t('preview.quedanEnLosDos', { count: 5, qty: '5' })
    expect(uno).toBe(lng === 'es' ? 'Queda 1 en los dos' : '1 on both sides')
    expect(varios).toBe(lng === 'es' ? 'Quedan 5 en los dos' : '5 on both sides')
  })

  it.each(IDIOMAS)('%s: la vista previa manda a «Cambian» (donde se elige) y nombra la pestaña como se llama en pantalla', lng => {
    const b = bundle(lng, 'shopify')
    const cambian = String(valor(b, 'preview.filtros.CAMBIAN'))
    expect(String(valor(b, 'preview.eligeEnCambian'))).toContain(`«${cambian}»`)
  })

  it('🔴 D1: la bitácora nombra las acciones nuevas de la elección por producto y el stock inicial ya no dice «tomado de Shopify» (ahora también registra «Usar el de Avoqado»)', () => {
    const es = valor(bundle('es', 'organization'), 'activityLog.actions') as Record<string, string>
    const en = valor(bundle('en', 'organization'), 'activityLog.actions') as Record<string, string>
    expect(es.SHOPIFY_STOCK_INITIALIZED).toBe('Stock inicial de la sincronización con Shopify')
    expect(en.SHOPIFY_STOCK_INITIALIZED).toBe('Initial stock for the Shopify sync')
    expect(es.SHOPIFY_CONNECT_CHOICES_SAVED).toBe('Elección de stock al conectar Shopify guardada')
    expect(es.MCP_SHOPIFY_CONNECT_CHOICES_SAVED).toBe('Elecciones de stock de Shopify guardadas desde el asistente')
    expect(es.SHOPIFY_APPLY_RETURNED).toBe('La aplicación de Shopify volvió a la vista previa para elegir otra vez')
    expect(en.SHOPIFY_CONNECT_CHOICES_SAVED).toBe('Stock choice for the Shopify connection saved')
    expect(en.MCP_SHOPIFY_CONNECT_CHOICES_SAVED).toBe('Shopify stock choices saved from the assistant')
    expect(en.SHOPIFY_APPLY_RETURNED).toBe('Shopify apply went back to the preview to choose again')
  })

  it.each(IDIOMAS)(
    '🔴 %s: 5a, el bloque de la app de la tienda trae sus 6 pasos en orden y la tarjeta dice la terminación del Client ID',
    lng => {
      const b = bundle(lng, 'shopify')
      expect(Object.keys(valor(b, 'connect.appPropia.pasos') as Record<string, string>)).toEqual(['1', '2', '3', '4', '5', '6'])
      expect(String(valor(b, 'status.metodoComercio'))).toContain('(…{{fin}})')
      expect(String(valor(b, 'status.cambiarLlaves')).trim()).not.toBe('')
    },
  )
})
