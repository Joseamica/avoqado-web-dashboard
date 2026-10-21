import { describe, expect, it } from 'vitest'
import { getTierForFeature, PLAN_TIERS } from './plan-catalog'
import { FUNCIONES_SIN_LANZAR } from './plan-comparison'

describe('plan-catalog: promos en reposo de la pantalla del cliente (CUSTOMER_DISPLAY_PROMOS)', () => {
  // nuevo — espejo de LEGACY_PLAN_CODES del server (F0-A, Task 3): Pro, no Premium
  it('es Pro', () => {
    expect(getTierForFeature('CUSTOMER_DISPLAY_PROMOS')).toBe('PRO')
  })
  // nuevo — si alguien la copia a Premium, getTierForFeature seguiría diciendo PRO y nadie lo notaría
  it('no se repite en Premium ni en Enterprise', () => {
    expect(PLAN_TIERS.find(t => t.id === 'PREMIUM')!.includes).not.toContain('CUSTOMER_DISPLAY_PROMOS')
    expect(PLAN_TIERS.find(t => t.id === 'ENTERPRISE')!.includes).not.toContain('CUSTOMER_DISPLAY_PROMOS')
  })
  // nuevo — no se anuncia en la tabla de planes una función que hasta F3 no existe (carrusel, precio y fila Feature)
  it('está en FUNCIONES_SIN_LANZAR', () => {
    expect(FUNCIONES_SIN_LANZAR).toContain('CUSTOMER_DISPLAY_PROMOS')
  })
  // regresión
  it('SERVICE_PAY sigue en Pro', () => {
    expect(getTierForFeature('SERVICE_PAY')).toBe('PRO')
  })
})
