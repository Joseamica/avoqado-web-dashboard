// src/config/plan-catalog.shopify.test.ts
import { describe, expect, it } from 'vitest'
import { getTierForFeature, PLAN_TIERS } from './plan-catalog'
import { FUNCIONES_SIN_LANZAR, PLAN_COMPARISON } from './plan-comparison'

/**
 * 🔴 Fase 1 del conector Shopify: piloto por invitación, NO se vende (índice v2 §8, Codex N2). Si estuviera en un plan de
 * este catálogo, el paywall genérico le diría al dueño «viene en Premium» y contratar Premium no se lo daría. Se agrega en
 * la Fase 5, junto con su entrada en el catálogo de funciones del server.
 */
describe('plan-catalog: conector Shopify fuera de los planes en la Fase 1', () => {
  it('ningún plan lo incluye y no tiene tier para el paywall', () => {
    expect(PLAN_TIERS.flatMap(t => t.includes)).not.toContain('SHOPIFY_INTEGRATION')
    expect(getTierForFeature('SHOPIFY_INTEGRATION')).toBeNull()
  })

  it('tampoco sale en la tabla de comparación ni como «sin lanzar»', () => {
    expect(PLAN_COMPARISON.flatMap(c => c.rows.flatMap(r => r.codes ?? []))).not.toContain('SHOPIFY_INTEGRATION')
    expect(FUNCIONES_SIN_LANZAR).not.toContain('SHOPIFY_INTEGRATION')
  })
})
