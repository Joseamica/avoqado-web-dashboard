/**
 * D15 (5-nov-2026): al fallar el alta de un cliente, el aviso salía titulado «common.error». 43 pantallas llaman
 * `tCommon('common.error')` (y otras `common.*`) y esa llave no existía en `common.json`: i18next enseña la llave tal cual.
 * Toda llave `common.*` que el código pide por el espacio común tiene que existir en español y en inglés.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(__dirname, '../..')
const archivos = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const ruta = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === '__tests__' || e.name === 'locales' ? [] : archivos(ruta)
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [ruta] : []
  })

const pedidas = new Set<string>()
for (const archivo of archivos(SRC)) {
  for (const m of fs.readFileSync(archivo, 'utf8').matchAll(/tCommon\(\s*'common\.([A-Za-z_]+)'/g)) pedidas.add(m[1])
}

describe.each(['es', 'en'])('common.json en %s', idioma => {
  const comun = JSON.parse(fs.readFileSync(path.join(SRC, 'locales', idioma, 'common.json'), 'utf8')).common ?? {}

  it('tiene todas las llaves common.* que pide el código', () => {
    expect(pedidas.size).toBeGreaterThan(0)
    expect([...pedidas].filter(llave => typeof comun[llave] !== 'string')).toEqual([])
  })
})

// D6 (16-nov, full-testing de asistencia verificada): la página de permiso negado salía en inglés («Access Denied») con el panel en
// español. Los guardias de ruta piden `routeProtection.*` por el espacio por defecto (common.json) y esas llaves sólo vivían en
// superadmin.json: i18next caía al texto en inglés del código o enseñaba la llave cruda.
const GUARDIAS = ['PermissionProtectedRoute.tsx', 'AdminProtectedRoute.tsx', 'ManagerProtectedRoute.tsx']
const deLosGuardias = new Set<string>()
for (const g of GUARDIAS) {
  for (const m of fs.readFileSync(path.join(SRC, 'routes', g), 'utf8').matchAll(/t\(\s*'routeProtection\.([A-Za-z_]+)'/g))
    deLosGuardias.add(m[1])
}
describe.each(['es', 'en'])('routeProtection en common.json (%s)', idioma => {
  const llaves = JSON.parse(fs.readFileSync(path.join(SRC, 'locales', idioma, 'common.json'), 'utf8')).routeProtection ?? {}
  it('tiene todas las llaves que piden los guardias de ruta', () => {
    expect(deLosGuardias.size).toBeGreaterThan(2)
    expect([...deLosGuardias].filter(llave => typeof llaves[llave] !== 'string')).toEqual([])
  })
})
