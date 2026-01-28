# Purchase Orders & Suppliers System - Frontend Implementation Plan

## 🎯 Objetivo

Implementar el sistema completo de Purchase Orders (Pedidos de Compra) y Suppliers (Proveedores) en el frontend de Avoqado, conectando con
el backend que **ya está completamente implementado**.

Este sistema permitirá a los venues:

1. Gestionar proveedores con información de contacto y precios
2. Crear órdenes de compra a proveedores
3. Aprobar/rechazar órdenes (workflow)
4. Recibir mercancía y actualizar inventario automáticamente
5. Ver stock "Confirmado" (en tránsito) en InventorySummary

## 🔄 Adaptación a Sistema Avoqado (RawMaterials + Recipes)

**Diferencias clave Avoqado vs Square:**

| Aspecto            | Square for Retail        | Avoqado                                              |
| ------------------ | ------------------------ | ---------------------------------------------------- |
| **Items en PO**    | Items/Products genéricos | **RawMaterials** (ingredientes)                      |
| **Inventory Type** | Simple product tracking  | **Product → Recipe → RawMaterial**                   |
| **Stock tracking** | Product.quantity         | **RawMaterial.currentStock** + FIFO StockBatch       |
| **Modifiers**      | Solo afectan precio      | **Inventory tracking** (deducción de stock)          |
| **Units**          | Generic "quantity"       | **Unit types** (WEIGHT, VOLUME, COUNT) + conversions |

**Flujo de Stock en Avoqado:**

```
Purchase Order (recibir) → StockBatch (FIFO) → RawMaterial.currentStock ↑
Order (vender) → Recipe → RecipeLine → RawMaterial.currentStock ↓
Modifier (SUBSTITUTION) → RawMaterial.currentStock ↓
```

**Implicaciones para Purchase Orders:**

- ✅ Backend ya trabaja con RawMaterials (confirmado en schema.prisma)
- ✅ PurchaseOrderItem.rawMaterialId vincula a RawMaterial
- ✅ Al recibir, crea StockBatch automático (FIFO tracking)
- ✅ Modifiers pueden sustituir ingredientes (RecipeLine.isVariable)
- 📝 UI debe mostrar RawMaterial.unit correctamente (kg, L, unidades)
- 📝 Autocomplete de items debe buscar en RawMaterials activos
- 📝 Mostrar currentStock al agregar item a PO (info útil)

**Ventajas de Avoqado vs Limitaciones de Square:**

| Limitación de Square                      | Avoqado (Más flexible)                            |
| ----------------------------------------- | ------------------------------------------------- |
| ❌ Solo números enteros en cantidades     | ✅ **Decimal(12,3)** - Soporta 2.5kg, 1.75L, etc. |
| ❌ Max 500 items por PO                   | ✅ **Sin límite** (o límite mayor si se necesita) |
| ❌ Solo tracking de producto final        | ✅ **FIFO batch tracking** por ingrediente        |
| ❌ No tracking de modifiers en inventario | ✅ **Modifiers afectan stock** (SUBSTITUTION)     |
| ❌ Unidades genéricas "quantity"          | ✅ **Conversión de unidades** (kg ↔ g, L ↔ ml)    |

**Validaciones requeridas en UI (diferentes a Square):**

- ✅ Permitir decimales en cantidades: `<Input type="number" step="0.001" />`
- ✅ Mostrar unidad junto a cantidad: "2.5 kg" no solo "2.5"
- ✅ Validar cantidad > 0 (puede ser decimal)
- ✅ No aplicar límite de 500 items (Square-specific)
- ✅ Al recibir, permitir decimales en cantidades recibidas

## 📝 UX Simplificado - Basado en Square Tutorials

**Plan actualizado con base en tutoriales de Square.** Cambios clave:

✅ **SupplierDialog simplificado:**

- Sin tabs, formulario de una sola pantalla
- Solo 1 campo requerido: Nombre del proveedor
- 5 campos opcionales: Account Number, Notes, Phone, Email, ZIP Code

✅ **ReceiveOrderDialog simplificado:**

- Tabla simple: 3 columnas (Material, Ordenado, Recibir)
- Cantidades pre-filled (usuario solo ajusta si recibió menos)
- Backend auto-genera: batch number, usa costo de la orden
- Eliminados de UI: Costo real, Lote manual, Vencimiento

✅ **PurchaseOrderWizard mejorado:**

- Agregado: "Ubicación de punto de venta" (opcional)
- Mantiene 3 pasos (como Square)

✅ **Features documentadas para futuro:**

- Email Preview + Send (con adjunto PDF)
- PDF Export/Download
- Print Labels (Premium feature)

## ⚠️ ALCANCE DE ESTA FASE

**Esta fase implementa ÚNICAMENTE:**

- ✅ **Suppliers (Proveedores)** - CRUD completo, precios, performance metrics
- ✅ **Purchase Orders (Pedidos de Compra)** - Workflow completo (10 estados)
- ✅ **Receive Order Flow** - Recepción de mercancía con FIFO tracking
- ✅ **Integración InventorySummary** - Columna "Confirmado" con stock en tránsito
- ✅ **Sidebar Navigation** - Items para Proveedores y Pedidos
- ✅ **Email to Supplier** - Envío de emails con PDF adjunto + confirmation dialog
- ✅ **Export Features** - PDF download y CSV export
- ✅ **Duplicate PO** - Quick re-order functionality
- ✅ **Dropdown Menu** - Todas las opciones como Square (Detalles, Duplicar, Email, PDF, CSV, Cancelar)

**Disponibilidad:** Por ahora, estas funcionalidades estarán **disponibles para TODOS los venues**. No hay restricción por tipo de negocio
en esta fase.

**NO incluido (futuro):**

- ❌ Sistema de activación de funcionalidades por tipo de negocio
- ❌ Panel de Settings para activar/desactivar features
- ❌ POS móvil nativo
- ❌ Sistema de "Modos" como Square POS
- ❌ Print Labels (Premium feature de Square)

## 📸 Referencia: Square

![Square Purchase Orders](https://squareup.com/help/us/es/article/6110-manage-inventory-with-the-retail-pos-app)

Sidebar en Square:

- **Gestión de inventario** (expandible)
  - Resumen de existencias
  - Historial
  - Recuentos de existencias
  - **Pedidos** ← Purchase Orders
  - **Proveedores** ← Suppliers
  - **Reabastecimientos pendientes** ← Pending replenishment (future)
  - Seguimiento de ingredientes ← Ingredient tracking (future)

## ✅ Backend Status: COMPLETAMENTE IMPLEMENTADO

### Database Models (Prisma)

- ✅ `Supplier` - Proveedor con contacto, rating, lead time
- ✅ `SupplierPricing` - Precios por raw material
- ✅ `PurchaseOrder` - Orden de compra con workflow
- ✅ `PurchaseOrderItem` - Items de la orden con cantidades

### API Endpoints (Backend Listo)

**Suppliers:**

```
GET    /api/v1/dashboard/venues/{venueId}/inventory/suppliers
GET    /api/v1/dashboard/venues/{venueId}/inventory/suppliers/{supplierId}
POST   /api/v1/dashboard/venues/{venueId}/inventory/suppliers
PUT    /api/v1/dashboard/venues/{venueId}/inventory/suppliers/{supplierId}
DELETE /api/v1/dashboard/venues/{venueId}/inventory/suppliers/{supplierId}
POST   /api/v1/dashboard/venues/{venueId}/inventory/suppliers/{supplierId}/pricing
GET    /api/v1/dashboard/venues/{venueId}/inventory/raw-materials/{rawMaterialId}/supplier-pricing
GET    /api/v1/dashboard/venues/{venueId}/inventory/raw-materials/{rawMaterialId}/supplier-recommendations
GET    /api/v1/dashboard/venues/{venueId}/inventory/suppliers/{supplierId}/performance
```

**Purchase Orders:**

```
GET    /api/v1/dashboard/venues/{venueId}/inventory/purchase-orders
GET    /api/v1/dashboard/venues/{venueId}/inventory/purchase-orders/{purchaseOrderId}
POST   /api/v1/dashboard/venues/{venueId}/inventory/purchase-orders
PUT    /api/v1/dashboard/venues/{venueId}/inventory/purchase-orders/{purchaseOrderId}
POST   /api/v1/dashboard/venues/{venueId}/inventory/purchase-orders/{purchaseOrderId}/approve
POST   /api/v1/dashboard/venues/{venueId}/inventory/purchase-orders/{purchaseOrderId}/receive
POST   /api/v1/dashboard/venues/{venueId}/inventory/purchase-orders/{purchaseOrderId}/cancel
GET    /api/v1/dashboard/venues/{venueId}/inventory/purchase-orders/stats
```

### Workflow de Estados (Backend)

```
DRAFT               → Borrador (editable)
  ↓ submit
PENDING_APPROVAL    → Esperando aprobación
  ↓ approve
APPROVED            → Aprobada (lista para enviar)
  ↓ send
SENT                → Enviada al proveedor ← AQUÍ APARECE EN "CONFIRMADO"
  ↓ confirm
CONFIRMED           → Confirmada por proveedor
  ↓ ship
SHIPPED             → En tránsito
  ↓ receive (partial)
PARTIALLY_RECEIVED  → Recibida parcialmente
  ↓ receive (complete)
RECEIVED            → Completamente recibida ← STOCK ACTUALIZADO
```

**Transiciones cancelables:**

- Desde DRAFT, PENDING_APPROVAL, APPROVED, SENT → CANCELLED
