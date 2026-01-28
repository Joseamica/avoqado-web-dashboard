---

## 🎨 UI/UX Detailed Specifications

### Visual Design System

**Color Palette para Status Badges:**

```tsx
DRAFT              → Badge variant="secondary" (gray background)
PENDING_APPROVAL   → Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
APPROVED           → Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400"
SENT               → Badge className="bg-purple-500/10 text-purple-700 dark:text-purple-400" ⭐
CONFIRMED          → Badge className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
SHIPPED            → Badge className="bg-orange-500/10 text-orange-700 dark:text-orange-400"
PARTIALLY_RECEIVED → Badge className="bg-lime-500/10 text-lime-700 dark:text-lime-400"
RECEIVED           → Badge variant="success" (green)
CANCELLED          → Badge variant="destructive" (red)
```

**Iconografía (Lucide React):**

- Suppliers (Proveedores): `Handshake` icon
- Purchase Orders (Pedidos): `Receipt` icon
- Add Supplier/PO: `Plus` icon
- Edit: `Pencil` icon
- Delete: `Trash2` icon
- Search: `Search` icon
- Filter: `Filter` icon
- More Actions: `MoreVertical` icon
- Success: `CheckCircle2` icon
- Warning: `AlertTriangle` icon
- Info: `Info` icon

### 1. SuppliersPage - Visual Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Proveedores                                    [+ Crear proveedor]│
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ 🔍 Buscar por nombre...          [Filtro: Activos ▼]            │
│                                                                   │
├───────┬──────────┬───────────┬────────────┬────────┬──────────┤
│ Nombre│ Contacto │ Teléfono  │   Email    │ Estado │ Acciones │
├───────┼──────────┼───────────┼────────────┼────────┼──────────┤
│ ACME  │ Juan P.  │ 555-1234  │ j@acme.com │ Activo │    ⋮     │
│ Corp. │          │           │            │[green] │          │
├───────┼──────────┼───────────┼────────────┼────────┼──────────┤
│ Global│ Maria G. │ 555-5678  │ m@glob.com │Inactivo│    ⋮     │
│ Foods │          │           │            │ [gray] │          │
└───────┴──────────┴───────────┴────────────┴────────┴──────────┘
```

**Layout Details:**

- Container: `p-6` padding, full width
- Header: `flex justify-between items-center mb-6`
- Title: `text-2xl font-bold`
- Create button: Primary button with `Plus` icon, gap-2
- Search input: `w-64` width, with `Search` icon prefix
- Filter dropdown: `w-40`, shows "Todos", "Activos", "Inactivos"
- Table: `DataTable` component with rounded borders, hover states
- Action menu: Dropdown with "Editar", "Ver precios", "Ver performance", "Eliminar"
- Estado badge: `min-w-[80px] justify-center`

**Empty State:**

```
┌─────────────────────────────────────────────────┐
│              [Handshake icon]                    │
│                                                  │
│         No hay proveedores aún                   │
│   Crea tu primer proveedor para empezar         │
│                                                  │
│           [+ Crear proveedor]                    │
└─────────────────────────────────────────────────┘
```

### 2. SupplierDialog - Visual Layout (SIMPLIFICADO como Square)

```
┌────────────────────────────────────────────────────────┐
│ Crear Proveedor                               [X]       │
├────────────────────────────────────────────────────────┤
│                                                          │
│ Nombre del proveedor *                                  │
│ ┌────────────────────────────────────────────┐         │
│ │ ACME Corp                                  │         │
│ └────────────────────────────────────────────┘         │
│                                                          │
│ Número de cuenta (opcional)                            │
│ ┌────────────────────────────────────────────┐         │
│ │ ACC-12345                                  │         │
│ └────────────────────────────────────────────┘         │
│                                                          │
│ Notas del proveedor (opcional)                         │
│ ┌────────────────────────────────────────────┐         │
│ │ Proveedor principal de harinas             │         │
│ │                                            │         │
│ └────────────────────────────────────────────┘         │
│                                                          │
│ Teléfono (opcional)        Email (opcional)            │
│ ┌─────────────────────┐  ┌─────────────────────┐      │
│ │ +1 555-1234         │  │ juan@acme.com       │      │
│ └─────────────────────┘  └─────────────────────┘      │
│                                                          │
│ Código postal (opcional)                                │
│ ┌────────────────────────────────────────────┐         │
│ │ 12345                                      │         │
│ └────────────────────────────────────────────┘         │
│                                                          │
│                          [Cancelar] [Guardar]           │
└────────────────────────────────────────────────────────┘
```

**Dialog Specs (inspirado en Square):**

- Width: `max-w-xl` (más compacto)
- **SIN tabs**: Todo en una sola pantalla
- Form: React Hook Form con Zod validation
- **Solo 1 campo requerido**: Nombre del proveedor (\*)
- Todos los demás campos opcionales
- Buttons: Cancel (outline), Guardar (primary)
- Auto-focus en campo "Nombre" al abrir

**Campos incluidos (como Square):**

1. ✅ Nombre del proveedor (REQUERIDO)
2. ✅ Número de cuenta (opcional)
3. ✅ Notas del proveedor (textarea, opcional)
4. ✅ Teléfono (opcional)
5. ✅ Email (opcional)
6. ✅ Código postal (opcional)

**Campos eliminados (futuro opcional):**

- ❌ Dirección completa (solo ZIP code)
- ❌ Lead Time Days
- ❌ Minimum Order
- ❌ Tax ID
- ❌ Rating
- ❌ Reliability Score
- ❌ Sitio web

### 3. PurchaseOrdersPage - Visual Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ Pedidos de Compra                              [+ Crear pedido]   │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│ [Todos] [DRAFT] [PENDING_APPROVAL] [SENT] [RECEIVED] ...         │
│  (pills de filtro - similar a Orders.tsx)                        │
│                                                                    │
│ [Proveedor: Todos ▼]  [Desde: __/__/__]  [Hasta: __/__/__]      │
│                                                                    │
├──────────┬──────────┬────────┬──────────┬─────────┬──────────┤
│ PO #     │ Proveedor│ Estado │  Items   │  Total  │ Acciones │
├──────────┼──────────┼────────┼──────────┼─────────┼──────────┤
│ PO20250119│ ACME    │[SENT]  │ 5 items  │ $1,250  │   ⋮      │
│ -001     │ Corp     │ purple │          │         │          │
├──────────┼──────────┼────────┼──────────┼─────────┼──────────┤
│ PO20250118│ Global  │[DRAFT] │ 3 items  │  $750   │   ⋮      │
│ -005     │ Foods    │  gray  │          │         │          │
└──────────┴──────────┴────────┴──────────┴─────────┴──────────┘
```

**Filter Pills (siguiendo patrón de Orders.tsx):**

- Orden: Sigue el orden de las columnas de la tabla
- Estilo: Badge outline, con X para remover
- Layout: `flex flex-wrap gap-2` antes de la tabla
- Colores: Match con badge colors de la tabla

**Empty State por Filtro:**

```
┌─────────────────────────────────────────────────┐
│              [Receipt icon]                      │
│                                                  │
│    No se encontraron pedidos con estos filtros  │
│         Intenta ajustar los filtros             │
│                                                  │
│           [Limpiar filtros]                      │
└─────────────────────────────────────────────────┘
```

### 4. PurchaseOrderWizard - Visual Layout

**Step 1: Seleccionar Proveedor**

```
┌────────────────────────────────────────────────────────┐
│ Crear Pedido de Compra                       [X]       │
├────────────────────────────────────────────────────────┤
│                                                          │
│ ● Proveedor    ○ Artículos    ○ Confirmar              │
│                                                          │
│                                                          │
│ Selecciona un proveedor                                │
│ ┌────────────────────────────────────────────┐         │
│ │ [Handshake] ACME Corp                      │         │
│ │             juan@acme.com | +1 555-1234    │         │
│ └────────────────────────────────────────────┘         │
│                                                          │
│ ┌────────────────────────────────────────────┐         │
│ │ [Handshake] Global Foods                   │         │
│ │             maria@global.com | +1 555-5678 │         │
│ └────────────────────────────────────────────┘         │
│                                                          │
│ ┌────────────────────────────────────────────┐         │
│ │ [Handshake] Fresh Produce Inc.             │         │
│ │             info@fresh.com | +1 555-9012   │         │
│ └────────────────────────────────────────────┘         │
│                                                          │
│                          [Cancelar] [Siguiente →]       │
└────────────────────────────────────────────────────────┘
```

**Step 2: Agregar Artículos**

```
┌────────────────────────────────────────────────────────┐
│ Crear Pedido de Compra                       [X]       │
├────────────────────────────────────────────────────────┤
│                                                          │
│ ● Proveedor    ● Artículos    ○ Confirmar              │
│                                                          │
│ Proveedor: ACME Corp                                    │
│                                                          │
│ Ubicación de punto de venta (opcional)                 │
│ ┌────────────────────────────────────────────┐         │
│ │ [Dropdown: Seleccionar ubicación]         │         │
│ └────────────────────────────────────────────┘         │
│                                                          │
│ ┌──────────────┬────────┬──────────┬──────────┬──┐    │
│ │ Artículo     │ Cant.  │ Precio   │ Subtotal │  │    │
│ ├──────────────┼────────┼──────────┼──────────┼──┤    │
│ │[🔍] Harina   │   50   │  $2.50   │ $125.00  │🗑│    │
│ │              │  kg    │  /kg     │          │  │    │
│ ├──────────────┼────────┼──────────┼──────────┼──┤    │
│ │[🔍] Azúcar   │   30   │  $1.80   │  $54.00  │🗑│    │
│ │              │  kg    │  /kg     │          │  │    │
│ └──────────────┴────────┴──────────┴──────────┴──┘    │
│                                                          │
│ [+ Agregar artículo]                                    │
│                                                          │
│                     Subtotal: $179.00                   │
│                          IVA: $28.64                    │
│                        Total: $207.64                   │
│                                                          │
│                    [← Anterior] [Siguiente →]           │
└────────────────────────────────────────────────────────┘
```

**Step 3: Confirmar**

```
┌────────────────────────────────────────────────────────┐
│ Crear Pedido de Compra                       [X]       │
├────────────────────────────────────────────────────────┤
│                                                          │
│ ● Proveedor    ● Artículos    ● Confirmar              │
│                                                          │
│ Resumen del Pedido                                      │
│                                                          │
│ ┌────────────────────────────────────────────┐         │
│ │ Proveedor: ACME Corp                       │         │
│ │ Email: juan@acme.com                       │         │
│ │ Teléfono: +1 555-1234                      │         │
│ └────────────────────────────────────────────┘         │
│                                                          │
│ Artículos:                                              │
│ • Harina - 50 kg × $2.50 = $125.00                     │
│ • Azúcar - 30 kg × $1.80 = $54.00                      │
│                                                          │
│ ┌────────────────────────────────────────────┐         │
│ │                      Subtotal: $179.00     │         │
│ │                          IVA: $28.64       │         │
│ │                  ────────────────────       │         │
│ │                        Total: $207.64      │         │
│ └────────────────────────────────────────────┘         │
│                                                          │
│ Notas (opcional)                                        │
│ ┌────────────────────────────────────────────┐         │
│ │                                            │         │
│ └────────────────────────────────────────────┘         │
│                                                          │
│     [← Anterior] [Guardar Borrador] [Enviar Pedido]    │
└────────────────────────────────────────────────────────┘
```

**Wizard Specs:**

- Width: `max-w-3xl`
- Steps indicator: Dots con líneas conectoras, estado actual destacado
- Navigation: Anterior (outline), Siguiente/Guardar (primary)
- Artículo autocomplete: Combobox con búsqueda fuzzy
- Precio auto-fill: Si existe SupplierPricing, llena automáticamente
- Delete row: Icon button con Trash2, hover muestra tooltip
- Calculations: Real-time update al cambiar cantidades o precios

### 5. PurchaseOrderDetailPage - Visual Layout

```
┌──────────────────────────────────────────────────────────────┐
│ [← Atrás]  Pedido #PO20250119-001            [SENT purple]   │
│            Proveedor: ACME Corp                              │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│ Estado del Pedido                                             │
│                                                                │
│ DRAFT ──● PENDING ──● APPROVED ──● SENT ──○ CONFIRMED ──○   │
│                                    ▲                          │
│                              (estás aquí)                     │
│                                                                │
│ ┌────────────────────────────────────────────────────┐       │
│ │ 📋 Información General                              │       │
│ ├────────────────────────────────────────────────────┤       │
│ │ Fecha de Orden: 19 Ene 2025                        │       │
│ │ Fecha Esperada: 26 Ene 2025 (7 días)               │       │
│ │ Creado por: admin@avoqado.com                      │       │
│ └────────────────────────────────────────────────────┘       │
│                                                                │
│ ┌────────────────────────────────────────────────────┐       │
│ │ 📦 Artículos                                        │       │
│ ├──────────┬─────────┬──────────┬────────┬─────────┤       │
│ │ Material │ Ordenado│ Recibido │ Precio │  Total  │       │
│ ├──────────┼─────────┼──────────┼────────┼─────────┤       │
│ │ Harina   │ 50 kg   │  0 kg    │ $2.50  │ $125.00 │       │
│ │ Azúcar   │ 30 kg   │  0 kg    │ $1.80  │  $54.00 │       │
│ └──────────┴─────────┴──────────┴────────┴─────────┘       │
│                                                                │
│                              Subtotal: $179.00                │
│                                  IVA: $28.64                  │
│                                Total: $207.64                 │
│ └────────────────────────────────────────────────────┘       │
│                                                                │
│                    [Marcar como Confirmada]                   │
└──────────────────────────────────────────────────────────────┘
```

**Timeline Component Specs:**

- States: Circles with connecting lines
- Completed: Filled circle, green, CheckCircle2 icon
- Current: Filled circle, primary color, pulsing animation
- Pending: Outlined circle, gray
- Line: Solid if completed, dashed if pending
- Responsive: Horizontal on desktop, vertical on mobile
- Tooltip: Hover shows timestamp and user who performed action

**Action Buttons por Estado:**

- Position: Bottom right, `flex gap-2`
- DRAFT: Editar (outline), Enviar a Aprobación (primary), Eliminar (destructive)
- PENDING_APPROVAL: Aprobar (primary), Rechazar (destructive)
- APPROVED: Enviar a Proveedor (primary)
- SENT: Marcar como Confirmada (primary)
- CONFIRMED: Marcar como Enviada (primary)
- SHIPPED: Recibir Orden (primary, lg size)
- PARTIALLY_RECEIVED: Recibir Resto (primary)

### 6. ReceiveOrderDialog - Visual Layout (SIMPLIFICADO como Square)

```
┌────────────────────────────────────────────────────────┐
│ Recibir Orden #PO20250119-001                [X]       │
├────────────────────────────────────────────────────────┤
│                                                          │
│ Ajusta las cantidades recibidas                        │
│                                                          │
│ ┌──────────────┬────────────┬──────────────┐          │
│ │ Material     │  Ordenado  │   Recibir    │          │
│ ├──────────────┼────────────┼──────────────┤          │
│ │ Harina       │   50 kg    │  [  50  ]    │          │
│ │              │            │              │          │
│ ├──────────────┼────────────┼──────────────┤          │
│ │ Azúcar       │   30 kg    │  [  30  ]    │          │
│ │              │            │              │          │
│ └──────────────┴────────────┴──────────────┘          │
│                                                          │
│ ℹ️ El stock se actualizará automáticamente              │
│                                                          │
│                      [Cancelar] [Guardar]               │
└────────────────────────────────────────────────────────┘
```

**Dialog Specs (inspirado en Square):**

- Width: `max-w-2xl` (más compacto)
- Tabla simple: Solo 3 columnas (Material, Ordenado, Recibir)
- Number inputs: `w-24`, auto-focus en primera fila
- Default values: Cantidad ordenada pre-filled (como Square)
- Validation: Cantidad recibida ≤ cantidad ordenada
- Info banner: Light blue, con icono Info
- Botones:
  - Cancelar: outline, cancela sin guardar
  - Guardar: primary, recibe las cantidades ingresadas

**Comportamiento:**

1. Al abrir dialog, todas las cantidades están pre-filled con lo ordenado
2. Usuario puede ajustar a la baja si recibió menos
3. Click "Guardar" → Backend:
   - Crea StockBatch automático (con costo de la orden)
   - Incrementa currentStock
   - Actualiza quantityReceived
   - Cambia status a RECEIVED o PARTIALLY_RECEIVED

**Campos eliminados (futuro opcional):**

- ❌ Costo real (usa el de la orden)
- ❌ Batch/Lote number (auto-generado)
- ❌ Fecha de expiración (opcional después)
- ❌ Botón "Recibir Todo" (ya viene pre-filled)

### 7. Dropdown Menu Actions (Como Square)

**Opciones del menú de 3 puntos (⋮) en cada Purchase Order:**

```
┌────────────────────────────────┐
│ Detalles                       │
│ Duplicar                       │
│ Enviar como correo electrónico │
│ Guardar como PDF               │
│ Guardar como archivo CSV       │
│ Cancelar pedido                │
└────────────────────────────────┘
```

#### 7.1 Detalles

- Navega a PurchaseOrderDetailPage
- **Estado:** ✅ Ya implementado en el plan

#### 7.2 Duplicar

- Copia todos los datos del PO actual
- Crea nuevo PO en estado DRAFT
- Mismo proveedor, mismos items, mismas cantidades
- Usuario puede editar antes de enviar
- **Estado:** 📝 Agregar a implementación

#### 7.3 Enviar como correo electrónico

- Dialog modal con preview del correo
- Campos: Para (supplier email pre-filled), CC, Asunto, Mensaje
- Adjunto automático: PDF de la orden
- Botón "Send" para enviar email al proveedor
- **Requiere:** Email del proveedor configurado
- **Backend:** Servicio SMTP + generación PDF
- **Estado:** ✅ FASE 1 - Implementar ahora

**Email automático al cambiar a SENT:**

- Al hacer click en "Enviar a Proveedor" (APPROVED → SENT)
- Mostrar confirmation dialog:

  ```
  ¿Enviar email al proveedor?

  Se enviará un email a juan@acme.com con la orden adjunta en PDF.

  [ ] Recordar mi preferencia (no preguntar de nuevo)

  [No enviar]  [Enviar email]
  ```

- Si usuario marca checkbox "Recordar preferencia":
  - Guardar en localStorage o user settings
  - Próximas veces aplicar preferencia automáticamente
- Si supplier no tiene email configurado:
  - Skip confirmation, cambiar estado directamente

#### 7.4 Guardar como PDF

- Genera PDF de la orden con logo del venue
- Incluye: PO number, supplier info, items table, totals, fecha
- Descarga automáticamente al navegador
- Nombre archivo: `PO-{orderNumber}-{venueName}.pdf`
- **Librería:** jsPDF o react-pdf
- **Estado:** ✅ FASE 1 - Implementar ahora

#### 7.5 Guardar como archivo CSV

- Exporta items de la orden en formato CSV
- Columnas: Material, Cantidad Ordenada, Precio Unitario, Subtotal
- Útil para importar a Excel/Google Sheets
- Nombre archivo: `PO-{orderNumber}-items.csv`
- **Estado:** ✅ FASE 1 - Implementar ahora

#### 7.6 Cancelar pedido

- Cambia status a CANCELLED
- Solo permitido desde: DRAFT, PENDING_APPROVAL, APPROVED, SENT
- Requiere razón de cancelación (textarea)
- **Estado:** ✅ Ya implementado en workflow

### 8. Print Labels Feature (Premium - Futuro)

**Como Square Premium:**

- Después de recibir orden, opción "Print Labels"
- Genera etiquetas con código de barras para cada batch
- Requiere integración con impresora de etiquetas
- Solo disponible en plan Premium de Square

**NO implementar ahora** - documentado solo como referencia

### 9. Responsive Behavior

**Mobile (< 768px):**

- Tables: Horizontal scroll with sticky first column
- Filters: Stack vertically with full width
- Dialogs: Full screen on mobile
- Timeline: Vertical orientation
- Create buttons: Full width below title

**Tablet (768px - 1024px):**

- Tables: All columns visible
- Filters: 2 columns grid
- Dialogs: `max-w-2xl` centered
- Sidebar: Collapsible with hamburger menu

**Desktop (> 1024px):**

- Full layout as shown in mockups
- Sidebar: Always visible
- Hover states: Show actions on row hover
- Tooltips: Rich information on hover
