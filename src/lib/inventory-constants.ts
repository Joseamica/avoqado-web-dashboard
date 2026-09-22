/**
 * Inventory Constants and Enums
 * Shared constants for inventory management across the dashboard
 */

// ============================================================================
// UNIT MAPPINGS - Frontend Display → Backend Enum
// ============================================================================

export const UNIT_DISPLAY_TO_ENUM = {
  // Weight
  kg: 'KILOGRAM',
  g: 'GRAM',
  mg: 'MILLIGRAM',
  lb: 'POUND',
  oz: 'OUNCE',
  ton: 'TON',

  // Volume
  L: 'LITER',
  ml: 'MILLILITER',
  gal: 'GALLON',
  qt: 'QUART',
  pt: 'PINT',
  cup: 'CUP',
  'fl oz': 'FLUID_OUNCE',
  tbsp: 'TABLESPOON',
  tsp: 'TEASPOON',

  // Count
  unit: 'UNIT',
  pcs: 'PIECE',
  pc: 'PIECE',
  piece: 'PIECE',
  dozen: 'DOZEN',

  // Container
  case: 'CASE',
  box: 'BOX',
  bag: 'BAG',
  bottle: 'BOTTLE',
  can: 'CAN',
  jar: 'JAR',

  // Length
  m: 'METER',
  cm: 'CENTIMETER',
  mm: 'MILLIMETER',
  in: 'INCH',
  ft: 'FOOT',

  // Temperature
  '°C': 'CELSIUS',
  '°F': 'FAHRENHEIT',

  // Time
  min: 'MINUTE',
  hr: 'HOUR',
  day: 'DAY',
} as const

export const UNIT_ENUM_TO_DISPLAY = Object.fromEntries(
  Object.entries(UNIT_DISPLAY_TO_ENUM).map(([k, v]) => [v, k]),
) as Record<string, string>

// ============================================================================
// UNIT CATEGORIES - Grouped by Type
// ============================================================================

export const UNIT_OPTIONS = {
  weight: [
    { value: 'KILOGRAM', label: 'kg', fullLabel: 'Kilogram' },
    { value: 'GRAM', label: 'g', fullLabel: 'Gram' },
    { value: 'MILLIGRAM', label: 'mg', fullLabel: 'Milligram' },
    { value: 'POUND', label: 'lb', fullLabel: 'Pound' },
    { value: 'OUNCE', label: 'oz', fullLabel: 'Ounce' },
    { value: 'TON', label: 'ton', fullLabel: 'Ton' },
  ],
  volume: [
    { value: 'LITER', label: 'L', fullLabel: 'Liter' },
    { value: 'MILLILITER', label: 'ml', fullLabel: 'Milliliter' },
    { value: 'GALLON', label: 'gal', fullLabel: 'Gallon' },
    { value: 'QUART', label: 'qt', fullLabel: 'Quart' },
    { value: 'PINT', label: 'pt', fullLabel: 'Pint' },
    { value: 'CUP', label: 'cup', fullLabel: 'Cup' },
    { value: 'FLUID_OUNCE', label: 'fl oz', fullLabel: 'Fluid Ounce' },
    { value: 'TABLESPOON', label: 'tbsp', fullLabel: 'Tablespoon' },
    { value: 'TEASPOON', label: 'tsp', fullLabel: 'Teaspoon' },
  ],
  count: [
    { value: 'UNIT', label: 'unit', fullLabel: 'Unit' },
    { value: 'PIECE', label: 'pcs', fullLabel: 'Piece' },
    { value: 'DOZEN', label: 'dozen', fullLabel: 'Dozen' },
  ],
  container: [
    { value: 'CASE', label: 'case', fullLabel: 'Case' },
    { value: 'BOX', label: 'box', fullLabel: 'Box' },
    { value: 'BAG', label: 'bag', fullLabel: 'Bag' },
    { value: 'BOTTLE', label: 'bottle', fullLabel: 'Bottle' },
    { value: 'CAN', label: 'can', fullLabel: 'Can' },
    { value: 'JAR', label: 'jar', fullLabel: 'Jar' },
  ],
  length: [
    { value: 'METER', label: 'm', fullLabel: 'Meter' },
    { value: 'CENTIMETER', label: 'cm', fullLabel: 'Centimeter' },
    { value: 'MILLIMETER', label: 'mm', fullLabel: 'Millimeter' },
    { value: 'INCH', label: 'in', fullLabel: 'Inch' },
    { value: 'FOOT', label: 'ft', fullLabel: 'Foot' },
  ],
} as const

// Flat list for simple dropdowns
export const ALL_UNIT_OPTIONS = [
  ...UNIT_OPTIONS.weight,
  ...UNIT_OPTIONS.volume,
  ...UNIT_OPTIONS.count,
  ...UNIT_OPTIONS.container,
  ...UNIT_OPTIONS.length,
]

// ============================================================================
// MOVEMENT TYPES - Raw Material Movements
// ============================================================================

export const MOVEMENT_TYPES = {
  PURCHASE: { label: 'Purchase', color: 'green', icon: '📦' },
  USAGE: { label: 'Usage', color: 'blue', icon: '🔧' },
  ADJUSTMENT: { label: 'Adjustment', color: 'yellow', icon: '⚖️' },
  SPOILAGE: { label: 'Spoilage', color: 'red', icon: '🗑️' },
  TRANSFER: { label: 'Transfer', color: 'purple', icon: '↔️' },
  COUNT: { label: 'Physical Count', color: 'gray', icon: '📋' },
  RETURN: { label: 'Return', color: 'orange', icon: '↩️' },
} as const

export const MOVEMENT_TYPE_OPTIONS = [
  { value: 'PURCHASE', label: 'Purchase', description: 'Received from supplier' },
  { value: 'USAGE', label: 'Usage', description: 'Used in production/orders' },
  { value: 'ADJUSTMENT', label: 'Adjustment', description: 'Manual stock adjustment' },
  { value: 'SPOILAGE', label: 'Spoilage', description: 'Expired or damaged goods' },
  { value: 'TRANSFER', label: 'Transfer', description: 'Moved to another location' },
  { value: 'COUNT', label: 'Physical Count', description: 'Inventory count reconciliation' },
  { value: 'RETURN', label: 'Return', description: 'Returned to supplier' },
] as const

/**
 * Tipos de movimiento que el servidor acepta para un PRODUCTO (enum `MovementType`). `SALE` no se
 * ofrece: lo escriben las ventas. LOSS es la merma de productos.
 */
export const PRODUCT_MOVEMENT_TYPE_OPTIONS = ['ADJUSTMENT', 'PURCHASE', 'LOSS', 'TRANSFER', 'COUNT'] as const
export type ProductMovementTypeOption = (typeof PRODUCT_MOVEMENT_TYPE_OPTIONS)[number]

// ============================================================================
// RAW MATERIAL CATEGORIES
// ============================================================================

export const RAW_MATERIAL_CATEGORIES = {
  MEAT: { label: 'Meat', icon: '🥩', color: 'red' },
  POULTRY: { label: 'Poultry', icon: '🍗', color: 'orange' },
  SEAFOOD: { label: 'Seafood', icon: '🐟', color: 'blue' },
  DAIRY: { label: 'Dairy', icon: '🥛', color: 'white' },
  CHEESE: { label: 'Cheese', icon: '🧀', color: 'yellow' },
  EGGS: { label: 'Eggs', icon: '🥚', color: 'yellow' },
  VEGETABLES: { label: 'Vegetables', icon: '🥬', color: 'green' },
  FRUITS: { label: 'Fruits', icon: '🍎', color: 'red' },
  GRAINS: { label: 'Grains', icon: '🌾', color: 'brown' },
  BREAD: { label: 'Bread', icon: '🍞', color: 'brown' },
  PASTA: { label: 'Pasta', icon: '🍝', color: 'yellow' },
  RICE: { label: 'Rice', icon: '🍚', color: 'white' },
  BEANS: { label: 'Beans', icon: '🫘', color: 'brown' },
  SPICES: { label: 'Spices', icon: '🌶️', color: 'red' },
  HERBS: { label: 'Herbs', icon: '🌿', color: 'green' },
  OILS: { label: 'Oils', icon: '🫗', color: 'yellow' },
  SAUCES: { label: 'Sauces', icon: '🥫', color: 'red' },
  CONDIMENTS: { label: 'Condiments', icon: '🧂', color: 'gray' },
  BEVERAGES: { label: 'Beverages', icon: '🥤', color: 'blue' },
  ALCOHOL: { label: 'Alcohol', icon: '🍷', color: 'purple' },
  CLEANING: { label: 'Cleaning', icon: '🧼', color: 'blue' },
  PACKAGING: { label: 'Packaging', icon: '📦', color: 'brown' },
  OTHER: { label: 'Other', icon: '📋', color: 'gray' },
} as const

export const RAW_MATERIAL_CATEGORY_OPTIONS = Object.entries(RAW_MATERIAL_CATEGORIES).map(([value, meta]) => ({
  value,
  label: meta.label,
  icon: meta.icon,
}))

// ============================================================================
// BATCH STATUS
// ============================================================================

export const BATCH_STATUS = {
  ACTIVE: { label: 'Active', color: 'green' },
  DEPLETED: { label: 'Depleted', color: 'gray' },
  EXPIRED: { label: 'Expired', color: 'red' },
} as const

// ============================================================================
// INVENTORY METHOD
// ✅ WORLD-CLASS: Toast/Square/Shopify naming pattern
// ============================================================================

export const INVENTORY_METHODS = {
  QUANTITY: { label: 'Quantity Tracking', description: 'Retail items, finished goods' },
  RECIPE: { label: 'Recipe-Based', description: 'Restaurants, recipes with ingredients' },
} as const

// ============================================================================
// WASTE TRACKING TAXONOMY
// ✅ WORLD-CLASS: Complete waste tracking taxonomy following Toast/Square patterns
// ============================================================================

export const WASTE_REASONS = {
  // Product Quality Issues
  EXPIRED: {
    label: 'Expired',
    category: 'quality',
    icon: '📅',
    color: 'red',
    description: 'Product past expiration/best-by date',
  },
  SPOILED: {
    label: 'Spoiled/Damaged',
    category: 'quality',
    icon: '🗑️',
    color: 'red',
    description: 'Product spoiled, moldy, or damaged before use',
  },
  CONTAMINATED: {
    label: 'Contaminated',
    category: 'quality',
    icon: '⚠️',
    color: 'red',
    description: 'Product contaminated or compromised',
  },
  DEFECTIVE: {
    label: 'Defective',
    category: 'quality',
    icon: '❌',
    color: 'red',
    description: 'Received defective or substandard quality',
  },

  // Operational Waste
  OVERPRODUCTION: {
    label: 'Overproduction',
    category: 'operational',
    icon: '📈',
    color: 'orange',
    description: 'Prepared too much, not sold',
  },
  PREP_ERROR: {
    label: 'Preparation Error',
    category: 'operational',
    icon: '⚡',
    color: 'orange',
    description: 'Mistake during preparation/cooking',
  },
  BURNT: {
    label: 'Burnt/Overcooked',
    category: 'operational',
    icon: '🔥',
    color: 'orange',
    description: 'Product burnt or overcooked',
  },
  UNDERCOOKED: {
    label: 'Undercooked',
    category: 'operational',
    icon: '🧊',
    color: 'orange',
    description: 'Product undercooked or improperly prepared',
  },
  DROPPED: {
    label: 'Dropped/Spilled',
    category: 'operational',
    icon: '💧',
    color: 'orange',
    description: 'Accidentally dropped or spilled',
  },

  // Customer-Related
  CUSTOMER_RETURN: {
    label: 'Customer Return',
    category: 'customer',
    icon: '↩️',
    color: 'blue',
    description: 'Customer complaint or dissatisfaction',
  },
  WRONG_ORDER: {
    label: 'Wrong Order',
    category: 'customer',
    icon: '🔄',
    color: 'blue',
    description: 'Incorrect order prepared',
  },
  CUSTOMER_CHANGE: {
    label: 'Customer Changed Mind',
    category: 'customer',
    icon: '💭',
    color: 'blue',
    description: 'Customer modified or cancelled order',
  },

  // Intentional Use
  TESTING: {
    label: 'Testing/Sampling',
    category: 'intentional',
    icon: '🧪',
    color: 'green',
    description: 'Quality testing or customer samples',
  },
  STAFF_MEAL: {
    label: 'Staff Meal',
    category: 'intentional',
    icon: '🍽️',
    color: 'green',
    description: 'Provided to staff members',
  },
  PROMOTION: {
    label: 'Promotion/Comp',
    category: 'intentional',
    icon: '🎁',
    color: 'green',
    description: 'Promotional giveaway or comp',
  },
  DONATION: {
    label: 'Donation',
    category: 'intentional',
    icon: '❤️',
    color: 'green',
    description: 'Donated to charity or community',
  },

  // Loss/Theft
  THEFT: {
    label: 'Theft',
    category: 'loss',
    icon: '🚨',
    color: 'purple',
    description: 'Product stolen',
  },
  MISSING: {
    label: 'Missing/Unaccounted',
    category: 'loss',
    icon: '❓',
    color: 'purple',
    description: 'Cannot locate inventory',
  },
  PEST_DAMAGE: {
    label: 'Pest Damage',
    category: 'loss',
    icon: '🐀',
    color: 'purple',
    description: 'Damaged by pests or rodents',
  },

  // Other
  OTHER: {
    label: 'Other',
    category: 'other',
    icon: '📋',
    color: 'gray',
    description: 'Other reason (specify in notes)',
  },
} as const

export const WASTE_CATEGORIES = {
  quality: { label: 'Product Quality', color: 'red', icon: '⚠️' },
  operational: { label: 'Operational', color: 'orange', icon: '⚙️' },
  customer: { label: 'Customer-Related', color: 'blue', icon: '👤' },
  intentional: { label: 'Intentional Use', color: 'green', icon: '✓' },
  loss: { label: 'Loss/Theft', color: 'purple', icon: '🚨' },
  other: { label: 'Other', color: 'gray', icon: '📋' },
} as const

export const WASTE_REASON_OPTIONS = Object.entries(WASTE_REASONS).map(([value, meta]) => ({
  value,
  label: meta.label,
  category: meta.category,
  icon: meta.icon,
  color: meta.color,
  description: meta.description,
}))

// Group waste reasons by category for organized display
export const WASTE_REASONS_BY_CATEGORY = {
  quality: WASTE_REASON_OPTIONS.filter(r => r.category === 'quality'),
  operational: WASTE_REASON_OPTIONS.filter(r => r.category === 'operational'),
  customer: WASTE_REASON_OPTIONS.filter(r => r.category === 'customer'),
  intentional: WASTE_REASON_OPTIONS.filter(r => r.category === 'intentional'),
  loss: WASTE_REASON_OPTIONS.filter(r => r.category === 'loss'),
  other: WASTE_REASON_OPTIONS.filter(r => r.category === 'other'),
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert frontend display unit to backend enum
 */
export function unitToEnum(displayUnit: string): string {
  return UNIT_DISPLAY_TO_ENUM[displayUnit as keyof typeof UNIT_DISPLAY_TO_ENUM] || displayUnit
}

/**
 * Convert backend enum to frontend display unit
 */
export function unitToDisplay(enumUnit: string): string {
  return UNIT_ENUM_TO_DISPLAY[enumUnit] || enumUnit
}

/**
 * Get unit label with full name
 */
export function getUnitLabel(unit: string): string {
  const option = ALL_UNIT_OPTIONS.find(u => u.value === unit || u.label === unit)
  return option?.label || unit
}

/**
 * Get full unit name
 */
export function getUnitFullName(unit: string): string {
  const option = ALL_UNIT_OPTIONS.find(u => u.value === unit)
  return option?.fullLabel || unit
}

/**
 * Format movement type with icon and color
 */
export function getMovementTypeInfo(type: keyof typeof MOVEMENT_TYPES) {
  return MOVEMENT_TYPES[type] || MOVEMENT_TYPES.ADJUSTMENT
}

/**
 * Get category metadata
 */
export function getCategoryInfo(category: keyof typeof RAW_MATERIAL_CATEGORIES) {
  return RAW_MATERIAL_CATEGORIES[category] || RAW_MATERIAL_CATEGORIES.OTHER
}
