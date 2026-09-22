import { describe, expect, it } from 'vitest'
import { isFolioWaste, wasteCostDisplay, wasteUnrecordedOf } from './historyWaste'

describe('Historial — renglones de merma con folio', () => {
  it('sólo es «merma con folio» si trae wasteReportId', () => {
    expect(isFolioWaste({ wasteReportId: 'r1' })).toBe(true)
    expect(isFolioWaste({ wasteReportId: null })).toBe(false)
    expect(isFolioWaste({})).toBe(false)
  })

  it('costo conocido: el del lote, con signo', () => {
    expect(wasteCostDisplay({ wasteReportId: 'r1', totalCost: -8 })).toEqual({ kind: 'amount', amount: -8 })
  })

  it('costo null en una merma con folio es «sin valorar», nunca 0', () => {
    expect(wasteCostDisplay({ wasteReportId: 'r1', totalCost: null })).toEqual({ kind: 'unvalued' })
  })

  it('un renglón sin folio no lo decide este módulo (sigue la lógica de siempre)', () => {
    expect(wasteCostDisplay({ wasteReportId: null, totalCost: -15 })).toBeNull()
  })

  it('«sin existencia» sólo cuando viene y es mayor que 0', () => {
    expect(wasteUnrecordedOf({ wasteReportId: 'r1', wasteUnrecorded: 2 })).toBe(2)
    expect(wasteUnrecordedOf({ wasteReportId: 'r1', wasteUnrecorded: 0 })).toBeNull()
    expect(wasteUnrecordedOf({ wasteReportId: 'r1', wasteUnrecorded: null })).toBeNull()
    expect(wasteUnrecordedOf({ wasteReportId: null, wasteUnrecorded: 2 })).toBeNull()
  })
})
