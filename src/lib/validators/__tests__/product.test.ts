import { describe, expect, it } from 'vitest'
import { getSkuValidationRules } from '../product'

describe('getSkuValidationRules', () => {
  const t = (k: string) => k

  it('🔴 D5 (full-testing integral 15-oct): acepta un SKU en minúsculas, como el servidor; si no, la ficha no deja guardar nada', () => {
    // El asistente, el MCP y las importaciones guardan el SKU tal cual; el servidor acepta /^[A-Za-z0-9_-]+$/.
    expect(getSkuValidationRules(t).pattern.value.test('fulltest-x')).toBe(true)
  })

  it('sigue rechazando espacios y acentos', () => {
    const { value } = getSkuValidationRules(t).pattern
    expect(value.test('CAFÉ 1')).toBe(false)
    expect(value.test('PROD-001')).toBe(true)
  })
})
