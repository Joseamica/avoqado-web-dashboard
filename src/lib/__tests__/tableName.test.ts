// D20 (5-nov, video del plano): el panel de la mesa decía «Mesa Mesa 1». La demo siembra las mesas como «Mesa 1…10»
// (y un negocio real en producción las guarda igual) y los textos le anteponían otra «Mesa». Se prueba con los JSON reales.
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/common.json'
import es from '@/locales/es/common.json'
import { tableName } from '@/lib/tableName'

const tDe = (dict: Record<string, unknown>) => (key: string, o?: Record<string, unknown>) => {
  const v = String(dict[key.replace(/^common:/, '')] ?? key)
  return v.replace(/\{\{(\w+)\}\}/g, (_, k) => String(o?.[k] ?? ''))
}

describe('tableName', () => {
  it('🔴 un número que ya trae la palabra no se duplica («Mesa 1», no «Mesa Mesa 1»)', () => {
    expect(tableName(tDe(es), 'Mesa 1')).toBe('Mesa 1')
    expect(tableName(tDe(es), 'mesa 12')).toBe('mesa 12')
    expect(tableName(tDe(es), '  Mesa 3 ')).toBe('Mesa 3')
    expect(tableName(tDe(en), 'Table 4')).toBe('Table 4')
  })

  it('un número solo lleva la palabra delante', () => {
    expect(tableName(tDe(es), '1')).toBe('Mesa 1')
    expect(tableName(tDe(es), 'A1')).toBe('Mesa A1')
    expect(tableName(tDe(es), 7)).toBe('Mesa 7')
    expect(tableName(tDe(en), '1')).toBe('Table 1')
  })
})
