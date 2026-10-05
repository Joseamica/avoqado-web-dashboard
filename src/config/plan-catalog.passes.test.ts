import { describe, expect, it } from 'vitest'
import { getTierForFeature, PLAN_TIERS } from './plan-catalog'
import { FUNCIONES_SIN_LANZAR } from './plan-comparison'

describe('plan-catalog: pases (AGGREGATOR_PASSES)', () => {
  // nuevo — espejo de LEGACY_PLAN_CODES del server (Plan 2a T1): Pro, no Premium
  it('AGGREGATOR_PASSES es Pro', () => {
    expect(getTierForFeature('AGGREGATOR_PASSES')).toBe('PRO')
  })
  // nuevo — si alguien lo copia también a Premium, getTierForFeature seguiría diciendo PRO y nadie lo notaría
  it('no se repite en Premium ni en Enterprise', () => {
    expect(PLAN_TIERS.find(t => t.id === 'PREMIUM')!.includes).not.toContain('AGGREGATOR_PASSES')
    expect(PLAN_TIERS.find(t => t.id === 'ENTERPRISE')!.includes).not.toContain('AGGREGATOR_PASSES')
  })
  // nuevo — P2-15: entra al catálogo (el paywall la conoce) pero NO se anuncia en la tabla de planes hasta que el founder lo decida;
  // sin esto, planComparison.test.ts («cada función de Free, Pro y Premium aparece en alguna fila») se rompe
  it('está en FUNCIONES_SIN_LANZAR: el paywall la conoce, la tabla de comparación todavía no la anuncia', () => {
    expect(FUNCIONES_SIN_LANZAR).toContain('AGGREGATOR_PASSES')
  })
  // regresión
  it('RESERVATIONS sigue en Pro', () => {
    expect(getTierForFeature('RESERVATIONS')).toBe('PRO')
  })
})
