import api from '@/api'

// ===========================================
// RAW MATERIALS API
// ===========================================

export interface RawMaterial {
  id: string
  venueId: string
  name: string
  description?: string
  sku: string
  category: string
  currentStock: number
  unit: string
  minimumStock: number
  reorderPoint: number
  maximumStock?: number
  costPerUnit: number
  avgCostPerUnit: number
  perishable: boolean
  shelfLifeDays?: number // Used to calculate batch expiration dates
  active: boolean
  lastCountAt?: string
  lastRestockAt?: string
  createdAt: string
  updatedAt: string
  _count?: {
    recipeLines: number
  }
}

export interface CreateRawMaterialDto {
  name: string
  description?: string
  sku: string
  category: string
  currentStock: number
  unit: string
  minimumStock: number
  reorderPoint: number
  maximumStock?: number
  costPerUnit: number
  avgCostPerUnit?: number
  perishable: boolean
  shelfLifeDays?: number // Required if perishable=true
}

export interface UpdateRawMaterialDto {
  name?: string
  description?: string
  sku?: string
  category?: string
  currentStock?: number
  unit?: string
  minimumStock?: number
  reorderPoint?: number
  maximumStock?: number
  costPerUnit?: number
  perishable?: boolean
  shelfLifeDays?: number
  active?: boolean
}

export interface AdjustStockDto {
  quantity: number
  type: 'PURCHASE' | 'USAGE' | 'ADJUSTMENT' | 'SPOILAGE' | 'TRANSFER' | 'RETURN' | 'COUNT'
  reason?: string
  reference?: string
}

export const rawMaterialsApi = {
  getAll: (venueId: string, filters?: { category?: string; lowStock?: boolean; active?: boolean; search?: string }) =>
    api.get(`/api/v1/dashboard/venues/${venueId}/inventory/raw-materials`, { params: filters }),

  getById: (venueId: string, rawMaterialId: string) => api.get(`/api/v1/dashboard/venues/${venueId}/inventory/raw-materials/${rawMaterialId}`),

  // Check if a SKU already exists (for validation)
  checkSkuExists: async (venueId: string, sku: string, excludeId?: string): Promise<boolean> => {
    const response = await api.get<{ data: RawMaterial[] }>(`/api/v1/dashboard/venues/${venueId}/inventory/raw-materials`, {
      params: { search: sku }
    })
    const materials = response.data?.data || []
    // Check for exact SKU match (case-insensitive), excluding the current item if editing
    return materials.some(m => m.sku.toLowerCase() === sku.toLowerCase() && m.id !== excludeId)
  },

  create: (venueId: string, data: CreateRawMaterialDto) => api.post(`/api/v1/dashboard/venues/${venueId}/inventory/raw-materials`, data),

  update: (venueId: string, rawMaterialId: string, data: UpdateRawMaterialDto) =>
    api.put(`/api/v1/dashboard/venues/${venueId}/inventory/raw-materials/${rawMaterialId}`, data),

  delete: (venueId: string, rawMaterialId: string) => api.delete(`/api/v1/dashboard/venues/${venueId}/inventory/raw-materials/${rawMaterialId}`),

  adjustStock: (venueId: string, rawMaterialId: string, data: AdjustStockDto) =>
    api.post(`/api/v1/dashboard/venues/${venueId}/inventory/raw-materials/${rawMaterialId}/adjust-stock`, data),

  getMovements: (venueId: string, rawMaterialId: string, filters?: { startDate?: string; endDate?: string; limit?: number }) =>
    api.get(`/api/v1/dashboard/venues/${venueId}/inventory/raw-materials/${rawMaterialId}/movements`, { params: filters }),

  getRecipes: (venueId: string, rawMaterialId: string) =>
    api.get(`/api/v1/dashboard/venues/${venueId}/inventory/raw-materials/${rawMaterialId}/recipes`),
}

// ===========================================
// RECIPES API
// ===========================================

export interface Recipe {
  id: string
  productId: string
  portionYield: number
  totalCost: number
  prepTime?: number
  cookTime?: number
  notes?: string
  lines: RecipeLine[]
  createdAt: string
  updatedAt: string
}

export interface RecipeLine {
  id: string
  recipeId: string
  rawMaterialId: string
  rawMaterial: RawMaterial
  quantity: number
  unit: string
  costPerServing: number
  displayOrder: number
  isOptional: boolean
  substituteNotes?: string
  // Variable ingredient fields for modifier substitution
  isVariable?: boolean
  linkedModifierGroupId?: string | null
  linkedModifierGroup?: {
    id: string
    name: string
  } | null
}

export interface CreateRecipeDto {
  portionYield: number
  prepTime?: number
  cookTime?: number
  notes?: string
  lines: Array<{
    rawMaterialId: string
    quantity: number
    unit: string
    isOptional?: boolean
    substituteNotes?: string
    isVariable?: boolean
    linkedModifierGroupId?: string | null
  }>
}

export interface UpdateRecipeDto {
  portionYield?: number
  prepTime?: number
  cookTime?: number
  notes?: string
  lines?: Array<{
    rawMaterialId: string
    quantity: number
    unit: string
    isOptional?: boolean
    substituteNotes?: string
    isVariable?: boolean
    linkedModifierGroupId?: string | null
  }>
}

export const recipesApi = {
  get: (venueId: string, productId: string) => api.get(`/api/v1/dashboard/venues/${venueId}/inventory/products/${productId}/recipe`),

  create: (venueId: string, productId: string, data: CreateRecipeDto) => api.post(`/api/v1/dashboard/venues/${venueId}/inventory/products/${productId}/recipe`, data),

  update: (venueId: string, productId: string, data: UpdateRecipeDto) => api.put(`/api/v1/dashboard/venues/${venueId}/inventory/products/${productId}/recipe`, data),

  delete: (venueId: string, productId: string) => api.delete(`/api/v1/dashboard/venues/${venueId}/inventory/products/${productId}/recipe`),

  addLine: (venueId: string, productId: string, data: { rawMaterialId: string; quantity: number; unit: string; isOptional?: boolean; substituteNotes?: string; isVariable?: boolean; linkedModifierGroupId?: string | null }) =>
    api.post(`/api/v1/dashboard/venues/${venueId}/inventory/products/${productId}/recipe/lines`, data),

  removeLine: (venueId: string, productId: string, recipeLineId: string) =>
    api.delete(`/api/v1/dashboard/venues/${venueId}/inventory/products/${productId}/recipe/lines/${recipeLineId}`),
}

// ===========================================
// PRICING API
// ===========================================

export interface PricingPolicy {
  id: string
  venueId: string
  productId: string
  pricingStrategy: 'MANUAL' | 'AUTO_MARKUP' | 'AUTO_TARGET_MARGIN'
  targetFoodCostPercentage?: number
  targetMarkupPercentage?: number
  calculatedCost: number
  suggestedPrice?: number
  minimumPrice?: number
  currentPrice: number
  foodCostPercentage: number
  lastReviewedAt?: string
  lastUpdatedBy?: string
  createdAt: string
  updatedAt: string
}

export interface CreatePricingPolicyDto {
  pricingStrategy: 'MANUAL' | 'AUTO_MARKUP' | 'AUTO_TARGET_MARGIN'
  targetFoodCostPercentage?: number
  targetMarkupPercentage?: number
  minimumPrice?: number
}

export interface UpdatePricingPolicyDto {
  pricingStrategy?: 'MANUAL' | 'AUTO_MARKUP' | 'AUTO_TARGET_MARGIN'
  targetFoodCostPercentage?: number
  targetMarkupPercentage?: number
  minimumPrice?: number
  currentPrice?: number
}

export const pricingApi = {
  getPolicy: (venueId: string, productId: string) => api.get(`/api/v1/dashboard/venues/${venueId}/inventory/products/${productId}/pricing-policy`),

  createPolicy: (venueId: string, productId: string, data: CreatePricingPolicyDto) =>
    api.post(`/api/v1/dashboard/venues/${venueId}/inventory/products/${productId}/pricing-policy`, data),

  updatePolicy: (venueId: string, productId: string, data: UpdatePricingPolicyDto) =>
    api.put(`/api/v1/dashboard/venues/${venueId}/inventory/products/${productId}/pricing-policy`, data),

  calculatePrice: (venueId: string, productId: string) => api.get(`/api/v1/dashboard/venues/${venueId}/inventory/products/${productId}/calculate-price`),

  applySuggestedPrice: (venueId: string, productId: string) => api.post(`/api/v1/dashboard/venues/${venueId}/inventory/products/${productId}/apply-suggested-price`),

  getAnalysis: (venueId: string, categoryId?: string) => api.get(`/api/v1/dashboard/venues/${venueId}/inventory/pricing-analysis`, { params: { categoryId } }),
}

// ===========================================
// SUPPLIERS API
// ===========================================

export interface Supplier {
  id: string
  venueId: string
  name: string
  contactName?: string
  email?: string
  phone?: string
  website?: string
  address?: string
  city?: string
  state?: string
  country: string
  zipCode?: string
  taxId?: string
  rating?: number
  reliabilityScore?: number
  leadTimeDays: number
  minimumOrder?: number
  active: boolean
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface CreateSupplierDto {
  name: string
  contactName?: string
  email?: string
  phone?: string
  website?: string
  address?: string
  city?: string
  state?: string
  country?: string
  zipCode?: string
  taxId?: string
  leadTimeDays?: number
  minimumOrder?: number
  notes?: string
}

export interface UpdateSupplierDto {
  name?: string
  contactName?: string
  email?: string
  phone?: string
  website?: string
  address?: string
  city?: string
  state?: string
  country?: string
  zipCode?: string
  taxId?: string
  rating?: number
  reliabilityScore?: number
  leadTimeDays?: number
  minimumOrder?: number
  active?: boolean
  notes?: string
}

export const suppliersApi = {
  getAll: (venueId: string, filters?: { active?: boolean; search?: string; rating?: number }) =>
    api.get(`/api/v1/dashboard/venues/${venueId}/inventory/suppliers`, { params: filters }),

  getById: (venueId: string, supplierId: string) => api.get(`/api/v1/dashboard/venues/${venueId}/inventory/suppliers/${supplierId}`),

  create: (venueId: string, data: CreateSupplierDto) => api.post(`/api/v1/dashboard/venues/${venueId}/inventory/suppliers`, data),

  update: (venueId: string, supplierId: string, data: UpdateSupplierDto) => api.put(`/api/v1/dashboard/venues/${venueId}/inventory/suppliers/${supplierId}`, data),

  delete: (venueId: string, supplierId: string) => api.delete(`/api/v1/dashboard/venues/${venueId}/inventory/suppliers/${supplierId}`),

  createPricing: (
    venueId: string,
    supplierId: string,
    data: {
      rawMaterialId: string
      pricePerUnit: number
      unit: string
      minimumQuantity: number
      bulkDiscount?: number
      effectiveFrom: string
      effectiveTo?: string
    },
  ) => api.post(`/api/v1/dashboard/venues/${venueId}/inventory/suppliers/${supplierId}/pricing`, data),

  getPricingHistory: (venueId: string, rawMaterialId: string) => api.get(`/api/v1/dashboard/venues/${venueId}/inventory/raw-materials/${rawMaterialId}/supplier-pricing`),

  getRecommendations: (venueId: string, rawMaterialId: string, quantity?: number) =>
    api.get(`/api/v1/dashboard/venues/${venueId}/inventory/raw-materials/${rawMaterialId}/supplier-recommendations`, { params: { quantity } }),

  getPerformance: (venueId: string, supplierId: string, filters?: { startDate?: string; endDate?: string }) =>
    api.get(`/api/v1/dashboard/venues/${venueId}/inventory/suppliers/${supplierId}/performance`, { params: filters }),
}

// ===========================================
// PURCHASE ORDERS API
// ===========================================

export interface PurchaseOrder {
  id: string
  venueId: string
  supplierId: string
  orderNumber: string
  orderDate: string
  expectedDeliveryDate?: string
  receivedDate?: string
  status: 'DRAFT' | 'SENT' | 'CONFIRMED' | 'SHIPPED' | 'RECEIVED' | 'PARTIAL' | 'CANCELLED'
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  notes?: string
  createdBy?: string
  receivedBy?: string
  createdAt: string
  updatedAt: string
}

export interface CreatePurchaseOrderDto {
  supplierId: string
  orderDate: string
  expectedDeliveryDate?: string
  taxRate?: number
  notes?: string
  items: Array<{
    rawMaterialId: string
    quantityOrdered: number
    unit: string
    unitPrice: number
  }>
}

export interface UpdatePurchaseOrderDto {
  status?: 'DRAFT' | 'SENT' | 'CONFIRMED' | 'SHIPPED' | 'RECEIVED' | 'PARTIAL' | 'CANCELLED'
  expectedDeliveryDate?: string
  notes?: string
  items?: Array<{
    rawMaterialId: string
    quantityOrdered: number
    unit: string
    unitPrice: number
  }>
}

export interface ReceivePurchaseOrderDto {
  receivedDate: string
  items: Array<{
    purchaseOrderItemId: string
    quantityReceived: number
  }>
}

export const purchaseOrdersApi = {
  getAll: (venueId: string, filters?: { status?: string; supplierId?: string; startDate?: string; endDate?: string }) =>
    api.get(`/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders`, { params: filters }),

  getById: (venueId: string, purchaseOrderId: string) => api.get(`/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders/${purchaseOrderId}`),

  create: (venueId: string, data: CreatePurchaseOrderDto) => api.post(`/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders`, data),

  update: (venueId: string, purchaseOrderId: string, data: UpdatePurchaseOrderDto) =>
    api.put(`/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders/${purchaseOrderId}`, data),

  approve: (venueId: string, purchaseOrderId: string) => api.post(`/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders/${purchaseOrderId}/approve`),

  receive: (venueId: string, purchaseOrderId: string, data: ReceivePurchaseOrderDto) =>
    api.post(`/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders/${purchaseOrderId}/receive`, data),

  cancel: (venueId: string, purchaseOrderId: string, reason?: string) =>
    api.post(`/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders/${purchaseOrderId}/cancel`, { reason }),

  getStats: (venueId: string, filters?: { startDate?: string; endDate?: string }) =>
    api.get(`/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders/stats`, { params: filters }),
}

// ===========================================
// ALERTS API
// ===========================================

export interface Alert {
  id: string
  venueId: string
  rawMaterialId: string
  alertType: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRING_SOON' | 'OVER_STOCK'
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED'
  threshold: number
  currentLevel: number
  acknowledgedBy?: string
  acknowledgedAt?: string
  resolvedBy?: string
  resolvedAt?: string
  createdAt: string
  updatedAt: string
}

export const alertsApi = {
  getAll: (venueId: string, filters?: { status?: string; alertType?: string; rawMaterialId?: string }) =>
    api.get(`/api/v1/dashboard/venues/${venueId}/inventory/alerts`, { params: filters }),

  getCount: (venueId: string) => api.get(`/api/v1/dashboard/venues/${venueId}/inventory/alerts/count`),

  getByCategory: (venueId: string) => api.get(`/api/v1/dashboard/venues/${venueId}/inventory/alerts/by-category`),

  acknowledge: (venueId: string, alertId: string) => api.post(`/api/v1/dashboard/venues/${venueId}/inventory/alerts/${alertId}/acknowledge`),

  resolve: (venueId: string, alertId: string) => api.post(`/api/v1/dashboard/venues/${venueId}/inventory/alerts/${alertId}/resolve`),

  dismiss: (venueId: string, alertId: string, reason?: string) => api.post(`/api/v1/dashboard/venues/${venueId}/inventory/alerts/${alertId}/dismiss`, { reason }),

  getHistory: (venueId: string, rawMaterialId: string) => api.get(`/api/v1/dashboard/venues/${venueId}/inventory/raw-materials/${rawMaterialId}/alerts`),

  getStats: (venueId: string, filters?: { startDate?: string; endDate?: string }) => api.get(`/api/v1/dashboard/venues/${venueId}/inventory/alerts/stats`, { params: filters }),

  createManual: (venueId: string, data: { rawMaterialId: string; alertType: string; notes?: string }) => api.post(`/api/v1/dashboard/venues/${venueId}/inventory/alerts`, data),
}

// ===========================================
// REPORTS API
// ===========================================

export const reportsApi = {
  getPMIX: (venueId: string, startDate: string, endDate: string) =>
    api.get(`/api/v1/dashboard/venues/${venueId}/inventory/reports/pmix`, { params: { startDate, endDate } }),

  getProfitability: (venueId: string, categoryId?: string) => api.get(`/api/v1/dashboard/venues/${venueId}/inventory/reports/profitability`, { params: { categoryId } }),

  getIngredientUsage: (venueId: string, startDate: string, endDate: string, rawMaterialId?: string) =>
    api.get(`/api/v1/dashboard/venues/${venueId}/inventory/reports/ingredient-usage`, { params: { startDate, endDate, rawMaterialId } }),

  getCostVariance: (venueId: string, startDate: string, endDate: string) =>
    api.get(`/api/v1/dashboard/venues/${venueId}/inventory/reports/cost-variance`, { params: { startDate, endDate } }),

  getValuation: (venueId: string) => api.get(`/api/v1/dashboard/venues/${venueId}/inventory/reports/valuation`),
}

// ===========================================
// PRODUCT WIZARD API (NEW - for flexible inventory)
// ===========================================

export type InventoryMethod = 'QUANTITY' | 'RECIPE'

export interface ProductWizardStep1Data {
  name: string
  description?: string
  price: number
  categoryId: string
  imageUrl?: string
}

export interface ProductWizardStep2Data {
  useInventory: boolean
  inventoryMethod?: InventoryMethod
}

export interface ProductWizardStep3SimpleStockData {
  initialStock: number
  reorderPoint: number
  costPerUnit: number
}

export interface ProductWizardStep3RecipeData {
  portionYield: number
  prepTime?: number
  cookTime?: number
  notes?: string
  ingredients: Array<{
    rawMaterialId: string
    quantity: number
    unit: string
    isOptional?: boolean
    substituteNotes?: string
  }>
}

export interface CreateProductWithInventoryDto {
  product: ProductWizardStep1Data
  inventory: ProductWizardStep2Data
  simpleStock?: ProductWizardStep3SimpleStockData
  recipe?: ProductWizardStep3RecipeData
}

export const productWizardApi = {
  // Check if venue should use inventory (returns recommendations)
  shouldUseInventory: (venueId: string) => api.get(`/api/v1/dashboard/venues/${venueId}/inventory/should-use-inventory`),

  // Step 1: Create basic product
  createProductStep1: (venueId: string, data: ProductWizardStep1Data) => api.post(`/api/v1/dashboard/venues/${venueId}/inventory/wizard/step1`, data),

  // Step 2: Configure inventory type
  configureInventoryStep2: (venueId: string, productId: string, data: ProductWizardStep2Data) => api.post(`/api/v1/dashboard/venues/${venueId}/inventory/products/${productId}/wizard/step2`, data),

  // Step 3A: Setup simple stock (for retail/jewelry)
  setupSimpleStockStep3: (venueId: string, productId: string, data: ProductWizardStep3SimpleStockData) =>
    api.post(`/api/v1/dashboard/venues/${venueId}/inventory/products/${productId}/wizard/step3-simple`, data),

  // Step 3B: Setup recipe (for restaurants)
  setupRecipeStep3: (venueId: string, productId: string, data: ProductWizardStep3RecipeData) =>
    api.post(`/api/v1/dashboard/venues/${venueId}/inventory/products/${productId}/wizard/step3-recipe`, data),

  // Get wizard progress for a product
  getWizardProgress: (venueId: string, productId: string) => api.get(`/api/v1/dashboard/venues/${venueId}/inventory/products/${productId}/wizard/progress`),

  // All-in-one: Create product with inventory in single call
  createProductWithInventory: (venueId: string, data: CreateProductWithInventoryDto) => api.post(`/api/v1/dashboard/venues/${venueId}/inventory/wizard/complete`, data),

  // Convenience methods for edit mode (configure inventory on existing product)
  configureSimpleStock: (venueId: string, productId: string, data: ProductWizardStep3SimpleStockData) =>
    api.post(`/api/v1/dashboard/venues/${venueId}/inventory/products/${productId}/wizard/step3-simple`, data),

  configureRecipe: (venueId: string, productId: string, data: ProductWizardStep3RecipeData) =>
    api.post(`/api/v1/dashboard/venues/${venueId}/inventory/products/${productId}/wizard/step3-recipe`, data),
}

// ===========================================
// PRODUCT INVENTORY STATUS API
// ===========================================

export interface ProductInventoryStatus {
  inventoryMethod: InventoryMethod | null
  available: boolean
  currentStock?: number
  reorderPoint?: number
  lowStock?: boolean
  maxPortions?: number
  insufficientIngredients?: Array<{
    rawMaterialId: string
    name: string
    required: number
    available: number
    unit: string
  }>
  limitingIngredient?: {
    rawMaterialId: string
    name: string
    required: number
    available: number
    unit: string
    maxPortions: number
  } | null
  recipeCost?: number
  message: string
}

export interface AdjustInventoryStockDto {
  type: 'PURCHASE' | 'USAGE' | 'ADJUSTMENT' | 'SPOILAGE' | 'TRANSFER' | 'RETURN' | 'COUNT'
  quantity: number // Positive for additions, negative for reductions
  reason?: string
  reference?: string
  unitCost?: number // Cost per unit for this movement (for PURCHASE)
  supplier?: string // Supplier name for this movement (for PURCHASE)
}

export interface InventoryMovement {
  id: string
  type: string
  quantity: number
  previousStock: number
  newStock: number
  reason: string | null
  reference: string | null
  unitCost: number | null
  supplier: string | null
  createdBy: string | null
  createdAt: string
}

export const productInventoryApi = {
  // Get inventory status for a product
  getStatus: (venueId: string, productId: string) => api.get<ProductInventoryStatus>(`/api/v1/dashboard/venues/${venueId}/inventory/products/${productId}/inventory-status`),

  // Get inventory method
  getMethod: (venueId: string, productId: string) => api.get<{ inventoryMethod: InventoryMethod | null }>(`/api/v1/dashboard/venues/${venueId}/inventory/products/${productId}/inventory-method`),

  // Set inventory method
  setMethod: (venueId: string, productId: string, inventoryMethod: InventoryMethod) => api.put(`/api/v1/dashboard/venues/${venueId}/inventory/products/${productId}/inventory-method`, { inventoryMethod }),

  // Switch inventory method (auto-conversion between QUANTITY ↔ RECIPE)
  // Automatically removes old configuration and switches to new method
  switchInventoryMethod: (venueId: string, productId: string, newMethod: InventoryMethod) =>
    api.post(`/api/v1/dashboard/venues/${venueId}/inventory/products/${productId}/switch-inventory-method`, { inventoryMethod: newMethod }),

  // Adjust stock for QUANTITY product
  adjustStock: (venueId: string, productId: string, data: AdjustInventoryStockDto) =>
    api.post(`/api/v1/dashboard/venues/${venueId}/inventory/products/${productId}/adjust-stock`, data),

  // Get movements for QUANTITY product
  getMovements: (venueId: string, productId: string) =>
    api.get<InventoryMovement[]>(`/api/v1/dashboard/venues/${venueId}/inventory/products/${productId}/movements`),
}

// ===========================================
// INVENTORY HISTORY API (Global Movements)
// ===========================================

export interface GlobalInventoryMovement extends InventoryMovement {
  itemName: string
  sku: string
  category: 'PRODUCT' | 'INGREDIENT'
  unit: string
  cost: number
  totalCost: number
  supplierName?: string
}

export const inventoryHistoryApi = {
  getGlobalMovements: (
    venueId: string,
    filters?: {
      startDate?: string
      endDate?: string
      type?: string
      search?: string
      limit?: number
      offset?: number
    },
  ) => api.get<{ data: GlobalInventoryMovement[]; meta: { total: number; page: number; limit: number } }>(`/api/v1/dashboard/venues/${venueId}/inventory/movements`, { params: filters }),
}

// ===========================================
// COST RECALCULATION API
// ===========================================

export interface CostChangePreview {
  rawMaterial: {
    id: string
    name: string
    currentCost: number
    proposedNewCost: number
    costChange: number
    percentageChange: number
  }
  affectedRecipes: Array<{
    productId: string
    productName: string
    currentRecipeCost: number
    estimatedNewRecipeCost: number
    costImpact: number
    currentPrice: number
    currentFoodCostPercentage: number
    estimatedNewFoodCostPercentage: number
    recommendation: 'INCREASE_PRICE' | 'REVIEW_PRICE' | 'OK'
  }>
  summary: {
    totalRecipes: number
    needPriceIncrease: number
    needPriceReview: number
    ok: number
  }
}

export const costRecalculationApi = {
  // Preview cost change impact before applying
  previewCostChange: (rawMaterialId: string, proposedNewCost: number) =>
    api.get<CostChangePreview>(`/api/v1/dashboard/raw-materials/${rawMaterialId}/preview-cost-change`, { params: { proposedNewCost } }),

  // Trigger cost recalculation for affected recipes (called automatically when costPerUnit changes)
  triggerRecalculation: (rawMaterialId: string, oldCost: number, newCost: number) =>
    api.post(`/api/v1/dashboard/raw-materials/${rawMaterialId}/trigger-cost-recalculation`, { oldCost, newCost }),

  // Get recipes with stale costs (ingredients updated more recently than recipe)
  getStaleRecipes: (venueId: string) => api.get(`/api/v1/dashboard/venues/${venueId}/inventory/stale-recipes`),

  // Recalculate all stale recipes
  recalculateStaleRecipes: (venueId: string) => api.post(`/api/v1/dashboard/venues/${venueId}/inventory/recalculate-stale-recipes`),

  // Force recalculation of all recipes (maintenance)
  recalculateAllRecipes: (venueId: string) => api.post(`/api/v1/dashboard/venues/${venueId}/inventory/recalculate-all-recipes`),

  // Get recipes with poor margins (high food cost %)
  getRecipeCostVariances: (venueId: string, minVariancePercentage?: number, sort?: 'highest' | 'lowest' | 'alphabetical') =>
    api.get(`/api/v1/dashboard/venues/${venueId}/inventory/recipe-cost-variances`, { params: { minVariancePercentage, sort } }),
}

// ===========================================
// MODIFIER INVENTORY ANALYTICS API
// ===========================================

export interface ModifierUsageStats {
  modifierId: string
  modifierName: string
  groupId: string
  groupName: string
  timesUsed: number
  totalQuantityUsed: number
  totalCostImpact: number
  rawMaterial?: {
    id: string
    name: string
    unit: string
    currentStock: number
    costPerUnit: number
  }
  inventoryMode: 'ADDITION' | 'SUBSTITUTION' | null
  quantityPerUnit: number | null
}

export interface ModifierLowStockItem {
  modifierId: string
  modifierName: string
  groupId: string
  groupName: string
  rawMaterialId: string
  rawMaterialName: string
  unit: string
  currentStock: number
  reorderPoint: number
  quantityPerUnit: number
  estimatedUsesRemaining: number
  inventoryMode: 'ADDITION' | 'SUBSTITUTION'
}

export interface ModifierInventorySummary {
  totalModifiersWithInventory: number
  totalModifiersLowStock: number
  totalCostImpactPeriod: number
  topCostModifiers: ModifierUsageStats[]
  lowStockModifiers: ModifierLowStockItem[]
}

export interface ModifierWithInventory {
  id: string
  name: string
  groupId: string
  groupName: string
  rawMaterialId: string | null
  rawMaterialName: string | null
  quantityPerUnit: number | null
  unit: string | null
  inventoryMode: 'ADDITION' | 'SUBSTITUTION'
  cost: number | null
  currentStock: number | null
  active: boolean
}

export const modifierInventoryApi = {
  // Get modifier usage statistics
  getUsageStats: (
    venueId: string,
    filters?: {
      startDate?: string
      endDate?: string
      modifierGroupId?: string
      limit?: number
    },
  ) => api.get<{ success: boolean; data: ModifierUsageStats[] }>(`/api/v1/dashboard/venues/${venueId}/modifiers/inventory/usage`, { params: filters }),

  // Get modifiers with low stock raw materials
  getLowStock: (venueId: string) =>
    api.get<{ success: boolean; data: ModifierLowStockItem[]; count: number }>(`/api/v1/dashboard/venues/${venueId}/modifiers/inventory/low-stock`),

  // Get comprehensive modifier inventory summary
  getSummary: (
    venueId: string,
    filters?: {
      startDate?: string
      endDate?: string
    },
  ) => api.get<{ success: boolean; data: ModifierInventorySummary }>(`/api/v1/dashboard/venues/${venueId}/modifiers/inventory/summary`, { params: filters }),

  // Get all modifiers with their inventory configuration
  getModifiersWithInventory: (
    venueId: string,
    filters?: {
      includeInactive?: boolean
      groupId?: string
    },
  ) =>
    api.get<{ success: boolean; data: ModifierWithInventory[]; count: number }>(`/api/v1/dashboard/venues/${venueId}/modifiers/inventory/list`, {
      params: filters,
    }),
}
