/**
 * Variantes, bloque 5 (V8): el import arma familias con «Familia» y «Opción 1-3 / Valor 1-3». La validación de verdad es del server
 * (una fila de familia incompleta se rechaza y nunca entra suelta), así que el panel MANDA la familia aunque le falte un valor.
 */
import { describe, expect, it } from 'vitest'
import { adivinarMapeo, transformCSVData, type AdvancedCSVRow } from '@/services/menuImport.service'

const fila = (extra: Partial<AdvancedCSVRow>): AdvancedCSVRow => ({
  name: 'Playera S Azul',
  sku: 'P-S',
  price: '199',
  category: 'Ropa',
  ...extra,
})
const productos = (rows: AdvancedCSVRow[]) => transformCSVData(rows, false).flatMap(c => c.products)

describe('transformCSVData — familia', () => {
  it('transformCSVData arma family con 2 opciones y la manda aunque falte un valor', () => {
    const [completa, sinValor] = productos([
      fila({ family: ' Playera ', option1Name: 'Talla', option1Value: 'S', option2Name: 'Color', option2Value: 'Azul' }),
      fila({ sku: 'P-M', family: 'Playera', option1Name: 'Talla', option1Value: 'M', option2Name: 'Color', option2Value: '' }),
    ])
    expect(completa.family).toEqual({
      name: 'Playera',
      options: [
        { name: 'Talla', value: 'S' },
        { name: 'Color', value: 'Azul' },
      ],
    })
    // el server la rechaza con su motivo; si el panel la quitara, la fila entraría suelta
    expect(sinValor.family).toEqual({
      name: 'Playera',
      options: [
        { name: 'Talla', value: 'M' },
        { name: 'Color', value: '' },
      ],
    })
  })

  it('sin la columna «Familia» asignada, las opciones solas (el «Title / Default Title» de Shopify) NUNCA arman familia', () => {
    const [p] = productos([fila({ option1Name: 'Title', option1Value: 'Default Title' })])
    expect(p).not.toHaveProperty('family')
  })

  it('con «Familia» asignada: celda vacía y opciones ⇒ viaja (el server la rechaza y no entra suelta); celda y opciones vacías ⇒ suelta', () => {
    const [conOpciones, suelta] = productos([
      fila({ family: '', option1Name: 'Talla', option1Value: 'S' }),
      fila({ sku: 'GORRA', family: '', option1Name: '', option1Value: '' }),
    ])
    expect(conOpciones.family).toEqual({ name: '', options: [{ name: 'Talla', value: 'S' }] })
    expect(suelta).not.toHaveProperty('family')
  })

  it('sin columnas de familia no viaja `family`, en básico y en avanzado', () => {
    expect(productos([fila({})])[0]).not.toHaveProperty('family')
    expect(transformCSVData([fila({ cost: '50' })], true)[0].products[0]).not.toHaveProperty('family')
  })
})

describe('adivinarMapeo — columnas de familia', () => {
  it('Shopify: «Option1 Name/Value» van a las opciones y no se las roba «Product Name»', () => {
    const m = adivinarMapeo([
      'Handle',
      'Title',
      'Option1 Name',
      'Option1 Value',
      'Option2 Name',
      'Option2 Value',
      'Variant SKU',
      'Variant Price',
    ])
    expect(m).toMatchObject({
      option1Name: 'Option1 Name',
      option1Value: 'Option1 Value',
      option2Name: 'Option2 Name',
      option2Value: 'Option2 Value',
    })
    expect(m.name).toBeUndefined()
  })

  it('Square: «Option Name 1/Option Value 1»; y la plantilla en español: «Familia», «Opción 1», «Valor 1»', () => {
    expect(adivinarMapeo(['Item Name', 'Option Name 1', 'Option Value 1', 'SKU'])).toMatchObject({
      option1Name: 'Option Name 1',
      option1Value: 'Option Value 1',
      sku: 'SKU',
    })
    expect(adivinarMapeo(['name', 'sku', 'price', 'category', 'Familia', 'Opción 1', 'Valor 1', 'Opcion 2', 'Valor 2'])).toMatchObject({
      name: 'name',
      family: 'Familia',
      option1Name: 'Opción 1',
      option1Value: 'Valor 1',
      option2Name: 'Opcion 2',
      option2Value: 'Valor 2',
    })
  })
})
