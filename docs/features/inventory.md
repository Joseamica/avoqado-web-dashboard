# Inventory Management System

Complete guide to the FIFO-based inventory tracking system for raw materials, recipes, and stock management.

## Overview

The inventory management system tracks:
- **Raw materials** (ingredients)
- **Recipes** (product composition)
- **Stock batches** (FIFO tracking)
- **Stock movements** (audit trail)
- **Pricing & profitability** analysis

This is a **core business feature** that automatically deducts stock when orders are fully paid.

## Architecture

```
Raw Materials (Ingredients)
  ├─ Stock Batches (FIFO tracking)
  │   ├─ Batch 1 (oldest - used first)
  │   ├─ Batch 2
  │   └─ Batch 3 (newest - used last)
  ├─ Stock Movements (audit trail)
  └─ Low Stock Alerts

Recipes (Product composition)
  ├─ Recipe Lines (ingredients + quantities)
  └─ Total Cost calculation

Products
  ├─ Has Recipe? → Recipe-based inventory
  ├─ Simple Stock? → Count-based inventory
  └─ No Inventory? → Services/digital products
```

## Key Components

### Pages

**Location**: `src/pages/Inventory/`

- **`RawMaterials.tsx`** - Manage raw materials/ingredients
- **`Recipes.tsx`** - Manage product recipes
- **`Pricing.tsx`** - Pricing analysis & profitability

**Product Creation:**
- **`src/pages/Menu/Products/createProduct.tsx`** - Product wizard with inventory

### Dialogs

**Location**: `src/pages/Inventory/components/`

- **`RawMaterialDialog.tsx`** - Add/edit raw materials
- **`RecipeDialog.tsx`** - Add/edit recipes
- **`AdjustStockDialog.tsx`** - Manual stock adjustments
- **`StockMovementsDialog.tsx`** - View movement history
- **`ProductWizardDialog.tsx`** - Guided product creation

### Services

- **`src/services/inventory.service.ts`** - API client for inventory operations

### Constants

- **`src/lib/inventory-constants.ts`** - Units, categories, enums

## Data Flow: Order → Inventory Deduction

**CRITICAL**: The dashboard displays inventory data but does NOT trigger deductions directly. Stock deduction happens automatically on the **backend** when an order is fully paid.

```
1. Dashboard: Create Product with Recipe
   └─ Define ingredients and quantities
   └─ System calculates recipe cost

2. Dashboard or TPV: Create Order
   └─ Order status: PENDING
   └─ Stock NOT deducted yet

3. TPV: Process Payment
   └─ Order status: PAID
   └─ Backend: Automatically deducts stock (FIFO)
   └─ Stock movements created for audit

4. Dashboard: View Results
   ├─ Updated stock levels (RawMaterials page)
   ├─ Stock movements (AdjustStockDialog)
   ├─ Low stock alerts (if any)
   └─ Batch depletion (oldest batches used first)
```

## Raw Materials

### Data Model

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Auto | Unique identifier |
| `name` | string | ✅ | Ingredient name (e.g., "Hamburger Buns") |
| `sku` | string | ✅ | Stock keeping unit (unique) |
| `category` | enum | ✅ | MEAT, DAIRY, VEGETABLES, PRODUCE, CONDIMENTS, etc. |
| `unit` | enum | ✅ | KILOGRAM, GRAM, LITER, MILLILITER, UNIT, etc. |
| `currentStock` | Decimal | ✅ | Current quantity (auto-calculated from batches) |
| `minimumStock` | Decimal | ✅ | Safety stock level (alert threshold) |
| `reorderPoint` | Decimal | ✅ | When to reorder (delivery time + buffer) |
| `costPerUnit` | Decimal | ✅ | Purchase cost per unit (for recipe costing) |
| `perishable` | boolean | ⬜ | Has expiration? Enables batch tracking |
| `shelfLifeDays` | integer | ⬜ | Days until expiry (auto-calculates batch expiration) |
| `supplier` | string | ⬜ | Supplier name/contact |
| `notes` | text | ⬜ | Additional notes |

### Critical: Expiration Date

**❌ WRONG**:
```typescript
// expirationDate is NOT a field on RawMaterial!
rawMaterial.expirationDate = '2025-11-15'
```

**✅ CORRECT**:
```typescript
// Each StockBatch has its own expiration
batch.expirationDate = batch.receivedDate + rawMaterial.shelfLifeDays

// Example:
rawMaterial.shelfLifeDays = 5  // Buns last 5 days
batch.receivedDate = '2025-10-29'
batch.expirationDate = '2025-11-03'  // Auto-calculated
```

### UI Operations

**Add New Raw Material:**
1. Navigate to Inventory → Raw Materials
2. Click "Add Raw Material" button
3. Fill form:
   - Name: "Hamburger Buns"
   - SKU: "BUNS-001"
   - Category: BAKERY
   - Unit: UNIT
   - Cost per unit: $0.50
   - Current stock: 100
   - Minimum stock: 20
   - Reorder point: 30
   - Perishable: ✓
   - Shelf life: 5 days
4. Save → Backend creates initial stock batch with current stock

**Edit Raw Material:**
1. Find item in table
2. Click "..." menu → "Edit"
3. Update fields
4. Save → Updates raw material (NOT stock batches)

**Adjust Stock:**
1. Find item in table
2. Click "..." menu → "Adjust Stock"
3. Enter quantity:
   - Positive number: Adds stock (PURCHASE, COUNT)
   - Negative number: Removes stock (SPOILAGE, ADJUSTMENT)
4. Select reason:
   - PURCHASE: Received from supplier
   - SPOILAGE: Waste/expiry
   - COUNT: Inventory count correction
   - ADJUSTMENT: Manual correction
5. Save → Creates movement + updates/creates batches

**View Stock Movements:**
1. Find item in table
2. Click "..." menu → "View Movements"
3. See complete audit trail:
   - Date/time
   - Type: PURCHASE, USAGE, ADJUSTMENT, SPOILAGE, COUNT
   - Quantity (+ or -)
   - Batch reference (if applicable)
   - User who made change
   - Notes

## Recipes

### Data Model

```typescript
interface Recipe {
  id: string
  productId: string           // One recipe per product
  portionYield: number        // How many servings this recipe makes
  totalCost: Decimal          // Calculated from ingredients
  lines: RecipeLine[]         // Individual ingredients
  createdAt: DateTime
  updatedAt: DateTime
}

interface RecipeLine {
  id: string
  recipeId: string
  rawMaterialId: string
  quantity: Decimal           // Amount needed
  unit: Unit                  // Must match rawMaterial.unit or be convertible
  isOptional: boolean         // Skip if unavailable?
  rawMaterial?: RawMaterial   // Populated in queries
}
```

### Example: Hamburger Recipe

```typescript
{
  productId: "prod_123",
  portionYield: 1,            // Makes 1 burger
  totalCost: 3.60,            // $3.60 total
  lines: [
    {
      rawMaterialId: "buns_001",
      quantity: 1,
      unit: UNIT,
      isOptional: false,
      // Cost: 1 × $0.50 = $0.50
    },
    {
      rawMaterialId: "beef_001",
      quantity: 1,
      unit: UNIT,
      isOptional: false,
      // Cost: 1 × $2.00 = $2.00
    },
    {
      rawMaterialId: "cheese_001",
      quantity: 2,
      unit: UNIT,
      isOptional: false,
      // Cost: 2 × $0.30 = $0.60
    },
    {
      rawMaterialId: "lettuce_001",
      quantity: 50,
      unit: GRAM,
      isOptional: true,  // Can make burger without lettuce
      // Cost: 50 × $0.01 = $0.50
    },
  ]
}
```

### Inventory Deduction (Backend)

When order is paid, backend automatically runs:

```typescript
// Pseudo-code
for (const line of recipe.lines) {
  const needed = line.quantity * orderItem.quantity

  if (line.isOptional && !hasStock(line.rawMaterialId, needed)) {
    continue  // Skip optional ingredient if unavailable
  }

  deductStockFIFO(line.rawMaterialId, needed)
}
```

**Example:**
- Order: 3 hamburgers
- Recipe: 1 bun per burger
- Deduction: 3 buns (3 × 1)

### UI Operations

**Create Recipe:**
1. Navigate to Menu → Products
2. Find product → Click "Edit"
3. Go to "Recipe" tab
4. Click "Add Ingredient"
5. Select raw material from dropdown
6. Enter quantity
7. Toggle "Optional" if applicable
8. Repeat for all ingredients
9. System calculates total cost automatically
10. Save → Recipe is now active

**Edit Recipe:**
1. Open product editor → "Recipe" tab
2. Modify ingredients, quantities, or optional flags
3. Total cost updates automatically
4. Save → Changes apply to future orders

**Delete Recipe:**
1. Open product editor → "Recipe" tab
2. Click "Delete Recipe"
3. Confirm → Product no longer deducts inventory

## FIFO Batch Tracking

### Why FIFO?

- **Prevents waste**: Uses oldest inventory first
- **Accurate costing**: Track cost per batch
- **Expiration management**: Ensures proper rotation
- **Accounting compliance**: FIFO is standard for food service

### How It Works

**Scenario: Receiving 3 shipments of buns**

```typescript
Batch 1:
  quantity: 50 units
  costPerUnit: $0.50
  receivedDate: Oct 4
  expirationDate: Oct 9
  status: ACTIVE

Batch 2:
  quantity: 100 units
  costPerUnit: $0.50
  receivedDate: Oct 9
  expirationDate: Oct 14
  status: ACTIVE

Batch 3:
  quantity: 150 units
  costPerUnit: $0.50
  receivedDate: Oct 14
  expirationDate: Oct 19
  status: ACTIVE

Total stock: 300 units (50 + 100 + 150)
```

**Order requires 60 buns:**

```
Step 1: Check oldest batch (Batch 1)
  └─ Has 50 units → Use all 50
  └─ Batch 1: 50 - 50 = 0 → DEPLETED
  └─ Still need: 60 - 50 = 10 units

Step 2: Check next oldest (Batch 2)
  └─ Has 100 units → Use 10
  └─ Batch 2: 100 - 10 = 90 remaining → ACTIVE
  └─ Order fulfilled!

Batch 3 untouched (newest)

Result: Oldest stock used first!
```

### Batch Visualization

**In Dashboard:**

1. **RawMaterials page**: Shows `currentStock` (sum of all ACTIVE batches)
2. **StockMovementsDialog**: Shows which batches were used in each deduction
3. **Low stock alerts**: Appear when `currentStock ≤ reorderPoint`

**Example stock movements:**

```
Date         | Type    | Quantity | Batch   | Remaining
-------------|---------|----------|---------|----------
Oct 4 10:00  | PURCHASE| +50      | Batch 1 | 50
Oct 9 14:00  | PURCHASE| +100     | Batch 2 | 150
Oct 12 18:00 | USAGE   | -50      | Batch 1 | 100 (Batch 1 depleted)
Oct 12 18:00 | USAGE   | -10      | Batch 2 | 90
Oct 14 09:00 | PURCHASE| +150     | Batch 3 | 240
```

## Pricing & Profitability

### Cost Calculation

**Recipe Cost:**
```typescript
const recipeCost = recipe.lines.reduce((sum, line) => {
  return sum + (line.quantity * line.rawMaterial.costPerUnit)
}, 0)

// Example (Hamburger):
// Bun: 1 × $0.50 = $0.50
// Beef: 1 × $2.00 = $2.00
// Cheese: 2 × $0.30 = $0.60
// Lettuce: 50 × $0.01 = $0.50
// Total: $3.60
```

**Product Profit & Margin:**
```typescript
const profit = product.price - recipeCost
const margin = (profit / product.price) * 100

// Example:
// Price: $12.99
// Cost: $3.60
// Profit: $12.99 - $3.60 = $9.39
// Margin: ($9.39 / $12.99) × 100 = 72.3%
```

### Pricing Analysis Page

**Location**: `src/pages/Inventory/Pricing.tsx`

**Features:**
- Shows cost vs price for all products with recipes
- Calculates profit and margin for each
- Highlights unprofitable items (cost > price) in red
- Suggests minimum price for target margin
- Filters by category, margin range
- Export to CSV for analysis

**Example Output:**

| Product | Cost | Price | Profit | Margin | Status |
|---------|------|-------|--------|--------|--------|
| Hamburger | $3.60 | $12.99 | $9.39 | 72% | ✅ Good |
| Pizza | $5.20 | $18.99 | $13.79 | 73% | ✅ Good |
| Salad | $2.80 | $8.99 | $6.19 | 69% | ✅ Good |
| Special Burger | $15.00 | $14.99 | -$0.01 | -0.1% | ❌ Loss! |

## Translation Keys (i18n)

All inventory UI uses the `inventory` namespace:

**Location**: `src/locales/[en|es]/inventory.json`

**Usage:**
```typescript
import { useTranslation } from 'react-i18next'

function RawMaterialsPage() {
  const { t } = useTranslation('inventory')

  return (
    <div>
      <h1>{t('rawMaterials.title')}</h1>
      <Button>{t('rawMaterials.add')}</Button>
    </div>
  )
}
```

**Common Keys:**
```typescript
t('rawMaterials.title')                  // "Raw Materials"
t('rawMaterials.add')                    // "Add Raw Material"
t('rawMaterials.fields.name')            // "Name"
t('rawMaterials.fields.sku')             // "SKU"
t('rawMaterials.fields.shelfLifeDays')   // "Shelf Life (days)"
t('rawMaterials.fieldHelp.unit')         // "Unit of measurement"
t('recipes.title')                       // "Recipes"
t('recipes.ingredients.quantity')        // "Quantity"
t('stockMovements.types.PURCHASE')       // "Purchase"
t('stockMovements.types.USAGE')          // "Usage"
```

## Testing Inventory Flow

### Manual Test

**1. Setup (Create test data):**
```
Raw Material:
  Name: "Test Buns"
  SKU: "TEST-BUNS-001"
  Unit: UNIT
  Cost per unit: $0.50
  Current stock: 100
  Minimum stock: 20
  Reorder point: 30

Product:
  Name: "Test Burger"
  Price: $10.00

Recipe:
  Ingredient: Test Buns
  Quantity: 1 unit per burger
```

**2. Create Order:**
```
Order:
  Product: Test Burger
  Quantity: 5
  Total: $50.00
  Status: PENDING
```

**3. Process Payment:**
```
Pay: $50.00 (full amount)
Status: PENDING → PAID
```

**4. Verify Deduction:**
```
Navigate to: Inventory → Raw Materials
Find: "Test Buns"
Expected Stock: 95 (100 - 5)
View Movements: Should show USAGE entry for -5 units
```

**5. Verify FIFO:**
```
If multiple batches exist:
  ✅ Oldest batch used first
  ✅ Stock movements show batch references
  ✅ Batch status changed to DEPLETED if fully used
```

### API Testing

**From browser console (logged in to dashboard):**

```javascript
// Check raw material stock
fetch('/api/v1/dashboard/venues/{venueId}/raw-materials')
  .then(r => r.json())
  .then(data => {
    console.table(data.data.map(rm => ({
      name: rm.name,
      stock: rm.currentStock,
      minimum: rm.minimumStock,
    })))
  })

// View stock movements for specific raw material
fetch('/api/v1/dashboard/venues/{venueId}/raw-materials/{id}/movements')
  .then(r => r.json())
  .then(data => {
    console.table(data.data.map(m => ({
      date: m.createdAt,
      type: m.type,
      quantity: m.quantity,
      batch: m.batchId,
    })))
  })

// Check product recipe
fetch('/api/v1/dashboard/venues/{venueId}/products/{productId}/recipe')
  .then(r => r.json())
  .then(data => {
    console.log('Recipe cost:', data.totalCost)
    console.table(data.lines.map(line => ({
      ingredient: line.rawMaterial.name,
      quantity: line.quantity,
      unit: line.unit,
      cost: line.quantity * line.rawMaterial.costPerUnit,
    })))
  })
```

## Common Issues

### Stock Not Updating

**Symptoms**: Order paid but stock unchanged

**Checklist:**
- ✅ Payment status is "PAID" (not PENDING or FAILED)
- ✅ Product has a recipe defined
- ✅ Recipe has at least one ingredient
- ✅ Raw materials have sufficient stock (not stockout)
- ✅ Backend logs show no errors
- ✅ Recipe quantities are positive numbers

**Debug:**
```javascript
// Check order status
console.log(order.paymentStatus)  // Should be "PAID"

// Check if product has recipe
fetch(`/api/v1/dashboard/venues/${venueId}/products/${productId}/recipe`)
  .then(r => console.log(r.status))  // Should be 200, not 404
```

### Wrong Cost Calculation

**Symptoms**: Recipe cost doesn't match manual calculation

**Checklist:**
- ✅ Raw material `costPerUnit` is correct (check for typos, decimal places)
- ✅ Recipe quantities match reality (1 kg = 1000 g, not 1 unit)
- ✅ Units are compatible (KILOGRAM with GRAM is OK, LITER with GRAM is NOT)
- ✅ No optional ingredients included in cost when unavailable

**Debug:**
```javascript
// Manually calculate recipe cost
recipe.lines.forEach(line => {
  const cost = line.quantity * line.rawMaterial.costPerUnit
  console.log(`${line.rawMaterial.name}: ${line.quantity} × $${line.rawMaterial.costPerUnit} = $${cost}`)
})
```

### FIFO Not Working

**Symptoms**: Wrong batches being used (newest instead of oldest)

**Checklist:**
- ✅ Multiple batches exist for the raw material
- ✅ Batches have different `receivedDate` values
- ✅ Batches have status "ACTIVE" (not DEPLETED or EXPIRED)
- ✅ `receivedDate` is correctly ordered in database (oldest first)
- ✅ Backend FIFO logic not bypassed

**Debug:**
```javascript
// Check batch ordering
fetch(`/api/v1/dashboard/venues/${venueId}/raw-materials/${id}/batches`)
  .then(r => r.json())
  .then(data => {
    console.table(data.data.map(batch => ({
      receivedDate: batch.receivedDate,
      quantity: batch.currentQuantity,
      status: batch.status,
    })))
  })
```

## Best Practices

1. **Always set `shelfLifeDays` for perishables**
   Enables automatic expiration tracking and alerts

2. **Use consistent units**
   Don't mix grams and kilograms in same recipe (use one or the other)

3. **Set realistic reorder points**
   Account for supplier delivery time + safety buffer

4. **Test recipes before going live**
   Create test orders to verify costs and stock deduction

5. **Review low stock alerts daily**
   Prevents stockouts during peak hours

6. **Use optional ingredients sparingly**
   Only for true substitutions (e.g., lettuce on burger)

7. **Audit stock movements regularly**
   Check for unusual patterns (high spoilage, frequent adjustments)

8. **Keep raw material SKUs unique**
   Use naming convention: `{CATEGORY}-{NAME}-{VARIANT}`

9. **Document supplier information**
   Record contact info and lead times in notes field

10. **Train staff on proper stock entry**
    Ensure they know when to use PURCHASE vs ADJUSTMENT vs COUNT

## Related Documentation

- [Architecture Overview](../architecture/overview.md) - Data models and API patterns
- [i18n Guide](./i18n.md) - Translation system
- [Theme Guide](./theme.md) - UI component styling
