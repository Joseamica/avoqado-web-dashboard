// G9 (guía E6c): Metas vacías decía «…motivar a tu equipo y trackear su progreso». Para el dueño, «dar seguimiento». Se revisan
// todos los textos visibles en español (el anglicismo «trackear» y sus formas), no sólo el de Metas.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import es from '@/locales/es/commissions.json'

const textos = (o: unknown): string[] =>
  typeof o === 'string' ? [o] : o && typeof o === 'object' ? Object.values(o as Record<string, unknown>).flatMap(textos) : []

describe('sin «trackear» en textos visibles (G9)', () => {
  it('🔴 Metas vacías dice «dar seguimiento», no «trackear»', () => {
    expect(es.goals.noGoalsDescription).toBe('Crea metas de ventas para motivar a tu equipo y dar seguimiento a su progreso')
  })
  it('🔴 ningún texto en español usa «trackear» ni sus formas', () => {
    const dir = join(process.cwd(), 'src', 'locales', 'es')
    const hallados = readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .flatMap(f => textos(JSON.parse(readFileSync(join(dir, f), 'utf8').replace(/^\uFEFF/, ''))).map(t => `${f}: ${t}`))
      .filter(t => /\btrack(ear|eo|ea|eas|ean|eando|eado|eada|eados|eadas)\b/i.test(t))
    expect(hallados).toEqual([])
  })
})
