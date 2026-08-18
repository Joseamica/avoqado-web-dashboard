/**
 * Genera los permisos DE FÁBRICA por rol, derivados de avoqado-server.
 *
 *   node scripts/regenerar-permisos-de-fabrica.mjs           # reescribe el artefacto
 *   node scripts/regenerar-permisos-de-fabrica.mjs --check    # exit 1 si el servidor se movió
 *
 * ── Por qué existe ────────────────────────────────────────────────────────────────
 *
 * Es la TERCERA copia a mano de la misma familia que se estaba desincronizando, después del
 * catálogo de permisos y del mapa de dependencias. Y es la que más se nota, porque no
 * alimenta una pantalla: gobierna qué ve cada rol en TODO el dashboard.
 *
 * Medido el 2026-08-18, evaluando permiso por permiso y respetando comodines:
 *
 *   rol         ve de MENOS   ve de MÁS
 *   MANAGER          70            9
 *   CASHIER          21            1
 *   WAITER           20            0
 *   ADMIN             0           27
 *   OWNER             0            4
 *
 * Las dos direcciones son la interfaz mintiendo:
 *
 *   · "de menos" — el servidor sí se lo permite y el dashboard no se lo ofrece. Molesto,
 *     inofensivo: el MANAGER no veía 70 opciones que sí podía usar.
 *   · "de más"  — el dashboard le pinta el botón y el servidor le responde 403. Eso es lo
 *     que el usuario lee como "está roto". El caso gordo era ADMIN: el dashboard le daba
 *     comodín total `*:*` y el servidor le da 103 permisos concretos.
 *
 * ── Qué se genera y qué NO ────────────────────────────────────────────────────────
 *
 * Sólo el DATO. `hasDefaultPermission` sigue escrita a mano en `defaultPermissions.ts`, que
 * ahora importa el dato de aquí. Mismo criterio que los otros dos generadores: se genera lo
 * que ya vive en el servidor, no la lógica.
 *
 * ⚠️ Se guarda la lista LITERAL del servidor (con sus comodines por recurso), no la
 * expandida. Un `scale:*` intacto sigue concediendo lo que la plataforma agregue mañana bajo
 * `scale:`; expandirlo aquí congelaría al dashboard en la lista del día que se generó, que
 * es justo la clase de deuda que este script viene a pagar.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DASHBOARD = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SERVER = resolve(DASHBOARD, '..', 'avoqado-server')
const DESTINO = resolve(DASHBOARD, 'src/lib/permissions/generated/defaultPermissions.generated.ts')

const check = process.argv.includes('--check')

// ── Puerta LOCAL, no de CI ────────────────────────────────────────────────────────
// Le pregunta al servidor de verdad, así que necesita el repo hermano en disco. El CI del
// dashboard sólo clona ESTE repo, así que aquí fallaría con un ENOENT críptico.
if (!existsSync(SERVER)) {
  console.error('✖ No encuentro avoqado-server en:')
  console.error(`    ${SERVER}`)
  console.error('  Esta verificación necesita el repo hermano en disco: le pregunta al servidor')
  console.error('  en vez de confiar en una copia. Corre desde el workspace, no desde CI.')
  process.exit(1)
}

const raw = execFileSync(
  'npx',
  ['tsx', '-e', "import { DEFAULT_PERMISSIONS as D } from './src/lib/permissions'; console.log(JSON.stringify(D))"],
  { cwd: SERVER, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
)
const porRol = JSON.parse(raw)

const roles = Object.keys(porRol).sort()
if (roles.length === 0) {
  console.error('✖ El servidor devolvió CERO roles. No se escribe un artefacto vacío.')
  process.exit(1)
}

// SUPERADMIN debe conservar su comodín: es el anti-lockout de la plataforma.
if (!(porRol.SUPERADMIN || []).includes('*:*')) {
  console.error('✖ SUPERADMIN perdió su comodín `*:*` en el servidor. Eso es un bug allá, no aquí.')
  process.exit(1)
}

// ── Guardrail white-label ──────────────────────────────────────────────────────────
// Mismo veto que los otros dos generadores: la vertical de PlayTelecom no se mezcla con el
// producto genérico. Levantar el veto = borrar estas dos líneas, pero es una DECISIÓN.
const RECURSOS_EXCLUIDOS = new Set(['sim-custody', 'tpv-sim-custody'])
const PERMISOS_EXCLUIDOS = new Set(['serialized-inventory:change-category'])
const excluido = p => RECURSOS_EXCLUIDOS.has(p.split(':')[0]) || PERMISOS_EXCLUIDOS.has(p)

const q = s => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

const cuerpo = roles
  .map(rol => {
    const permisos = (porRol[rol] || []).filter(p => !excluido(p))
    const items = permisos.map(p => `    ${q(p)},`).join('\n')
    return `  ${rol}: [\n${items}\n  ],`
  })
  .join('\n')

const totales = roles.map(r => `${r} ${(porRol[r] || []).filter(p => !excluido(p)).length}`).join(' · ')
const huella = createHash('sha256').update(JSON.stringify(porRol)).digest('hex').slice(0, 16)

const artefacto = `import { StaffRole } from '@/types'

/**
 * Permisos DE FÁBRICA por rol.
 *
 * 🔴 ARCHIVO GENERADO — NO LO EDITES A MANO. Se regenera con:
 * \`\`\`
 * npm run permissions:defaults      # reescribe este archivo
 * npm run check:permissions         # exit 1 si el servidor se movió
 * \`\`\`
 *
 * Deriva de \`DEFAULT_PERMISSIONS\` de avoqado-server, que es la MISMA tabla con la que el
 * backend autoriza. Por eso lo que el dashboard ofrece es exactamente lo que el servidor
 * concede — ni un botón de más que responda 403, ni una opción escondida que sí se podía usar.
 *
 * 🔴 POR QUÉ NO SE ESCRIBE A MANO: la copia anterior había derivado en las DOS direcciones.
 * El MANAGER no veía 70 opciones que sí podía usar, y al ADMIN se le pintaban 27 botones que
 * el servidor le rechazaba (el dashboard le daba comodín total \`*:*\`; el servidor no).
 *
 * Se guarda la lista LITERAL, comodines incluidos: un \`scale:*\` intacto sigue concediendo lo
 * que la plataforma agregue mañana bajo ese recurso. Expandirlo congelaría al dashboard.
 *
 * ${roles.length} roles · huella ${huella}.
 * ${totales}
 */
export const DEFAULT_PERMISSIONS: Record<StaffRole, string[]> = {
${cuerpo}
} as Record<StaffRole, string[]>

export const DEFAULT_PERMISSIONS_DIGEST = ${q(huella)}
`

if (check) {
  if (!existsSync(DESTINO) || readFileSync(DESTINO, 'utf8') !== artefacto) {
    console.error('✖ Los permisos de fábrica NO cuadran con avoqado-server.')
    console.error(`    ${DESTINO}`)
    console.error('  Corre: npm run permissions:defaults')
    process.exit(1)
  }
  console.log(`✓ Los permisos de fábrica cuadran con avoqado-server · huella ${huella}.`)
  console.log(`  ${roles.length} roles.`)
  process.exit(0)
}

writeFileSync(DESTINO, artefacto)
console.log(`✓ Regenerados desde avoqado-server · huella ${huella}`)
console.log(`  ${roles.length} roles: ${totales}`)
