/**
 * Product Validation Utilities
 *
 * Shared validation patterns and rules for product forms across the application.
 * This ensures consistency between createProduct, productId, and wizard flows.
 */

// ============================================================================
// SKU VALIDATION
// ============================================================================

/**
 * SKU Pattern: letters without accents (either case), numbers, hyphens, underscores, dots, and spaces between
 * characters (never at the start or the end) — the same rule as the server (`SKU_REGEX`, menu.schema.ts). Spaces and
 * dots came in on 30-oct (D3): codes from other POS carry them (MyBusiness: «Q. AHUMADO», «LALA1.5»). The forms still
 * uppercase what the user types; a lowercase SKU saved by the wizard, the MCP or an import must not block saving the
 * product (D5, full-testing integral 15-oct).
 * Examples: PROD-001, ITEM_123, ABC123, Q. AHUMADO
 */
export const SKU_PATTERN = /^[A-Za-z0-9._-](?:[A-Za-z0-9 ._-]*[A-Za-z0-9._-])?$/

/**
 * Get SKU validation rules for react-hook-form
 * @param t - Translation function
 */
export const getSkuValidationRules = (t: (key: string) => string) => ({
  required: { value: true, message: t('products.create.skuRequired') },
  pattern: {
    value: SKU_PATTERN,
    message: t('products.create.skuPattern'),
  },
})

// ============================================================================
// NAME VALIDATION
// ============================================================================

/**
 * Most characters a product name can have: the same limit as the server (`ProductBodyBase.name`, `.max(255)` in
 * `avoqado-server/src/schemas/dashboard/menu.schema.ts`). It was 30, so products that came in with a longer name
 * (imports, the MCP, a catalog load: 265 of La Galeterie's 934) could not be saved from their product page (D2, 30-oct).
 */
export const PRODUCT_NAME_MAX_LENGTH = 255

/**
 * Get product name validation rules
 * @param t - Translation function
 */
export const getNameValidationRules = (t: (key: string) => string) => ({
  required: { value: true, message: t('forms.validation.nameRequired') },
  minLength: { value: 3, message: t('forms.validation.nameMinLength') },
  maxLength: { value: PRODUCT_NAME_MAX_LENGTH, message: t('forms.validation.productNameMaxLength') },
})

// ============================================================================
// PRICE VALIDATION
// ============================================================================

/**
 * Price decimal pattern: Allows up to 2 decimal places
 * Examples: 10, 10.5, 10.99
 */
export const PRICE_DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/

/**
 * Get price validation rules for react-hook-form
 * @param t - Translation function
 */
export const getPriceValidationRules = (t: (key: string) => string) => ({
  required: t('products.create.priceRequired'),
  validate: {
    isNumber: (value: string) => !isNaN(parseFloat(value)) || t('products.create.priceValid'),
    isPositive: (value: string) => parseFloat(value) > 0 || t('products.create.pricePositive'),
    hasValidDecimals: (value: string) => PRICE_DECIMAL_PATTERN.test(value) || t('products.create.priceDecimals'),
  },
})

// ============================================================================
// CATEGORY VALIDATION
// ============================================================================

/**
 * Get category validation rules
 * @param t - Translation function
 */
export const getCategoryValidationRules = (t: (key: string) => string) => ({
  required: { value: true, message: t('products.create.categoryRequired') },
})

// ============================================================================
// TYPE VALIDATION
// ============================================================================

/**
 * Get product type validation rules
 * @param t - Translation function
 */
export const getTypeValidationRules = (t: (key: string) => string) => ({
  required: t('products.create.typeRequired'),
})

// ============================================================================
// DESCRIPTION VALIDATION
// ============================================================================

/**
 * Maximum description length
 */
export const DESCRIPTION_MAX_LENGTH = 500

/**
 * Get description validation rules
 * @param t - Translation function
 */
export const getDescriptionValidationRules = (t: (key: string) => string) => ({
  maxLength: { value: DESCRIPTION_MAX_LENGTH, message: t('forms.validation.descriptionMaxLength') },
})

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Transform SKU input to uppercase automatically
 * Use with onChange handler in forms
 */
export const transformSkuToUppercase = (value: string): string => {
  return value.toUpperCase()
}

/**
 * Validate if price string is a valid currency amount
 */
export const isValidPrice = (value: string | number): boolean => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  return !isNaN(numValue) && numValue > 0 && PRICE_DECIMAL_PATTERN.test(numValue.toString())
}

/**
 * Format price for display (removes trailing zeros)
 */
export const formatPriceForDisplay = (value: number): string => {
  return value.toFixed(2).replace(/\.00$/, '')
}
