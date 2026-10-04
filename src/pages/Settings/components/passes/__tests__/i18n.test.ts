/**
 * Paridad es/en del namespace `passes` y las claves DINÁMICAS (prefijos que el código completa en tiempo de ejecución),
 * que el lint no puede seguir. Las referencias estáticas las vigila el lint existente (`no-missing-translation-keys`,
 * `npm run lint:i18n`). fr no se soporta (founder, 28-sep-2026).
 */
import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const LOCALES = path.resolve(__dirname, '../../../../../locales')
const IDIOMAS = ['es', 'en'] as const

const crudo = (lng: string) => fs.readFileSync(path.join(LOCALES, lng, 'passes.json'), 'utf-8')
const bundle = (lng: string) => JSON.parse(crudo(lng)) as Record<string, unknown>
const aplanar = (o: Record<string, unknown>, p = ''): Array<[string, unknown]> =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? aplanar(v as Record<string, unknown>, `${p}${k}.`) : [[`${p}${k}`, v] as [string, unknown]],
  )

/** Prefijos dinámicos, con los valores REALES que el código puede producir. */
const DINAMICAS: Record<string, string[]> = {
  days: ['0', '1', '2', '3', '4', '5', '6'],
  daysPlural: ['0', '1', '2', '3', '4', '5', '6'],
  providers: ['TOTALPASS', 'WELLHUB'],
  'visits.tabs': ['pending', 'confirmed', 'portal', 'expired', 'rejected'],
  'visits.empty': ['pending', 'confirmed', 'portal', 'expired', 'rejected'],
  'visits.status': ['PENDING', 'CONFIRMED', 'ALREADY_CONFIRMED', 'EXPIRED', 'REJECTED'],
  'visits.confirmedBy': ['AUTO', 'VENUE'],
  'summary.columns': ['confirmed', 'alreadyConfirmed', 'expired', 'rejected', 'pending', 'lateCancellations'],
}

describe('i18n del conector de pases', () => {
  it('🔴 es y en tienen exactamente las MISMAS claves', () => {
    const [es, en] = IDIOMAS.map(l =>
      aplanar(bundle(l))
        .map(([k]) => k)
        .sort(),
    )
    expect(en).toEqual(es)
  })

  it.each(IDIOMAS)('🔴 %s tiene todas las claves dinámicas', lng => {
    const claves = new Set(aplanar(bundle(lng)).map(([k]) => k))
    const faltan = Object.entries(DINAMICAS)
      .flatMap(([p, vs]) => vs.map(v => `${p}.${v}`))
      .filter(c => !claves.has(c))
    expect(faltan).toEqual([])
  })

  it.each(IDIOMAS)('🔴 %s usa plurales _one/_other, nunca _plural', lng => {
    expect(crudo(lng)).not.toMatch(/_plural"/)
  })

  it('🔴 ningún texto quedó vacío, y es no trae botones en inglés', () => {
    for (const lng of IDIOMAS) {
      const vacias = aplanar(bundle(lng))
        .filter(([, v]) => v === '' || v === null)
        .map(([k]) => k)
      expect(vacias, lng).toEqual([])
    }
    expect(crudo('es')).not.toMatch(/"(Save|Cancel|Loading|Connect)"/)
  })
})
