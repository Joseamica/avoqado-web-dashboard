# TPV Shop — Stripe Checkout + SPEI con verificación manual

**Fecha**: 2026-05-28
**Owner**: Jose Amieva
**Repos afectados**: `avoqado-web-dashboard`, `avoqado-server`
**Status**: Design — Pendiente de aprobación

## Contexto y motivación

Hoy el wizard "Comprar Terminal" en `/venues/:slug/tpv` es 100% demo:
- Solo permite **PAX A910S** a USD $349.
- El "pago" es mock (`mock_tok_${Date.now()}`), con un banner amarillo "demo mode".
- Crea N records `Terminal` en estado `PENDING_ACTIVATION` directamente, antes incluso de cobrar.
- Tiene 3 opciones de pago en el wizard (tarjeta / transferencia / saldo), todas falsas.

Necesitamos:

1. Vender **3 modelos** reales con precios en MXN + IVA: PAX A910S ($4,000 + IVA), NexGo N62 ($1,800 + IVA), NexGo N86 ($3,000 + IVA).
2. **Cobro real** con Stripe Checkout (tarjeta) y SPEI (transferencia con comprobante).
3. **Eliminar** "Saldo a la cuenta" (irreal).
4. Mostrar **specs físicas** de cada modelo (dimensiones, batería, conectividad).
5. Cuando hay pago confirmado, notificar a `sales@avoqado.io` y permitir que sales **asigne números de serie** (vía magic-link en email o desde superadmin UI), que aparecen en la lista de TPV del venue.
6. Para SPEI: cliente sube comprobante → email a sales con adjunto + botones `Aprobar`/`Rechazar` directo en el correo. El cliente puede ver el estado de su pedido en una pestaña "Pedidos" en `/tpv`.
7. Todos los emails usan el **template visual existente** (estilo Stripe minimal, isotipo Avoqado, max-width 600, gray-bordered boxes).

## Decisiones tomadas (4 preguntas + 3 preguntas)

1. **Modelo de datos**: nuevo `TerminalOrder` (no JSON en `Terminal.config`). Permite multi-modelo, payment status, comprobante, IDs de Stripe.
2. **Stripe UX**: Stripe Checkout (página hosteada). Redirige, regresa con `session_id`. Webhook autoritativo.
3. **Multi-modelo**: sí, una orden puede mezclar PAX A910S + NexGo N62 + N86.
4. **SPEI verification**: manual por sales con email magic-link. Botones `Aprobar` y `Rechazar`. Token expira en 7 días. Comprobante adjunto en el correo. Link extra al admin UI.
5. **Upload SPEI**: página de confirmación `/tpv/orders/:id` con bank details + dropzone.
6. **Orders tracking**: tab nuevo "Pedidos" en `/tpv` (pill tabs).
7. **Serial assignment** (agregado tras feedback): después de aprobar pago, sales recibe correo con botón `Asignar números de serie` → magic-link a un form donde mete los serials → backend crea los `Terminal` records linked a la orden → aparecen en `/tpv` del venue + email al venue con activation codes.

## Arquitectura

### Modelo Prisma

```prisma
model TerminalOrder {
  id              String   @id @default(cuid())
  orderNumber     String   @unique          // "AVO-1234"
  venueId         String
  venue           Venue    @relation(fields: [venueId], references: [id])
  createdById     String
  createdBy       Staff    @relation(fields: [createdById], references: [id])

  items           TerminalOrderItem[]

  // Snapshot de contacto/envío (puede divergir del venue después)
  contactName       String
  contactEmail      String
  contactPhone      String
  shippingAddress   String
  shippingAddress2  String?
  shippingCity      String
  shippingState     String
  shippingZip       String
  shippingCountry   String   @default("México")

  // Pago
  paymentMethod   TerminalOrderPaymentMethod
  paymentStatus   TerminalOrderPaymentStatus
  subtotalCents   Int
  taxCents        Int
  totalCents      Int
  currency        String   @default("MXN")

  stripeCheckoutSessionId String?
  stripePaymentIntentId   String?
  stripeReceiptUrl        String?

  speiProofUrl            String?
  speiProofMimeType       String?
  speiProofUploadedAt     DateTime?
  speiApprovalToken       String?   @unique
  speiTokenExpiresAt      DateTime?
  speiApprovedAt          DateTime?
  speiApprovedBy          String?
  speiRejectionReason     String?

  // Fulfillment (separado de pago)
  fulfillmentStatus              TerminalOrderFulfillmentStatus @default(NEW)
  serialAssignmentToken          String?   @unique
  serialAssignmentTokenExpiresAt DateTime?
  serialsAssignedAt              DateTime?
  serialsAssignedBy              String?
  trackingNumber                 String?
  carrier                        String?
  shippedAt                      DateTime?
  deliveredAt                    DateTime?

  terminals       Terminal[]   // creados solo cuando paymentStatus=PAID + sales asigna serials

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([venueId])
  @@index([paymentStatus])
  @@index([fulfillmentStatus])
  @@index([speiApprovalToken])
  @@index([serialAssignmentToken])
}

model TerminalOrderItem {
  id              String   @id @default(cuid())
  orderId         String
  order           TerminalOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  brand           String   // "PAX" | "NEXGO"
  model           String   // "A910S" | "N62" | "N86"
  productName     String   // snapshot (ej. "PAX A910S")
  quantity        Int
  unitPriceCents  Int
  namePrefix      String   // "Terminal" → genera "Terminal 1, Terminal 2…"
}

enum TerminalOrderPaymentMethod { CARD_STRIPE SPEI }

enum TerminalOrderPaymentStatus {
  AWAITING_PAYMENT  // CARD: esperando Stripe Checkout
  AWAITING_PROOF    // SPEI: esperando comprobante
  PROOF_UPLOADED    // SPEI: comprobante subido, sales debe aprobar
  PAID              // Pagado y verificado
  REJECTED          // Sales rechazó comprobante
  EXPIRED           // Link/token expiró
  REFUNDED          // Devolución (futuro)
}

enum TerminalOrderFulfillmentStatus {
  NEW                // pre-PAID
  AWAITING_SERIALS   // PAID, sales aún no asigna
  SERIALS_ASSIGNED   // Terminals creados, listo a enviar
  SHIPPED
  DELIVERED
  CANCELLED
}
```

Migración: `npx prisma migrate dev --name add-terminal-order`.

**Retro-compatibilidad**: los `Terminal` históricos con `config.purchaseOrder` JSON no se migran. Solo órdenes nuevas usan `TerminalOrder`.

### Catálogo de productos

`avoqado-server/src/config/tpvCatalog.ts` (source of truth) + `avoqado-web-dashboard/src/config/tpvCatalog.ts` (UI mirror). Ambos importan del mismo source via copia manual (o `shared/`). Forma:

```ts
export const TPV_CATALOG = {
  PAX_A910S: {
    brand: 'PAX',
    model: 'A910S',
    name: 'PAX A910S',
    description: 'Potente TPV de bolsillo con pagos integrados',
    unitPriceCents: 400_000,   // $4,000 MXN sin IVA
    image: '/images/tpv/pax-a910s.png',
    features: ['Pantalla táctil 5"', 'Escáner integrado', 'Cámara para QR', 'Conectividad 4G'],
    specs: {
      dimensions: 'TBD por sales',  // mm
      weight:     'TBD',            // g
      battery:    'TBD',            // mAh
      display:    '5", 720x1280',
      os:         'Android 8.1',
      connectivity: ['4G LTE', 'WiFi 2.4/5GHz', 'Bluetooth 4.2'],
      scanner:    '1D/2D',
      camera:     '2MP rear',
      printer:    'Térmica 58mm',
    },
  },
  NEXGO_N62: { /* $1,800 MXN, specs TBD */ },
  NEXGO_N86: { /* $3,000 MXN, specs TBD */ },
} as const
```

Precios en centavos para evitar errores de redondeo (ver `Money` pattern). IVA se calcula en el backend al crear la orden.

## UI changes

### Wizard refactor: `<Dialog>` → `<FullScreenModal>`

Obligatorio por la regla 12 de `CLAUDE.md` y `ui-patterns.md`. Header con close (left), título centro, "Siguiente"/`Confirmar pedido` derecha. Content con `bg-muted/30`. Sigue el patrón de `ProductWizardDialog.tsx`.

### Paso 1 — Catálogo + carrito

- 3 cards horizontales con datos del catálogo (precio neto + IVA, 3-4 features, botón "Ver specs ▼" que expande drawer con la ficha completa).
- Botón "Agregar" → mete al carrito (`useState<CartItem[]>`). Si ya está, se convierte en stepper `[- N +]`.
- Carrito sticky abajo: items, subtotal, IVA 16%, total. Eliminar con `X`. Max 10 unidades totales.
- `data-tour="tpv-catalog-{model}"`, `data-tour="tpv-cart-add-{model}"`, `data-tour="tpv-cart-summary"`.

### Paso 2 — Envío

- Sin cambios visuales mayores. Pre-fill desde `venue` data.
- Usa `<AddressAutocomplete>` (regla 13 de CLAUDE.md).
- **Eliminamos** el selector de velocidad de envío. Default: estándar gratis 5-7 días. Si después necesitan express/overnight con costo, va en fase 2.

### Paso 3 — Método de pago

- Solo 2 opciones: `CARD_STRIPE` y `SPEI`. Sin "Saldo a la cuenta".
- Sin inputs de tarjeta (Stripe los maneja). Sin banner "demo mode".

### Paso 4 — Revisar y confirmar

- Resumen items + dirección + método + total.
- Checkbox "Acepto términos".
- Submit:
  - `CARD_STRIPE` → backend crea order + Stripe Session → frontend `window.location.href = session.url`.
  - `SPEI` → backend crea order → frontend navega a `/tpv/orders/:id`.

### Nueva página `/venues/:slug/tpv/orders/:id` (confirmación SPEI + estado)

- Header: número de orden + badge de estado.
- Caja de bank details (SOLO si paymentStatus es `AWAITING_PROOF` o `REJECTED`):
  - Beneficiario, CLABE, banco, RFC, monto exacto, concepto (= orderNumber). Cada valor con `[📋]` y feedback "Copiado".
- Caja de upload (mismo gating):
  - Dropzone (`react-dropzone` o lib equivalente). Acepta PDF/PNG/JPG ≤10 MB.
  - Si está `REJECTED`: muestra el motivo en amber + permite re-upload.
- Resumen del pedido (items, totales).
- Estados visibles: `AWAITING_PROOF`, `PROOF_UPLOADED` ("Recibimos tu comprobante, en 1-2 días lo verificamos"), `PAID` ("✅ Pago confirmado"), `SERIALS_ASSIGNED` ("📦 En camino: terminal X con código YYYYYY"), `SHIPPED`, `DELIVERED`, `REJECTED`, `EXPIRED`.

### Tab "Pedidos" en `/tpv`

- Pill-style tabs (regla `ui-patterns.md`): `[Terminales] [Pedidos] [Configuración]`.
- Tabla: `# Orden`, `Fecha`, `Items (chip)`, `Total`, `Método`, `Estado`, `Acciones`.
- Filtros: estado (FilterPill multi-select), método (FilterPill), búsqueda por `orderNumber` (expandable search debounced 300ms).
- Row click → `/tpv/orders/:id`.

### Páginas magic-link (públicas, token-based, sin login)

Todas bajo `/admin/tpv-orders/*` para distinguir del shell autenticado `/superadmin/*`.

- `/admin/tpv-orders/:id/approve?token=...` — Click desde correo. Backend verifica token, marca `paymentStatus=PAID`, redirige a pantalla de éxito.
- `/admin/tpv-orders/:id/reject?token=...` — Form con textarea "Motivo del rechazo" + submit.
- `/admin/tpv-orders/:id/assign-serials?token=...` — Form con inputs por unidad (nombre + serial). Submit → crea Terminals.

Si el token es inválido o expirado: pantalla "Este link ya no es válido. Inicia sesión como superadmin para continuar."

### Superadmin UI `/superadmin/tpv-orders`

- Listado de todas las órdenes (todos los venues). Misma tabla que el tab "Pedidos" + columna `Venue`.
- Click → `/superadmin/tpv-orders/:id` con todas las acciones (Aprobar/Rechazar/Asignar serials/Marcar enviado/Marcar entregado).

## Flujos detallados

### Flujo A — Stripe Card Checkout

1. Frontend (wizard step 4) → `POST /api/v1/dashboard/venues/:venueId/tpv-orders` con `{items, contact, shipping, paymentMethod: 'CARD_STRIPE'}`.
2. Backend:
   - Crea `TerminalOrder` con `paymentStatus=AWAITING_PAYMENT`.
   - Calcula `subtotal`, `tax (16%)`, `total` en cents MXN.
   - Llama `stripe.checkout.sessions.create({ mode: 'payment', line_items, customer_email, payment_intent_data: { receipt_email }, metadata: { terminalOrderId, venueId }, success_url, cancel_url })`.
   - Guarda `stripeCheckoutSessionId`.
   - Responde `{ orderId, redirectUrl: session.url }`.
3. Frontend → `window.location.href = redirectUrl`.
4. Usuario paga en Stripe. Stripe redirige a `https://dashboard.avoqado.io/venues/:slug/tpv/orders/:id?session_id=...`.
5. **En paralelo**: Stripe envía webhook `checkout.session.completed` a `POST /api/v1/webhooks/stripe`.
6. Webhook handler:
   - Verifica firma `stripe-signature`.
   - Busca order por `event.data.object.metadata.terminalOrderId`.
   - Marca `paymentStatus=PAID`, guarda `stripePaymentIntentId`, `stripeReceiptUrl`.
   - Marca `fulfillmentStatus=AWAITING_SERIALS`.
   - Genera `serialAssignmentToken` (JWT, 30 días).
   - Envía email #4 (cliente) y #5 (sales: "Asigna serials").
7. La página `/tpv/orders/:id` consulta el order y muestra el estado actualizado.

**Webhook es autoritativo** — si el usuario cierra el navegador antes del redirect, el estado igual se actualiza.

**Cancelación**: Stripe redirige a `/tpv?cancelled=true`. Orden queda `AWAITING_PAYMENT`. Cron job la marca `EXPIRED` a los 7 días.

### Flujo B — SPEI con aprobación manual

1. Frontend → `POST /tpv-orders` con `paymentMethod='SPEI'`.
2. Backend crea order `paymentStatus=AWAITING_PROOF`. Envía email #1 (datos para SPEI al cliente).
3. Frontend navega a `/tpv/orders/:id`.
4. Cliente realiza el SPEI en su banco (fuera del sistema), regresa a la página.
5. Cliente sube comprobante → `POST /tpv-orders/:id/upload-proof` (multipart, max 10 MB).
6. Backend:
   - Multer en memoria → R2/S3 → URL guardada en `speiProofUrl`.
   - Genera `speiApprovalToken` (JWT, 7 días).
   - Marca `paymentStatus=PROOF_UPLOADED`.
   - Envía email #2 (sales: "⏳ Aprobar SPEI") con comprobante adjunto + botones `Aprobar`/`Rechazar`/`Ver en admin UI`.
7. Sales recibe correo. Verifica en su banco que llegó el SPEI.
8. **Path 1 — Aprobar**: click `[✅ Aprobar pedido]` → `GET /api/v1/public/tpv-orders/:id/approve?token=...`:
   - Verifica JWT, marca `paymentStatus=PAID`, `speiApprovedAt`, `speiApprovedBy`.
   - Marca `fulfillmentStatus=AWAITING_SERIALS`. Genera `serialAssignmentToken`.
   - Envía emails #4 (cliente: "✅ Pago confirmado") y #5 (sales: "Asigna serials").
   - Renderiza pantalla success.
9. **Path 2 — Rechazar**: click `[❌ Rechazar pago]` → `/admin/tpv-orders/:id/reject?token=...`:
   - Form con motivo. Submit → `paymentStatus=REJECTED`.
   - Email #3 al cliente con motivo + link para re-subir.
   - Cliente entra a `/tpv/orders/:id`, ve el motivo, re-sube comprobante.
   - Backend marca `paymentStatus=PROOF_UPLOADED` otra vez. Email #2 a sales con asunto `🔁 Re-aprobar SPEI`.

### Flujo C — Asignación de números de serie

Aplica idéntico para Stripe y SPEI (es el flujo post-`PAID`):

1. Sales recibe correo #5 con CTA `[Asignar números de serie]` (magic link a `/admin/tpv-orders/:id/assign-serials?token=...`).
2. Página renderiza form con N grupos (uno por `TerminalOrderItem`). Por unidad: input "Nombre del terminal" (pre-llenado con `{prefix} {n}`) y "Número de serie".
3. Sales completa serials → `POST /api/v1/public/tpv-orders/:id/assign-serials?token=...`.
4. Backend en transacción:
   - Valida serials únicos (constraint `Terminal.serialNumber @unique` + check explícito por mejor error).
   - Crea N records `Terminal` con `venueId`, `terminalOrderId`, `brand`, `model`, `name`, `serialNumber`, `status=PENDING_ACTIVATION`. Genera `activationCode` por terminal (6 chars alfanuméricos, expira 30 días).
   - Marca `fulfillmentStatus=SERIALS_ASSIGNED`, `serialsAssignedAt`, `serialsAssignedBy`.
   - Envía email #6 al venue con lista de terminales asignados (nombre + serial + activation code + instrucciones).
5. Renderiza pantalla success.
6. Los Terminals aparecen inmediatamente en `/venues/:slug/tpv` con badge "Pendiente de activación". El venue usa el activation code en cada PAX físico para activar (flujo existente intacto).

**Re-asignación**: si sales se equivoca y necesita corregir, el magic link sigue funcionando hasta `SERIALS_ASSIGNED`. Después, debe entrar a `/superadmin/tpv-orders/:id` (login required) para editar serials. Editar serials después de assignment requiere borrar y recrear el Terminal record afectado.

## Backend — superficie

### Endpoints

```
# Dashboard (auth: venue staff con tpv:create/read)
POST   /api/v1/dashboard/venues/:venueId/tpv-orders
GET    /api/v1/dashboard/venues/:venueId/tpv-orders
GET    /api/v1/dashboard/venues/:venueId/tpv-orders/:id
POST   /api/v1/dashboard/venues/:venueId/tpv-orders/:id/upload-proof
POST   /api/v1/dashboard/venues/:venueId/tpv-orders/:id/cancel

# Public (sin auth, JWT-based)
GET    /api/v1/public/tpv-orders/:id/approve
POST   /api/v1/public/tpv-orders/:id/reject
GET    /api/v1/public/tpv-orders/:id/assign-serials/check
POST   /api/v1/public/tpv-orders/:id/assign-serials

# Superadmin (auth: SUPERADMIN)
GET    /api/v1/superadmin/tpv-orders
GET    /api/v1/superadmin/tpv-orders/:id
POST   /api/v1/superadmin/tpv-orders/:id/approve
POST   /api/v1/superadmin/tpv-orders/:id/reject
POST   /api/v1/superadmin/tpv-orders/:id/assign-serials
POST   /api/v1/superadmin/tpv-orders/:id/mark-shipped
POST   /api/v1/superadmin/tpv-orders/:id/mark-delivered

# Webhooks (firma)
POST   /api/v1/webhooks/stripe   # ya existe; agregar handler para checkout.session.completed
                                 # con metadata.terminalOrderId
```

### Services

- `terminalOrder.service.ts`: createOrder, calculateTotals, generateOrderNumber (`AVO-` + secuencial atómico), transitionStatus (validador de estados), uploadProof, approveSpei, rejectSpei, assignSerials, markShipped, markDelivered.
- `terminalOrderToken.service.ts`: signApprovalToken, signSerialAssignmentToken, verifyToken (handle expired, signature, replay).
- `stripeCheckout.service.ts`: createCheckoutSession para `TerminalOrder` (separado de `stripeConnect.service.ts` existente).
- Extensión de `email.service.ts`: 7 nuevos métodos (uno por template).

### Storage

- **Firebase Storage** (confirmado vía `src/services/storage.service.ts`). Funciones existentes: `uploadFileToStorage(buffer, filePath, contentType)`, `buildStoragePath()` (agrega prefijo `prod/` o `dev/` automático), `deleteFileFromStorage(url)`.
- Path: `{envPrefix}/venues/:venueId/tpv-orders/:orderId/proof.{ext}` — sigue el patrón de KYC y otros documentos.
- Acceso: Firebase Storage URLs son públicas con token (`?alt=media&token=...`). El token actúa como key — no es necesario generar signed URLs separados. La URL completa va en `speiProofUrl` y se incluye en correos.
- Lifecycle: retención mínima 5 años (requisito fiscal MX). Configurable en Firebase console.
- Multer en memoria (`multer.memoryStorage()`), luego pasamos buffer a `uploadFileToStorage`. Patrón ya usado en `venueKyc.service.ts`.

### Env vars nuevas

```
STRIPE_SECRET_KEY                       # debe existir
STRIPE_WEBHOOK_SECRET                   # debe existir
TERMINAL_ORDER_TOKEN_SECRET             # 32+ chars random por env
ORDER_NOTIFICATIONS_EMAIL=sales@avoqado.io
SPEI_RECIPIENT_BENEFICIARY="SERVICIOS TECNOLOGICOS AVO SA DE CV"
SPEI_RECIPIENT_CLABE=699180600007741022
SPEI_RECIPIENT_RFC=STA241210PW8
SPEI_RECIPIENT_BANK=STP
# (No env var nuevo de bucket — usa el bucket Firebase default ya configurado)
```

### Background job

`src/jobs/expire-pending-tpv-orders.job.ts` corriendo cada 6h:
- `AWAITING_PAYMENT` >7 días → `EXPIRED`.
- `AWAITING_PROOF` >14 días → `EXPIRED`.
- Recordatorio email al venue a los días 3 y 7 antes de expirar.

## Emails (7 templates)

| # | Template | To | Trigger | Subject |
|---|----------|----|---------|---------|
| 1 | `speiInstructionsForCustomer` | venue contact | SPEI order creada | `Datos para completar tu pedido AVO-####` |
| 2 | `speiProofForSales` | `sales@avoqado.io` | Comprobante subido | `⏳ Aprobar SPEI — AVO-####` / `🔁 Re-aprobar SPEI — AVO-####` |
| 3 | `speiRejectedForCustomer` | venue contact | Sales rechazó | `Necesitamos verificar tu pago AVO-####` |
| 4 | `paymentConfirmedForCustomer` | venue contact | `paymentStatus=PAID` (cualquiera) | `✅ Pago confirmado AVO-####` |
| 5 | `serialAssignmentForSales` | `sales@avoqado.io` | `paymentStatus=PAID` | `💰 Asigna números de serie — AVO-####` |
| 6 | `terminalsShippedForCustomer` | venue contact + owner | Sales asignó serials | `📦 Tu pedido AVO-#### está en camino` |
| 7 | `terminalsDeliveredForCustomer` *(opcional v2)* | venue contact | Sales marcó DELIVERED | `Tu pedido AVO-#### fue entregado` |

**Estilo visual**: idéntico a `sendTerminalPurchaseAdminNotification` existente (Stripe-like, max-width 600, isotipo, gray boxes). Solo cambia contenido + CTAs.

**Attachments**: correo #2 lleva el comprobante adjunto. Si pesa >5 MB, fallback a signed URL + thumbnail.

**Idioma**: emails en `es-MX` exclusivamente (mismo patrón que existentes).

## Testing

### Playwright E2E

`e2e/tests/tpv/buy-terminal-stripe.spec.ts`, `buy-terminal-spei.spec.ts`, `assign-serials.spec.ts`:

- Crea orden multi-modelo CARD_STRIPE → mock POST `/tpv-orders` → frontend redirige (interceptado) → verifica order creada `AWAITING_PAYMENT`.
- Mock webhook `checkout.session.completed` → verifica `PAID + AWAITING_SERIALS + emails disparados`.
- Crea orden SPEI → redirige a `/tpv/orders/:id` → renderiza datos bancarios + dropzone.
- Sube comprobante mock → `PROOF_UPLOADED`.
- Magic link approve con token válido → success page.
- Magic link approve con token expirado → "Link expirado".
- Asigna serials → `Terminal` records aparecen en lista.
- Cliente cancela Stripe → toast + orden queda `AWAITING_PAYMENT`.
- Tab "Pedidos" — filtros + búsqueda funcionan.

### Vitest unit tests (backend)

- `terminalOrder.service.test.ts`: cálculo IVA, generación order number, transiciones de estado válidas/inválidas.
- `terminalOrderToken.service.test.ts`: sign/verify, expiración, replay attack.
- `stripe-webhook-handler.test.ts`: maneja evento válido, evento sin metadata, firma inválida.

## i18n

- Nuevas keys en `src/locales/{es,en}/tpv.json`:
  - `purchaseWizard.step1.catalog.*`, `step1.cart.*` — UI cards + carrito.
  - `purchaseWizard.step3.methods.cardStripe`, `step3.methods.spei`.
  - `orders.*` (namespace nuevo) — tab, columnas, estados, filtros.
  - `confirmation.spei.*` — labels bank details, "Comprobante recibido", etc.
  - `assignSerials.*` — labels form magic-link.
- Páginas magic-link `/admin/tpv-orders/*` detectan `Accept-Language` (es/en).
- Emails en español-only (mismo patrón existente).

## Pre-deploy checklist

```
[ ] STRIPE_WEBHOOK_SECRET configurado en demo/staging/prod
[ ] Webhook endpoint registrado en Stripe Dashboard (3 envs)
[ ] ORDER_NOTIFICATIONS_EMAIL=sales@avoqado.io
[ ] TERMINAL_ORDER_TOKEN_SECRET (32+ chars random por env)
[ ] SPEI_RECIPIENT_* env vars
[ ] Bucket de R2/S3 con IAM + lifecycle policy (5 años)
[ ] Migración Prisma aplicada
[ ] Catalog file con specs reales confirmadas por sales
[ ] npm run build + lint + test:e2e (dashboard)
[ ] npm run build + test (server)
[ ] Tested light + dark
[ ] Tested roles OWNER, ADMIN, MANAGER
[ ] Stripe test card 4242 4242 4242 4242 flujo completo
[ ] SPEI flow end-to-end: subir → email a sales → Aprobar → terminales aparecen
[ ] Emails renderizan en Gmail/Outlook/Apple Mail
[ ] /superadmin/tpv-orders solo SUPERADMIN
```

## Out of scope (fase 2)

- Refunds y devoluciones (Stripe + reverso Terminal).
- Cupones / códigos promocionales.
- Envío express/overnight con costo (hoy gratis 5-7 días).
- Cancelación cliente post-PAID (debe contactar sales).
- Integración tracking con paquetería.
- Inventario interno de Avoqado (qué serials hay en stock).
- Multi-currency.
- Bulk discounts.
- IVA configurable (hoy hardcoded 16%).

## Open questions

1. **Banco para CLABE 699...**: Asumimos STP (Sistema de Tecnologías de Pago). Confirmar con sales.
2. **Specs físicas exactas** de PAX A910S, NexGo N62, NexGo N86: dimensiones, peso, batería, pantalla, conectividad, scanner, cámara, OS, impresora. Sales/Jose deben llenar `tpvCatalog.ts`.
3. ~~Storage backend~~ ✅ Confirmado: **Firebase Storage** (mismo que KYC docs y otros uploads). `uploadFileToStorage` helper ya existe en `storage.service.ts`.
4. **Stripe account**: confirmar que es cuenta Avoqado principal (no Stripe Connect del venue).
5. **Permisos**: ¿OWNER + ADMIN pueden comprar, o solo OWNER?
6. **Comportamiento al cerrar wizard a la mitad**: drafts `AWAITING_*` se mantienen, expiran solos via cron.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Token de aprobación SPEI interceptado | JWT firmado + expiración 7d + single-use (invalidar tras usar) + log de IP del approver |
| Comprobante SPEI falsificado | Verificación humana en banco antes de aprobar; reject reason visible al cliente |
| Stripe webhook llega antes que el redirect | El webhook es autoritativo. Frontend solo lee estado. Idempotency via `stripeCheckoutSessionId` único |
| Cliente cierra antes de subir comprobante SPEI | URL persiste; cron recordatorio a los 3 y 7 días; expira a los 14d |
| Sales asigna serials duplicados | Constraint `Terminal.serialNumber @unique` + validación previa con error específico |
| Order huérfana (PAID pero terminals no creados) | Si `assignSerials` falla, sigue en `AWAITING_SERIALS`; sales puede reintentar; superadmin UI lo muestra |
| Webhook duplicado | Idempotency por `event.id` (guardar en tabla de eventos procesados) |
| File upload abuse | Max 10 MB, mime whitelist, rate limit por IP, tamaño total por venue limitado |
