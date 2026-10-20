import { describe, expect, it } from 'vitest'
import es from '@/locales/es/billing.json'
import en from '@/locales/en/billing.json'
import { getTierForFeature, PLAN_TIERS } from './plan-catalog'
import { FUNCIONES_SIN_LANZAR, PLAN_COMPARISON } from './plan-comparison'

describe('plan-catalog: tarjetas de regalo (GIFT_CARDS)', () => {
  // Espejo de LEGACY_PLAN_CODES del server (D1 del spec): Pro, por nombre exacto — un nombre distinto falla en silencio.
  it('GIFT_CARDS es Pro', () => {
    expect(getTierForFeature('GIFT_CARDS')).toBe('PRO')
  })
  it('no se repite en Premium ni en Enterprise', () => {
    expect(PLAN_TIERS.find(t => t.id === 'PREMIUM')!.includes).not.toContain('GIFT_CARDS')
    expect(PLAN_TIERS.find(t => t.id === 'ENTERPRISE')!.includes).not.toContain('GIFT_CARDS')
  })
  it('🔴 no se anuncia en la tabla de planes hasta que el POS venda (fase 1b): sin lanzar y sin fila', () => {
    expect(FUNCIONES_SIN_LANZAR).toContain('GIFT_CARDS')
    expect(PLAN_COMPARISON.flatMap(c => c.rows.flatMap(r => r.codes ?? []))).not.toContain('GIFT_CARDS')
  })
  it('sus textos ya están escritos en es y en (nombre suelto y la fila para el lanzamiento)', () => {
    expect(es.hybrid.featureNames.GIFT_CARDS).toBe('Tarjetas de regalo')
    expect(en.hybrid.featureNames.GIFT_CARDS).toBe('Gift cards')
    expect(es.plan.compare.rows.giftCards).toBeTruthy()
    expect(en.plan.compare.rows.giftCards).toBeTruthy()
  })
})
