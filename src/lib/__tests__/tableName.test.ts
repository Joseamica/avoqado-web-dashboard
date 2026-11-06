// D20 (5-nov, video del plano): el panel de la mesa decía «Mesa Mesa 1». La demo siembra las mesas como «Mesa 1…10»
// (y un negocio real en producción las guarda igual) y los textos le anteponían otra «Mesa». Se prueba con los JSON reales.
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/common.json'
import es from '@/locales/es/common.json'
import fr from '@/locales/fr/common.json'
import { tableName } from '@/lib/tableName'

const dicts: Record<string, Record<string, unknown>> = { es, en, fr }
const tEn = (actual: string) => (key: string, o?: Record<string, unknown>) => {
  const v = String(dicts[String(o?.lng ?? actual)][key.replace(/^common:/, '')] ?? key)
  return v.replace(/\{\{(\w+)\}\}/g, (_, k) => String(o?.[k] ?? ''))
}

describe('tableName', () => {
  it('🔴 un número que ya trae la palabra no se duplica («Mesa 1», no «Mesa Mesa 1»)', () => {
    expect(tableName(tEn('es'), 'Mesa 1')).toBe('Mesa 1')
    expect(tableName(tEn('es'), 'mesa 12')).toBe('mesa 12')
    expect(tableName(tEn('es'), '  Mesa 3 ')).toBe('Mesa 3')
    expect(tableName(tEn('en'), 'Table 4')).toBe('Table 4')
  })

  it('🔴 tampoco con el panel en otro idioma: el número se guardó en el idioma de quien lo escribió (Codex r1)', () => {
    expect(tableName(tEn('en'), 'Mesa 1')).toBe('Mesa 1')
    expect(tableName(tEn('fr'), 'Mesa 1')).toBe('Mesa 1')
    expect(tableName(tEn('es'), 'Table 2')).toBe('Table 2')
  })

  it('un número solo lleva la palabra delante', () => {
    expect(tableName(tEn('es'), '1')).toBe('Mesa 1')
    expect(tableName(tEn('es'), 'A1')).toBe('Mesa A1')
    expect(tableName(tEn('es'), 7)).toBe('Mesa 7')
    expect(tableName(tEn('en'), '1')).toBe('Table 1')
  })
})
