---

## ✅ Technical Validation Checks

### 1. Backend API Validation

**Verificar Endpoints Requeridos:**

```bash
# Suppliers
✓ GET    /api/v1/dashboard/venues/{venueId}/inventory/suppliers
✓ GET    /api/v1/dashboard/venues/{venueId}/inventory/suppliers/{supplierId}
✓ POST   /api/v1/dashboard/venues/{venueId}/inventory/suppliers
✓ PUT    /api/v1/dashboard/venues/{venueId}/inventory/suppliers/{supplierId}
✓ DELETE /api/v1/dashboard/venues/{venueId}/inventory/suppliers/{supplierId}
✓ POST   /api/v1/dashboard/venues/{venueId}/inventory/suppliers/{supplierId}/pricing

# Purchase Orders
✓ GET    /api/v1/dashboard/venues/{venueId}/inventory/purchase-orders
✓ GET    /api/v1/dashboard/venues/{venueId}/inventory/purchase-orders/{purchaseOrderId}
✓ POST   /api/v1/dashboard/venues/{venueId}/inventory/purchase-orders
✓ PUT    /api/v1/dashboard/venues/{venueId}/inventory/purchase-orders/{purchaseOrderId}
✓ POST   /api/v1/dashboard/venues/{venueId}/inventory/purchase-orders/{purchaseOrderId}/approve
✓ POST   /api/v1/dashboard/venues/{venueId}/inventory/purchase-orders/{purchaseOrderId}/receive
✓ POST   /api/v1/dashboard/venues/{venueId}/inventory/purchase-orders/{purchaseOrderId}/cancel
```

**Status:** ✅ TODOS los endpoints confirmados en `/avoqado-server/src/routes/dashboard/inventory.routes.ts`

### 2. Data Flow Validation

**Query Pattern (React Query):**

```tsx
// ✅ Patrón correcto siguiendo codebase
const { data, isLoading, error } = useQuery({
  queryKey: ['resource-name', venueId, filters],
  queryFn: () => serviceMethod(venueId, filters),
})

// Mutation con invalidation
const mutation = useMutation({
  mutationFn: data => service.method(venueId, data),
  onSuccess: () => {
    queryClient.invalidateQueries(['resource-name'])
    toast.success('Operación exitosa')
  },
})
```

**Validación:** ✅ Sigue patrón de `Orders.tsx` e `InventorySummary.tsx`

### 3. Form Validation (Zod Schema)

**Supplier Form Schema:**

```tsx
const supplierSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  contactPerson: z.string().optional(),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().optional(),
  website: z.string().url('URL inválida').optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  zipCode: z.string().optional(),
  taxId: z.string().optional(),
  leadTimeDays: z.number().int().positive().optional(),
  minimumOrder: z.number().positive().optional(),
  rating: z.number().min(0).max(5).optional(),
  reliabilityScore: z.number().min(0).max(1).optional(),
  active: z.boolean().default(true),
})
```

**Purchase Order Form Schema:**

```tsx
const poItemSchema = z.object({
  rawMaterialId: z.string().cuid(),
  quantityOrdered: z.number().positive('Cantidad debe ser mayor a 0'),
  unitPrice: z.number().positive('Precio debe ser mayor a 0'),
})

const purchaseOrderSchema = z.object({
  supplierId: z.string().cuid('Selecciona un proveedor'),
  items: z.array(poItemSchema).min(1, 'Agrega al menos un artículo'),
  taxRate: z.number().min(0).max(1).optional(),
  notes: z.string().optional(),
})
```

**Validación:** ✅ Schemas match Prisma models

### 4. Permission Checks

**Required Permissions:**

- `inventory:read` - Ver proveedores, ver pedidos, ver detalles
- `inventory:write` - Crear/editar proveedores, crear pedidos
- `inventory:approve` - Aprobar pedidos (PENDING_APPROVAL → APPROVED)
- `inventory:receive` - Recibir mercancía (SHIPPED → RECEIVED)

**Implementation:**

```tsx
// En sidebar
{
  title: t('sidebar.suppliers'),
  url: `${fullBasePath}/inventory/suppliers`,
  icon: Handshake,
  permission: 'inventory:read', // ✅
}

// En páginas
const hasWritePermission = usePermission('inventory:write')
const hasApprovePermission = usePermission('inventory:approve')

// Conditional rendering
{hasWritePermission && (
  <Button onClick={handleCreate}>Crear</Button>
)}
```

**Validación:** ✅ Sigue patrón de permisos existente en `Orders.tsx`

### 5. State Management Validation

**Purchase Order State Transitions:**

```typescript
// ✅ Verificado en backend purchaseOrderWorkflow.service.ts

DRAFT → PENDING_APPROVAL (submit)
PENDING_APPROVAL → APPROVED (approve) | CANCELLED (reject)
APPROVED → SENT (send)
SENT → CONFIRMED (confirm) | CANCELLED (cancel)
CONFIRMED → SHIPPED (ship)
SHIPPED → PARTIALLY_RECEIVED (receive partial) | RECEIVED (receive all)
PARTIALLY_RECEIVED → RECEIVED (receive rest)
```

**Validation Rules:**

- ✅ No se puede editar si status !== DRAFT
- ✅ Solo se puede cancelar desde DRAFT, PENDING_APPROVAL, APPROVED, SENT
- ✅ Solo se puede recibir desde SHIPPED o PARTIALLY_RECEIVED
- ✅ quantityReceived no puede exceder quantityOrdered

### 6. Stock Update Validation (Confirmado Column)

**Cálculo de Stock Confirmado:**

```tsx
// ✅ Correcto: suma cantidades pendientes de recibir
const getConfirmedStock = (rawMaterialId: string) => {
  return purchaseOrders?.data
    .filter(po => ['SENT', 'CONFIRMED', 'SHIPPED', 'PARTIALLY_RECEIVED'].includes(po.status))
    .flatMap(po => po.items)
    .filter(item => item.rawMaterialId === rawMaterialId)
    .reduce((sum, item) => {
      const pending = item.quantityOrdered - (item.quantityReceived || 0)
      return sum + pending
    }, 0)
}
```

**Escenario de Prueba:**

1. Crear PO con 100kg de Harina, status SENT → Confirmado = 100kg ✅
2. Recibir 60kg parcialmente, status PARTIALLY_RECEIVED → Confirmado = 40kg ✅
3. Recibir resto 40kg, status RECEIVED → Confirmado = 0kg ✅
4. Stock físico se incrementa en cada recepción ✅

**Validación:** ✅ Lógica correcta, backend maneja actualización automática

### 7. FIFO Tracking Validation

**Backend StockBatch Creation:**

```typescript
// ✅ Verificado en purchaseOrder.service.ts
async receivePurchaseOrder(data: ReceivePODto) {
  for (const item of data.items) {
    // Crear StockBatch para FIFO
    await prisma.stockBatch.create({
      data: {
        rawMaterialId: item.rawMaterialId,
        quantity: item.quantityReceived,
        unitCost: item.unitCost,
        batchNumber: item.batchNumber,
        expirationDate: item.expirationDate,
        receivedDate: new Date(),
        // ...
      }
    })

    // Incrementar stock físico
    await prisma.rawMaterial.update({
      where: { id: item.rawMaterialId },
      data: {
        currentStock: { increment: item.quantityReceived }
      }
    })
  }
}
```

**Validación:** ✅ Backend ya implementa FIFO correctamente

### 8. UI Component Compatibility

**Existing Components to Reuse:**

- ✅ `DataTable` - Tablas con sorting/filtering
- ✅ `Button` - Todas las variantes
- ✅ `Badge` - Status badges
- ✅ `Dialog` - Modales
- ✅ `Input` - Inputs de formularios
- ✅ `Select` - Dropdowns
- ✅ `Tabs` - Para SupplierDialog
- ✅ `Card` - Para secciones
- ✅ `DropdownMenu` - Actions menu
- ✅ `Calendar` - Date picker (shadcn/ui)
- ✅ `Combobox` - Autocomplete para raw materials

**Validación:** ✅ Todos los componentes ya existen en el proyecto

### 9. Translation Keys Validation

**Required Keys:**

```json
// es/inventory.json
{
  "sidebar": {
    "suppliers": "Proveedores",
    "purchaseOrders": "Pedidos de Compra"
  },
  "suppliers": {
    "title": "Proveedores",
    "create": "Crear proveedor",
    "edit": "Editar proveedor"
    // ... más keys
  },
  "purchaseOrders": {
    "title": "Pedidos de Compra",
    "create": "Crear pedido"
    // ... más keys
  },
  "status": {
    "DRAFT": "Borrador",
    "PENDING_APPROVAL": "Pendiente de Aprobación",
    "SENT": "Enviado"
    // ... todos los estados
  }
}
```

**Validación:** ✅ Estructura clara, seguir patrón de `en/orders.json` y `es/orders.json`

### 10. Router Configuration Validation

**New Routes:**

```tsx
// ✅ Correcta estructura anidada
<Route path="inventory">
  <Route path="summary" element={<InventorySummary />} />
  <Route path="history" element={<InventoryHistory />} />
  <Route path="suppliers" element={<SuppliersPage />} /> // NEW
  <Route path="purchase-orders" element={<PurchaseOrdersPage />} /> // NEW
  <Route path="purchase-orders/:poId" element={<PurchaseOrderDetailPage />} /> // NEW
</Route>
```

**Validación:** ✅ Sigue estructura de rutas existente en `router.tsx`

---

## 🎯 Confidence Score: 95/100

**Razones de Confianza:**

1. ✅ Backend 100% implementado y verificado
2. ✅ Todos los endpoints confirmados existentes
3. ✅ Prisma models match requirements
4. ✅ UI patterns siguen codebase existente (Orders.tsx, InventorySummary.tsx)
5. ✅ React Query patterns validated
6. ✅ Form validation schemas match backend
7. ✅ Permission system compatible
8. ✅ FIFO tracking ya implementado en backend
9. ✅ Component library completa (shadcn/ui)
10. ✅ Responsive design patterns claros

**Riesgos Mitigados:**

- ✅ Cálculo de "Confirmado" validado con lógica correcta
- ✅ State transitions verificados con backend workflow
- ✅ Stock updates automáticos confirmados en backend
- ✅ FIFO batches manejados correctamente

**Único 5% de riesgo:**

- Posibles ajustes menores de UX durante testing real con usuarios
- Posibles edge cases en validaciones de formularios durante desarrollo

---

## 🏗️ Frontend Architecture - Páginas a Crear

### 1. Suppliers (Proveedores)

**Ruta:** `/venues/:slug/inventory/suppliers`

**Componentes:**

- **SuppliersPage.tsx** - Página principal
  - Tabla con columnas: Nombre, Contacto, Teléfono, Email, Estado, Acciones
  - Filtros: Estado (activo/inactivo), búsqueda por nombre
  - Botón "Crear proveedor"

- **SupplierDialog.tsx** - Crear/editar proveedor (SIMPLIFICADO como Square)
  - Single-screen form (sin tabs)
  - Solo 1 campo requerido: Nombre del proveedor (\*)
  - Campos opcionales: Account Number, Notes, Phone, Email, ZIP Code
  - Total: 6 campos (vs 15+ en versión compleja)

- **SupplierPricingDialog.tsx** - Gestionar precios por raw material
  - Seleccionar raw material
  - Precio por unidad
  - Cantidad mínima
  - Descuento por volumen
  - Fecha efectiva

- **SupplierPerformanceCard.tsx** - Métricas
  - Total gastado
  - Órdenes completadas
  - Tasa de entrega a tiempo
  - Rating promedio

### 2. Purchase Orders (Pedidos)

**Ruta:** `/venues/:slug/inventory/purchase-orders`

**Componentes:**

- **PurchaseOrdersPage.tsx** - Lista de órdenes
  - Tabla con columnas: PO Number, Proveedor, Estado, Fecha, Total, Acciones
  - Filtros: Estado (todos, pendiente, enviada, recibida), proveedor, fecha
  - Botón "Crear pedido"

- **PurchaseOrderDialog.tsx** - Crear/editar orden (Wizard 3 pasos)
  - Step 1: Seleccionar proveedor
  - Step 2: Agregar items (raw materials + cantidades)
    - Dropdown opcional: "Ubicación de punto de venta" (como Square)
    - Autocomplete de raw materials
    - Cantidad ordenada
    - Precio unitario (auto-fill desde supplier pricing)
    - Subtotal calculado en tiempo real
  - Step 3: Confirmar (resumen + subtotal, tax, total)
  - Guardar como DRAFT o enviar a PENDING_APPROVAL

- **PurchaseOrderDetailPage.tsx** - Ver/gestionar orden
  - Header con PO number, proveedor, estado
  - Items table (raw material, cantidad, precio, total)
  - Status timeline visual (similar a tracking de paquetería)
  - Botones de acción según estado:
    - DRAFT → [Editar] [Enviar a Aprobación] [Eliminar]
    - PENDING_APPROVAL → [Aprobar] [Rechazar]
    - APPROVED → [Enviar a Proveedor]
    - SENT → [Marcar como Enviada]
    - SHIPPED → [Recibir Orden]
    - PARTIALLY_RECEIVED → [Recibir Resto]

- **ReceiveOrderDialog.tsx** - Recibir mercancía (SIMPLIFICADO como Square)
  - Tabla simple con 3 columnas: Material, Ordenado, Recibir
  - Cantidades pre-filled con lo ordenado (usuario ajusta si recibió menos)
  - Backend auto-genera: batch number, usa costo de la orden
  - Botones:
    - [Cancelar] - cierra sin guardar
    - [Guardar] - recibe las cantidades ingresadas
  - Campos ELIMINADOS de UI (backend los maneja): Costo real, Lote, Vencimiento

- **ApprovalDialog.tsx** - Aprobar/rechazar
  - Mostrar detalles de la orden
  - Razón de rechazo (textarea, requerido si rechaza)
  - [Aprobar] [Rechazar]

### 3. Sidebar Navigation

**Archivo:** `/components/Sidebar/app-sidebar.tsx`

**Agregar sección expandible "Gestión de inventario":**

```typescript
{
  title: t('sidebar.inventory'),
  url: '#',
  icon: Package,
  items: [
    {
      title: t('sidebar.inventorySummary'),
      url: `${fullBasePath}/inventory/summary`,
    },
    {
      title: t('sidebar.inventoryHistory'),
      url: `${fullBasePath}/inventory/history`,
    },
    {
      title: t('sidebar.suppliers'),  // NEW
      url: `${fullBasePath}/inventory/suppliers`,
      icon: Handshake,
    },
    {
      title: t('sidebar.purchaseOrders'),  // NEW
      url: `${fullBasePath}/inventory/purchase-orders`,
      icon: Receipt,
    },
    // Future:
    // {
    //   title: t('sidebar.restockAlerts'),
    //   url: `${fullBasePath}/inventory/restock-alerts`,
    // },
  ]
}
```
