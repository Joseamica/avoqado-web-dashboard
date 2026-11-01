import { describe, expect, it } from 'vitest'
import es from '@/locales/es/billing.json'
import en from '@/locales/en/billing.json'
import { getTierForFeature, PLAN_TIERS } from '@/config/plan-catalog'
import { FUNCIONES_SIN_LANZAR, PLAN_COMPARISON } from '@/config/plan-comparison'

describe('DEVICE_MENUS en el catálogo de planes (espejo del server: Pro)', () => {
  it('el tier más bajo que lo incluye es PRO', () => {
    expect(getTierForFeature('DEVICE_MENUS')).toBe('PRO')
  })
  it('Gratis no lo incluye; aparece una sola vez', () => {
    const free = PLAN_TIERS.find(t => t.id === 'FREE')!
    expect(free.includes).not.toContain('DEVICE_MENUS')
    expect(PLAN_TIERS.flatMap(t => t.includes).filter(c => c === 'DEVICE_MENUS')).toHaveLength(1)
  })
  // Ruling 16: la tabla no anuncia «Menú de cada aparato» hasta que salgan las apps que aplican el filtro (Parte E, paso 4).
  it('🔴 está en FUNCIONES_SIN_LANZAR y no tiene fila en la tabla de planes', () => {
    expect(FUNCIONES_SIN_LANZAR).toContain('DEVICE_MENUS')
    expect(PLAN_COMPARISON.flatMap(c => c.rows.flatMap(r => r.codes ?? []))).not.toContain('DEVICE_MENUS')
  })
  it('sus textos siguen escritos en es y en, listos para el lanzamiento', () => {
    expect(es.hybrid.featureNames.DEVICE_MENUS).toBe('Menú de cada aparato')
    expect(en.hybrid.featureNames.DEVICE_MENUS).toBe('Menu per device')
    expect(es.plan.compare.rows.deviceMenus).toBeTruthy()
    expect(en.plan.compare.rows.deviceMenus).toBeTruthy()
  })
})
