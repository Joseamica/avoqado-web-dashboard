# Order Drawer — Square-Style Redesign

**Status:** Approved design, ready for implementation plan
**Author:** Jose Antonio Amieva (with Claude)
**Date:** 2026-04-19
**Repos affected:**
- `avoqado-server` (small backend extensions to `getOrderById`)
- `avoqado-web-dashboard` (drawer body rewrite)

---

## 1. Problem

The current order detail drawer (`src/pages/Order/OrderId.tsx` rendered inside a Sheet from `Orders.tsx`) presents order information in a dense 2-column card layout (timeline + 3 collapsible sections + sidebar with status / financial summary / customer / info cards).

The user wants the layout to match Square's clean, single-column receipt-style drawer: header with close + print + actions, title (`Recibo n.° XXX`) with status pills, then linear sections — **Detalles**, **Artículos**, **Pagos**, **Actividad**.

The 3-dot actions menu in Square opens a small sheet with two actions: "Ver la información de la transacción" (navigates to the payment drawer) and "Enviar recibo".

The drawer infrastructure (`<Sheet>` mounted in `Orders.tsx` triggered by URL `/orders/:orderId`) **already exists** and is **kept as-is** — only the body rendered inside it is replaced.

---

## 2. Goals & Non-goals

### Goals
- Replace the current dense order drawer body with a Square-style single-column layout while preserving theme support (dark + light).
- Surface all available order data (Detalles, Artículos, Pagos, Actividad) including refunds and an audit-grade activity timeline.
- Keep the 3-dot menu pattern: tapping it opens an actions sheet (Ver transacción / Enviar recibo) that bridges to the existing `PaymentDrawer` and the existing `send-receipt` endpoint.
- Add small backend extensions to `getOrderById` so the frontend has all the data it needs in one query.

### Non-goals
- No new database migrations or models.
- No new HTTP endpoints (send-receipt and DigitalReceipt endpoints already exist).
- No "Canal" field (user explicitly excluded — venue name is implicit context, not a per-row field).
- No changes to the order list page (`Orders.tsx`) other than removing the import of the deprecated `OrderId.tsx`.
- The deprecated `OrderId.tsx` is removed (no `@deprecated` zombie kept).

---

## 3. Backend changes (avoqado-server)

All changes are in `src/services/dashboard/order.dashboard.service.ts` inside `getOrderById`. **Zero migrations. Zero new endpoints. Zero new models.**

### 3.1 Extend `include` in `getOrderById`

Add to the existing query:

```ts
include: {
  // ... existing includes (createdBy, servedBy, table, items, orderCustomers, etc.)
  terminal: true,                              // NEW — for "Punto de venta"
  actions: {                                   // NEW — for "Actividad" audit log
    include: { performedBy: true },
    orderBy: { createdAt: 'asc' },
  },
  payments: {
    orderBy: { createdAt: 'asc' },             // NEW — chronological order
    include: {
      processedBy: true,                       // existing
      saleVerification: true,                  // existing
      receipts: true,                          // NEW — DigitalReceipt for "Mostrar más → Recibo"
    },
  },
}
```

### 3.2 Refund mapper (post-query, in service)

Refunds are stored as `Payment` rows with `type === 'REFUND'` and `processorData.originalPaymentId` (no FK column). The frontend should not parse `processorData`.

After the Prisma query, add a mapper that, for each payment:

- If `payment.type === 'REFUND'`:
  - Extract `originalPaymentId` from `payment.processorData.originalPaymentId` and expose as `payment.originalPaymentId` (top-level).
  - Extract `refundReason` from `payment.processorData.refundReason` and expose as `payment.refundReason` (top-level).
- For all payments, expose a derived `payment.refunds: Array<{ id, amount, createdAt, refundReason }>` containing the refund payments that point back to it (matched by scanning the same order's payments where `originalPaymentId === payment.id`).

This is a pure read-side transform (~15 lines). It does not touch the DB, does not modify the schema, and is fully backward-compatible — existing fields are unchanged.

### 3.3 Backend tests

- Update existing `getOrderById` unit/integration tests (if any) to assert the new fields are present.
- Add a focused unit test that:
  - Creates an order with 1 original payment + 1 refund payment.
  - Calls `getOrderById`.
  - Asserts `refund.originalPaymentId === original.id`, `refund.refundReason === '<reason>'`, and `original.refunds[0].id === refund.id`.

---

## 4. Frontend changes (avoqado-web-dashboard)

### 4.1 Files

| File | Change | Purpose |
|---|---|---|
| `src/pages/Order/OrderId.tsx` | **Delete** | Replaced — was already deprecated and only used inside the drawer |
| `src/pages/Order/OrderDrawerContent.tsx` | **New** | Body rendered inside the existing `<Sheet>` in `Orders.tsx`. Mirrors `PaymentDrawerContent.tsx` pattern. |
| `src/pages/Order/components/OrderActionsSheet.tsx` | **New** | Sheet/dialog opened by the 3-dot menu. Contains the two actions. |
| `src/pages/Order/components/sections/DetailsSection.tsx` | **New** | "Detalles" key-value list |
| `src/pages/Order/components/sections/ItemsSection.tsx` | **New** | "Artículos" + totals block |
| `src/pages/Order/components/sections/PaymentsSection.tsx` | **New** | "Pagos" with collapsible "Mostrar más" rows |
| `src/pages/Order/components/sections/ActivitySection.tsx` | **New** | "Actividad" vertical timeline |
| `src/pages/Order/Orders.tsx` | **Edit** | Replace `import OrderId from './OrderId'` with `import OrderDrawerContent from './OrderDrawerContent'`; replace `<OrderId />` with `<OrderDrawerContent orderId={drawerOrderId} onClose={...} />` |
| `src/locales/es/orders.json` + `en/orders.json` | **Edit** | Add new i18n keys for sections / activity events / actions sheet |
| `src/services/order.service.ts` | **Edit** | If needed, expand the type for the `getOrder` return to include `terminal`, `actions`, `payments[].receipts`, `payments[].originalPaymentId`, `payments[].refundReason`, `payments[].refunds` |
| `src/types/index.ts` (or wherever `Order` lives) | **Edit** | Same — extend the `Order`, `Payment` types |

The drawer **infrastructure** (Sheet, route, drawerOrderId param, navigate to close) stays as-is in `Orders.tsx`.

### 4.2 Component contract — `OrderDrawerContent`

```ts
interface OrderDrawerContentProps {
  orderId: string
  onClose: () => void
  venueTimezone: string
}
```

Internally:
1. `useQuery(['order', venueId, orderId], () => orderService.getOrder(venueId, orderId))`
2. Loading skeleton (matches Square's quiet loading: a few gray bars, not a spinner card explosion)
3. Error / not-found state with "Volver a pedidos" button
4. On success, render Header + 4 sections in order

### 4.3 Header

```
┌─────────────────────────────────────────┐
│ [X]                       [🖨] [⋯]      │  sticky top, bg-background, border-b
├─────────────────────────────────────────┤
│ Recibo n.° {formatOrderNumber}          │  text-2xl font-semibold
│ [Completado] [Pagada] [Dine In]         │  status pills (existing color logic ok)
└─────────────────────────────────────────┘
```

- `[X]` — closes the drawer (`onClose()` → navigates back to `/orders`)
- `[🖨]` — calls `window.print()`. CSS `@media print` rule (added to `index.css` or scoped) hides the Sheet wrapper, header chrome, and the Orders list behind the drawer; shows only the drawer body.
- `[⋯]` — opens `OrderActionsSheet` (only enabled if `order.payments.length > 0`)

### 4.4 Section 1 — Detalles

A simple 2-column grid (label left muted, value right). Each row only renders if the source field has a value.

| Label (i18n) | Source | Render condition |
|---|---|---|
| Email | `order.customerEmail ?? customer.email` | truthy |
| Teléfono | `order.customerPhone ?? customer.phone` | truthy |
| Cliente | `customer.firstName + ' ' + customer.lastName` (link to customer detail if route exists) | has linked customer |
| Fecha de creación | `order.createdAt` formatted as `"d 'de' LLL yyyy, HH:mm"` in `venueTimezone` | always |
| Origen | `order.source` translated via `t('orders:sources.{source}')` (TPV → "TPV", QR → "QR Cliente", AVOQADO_IOS → "Avoqado iOS", AVOQADO_ANDROID → "Avoqado Android", PHONE → "Por teléfono", POS → "POS", PAYMENT_LINK → "Link de pago", WEB → "Web", APP → "App", KIOSK → "Kiosko") | always |
| Punto de venta | `order.terminal.name` | has terminal |
| Mesa | `order.table.number` | has table |
| Mesero | `(order.servedBy ?? order.createdBy).firstName + lastName` | has staff |
| Tipo | `order.type` badge (existing `getOrderTypeConfig` color logic) | always |

### 4.5 Section 2 — Artículos

Each item row:
```
[img]  Producto Name x {qty}              $total
       SKU: {sku}                  ($unitPrice c/u si qty>1)
       • Modifier name (+$price)
```

- Image: `item.product.image` if present (32x32 rounded). If not, gray square with first 2 letters of product name uppercase.
- **Item-level refund indicator is out of scope for v1.** Reasoning: detecting which items in a refund requires correlating `payment.processorData.refundedItems` against `OrderItem.id`s, and the existing data shape is inconsistent (some refunds are full-amount with no item breakdown). The Pagos section makes the refund itself fully visible — that's enough for v1.
- Custom items (no productId): show "Importe personalizado" with `Cu` initials icon (matches Square).

After the items list, a totals block:
```
Subtotal              $X.XX
Descuento  (if > 0)  -$X.XX
Impuestos             $X.XX
Propina               $X.XX
─────────────────
Total                 $X.XX     ← bold, larger
```

### 4.6 Section 3 — Pagos

Each payment is a row with collapsed cabecera + expandable "Mostrar más".

**Cabecera (always visible):**
- Icon (left): card brand SVG via `getIcon`, or `Banknote` (cash), or `Wallet` (digital), or `↩` for refunds (red tint)
- Label: `Visa ····1111` if cardBrand+maskedPan, else translated `t('payment:methods.{method}')`. For refunds, label is **"Reembolso"** in red.
- Date: `formatDateShort` (e.g. "17 abr, 11:35")
- Amount (right): `Currency(amount + tipAmount)`. Refunds: prefix `-` and red color.
- Status pill (right of amount): "Completado" / "Pagado" / "Fallido" using `payment.status` (existing color logic ok)

**"Mostrar más" expanded content (Square calls it "Mostrar detalles"):**
- For **regular payments**:
  - Recibo: link to `/r/{receipt.accessKey}` (using `payment.receipts[0]` if exists). Opens in new tab.
  - Cliente: customer linked to this payment (via order's customer)
  - Procesado por: `payment.processedBy.firstName + lastName`
  - Authorization #: `payment.authorizationNumber`
  - Reference #: `payment.referenceNumber`
  - Method details: `payment.entryMode` (CONTACTLESS, CHIP, etc.) translated
- For **refund payments**:
  - Motivo: `payment.refundReason`
  - Recibo: link to `/r/{receipt.accessKey}` of the refund (if exists)
  - Pago original: link to `/payments/{payment.originalPaymentId}` (opens PaymentDrawer)

Use the existing `<Collapsible>` from shadcn/ui to match dashboard conventions.

### 4.7 Section 4 — Actividad

Vertical timeline (single column, left-aligned line connecting circle nodes). Frontend builds the event list by combining sources — **all done client-side, no new backend endpoint**.

Event sources, sorted ascending by timestamp:

| Event | Source | Icon | Description (i18n) |
|---|---|---|---|
| Pedido creado | `order.createdAt` | `FileText` | "Pedido creado" + `createdBy` name |
| N artículos añadidos | `orderItems` grouped by `createdAt` rounded to minute | `Plus` | "Se han {count} artículos añadidos" — expandable: list product names + qty |
| Acción de staff | `order.actions[]` (each one) | `AlertCircle` (or per-action icon) | "{actionType}: {reason}" — by `performedBy` |
| Pago procesado | `payments[]` where `type !== 'REFUND'` | `CreditCard` | "Pago de {amount} con {method/brand}" |
| Reembolso emitido | `payments[]` where `type === 'REFUND'` | `RotateCcw` | "Reembolso emitido: {amount}" — expandable: shows `refundReason` |
| Pedido completado | `order.completedAt` (if present) | `CheckCircle2` | "Pedido completado" |

Each timeline node: 24px circle with icon, vertical connector line below (except last), text block on the right with description, timestamp, and optional expandable detail.

### 4.8 OrderActionsSheet (3-dot menu target)

```
┌─────────────────────────────────┐
│ [X]            Acciones         │
├─────────────────────────────────┤
│  ┌───────────────────────────┐  │
│  │ Ver la información de     │  │
│  │ la transacción            │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Enviar recibo             │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

Implemented as a centered `<Dialog>` (shadcn/ui) on all viewports — matches Square's modal feel and avoids stacking another Sheet over the existing order Sheet.

**"Ver la información de la transacción":**
- If `order.payments.length === 1` → `navigate(\`${fullBasePath}/payments/${payments[0].id}\`)`. The existing PaymentDrawer mounts on top of the OrderDrawer. Both stay in the URL stack so closing the payment drawer returns to the order drawer.
- If `order.payments.length > 1` → swap the sheet content for a list of payments (`Visa ····1111 — $25` etc.) and navigate on click.
- If `order.payments.length === 0` → action is disabled (whole sheet doesn't open; 3-dot menu is hidden or disabled at the header level).

**"Enviar recibo":**
- If 1 payment → swap to email input pre-filled with `order.customerEmail`, "Enviar" button calls `POST /api/v1/dashboard/venues/{venueId}/payments/{paymentId}/send-receipt`.
- If multiple → first ask which payment, then show input.
- Toast on success/error (reuse existing translations from `payment.detail.toast.receiptSentTitle`).

### 4.9 Print

Add to `index.css` (or a dedicated `print.css` imported globally):

```css
@media print {
  /* Hide everything except the drawer body */
  body > *:not([data-print-root]) { display: none !important; }
  [data-print-root] {
    position: static !important;
    width: 100% !important;
    max-width: 100% !important;
    box-shadow: none !important;
    border: none !important;
  }
  /* Hide drawer chrome (close, print, ⋯ buttons) inside the drawer */
  [data-print-hide] { display: none !important; }
}
```

`OrderDrawerContent` renders its outer container with `data-print-root`, and the header action buttons get `data-print-hide`.

The Print button calls `window.print()`.

### 4.10 i18n keys (new — both `es` and `en`)

Under `orders.json`:

```json
{
  "drawer": {
    "title": "Recibo n.° {{number}}",
    "actions": {
      "print": "Imprimir",
      "more": "Más acciones",
      "close": "Cerrar",
      "viewTransaction": "Ver la información de la transacción",
      "sendReceipt": "Enviar recibo",
      "selectPayment": "Selecciona un pago"
    },
    "sections": {
      "details": "Detalles",
      "items": "Artículos",
      "payments": "Pagos",
      "activity": "Actividad"
    },
    "details": {
      "email": "Email",
      "phone": "Teléfono",
      "customer": "Cliente",
      "createdAt": "Fecha de creación",
      "source": "Origen",
      "terminal": "Punto de venta",
      "table": "Mesa",
      "server": "Mesero",
      "type": "Tipo"
    },
    "sources": {
      "TPV": "TPV",
      "KIOSK": "Kiosko",
      "QR": "QR Cliente",
      "WEB": "Web",
      "APP": "App",
      "AVOQADO_IOS": "Avoqado iOS",
      "AVOQADO_ANDROID": "Avoqado Android",
      "PHONE": "Por teléfono",
      "POS": "POS",
      "PAYMENT_LINK": "Link de pago"
    },
    "items": {
      "perUnit": "c/u",
      "customAmount": "Importe personalizado",
      "refunded": "Reembolsado"
    },
    "totals": {
      "subtotal": "Subtotal",
      "discount": "Descuento",
      "tax": "Impuestos",
      "tip": "Propina",
      "total": "Total"
    },
    "payments": {
      "showMore": "Mostrar más",
      "showLess": "Ocultar detalles",
      "refund": "Reembolso",
      "receipt": "Recibo",
      "originalPayment": "Pago original",
      "processedBy": "Procesado por",
      "authorization": "Autorización",
      "reference": "Referencia",
      "reason": "Motivo"
    },
    "activity": {
      "created": "Pedido creado",
      "itemsAdded_one": "Se ha añadido {{count}} artículo",
      "itemsAdded_other": "Se han añadido {{count}} artículos",
      "paymentProcessed": "Pago de {{amount}} con {{method}}",
      "refundIssued": "Reembolso emitido: {{amount}}",
      "completed": "Pedido completado",
      "showDetails": "Mostrar detalles",
      "hideDetails": "Ocultar detalles"
    }
  }
}
```

---

## 5. Theme

Both light and dark theme must work. The design uses semantic Tailwind tokens already present in the dashboard (`bg-background`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`, `text-destructive`, `text-success`, `text-primary`). No hard-coded colors. Status pills reuse the existing `getOrderStatusConfig` and `getOrderTypeConfig` helpers (move them out of `OrderId.tsx` into a shared `src/utils/orderStatus.ts` since the file is being deleted).

---

## 6. Edge cases

- **Order with 0 payments** (open ticket): "Pagos" section shows empty state ("Sin pagos registrados"); 3-dot menu hides the actions sheet (or shows disabled).
- **Order with only refunds** (fully refunded): show all payments — refunds clearly tagged in red; total shows the original amount.
- **Custom items** (no `productId`): render with `Cu` initials and "Importe personalizado" label.
- **Missing customer email when sending receipt**: input is empty, user types it; mutation requires non-empty email.
- **Long product names / SKUs**: truncate with `line-clamp-2` and tooltip on hover.
- **Many activity events** (>10): no virtualization in v1; shows all. Most orders have <15 events.
- **Print on dark theme**: print CSS forces light colors (`color: black; background: white`) inside `[data-print-root]` to avoid wasting ink.
- **Orphan refund** (refund Payment whose `originalPaymentId` doesn't match any payment in the order): still rendered in Pagos as "Reembolso" with no original-payment link.

---

## 7. Out of scope (explicit)

- Editing the order from the drawer (existing `Orders.tsx` table edit dialogs are unchanged)
- Deleting the order (the existing trash icon / delete flow is dropped from the drawer header — was buried in old `OrderId.tsx`. If user needs delete, they use the row menu in the table.)
- Tip percentage badge on header (current dense layout had it; Square doesn't and the data is always visible in the totals block)
- Verification photos section (currently a separate collapsible in `OrderId.tsx`). For v1, **drop it from the drawer** — verification photos are payment-scoped and live in the existing PaymentDrawer's "Mostrar más" or in a dedicated payment view. If the product later requires it back at the order level, add a 5th "Verificación" section.

---

## 8. Testing

### Backend
- Unit: refund mapper correctly extracts `originalPaymentId` and `refundReason`.
- Integration: `getOrderById` returns `terminal`, `actions`, `payments[].receipts`, `payments[].refunds[]`.
- Regression: existing fields unchanged; existing tests still pass.

### Frontend
- Unit: `OrderDrawerContent` renders all sections with mocked order data.
- Unit: timeline event builder produces correct events for: order with 1 item / 1 payment, order with split payments, order with refunds, order with COMP action.
- Visual sanity: dark + light theme screenshots side-by-side.
- Manual: open drawer, expand each section, click "Mostrar más" on a refund, click "Ver transacción" → confirms PaymentDrawer opens on top, click X on payment drawer → returns to order drawer, click X on order drawer → returns to list.
- Print: `window.print()` shows only the drawer body.

---

## 9. Migration / Cleanup

- Delete `src/pages/Order/OrderId.tsx` after `OrderDrawerContent.tsx` ships and `Orders.tsx` is updated.
- Move `getOrderStatusConfig` and `getOrderTypeConfig` from `OrderId.tsx` to `src/utils/orderStatus.ts` before deletion.
- No DB migration. No deprecation period needed (the file was already marked `@deprecated` and only used inside the drawer).

---

## 10. Rollout

Single PR per repo:
1. **avoqado-server PR** first: extends `getOrderById`, adds refund mapper, adds tests. Backwards-compatible (only adds fields).
2. **avoqado-web-dashboard PR** after server is deployed: replaces drawer body, deletes `OrderId.tsx`, updates `Orders.tsx`, adds i18n keys.

No feature flag needed — the change is contained to one already-existing UI surface (the drawer over the orders list).
