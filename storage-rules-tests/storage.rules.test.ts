import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'

/**
 * Condición previa #1 del plan de "pantalla del cliente"
 * (docs/superpowers/plans/2026-10-14-pantalla-del-cliente-f0a-reconstruccion.md,
 * «Orden de despliegue», y 2026-10-14-pantalla-del-cliente-f1-editor-dashboard.md, B1): las imágenes de esa pantalla las
 * sube SÓLO el servidor (SDK de administrador — ignora `storage.rules`), bajo
 * `{env}/customer-display-assets/<venueId>/...`, un prefijo que `storage.rules`
 * NO menciona. Este archivo prueba, contra el emulador de Storage (NUNCA un
 * proyecto real), que un cliente del navegador no puede escribir ni leer ese
 * prefijo — con o sin sesión — y que eso no es un emulador mal levantado: una
 * regla PREEXISTENTE (`dev/venues/<slug>/**`, abierta a propósito, hueco
 * conocido, NO se toca aquí) sigue funcionando como control positivo.
 *
 * Cómo correrla: `npm run test:storage-rules` desde la raíz del repo. Ese script
 * levanta el emulador de Storage con `firebase emulators:exec` sobre un
 * `projectId` `demo-*` (nunca toca un proyecto real) y corre ESTE archivo con el
 * config dedicado `storage-rules-tests/vitest.config.ts` — nunca entra a la
 * suite normal de vitest ni a CI (ver ese config para el porqué).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RULES_PATH = path.resolve(__dirname, '..', 'storage.rules')
const PROJECT_ID = 'demo-avoqado-storage-rules'
const STORAGE_EMULATOR_PORT = 9199

// El contenido no importa — storage.rules decide por RUTA, nunca por bytes.
const FAKE_FILE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: STORAGE_EMULATOR_PORT,
    },
  })
})

afterAll(async () => {
  await testEnv?.cleanup()
})

describe('storage.rules — customer-display-assets es exclusivo del servidor', () => {
  const CUSTOMER_DISPLAY_PATHS = [
    'prod/customer-display-assets/venue-123/hero.png',
    'dev/customer-display-assets/venue-123/hero.png',
  ]

  for (const targetPath of CUSTOMER_DISPLAY_PATHS) {
    it(`RECHAZA escribir sin sesión: ${targetPath}`, async () => {
      const anon = testEnv.unauthenticatedContext()
      const fileRef = anon.storage().ref(targetPath)
      await assertFails(Promise.resolve(fileRef.put(FAKE_FILE)))
    })

    it(`RECHAZA escribir CON sesión (staff logueado): ${targetPath}`, async () => {
      const staff = testEnv.authenticatedContext('staff-1')
      const fileRef = staff.storage().ref(targetPath)
      await assertFails(Promise.resolve(fileRef.put(FAKE_FILE)))
    })

    it(`RECHAZA leer directamente: ${targetPath}`, async () => {
      // Siembra el objeto SALTÁNDOSE las reglas (así es como lo hace el SDK de
      // administrador que usa el servidor real) para poder probar la lectura
      // de forma aislada de la escritura.
      await testEnv.withSecurityRulesDisabled(async ctx => {
        await ctx.storage().ref(targetPath).put(FAKE_FILE)
      })

      const anon = testEnv.unauthenticatedContext()
      await assertFails(anon.storage().ref(targetPath).getMetadata())
    })
  }

  // Control positivo: si este caso también fallara, la prueba de arriba
  // estaría "rechazando todo" por un emulador mal levantado o unas reglas que
  // no cargaron — no porque el prefijo `customer-display-assets` esté
  // correctamente cerrado. Esta ruta es un hueco PREEXISTENTE y deliberado
  // (ver `.claude/rules/critical-warnings.md` y el brief de esta tarea) — no
  // se toca aquí, sólo sirve de testigo de que las reglas sí están vivas.
  it('CONTROL POSITIVO: dev/venues/<slug>/x.png sigue permitido (regla preexistente, no tocada)', async () => {
    const anon = testEnv.unauthenticatedContext()
    const fileRef = anon.storage().ref('dev/venues/some-venue/x.png')
    await assertSucceeds(Promise.resolve(fileRef.put(FAKE_FILE)))
  })
})
