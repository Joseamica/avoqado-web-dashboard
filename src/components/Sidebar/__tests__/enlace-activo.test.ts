import { describe, expect, it } from 'vitest'
import { enlaceActivo } from '../enlace-activo'

const enRuta = (ruta: string) => (url: string) => ruta === url || ruta.startsWith(`${url}/`)
const clientes = ['customers', 'loyalty', 'loyalty/card', 'loyalty/promotions', 'gift-cards']

describe('enlaceActivo', () => {
  it('en Promociones de lealtad sólo se resalta ese renglón, no Programa de Lealtad', () => {
    const c = enRuta('loyalty/promotions')
    expect(clientes.filter(u => enlaceActivo(u, clientes, c))).toEqual(['loyalty/promotions'])
  })

  it('en Programa de Lealtad se resalta él solo', () => {
    const c = enRuta('loyalty')
    expect(clientes.filter(u => enlaceActivo(u, clientes, c))).toEqual(['loyalty'])
  })

  it('una página más profunda sin renglón propio sigue resaltando al padre', () => {
    const c = enRuta('loyalty/rewards/123')
    expect(clientes.filter(u => enlaceActivo(u, clientes, c))).toEqual(['loyalty'])
  })
})
