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

  describe('🔴 al agregar una opción, cada fila pasa 1 a 1 a su PRIMER valor (founder, 19-oct: como Shopify, nunca adivinar)', () => {
    const op = (name: string, values: string[]) => ({ name, values })
    const precio = (filas: FilaVariante[]) => Object.fromEntries(filas.map(f => [f.values.join('/'), f.price]))
    const tallasConPrecio = (): FilaVariante[] =>
      sincronizarFilas([op('Talla', ['S', 'M'])], []).map(f => ({ ...f, price: f.values[0] === 'S' ? 199 : 249 }))

    it('el primer color se queda con precio, costo e «incluida»; SKU, código y existencias no pasan; los demás colores salen vacíos', () => {
      const antes = sincronizarFilas([op('Talla', ['S', 'M'])], []).map((f, i) =>
        i === 0 ? { ...f, price: 199, cost: 80, sku: 'PS', gtin: '750', initialStock: 5 } : { ...f, incluida: false },
      )
      const despues = sincronizarFilas([op('Talla', ['S', 'M']), op('Color', ['Rojo', 'Azul'])], antes)
      expect(despues.map(f => [f.values.join('/'), f.price, f.cost, f.incluida, f.sku, f.gtin, f.initialStock])).toEqual([
        ['S/Rojo', 199, 80, true, undefined, undefined, undefined],
        ['S/Azul', undefined, undefined, true, undefined, undefined, undefined],
        ['M/Rojo', undefined, undefined, false, undefined, undefined, undefined],
        ['M/Azul', undefined, undefined, true, undefined, undefined, undefined],
      ])
    })

    it('igual si los colores se teclean de uno en uno; una talla nueva sale vacía', () => {
      let filas = sincronizarFilas([op('Talla', ['S', 'M']), op('Color', ['Rojo'])], tallasConPrecio())
      filas = sincronizarFilas([op('Talla', ['S', 'M']), op('Color', ['Rojo', 'Azul'])], filas)
      expect(precio(filas)).toEqual({ 'S/Rojo': 199, 'S/Azul': undefined, 'M/Rojo': 249, 'M/Azul': undefined })
      filas = sincronizarFilas([op('Talla', ['S', 'M', 'XL']), op('Color', ['Rojo', 'Azul'])], filas)
      expect(precio(filas)).toMatchObject({ 'XL/Rojo': undefined, 'XL/Azul': undefined })
    })

    it('Codex r1 P2: una talla nueva no hereda aunque su texto coincida con el valor de otra opción («Modelo: M»)', () => {
      let filas = sincronizarFilas([op('Talla', ['S', 'M']), op('Modelo', ['M'])], tallasConPrecio())
      filas = sincronizarFilas([op('Talla', ['S', 'M', 'L']), op('Modelo', ['M'])], filas)
      expect(precio(filas)).toEqual({ 'S/M': 199, 'M/M': 249, 'L/M': undefined })
    })

    it('Codex r1 P1: una tercera opción hereda de SU combinación (S·Azul·Algodón = S·Azul)', () => {
      let filas: FilaVariante[] = sincronizarFilas([op('Talla', ['S']), op('Color', ['Rojo', 'Azul'])], [])
      filas = filas.map(f => ({ ...f, price: f.values[1] === 'Rojo' ? 199 : 299 }))
      filas = sincronizarFilas([op('Talla', ['S']), op('Color', ['Rojo', 'Azul']), op('Material', ['Algodón'])], filas)
      expect(precio(filas)).toEqual({ 'S/Rojo/Algodón': 199, 'S/Azul/Algodón': 299 })
    })

    it('Codex r3 #1: filas viejas «en espera» de otras opciones no heredan (la «m» de Modelo no es la talla «M»)', () => {
      const viejas = tallasConPrecio() // nacieron con [Talla]
      // se quitó Talla mientras Modelo estaba a medias; al teclear «m» en Modelo las opciones son [Modelo, Material]
      const filas = sincronizarFilas([op('Modelo', ['m']), op('Material', ['Algodón'])], viejas)
      expect(precio(filas)).toEqual({ 'm/Algodón': undefined })
    })

    it('Codex r4 #1: con el identificador de cada opción, una opción NUEVA no toma precio ni SKU de otra con el mismo texto', () => {
      const viejas = sincronizarFilas([op('Talla', ['S', 'M'])], [], ['o0']).map(f =>
        f.values[0] === 'M' ? { ...f, price: 249, sku: 'TALLA-M' } : { ...f, price: 199 },
      )
      const filas = sincronizarFilas([op('Modelo', ['m'])], viejas, ['o1']) // se quitó Talla (o0); Modelo es otra opción (o1)
      expect(filas.map(f => [f.values[0], f.price, f.sku])).toEqual([['m', undefined, undefined]])
    })

    it('renombrar una opción (mismo identificador) conserva lo tecleado', () => {
      const filas = sincronizarFilas([op('Talla', ['S'])], [], ['o0']).map(f => ({ ...f, price: 199 }))
      expect(sincronizarFilas([op('Size', ['S'])], filas, ['o0']).map(f => f.price)).toEqual([199])
    })

    it('Codex r2: quitar una opción (la de en medio o la última) o reordenar valores nunca copia un precio de otra combinación', () => {
      let filas: FilaVariante[] = sincronizarFilas([op('Talla', ['S']), op('Color', ['Rojo', 'Azul']), op('Material', ['Algodón'])], [])
      filas = filas.map(f => ({ ...f, price: f.values[1] === 'Rojo' ? 199 : 299 }))
      expect(precio(sincronizarFilas([op('Talla', ['S']), op('Material', ['Algodón'])], filas))).toEqual({ 'S/Algodón': undefined })
      expect(precio(sincronizarFilas([op('Talla', ['S']), op('Color', ['Rojo', 'Azul'])], filas))).toEqual({ 'S/Rojo': undefined, 'S/Azul': undefined })
      let dos: FilaVariante[] = sincronizarFilas([op('Talla', ['S']), op('Color', ['Rojo', 'Azul'])], [])
      dos = dos.map(f => ({ ...f, price: f.values[1] === 'Rojo' ? 199 : 299 }))
      dos = sincronizarFilas([op('Talla', ['S']), op('Color', ['Azul'])], dos) // quita Rojo
      dos = sincronizarFilas([op('Talla', ['S']), op('Color', ['Azul', 'Rojo'])], dos) // y lo vuelve a agregar al final
      expect(precio(dos)).toEqual({ 'S/Azul': 299, 'S/Rojo': undefined })
    })
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
