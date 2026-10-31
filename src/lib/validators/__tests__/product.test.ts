import { describe, expect, it } from 'vitest'
import esMenu from '@/locales/es/menu.json'
import enMenu from '@/locales/en/menu.json'
import { getNameValidationRules, getSkuValidationRules, PRODUCT_NAME_MAX_LENGTH } from '../product'

describe('getNameValidationRules', () => {
  const t = (k: string) => k

  it('🔴 D2 (30-oct): acepta nombres de hasta 255 caracteres, como el servidor; con 30 la ficha no dejaba guardar nombres de etiqueta largos', () => {
    // El servidor valida `name` con .max(255) (ProductBodyBase, menu.schema.ts). Un nombre de 71 caracteres de un catálogo
    // real («Q. MANCHEGO V/TINTO MARCA FLOR ALFALFA 400gr») tiene que poder guardarse.
    const rules = getNameValidationRules(t)
    expect(PRODUCT_NAME_MAX_LENGTH).toBe(255)
    expect(rules.maxLength.value).toBe(255)
    expect(rules.minLength.value).toBe(3)
  })

  it('su mensaje dice 255 en español y en inglés, y no reusa el de las categorías (que siguen en 30)', () => {
    expect(getNameValidationRules(t).maxLength.message).toBe('forms.validation.productNameMaxLength')
    expect(esMenu.forms.validation.productNameMaxLength).toContain('255')
    expect(enMenu.forms.validation.productNameMaxLength).toContain('255')
    expect(esMenu.forms.validation.nameMaxLength).toContain('30')
  })
})

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
