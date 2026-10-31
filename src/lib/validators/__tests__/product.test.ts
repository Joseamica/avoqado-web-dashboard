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
    // El asistente, el MCP y las importaciones guardan el SKU tal cual; el servidor acepta lo mismo que SKU_PATTERN.
    expect(getSkuValidationRules(t).pattern.value.test('fulltest-x')).toBe(true)
  })

  it('🔴 D3 (30-oct): acepta espacios y puntos entre caracteres, como el servidor (códigos de otros POS)', () => {
    const { value } = getSkuValidationRules(t).pattern
    for (const sku of ['Q. AHUMADO', 'LALA1.5', 'JAMON PIERNA H SAN RAFAEL', 'PROD-001', 'ITEM_123']) expect(value.test(sku)).toBe(true)
  })

  it('sigue rechazando acentos, Ñ, símbolos y espacios en las orillas', () => {
    const { value } = getSkuValidationRules(t).pattern
    for (const sku of ['CAFÉ 1', 'VINO TERRUÑO', 'A/B', 'A#1', ' ABC', 'ABC ', '   ', '']) expect(value.test(sku)).toBe(false)
  })
})
