import { describe, expect, it } from 'vitest'
import { agregarMasVendidos } from '../bestSellingAggregate'

const prod = (p: Record<string, unknown>) => ({ id: String(p.name), type: 'OTHER', price: 100, ...p }) as never

describe('agregarMasVendidos', () => {
  it('sin familias es igual que hoy: une por nombre, por tipo (top 3) y plano (top 10)', () => {
    const products = [
      prod({ name: 'Taco', type: 'FOOD', quantity: 5 }),
      prod({ name: 'Taco', type: 'FOOD', quantity: 2 }),
      prod({ name: 'Agua', type: 'BEVERAGE', quantity: 9 }),
      prod({ name: 'Flan', type: 'FOOD', quantity: 4 }),
      prod({ name: 'Sopa', type: 'FOOD', quantity: 1 }),
      prod({ name: 'Pozole', type: 'FOOD', quantity: 3 }),
      prod({ name: 'Vino', type: 'ALCOHOL', quantity: 2 }), // tipo desconocido: cae en OTHER sin unirse, como hoy
      prod({ name: 'Vino', type: 'ALCOHOL', quantity: 3 }),
    ]
    const porTipo = agregarMasVendidos(products, 'porTipo')
    expect(porTipo.FOOD.map(p => [p.name, p.quantity])).toEqual([
      ['Taco', 7],
      ['Flan', 4],
      ['Pozole', 3],
    ])
    expect(porTipo.BEVERAGE.map(p => [p.name, p.quantity])).toEqual([['Agua', 9]])
    expect(porTipo.OTHER.map(p => [p.name, p.quantity])).toEqual([
      ['Vino', 3],
      ['Vino', 2],
    ])

    const plano = agregarMasVendidos(products, 'plano')
    expect(plano).toEqual([
      { name: 'Agua', quantity: 9 },
      { name: 'Taco', quantity: 7 },
      { name: 'Vino', quantity: 5 },
      { name: 'Flan', quantity: 4 },
      { name: 'Pozole', quantity: 3 },
      { name: 'Sopa', quantity: 1 },
    ])
    expect(agregarMasVendidos(undefined, 'plano')).toEqual([])
  })

  it('dos variantes de «Playera» quedan en una barra «Playera» con la suma', () => {
    const products = [
      prod({ name: 'Playera · Chica', type: 'OTHER', quantity: 4, productGroupId: 'g1', productGroupName: 'Playera' }),
      prod({ name: 'Playera · Grande', type: 'OTHER', quantity: 6, productGroupId: 'g1', productGroupName: 'Playera' }),
      prod({ name: 'Gorra', type: 'OTHER', quantity: 3 }),
    ]
    expect(agregarMasVendidos(products, 'porTipo').OTHER.map(p => [p.name, p.quantity])).toEqual([
      ['Playera', 10],
      ['Gorra', 3],
    ])
    expect(agregarMasVendidos(products, 'plano')).toEqual([
      { name: 'Playera', quantity: 10 },
      { name: 'Gorra', quantity: 3 },
    ])
  })

  it('un producto suelto llamado «Playera» NO se mezcla con la familia', () => {
    const products = [
      prod({ name: 'Playera · Chica', type: 'OTHER', quantity: 4, productGroupId: 'g1', productGroupName: 'Playera' }),
      prod({ name: 'Playera', type: 'OTHER', quantity: 2 }),
    ]
    expect(agregarMasVendidos(products, 'porTipo').OTHER.map(p => [p.name, p.quantity])).toEqual([
      ['Playera', 4],
      ['Playera', 2],
    ])
    expect(agregarMasVendidos(products, 'plano')).toEqual([
      { name: 'Playera', quantity: 4 },
      { name: 'Playera', quantity: 2 },
    ])
  })
})
