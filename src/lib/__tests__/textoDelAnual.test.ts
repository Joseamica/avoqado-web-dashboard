import { describe, expect, it } from 'vitest'
import { textoDelAnual } from '../textoDelAnual'

describe('textoDelAnual (con IVA)', () => {
  it('10 meses al año = 2 meses gratis', () => {
    expect(textoDelAnual(92684, 926840)).toEqual({ tipo: 'dosMesesGratis' })
  })
  it('ahorro distinto de 2 meses', () => {
    expect(textoDelAnual(92684, 986000)).toEqual({ tipo: 'ahorras', grossCentsAlAnio: 126208 })
  })
  it('sin ahorro: null', () => {
    expect(textoDelAnual(92684, 1112208)).toBeNull()
    expect(textoDelAnual(92684, 1148400)).toBeNull()
  })
  it('el redondeo nunca es dos meses gratis', () => {
    expect(textoDelAnual(115887, 1158875)).toEqual({ tipo: 'ahorras', grossCentsAlAnio: 231769 })
  })
})
