/**
 * Genera el mapa de DEPENDENCIAS IMPLÍCITAS entre permisos, derivado de avoqado-server.
 *
 *   node scripts/regenerar-dependencias-permisos.mjs          # reescribe el artefacto
 *   node scripts/regenerar-dependencias-permisos.mjs --check   # exit 1 si el servidor se movió
 *
 * ── Por qué existe ────────────────────────────────────────────────────────────────
 *
 * "Tener X implica tener Y" (sin `orders:create` no funciona `tpv-payments:pay-later`).
 * El editor de roles lo necesita para poder decirle al admin **"este permiso viene
 * INCLUIDO en aquél"** en vez de dejarlo desmarcar algo que el backend repone en silencio.
 *
 * La copia que había aquí estaba escrita a mano y había derivado: **68 entradas contra 180
 * del servidor — 112 de menos, 0 de sobra** (medido el 2026-08-18). Y entre las que
 * faltaban estaban `tpv-payments:pay-later`, `discounts:apply` y `coupons:redeem`, o sea
 * justo las del caso que la pantalla tiene que explicar. Construir la UI sobre esa copia
 * habría cambiado una mentira por otra.
 *
 * Es el mismo patrón que `regenerar-catalogo-permisos.mjs`: el servidor es la autoridad, se
 * le pregunta a él, y el `--check` truena si alguien edita el artefacto a mano. Esa puerta
 * vive en `npm run pre-deploy`, NO en el CI de GitHub: el workflow sólo clona este repo y
 * aquí hace falta el hermano en disco (ver el guard de abajo).
 *
 * ── Qué se genera y qué NO ────────────────────────────────────────────────────────
 *
 * Se genera SÓLO el dato (`PERMISSION_DEPENDENCIES`). Las funciones que lo usan
 * —`resolvePermissions`, `isImplicitlyGranted`, `getImplicitPermissions`— siguen escritas a
 * mano en `permissionDependencies.ts`, que ahora importa el dato de aquí. Generar lógica
 * sería frágil; generar una tabla que ya vive en el servidor es justo lo contrario.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DASHBOARD = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// AVQ_SERVER_DIR permite apuntar a OTRO checkout de avoqado-server (p.ej. un worktree como
// `.claude/worktrees/campanas-f0-server`, que no vive en la ruta hermana por defecto). Sin la
// variable, el comportamiento de siempre: el hermano `../avoqado-server`.
const SERVER = process.env.AVQ_SERVER_DIR ? resolve(process.env.AVQ_SERVER_DIR) : resolve(DASHBOARD, '..', 'avoqado-server')
const DESTINO = resolve(DASHBOARD, 'src/lib/permissions/generated/permissionDependencies.generated.ts')

const check = process.argv.includes('--check')

// ── Puerta LOCAL, no de CI ────────────────────────────────────────────────────────
// Esto le pregunta al servidor de verdad, así que necesita el repo hermano en disco. El CI
// del dashboard sólo clona ESTE repo (`actions/checkout` sin `repository:`), así que aquí
// fallaría con un ENOENT críptico. Si algún día se quiere en CI hay que clonar también
// avoqado-server; mientras tanto la puerta vive en `npm run pre-deploy`, que se corre en
// una máquina donde los dos repos están juntos.
if (!existsSync(SERVER)) {
  console.error('✖ No encuentro avoqado-server en:')
  console.error(`    ${SERVER}`)
  console.error('  Esta verificación necesita el repo hermano en disco: le pregunta al servidor')
  console.error('  en vez de confiar en una copia. Corre desde el workspace, no desde CI.')
  process.exit(1)
}


// El servidor es la autoridad: se le pregunta a él, no a una copia.
const raw = execFileSync(
  'npx',
  ['tsx', '-e', "import { PERMISSION_DEPENDENCIES as D } from './src/lib/permissions'; console.log(JSON.stringify(D))"],
  { cwd: SERVER, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
)
const deps = JSON.parse(raw)

const claves = Object.keys(deps).sort()
if (claves.length === 0) {
  console.error('✖ El servidor devolvió CERO dependencias. Eso no puede ser: no se escribe un artefacto vacío.')
  process.exit(1)
}

// ── Guardrail white-label ──────────────────────────────────────────────────────────
// Mismo veto que el catálogo: la vertical de PlayTelecom no se mezcla con el producto
// genérico. Si un permiso de esos no es asignable desde el editor, su dependencia tampoco
// pinta nada aquí. Levantar el veto = borrar estas dos líneas, pero es una DECISIÓN.
const RECURSOS_EXCLUIDOS = new Set(['sim-custody', 'tpv-sim-custody'])
const PERMISOS_EXCLUIDOS = new Set(['serialized-inventory:change-category'])
const excluido = p => RECURSOS_EXCLUIDOS.has(p.split(':')[0]) || PERMISOS_EXCLUIDOS.has(p)

const filtradas = claves.filter(k => !excluido(k))
const q = s => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

const cuerpo = filtradas
  .map(k => {
    const valores = (deps[k] || []).filter(v => !excluido(v))
    return `  ${q(k)}: [${valores.map(q).join(', ')}],`
  })
  .join('\n')

const huella = createHash('sha256').update(JSON.stringify({ filtradas, deps })).digest('hex').slice(0, 16)

const artefacto = `/**
 * Dependencias implícitas entre permisos — "tener X implica tener Y".
 *
 * 🔴 ARCHIVO GENERADO — NO LO EDITES A MANO. Se regenera con:
 * \`\`\`
 * npm run permissions:deps          # reescribe este archivo
 * npm run check:permissions         # exit 1 si el servidor se movió
 * \`\`\`
 *
 * Deriva de \`PERMISSION_DEPENDENCIES\` de avoqado-server, que es la MISMA tabla con la que
 * el backend expande los permisos al autorizar. Por eso lo que esta pantalla dice que
 * "viene incluido" es exactamente lo que el backend va a reponer.
 *
 * 🔴 POR QUÉ NO SE ESCRIBE A MANO: la copia anterior había derivado a 68 entradas contra
 * ${claves.length} del servidor. Entre las 112 que faltaban estaban \`tpv-payments:pay-later\`,
 * \`discounts:apply\` y \`coupons:redeem\` — justo las que el editor de roles necesita para
 * avisar "este permiso viene incluido en aquél". Sin ellas la pantalla dejaba desmarcar algo
 * que el backend repone en silencio: mentía.
 *
 * ${filtradas.length} entradas · derivado de avoqado-server · huella ${huella}.
 * (${claves.length - filtradas.length} excluidas: vertical white-label de PlayTelecom.)
 */

export const PERMISSION_DEPENDENCIES: Record<string, string[]> = {
${cuerpo}
}

export const PERMISSION_DEPENDENCIES_DIGEST = ${q(huella)}
`

if (check) {
  if (!existsSync(DESTINO) || readFileSync(DESTINO, 'utf8') !== artefacto) {
    console.error('✖ Las dependencias NO cuadran con avoqado-server.')
    console.error(`    ${DESTINO}`)
    console.error('  Corre: npm run permissions:deps')
    process.exit(1)
  }
  console.log(`✓ Las dependencias cuadran con avoqado-server · huella ${huella}.`)
  console.log(`  ${filtradas.length} entradas.`)
  process.exit(0)
}

writeFileSync(DESTINO, artefacto)
console.log(`✓ Regeneradas desde avoqado-server · huella ${huella}`)
console.log(`  ${filtradas.length} entradas (${claves.length - filtradas.length} excluidas por el guardrail white-label)`)
