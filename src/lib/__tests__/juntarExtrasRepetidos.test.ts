import { describe, expect, it } from 'vitest'
import { juntarExtrasRepetidos, nombreConVeces } from '../juntarExtrasRepetidos'

describe('juntarExtrasRepetidos (encargo a508f4)', () => {
  it('2 de Cochinita + 1 de Papa se leen en dos renglones, en su orden', () => {
    const r = juntarExtrasRepetidos([
      { name: 'Flautas Cochinita', price: 0 },
      { name: 'Flautas Papa', price: 0 },
      { name: 'Flautas Cochinita', price: 0 },
    ])
    expect(r.map(nombreConVeces)).toEqual(['2 × Flautas Cochinita', 'Flautas Papa'])
  })

  it('el precio es el de todas las veces, y respeta una cantidad guardada', () => {
    const r = juntarExtrasRepetidos([
      { name: 'Queso', price: '15.00' },
      { name: 'Queso', price: 15 },
      { name: 'Tocino', price: 20, quantity: 2 },
    ])
    expect(r).toEqual([
      { name: 'Queso', veces: 2, price: 30 },
      { name: 'Tocino', veces: 2, price: 40 },
    ])
  })

  it('sin repetidos sale igual que antes; vacío o null no truena', () => {
    expect(juntarExtrasRepetidos([{ name: 'Queso', price: 15 }]).map(nombreConVeces)).toEqual(['Queso'])
    expect(juntarExtrasRepetidos(null)).toEqual([])
  })

  it('el mismo nombre con distinto precio no se junta', () => {
    expect(
      juntarExtrasRepetidos([
        { name: 'Queso', price: 15 },
        { name: 'Queso', price: 18 },
      ]),
    ).toHaveLength(2)
  })

  it('toma el nombre del extra si el renglón no lo trae', () => {
    expect(juntarExtrasRepetidos([{ modifier: { name: 'Salsa' }, price: 0 }])[0].name).toBe('Salsa')
  })
})
