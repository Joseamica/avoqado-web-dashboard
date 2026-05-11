# Plan: Unificar Stock Overview en 2 tabs (Artículos + Ingredientes / Recetas)

**Estado:** Aprobado condicionado tras auditoría interna + externa
**Ruta afectada:** `/venues/:slug/inventory/stock-overview`
**Archivo principal:** `src/pages/Inventory/InventorySummary.tsx`

---

## 1. Objetivo

Convertir `stock-overview` en **el** lugar operativo para ver y ajustar existencias, fusionando productos contables con ingredientes en una sola tabla. La página `/inventory/ingredients` permanece como vista administrativa detallada.

### UX final

| Tab | Contenido | Acción row click |
|---|---|---|
| **Artículos e Ingredientes** | Productos `inventoryMethod === 'QUANTITY'` (o legacy `trackInventory`) + Raw Materials, cada fila con badge `Producto` / `Ingrediente` | **Producto:** abre `StockEditPopover` inline (comportamiento actual). **Ingrediente:** abre `AdjustStockDialog`. |
| **Basados en recetas** | Productos `inventoryMethod === 'RECIPE'`, solo informativo | Navega a `Editar receta` |

**Motivación:** semánticamente "producto contable" y "materia prima" son lo mismo (algo que cuento y ajusto físicamente). Las recetas se quedan aparte porque su stock es derivado.

### Decisión UX: asimetría popover ↔ dialog (intencional)

Productos siguen con popover inline; ingredientes abren dialog. **Razones:**

1. Preserva el tour `useStockAdjustmentTour` sin reescribirlo (los 5 `data-tour` keys viven en el popover hoy).
2. El dialog de ingredientes (`AdjustStockDialog`) tiene campos que **no caben** en un popover (proveedor, costo unitario obligatorio en recepciones).
3. La acción es semánticamente distinta: ajustar producto = movimiento simple; ajustar ingrediente = puede crear movimiento + asociar proveedor + costear FIFO.

**Implicación:** no hay un solo `onRowClick` que abra "el dialog correspondiente". El comportamiento se ramifica:
- Filas de producto: el clic sobre el popover trigger (la celda "Existencias físicas") abre el popover. **No** registrar `onRowClick` global en estas filas — Radix `PopoverTrigger` y `onRowClick` competirían y el popover podría cerrarse por bubble.
- Filas de ingrediente: `onClick` en la celda de existencias abre el dialog. `e.stopPropagation()` en cualquier elemento interactivo anidado.
- Tab "recetas": `onRowClick` libre porque navega.

---

## 2. Contexto técnico verificado

### Estado actual de `InventorySummary.tsx`

- Ya usa `<Tabs>` (líneas 443, 641, 652) con `value="physical"` y `value="recipes"`.
- Fetcha solo productos: `useQuery(['products', venueId, 'inventory-summary'])`.
- Productos físicos se ajustan vía `StockEditPopover` **inline** (línea 677, no es un dialog) → `productInventoryApi.adjustStock`.
- Invalida solo `['products', venueId]` (línea 127).
- Sin `<PermissionGate>` — bug preexistente.

### Estado actual de Ingredientes

- Página separada: `src/pages/Inventory/RawMaterials.tsx`.
- Fetcha vía `useQuery(['rawMaterials', venueId, search])`.
- Ajuste vía `AdjustStockDialog.tsx` (el nombre engaña; este es el de ingredientes).
- Sí usa `<PermissionGate permission="inventory:adjust">` (línea 813+).

### Dialogs (nombres confusos, documentar)

| Archivo | Para qué | Usado en |
|---|---|---|
| `pages/Inventory/components/AdjustStockDialog.tsx` | **Ingredientes** (raw materials) | `RawMaterials.tsx` |
| `pages/Inventory/components/AdjustInventoryStockDialog.tsx` | **Productos** | `ProductStock.tsx` (no en stock-overview) |
| `components/AdjustStockDialog.tsx` | Legacy, sin mutación | `Menu/Products/Products.tsx` — fuera de scope |

### Schemas divergentes

| Campo | Product (`InventoryProduct`) | RawMaterial |
|---|---|---|
| Stock | `availableQuantity` (string\|number\|null) | `currentStock` (number) |
| Umbral | `inventory.minimumStock` | `minimumStock` + `reorderPoint` (low-stock usa `reorderPoint`) |
| Costo | `cost` | `costPerUnit`, `avgCostPerUnit` |
| Unidad | — | `unit` (gramos, kg, ml, etc.) |
| Precio venta | `price` | — |
| Otros | `trackInventory`, `inventoryMethod` | `category`, `perishable`, `shelfLifeDays`, `active`, `_count.recipeLines` |

---

## 3. Riesgos identificados

1. **Semántica divergente** → mitigación: row view model normalizado (ver §4).
2. **Invalidación cruzada de queries** → mitigación: helper centralizado (ver §4).
3. **Tour frágil** — `useStockAdjustmentTour` asume "FIRST row's Existencias físicas dropdown" (comentario explícito en `hooks/useStockAdjustmentTour.ts:12`). Si la primera fila unificada es ingrediente, el tour rompe silenciosamente en producción.
4. **Permisos** — popover sin gate hoy. Mover ingredientes (que sí están gated) sin gate el popover sería regresión visible.
5. **TableId persistido** — `tableId="inventory:physical"` guarda preferencias de columnas. Renombrar resetea preferencias guardadas; aceptable pero documentado.
6. **Bug latente en `YieldStatusHoverCard.tsx:131`** — navega a `${fullBasePath}/inventory/raw-materials` pero la ruta real es `/inventory/ingredients`. **Incluido en este PR** (1 línea, toca exactamente la navegación de stock/ingredientes).

---

## 4. Decisiones arquitectónicas

### 4.1 View Model normalizado

Crear `StockOverviewRow` (no ramificar `availableQuantity` vs `currentStock` en cada cell):

```ts
type StockOverviewRow = {
  id: string
  kind: 'product' | 'ingredient'
  name: string
  sku: string | null
  unitLabel: string | null    // null para productos sin unidad
  stock: number               // normalizado desde availableQuantity / currentStock
  minStock: number | null     // minimumStock (product) o reorderPoint (ingredient)
  cost: number | null
  price: number | null        // null para ingredientes
  confirmedStock: number | null  // solo ingredientes (POs in-transit)
  source: InventoryProduct | RawMaterial  // referencia al raw para mutations
}
```

Adapters `toStockOverviewRow(product)` y `toStockOverviewRow(rawMaterial)`. Cells consumen `StockOverviewRow`; solo ramifican donde la acción cambia (row click, badge, formato de unidad).

### 4.2 Query key factory + invalidation helper

```ts
// src/lib/queryKeys/inventory.ts
export const inventoryKeys = {
  products: (venueId: string) => ['products', venueId] as const,
  productsSummary: (venueId: string) => ['products', venueId, 'inventory-summary'] as const,
  rawMaterials: (venueId: string) => ['rawMaterials', venueId] as const,
  productMovements: (venueId: string, productId: string) => ['productInventoryMovements', venueId, productId] as const,
  rawMaterialMovements: (venueId: string, rawMaterialId: string) => ['stockMovements', venueId, rawMaterialId] as const,
  confirmedStock: (venueId: string) => ['purchase-orders-confirmed-stock', venueId] as const,
}

export function invalidateStockOverviewQueries(
  qc: QueryClient,
  venueId: string,
  target: { kind: 'product' | 'ingredient'; id: string },
) {
  qc.invalidateQueries({ queryKey: inventoryKeys.products(venueId) })
  qc.invalidateQueries({ queryKey: inventoryKeys.rawMaterials(venueId) })
  if (target.kind === 'product') {
    qc.invalidateQueries({ queryKey: inventoryKeys.productMovements(venueId, target.id) })
  } else {
    qc.invalidateQueries({ queryKey: inventoryKeys.rawMaterialMovements(venueId, target.id) })
    qc.invalidateQueries({ queryKey: inventoryKeys.confirmedStock(venueId) })
  }
}
```

**Signatura ligera por diseño:** acepta `{ kind, id }` en vez del `StockOverviewRow` completo, para que `AdjustStockDialog` (que solo conoce `RawMaterial`, no el view model) pueda llamarlo sin acoplarse al tipo de la tabla. Llamado desde **ambas** mutaciones (popover de producto → `{ kind: 'product', id: productId }`; dialog de ingrediente → `{ kind: 'ingredient', id: rawMaterialId }`).

### 4.3 Tour: pinear al primer producto, no primer row

`DataTable` no expone API para atributos por row (no hay prop `getRowAttributes`), así que **no** podemos poner `data-row-kind` en el `<TableRow>`. En su lugar:

- Agregar `data-stock-kind="product"` al **botón trigger del popover** dentro de la cell de existencias (renderizado solo para filas de producto).
- Cambiar el selector del tour de `[data-tour="stock-edit-trigger"]` a `[data-stock-kind="product"][data-tour="stock-edit-trigger"]`.

Esto preserva el tour aunque la primera fila alfabética sea ingrediente, y no requiere modificar `DataTable`. Los demás 4 `data-tour` keys (`stock-edit-popover`, `stock-edit-action`, `stock-edit-quantity`, `stock-edit-save`) viven dentro del popover y no necesitan cambio.

### 4.4 Permisos

Envolver `StockEditPopover` con `<PermissionGate permission="inventory:adjust">` para paridad con `RawMaterials.tsx:813+`. Corrige regresión de seguridad preexistente.

### 4.5 Navegación con `fullBasePath`

Row click en tab "Basados en recetas":
```ts
const { fullBasePath } = useCurrentVenue()
navigate(`${fullBasePath}/inventory/recipes?productId=${row.id}`)
```
Cumple regla crítica #6 (white-label).

### 4.6 Filtros — no fusionar

Mantener el filter set actual de `InventorySummary` (stock, disponible, precio). Para filas de ingrediente, los filtros de "precio" no aplican (se saltan). **No** importar los filtros ricos de `RawMaterials` (categoría, perishable, rango de costo) — son scope creep y deuda visual.

### 4.7 No tocar

- Página `/inventory/ingredients` standalone.
- Entry de sidebar para Ingredientes (varios checklists y tours hardcodean ese link).
- Unificación de entidades backend (`Product` QUANTITY + `RawMaterial`). Deuda real pero independiente.

---

## 5. Commits planeados (un solo PR)

| # | Commit | Archivos principales |
|---|---|---|
| 1 | `feat(inventory): introduce StockOverviewRow view model + query key factory` | `src/lib/queryKeys/inventory.ts`, `src/pages/Inventory/types/stock-overview.ts` |
| 2 | `feat(inventory): merge raw materials into stock-overview tab 1 with kind badge` | `InventorySummary.tsx` |
| 3 | `feat(inventory): cross-invalidate via invalidateStockOverviewQueries helper` | `InventorySummary.tsx`, `pages/Inventory/components/AdjustStockDialog.tsx` |
| 4 | `feat(inventory): recipe row click navigates to edit recipe (fullBasePath)` | `InventorySummary.tsx` |
| 5 | `fix(inventory): gate StockEditPopover with inventory:adjust permission` | `InventorySummary.tsx` |
| 6 | `fix(inventory): pin stock adjustment tour to first product row via data-stock-kind` | `hooks/useStockAdjustmentTour.ts`, `InventorySummary.tsx` (atributo `data-stock-kind` en popover trigger) |
| 7 | `fix(inventory): correct YieldStatusHoverCard navigation from raw-materials to ingredients` | `pages/Inventory/components/YieldStatusHoverCard.tsx` |

---

## 6. Verificación pre-deploy

- [ ] `npm run build` pasa
- [ ] `npm run lint` pasa
- [ ] `npm run test:e2e` pasa
- [ ] Tour `useStockAdjustmentTour` funciona en venue con: (a) solo productos, (b) solo ingredientes, (c) mezclado con ingrediente como primera fila alfabética
- [ ] Ajustar producto refresca filas de ingrediente y viceversa (cross-invalidation)
- [ ] Usuario sin `inventory:adjust` ve la tabla pero **no** puede abrir popover/dialog en ninguna fila
- [ ] White-label: row click en recetas navega a `/wl/venues/:slug/inventory/recipes?productId=…`
- [ ] Light + dark mode
- [ ] Roles probados: VIEWER, MANAGER, OWNER
- [ ] Sin warnings en consola
- [ ] i18n: ningún string nuevo hardcodeado sin `t()` (productos en `InventorySummary` ya están en español hardcodeado; mantener consistencia local)

---

## 7. Fuera de scope (issues separados)

1. **Unificación backend** de `Product` QUANTITY + `RawMaterial` en una sola entidad.
2. **Importar filtros ricos** de `RawMaterials` (categoría, perishable, etc.) a la tabla unificada.
3. **Unificar los tres dialogs de ajuste** (`AdjustStockDialog`, `AdjustInventoryStockDialog`, legacy) en un solo componente con prop `entityKind`.

---

## 8. Preguntas abiertas (resolver antes de mergear)

- ¿El badge `Producto` / `Ingrediente` es suficiente UX, o agrupamos visualmente con sub-headers por kind cuando hay >X filas?
- ¿`tableId` nuevo (`inventory:mixed` vs `inventory:physical`) — aceptamos reset de preferencias de columnas para usuarios actuales o migramos?
- ¿La columna "Precio" se muestra vacía para ingredientes o se oculta dinámicamente cuando hay ingredientes visibles?
