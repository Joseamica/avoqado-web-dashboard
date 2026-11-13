import { describe, expect, it } from 'vitest'
import { cuentasParaConfigPropia, esHeredadaDeLaOrganizacion, refrescarLecturasDeConfigDePagos } from '../configDePagosOrigen'

describe('esHeredadaDeLaOrganizacion', () => {
  it('lo dice el SERVIDOR con configSource', () => {
    expect(esHeredadaDeLaOrganizacion({ configSource: 'organization', venueId: 'v1' })).toBe(true)
    expect(esHeredadaDeLaOrganizacion({ configSource: 'venue', organizationId: 'o1' })).toBe(false)
  })

  it('con un SERVIDOR anterior (sin configSource) se reconoce por la forma de la fila', () => {
    expect(esHeredadaDeLaOrganizacion({ organizationId: 'o1' })).toBe(true)
    expect(esHeredadaDeLaOrganizacion({ venueId: 'v1' })).toBe(false)
  })

  it('sin configuración no es heredada', () => {
    expect(esHeredadaDeLaOrganizacion(null)).toBe(false)
    expect(esHeredadaDeLaOrganizacion(undefined)).toBe(false)
  })
})

describe('cuentasParaConfigPropia', () => {
  const heredada = { primaryAccountId: 'm1', secondaryAccountId: 'm2', tertiaryAccountId: null }

  it('conserva las otras posiciones heredadas y cambia sólo la elegida', () => {
    expect(cuentasParaConfigPropia(heredada, 'TERTIARY', 'm9')).toEqual({
      primaryAccountId: 'm1',
      secondaryAccountId: 'm2',
      tertiaryAccountId: 'm9',
    })
    expect(cuentasParaConfigPropia(heredada, 'PRIMARY', 'm9')).toEqual({ primaryAccountId: 'm9', secondaryAccountId: 'm2' })
  })

  it('una cuenta que ya ocupaba otra posición se mueve (no queda en dos)', () => {
    expect(cuentasParaConfigPropia(heredada, 'TERTIARY', 'm2')).toEqual({ primaryAccountId: 'm1', tertiaryAccountId: 'm2' })
  })

  it('sin cuenta principal no se puede crear', () => {
    expect(() => cuentasParaConfigPropia(heredada, 'SECONDARY', 'm1')).toThrow(/cuenta principal/)
  })
})

describe('refrescarLecturasDeConfigDePagos', () => {
  const llamadas = () => {
    const claves: unknown[][] = []
    return { claves, qc: { invalidateQueries: (f: { queryKey: readonly unknown[] }) => claves.push([...f.queryKey]) } }
  }

  it('con negocio: cada lectura de ese negocio, y la de por cuenta entera', () => {
    const { claves, qc } = llamadas()
    refrescarLecturasDeConfigDePagos(qc, 'v1')
    expect(claves).toEqual([
      ['venue-payment-config', 'v1'],
      ['venue-payment-config-for-angelpay-approval', 'v1'],
      ['venue-cost-structures', 'v1'],
      ['venue-pricing-structures', 'v1'],
      ['payment-readiness', 'v1'],
      ['venueMerchantAccounts', 'v1'],
      ['venueSettlementInfo', 'v1'],
      ['venue-payment-config-by-merchant'],
    ])
  })

  it('sin negocio: todas, por prefijo', () => {
    const { claves, qc } = llamadas()
    refrescarLecturasDeConfigDePagos(qc)
    expect(claves.every(c => c.length === 1)).toBe(true)
    expect(claves).toHaveLength(8)
  })
})
