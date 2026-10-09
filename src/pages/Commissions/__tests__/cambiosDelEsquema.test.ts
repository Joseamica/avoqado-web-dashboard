// ft-graves, D-B1: «Editar configuración» mandaba SIEMPRE tasa, tipo y quién recibe, aunque no cambiaran, y el servidor rechaza que
// vengan en un esquema con comisiones calculadas: tras la primera venta no se podía cambiar ni el nombre. Ahora el editor manda sólo
// lo que cambió, comparado contra lo guardado con la misma precisión que la base (Decimal de 4 decimales).
import { describe, expect, it } from 'vitest'
import type { CommissionConfig } from '@/types/commission'
import { cambiosAGuardar, camposBloqueadosQueCambian, type PropuestaDelEditor } from '../cambiosDelEsquema'

const MX = 'America/Mexico_City'
const ORIGINAL: CommissionConfig = {
  id: 'c1', venueId: 'v1', name: 'Fijo 10', priority: 1, recipient: 'SERVER', calcType: 'PERCENTAGE', defaultRate: 0.1,
  minAmount: null, maxAmount: null, includeTips: false, includeDiscount: false, includeTax: false, roleRates: null,
  filterByCategories: true, categoryIds: ['b', 'a'], filterByStaff: false, staffIds: [], useGoalAsTier: false, goalBonusRate: null,
  attendanceLinked: false, attendanceLatePenaltyRate: null, effectiveFrom: '2026-10-09T00:32:00.000Z', effectiveTo: null,
  aggregationPeriod: 'MONTHLY', active: true, createdAt: '', updatedAt: '',
} as CommissionConfig

/** La propuesta del editor cuando nadie tocó nada: lo guardado, con los días de vigencia como días del negocio. */
const sinTocar = (): PropuestaDelEditor => ({
  name: 'Fijo 10', recipient: 'SERVER', calcType: 'PERCENTAGE', defaultRate: 0.1, minAmount: null, maxAmount: null,
  includeTips: false, includeDiscount: false, includeTax: false, roleRates: null, filterByCategories: true, categoryIds: ['a', 'b'],
  filterByStaff: false, staffIds: [], useGoalAsTier: false, goalBonusRate: null, attendanceLinked: false, attendanceLatePenaltyRate: null,
  aggregationPeriod: 'MONTHLY', priority: 1, desde: '2026-10-08', hasta: null,
})

describe('cambiosAGuardar', () => {
  it('🔴 sin tocar nada no manda nada (ni tasa, ni tipo, ni quién recibe, ni la fecha)', () => {
    expect(cambiosAGuardar(ORIGINAL, sinTocar(), MX)).toEqual({})
  })

  it('🔴 cambiar sólo el nombre manda sólo el nombre', () => {
    expect(cambiosAGuardar(ORIGINAL, { ...sinTocar(), name: 'Bebidas 10%' }, MX)).toEqual({ name: 'Bebidas 10%' })
  })

  it('prender «Calcular con IVA» manda sólo eso', () => {
    expect(cambiosAGuardar(ORIGINAL, { ...sinTocar(), includeTax: true }, MX)).toEqual({ includeTax: true })
  })

  it('a quién aplica: si cambia, viajan juntos `filterByStaff` y `staffIds`', () => {
    expect(cambiosAGuardar(ORIGINAL, { ...sinTocar(), filterByStaff: true, staffIds: ['maria'] }, MX)).toEqual({
      filterByStaff: true,
      staffIds: ['maria'],
    })
  })

  it('un servidor sin restricción por persona (la propuesta no la trae) no la manda', () => {
    const { filterByStaff: _f, staffIds: _s, ...sinRestriccion } = sinTocar()
    expect(cambiosAGuardar(ORIGINAL, sinRestriccion as PropuestaDelEditor, MX)).toEqual({})
  })

  it('las categorías se comparan como conjunto: el mismo grupo en otro orden no es un cambio', () => {
    expect(cambiosAGuardar(ORIGINAL, { ...sinTocar(), categoryIds: ['b', 'a'] }, MX)).toEqual({})
    expect(cambiosAGuardar(ORIGINAL, { ...sinTocar(), categoryIds: ['a'] }, MX)).toEqual({ categoryIds: ['a'] })
  })

  it('la tasa se compara a 4 decimales (la precisión de la base): 0.1 de vuelta del campo no es un cambio', () => {
    expect(cambiosAGuardar(ORIGINAL, { ...sinTocar(), defaultRate: (0.1 * 100) / 100 }, MX)).toEqual({})
    expect(cambiosAGuardar({ ...ORIGINAL, defaultRate: 0.0333 }, { ...sinTocar(), defaultRate: 0.03333 }, MX)).toEqual({})
    expect(cambiosAGuardar(ORIGINAL, { ...sinTocar(), defaultRate: 0.12 }, MX)).toEqual({ defaultRate: 0.12 })
  })

  it('tasas por rol: null y {} son lo mismo; otro valor sí es un cambio', () => {
    expect(cambiosAGuardar({ ...ORIGINAL, roleRates: {} }, sinTocar(), MX)).toEqual({})
    expect(cambiosAGuardar(ORIGINAL, { ...sinTocar(), roleRates: { WAITER: 0.03 } }, MX)).toEqual({ roleRates: { WAITER: 0.03 } })
  })

  describe('vigencia (en el día del negocio)', () => {
    it('🔴 el mismo día que ya estaba no se manda: el instante guardado no se mueve', () => {
      expect(cambiosAGuardar(ORIGINAL, { ...sinTocar(), desde: '2026-10-08' }, MX)).toEqual({})
    })

    it('otro día viaja como su medianoche en México', () => {
      expect(cambiosAGuardar(ORIGINAL, { ...sinTocar(), desde: '2026-10-10' }, MX)).toEqual({ effectiveFrom: '2026-10-10T06:00:00.000Z' })
    })

    it('poner fin manda el último instante de ese día; quitarlo manda null', () => {
      expect(cambiosAGuardar(ORIGINAL, { ...sinTocar(), hasta: '2026-10-31' }, MX)).toEqual({ effectiveTo: '2026-11-01T05:59:59.999Z' })
      const conFin = { ...ORIGINAL, effectiveTo: '2026-11-01T05:59:59.999Z' }
      expect(cambiosAGuardar(conFin, { ...sinTocar(), hasta: '2026-10-31' }, MX)).toEqual({})
      expect(cambiosAGuardar(conFin, { ...sinTocar(), hasta: null }, MX)).toEqual({ effectiveTo: null })
    })
  })
})

describe('camposBloqueadosQueCambian (esquema con comisiones calculadas)', () => {
  it('dice qué campo bloqueado cambiaría; los demás no cuentan', () => {
    expect(camposBloqueadosQueCambian({ name: 'x', includeTax: true })).toEqual([])
    expect(camposBloqueadosQueCambian({ defaultRate: 0.2, calcType: 'FIXED', recipient: 'CREATOR' })).toEqual([
      'defaultRate',
      'calcType',
      'recipient',
    ])
  })
})
