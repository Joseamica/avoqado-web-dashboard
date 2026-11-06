// D20 (5-nov, video del plano): el panel de la mesa decía «Mesa Mesa 1». La demo siembra las mesas como «Mesa 1…10»
// (y hay negocios reales que las guardan igual) y los textos le anteponían otra «Mesa». Se prueba con los JSON reales.
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/common.json'
import es from '@/locales/es/common.json'
import fr from '@/locales/fr/common.json'
import esPlano from '@/locales/es/floorPlan.json'
import esReservas from '@/locales/es/reservations.json'
import { tableName, tableNumber } from '@/lib/tableName'

const dicts: Record<string, Record<string, unknown>> = { es, en, fr }
const interpolar = (v: string, o?: Record<string, unknown>) => v.replace(/\{\{(\w+)\}\}/g, (_, k) => String(o?.[k] ?? ''))
const tEn = (actual: string) => (key: string, o?: Record<string, unknown>) =>
  interpolar(String(dicts[String(o?.lng ?? actual)][key.replace(/^common:/, '')] ?? key), o)
const es_ = tEn('es')

describe('tableNumber: el número sin la palabra', () => {
  it('quita «Mesa»/«Table» en cualquier idioma del panel (Codex r1: «Table Mesa 1»)', () => {
    expect(tableNumber(es_, 'Mesa 1')).toBe('1')
    expect(tableNumber(es_, '  mesa 12 ')).toBe('12')
    expect(tableNumber(es_, 'Mesa-3')).toBe('3')
    expect(tableNumber(tEn('en'), 'Mesa 1')).toBe('1')
    expect(tableNumber(es_, 'Table 2')).toBe('2')
  })

  it('deja lo demás tal cual', () => {
    expect(tableNumber(es_, '5')).toBe('5')
    expect(tableNumber(es_, 'A1')).toBe('A1')
    expect(tableNumber(es_, 'Mesada 2')).toBe('Mesada 2')
    expect(tableNumber(es_, 'Tablet')).toBe('Tablet')
    expect(tableNumber(es_, 'Mesa')).toBe('Mesa')
    expect(tableNumber(es_, 7)).toBe('7')
  })
})

describe('tableName: la etiqueta suelta', () => {
  it('🔴 nunca «Mesa Mesa 1»', () => {
    expect(tableName(es_, 'Mesa 1')).toBe('Mesa 1')
    expect(tableName(es_, '1')).toBe('Mesa 1')
    expect(tableName(tEn('en'), 'Mesa 1')).toBe('Table 1')
    expect(tableName(es_, 'A1')).toBe('Mesa A1')
  })
})

describe('🔴 frases con artículo: conservan «La mesa 5» (e2e del plano, CI de #295)', () => {
  it.each([
    ['5', 'La mesa 5 tiene una cuenta abierta'],
    ['Mesa 1', 'La mesa 1 tiene una cuenta abierta'],
  ])('cuenta abierta con %s', (n, frase) => {
    expect(interpolar(esPlano.openOrders.title_one, { numbers: tableNumber(es_, n) })).toBe(frase)
  })

  it('las demás frases y etiquetas del plano y de reservaciones', () => {
    const n = tableNumber(es_, 'Mesa 1')
    expect(interpolar(esPlano.inspector.table, { number: n })).toBe('Mesa 1')
    expect(interpolar(esPlano.inspector.numberTaken, { number: n })).toBe('Ya hay una mesa 1')
    expect(interpolar(esPlano.tray.place, { number: n })).toBe('Poner la mesa 1 en el plano')
    expect(interpolar(esPlano.duplicates.title_one, { numbers: n })).toBe('Hay más de una mesa con el número 1')
    expect(interpolar(esReservas.form.tableCapacity, { number: n, capacity: 4 })).toBe('Mesa 1 (4 personas)')
  })
})
