#!/usr/bin/env node
/**
 * Regenera el catálogo de permisos del dashboard desde avoqado-server.
 *
 *   node scripts/regenerar-catalogo-permisos.mjs           # reescribe el artefacto
 *   node scripts/regenerar-catalogo-permisos.mjs --check   # no escribe; exit 1 si divergen
 *
 * 🔴 POR QUÉ EXISTE ESTE SCRIPT Y NO UN COMENTARIO QUE DIGA "mantener en sync":
 * `PERMISSION_CATEGORIES` era una copia escrita a mano del catálogo del servidor,
 * con un `⚠️ CRITICAL: This must match ...` encima. No cuadraba: al medirlo, el
 * servidor exponía 233 permisos individuales y el dashboard sólo 170. Los 63 que
 * faltaban eran INASIGNABLES desde la pantalla de roles — no existían para el
 * admin. Entre ellos `estimates:create`, `orders:cancel-unpaid` y `tables:pay-any`,
 * estrenados el mismo día. Un comentario pidiendo sincronía no sincroniza nada;
 * sólo reparte la culpa cuando alguien se olvida.
 *
 * 🔴 LA SEGUNDA MITAD DEL PROBLEMA — LOS HUÉRFANOS: el catálogo no se pinta solo.
 * Lo renderiza una lista de super-categorías (`permissionGroups.ts`) que enumera
 * las categorías por clave. Una categoría que ninguna super-categoría menciona
 * existe en el dato y NO SE VE en ninguna pantalla. Al medir había 7 así
 * (AREA_TICKETS, SCALES, INVENTORY_TRANSFERS, COMMISSIONS, GOALS, INVENTORY_ORG,
 * ACTIVITY): permisos que ya estaban en el catálogo y que el admin no podía
 * otorgar igual. Por eso este script emite TAMBIÉN el mapa
 * categoría→super-categoría (`SUPER_CATEGORY_KEYS`) desde el mismo `CURACION`:
 * una categoría sin super-categoría es imposible de construir, no algo que haya
 * que acordarse de revisar.
 *
 * QUÉ ES DERIVADO Y QUÉ ES CURADO — la línea importa:
 *   - DERIVADO del servidor: QUÉ permisos existen y a qué recurso pertenecen.
 *     Es `INDIVIDUAL_PERMISSIONS_BY_RESOURCE`, la lista que el propio backend usa
 *     para expandir comodines. Nadie lo escribe aquí a mano.
 *   - CURADO en este archivo: cómo se AGRUPAN para que la pantalla se lea. El
 *     servidor no tiene opinión sobre eso y no debería tenerla.
 *   Si el servidor estrena un recurso que `CURACION` no conoce, este script FALLA
 *   con exit 2 y dice cuál — nunca lo mete en un cajón sin nombre ni lo tira en
 *   silencio. Ése es el punto: el modo de fallo es ruidoso y accionable.
 *
 * 🔴 LA HUELLA ES DEL CONTENIDO, NO DEL COMMIT del servidor. Un hash de HEAD
 * marcaría "desactualizado" cada vez que alguien toca cualquier otra cosa de ese
 * repo, y un detector que grita en falso se aprende a ignorar — que es peor que
 * no tenerlo. Con la huella de contenido, `--check` sólo se pone rojo cuando los
 * PERMISOS cambiaron de verdad.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMarkedServerJson, resolveAvoqadoServerRoot } from './resolve-avoqado-server-root.mjs'

const DASHBOARD = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SERVER = resolveAvoqadoServerRoot(DASHBOARD)
const DESTINO = resolve(DASHBOARD, 'src/lib/permissions/generated/permissionCatalog.generated.ts')
const AUTHORITY_MARKER = '@@AVOQADO_PERMISSION_CATALOG@@'

/**
 * 🔴 MÓDULO WHITE-LABEL — NO ENTRA AL CATÁLOGO GENÉRICO.
 *
 * `sim-custody` y `tpv-sim-custody` son la cadena de custodia de SIMs de
 * PlayTelecom, y `serialized-inventory:change-category` es su reclasificación.
 * Viven detrás de módulos (`SERIALIZED_INVENTORY`), no del catálogo de permisos
 * que ve cualquier negocio. Meterlos aquí le pondría a una estética 11 casillas
 * sobre SIMs que jamás va a usar.
 *
 * Para levantar el veto basta borrar la entrada: el permiso vuelve a aparecer y
 * el script exigirá su categoría en `CURACION`.
 */
// `commercial` is the global SaaS control plane. It is enforced by Server and
// operated from Superadmin; exposing publish/reconcile in a venue role editor
// would cross the tenant/platform authority boundary.
const RECURSOS_EXCLUIDOS = new Set(['sim-custody', 'tpv-sim-custody', 'commercial'])
const PERMISOS_EXCLUIDOS = new Set(['serialized-inventory:change-category'])

/**
 * Curación: cómo se agrupa el catálogo para que la pantalla se lea.
 *
 * Cada entrada es `[CLAVE_DE_CATEGORIA, [recursos del servidor], 'etiqueta de respaldo']`.
 * La etiqueta de respaldo sólo se usa si falta la traducción
 * (`rolePermissions.categories.<clave en minúsculas>`); el texto que ve el usuario
 * sale de i18n.
 *
 * El orden de las super-categorías y de las categorías dentro de cada una es el
 * orden en que se pintan.
 */
const CURACION = {
  'core-operations': [
    ['HOME', ['home'], 'Home Dashboard'],
    ['ANALYTICS', ['analytics'], 'Analytics'],
    ['REPORTS', ['reports'], 'Reports'],
    ['SETTLEMENTS', ['settlements'], 'Settlements'],
    ['ACCOUNTING', ['accounting'], 'Contabilidad'],
    ['CASH_OUT', ['cash-out'], 'Retiros de efectivo'],
    ['ACTIVITY', ['activity'], 'Activity Log'],
  ],
  'sales-orders': [
    ['MENU', ['menu'], 'Menu Management'],
    ['PRODUCTS', ['products'], 'Products'],
    ['ORDERS', ['orders'], 'Orders'],
    ['ESTIMATES', ['estimates'], 'Cotizaciones'],
    ['MANUAL_SALES', ['manual-sales'], 'Ventas manuales'],
    ['PAYMENTS', ['payments', 'payment'], 'Payments'],
    ['PAYMENT_LINK', ['payment-link'], 'Links de pago'],
    ['TENDER_TYPES', ['tender-types'], 'Tipos de pago'],
    ['SALE_VERIFICATIONS', ['sale-verifications'], 'Verificación de ventas'],
    ['UPSELLS', ['upsells'], 'Sugerencias de venta'],
    ['AREA_TICKETS', ['area-tickets'], 'Vales por área'],
  ],
  operations: [
    ['SHIFTS', ['shifts'], 'Shifts'],
    ['CASH_DRAWER', ['cash-drawer'], 'Cash drawer'],
    ['TPV', ['tpv'], 'TPV Management'],
    ['INVENTORY', ['inventory'], 'Inventory'],
    ['INVENTORY_TRANSFERS', ['inventory-transfers'], 'Inter-venue Transfers'],
    ['PRINTERS', ['printers'], 'Impresoras'],
    ['SCALES', ['scale'], 'Básculas'],
    ['DELIVERY_CHANNELS', ['delivery-channels'], 'Canales de entrega'],
    ['CATALOG_VENUE', ['catalog-venue'], 'Catálogo del negocio'],
    ['SERIALIZED_INVENTORY', ['serialized-inventory'], 'Serialized Inventory'],
  ],
  'customer-experience': [
    ['REVIEWS', ['reviews'], 'Reviews'],
    ['TABLES', ['tables'], 'Table Management'],
    ['RESERVATIONS', ['reservations'], 'Reservations'],
    ['CLASS_SESSIONS', ['class-sessions'], 'Clases asignadas'],
    ['CALENDAR', ['calendar'], 'Calendario'],
  ],
  'team-settings': [
    ['TEAMS', ['teams'], 'Team Management'],
    ['ATTENDANCE', ['attendance'], 'Asistencia'],
    ['STAFF_DOCUMENTS', ['staff-documents'], 'Expediente del personal'],
    ['ROLE_CONFIG', ['role-config'], 'Role Configuration'],
    ['COMMISSIONS', ['commissions'], 'Commission Management'],
    ['GOALS', ['goals'], 'Org-Level Goals'],
    ['SETTINGS', ['settings'], 'Settings'],
    ['VENUES', ['venues'], 'Venue Settings'],
    ['FEATURES', ['features'], 'Feature Flags'],
    ['NOTIFICATIONS', ['notifications'], 'Notifications'],
    ['BILLING', ['billing'], 'Billing & Subscriptions'],
    ['PLATFORM_BILLING', ['platform-billing'], 'Facturación de plataforma'],
    ['CFDI', ['cfdi'], 'Facturación CFDI'],
    ['VENUE_FISCAL_PROFILE', ['venue-fiscal-profile'], 'Perfil fiscal'],
  ],
  'marketing-loyalty': [
    ['CUSTOMERS', ['customers'], 'Customer Management'],
    ['CUSTOMER_GROUPS', ['customer-groups'], 'Customer Groups'],
    ['LOYALTY', ['loyalty'], 'Loyalty Program'],
    ['REFERRAL', ['referral'], 'Referral Program'],
    ['DISCOUNTS', ['discounts'], 'Discounts'],
    ['COUPONS', ['coupons'], 'Coupons'],
    ['CREDIT_PACKS', ['creditPacks'], 'Paquetes y membresías'],
  ],
  // ── Super-categorías de TPV ────────────────────────────────────────────────
  'terminal-operations': [
    ['TPV_TERMINAL', ['tpv-terminal'], 'Terminal Configuration'],
    ['TPV_DEVICES', ['tpv-devices'], 'TPV Devices'],
    ['TPV_SHIFTS', ['tpv-shifts'], 'TPV Shifts'],
    ['TPV_KIOSK', ['tpv-kiosk'], 'Kiosk Mode'],
    ['TPV_FACTORY_RESET', ['tpv-factory-reset'], 'Factory Reset (CRITICAL)'],
  ],
  'tpv-orders-payments': [
    ['TPV_ORDERS', ['tpv-orders'], 'TPV Orders (Advanced)'],
    ['TPV_PAYMENTS', ['tpv-payments'], 'TPV Payments (Advanced)'],
  ],
  'floor-management': [
    ['TPV_TABLES', ['tpv-tables'], 'TPV Tables'],
    ['TPV_FLOOR_ELEMENTS', ['tpv-floor-elements'], 'Floor Elements'],
  ],
  'staff-customers': [
    ['TPV_CUSTOMERS', ['tpv-customers'], 'TPV Customers'],
    ['TPV_PRODUCTS', ['tpv-products'], 'TPV Products (Scan & Go)'],
    ['TPV_TIME_ENTRIES', ['tpv-time-entries'], 'Time Clock'],
    ['TPV_REPORTS', ['tpv-reports'], 'TPV Reports'],
    ['TPV_MESSAGES', ['tpv-messages'], 'TPV Messages'],
    ['TPV_SETTINGS', ['tpv-settings'], 'TPV Settings'],
    ['VENUE_CRYPTO', ['venue-crypto'], 'Venue Crypto Config'],
  ],
}

const check = process.argv.includes('--check')

if (!existsSync(SERVER)) {
  console.error(`✖ No encuentro avoqado-server en ${SERVER}.`)
  console.error('  Este catálogo SÓLO se puede derivar del servidor; no lo escribas a mano.')
  process.exit(2)
}

// El servidor es la autoridad: se le pregunta a él, no a una copia.
const raw = execFileSync(
  'npx',
  [
    'tsx',
    '-e',
    `import { INDIVIDUAL_PERMISSIONS_BY_RESOURCE as C } from './src/lib/permissions'; console.log('${AUTHORITY_MARKER}' + JSON.stringify(C))`,
  ],
  { cwd: SERVER, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
)
const porRecurso = parseMarkedServerJson(raw, AUTHORITY_MARKER)

// ── Validación: nada se cae por una rendija ────────────────────────────────
const recursosServidor = Object.keys(porRecurso).filter(r => !RECURSOS_EXCLUIDOS.has(r))
const recursosCurados = Object.values(CURACION).flatMap(cats => cats.flatMap(([, recursos]) => recursos))

const sinCategoria = recursosServidor.filter(r => !recursosCurados.includes(r))
if (sinCategoria.length) {
  console.error('✖ El servidor tiene recursos que este script no sabe dónde poner:')
  sinCategoria.forEach(r => console.error(`    ${r}  (${porRecurso[r].join(', ')})`))
  console.error('')
  console.error('  Agrégalos a CURACION en este archivo, en la super-categoría que les toque.')
  console.error('  NO se meten en un cajón sin nombre: una categoría sin etiqueta es una')
  console.error('  casilla que el admin no entiende y por tanto no otorga.')
  process.exit(2)
}

const inexistentes = recursosCurados.filter(r => !porRecurso[r])
if (inexistentes.length) {
  console.error(`✖ CURACION menciona recursos que el servidor ya no tiene: ${inexistentes.join(', ')}.`)
  console.error('  Quítalos de CURACION — si no, el catálogo ofrece permisos fantasma.')
  process.exit(2)
}

const duplicados = recursosCurados.filter((r, i) => recursosCurados.indexOf(r) !== i)
if (duplicados.length) {
  console.error(`✖ Estos recursos están en más de una categoría: ${[...new Set(duplicados)].join(', ')}.`)
  process.exit(2)
}

// ── Construcción del artefacto ─────────────────────────────────────────────
const permisosDe = recursos => recursos.flatMap(r => porRecurso[r]).filter(p => !PERMISOS_EXCLUIDOS.has(p))

const categorias = Object.values(CURACION)
  .flat()
  .map(([clave, recursos, etiqueta]) => ({ clave, recursos, etiqueta, permisos: permisosDe(recursos) }))

const vacias = categorias.filter(c => !c.permisos.length)
if (vacias.length) {
  console.error(`✖ Estas categorías quedarían vacías: ${vacias.map(c => c.clave).join(', ')}.`)
  console.error('  Una categoría sin permisos se pinta como una sección hueca. Quítala de CURACION.')
  process.exit(2)
}

// ── Cobertura de textos: un permiso sin traducción es una casilla muda ─────
//
// 🔴 POR QUÉ ESTO VIVE EN EL MISMO GATE Y NO EN UN TEST APARTE: la etiqueta que
// ve el admin sale de i18n (`rolePermissions.permissionLabels.<permiso>`). Si
// falta, el componente cae a un respaldo genérico y termina pintando el código
// pelón — `cash-out:view_own` se lee "View_own". El admin no otorga lo que no
// entiende, así que un permiso sin texto está tan inasignable en la práctica
// como uno que no está en el catálogo. Traer el permiso del servidor y no
// traerle texto sólo mueve el problema de sitio.
//
// Se revisan `es` y `en`, que son los locales completos de este namespace. `fr`
// es un locale PARCIAL: no tiene `settings.json` y cae al idioma por defecto —
// por eso no se exige aquí, y exigirlo dejaría el gate rojo para siempre.
const LOCALES = ['es', 'en']

function huecosDeTexto() {
  const huecos = []
  for (const loc of LOCALES) {
    const ruta = resolve(DASHBOARD, `src/locales/${loc}/settings.json`)
    if (!existsSync(ruta)) {
      huecos.push(`[${loc}] no existe ${ruta}`)
      continue
    }
    const rp = JSON.parse(readFileSync(ruta, 'utf8')).rolePermissions ?? {}
    const etiquetas = rp.permissionLabels ?? {}
    const nombres = rp.categories ?? {}
    for (const c of categorias) {
      if (!nombres[c.clave.toLowerCase()]) huecos.push(`[${loc}] categories.${c.clave.toLowerCase()}`)
      for (const permiso of c.permisos) {
        if (!etiquetas[permiso.replace(/:/g, '_')]) huecos.push(`[${loc}] permissionLabels.${permiso.replace(/:/g, '_')}`)
      }
    }
  }
  return huecos
}

const sinTexto = huecosDeTexto()

const total = categorias.reduce((n, c) => n + c.permisos.length, 0)
const huella = createHash('sha256').update(JSON.stringify(porRecurso)).digest('hex').slice(0, 16)

// El artefacto se emite en el estilo del repo (comilla simple, ancho 140, coma
// final) para que se lea como código escrito a mano y no meta ruido en los diffs.
// Se formatea aquí a propósito: prettier NO es dependencia de este proyecto —
// invocarlo con `npx` lo descargaría en cada corrida y ataría el artefacto a una
// versión que nadie fijó.
const ANCHO = 140
const q = s => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

const listaEnLinea = (valores, sangria, prefijo) => {
  const linea = `[${valores.map(q).join(', ')}]`
  if (sangria + prefijo.length + linea.length + 1 <= ANCHO) return linea
  const s = ' '.repeat(sangria)
  return `[\n${valores.map(v => `${s}  ${q(v)},`).join('\n')}\n${s}]`
}

const bloqueCategorias = categorias
  .map(c => `  ${c.clave}: {\n    label: ${q(c.etiqueta)},\n    permissions: ${listaEnLinea(c.permisos, 4, 'permissions: ')},\n  },`)
  .join('\n')

const bloqueSuper = Object.entries(CURACION)
  .map(([id, cats]) => `  ${q(id)}: ${listaEnLinea(cats.map(([clave]) => clave), 2, `${q(id)}: `)},`)
  .join('\n')

const artefacto = `/**
 * Catálogo de permisos — QUÉ puede otorgar el admin desde la pantalla de roles.
 *
 * 🔴 ARCHIVO GENERADO — NO LO EDITES A MANO. Se regenera con:
 * \`\`\`
 * node scripts/regenerar-catalogo-permisos.mjs          # reescribe este archivo
 * node scripts/regenerar-catalogo-permisos.mjs --check  # exit 1 si el servidor se movió
 * \`\`\`
 * Un cambio hecho aquí a mano lo borra la siguiente regeneración, y mientras tanto
 * el \`--check\` se pone rojo. Si lo que quieres es mover una categoría de lugar o
 * renombrarla, edita \`CURACION\` en ese script. Si lo que quieres es agregar un
 * permiso, agrégalo en \`avoqado-server/src/lib/permissions.ts\` — aquí llega solo.
 *
 * Deriva de \`INDIVIDUAL_PERMISSIONS_BY_RESOURCE\` de avoqado-server, que es la misma
 * lista con la que el backend expande los comodines (\`orders:*\`) al evaluar un
 * permiso. Por eso lo que se ve aquí es exactamente lo que el backend puede conceder.
 *
 * 🔴 POR QUÉ NO SE ESCRIBE A MANO: esto fue una copia manual y no cuadraba — el
 * servidor exponía 233 permisos y esta lista 170. Los 63 que faltaban eran
 * INASIGNABLES: no aparecían en la pantalla, así que ningún admin podía dárselos a
 * nadie, ni siquiera armando un rol personalizado. Una copia a mano no se queda
 * desactualizada con ruido, se queda desactualizada en silencio.
 *
 * ${categorias.length} categorías · ${total} permisos · derivado de avoqado-server · huella ${huella}.
 */

export const PERMISSION_CATEGORIES = {
${bloqueCategorias}
} as const satisfies Record<string, { label: string; permissions: readonly string[] }>

export type PermissionCategoryKey = keyof typeof PERMISSION_CATEGORIES

/**
 * Qué categorías pinta cada super-categoría, en orden.
 *
 * 🔴 ESTO ES LO QUE HACE IMPOSIBLE UNA CATEGORÍA HUÉRFANA. Antes, las
 * super-categorías de \`permissionGroups.ts\` traían la lista de claves escrita a
 * mano, y una categoría que nadie mencionaba existía en el dato pero no se pintaba
 * en ninguna pantalla: 7 estaban así (AREA_TICKETS, SCALES, INVENTORY_TRANSFERS,
 * COMMISSIONS, GOALS, INVENTORY_ORG, ACTIVITY). Al salir las dos mitades de la
 * misma \`CURACION\`, una categoría sin super-categoría ya no se puede construir.
 */
export const SUPER_CATEGORY_KEYS = {
${bloqueSuper}
} as const satisfies Record<string, readonly PermissionCategoryKey[]>

/** Huella del catálogo del servidor del que salió este archivo. */
export const CATALOG_DIGEST = ${q(huella)}
`

if (check) {
  let rojo = false
  if (!existsSync(DESTINO) || readFileSync(DESTINO, 'utf8') !== artefacto) {
    console.error('✖ El catálogo NO cuadra con avoqado-server.')
    console.error(`    ${DESTINO}`)
    console.error('  Corre: node scripts/regenerar-catalogo-permisos.mjs')
    rojo = true
  }
  if (sinTexto.length) {
    console.error(`✖ ${sinTexto.length} textos faltan — esas casillas saldrían con el código pelón:`)
    sinTexto.forEach(h => console.error(`    ${h}`))
    console.error('  Agrégalos en src/locales/<loc>/settings.json → rolePermissions.')
    rojo = true
  }
  if (rojo) process.exit(1)
  console.log(`✓ El catálogo cuadra con avoqado-server · huella ${huella}.`)
  console.log(`  ${categorias.length} categorías · ${total} permisos asignables · textos completos en ${LOCALES.join(', ')}.`)
  process.exit(0)
}

writeFileSync(DESTINO, artefacto)
console.log(`✓ Regenerado desde avoqado-server · huella ${huella}`)
console.log(`  ${categorias.length} categorías · ${total} permisos asignables`)
if (sinTexto.length) {
  console.log('')
  console.log(`⚠ ${sinTexto.length} textos faltan; esas casillas saldrán con el código pelón hasta que se escriban:`)
  sinTexto.forEach(h => console.log(`    ${h}`))
}
Object.entries(CURACION).forEach(([id, cats]) => {
  const n = cats.reduce((acc, [, recursos]) => acc + permisosDe(recursos).length, 0)
  console.log(`    ${id.padEnd(22)} ${String(cats.length).padStart(2)} categorías  ${String(n).padStart(3)} permisos`)
})
