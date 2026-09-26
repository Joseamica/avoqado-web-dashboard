import { describe, expect, it } from 'vitest'
import { fusionarDireccion } from '../fusionarDireccion'

const YA_ESCRITO = { address: '', city: 'Querétaro', state: 'Querétaro', zipCode: '76030', country: 'MX' }

describe('la dirección tecleada no se borra sola', () => {
  it('🔴 teclear la CALLE sin Google no borra ciudad, estado ni CP ya escritos', () => {
    // Es exactamente lo que manda el input pelón del fallback: sólo la calle, lo demás vacío.
    const r = fusionarDireccion(YA_ESCRITO, { address: 'Av. Paseo de las Lomas 145', city: '', state: '', zipCode: '', country: '' })
    expect(r).toMatchObject({ address: 'Av. Paseo de las Lomas 145', city: 'Querétaro', state: 'Querétaro', zipCode: '76030' })
  })

  it('elegir una sugerencia de Google SÍ pisa lo tecleado: es una corrección, no un accidente', () => {
    const r = fusionarDireccion(YA_ESCRITO, {
      address: 'Av. Paseo de las Lomas 145',
      city: 'Santiago de Querétaro',
      state: 'Querétaro',
      zipCode: '76127',
      country: 'MX',
    })
    expect(r.city).toBe('Santiago de Querétaro')
    expect(r.zipCode).toBe('76127')
  })

  it('un campo con sólo espacios cuenta como vacío y no pisa nada', () => {
    expect(fusionarDireccion(YA_ESCRITO, { city: '   ' }).city).toBe('Querétaro')
  })
})
