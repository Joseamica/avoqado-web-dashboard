import { describe, expect, it } from 'vitest'
import { getTierForFeature, PLAN_TIERS } from './plan-catalog'
import { PLAN_COMPARISON, TIERS_COMPARADOS, valorDeCelda } from './plan-comparison'

describe('plan-catalog: pago al personal (SERVICE_PAY)', () => {
  // Espejo de LEGACY_PLAN_CODES del server (fase 3, D3): Pro, por nombre exacto — un nombre distinto falla en silencio.
  it('SERVICE_PAY es Pro', () => {
    expect(getTierForFeature('SERVICE_PAY')).toBe('PRO')
  })
  it('no se repite en Premium ni en Enterprise', () => {
    expect(PLAN_TIERS.find(t => t.id === 'PREMIUM')!.includes).not.toContain('SERVICE_PAY')
    expect(PLAN_TIERS.find(t => t.id === 'ENTERPRISE')!.includes).not.toContain('SERVICE_PAY')
  })
  it('la tabla de planes lo anuncia en «Tu equipo»: Gratis no, Pro y Premium sí', () => {
    const fila = PLAN_COMPARISON.find(c => c.key === 'team')!.rows.find(r => r.key === 'staffPay')!
    expect(TIERS_COMPARADOS.map(t => valorDeCelda(fila, t))).toEqual([false, true, true])
  })
})
