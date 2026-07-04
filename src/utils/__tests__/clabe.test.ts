import { describe, expect, it } from 'vitest'
import { clabeCheckDigit, isValidClabe } from '../clabe'

describe('isValidClabe', () => {
  it('acepta CLABEs reales con dígito verificador correcto', () => {
    expect(isValidClabe('032180000118359719')).toBe(true)
    expect(isValidClabe('002010077563007516')).toBe(true)
  })

  it('rechaza un dígito verificador trocado (el error típico de captura manual)', () => {
    expect(isValidClabe('032180000118359710')).toBe(false)
    expect(isValidClabe('032180000118359718')).toBe(false)
  })

  it('rechaza longitud incorrecta y no-dígitos', () => {
    expect(isValidClabe('03218000011835971')).toBe(false) // 17
    expect(isValidClabe('0321800001183597199')).toBe(false) // 19
    expect(isValidClabe('03218000011835971x')).toBe(false)
    expect(isValidClabe('')).toBe(false)
  })

  it('clabeCheckDigit calcula el checksum Banxico de los primeros 17 dígitos', () => {
    expect(clabeCheckDigit('03218000011835971')).toBe(9)
    expect(clabeCheckDigit('00201007756300751')).toBe(6)
  })
})
