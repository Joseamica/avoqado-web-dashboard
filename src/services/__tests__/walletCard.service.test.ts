import { describe, it, expect } from 'vitest'
import { buildWalletPassUrl, buildPosterUrl } from '../walletCard.service'

/**
 * La liga es lo unico que separa a un cliente de tener su tarjeta. Si sale mal
 * armada no hay error en ningun lado: el iPhone abre una pagina en blanco y el
 * negocio cree que el telefono del cliente esta fallando.
 */
describe('buildWalletPassUrl', () => {
  it('arma la ruta publica del pase', () => {
    expect(buildWalletPassUrl('cafe-centro', 'cus_123', 'https://api.avoqado.io')).toBe(
      'https://api.avoqado.io/api/v1/public/venues/cafe-centro/wallet/apple/cus_123',
    )
  })

  it('no duplica la diagonal cuando la base ya trae una', () => {
    expect(buildWalletPassUrl('cafe', 'c1', 'https://api.avoqado.io/')).toBe(
      'https://api.avoqado.io/api/v1/public/venues/cafe/wallet/apple/c1',
    )
  })

  it('codifica un slug con caracteres que romperian la ruta', () => {
    // El slug lo escribe el negocio: un espacio o un acento partirian la URL en dos
    // y el servidor respondaria 404 sobre un venue que si existe.
    const url = buildWalletPassUrl('café del sur', 'c1', 'https://api.avoqado.io')
    expect(url).toContain('/venues/caf%C3%A9%20del%20sur/wallet/')
    expect(url).not.toContain(' ')
  })

  it('codifica el id del cliente', () => {
    expect(buildWalletPassUrl('cafe', 'a/b', 'https://api.avoqado.io')).toContain('/wallet/apple/a%2Fb')
  })

  it('no revienta cuando todavia no hay base resuelta', () => {
    // Peor caso: devuelve una ruta relativa valida, no la cadena "undefined/api/...".
    expect(buildWalletPassUrl('cafe', 'c1', '')).toBe('/api/v1/public/venues/cafe/wallet/apple/c1')
  })
})

describe('buildPosterUrl', () => {
  it('manda al PORTAL, nunca a la ruta del pase', () => {
    // 🔴 Lo que separa un cartel util de una fuga: la ruta del `.pkpass` lleva el id
    // del cliente dentro, asi que un QR impreso con ella entregaria SIEMPRE la misma
    // tarjeta — la de quien lo imprimio. Este test falla si alguien la "simplifica".
    const url = buildPosterUrl('cafe-centro', { bookingUrl: 'https://book.avoqado.io', isDev: false })
    expect(url).toContain('/tarjeta')
    expect(url).not.toContain('/wallet/apple/')
    expect(url).not.toContain('/api/v1/')
  })

  it('codifica el slug', () => {
    expect(buildPosterUrl('café del sur', { bookingUrl: 'https://book.avoqado.io', isDev: false }))
      .toContain('/caf%C3%A9%20del%20sur/tarjeta')
  })

  it('en DESARROLLO sin destino configurado devuelve null, no la URL de produccion', () => {
    // 🔴 Este es el defecto que el founder encontro escaneando: el cartel se generaba
    // en el dashboard local pero apuntaba a `book.avoqado.io`, donde su negocio de
    // pruebas no existe — "Establecimiento no encontrado". Peor que el susto: un
    // cartel impreso desde un entorno de pruebas manda clientes REALES a la nada.
    expect(buildPosterUrl('avoqado-wellness', { bookingUrl: undefined, isDev: true })).toBeNull()
  })

  it('en desarrollo CON destino configurado si lo arma', () => {
    expect(buildPosterUrl('cafe', { bookingUrl: 'http://localhost:5176', isDev: true }))
      .toBe('http://localhost:5176/cafe/tarjeta')
  })

  it('en produccion sin variable cae al sitio publico, que ahi SI es el correcto', () => {
    expect(buildPosterUrl('cafe', { bookingUrl: undefined, isDev: false }))
      .toBe('https://book.avoqado.io/cafe/tarjeta')
  })
})
