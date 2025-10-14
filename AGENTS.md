# Repository Guidelines

## Project Structure & Module Organization

- App code in `src/`: components (`src/components`), pages (`src/pages`), routes (`src/routes`), services (`src/services`), hooks (`src/hooks`), context (`src/context`), utils (`src/utils`), types (`src/types`), styles/assets (`src/styles`, `src/assets`).
- Entry points: `src/main.tsx`, `src/App.tsx`; global i18n in `src/i18n.ts`.
- Public assets in `public/`; build output in `dist/`.
- Scripts in `scripts/`; example: `scripts/check-i18n.js`.
- Optional tests live under `tests/unit/...` by feature (e.g., `tests/unit/services/dashboard`).

## Build, Test, and Development Commands

- `npm run dev` — Start Vite dev server with HMR.
- `npm run build` — Type-check and build to `dist/`.
- `npm run preview` — Serve the production build locally.
- `npm run lint` — Lint codebase with ESLint.
- `npm run lint:i18n` — Verify missing/unused translation keys.
- `npm run deploy` / `deploy:preview` — Deploy via Cloudflare Pages (wrangler).

## Coding Style & Naming Conventions

- TypeScript + React 18; Vite bundling; Tailwind CSS v4. Use Prettier (`.prettierrc`) and ESLint (`eslint.config.js`).
- Two-space indentation; prefer named exports. Components in PascalCase (`src/components/FeatureCard.tsx`); hooks `useX.ts`.
- Keep UI text out of code: use `react-i18next` (`useTranslation`) and keys in `src/i18n.ts`.
- Follow visual patterns in `THEME-GUIDELINES.md` and tips in `CLAUDE.md`.

## Testing Guidelines

- Place unit tests under `tests/unit` mirroring `src/` (e.g., `FeatureService.test.ts`).
- Prefer Vitest + Testing Library when adding tests; keep tests isolated and fast.
- Name files `*.test.ts`/`*.test.tsx`; aim for critical-path coverage over blanket quotas.

## Commit & Pull Request Guidelines

- Use Conventional Commits: `feat(scope): ...`, `fix(scope): ...`, `refactor: ...`, `chore: ...` (see `git log`).
- PRs include: clear description, linked issues, before/after screenshots for UI, and a note of added/updated i18n keys.
- Ensure `npm run lint`, `npm run build`, and `npm run lint:i18n` pass.

## Agent-Specific Instructions (i18n)

- Internationalization is mandatory for all user-facing text. Wrap strings with `t('group.key')`; add `en`/`es` keys in `src/i18n.ts` (groups: `header`, `sidebar`, `dashboard`, `revenue`, `featureMgmt`, `venueMgmt`, `detailsView`, `categories`, `featureStatuses`).
- Format numbers/dates/currency with `Intl.*` using `i18n.language`; do not render raw enums—map to translation keys.
- Reuse `src/components/language-switcher.tsx`; do not add duplicate toggles.

## 🔒 Permission System (Granular UI Controls)

### Overview

The dashboard uses a **granular, action-based permission system** to control what users can SEE and DO within each page. This works alongside route protection to provide fine-grained access control.

**Permission Format**: `"resource:action"` (e.g., `"tpv:create"`, `"menu:update"`, `"analytics:export"`)

### Key Components

- `src/lib/permissions/defaultPermissions.ts` - Default permissions by role
- `src/hooks/usePermissions.ts` - React hook for permission checks
- `src/components/PermissionGate.tsx` - Component for conditional rendering

### Quick Start

**Hiding UI elements based on permissions:**
```typescript
import { PermissionGate } from '@/components/PermissionGate'

// Hide create button from users without permission
<PermissionGate permission="tpv:create">
  <Button>Create Terminal</Button>
</PermissionGate>

// Hide edit/delete buttons
<PermissionGate permission="tpv:update">
  <Button>Edit</Button>
</PermissionGate>
<PermissionGate permission="tpv:delete">
  <Button>Delete</Button>
</PermissionGate>
```

**Using the hook for conditional logic:**
```typescript
import { usePermissions } from '@/hooks/usePermissions'

const { can } = usePermissions()

// Conditional rendering
{can('tpv:create') && <CreateButton />}

// Disable instead of hide
<Button disabled={!can('tpv:update')}>Edit</Button>
```

### Adding Permissions to New Features

1. **Add permission to defaults** (`src/lib/permissions/defaultPermissions.ts`):
```typescript
[StaffRole.MANAGER]: [
  // ... existing permissions
  'reports:create',
  'reports:export',
]
```

2. **Wrap UI elements with PermissionGate**:
```typescript
<PermissionGate permission="reports:create">
  <Button>Create Report</Button>
</PermissionGate>
```

3. **Add backend protection** (see `avoqado-server/CLAUDE.md`):
```typescript
router.post('/venues/:venueId/reports',
  authenticateTokenMiddleware,
  checkPermission('reports:create'),
  controller.create
)
```

4. **Keep in sync**: Frontend `defaultPermissions.ts` MUST match backend `src/lib/permissions.ts` exactly!

### Common Patterns

**Conditional sections:**
```typescript
<PermissionGate permission="inventory:read">
  <InventorySection />
</PermissionGate>
```

**Multiple permissions (any):**
```typescript
<PermissionGate permissions={['menu:create', 'menu:update']}>
  <EditForm />
</PermissionGate>
```

**Multiple permissions (all):**
```typescript
<PermissionGate permissions={['admin:write', 'admin:delete']} requireAll={true}>
  <DangerousAction />
</PermissionGate>
```

### Permission Naming Convention

- Resource: singular noun (`tpv`, `menu`, `order`, `payment`, `inventory`)
- Action: standard CRUD + custom (`read`, `create`, `update`, `delete`, `command`, `export`, `respond`)
- Wildcards: `*:*` (all), `tpv:*` (all TPV), `*:read` (read all)

### Best Practices

1. **Use PermissionGate for declarative UI** - More readable than conditionals
2. **Hide vs Disable**: Hide for cleaner UI, disable to show locked features
3. **Test with different roles**: Verify WAITER can't see MANAGER buttons
4. **Never skip backend validation**: Frontend is UX, backend is security
5. **Document new permissions**: Update CLAUDE.md when adding permissions

### Full Documentation

See `CLAUDE.md` → "Granular Permission System (UI Controls)" for complete API reference, examples, and implementation guides.

## 📦 Inventory Management (UI Guidelines)

### Overview

The inventory system provides a complete UI for managing raw materials, recipes, pricing, and stock movements. **Critical**: The dashboard is display-only for inventory levels - actual stock deduction happens automatically on the backend when orders are paid.

### Key Components & Pages

**Pages:**
- `src/pages/Inventory/RawMaterials.tsx` - Raw material catalog with CRUD operations
- `src/pages/Inventory/Recipes.tsx` - Product recipes with ingredient management
- `src/pages/Inventory/Pricing.tsx` - Pricing policies and profit analysis

**Dialogs:**
- `RawMaterialDialog.tsx` - Add/edit raw materials (name, SKU, category, unit, stock levels, cost, perishability)
- `RecipeDialog.tsx` - Add/edit recipes with ingredient list and portions
- `ProductWizardDialog.tsx` - Multi-step product creation with recipe integration
- `AddIngredientDialog.tsx` - Search and add ingredients to recipes
- `AdjustStockDialog.tsx` - Manual stock adjustments (receiving, usage, waste, adjustment)
- `StockMovementsDialog.tsx` - View detailed stock movement history
- `PricingPolicyDialog.tsx` - Configure markup percentages and target profit margins

**Service:**
- `src/services/inventory.service.ts` - All API calls for raw materials, recipes, stock batches, movements

### i18n Namespace

Inventory features use the **`inventory` namespace** instead of the default namespace:

```typescript
// ✅ CORRECT: Use inventory namespace
const { t } = useTranslation('inventory')
return <h1>{t('rawMaterials.title')}</h1>  // Shorter key path

// ❌ WRONG: Don't use default namespace
const { t } = useTranslation()
return <h1>{t('inventory.rawMaterials.title')}</h1>  // Longer, unnecessary
```

**Translation structure** in `src/locales/{en,es}/inventory.json`:
- `rawMaterials.*` - Raw material management (fields, categories, messages, tooltips)
- `recipes.*` - Recipe management (ingredients, portions, costs)
- `pricing.*` - Pricing policies (markup, margins, profit calculations)
- `stockMovements.*` - Stock movement types and history
- `common.*` - Shared inventory terms (units, actions, validations)

### Common UI Tasks

**1. Adding a new raw material field:**
```typescript
// RawMaterialDialog.tsx - Add input field
<Input id="newField" {...register('newField', { required: true })} />

// Add translations
"rawMaterials": {
  "fields": {
    "newField": "New Field Label"
  },
  "fieldHelp": {
    "newField": "Tooltip explanation"
  }
}

// Update CreateRawMaterialDto in inventory.service.ts
export interface CreateRawMaterialDto {
  newField: string
  // ... other fields
}
```

**2. Displaying stock levels:**
```typescript
// Always format with proper units
const { t } = useTranslation('inventory')
const unitLabel = ALL_UNIT_OPTIONS.find(u => u.value === item.unit)?.label || item.unit

return (
  <span className="text-foreground font-medium">
    {Number(item.currentStock).toFixed(2)} {unitLabel}
  </span>
)
```

**3. Showing low stock alerts:**
```typescript
// Use theme-aware status colors
const isLowStock = item.currentStock <= item.reorderPoint

return (
  <Badge variant={isLowStock ? "destructive" : "success"}>
    {isLowStock
      ? t('rawMaterials.status.lowStock')
      : t('rawMaterials.status.inStock')
    }
  </Badge>
)
```

**4. Recipe cost calculations:**
```typescript
// Recipe total cost is auto-calculated on backend
// Just display it formatted
const totalCost = recipe.lines.reduce((sum, line) => {
  return sum + (Number(line.quantity) * Number(line.rawMaterial.costPerUnit))
}, 0)

return (
  <span className="text-muted-foreground">
    {new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency: 'USD'
    }).format(totalCost)}
  </span>
)
```

### Testing Inventory UI

**Manual Testing Checklist:**
1. Create raw material → Verify all fields saved (check Prisma Studio or API response)
2. Create recipe with 3+ ingredients → Verify `totalCost` calculated correctly
3. Adjust stock (receiving) → Verify new stock batch created with `expirationDate`
4. Check stock movements → Verify FIFO order (oldest `receivedDate` first)
5. Test in Spanish → All labels, tooltips, and messages translated
6. Toggle dark mode → All colors use theme tokens (no hardcoded grays)

**API Testing:**
```bash
# Get raw materials for venue
curl "http://localhost:12344/api/v1/dashboard/venues/{venueId}/raw-materials" \
  -H "Authorization: Bearer $TOKEN"

# Create stock batch (receiving inventory)
curl -X POST "http://localhost:12344/api/v1/dashboard/venues/{venueId}/raw-materials/{materialId}/adjust-stock" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "quantity": 500,
    "type": "RECEIVING",
    "unitCost": 2.50,
    "reason": "Weekly delivery"
  }'
```

### Critical Business Rules for UI

1. **Display-only stock levels**: Dashboard shows `currentStock` but does NOT deduct on order creation
2. **Backend deduction**: Stock deducts automatically when order is FULLY PAID (see server AGENTS.md)
3. **FIFO batches**: When displaying batches, sort by `receivedDate ASC` (oldest first)
4. **Perishable items**: Show `expirationDate` on stock batches (calculated from `receivedDate + shelfLifeDays`)
5. **Unit conversions**: Use exact unit enums (KILOGRAM, LITER, UNIT, etc.) - no free-text units
6. **Optional ingredients**: Recipe lines can have `isOptional: true` - show indicator in UI
7. **Cost tracking**: `costPerUnit` is average cost; individual batches have `unitCost`

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Stock levels not updating | Cache not invalidated | Check `queryClient.invalidateQueries(['rawMaterials'])` |
| Missing translations | Wrong namespace | Use `useTranslation('inventory')` not default |
| Wrong unit display | Hardcoded labels | Use `ALL_UNIT_OPTIONS.find()` for display labels |
| Dark mode colors broken | Hardcoded grays | Replace with `bg-background`, `text-foreground`, etc. |
| Recipe cost wrong | Missing ingredient | Verify all `RecipeLine` have `rawMaterial` included |

### Related Documentation

- Full inventory flow: `avoqado-server/AGENTS.md` → "Order → Payment → Inventory Flow"
- Backend implementation: `avoqado-server/CLAUDE.md` → "Order → Payment → Inventory Flow"
- UI architecture: `CLAUDE.md` (this project) → "Inventory Management System"
- Constants: `src/lib/inventory-constants.ts` → Unit options, categories, movement types
