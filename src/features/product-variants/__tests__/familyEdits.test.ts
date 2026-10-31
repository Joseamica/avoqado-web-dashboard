import { describe, expect, it } from 'vitest'
import { cambiosDeVariante, cambiosDelPadre, cuerpoDeCrecimiento, edicionDe, estadoDelPadre, planDeCrecimiento } from '@/features/product-variants/familyEdits'
import type { ProductGroupDetail, ProductGroupVariant } from '@/types/productGroup'

const familia: ProductGroupDetail = {
  id: 'g1', name: 'Playera', description: null, imageUrl: 'a.jpg', categoryId: 'c1', type: 'REGULAR', ivaTratamiento: 'IVA_16',
  satProductKey: null, satUnitKey: null, printStationId: null, source: 'MANUAL', modifierGroupIds: ['m1', 'm2'],
  options: [{ id: 'o1', name: 'Talla', position: 0, values: [{ id: 's', value: 'S', position: 0 }, { id: 'm', value: 'M', position: 1 }] }],
  variants: [], archivedCount: 0, archived: false, archivedAt: null,
}
const variante: ProductGroupVariant = { id: 'p1', name: 'Playera · S', sku: 'PL-S', gtin: null, price: 199, cost: null, active: true, variantImageUrl: null, values: ['S'], stock: 3 }

describe('cambios del padre', () => {
  it('sin cambios ⇒ body vacío (los formularios reenvían todo; aquí no)', () => {
    expect(cambiosDelPadre(familia, estadoDelPadre(familia), true)).toEqual({})
  })
  it('sólo lo que cambió; descripción vacía ⇒ null; extras comparados como conjunto', () => {
    const e = { ...estadoDelPadre(familia), name: ' Playera básica ', description: '  ', modifierGroupIds: ['m2', 'm1'], satProductKey: '53101600' }
    expect(cambiosDelPadre(familia, e, true)).toEqual({ name: 'Playera básica', satProductKey: '53101600' })
    expect(cambiosDelPadre(familia, { ...e, modifierGroupIds: ['m1'] }, true)).toMatchObject({ modifierGroupIds: ['m1'] })
  })
  it('sin CFDI no manda claves SAT; el IVA sólo si cambió', () => {
    const e = { ...estadoDelPadre(familia), satProductKey: '53101600', ivaTratamiento: 'IVA_16' as const }
    expect(cambiosDelPadre(familia, e, false)).toEqual({})
    expect(cambiosDelPadre(familia, { ...e, ivaTratamiento: 'EXENTO' }, false)).toEqual({ ivaTratamiento: 'EXENTO' })
  })
})

describe('cambios de una variante', () => {
  it('sólo lo que cambió; costo vacío ⇒ null; código vacío ⇒ null', () => {
    const e = { ...edicionDe(variante), price: 249, gtin: ' ' }
    expect(cambiosDeVariante(variante, e)).toEqual({ ok: true, cambios: { price: 249 } })
    expect(cambiosDeVariante({ ...variante, cost: 80 }, { ...edicionDe({ ...variante, cost: 80 }), cost: undefined })).toEqual({ ok: true, cambios: { cost: null } })
    expect(cambiosDeVariante(variante, { ...edicionDe(variante), active: false })).toEqual({ ok: true, cambios: { active: false } })
  })
  it('rechaza precio vacío o inválido, costo 0, SKU vacío o con espacios, código largo', () => {
    expect(cambiosDeVariante(variante, { ...edicionDe(variante), price: undefined })).toEqual({ ok: false, problema: 'sinPrecio' })
    expect(cambiosDeVariante(variante, { ...edicionDe(variante), price: 19.999 })).toEqual({ ok: false, problema: 'precioInvalido' })
    expect(cambiosDeVariante(variante, { ...edicionDe(variante), cost: 0 })).toEqual({ ok: false, problema: 'costoInvalido' })
    expect(cambiosDeVariante(variante, { ...edicionDe(variante), sku: ' ' })).toEqual({ ok: false, problema: 'skuVacio' })
    expect(cambiosDeVariante(variante, { ...edicionDe(variante), sku: 'A/B' })).toEqual({ ok: false, problema: 'skuInvalido' })
    expect(cambiosDeVariante(variante, { ...edicionDe(variante), gtin: '1'.repeat(15) })).toEqual({ ok: false, problema: 'codigoLargo' })
  })
  it('con campos tocados: sólo valida y manda esos (un precio viejo inválido que nadie tocó no estorba)', () => {
    const vieja = { ...variante, price: 0 } // dato heredado: precio 0
    expect(cambiosDeVariante(vieja, { ...edicionDe(vieja), sku: 'PL-S-1' }, new Set(['sku'] as const))).toEqual({ ok: true, cambios: { sku: 'PL-S-1' } })
    expect(cambiosDeVariante(vieja, { ...edicionDe(vieja), sku: 'PL-S-1' })).toEqual({ ok: false, problema: 'precioInvalido' })
    // Un campo distinto pero NO tocado no viaja (otra persona lo cambió en el server).
    expect(cambiosDeVariante(variante, { ...edicionDe(variante), price: 249, sku: 'X' }, new Set(['sku'] as const))).toEqual({ ok: true, cambios: { sku: 'X' } })
    expect(cambiosDeVariante(variante, { ...edicionDe(variante), price: 0 }, new Set(['price'] as const))).toEqual({ ok: false, problema: 'precioInvalido' })
  })
})

const base = (variantes: string[][], opciones: Array<[string, string[]]>): ProductGroupDetail => ({
  ...familia,
  options: opciones.map(([name, values], i) => ({ id: `o${i}`, name, position: i, values: values.map((value, j) => ({ id: `${name}-${value}`, value, position: j })) })),
  variants: variantes.map((values, i) => ({ ...variante, id: `p${i}`, values })),
})

const f2 = base([['S'], ['M']], [['Talla', ['S', 'M']]])
const s1 = base([['S']], [['Talla', ['S']]])
/** 5 tallas × `colores` colores, con `vivas` combinaciones creadas (familia «rala»: el dueño no creó todas). */
const rala = (colores: number, vivas: number) =>
  base(
    Array.from({ length: vivas }, (_, i) => [`T${i % 5}`, `C${Math.floor(i / 5)}`]),
    [['Talla', ['T0', 'T1', 'T2', 'T3', 'T4']], ['Color', Array.from({ length: colores }, (_, i) => `C${i}`)]],
  )
const siete = Array.from({ length: 7 }, (_, i) => `N${i}`)

describe('crecer una familia', () => {
  it('un valor nuevo genera sólo sus combinaciones, marcadas', () => {
    const r = planDeCrecimiento(f2, { nuevosValores: { Talla: ['XL'] } })
    expect(r.problema).toBeNull()
    expect(r.filas.map(x => [x.values, x.incluida])).toEqual([[['XL'], true]])
    expect(r.faltantes).toBe(0)
  })

  it('una opción nueva: las existentes toman el valor elegido; se crean las demás', () => {
    const c = { nuevosValores: {}, nuevaOpcion: { name: 'Material', values: ['Algodón', 'Poliéster'], paraExistentes: 'Algodón' } }
    const r = planDeCrecimiento(f2, c)
    expect(r.filas.map(x => [x.values, x.incluida])).toEqual([[['S', 'Poliéster'], true], [['M', 'Poliéster'], true]])
    expect(cuerpoDeCrecimiento(f2, c, r.filas, false)).toEqual({
      newOptions: [{ name: 'Material', values: ['Algodón', 'Poliéster'], defaultValueForExisting: 'Algodón' }],
      variants: [{ values: ['S', 'Poliéster'] }, { values: ['M', 'Poliéster'] }].map(x => ({ ...x, price: undefined })),
    })
  })

  it('🔴 las que sólo usan valores viejos NO van en la tabla: se cuentan y se piden aparte, desmarcadas (pueden estar archivadas)', () => {
    const f = base([['S', 'Azul']], [['Talla', ['S', 'M']], ['Color', ['Azul']]])
    const c = { nuevosValores: { Color: ['Rojo'] } }
    const r = planDeCrecimiento(f, c)
    expect(r.filas.map(x => [x.values.join('/'), x.incluida])).toEqual([['S/Rojo', true], ['M/Rojo', true]])
    expect(r).toMatchObject({ faltantes: 1, faltantesCaben: true })
    const conFaltantes = planDeCrecimiento(f, c, true)
    expect(conFaltantes.filas.map(x => [x.values.join('/'), x.incluida])).toEqual([['S/Rojo', true], ['M/Rojo', true], ['M/Azul', false]])
  })

  it('🔴 familia rala (5×50, 30 vivas) + 7 colores: 35 nuevas sin problema; las 220 viejas que faltan no caben y no se generan', () => {
    const r = planDeCrecimiento(rala(50, 30), { nuevosValores: { Color: siete } }, true)
    expect(r.problema).toBeNull()
    expect(r.filas).toHaveLength(35)
    expect(r.filas.every(x => x.incluida && x.values[1].startsWith('N'))).toBe(true)
    expect(r).toMatchObject({ faltantes: 220, faltantesCaben: false })
  })

  it('familia rala que sí cabe (5×10, 30 vivas) + 7 colores: las 20 que faltan salen desmarcadas sólo al pedirlas', () => {
    const f = rala(10, 30)
    expect(planDeCrecimiento(f, { nuevosValores: { Color: siete } })).toMatchObject({ faltantes: 20, faltantesCaben: true })
    expect(planDeCrecimiento(f, { nuevosValores: { Color: siete } }).filas).toHaveLength(35)
    const r = planDeCrecimiento(f, { nuevosValores: { Color: siete } }, true)
    expect(r.filas).toHaveLength(55)
    expect(r.filas.slice(35).every(x => !x.incluida && !x.values[1].startsWith('N'))).toBe(true)
  })

  it('problemas: el valor para las existentes no está entre los valores, más de 3 opciones, demasiadas nuevas, sin cambios', () => {
    expect(planDeCrecimiento(s1, { nuevosValores: {}, nuevaOpcion: { name: 'Color', values: ['Azul'], paraExistentes: 'Rojo' } }).problema).toEqual({ code: 'valorParaExistentes' })
    const tres = base([['S', 'A', 'X']], [['Talla', ['S']], ['Color', ['A']], ['Corte', ['X']]])
    expect(planDeCrecimiento(tres, { nuevosValores: {}, nuevaOpcion: { name: 'Otra', values: ['1'], paraExistentes: '1' } }).problema).toEqual({ code: 'demasiadasOpciones' })
    const muchos = Array.from({ length: 99 }, (_, i) => `v${i}`) // Talla queda con 100 valores (el tope), Color con 3: 300 posibles, 1 viva
    const g = base([['S', 'A']], [['Talla', ['S']], ['Color', ['A']]])
    expect(planDeCrecimiento(g, { nuevosValores: { Talla: muchos, Color: ['B', 'C'] } }).problema).toEqual({ code: 'noCaben', count: 299, vivas: 1, caben: 249 })
    expect(planDeCrecimiento(s1, { nuevosValores: {} }).problema).toEqual({ code: 'sinCambios' })
  })

  it('🔴 QA MEDIO-1 (ronda 2): genera las nuevas y dice cuántas caben con las vivas; el tope se compara con las que el dueño marque', () => {
    // 240 vivas (20 tallas × 12 colores) + «XXL» = 12 nuevas; caben 10: se generan las 12 para que el dueño marque 10.
    const tallas = Array.from({ length: 20 }, (_, i) => `T${i}`)
    const colores = Array.from({ length: 12 }, (_, i) => `C${i}`)
    const llena = base(tallas.flatMap(t => colores.map(c => [t, c])), [['Talla', tallas], ['Color', colores]])
    const r = planDeCrecimiento(llena, { nuevosValores: { Talla: ['XXL'] } })
    expect(r).toMatchObject({ problema: null, caben: 10 })
    expect(r.filas).toHaveLength(12)
    expect(r.filas.every(x => x.incluida)).toBe(true)
    // 8 vivas + 244 nuevas: también se generan (caben 242); más de 250 nuevas ni se generan (prueba de «problemas»).
    const ocho = base(['S', 'M', 'L', 'XL'].flatMap(t => [[t, 'Azul'], [t, 'Rojo']]), [['Talla', ['S', 'M', 'L', 'XL']], ['Color', ['Azul', 'Rojo']]])
    const r8 = planDeCrecimiento(ocho, { nuevosValores: { Color: Array.from({ length: 61 }, (_, i) => `N${i}`) } })
    expect(r8).toMatchObject({ problema: null, caben: 242 })
    expect(r8.filas).toHaveLength(244)
  })

  it('las faltantes se ofrecen si caben en la tabla; las que se marquen cuentan contra `caben` como las nuevas', () => {
    // 5×50 con 200 vivas: faltan 50; con un color nuevo (5 nuevas) la tabla tiene 55 y caben 50 (el dueño elige cuáles).
    const r = planDeCrecimiento(rala(50, 200), { nuevosValores: { Color: ['N0'] } }, true)
    expect(r).toMatchObject({ problema: null, faltantes: 50, faltantesCaben: true, caben: 50 })
    expect(r.filas).toHaveLength(55)
    expect(r.filas.filter(x => x.incluida)).toHaveLength(5)
  })

  it('un valor que ya existía (con otras mayúsculas) no cuenta como cambio ni viaja como valor nuevo', () => {
    expect(planDeCrecimiento(s1, { nuevosValores: { Talla: [' s '] } }).problema).toEqual({ code: 'sinCambios' })
    expect(cuerpoDeCrecimiento(s1, { nuevosValores: { Talla: [' s '] } }, [], false)).toEqual({ variants: [] })
    expect(cuerpoDeCrecimiento(s1, { nuevosValores: { Talla: ['s', 'XL'] } }, [], false).newValues).toEqual([{ optionName: 'Talla', values: ['XL'] }])
    // Sólo un eje nuevo con un valor: ninguna fila nueva, y es válido (el body lleva variants: []).
    const c = { nuevosValores: {}, nuevaOpcion: { name: ' Material ', values: ['Algodón'], paraExistentes: 'algodón' } }
    const r = planDeCrecimiento(s1, c)
    expect(r).toMatchObject({ problema: null, filas: [] })
    expect(cuerpoDeCrecimiento(s1, c, r.filas, true)).toEqual({ newOptions: [{ name: 'Material', values: ['Algodón'], defaultValueForExisting: 'Algodón' }], variants: [] })
  })

  it('sin nada nuevo pero con combinaciones que nunca se crearon: no es «sin cambios»; se ofrecen sólo al pedirlas', () => {
    const f = base([['S', 'Azul']], [['Talla', ['S', 'M']], ['Color', ['Azul']]])
    expect(planDeCrecimiento(f, { nuevosValores: {} })).toMatchObject({ problema: null, filas: [], faltantes: 1, faltantesCaben: true })
    expect(planDeCrecimiento(f, { nuevosValores: {} }, true)).toMatchObject({ problema: null, filas: [{ values: ['M', 'Azul'], incluida: false }] })
  })

  it('existencias iniciales sólo si la familia lleva inventario', () => {
    const fila = { key: 'k', values: ['XL'], incluida: true, price: 199, initialStock: 5 }
    expect(cuerpoDeCrecimiento(f2, { nuevosValores: { Talla: ['XL'] } }, [fila], true)).toEqual({ newValues: [{ optionName: 'Talla', values: ['XL'] }], variants: [{ values: ['XL'], price: 199, initialStock: 5 }] })
    expect(cuerpoDeCrecimiento(f2, { nuevosValores: { Talla: ['XL'] } }, [fila], false).variants).toEqual([{ values: ['XL'], price: 199 }])
  })
})
