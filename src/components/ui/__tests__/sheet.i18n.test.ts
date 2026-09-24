/**
 * /full-testing 24-sep-2026: el título oculto del panel lateral (lo lee el lector de pantalla) pedía
 * `common:sheet_title_default`, pero la llave sólo existía en `superadmin`: salía el nombre crudo de la llave.
 * El lint de llaves no ve las que llevan namespace, así que esta prueba lo cuida.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const fuente = readFileSync(resolve(__dirname, '../sheet.tsx'), 'utf8')
const llaves = [...fuente.matchAll(/t\('common:([^']+)'\)/g)].map(m => m[1])

describe('sheet.tsx — llaves de common', () => {
  it('usa al menos una llave de common (si no, esta prueba no cuida nada)', () => {
    expect(llaves).toContain('sheet_title_default')
  })

  it.each(['es', 'en', 'fr'])('toda llave de common que usa existe en %s', lang => {
    const common = JSON.parse(readFileSync(resolve(__dirname, `../../../locales/${lang}/common.json`), 'utf8'))
    for (const llave of llaves) {
      const valor = llave.split('.').reduce<any>((o, k) => o?.[k], common)
      expect(typeof valor, `${lang}: common:${llave}`).toBe('string')
    }
  })
})
