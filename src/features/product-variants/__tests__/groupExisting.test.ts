import { describe, expect, it } from 'vitest'
import { cuerpoDeAgrupar, esAgrupable, partirEnOpciones, sugerirDesdeNombres } from '@/features/product-variants/groupExisting'

const m = (productId: string, values: string[]) => ({ productId, name: productId, values })

describe('agrupar existentes', () => {
  it('arma el body: opciones con los valores únicos de cada columna, en orden de aparición', () => {
    const r = cuerpoDeAgrupar({ name: ' Tenis ', optionNames: [' Talla '], members: [m('a', ['26']), m('b', [' 27 ']), m('c', ['26 '])] })
    expect(r).toEqual({ ok: false, problema: { code: 'combinacionRepetida', combo: '26' } })
    const ok = cuerpoDeAgrupar({ name: ' Tenis ', categoryId: 'c1', optionNames: ['Talla', 'Color'], members: [m('a', ['26', 'Negro']), m('b', ['27', 'negro '])] })
    expect(ok).toEqual({
      ok: true,
      body: {
        name: 'Tenis', categoryId: 'c1',
        options: [{ name: 'Talla', values: ['26', '27'] }, { name: 'Color', values: ['Negro'] }],
        members: [{ productId: 'a', values: ['26', 'Negro'] }, { productId: 'b', values: ['27', 'negro'] }],
      },
    })
  })

  it('problemas: sin nombre, sin productos, más de 250, sin opciones, opción sin nombre o repetida, valor vacío, más de 100 valores', () => {
    expect(cuerpoDeAgrupar({ name: ' ', optionNames: ['T'], members: [m('a', ['1'])] })).toEqual({ ok: false, problema: { code: 'sinNombre' } })
    expect(cuerpoDeAgrupar({ name: 'X', optionNames: ['T'], members: [] })).toEqual({ ok: false, problema: { code: 'sinMiembros' } })
    expect(cuerpoDeAgrupar({ name: 'X', optionNames: ['T'], members: Array.from({ length: 251 }, (_, i) => m(`p${i}`, [`${i}`])) })).toEqual({ ok: false, problema: { code: 'demasiadosMiembros' } })
    expect(cuerpoDeAgrupar({ name: 'X', optionNames: [], members: [m('a', [])] })).toEqual({ ok: false, problema: { code: 'sinOpciones' } })
    expect(cuerpoDeAgrupar({ name: 'X', optionNames: [''], members: [m('a', ['1'])] })).toEqual({ ok: false, problema: { code: 'opcionSinNombre' } })
    expect(cuerpoDeAgrupar({ name: 'X', optionNames: ['T', 't'], members: [m('a', ['1', '2'])] })).toEqual({ ok: false, problema: { code: 'opcionRepetida', name: 't' } })
    expect(cuerpoDeAgrupar({ name: 'X', optionNames: ['T'], members: [{ productId: 'a', name: 'Tenis 26', values: [' '] }] })).toEqual({ ok: false, problema: { code: 'valorVacio', producto: 'Tenis 26' } })
    expect(cuerpoDeAgrupar({ name: 'X', optionNames: ['T'], members: Array.from({ length: 101 }, (_, i) => m(`p${i}`, [`${i}`])) })).toEqual({ ok: false, problema: { code: 'demasiadosValores', name: 'T' } })
  })

  it('sugiere el nombre común y los valores (los dos patrones reales: «X · a · b» y «X - Talla 34», que además nombra la opción)', () => {
    expect(sugerirDesdeNombres(['Playera · S · Azul', 'Playera · M · Azul'])).toEqual({ parentName: 'Playera', valores: ['S · Azul', 'M · Azul'] })
    expect(sugerirDesdeNombres(['MODELO X - Talla 34', 'MODELO X - talla 36'])).toEqual({ parentName: 'MODELO X', valores: ['34', '36'], opcion: 'Talla' })
    expect(sugerirDesdeNombres(['Agua', 'Café'])).toEqual({ parentName: '', valores: ['', ''] })
  })

  it('parte «S · Azul» en dos columnas sólo si TODOS tienen 2 o 3 partes iguales y venía una sola opción', () => {
    const una = { name: 'Playera', optionNames: [''], members: [m('a', ['S · Azul']), m('b', ['M · Rojo'])] }
    expect(partirEnOpciones(una)).toEqual({ ...una, optionNames: ['', ''], members: [m('a', ['S', 'Azul']), m('b', ['M', 'Rojo'])] })
    const disparejo = { ...una, members: [m('a', ['S · Azul']), m('b', ['M'])] }
    expect(partirEnOpciones(disparejo)).toBe(disparejo)
    const cuatro = { ...una, members: [m('a', ['a · b · c · d'])] }
    expect(partirEnOpciones(cuatro)).toBe(cuatro)
    const dosOpciones = { name: 'X', optionNames: ['Talla', 'Color'], members: [m('a', ['S · x', 'Azul'])] }
    expect(partirEnOpciones(dosOpciones)).toBe(dosOpciones)
  })

  it('sólo productos sueltos de tipos físicos o de consumo', () => {
    expect(esAgrupable({ type: 'REGULAR', productGroupId: null } as never)).toBe(true)
    expect(esAgrupable({ type: 'CLASS', productGroupId: null } as never)).toBe(false)
    expect(esAgrupable({ type: 'REGULAR', productGroupId: 'g1' } as never)).toBe(false)
  })
})
