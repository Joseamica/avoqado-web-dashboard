import { describe, expect, it } from 'vitest'
import {
  contarCombinaciones, filaParaServidor, generarCombinaciones, limpiarOpciones, llaveDeCombinacion, nombreDeVariante,
  resumenDeFamilia, sincronizarFilas, sugerirSku, validarFilas, validarOpciones, type FilaVariante,
} from '@/features/product-variants/combinations'

describe('opciones', () => {
  it('limpia espacios, vacíos y repetidos sin importar mayúsculas (se queda la primera escritura)', () => {
    expect(limpiarOpciones([{ name: ' Talla ', values: [' M', 'm', '', 'L ', 'l'] }])).toEqual([{ name: 'Talla', values: ['M', 'L'] }])
  })

  it('🔴 cuenta antes de generar: 40 × 20 × 10 no genera nada y dice cuántas son', () => {
    const muchos = (n: number) => Array.from({ length: n }, (_, i) => `v${i}`)
    const ops = [{ name: 'A', values: muchos(40) }, { name: 'B', values: muchos(20) }, { name: 'C', values: muchos(10) }]
    expect(contarCombinaciones(ops)).toBe(8000)
    expect(validarOpciones(ops)).toEqual({ code: 'demasiadasCombinaciones', count: 8000 })
    expect(() => generarCombinaciones(ops)).toThrow()
  })

  it('valida como el server: sin opciones, más de 3, sin nombre, repetida, sin valores, más de 100, texto largo', () => {
    expect(validarOpciones([])).toEqual({ code: 'sinOpciones' })
    expect(validarOpciones([1, 2, 3, 4].map(i => ({ name: `O${i}`, values: ['a'] })))).toEqual({ code: 'demasiadasOpciones' })
    expect(validarOpciones([{ name: '', values: ['a'] }])).toEqual({ code: 'opcionSinNombre' })
    expect(validarOpciones([{ name: 'Talla', values: ['a'] }, { name: 'talla', values: ['b'] }])).toEqual({ code: 'opcionRepetida', name: 'talla' })
    expect(validarOpciones([{ name: 'Color', values: [] }])).toEqual({ code: 'opcionSinValores', name: 'Color' })
    expect(validarOpciones([{ name: 'X', values: Array.from({ length: 101 }, (_, i) => `${i}`) }])).toEqual({ code: 'demasiadosValores', name: 'X' })
    expect(validarOpciones([{ name: 'X', values: ['a'.repeat(41)] }])).toEqual({ code: 'textoLargo', text: 'a'.repeat(41) })
    expect(validarOpciones([{ name: 'Talla', values: ['S', 'M'] }])).toBeNull()
  })

  it('genera en el orden de las opciones y de los valores', () => {
    expect(generarCombinaciones([{ name: 'Talla', values: ['S', 'M'] }, { name: 'Color', values: ['Azul', 'Rojo'] }])).toEqual([
      ['S', 'Azul'], ['S', 'Rojo'], ['M', 'Azul'], ['M', 'Rojo'],
    ])
  })
})

describe('nombres y SKU', () => {
  it('nombre con el separador del server', () => {
    expect(nombreDeVariante(' Playera básica ', ['M', 'Azul'])).toBe('Playera básica · M · Azul')
  })
  it('SKU sugerido igual que el server (sin acentos, mayúsculas, guiones)', () => {
    expect(sugerirSku('Playera básica', ['M', 'Azul'])).toBe('PLAYERA-BASICA-M-AZUL')
    expect(sugerirSku('Café ½ kg', ['Grano'])).toBe('CAFE-KG-GRANO')
  })
  it('la llave ignora mayúsculas y espacios', () => {
    expect(llaveDeCombinacion([' m', 'AZUL'])).toBe(llaveDeCombinacion(['M', 'azul']))
  })
})

describe('filas', () => {
  it('al cambiar opciones conserva lo tecleado en las combinaciones que siguen', () => {
    const antes = sincronizarFilas([{ name: 'Talla', values: ['S', 'M'] }], [])
    const tecleadas = antes.map(f => ({ ...f, price: 199 }))
    const despues = sincronizarFilas([{ name: 'Talla', values: ['S', 'M', 'L'] }], tecleadas)
    expect(despues.map(f => [f.values[0], f.price])).toEqual([['S', 199], ['M', 199], ['L', undefined]])
    expect(despues.every(f => f.incluida)).toBe(true)
  })

  it('🔴 al agregar otra opción, cada combinación nueva hereda precio, costo e «incluida» de la talla de la que sale (SKU, código y existencias no)', () => {
    const antes = sincronizarFilas([{ name: 'Talla', values: ['S', 'M'] }], []).map((f, i) =>
      i === 0 ? { ...f, price: 199, cost: 80, sku: 'PS', gtin: '750', initialStock: 5 } : { ...f, incluida: false },
    )
    const despues = sincronizarFilas([{ name: 'Talla', values: ['S', 'M'] }, { name: 'Color', values: ['Rojo', 'Azul'] }], antes)
    expect(despues.map(f => [f.values.join('/'), f.price, f.cost, f.incluida, f.sku, f.gtin, f.initialStock])).toEqual([
      ['S/Rojo', 199, 80, true, undefined, undefined, undefined],
      ['S/Azul', 199, 80, true, undefined, undefined, undefined],
      ['M/Rojo', undefined, undefined, false, undefined, undefined, undefined],
      ['M/Azul', undefined, undefined, false, undefined, undefined, undefined],
    ])
    // y al quitar la opción, la talla vuelve con el precio de su primera combinación
    const conPrecio = despues.map(f => (f.values[0] === 'M' ? { ...f, price: 249, incluida: true } : f))
    expect(sincronizarFilas([{ name: 'Talla', values: ['S', 'M'] }], conPrecio).map(f => [f.values[0], f.price])).toEqual([['S', 199], ['M', 249]])
  })

  it('🔴 tecleando los colores de uno en uno (Enter tras cada uno), cada color nuevo también hereda de su talla; una talla nueva no hereda', () => {
    const tallas = (vs: string[]) => ({ name: 'Talla', values: vs })
    const color = (vs: string[]) => ({ name: 'Color', values: vs })
    let filas: FilaVariante[] = sincronizarFilas([tallas(['S', 'M'])], []).map(f => ({ ...f, price: f.values[0] === 'S' ? 199 : 249 }))
    filas = sincronizarFilas([tallas(['S', 'M']), color(['Rojo'])], filas)
    filas = sincronizarFilas([tallas(['S', 'M']), color(['Rojo', 'Azul'])], filas)
    expect(filas.map(f => [f.values.join('/'), f.price])).toEqual([['S/Rojo', 199], ['S/Azul', 199], ['M/Rojo', 249], ['M/Azul', 249]])
    filas = sincronizarFilas([tallas(['S', 'M', 'XL']), color(['Rojo', 'Azul'])], filas)
    expect(filas.filter(f => f.values[0] === 'XL').map(f => f.price)).toEqual([undefined, undefined])
  })

  it('resume la familia para la vista previa: cuántas incluidas y el rango de precios capturados', () => {
    const f = (values: string[], x: object) => ({ key: values.join(), values, incluida: true, ...x })
    expect(resumenDeFamilia([])).toEqual({ count: 0 })
    expect(resumenDeFamilia([f(['S'], {}), f(['M'], {})])).toEqual({ count: 2 })
    expect(resumenDeFamilia([f(['S'], { price: 299 }), f(['M'], { price: 299 }), f(['L'], { price: 9, incluida: false })])).toEqual({ count: 2, min: 299, max: 299 })
    expect(resumenDeFamilia([f(['S'], { price: 199 }), f(['M'], { price: 249 }), f(['L'], {})])).toEqual({ count: 3, min: 199, max: 249 })
  })

  it('valida precio obligatorio > 0 con 2 decimales, costo > 0, SKU válido y sin repetir, código ≤ 14, existencias enteras', () => {
    const f = (x: object) => ({ key: 'k', values: ['M'], incluida: true, ...x })
    expect(validarFilas('P', [], false)).toEqual({ code: 'sinFilas' })
    expect(validarFilas('P', [f({})], false)).toEqual({ code: 'sinPrecio', nombre: 'P · M' })
    expect(validarFilas('P', [f({ price: 0 })], false)).toEqual({ code: 'precioInvalido', nombre: 'P · M' })
    expect(validarFilas('P', [f({ price: 19.999 })], false)).toEqual({ code: 'precioInvalido', nombre: 'P · M' })
    expect(validarFilas('P', [f({ price: 1e-7 })], false)).toEqual({ code: 'precioInvalido', nombre: 'P · M' })
    expect(validarFilas('P', [f({ price: 10, cost: 0 })], false)).toEqual({ code: 'costoInvalido', nombre: 'P · M' })
    expect(validarFilas('P', [f({ price: 10, sku: 'A B' })], false)).toEqual({ code: 'skuInvalido', nombre: 'P · M' })
    expect(validarFilas('P', [f({ price: 10, sku: 'X' }), { ...f({ price: 10, sku: 'X' }), key: 'k2', values: ['L'] }], false)).toEqual({ code: 'skuRepetido', sku: 'X' })
    expect(validarFilas('P', [f({ price: 10, sku: 'x' }), { ...f({ price: 10, sku: 'X' }), key: 'k2', values: ['L'] }], false)).toBeNull() // el server distingue mayúsculas
    expect(validarFilas('P', [f({ price: 10, gtin: '1'.repeat(15) })], false)).toEqual({ code: 'codigoLargo', nombre: 'P · M' })
    expect(validarFilas('P', [f({ price: 10, initialStock: 1.5 })], true)).toEqual({ code: 'existenciasInvalidas', nombre: 'P · M' })
    expect(validarFilas('P', [f({ price: 19.99 }), { ...f({}), key: 'k2', incluida: false }], false)).toBeNull()
  })

  it('🔴 la fila para el server OMITE el SKU vacío (el server rechaza "") y el costo vacío', () => {
    const fila = { key: 'k', values: ['M'], incluida: true, price: 199, sku: '  ', gtin: '', initialStock: 3 }
    expect(filaParaServidor(fila, false)).toEqual({ values: ['M'], price: 199 })
    expect(filaParaServidor({ ...fila, sku: ' PB-M ', gtin: ' 750 ', cost: 80 }, true)).toEqual({
      values: ['M'], price: 199, cost: 80, sku: 'PB-M', gtin: '750', initialStock: 3,
    })
  })
})
