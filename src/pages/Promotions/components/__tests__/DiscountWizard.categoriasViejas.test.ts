/**
 * D14 (Codex r3 #2, 5-nov-2026): un descuento viejo que ya era «Categorías» sin categorías no debe obligar a elegir una para
 * apagarlo. Si se edita sin tocar su alcance ni sus categorías, el guardado no manda esos dos campos (el SERVIDOR sólo
 * revisa la regla cuando el cambio los toca).
 */
import { describe, expect, it } from 'vitest'
import { sinTocarCategoriasViejas } from '../DiscountWizard'

const viejo = { scope: 'CATEGORY', targetCategoryIds: [] } as any
const datos = { name: 'Pan', scope: 'CATEGORY', targetCategoryIds: undefined, active: false } as any

describe('Editar un descuento viejo «Categorías» sin categorías', () => {
  it('🔴 sin tocar alcance ni categorías: no se mandan esos campos', () => {
    const r = sinTocarCategoriasViejas(datos, viejo)
    expect('scope' in r).toBe(false)
    expect('targetCategoryIds' in r).toBe(false)
    expect(r.active).toBe(false)
  })

  it('si elige categorías, sí se mandan', () => {
    const r = sinTocarCategoriasViejas({ ...datos, targetCategoryIds: ['c1'] }, viejo)
    expect(r.scope).toBe('CATEGORY')
    expect(r.targetCategoryIds).toEqual(['c1'])
  })

  it('un descuento con categorías o uno nuevo no cambia', () => {
    expect(sinTocarCategoriasViejas(datos, { scope: 'CATEGORY', targetCategoryIds: ['c1'] } as any)).toBe(datos)
    expect(sinTocarCategoriasViejas(datos, undefined)).toBe(datos)
  })
})
