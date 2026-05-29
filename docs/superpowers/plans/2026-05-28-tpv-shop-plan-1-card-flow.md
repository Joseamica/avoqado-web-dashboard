# TPV Shop — Plan 1: Foundation + Stripe Card flow

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el wizard demo de "Comprar Terminal" por un flujo real: catálogo multi-modelo (PAX A910S, NexGo N62, NexGo N86), carrito, pago con Stripe Checkout, página de confirmación, tab "Pedidos" para tracking, y superadmin UI donde sales puede asignar números de serie que generan los `Terminal` records en el venue del cliente.

**Architecture:** Nuevo modelo `TerminalOrder` (+ `TerminalOrderItem`) en Prisma con paymentStatus y fulfillmentStatus separados. Backend: createOrder genera Stripe Checkout Session, webhook `checkout.session.completed` marca PAID y dispara emails. Frontend: wizard refactorizado a `FullScreenModal` con catálogo + carrito + opción Card (SPEI deshabilitada con badge "Muy pronto" en este plan). Superadmin UI lista órdenes y permite asignar serials (que crean `Terminal` records). Sin magic links, sin SPEI, sin background jobs — esos van en Plans 2 y 3.

**Tech Stack:** Prisma + PostgreSQL · Express + TypeScript · Stripe SDK (`stripe ^19.1.0`) · Stripe Checkout (mode payment) · Resend para emails · Firebase Storage (no usado en este plan) · React 18 + Vite + TanStack Query + React Hook Form · Playwright para E2E.

**⚠️ Conventions correction (added 2026-05-28 after Task 4):** The plan's backend test snippets reference `vitest`, but the avoqado-server project uses **Jest**. Use `jest.mock` / `jest.fn` / `jest.clearAllMocks` / `as jest.Mock`. The Prisma singleton is at `@/utils/prismaClient` (not `@/lib/prisma`). Backend test files live at `tests/unit/services/...` (not co-located in `src/`). Adapt the snippets below accordingly. The implementation file itself stays inside `src/services/...`.

**Refs:**
- Spec: `docs/superpowers/specs/2026-05-28-tpv-shop-stripe-spei-design.md`
- Patterns to follow:
  - Email template: `avoqado-server/src/services/email.service.ts:1530-1665` (`sendTerminalPurchaseAdminNotification`)
  - Webhook dispatcher: `avoqado-server/src/services/stripe.webhook.service.ts:1027` (`handleStripeWebhookEvent`)
  - File upload pattern (no usado aquí pero referencia para Plan 2): `avoqado-server/src/services/dashboard/venueKyc.service.ts:115`
  - FullScreenModal: `avoqado-web-dashboard/src/components/ui/full-screen-modal.tsx`
  - Existing wizard (a refactorizar): `avoqado-web-dashboard/src/pages/Tpv/components/purchase-wizard/`
  - Pill tabs: `avoqado-web-dashboard/src/pages/Team/Teams.tsx`
  - FilterPill table: `avoqado-web-dashboard/src/pages/Order/Orders.tsx`

**Working dirs:** Backend `/Users/amieva/Documents/Programming/Avoqado/avoqado-server`. Dashboard `/Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard`.

---

## Phase A — Backend foundation (data model + services)

### Task 1: Add `TerminalOrder` + `TerminalOrderItem` Prisma models

**Files:**
- Modify: `avoqado-server/prisma/schema.prisma` (append at end, before existing model patterns)

- [ ] **Step 1: Add enums and models to schema**

Append to `prisma/schema.prisma` after the last `Terminal*` related model (after `TerminalHealth`, around line 3213):

```prisma
enum TerminalOrderPaymentMethod {
  CARD_STRIPE
  SPEI
}

enum TerminalOrderPaymentStatus {
  AWAITING_PAYMENT   // CARD: esperando Stripe Checkout
  AWAITING_PROOF     // SPEI: esperando comprobante (Plan 2)
  PROOF_UPLOADED     // SPEI: comprobante subido, sales debe aprobar (Plan 2)
  PAID               // Pagado y verificado
  REJECTED           // Sales rechazó comprobante (Plan 2)
  EXPIRED            // Link/token expiró
  REFUNDED           // Devolución (futuro)
}

enum TerminalOrderFulfillmentStatus {
  NEW                // pre-PAID
  AWAITING_SERIALS   // PAID, sales aún no asigna
  SERIALS_ASSIGNED   // Terminals creados, listo a enviar
  SHIPPED
  DELIVERED
  CANCELLED
}

model TerminalOrder {
  id          String @id @default(cuid())
  orderNumber String @unique // "AVO-1234"
  venueId     String
  venue       Venue  @relation(fields: [venueId], references: [id])
  createdById String
  createdBy   Staff  @relation("TerminalOrderCreatedBy", fields: [createdById], references: [id])

  items TerminalOrderItem[]

  // Snapshot de contacto / envío
  contactName      String
  contactEmail     String
  contactPhone     String
  shippingAddress  String
  shippingAddress2 String?
  shippingCity     String
  shippingState    String
  shippingZip      String
  shippingCountry  String @default("México")

  // Pago
  paymentMethod TerminalOrderPaymentMethod
  paymentStatus TerminalOrderPaymentStatus
  subtotalCents Int
  taxCents      Int
  totalCents    Int
  currency      String @default("MXN")

  stripeCheckoutSessionId String?
  stripePaymentIntentId   String?
  stripeReceiptUrl        String?

  // SPEI (Plan 2 — campos quedan opcionales en Plan 1)
  speiProofUrl        String?
  speiProofMimeType   String?
  speiProofUploadedAt DateTime?
  speiApprovalToken   String?   @unique
  speiTokenExpiresAt  DateTime?
  speiApprovedAt      DateTime?
  speiApprovedBy      String?
  speiRejectionReason String?

  // Fulfillment
  fulfillmentStatus              TerminalOrderFulfillmentStatus @default(NEW)
  serialAssignmentToken          String?                        @unique
  serialAssignmentTokenExpiresAt DateTime?
  serialsAssignedAt              DateTime?
  serialsAssignedBy              String?
  trackingNumber                 String?
  carrier                        String?
  shippedAt                      DateTime?
  deliveredAt                    DateTime?

  terminals Terminal[] @relation("TerminalToTerminalOrder")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([venueId])
  @@index([paymentStatus])
  @@index([fulfillmentStatus])
  @@index([speiApprovalToken])
  @@index([serialAssignmentToken])
}

model TerminalOrderItem {
  id             String        @id @default(cuid())
  orderId        String
  order          TerminalOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  brand          String // "PAX" | "NEXGO"
  model          String // "A910S" | "N62" | "N86"
  productName    String // snapshot
  quantity       Int
  unitPriceCents Int
  namePrefix     String // "Terminal" → genera "Terminal 1, Terminal 2…"

  @@index([orderId])
}
```

- [ ] **Step 2: Add the new relation field to `Venue` and `Staff` models**

Find the `Venue` model and add inside it:

```prisma
  terminalOrders TerminalOrder[]
```

Find the `Staff` model and add inside it (note the `@relation` name for disambiguation if Staff already relates to terminals):

```prisma
  terminalOrdersCreated TerminalOrder[] @relation("TerminalOrderCreatedBy")
```

- [ ] **Step 3: Add the FK on `Terminal` linking back to the order**

Find the `Terminal` model (around line 3077) and add:

```prisma
  terminalOrderId String?
  terminalOrder   TerminalOrder? @relation("TerminalToTerminalOrder", fields: [terminalOrderId], references: [id])
```

Inside `@@index([venueId])` block add: `@@index([terminalOrderId])`.

- [ ] **Step 4: Validate schema**

Run: `cd avoqado-server && npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 5: Commit**

```bash
cd avoqado-server
git add prisma/schema.prisma
git commit -m "feat(tpv-orders): add TerminalOrder + TerminalOrderItem schema"
```

---

### Task 2: Create and apply the Prisma migration

**Files:**
- Create: `avoqado-server/prisma/migrations/<timestamp>_add_terminal_order/migration.sql` (auto-generated)

- [ ] **Step 1: Generate migration without applying**

Run: `cd avoqado-server && npx prisma migrate dev --create-only --name add-terminal-order`
Expected: Prints SQL file path. **Do NOT apply yet.**

- [ ] **Step 2: Read the generated SQL and verify**

Run: `cat avoqado-server/prisma/migrations/*_add_terminal_order/migration.sql`

Expected SQL: 3 new enums, 2 new tables (`TerminalOrder`, `TerminalOrderItem`), `ALTER TABLE "Terminal" ADD COLUMN "terminalOrderId"`, plus indexes and FKs. No `DROP` statements. If you see any DROP, abort — there's a stale rename somewhere.

- [ ] **Step 3: Apply migration**

Run: `cd avoqado-server && npx prisma migrate dev`
Expected: `Database is now in sync with your schema.`

- [ ] **Step 4: Regenerate Prisma client**

Run: `cd avoqado-server && npx prisma generate`
Expected: `Generated Prisma Client (...)`

- [ ] **Step 5: Commit**

```bash
cd avoqado-server
git add prisma/migrations/
git commit -m "feat(tpv-orders): apply migration for TerminalOrder tables"
```

---

### Task 3: Create the TPV catalog config (backend)

**Files:**
- Create: `avoqado-server/src/config/tpvCatalog.ts`

- [ ] **Step 1: Write the catalog file**

Create `avoqado-server/src/config/tpvCatalog.ts`:

```typescript
/**
 * TPV product catalog — source of truth for the Buy TPV flow.
 *
 * Prices stored in cents (MXN) to avoid rounding errors. IVA (16%) is
 * calculated at order creation time and is NOT included in unitPriceCents.
 *
 * To add a new model: extend TPV_CATALOG with a new key. The key is the
 * external identifier used by the frontend (`?model=PAX_A910S`).
 */

export interface TpvSpecs {
  dimensions?: string // e.g. "167x76x40 mm"
  weight?: string // e.g. "380 g"
  battery?: string // e.g. "5250 mAh"
  display?: string // e.g. "5\", 720x1280 IPS"
  os?: string // e.g. "Android 8.1"
  connectivity?: string[] // e.g. ["4G LTE", "WiFi 2.4/5GHz", "Bluetooth 4.2"]
  scanner?: string // e.g. "1D/2D" or "Cámara"
  camera?: string // e.g. "2MP rear"
  printer?: string // e.g. "Térmica 58mm" or null
}

export interface TpvCatalogEntry {
  brand: string // "PAX" | "NEXGO"
  model: string // "A910S" | "N62" | "N86"
  name: string // display name
  description: string
  unitPriceCents: number // MXN, sin IVA
  image: string // public URL (frontend assumes /images/tpv/<filename>)
  features: string[] // 3-4 short bullets shown on the card
  specs: TpvSpecs // full spec sheet shown in drawer
}

export const TPV_CATALOG: Record<string, TpvCatalogEntry> = {
  PAX_A910S: {
    brand: 'PAX',
    model: 'A910S',
    name: 'PAX A910S',
    description: 'Potente TPV de bolsillo con pagos integrados',
    unitPriceCents: 400_000, // $4,000 MXN
    image: '/images/tpv/pax-a910s.png',
    features: [
      'Pantalla táctil 5"',
      'Escáner integrado',
      'Cámara para QR',
      'Conectividad 4G',
    ],
    specs: {
      dimensions: 'TBD por sales',
      weight: 'TBD',
      battery: 'TBD',
      display: '5", 720x1280',
      os: 'Android 8.1',
      connectivity: ['4G LTE', 'WiFi 2.4/5GHz', 'Bluetooth 4.2'],
      scanner: '1D/2D',
      camera: '2MP rear',
      printer: 'Térmica 58mm',
    },
  },
  NEXGO_N62: {
    brand: 'NEXGO',
    model: 'N62',
    name: 'NexGo N62',
    description: 'TPV compacto, ideal para movilidad',
    unitPriceCents: 180_000, // $1,800 MXN
    image: '/images/tpv/nexgo-n62.png',
    features: [
      'Pantalla compacta',
      'Escáner por cámara',
      'Conectividad 4G',
      'Batería extendida',
    ],
    specs: {
      dimensions: 'TBD por sales',
      weight: 'TBD',
      battery: 'TBD',
      display: 'TBD',
      os: 'Android',
      connectivity: ['4G LTE'],
      scanner: 'Cámara',
      camera: 'TBD',
    },
  },
  NEXGO_N86: {
    brand: 'NEXGO',
    model: 'N86',
    name: 'NexGo N86',
    description: 'TPV premium con pantalla grande y escáner físico',
    unitPriceCents: 300_000, // $3,000 MXN
    image: '/images/tpv/nexgo-n86.png',
    features: [
      'Pantalla 6"',
      'Escáner físico 1D/2D',
      'Conectividad 4G + WiFi',
      'Cámara para QR',
    ],
    specs: {
      dimensions: 'TBD por sales',
      weight: 'TBD',
      battery: 'TBD',
      display: '6"',
      os: 'Android',
      connectivity: ['4G LTE', 'WiFi'],
      scanner: '1D/2D',
      camera: 'TBD',
    },
  },
}

export const TAX_RATE = 0.16 // 16% IVA México

export type TpvCatalogKey = keyof typeof TPV_CATALOG

export function getCatalogEntry(key: string): TpvCatalogEntry | undefined {
  return TPV_CATALOG[key]
}
```

- [ ] **Step 2: Commit**

```bash
cd avoqado-server
git add src/config/tpvCatalog.ts
git commit -m "feat(tpv-orders): add TPV catalog config with 3 models"
```

> **Note for engineer:** the `TBD por sales` fields are intentional. Open Question #2 in the spec is pending — Jose/sales will fill the exact dimensions/weight/battery/display values before deploy. Do not block on this; the structure is what matters.

---

### Task 4: Order number generator service + unit tests

**Files:**
- Create: `avoqado-server/src/services/dashboard/terminalOrder/orderNumber.service.ts`
- Create: `avoqado-server/src/services/dashboard/terminalOrder/orderNumber.service.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// avoqado-server/src/services/dashboard/terminalOrder/orderNumber.service.test.ts
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { generateOrderNumber } from './orderNumber.service'
import prisma from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  default: {
    terminalOrder: {
      count: vi.fn(),
    },
  },
}))

describe('generateOrderNumber', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts at AVO-0001 when there are zero orders', async () => {
    vi.mocked(prisma.terminalOrder.count).mockResolvedValue(0)
    const result = await generateOrderNumber()
    expect(result).toBe('AVO-0001')
  })

  it('increments past existing orders', async () => {
    vi.mocked(prisma.terminalOrder.count).mockResolvedValue(1234)
    const result = await generateOrderNumber()
    expect(result).toBe('AVO-1235')
  })

  it('pads to 4 digits minimum', async () => {
    vi.mocked(prisma.terminalOrder.count).mockResolvedValue(8)
    const result = await generateOrderNumber()
    expect(result).toBe('AVO-0009')
  })

  it('does not pad past 4 digits', async () => {
    vi.mocked(prisma.terminalOrder.count).mockResolvedValue(99999)
    const result = await generateOrderNumber()
    expect(result).toBe('AVO-100000')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd avoqado-server && npx vitest run src/services/dashboard/terminalOrder/orderNumber.service.test.ts`
Expected: FAIL with `Cannot find module './orderNumber.service'`.

- [ ] **Step 3: Write the implementation**

```typescript
// avoqado-server/src/services/dashboard/terminalOrder/orderNumber.service.ts
import prisma from '@/lib/prisma'

/**
 * Generates a sequential order number like AVO-0001, AVO-0002…
 *
 * NOT atomic — uses count(). For low-throughput admin orders (TPV purchases
 * happen at most a few times per day per venue) this is fine. If contention
 * becomes a problem, swap for a Postgres sequence.
 */
export async function generateOrderNumber(): Promise<string> {
  const existing = await prisma.terminalOrder.count()
  const next = existing + 1
  return `AVO-${String(next).padStart(4, '0')}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd avoqado-server && npx vitest run src/services/dashboard/terminalOrder/orderNumber.service.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd avoqado-server
git add src/services/dashboard/terminalOrder/
git commit -m "feat(tpv-orders): add order number generator + tests"
```

---

### Task 5: `terminalOrder.service.createOrder` + unit tests

**Files:**
- Create: `avoqado-server/src/services/dashboard/terminalOrder/terminalOrder.service.ts`
- Create: `avoqado-server/src/services/dashboard/terminalOrder/terminalOrder.service.test.ts`
- Create: `avoqado-server/src/services/dashboard/terminalOrder/types.ts`

- [ ] **Step 1: Write the types**

```typescript
// avoqado-server/src/services/dashboard/terminalOrder/types.ts
import type { TerminalOrderPaymentMethod } from '@prisma/client'

export interface CreateOrderItemInput {
  catalogKey: string // e.g. "PAX_A910S"
  quantity: number
  namePrefix?: string // default = productName
}

export interface CreateOrderInput {
  venueId: string
  createdById: string
  items: CreateOrderItemInput[]
  contactName: string
  contactEmail: string
  contactPhone: string
  shippingAddress: string
  shippingAddress2?: string
  shippingCity: string
  shippingState: string
  shippingZip: string
  shippingCountry?: string
  paymentMethod: TerminalOrderPaymentMethod
}

export interface OrderTotals {
  subtotalCents: number
  taxCents: number
  totalCents: number
  currency: 'MXN'
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// avoqado-server/src/services/dashboard/terminalOrder/terminalOrder.service.test.ts
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { createOrder, calculateTotals } from './terminalOrder.service'
import prisma from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  default: {
    terminalOrder: {
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}))

describe('calculateTotals', () => {
  it('computes subtotal + 16% IVA for a single item', () => {
    const totals = calculateTotals([
      { catalogKey: 'PAX_A910S', quantity: 1 },
    ])
    // PAX A910S = 400000 cents net
    // tax = 400000 * 0.16 = 64000
    // total = 464000
    expect(totals).toEqual({
      subtotalCents: 400_000,
      taxCents: 64_000,
      totalCents: 464_000,
      currency: 'MXN',
    })
  })

  it('computes totals for multi-model carts', () => {
    const totals = calculateTotals([
      { catalogKey: 'PAX_A910S', quantity: 2 }, // 800000
      { catalogKey: 'NEXGO_N62', quantity: 1 }, // 180000
    ])
    // subtotal = 980000
    // tax = 980000 * 0.16 = 156800
    // total = 1136800
    expect(totals.subtotalCents).toBe(980_000)
    expect(totals.taxCents).toBe(156_800)
    expect(totals.totalCents).toBe(1_136_800)
  })

  it('throws if an item references an unknown catalogKey', () => {
    expect(() =>
      calculateTotals([{ catalogKey: 'FAKE_MODEL', quantity: 1 }]),
    ).toThrow(/Unknown catalog key/)
  })

  it('throws if quantity < 1', () => {
    expect(() =>
      calculateTotals([{ catalogKey: 'PAX_A910S', quantity: 0 }]),
    ).toThrow(/quantity/i)
  })
})

describe('createOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.terminalOrder.count).mockResolvedValue(0)
  })

  it('persists an order with computed totals and snapshot items', async () => {
    vi.mocked(prisma.terminalOrder.create).mockResolvedValue({
      id: 'ord_1',
      orderNumber: 'AVO-0001',
    } as any)

    await createOrder({
      venueId: 'venue_1',
      createdById: 'staff_1',
      items: [{ catalogKey: 'PAX_A910S', quantity: 1 }],
      contactName: 'Test',
      contactEmail: 'test@example.com',
      contactPhone: '+52 55 1234 5678',
      shippingAddress: 'Av X 1',
      shippingCity: 'CDMX',
      shippingState: 'CDMX',
      shippingZip: '01000',
      paymentMethod: 'CARD_STRIPE',
    })

    const createCall = vi.mocked(prisma.terminalOrder.create).mock.calls[0][0]
    expect(createCall.data.orderNumber).toBe('AVO-0001')
    expect(createCall.data.subtotalCents).toBe(400_000)
    expect(createCall.data.totalCents).toBe(464_000)
    expect(createCall.data.paymentStatus).toBe('AWAITING_PAYMENT')
    // namePrefix default = productName
    const itemsCreate = (createCall.data.items as any).create
    expect(itemsCreate[0]).toMatchObject({
      brand: 'PAX',
      model: 'A910S',
      productName: 'PAX A910S',
      quantity: 1,
      unitPriceCents: 400_000,
      namePrefix: 'PAX A910S',
    })
  })

  it('initial paymentStatus depends on paymentMethod', async () => {
    vi.mocked(prisma.terminalOrder.create).mockResolvedValue({ id: 'x', orderNumber: 'AVO-0001' } as any)

    await createOrder({
      venueId: 'v', createdById: 's',
      items: [{ catalogKey: 'PAX_A910S', quantity: 1 }],
      contactName: 'a', contactEmail: 'a@a.com', contactPhone: '1',
      shippingAddress: 'a', shippingCity: 'a', shippingState: 'a', shippingZip: '1',
      paymentMethod: 'SPEI',
    })

    const call = vi.mocked(prisma.terminalOrder.create).mock.calls[0][0]
    expect(call.data.paymentStatus).toBe('AWAITING_PROOF')
  })
})
```

- [ ] **Step 3: Run test, verify it fails**

Run: `cd avoqado-server && npx vitest run src/services/dashboard/terminalOrder/terminalOrder.service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the implementation**

```typescript
// avoqado-server/src/services/dashboard/terminalOrder/terminalOrder.service.ts
import prisma from '@/lib/prisma'
import { TPV_CATALOG, TAX_RATE } from '@/config/tpvCatalog'
import type { CreateOrderInput, CreateOrderItemInput, OrderTotals } from './types'
import { generateOrderNumber } from './orderNumber.service'

export function calculateTotals(items: CreateOrderItemInput[]): OrderTotals {
  if (items.length === 0) {
    throw new Error('At least one item is required')
  }

  let subtotalCents = 0
  for (const item of items) {
    if (item.quantity < 1) {
      throw new Error('Item quantity must be >= 1')
    }
    const entry = TPV_CATALOG[item.catalogKey]
    if (!entry) {
      throw new Error(`Unknown catalog key: ${item.catalogKey}`)
    }
    subtotalCents += entry.unitPriceCents * item.quantity
  }

  // IVA — round half away from zero so 16% of 400000 = 64000 exactly
  const taxCents = Math.round(subtotalCents * TAX_RATE)
  const totalCents = subtotalCents + taxCents

  return { subtotalCents, taxCents, totalCents, currency: 'MXN' }
}

export async function createOrder(input: CreateOrderInput) {
  const totals = calculateTotals(input.items)
  const orderNumber = await generateOrderNumber()

  const initialPaymentStatus =
    input.paymentMethod === 'CARD_STRIPE' ? 'AWAITING_PAYMENT' : 'AWAITING_PROOF'

  return prisma.terminalOrder.create({
    data: {
      orderNumber,
      venueId: input.venueId,
      createdById: input.createdById,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      shippingAddress: input.shippingAddress,
      shippingAddress2: input.shippingAddress2,
      shippingCity: input.shippingCity,
      shippingState: input.shippingState,
      shippingZip: input.shippingZip,
      shippingCountry: input.shippingCountry ?? 'México',
      paymentMethod: input.paymentMethod,
      paymentStatus: initialPaymentStatus,
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
      currency: totals.currency,
      fulfillmentStatus: 'NEW',
      items: {
        create: input.items.map((item) => {
          const entry = TPV_CATALOG[item.catalogKey]
          return {
            brand: entry.brand,
            model: entry.model,
            productName: entry.name,
            quantity: item.quantity,
            unitPriceCents: entry.unitPriceCents,
            namePrefix: item.namePrefix ?? entry.name,
          }
        }),
      },
    },
    include: { items: true },
  })
}
```

- [ ] **Step 5: Run tests, verify pass**

Run: `cd avoqado-server && npx vitest run src/services/dashboard/terminalOrder/`
Expected: All tests in both test files pass.

- [ ] **Step 6: Commit**

```bash
cd avoqado-server
git add src/services/dashboard/terminalOrder/
git commit -m "feat(tpv-orders): add createOrder service with IVA calc + tests"
```

---

### Task 6: Stripe Checkout session creator + tests

**Files:**
- Create: `avoqado-server/src/services/dashboard/terminalOrder/stripeCheckout.service.ts`
- Create: `avoqado-server/src/services/dashboard/terminalOrder/stripeCheckout.service.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// avoqado-server/src/services/dashboard/terminalOrder/stripeCheckout.service.test.ts
import { describe, expect, it, beforeEach, vi } from 'vitest'

const sessionsCreateMock = vi.fn()
vi.mock('@/lib/stripe', () => ({
  default: {
    checkout: { sessions: { create: sessionsCreateMock } },
  },
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    terminalOrder: { update: vi.fn() },
  },
}))

import { createCheckoutSessionForOrder } from './stripeCheckout.service'
import prisma from '@/lib/prisma'

const orderWithItems = {
  id: 'ord_1',
  orderNumber: 'AVO-0001',
  venueId: 'venue_1',
  contactEmail: 'buyer@example.com',
  totalCents: 464_000,
  subtotalCents: 400_000,
  taxCents: 64_000,
  currency: 'MXN',
  paymentMethod: 'CARD_STRIPE',
  paymentStatus: 'AWAITING_PAYMENT',
  items: [
    { productName: 'PAX A910S', quantity: 1, unitPriceCents: 400_000 },
  ],
}

describe('createCheckoutSessionForOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionsCreateMock.mockResolvedValue({ id: 'cs_test_123', url: 'https://checkout.stripe.com/test' })
  })

  it('creates a session with metadata.terminalOrderId and totalCents amounts', async () => {
    await createCheckoutSessionForOrder({
      order: orderWithItems as any,
      successUrl: 'https://app/success',
      cancelUrl: 'https://app/cancel',
    })

    const args = sessionsCreateMock.mock.calls[0][0]
    expect(args.mode).toBe('payment')
    expect(args.customer_email).toBe('buyer@example.com')
    expect(args.metadata.terminalOrderId).toBe('ord_1')
    expect(args.metadata.venueId).toBe('venue_1')
    expect(args.success_url).toBe('https://app/success')
    expect(args.cancel_url).toBe('https://app/cancel')
    expect(args.payment_intent_data.receipt_email).toBe('buyer@example.com')
  })

  it('emits one line_item per order item with IVA included by adding tax as separate line', async () => {
    await createCheckoutSessionForOrder({
      order: orderWithItems as any,
      successUrl: 's', cancelUrl: 'c',
    })
    const args = sessionsCreateMock.mock.calls[0][0]
    // 1 product line + 1 IVA line
    expect(args.line_items).toHaveLength(2)
    expect(args.line_items[0].price_data.unit_amount).toBe(400_000)
    expect(args.line_items[0].quantity).toBe(1)
    expect(args.line_items[1].price_data.unit_amount).toBe(64_000)
    expect(args.line_items[1].quantity).toBe(1)
    expect(args.line_items[0].price_data.currency).toBe('mxn')
  })

  it('persists stripeCheckoutSessionId on the order', async () => {
    await createCheckoutSessionForOrder({
      order: orderWithItems as any,
      successUrl: 's', cancelUrl: 'c',
    })
    expect(prisma.terminalOrder.update).toHaveBeenCalledWith({
      where: { id: 'ord_1' },
      data: { stripeCheckoutSessionId: 'cs_test_123' },
    })
  })

  it('returns the redirect URL', async () => {
    const result = await createCheckoutSessionForOrder({
      order: orderWithItems as any,
      successUrl: 's', cancelUrl: 'c',
    })
    expect(result).toEqual({
      sessionId: 'cs_test_123',
      redirectUrl: 'https://checkout.stripe.com/test',
    })
  })
})
```

- [ ] **Step 2: Run, verify failure**

Run: `cd avoqado-server && npx vitest run src/services/dashboard/terminalOrder/stripeCheckout.service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// avoqado-server/src/services/dashboard/terminalOrder/stripeCheckout.service.ts
import stripe from '@/lib/stripe'
import prisma from '@/lib/prisma'
import type { TerminalOrder, TerminalOrderItem } from '@prisma/client'

interface CreateCheckoutSessionInput {
  order: TerminalOrder & { items: TerminalOrderItem[] }
  successUrl: string
  cancelUrl: string
}

export async function createCheckoutSessionForOrder(
  input: CreateCheckoutSessionInput,
): Promise<{ sessionId: string; redirectUrl: string }> {
  const { order, successUrl, cancelUrl } = input

  // One Stripe line_item per order item (using price_data inline — no Stripe Product needed).
  // Add a separate line_item for IVA so the customer sees the breakdown.
  const itemLines = order.items.map((item) => ({
    quantity: item.quantity,
    price_data: {
      currency: order.currency.toLowerCase(),
      product_data: { name: item.productName },
      unit_amount: item.unitPriceCents,
    },
  }))

  const taxLine = {
    quantity: 1,
    price_data: {
      currency: order.currency.toLowerCase(),
      product_data: { name: 'IVA (16%)' },
      unit_amount: order.taxCents,
    },
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: order.contactEmail,
    line_items: [...itemLines, taxLine],
    metadata: {
      terminalOrderId: order.id,
      venueId: order.venueId,
      orderNumber: order.orderNumber,
    },
    payment_intent_data: {
      receipt_email: order.contactEmail,
      description: `Pedido ${order.orderNumber} — Terminales Avoqado`,
      metadata: {
        terminalOrderId: order.id,
        venueId: order.venueId,
      },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  })

  await prisma.terminalOrder.update({
    where: { id: order.id },
    data: { stripeCheckoutSessionId: session.id },
  })

  return { sessionId: session.id, redirectUrl: session.url! }
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd avoqado-server && npx vitest run src/services/dashboard/terminalOrder/stripeCheckout.service.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd avoqado-server
git add src/services/dashboard/terminalOrder/stripeCheckout.service*
git commit -m "feat(tpv-orders): add Stripe Checkout session creator + tests"
```

---

### Task 7: `assignSerials` service function + unit tests

**Files:**
- Modify: `avoqado-server/src/services/dashboard/terminalOrder/terminalOrder.service.ts` (add function)
- Modify: `avoqado-server/src/services/dashboard/terminalOrder/terminalOrder.service.test.ts` (add tests)

- [ ] **Step 1: Add types**

Add to `types.ts`:

```typescript
export interface AssignSerialsItemInput {
  orderItemId: string
  units: Array<{ name: string; serial: string }>
}

export interface AssignSerialsInput {
  orderId: string
  assignedBy: string // email
  items: AssignSerialsItemInput[]
}
```

- [ ] **Step 2: Add failing tests**

Append to `terminalOrder.service.test.ts`:

```typescript
import { assignSerials } from './terminalOrder.service'

const orderWithItemsPaid = {
  id: 'ord_paid',
  orderNumber: 'AVO-0007',
  venueId: 'venue_1',
  paymentStatus: 'PAID',
  fulfillmentStatus: 'AWAITING_SERIALS',
  items: [
    { id: 'oi_1', brand: 'PAX', model: 'A910S', productName: 'PAX A910S', quantity: 2, namePrefix: 'PAX A910S' },
  ],
}

vi.mock('@/lib/prisma', () => ({
  default: {
    terminalOrder: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn(), create: vi.fn() },
    terminal: { findFirst: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn((fn: any) => fn({
      terminal: { findFirst: vi.fn().mockResolvedValue(null), createMany: vi.fn().mockResolvedValue({ count: 2 }) },
      terminalOrder: { update: vi.fn() },
    })),
  },
}))

describe('assignSerials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.terminalOrder.findUnique).mockResolvedValue(orderWithItemsPaid as any)
  })

  it('rejects if order is not paymentStatus=PAID', async () => {
    vi.mocked(prisma.terminalOrder.findUnique).mockResolvedValue({
      ...orderWithItemsPaid,
      paymentStatus: 'AWAITING_PAYMENT',
    } as any)
    await expect(
      assignSerials({
        orderId: 'ord_paid', assignedBy: 'sales@avoqado.io',
        items: [{ orderItemId: 'oi_1', units: [{ name: 'A1', serial: 'S1' }, { name: 'A2', serial: 'S2' }] }],
      }),
    ).rejects.toThrow(/not paid/i)
  })

  it('rejects if order fulfillmentStatus is already SERIALS_ASSIGNED', async () => {
    vi.mocked(prisma.terminalOrder.findUnique).mockResolvedValue({
      ...orderWithItemsPaid,
      fulfillmentStatus: 'SERIALS_ASSIGNED',
    } as any)
    await expect(
      assignSerials({ orderId: 'ord_paid', assignedBy: 's@a.io', items: [] }),
    ).rejects.toThrow(/already assigned/i)
  })

  it('rejects if units count per item does not match quantity', async () => {
    await expect(
      assignSerials({
        orderId: 'ord_paid', assignedBy: 's@a.io',
        items: [{ orderItemId: 'oi_1', units: [{ name: 'A1', serial: 'S1' }] }], // quantity is 2
      }),
    ).rejects.toThrow(/expected 2 units/i)
  })

  it('rejects if a serial is empty', async () => {
    await expect(
      assignSerials({
        orderId: 'ord_paid', assignedBy: 's@a.io',
        items: [{ orderItemId: 'oi_1', units: [{ name: 'A1', serial: '' }, { name: 'A2', serial: 'S2' }] }],
      }),
    ).rejects.toThrow(/serial is required/i)
  })
})
```

- [ ] **Step 3: Add the implementation**

Append to `terminalOrder.service.ts`:

```typescript
import type { AssignSerialsInput } from './types'

/**
 * Generates a 6-char alphanumeric activation code (existing pattern from Terminal model).
 */
function generateActivationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // unambiguous alphabet
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function assignSerials(input: AssignSerialsInput) {
  const order = await prisma.terminalOrder.findUnique({
    where: { id: input.orderId },
    include: { items: true },
  })
  if (!order) throw new Error('Order not found')
  if (order.paymentStatus !== 'PAID') {
    throw new Error(`Order ${order.orderNumber} is not paid (status: ${order.paymentStatus})`)
  }
  if (order.fulfillmentStatus === 'SERIALS_ASSIGNED' || order.fulfillmentStatus === 'SHIPPED' || order.fulfillmentStatus === 'DELIVERED') {
    throw new Error(`Order ${order.orderNumber} already assigned`)
  }

  // Validate: every item gets a units array of the right length, every serial non-empty
  const itemsById = Object.fromEntries(order.items.map((i) => [i.id, i]))
  for (const payload of input.items) {
    const item = itemsById[payload.orderItemId]
    if (!item) throw new Error(`Unknown orderItemId: ${payload.orderItemId}`)
    if (payload.units.length !== item.quantity) {
      throw new Error(`For ${item.productName}: expected ${item.quantity} units, got ${payload.units.length}`)
    }
    for (const unit of payload.units) {
      if (!unit.serial || unit.serial.trim() === '') {
        throw new Error('Each serial is required (cannot be empty)')
      }
      if (!unit.name || unit.name.trim() === '') {
        throw new Error('Each terminal name is required')
      }
    }
  }
  // Ensure that the order has payloads for every item
  for (const item of order.items) {
    if (!input.items.find((p) => p.orderItemId === item.id)) {
      throw new Error(`Missing units for item ${item.productName}`)
    }
  }

  return prisma.$transaction(async (tx) => {
    // Check uniqueness of every serial (against existing Terminal records)
    const allSerials = input.items.flatMap((p) => p.units.map((u) => u.serial.trim()))
    const existing = await tx.terminal.findFirst({
      where: { serialNumber: { in: allSerials } },
    })
    if (existing) {
      throw new Error(`Serial number already in use: ${existing.serialNumber}`)
    }

    // Create terminal records
    const terminalsToCreate = input.items.flatMap((payload) => {
      const item = itemsById[payload.orderItemId]
      return payload.units.map((unit) => ({
        venueId: order.venueId,
        terminalOrderId: order.id,
        brand: item.brand,
        model: item.model,
        name: unit.name.trim(),
        serialNumber: unit.serial.trim(),
        type: 'TPV_ANDROID' as const,
        status: 'PENDING_ACTIVATION' as const,
        activationCode: generateActivationCode(),
        activationCodeExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      }))
    })

    await tx.terminal.createMany({ data: terminalsToCreate })

    return tx.terminalOrder.update({
      where: { id: order.id },
      data: {
        fulfillmentStatus: 'SERIALS_ASSIGNED',
        serialsAssignedAt: new Date(),
        serialsAssignedBy: input.assignedBy,
      },
      include: { items: true, terminals: true },
    })
  })
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd avoqado-server && npx vitest run src/services/dashboard/terminalOrder/terminalOrder.service.test.ts`
Expected: All tests (including new assignSerials) pass.

- [ ] **Step 5: Commit**

```bash
cd avoqado-server
git add src/services/dashboard/terminalOrder/
git commit -m "feat(tpv-orders): add assignSerials with validation + tests"
```

---

### Task 8: `markShipped` + `markDelivered` service functions + tests

**Files:**
- Modify: `avoqado-server/src/services/dashboard/terminalOrder/terminalOrder.service.ts`
- Modify: `avoqado-server/src/services/dashboard/terminalOrder/terminalOrder.service.test.ts`

- [ ] **Step 1: Add test cases**

Append to `terminalOrder.service.test.ts`:

```typescript
import { markShipped, markDelivered } from './terminalOrder.service'

describe('markShipped', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects if order is not SERIALS_ASSIGNED', async () => {
    vi.mocked(prisma.terminalOrder.findUnique).mockResolvedValue({
      id: 'o', fulfillmentStatus: 'AWAITING_SERIALS',
    } as any)
    await expect(
      markShipped({ orderId: 'o', trackingNumber: 'T1', carrier: 'DHL' }),
    ).rejects.toThrow(/must be SERIALS_ASSIGNED/i)
  })

  it('updates fulfillmentStatus + tracking when valid', async () => {
    vi.mocked(prisma.terminalOrder.findUnique).mockResolvedValue({
      id: 'o', fulfillmentStatus: 'SERIALS_ASSIGNED',
    } as any)
    vi.mocked(prisma.terminalOrder.update).mockResolvedValue({ id: 'o' } as any)
    await markShipped({ orderId: 'o', trackingNumber: 'T1', carrier: 'DHL' })
    expect(prisma.terminalOrder.update).toHaveBeenCalledWith({
      where: { id: 'o' },
      data: {
        fulfillmentStatus: 'SHIPPED',
        trackingNumber: 'T1',
        carrier: 'DHL',
        shippedAt: expect.any(Date),
      },
    })
  })
})

describe('markDelivered', () => {
  it('rejects if not SHIPPED', async () => {
    vi.mocked(prisma.terminalOrder.findUnique).mockResolvedValue({
      fulfillmentStatus: 'AWAITING_SERIALS',
    } as any)
    await expect(markDelivered({ orderId: 'o' })).rejects.toThrow(/must be SHIPPED/i)
  })

  it('updates fulfillmentStatus + deliveredAt', async () => {
    vi.mocked(prisma.terminalOrder.findUnique).mockResolvedValue({
      id: 'o', fulfillmentStatus: 'SHIPPED',
    } as any)
    vi.mocked(prisma.terminalOrder.update).mockResolvedValue({ id: 'o' } as any)
    await markDelivered({ orderId: 'o' })
    const call = vi.mocked(prisma.terminalOrder.update).mock.calls[0][0]
    expect(call.data.fulfillmentStatus).toBe('DELIVERED')
    expect(call.data.deliveredAt).toBeInstanceOf(Date)
  })
})
```

- [ ] **Step 2: Add implementations**

Append to `terminalOrder.service.ts`:

```typescript
interface MarkShippedInput {
  orderId: string
  trackingNumber: string
  carrier: string
}

export async function markShipped(input: MarkShippedInput) {
  const order = await prisma.terminalOrder.findUnique({ where: { id: input.orderId } })
  if (!order) throw new Error('Order not found')
  if (order.fulfillmentStatus !== 'SERIALS_ASSIGNED') {
    throw new Error(`Order must be SERIALS_ASSIGNED before SHIPPED (current: ${order.fulfillmentStatus})`)
  }
  return prisma.terminalOrder.update({
    where: { id: input.orderId },
    data: {
      fulfillmentStatus: 'SHIPPED',
      trackingNumber: input.trackingNumber,
      carrier: input.carrier,
      shippedAt: new Date(),
    },
  })
}

interface MarkDeliveredInput {
  orderId: string
}

export async function markDelivered(input: MarkDeliveredInput) {
  const order = await prisma.terminalOrder.findUnique({ where: { id: input.orderId } })
  if (!order) throw new Error('Order not found')
  if (order.fulfillmentStatus !== 'SHIPPED') {
    throw new Error(`Order must be SHIPPED before DELIVERED (current: ${order.fulfillmentStatus})`)
  }
  return prisma.terminalOrder.update({
    where: { id: input.orderId },
    data: { fulfillmentStatus: 'DELIVERED', deliveredAt: new Date() },
  })
}
```

- [ ] **Step 3: Run tests**

Run: `cd avoqado-server && npx vitest run src/services/dashboard/terminalOrder/`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
cd avoqado-server
git add src/services/dashboard/terminalOrder/
git commit -m "feat(tpv-orders): add markShipped + markDelivered + tests"
```

---

---

## Phase B — Backend endpoints + Stripe webhook + emails

### Task 9: Zod schema + dashboard controller + route for `POST /tpv-orders`

**Files:**
- Create: `avoqado-server/src/schemas/dashboard/terminalOrder.schema.ts`
- Create: `avoqado-server/src/controllers/dashboard/terminalOrder.controller.ts`
- Modify: `avoqado-server/src/routes/dashboard.routes.ts` (add route)

- [ ] **Step 1: Write the Zod schema**

```typescript
// avoqado-server/src/schemas/dashboard/terminalOrder.schema.ts
import { z } from 'zod'

// IMPORTANT (per project memory): Zod messages must be in Spanish — they
// surface raw to users via the validation middleware.

export const createTerminalOrderSchema = z.object({
  items: z
    .array(
      z.object({
        catalogKey: z.string().min(1, 'El modelo es obligatorio'),
        quantity: z.number().int().min(1, 'Mínimo 1 unidad').max(10, 'Máximo 10 unidades por modelo'),
        namePrefix: z.string().optional(),
      }),
    )
    .min(1, 'Debes elegir al menos un modelo')
    .max(5, 'Máximo 5 modelos distintos por pedido'),
  contactName: z.string().min(1, 'El nombre del contacto es obligatorio'),
  contactEmail: z.string().email('Correo electrónico inválido'),
  contactPhone: z.string().min(1, 'El teléfono es obligatorio'),
  shippingAddress: z.string().min(1, 'La dirección es obligatoria'),
  shippingAddress2: z.string().optional(),
  shippingCity: z.string().min(1, 'La ciudad es obligatoria'),
  shippingState: z.string().min(1, 'El estado es obligatorio'),
  shippingZip: z.string().min(1, 'El código postal es obligatorio'),
  shippingCountry: z.string().optional(),
  paymentMethod: z.enum(['CARD_STRIPE', 'SPEI']),
})

export type CreateTerminalOrderBody = z.infer<typeof createTerminalOrderSchema>
```

- [ ] **Step 2: Write the controller**

```typescript
// avoqado-server/src/controllers/dashboard/terminalOrder.controller.ts
import { Request, Response, NextFunction } from 'express'
import { createOrder } from '@/services/dashboard/terminalOrder/terminalOrder.service'
import { createCheckoutSessionForOrder } from '@/services/dashboard/terminalOrder/stripeCheckout.service'
import { env } from '@/config/env'
import logger from '@/config/logger'
import prisma from '@/lib/prisma'

/**
 * POST /api/v1/dashboard/venues/:venueId/tpv-orders
 *
 * Creates a TerminalOrder. If paymentMethod is CARD_STRIPE, also creates a
 * Stripe Checkout Session and returns the redirect URL. If SPEI, returns
 * `redirectUrl: null` and the frontend should navigate to /tpv/orders/:id
 * to show bank details + upload (Plan 2).
 */
export async function createOrderHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { venueId } = req.params
    const staffId = (req as any).user?.id
    if (!staffId) {
      res.status(401).json({ success: false, error: 'Unauthenticated' })
      return
    }

    const order = await createOrder({
      venueId,
      createdById: staffId,
      ...req.body,
    })

    if (order.paymentMethod === 'CARD_STRIPE') {
      const baseUrl = env.DASHBOARD_URL ?? 'https://dashboardv2.avoqado.io'
      // Frontend expects the success/cancel URLs to include the slug.
      const venue = await prisma.venue.findUniqueOrThrow({
        where: { id: venueId },
        select: { slug: true },
      })
      const successUrl = `${baseUrl}/venues/${venue.slug}/tpv/orders/${order.id}?session_id={CHECKOUT_SESSION_ID}`
      const cancelUrl = `${baseUrl}/venues/${venue.slug}/tpv?cancelled=true`

      const { redirectUrl } = await createCheckoutSessionForOrder({
        order: order as any,
        successUrl,
        cancelUrl,
      })

      res.status(201).json({
        success: true,
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          redirectUrl,
        },
      })
      return
    }

    // SPEI path (Plan 2): no redirect, frontend navigates to confirmation page
    res.status(201).json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        redirectUrl: null,
      },
    })
  } catch (error) {
    logger.error('createOrderHandler failed', { error: error instanceof Error ? error.message : error })
    next(error)
  }
}
```

- [ ] **Step 3: Add the route**

In `avoqado-server/src/routes/dashboard.routes.ts`, find the import block near the top and add:

```typescript
import * as terminalOrderController from '../controllers/dashboard/terminalOrder.controller'
import { createTerminalOrderSchema } from '../schemas/dashboard/terminalOrder.schema'
```

Find an existing TPV-related route (e.g. `router.post('/venues/:venueId/tpvs', ...)`) and add nearby:

```typescript
router.post(
  '/venues/:venueId/tpv-orders',
  authenticateTokenMiddleware,
  validateBody(createTerminalOrderSchema),
  terminalOrderController.createOrderHandler,
)
```

(Match the existing middleware names used in the file — `authenticateTokenMiddleware` / `validateBody` may be named differently. Don't invent middleware that doesn't exist.)

- [ ] **Step 4: Boot check + lint**

Run: `cd avoqado-server && npm run build`
Expected: no TypeScript errors.

Run: `cd avoqado-server && npm run lint`
Expected: no new lint errors.

- [ ] **Step 5: Manual sanity check (no DB needed)**

Boot the server in dev: `cd avoqado-server && npm run dev`
Hit (replace `{venueId}` with a real one): `POST http://localhost:3000/api/v1/dashboard/venues/{venueId}/tpv-orders` with body:
```json
{
  "items": [{"catalogKey": "PAX_A910S", "quantity": 1}],
  "contactName": "Test",
  "contactEmail": "test@example.com",
  "contactPhone": "+52 55 1234 5678",
  "shippingAddress": "Av X 1",
  "shippingCity": "CDMX",
  "shippingState": "CDMX",
  "shippingZip": "01000",
  "paymentMethod": "CARD_STRIPE"
}
```
Expected: 201 with `{orderId, orderNumber, redirectUrl: "https://checkout.stripe.com/..."}`. (Requires Stripe test keys configured — see Pre-Deploy section.)

- [ ] **Step 6: Commit**

```bash
cd avoqado-server
git add src/schemas/dashboard/terminalOrder.schema.ts src/controllers/dashboard/terminalOrder.controller.ts src/routes/dashboard.routes.ts
git commit -m "feat(tpv-orders): add POST /tpv-orders endpoint with Stripe redirect"
```

---

### Task 10: `GET /tpv-orders` (list) + `GET /tpv-orders/:id` (detail) for dashboard

**Files:**
- Modify: `avoqado-server/src/controllers/dashboard/terminalOrder.controller.ts` (add 2 handlers)
- Modify: `avoqado-server/src/routes/dashboard.routes.ts` (add 2 routes)

- [ ] **Step 1: Add handlers to controller**

Append to `terminalOrder.controller.ts`:

```typescript
/**
 * GET /api/v1/dashboard/venues/:venueId/tpv-orders
 * Lists orders for the venue. Newest first.
 */
export async function listOrdersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { venueId } = req.params
    const orders = await prisma.terminalOrder.findMany({
      where: { venueId },
      include: { items: true, _count: { select: { terminals: true } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: orders })
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/v1/dashboard/venues/:venueId/tpv-orders/:id
 */
export async function getOrderHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { venueId, id } = req.params
    const order = await prisma.terminalOrder.findFirst({
      where: { id, venueId },
      include: {
        items: true,
        terminals: { select: { id: true, name: true, serialNumber: true, activationCode: true, status: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    })
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' })
      return
    }

    // For SPEI orders, also include the SPEI recipient bank details (env-based).
    // Plan 1 only ships CARD orders, but the field shape stays consistent.
    const speiRecipient = order.paymentMethod === 'SPEI' ? {
      beneficiary: process.env.SPEI_RECIPIENT_BENEFICIARY ?? '',
      clabe: process.env.SPEI_RECIPIENT_CLABE ?? '',
      rfc: process.env.SPEI_RECIPIENT_RFC ?? '',
      bank: process.env.SPEI_RECIPIENT_BANK ?? '',
    } : null

    res.json({ success: true, data: { ...order, speiRecipient } })
  } catch (error) {
    next(error)
  }
}
```

- [ ] **Step 2: Add routes**

In `dashboard.routes.ts`, near the POST route added in Task 9:

```typescript
router.get(
  '/venues/:venueId/tpv-orders',
  authenticateTokenMiddleware,
  terminalOrderController.listOrdersHandler,
)
router.get(
  '/venues/:venueId/tpv-orders/:id',
  authenticateTokenMiddleware,
  terminalOrderController.getOrderHandler,
)
```

- [ ] **Step 3: Build check**

Run: `cd avoqado-server && npm run build`
Expected: green.

- [ ] **Step 4: Commit**

```bash
cd avoqado-server
git add src/controllers/dashboard/terminalOrder.controller.ts src/routes/dashboard.routes.ts
git commit -m "feat(tpv-orders): add list + get endpoints for dashboard"
```

---

### Task 11: Stripe webhook handler for `checkout.session.completed`

**Files:**
- Modify: `avoqado-server/src/services/stripe.webhook.service.ts` (add case in `handleStripeWebhookEvent`)
- Create: `avoqado-server/src/services/stripe-webhooks/terminalOrderCheckoutCompleted.handler.ts`
- Create: `avoqado-server/src/services/stripe-webhooks/terminalOrderCheckoutCompleted.handler.test.ts`

- [ ] **Step 1: Write the failing handler test**

```typescript
// avoqado-server/src/services/stripe-webhooks/terminalOrderCheckoutCompleted.handler.test.ts
import { describe, expect, it, beforeEach, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  default: {
    terminalOrder: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

const sendPaymentConfirmedMock = vi.fn()
const sendSerialAssignmentMock = vi.fn()
vi.mock('@/services/email.service', () => ({
  emailService: {
    sendTerminalOrderPaymentConfirmed: sendPaymentConfirmedMock,
    sendTerminalOrderSerialAssignmentRequest: sendSerialAssignmentMock,
  },
}))

import { handleTerminalOrderCheckoutCompleted } from './terminalOrderCheckoutCompleted.handler'
import prisma from '@/lib/prisma'

const baseSession = {
  id: 'cs_test_1',
  payment_intent: 'pi_test_1',
  payment_status: 'paid',
  metadata: { terminalOrderId: 'ord_1', venueId: 'venue_1' },
} as any

const baseOrder = {
  id: 'ord_1',
  orderNumber: 'AVO-0001',
  paymentStatus: 'AWAITING_PAYMENT',
  totalCents: 464_000,
  currency: 'MXN',
  contactEmail: 'buyer@example.com',
}

describe('handleTerminalOrderCheckoutCompleted', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.terminalOrder.findUnique).mockResolvedValue(baseOrder as any)
    vi.mocked(prisma.terminalOrder.update).mockResolvedValue({ ...baseOrder, paymentStatus: 'PAID' } as any)
  })

  it('is a noop if metadata.terminalOrderId is missing', async () => {
    await handleTerminalOrderCheckoutCompleted({ ...baseSession, metadata: {} })
    expect(prisma.terminalOrder.update).not.toHaveBeenCalled()
  })

  it('is a noop if order not found', async () => {
    vi.mocked(prisma.terminalOrder.findUnique).mockResolvedValue(null)
    await handleTerminalOrderCheckoutCompleted(baseSession)
    expect(prisma.terminalOrder.update).not.toHaveBeenCalled()
  })

  it('is idempotent — does nothing if order already PAID', async () => {
    vi.mocked(prisma.terminalOrder.findUnique).mockResolvedValue({ ...baseOrder, paymentStatus: 'PAID' } as any)
    await handleTerminalOrderCheckoutCompleted(baseSession)
    expect(prisma.terminalOrder.update).not.toHaveBeenCalled()
    expect(sendPaymentConfirmedMock).not.toHaveBeenCalled()
  })

  it('updates order to PAID + AWAITING_SERIALS and triggers both emails', async () => {
    await handleTerminalOrderCheckoutCompleted(baseSession)
    expect(prisma.terminalOrder.update).toHaveBeenCalledWith({
      where: { id: 'ord_1' },
      data: {
        paymentStatus: 'PAID',
        stripePaymentIntentId: 'pi_test_1',
        fulfillmentStatus: 'AWAITING_SERIALS',
      },
    })
    expect(sendPaymentConfirmedMock).toHaveBeenCalledOnce()
    expect(sendSerialAssignmentMock).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test, verify fails**

Run: `cd avoqado-server && npx vitest run src/services/stripe-webhooks/terminalOrderCheckoutCompleted.handler.test.ts`
Expected: module not found.

- [ ] **Step 3: Write the handler**

```typescript
// avoqado-server/src/services/stripe-webhooks/terminalOrderCheckoutCompleted.handler.ts
import Stripe from 'stripe'
import prisma from '@/lib/prisma'
import { emailService } from '@/services/email.service'
import logger from '@/config/logger'

/**
 * Handles Stripe `checkout.session.completed` events that belong to a
 * TerminalOrder (identified by metadata.terminalOrderId).
 *
 * Idempotent: if the order is already PAID, this is a no-op. Stripe retries
 * webhooks aggressively, and the same event can also be received from
 * different listeners, so we must not double-process.
 */
export async function handleTerminalOrderCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.terminalOrderId
  if (!orderId) {
    // Not a terminal-order session — handled elsewhere
    return
  }

  const order = await prisma.terminalOrder.findUnique({
    where: { id: orderId },
    include: { items: true },
  })
  if (!order) {
    logger.warn('Stripe webhook: TerminalOrder not found', { orderId, sessionId: session.id })
    return
  }

  if (order.paymentStatus === 'PAID') {
    logger.info('Stripe webhook: order already PAID, skipping (idempotent)', { orderId })
    return
  }

  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null

  const updated = await prisma.terminalOrder.update({
    where: { id: order.id },
    data: {
      paymentStatus: 'PAID',
      stripePaymentIntentId: paymentIntentId ?? undefined,
      fulfillmentStatus: 'AWAITING_SERIALS',
    },
  })

  logger.info('Stripe webhook: TerminalOrder marked PAID', { orderId: order.id, orderNumber: order.orderNumber })

  // Fire emails (await so errors are caught by the webhook handler outer try)
  try {
    await emailService.sendTerminalOrderPaymentConfirmed({ order: updated as any, items: order.items })
  } catch (err) {
    logger.error('Failed to send payment-confirmed email', { error: err instanceof Error ? err.message : err })
  }

  try {
    await emailService.sendTerminalOrderSerialAssignmentRequest({ order: updated as any, items: order.items })
  } catch (err) {
    logger.error('Failed to send serial-assignment email', { error: err instanceof Error ? err.message : err })
  }
}
```

- [ ] **Step 4: Wire into the existing webhook dispatcher**

In `avoqado-server/src/services/stripe.webhook.service.ts`, find `handleStripeWebhookEvent` (around line 1027). Add inside the event-type switch:

```typescript
case 'checkout.session.completed': {
  const { handleTerminalOrderCheckoutCompleted } = await import('./stripe-webhooks/terminalOrderCheckoutCompleted.handler')
  await handleTerminalOrderCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
  break
}
```

(If a case for this event type already exists for other features, add a parallel branch inside that case to also invoke our handler — never replace existing behavior.)

- [ ] **Step 5: Run tests**

Run: `cd avoqado-server && npx vitest run src/services/stripe-webhooks/`
Expected: 4 tests pass.

- [ ] **Step 6: Build check**

Run: `cd avoqado-server && npm run build`
Expected: green.

- [ ] **Step 7: Commit**

```bash
cd avoqado-server
git add src/services/stripe-webhooks/ src/services/stripe.webhook.service.ts
git commit -m "feat(tpv-orders): add Stripe webhook handler for checkout.session.completed"
```

---

### Task 12: Email #4 — `sendTerminalOrderPaymentConfirmed` (to customer)

**Files:**
- Modify: `avoqado-server/src/services/email.service.ts` (add interface + method)

- [ ] **Step 1: Add the data interface**

Find the existing interface block in `email.service.ts` (near line 113 — `TerminalPurchaseEmailData`). Add after it:

```typescript
export interface TerminalOrderEmailItem {
  productName: string
  brand: string
  model: string
  quantity: number
  unitPriceCents: number
  namePrefix: string
}

export interface TerminalOrderEmailData {
  order: {
    id: string
    orderNumber: string
    venueId: string
    contactName: string
    contactEmail: string
    contactPhone: string
    shippingAddress: string
    shippingAddress2: string | null
    shippingCity: string
    shippingState: string
    shippingZip: string
    shippingCountry: string
    paymentMethod: 'CARD_STRIPE' | 'SPEI'
    subtotalCents: number
    taxCents: number
    totalCents: number
    currency: string
    stripeReceiptUrl?: string | null
    createdAt: Date
  }
  items: TerminalOrderEmailItem[]
}
```

- [ ] **Step 2: Add the method to the `emailService` class/object**

Find where existing methods like `sendTerminalPurchaseAdminNotification` live (around line 1512). Add a new method on the same object:

```typescript
async sendTerminalOrderPaymentConfirmed(data: TerminalOrderEmailData): Promise<boolean> {
  const { order, items } = data
  const subject = `✅ Pago confirmado ${order.orderNumber}`
  const logoUrl = 'https://avoqado.io/isotipo.svg'
  const fmtMx = (cents: number) => `$${(cents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${order.currency}`

  const itemsRows = items
    .map(
      (i) => `
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: #000;">${i.productName} × ${i.quantity}</td>
          <td style="padding: 8px 0; font-size: 14px; color: #000; text-align: right;">${fmtMx(i.unitPriceCents * i.quantity)}</td>
        </tr>`,
    )
    .join('')

  const receiptLink = order.stripeReceiptUrl
    ? `<p style="margin: 16px 0 0 0; font-size: 14px;"><a href="${order.stripeReceiptUrl}" style="color: #1a73e8; text-decoration: none;">Ver recibo de Stripe →</a></p>`
    : ''

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Pago confirmado ${order.orderNumber}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #ffffff; color: #000000;">
  <div style="max-width: 600px; margin: 0 auto; padding: 32px 24px;">
    <div style="padding-bottom: 32px;">
      <img src="${logoUrl}" alt="Avoqado" width="32" height="32" style="display: inline-block; vertical-align: middle;">
      <span style="font-size: 18px; font-weight: 700; color: #000; vertical-align: middle; margin-left: 8px;">Avoqado</span>
    </div>
    <div style="padding-bottom: 24px;">
      <h1 style="margin: 0 0 8px 0; font-size: 32px; font-weight: 400; color: #000;">Pago confirmado</h1>
      <p style="margin: 0; font-size: 16px; color: #666;">Pedido ${order.orderNumber}</p>
    </div>
    <div style="background: #ecfdf5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <p style="font-size: 14px; color: #065f46; margin: 0;">
        Recibimos tu pago. Te avisamos cuando enviemos los terminales con sus números de serie.
      </p>
    </div>
    <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #000;">Resumen</h3>
      <table cellpadding="0" cellspacing="0" style="width: 100%;">
        ${itemsRows}
        <tr><td style="padding: 8px 0; font-size: 14px; color: #666;">Subtotal</td><td style="padding: 8px 0; font-size: 14px; color: #000; text-align: right;">${fmtMx(order.subtotalCents)}</td></tr>
        <tr><td style="padding: 8px 0; font-size: 14px; color: #666;">IVA (16%)</td><td style="padding: 8px 0; font-size: 14px; color: #000; text-align: right;">${fmtMx(order.taxCents)}</td></tr>
        <tr style="border-top: 1px solid #e0e0e0;"><td style="padding: 16px 0 0 0; font-size: 16px; font-weight: 600;">Total</td><td style="padding: 16px 0 0 0; font-size: 16px; font-weight: 600; text-align: right;">${fmtMx(order.totalCents)}</td></tr>
      </table>
      ${receiptLink}
    </div>
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 0;">
    <div style="padding-top: 24px;">
      <div style="margin-bottom: 16px;">
        <img src="${logoUrl}" alt="Avoqado" width="24" height="24" style="display: inline-block; vertical-align: middle;">
        <span style="font-size: 16px; font-weight: 700; color: #000; vertical-align: middle; margin-left: 8px;">Avoqado</span>
      </div>
      <p style="margin: 0; font-size: 14px; color: #666;">Correo automático enviado por Avoqado Dashboard</p>
    </div>
  </div>
</body></html>`

  const text = `Pago confirmado — ${order.orderNumber}\n\n` +
    items.map((i) => `${i.productName} × ${i.quantity}: ${fmtMx(i.unitPriceCents * i.quantity)}`).join('\n') +
    `\n\nSubtotal: ${fmtMx(order.subtotalCents)}\nIVA (16%): ${fmtMx(order.taxCents)}\nTotal: ${fmtMx(order.totalCents)}\n` +
    (order.stripeReceiptUrl ? `\nRecibo: ${order.stripeReceiptUrl}\n` : '') +
    `\nTe avisamos cuando enviemos los terminales.\n\nAvoqado`

  return this.sendEmail({ to: order.contactEmail, subject, html, text })
},
```

- [ ] **Step 3: Build check**

Run: `cd avoqado-server && npm run build`
Expected: green.

- [ ] **Step 4: Commit**

```bash
cd avoqado-server
git add src/services/email.service.ts
git commit -m "feat(tpv-orders): add payment-confirmed email template"
```

---

### Task 13: Email #5 — `sendTerminalOrderSerialAssignmentRequest` (to sales)

**Files:**
- Modify: `avoqado-server/src/services/email.service.ts`

- [ ] **Step 1: Add the method**

In `email.service.ts`, right after the method from Task 12, add:

```typescript
async sendTerminalOrderSerialAssignmentRequest(data: TerminalOrderEmailData): Promise<boolean> {
  const adminEmail = process.env.ORDER_NOTIFICATIONS_EMAIL
  if (!adminEmail) {
    logger.warn('ORDER_NOTIFICATIONS_EMAIL not configured — skipping serial-assignment notification')
    return false
  }

  const { order, items } = data
  const subject = `💰 Asigna números de serie — ${order.orderNumber}`
  const logoUrl = 'https://avoqado.io/isotipo.svg'
  const fmtMx = (cents: number) => `$${(cents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${order.currency}`

  const dashboardUrl = process.env.DASHBOARD_URL ?? 'https://dashboardv2.avoqado.io'
  // Plan 1: no magic link yet — sales clicks through to the superadmin UI (login required).
  // Plan 3 will swap this for a token-based magic link.
  const adminUrl = `${dashboardUrl}/superadmin/tpv-orders/${order.id}`

  const itemsRows = items
    .map((i) => `
      <tr>
        <td style="padding: 8px 0; font-size: 14px; color: #000;">${i.productName}</td>
        <td style="padding: 8px 0; font-size: 14px; color: #000; text-align: right;">${i.quantity} unidad${i.quantity === 1 ? '' : 'es'}</td>
      </tr>`)
    .join('')

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Asigna serials ${order.orderNumber}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #ffffff; color: #000000;">
  <div style="max-width: 600px; margin: 0 auto; padding: 32px 24px;">
    <div style="padding-bottom: 32px;">
      <img src="${logoUrl}" alt="Avoqado" width="32" height="32" style="display: inline-block; vertical-align: middle;">
      <span style="font-size: 18px; font-weight: 700; color: #000; vertical-align: middle; margin-left: 8px;">Avoqado</span>
    </div>
    <div style="padding-bottom: 24px;">
      <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 400;">Pedido pagado — Asigna serials</h1>
      <p style="margin: 0; font-size: 16px; color: #666;">${order.orderNumber} · ${order.contactName}</p>
    </div>
    <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <p style="font-size: 14px; color: #92400e; margin: 0;"><strong>Acción requerida:</strong> Asigna los números de serie de los dispositivos a enviar y se notifica automáticamente al cliente.</p>
    </div>
    <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Items a asignar</h3>
      <table cellpadding="0" cellspacing="0" style="width: 100%;">${itemsRows}</table>
      <p style="margin: 16px 0 0 0; font-size: 14px; color: #666;">Total cobrado: <strong style="color: #000;">${fmtMx(order.totalCents)}</strong></p>
    </div>
    <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Envío a</h3>
      <p style="font-size: 14px; margin: 0;"><strong>${order.contactName}</strong><br>${order.shippingAddress}${order.shippingAddress2 ? `, ${order.shippingAddress2}` : ''}<br>${order.shippingCity}, ${order.shippingState} ${order.shippingZip}<br>${order.shippingCountry}<br><br>Teléfono: ${order.contactPhone}<br>Email: ${order.contactEmail}</p>
    </div>
    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${adminUrl}" style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Asignar números de serie</a>
    </div>
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 0;">
    <div style="padding-top: 24px;">
      <p style="margin: 0; font-size: 14px; color: #666;">Avoqado · Notificación de pedido pagado</p>
    </div>
  </div>
</body></html>`

  const text = `Pedido pagado — ${order.orderNumber}\n\n` +
    items.map((i) => `${i.productName} × ${i.quantity}`).join('\n') +
    `\n\nTotal: ${fmtMx(order.totalCents)}\nCliente: ${order.contactName} <${order.contactEmail}>\nTeléfono: ${order.contactPhone}\n\nEnvío: ${order.shippingAddress}, ${order.shippingCity}, ${order.shippingState}, ${order.shippingZip}\n\nAsignar serials: ${adminUrl}\n`

  return this.sendEmail({ to: adminEmail, subject, html, text })
},
```

- [ ] **Step 2: Build check**

Run: `cd avoqado-server && npm run build`
Expected: green.

- [ ] **Step 3: Commit**

```bash
cd avoqado-server
git add src/services/email.service.ts
git commit -m "feat(tpv-orders): add serial-assignment email to sales team"
```

---

### Task 14: Email #6 — `sendTerminalOrderTerminalsShipped` (to customer)

**Files:**
- Modify: `avoqado-server/src/services/email.service.ts`

- [ ] **Step 1: Add the interface extension**

Append to the interface block:

```typescript
export interface TerminalOrderShippedEmailData extends TerminalOrderEmailData {
  terminals: Array<{
    id: string
    name: string
    serialNumber: string | null
    activationCode: string | null
    brand: string
    model: string
  }>
}
```

- [ ] **Step 2: Add the method**

```typescript
async sendTerminalOrderTerminalsShipped(data: TerminalOrderShippedEmailData): Promise<boolean> {
  const { order, terminals } = data
  const subject = `📦 Tu pedido ${order.orderNumber} está en camino`
  const logoUrl = 'https://avoqado.io/isotipo.svg'

  const termRows = terminals
    .map((t) => `
      <tr style="background: #f5f5f5;">
        <td style="padding: 12px 8px; font-size: 14px; color: #000;"><strong>${t.name}</strong><br><span style="font-size: 12px; color: #666;">${t.brand} ${t.model}</span></td>
        <td style="padding: 12px 8px; font-size: 13px; color: #000; font-family: monospace;">${t.serialNumber ?? '—'}</td>
        <td style="padding: 12px 8px; font-size: 16px; color: #000; font-family: monospace; font-weight: 600; text-align: center;">${t.activationCode ?? '—'}</td>
      </tr>`)
    .join('')

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Tu pedido está en camino</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #ffffff; color: #000000;">
  <div style="max-width: 600px; margin: 0 auto; padding: 32px 24px;">
    <div style="padding-bottom: 32px;">
      <img src="${logoUrl}" alt="Avoqado" width="32" height="32" style="display: inline-block; vertical-align: middle;">
      <span style="font-size: 18px; font-weight: 700; color: #000; vertical-align: middle; margin-left: 8px;">Avoqado</span>
    </div>
    <div style="padding-bottom: 24px;">
      <h1 style="margin: 0 0 8px 0; font-size: 32px; font-weight: 400;">📦 Tu pedido está en camino</h1>
      <p style="margin: 0; font-size: 16px; color: #666;">Pedido ${order.orderNumber}</p>
    </div>
    <div style="background: #ecfdf5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <p style="font-size: 14px; color: #065f46; margin: 0;">Tus terminales fueron asignados y se enviarán pronto. Cuando los recibas, usa los códigos de activación para encenderlos.</p>
    </div>
    <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Terminales asignados</h3>
      <table cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
        <thead><tr><th style="padding: 8px; text-align: left; font-size: 12px; color: #666; text-transform: uppercase;">Nombre / Modelo</th><th style="padding: 8px; text-align: left; font-size: 12px; color: #666; text-transform: uppercase;">Serial</th><th style="padding: 8px; text-align: center; font-size: 12px; color: #666; text-transform: uppercase;">Código activación</th></tr></thead>
        <tbody>${termRows}</tbody>
      </table>
    </div>
    <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Cómo activarlos</h3>
      <ol style="font-size: 14px; margin: 0; padding-left: 20px; color: #000;">
        <li style="margin-bottom: 8px;">Enciende el dispositivo físico (PAX A910S, NexGo N62 o N86).</li>
        <li style="margin-bottom: 8px;">Abre la app Avoqado TPV.</li>
        <li style="margin-bottom: 8px;">Ingresa el código de activación de 6 caracteres correspondiente.</li>
        <li>El terminal queda listo para procesar pagos.</li>
      </ol>
      <p style="font-size: 13px; color: #92400e; background: #fef3c7; padding: 12px; border-radius: 6px; margin: 16px 0 0 0;">⚠️ Los códigos de activación expiran a los 30 días. Activa cuanto antes.</p>
    </div>
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 0;">
    <div style="padding-top: 24px;">
      <p style="margin: 0; font-size: 14px; color: #666;">Avoqado · Pedido enviado</p>
    </div>
  </div>
</body></html>`

  const text = `Tu pedido ${order.orderNumber} está en camino\n\n` +
    terminals.map((t) => `${t.name} (${t.brand} ${t.model}) — Serial: ${t.serialNumber ?? '—'} — Código activación: ${t.activationCode ?? '—'}`).join('\n') +
    `\n\nLos códigos expiran a los 30 días.\n\nAvoqado`

  return this.sendEmail({ to: order.contactEmail, subject, html, text })
},
```

- [ ] **Step 3: Build check**

Run: `cd avoqado-server && npm run build`
Expected: green.

- [ ] **Step 4: Commit**

```bash
cd avoqado-server
git add src/services/email.service.ts
git commit -m "feat(tpv-orders): add terminals-shipped email with activation codes"
```

---

### Task 15: Wire email #6 into `assignSerials` service + integration test

**Files:**
- Modify: `avoqado-server/src/services/dashboard/terminalOrder/terminalOrder.service.ts`
- Modify: `avoqado-server/src/services/dashboard/terminalOrder/terminalOrder.service.test.ts`

- [ ] **Step 1: Update the test for assignSerials to verify email is fired**

Add to `terminalOrder.service.test.ts`:

```typescript
const sendShippedMock = vi.fn()
vi.mock('@/services/email.service', () => ({
  emailService: { sendTerminalOrderTerminalsShipped: sendShippedMock },
}))

it('assignSerials fires the shipped email after creating terminals', async () => {
  vi.mocked(prisma.terminalOrder.findUnique).mockResolvedValue(orderWithItemsPaid as any)
  await assignSerials({
    orderId: 'ord_paid', assignedBy: 'sales@avoqado.io',
    items: [{ orderItemId: 'oi_1', units: [{ name: 'PAX 1', serial: 'S-1' }, { name: 'PAX 2', serial: 'S-2' }] }],
  })
  expect(sendShippedMock).toHaveBeenCalledOnce()
  const callArgs = sendShippedMock.mock.calls[0][0]
  expect(callArgs.terminals).toHaveLength(2)
})
```

- [ ] **Step 2: Update `assignSerials` to fire the email**

In `terminalOrder.service.ts`, modify the `assignSerials` function. After the `$transaction` block, before `return updated`:

```typescript
// Fire shipped email — don't fail the assignment if email fails
try {
  await emailService.sendTerminalOrderTerminalsShipped({
    order: updatedOrder as any,
    items: order.items,
    terminals: updatedOrder.terminals,
  })
} catch (err) {
  logger.error('Failed to send terminals-shipped email', { error: err instanceof Error ? err.message : err })
}
```

(Adjust variable names to match what your `$transaction` returns. The original function returned the order with terminals included — preserve that.)

At the top of the file add:

```typescript
import { emailService } from '@/services/email.service'
import logger from '@/config/logger'
```

- [ ] **Step 3: Run tests**

Run: `cd avoqado-server && npx vitest run src/services/dashboard/terminalOrder/`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
cd avoqado-server
git add src/services/dashboard/terminalOrder/
git commit -m "feat(tpv-orders): trigger shipped email after assignSerials"
```

---

### Task 16: Superadmin controllers + routes (list, get, assign-serials, mark-shipped, mark-delivered)

**Files:**
- Create: `avoqado-server/src/controllers/superadmin/terminalOrder.superadmin.controller.ts`
- Modify: `avoqado-server/src/routes/superadmin.routes.ts`
- Create: `avoqado-server/src/schemas/superadmin/terminalOrder.superadmin.schema.ts`

- [ ] **Step 1: Write the Zod schemas**

```typescript
// avoqado-server/src/schemas/superadmin/terminalOrder.superadmin.schema.ts
import { z } from 'zod'

export const assignSerialsSchema = z.object({
  items: z.array(z.object({
    orderItemId: z.string().min(1),
    units: z.array(z.object({
      name: z.string().min(1, 'El nombre es obligatorio'),
      serial: z.string().min(1, 'El número de serie es obligatorio'),
    })).min(1),
  })).min(1),
})

export const markShippedSchema = z.object({
  trackingNumber: z.string().min(1, 'El número de rastreo es obligatorio'),
  carrier: z.string().min(1, 'La paquetería es obligatoria'),
})
```

- [ ] **Step 2: Write the controller**

```typescript
// avoqado-server/src/controllers/superadmin/terminalOrder.superadmin.controller.ts
import { Request, Response, NextFunction } from 'express'
import prisma from '@/lib/prisma'
import {
  assignSerials,
  markShipped,
  markDelivered,
} from '@/services/dashboard/terminalOrder/terminalOrder.service'
import logger from '@/config/logger'

export async function listAllOrdersHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const orders = await prisma.terminalOrder.findMany({
      include: {
        items: true,
        venue: { select: { id: true, name: true, slug: true } },
        _count: { select: { terminals: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: orders })
  } catch (error) { next(error) }
}

export async function getOrderHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await prisma.terminalOrder.findUnique({
      where: { id: req.params.id },
      include: {
        items: true,
        venue: { select: { id: true, name: true, slug: true } },
        terminals: { select: { id: true, name: true, serialNumber: true, activationCode: true, status: true, activationCodeExpiry: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    })
    if (!order) { res.status(404).json({ success: false, error: 'Not found' }); return }
    res.json({ success: true, data: order })
  } catch (error) { next(error) }
}

export async function assignSerialsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const staff = (req as any).user
    const updated = await assignSerials({
      orderId: req.params.id,
      assignedBy: staff?.email ?? 'unknown@avoqado.io',
      items: req.body.items,
    })
    res.json({ success: true, data: updated })
  } catch (error) {
    logger.error('assignSerialsHandler failed', { error: error instanceof Error ? error.message : error })
    if (error instanceof Error) {
      res.status(400).json({ success: false, error: error.message })
      return
    }
    next(error)
  }
}

export async function markShippedHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const updated = await markShipped({ orderId: req.params.id, trackingNumber: req.body.trackingNumber, carrier: req.body.carrier })
    res.json({ success: true, data: updated })
  } catch (error) {
    if (error instanceof Error) { res.status(400).json({ success: false, error: error.message }); return }
    next(error)
  }
}

export async function markDeliveredHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const updated = await markDelivered({ orderId: req.params.id })
    res.json({ success: true, data: updated })
  } catch (error) {
    if (error instanceof Error) { res.status(400).json({ success: false, error: error.message }); return }
    next(error)
  }
}
```

- [ ] **Step 3: Wire routes**

In `avoqado-server/src/routes/superadmin.routes.ts`, near other superadmin routes, add the imports and routes (match existing auth middleware naming — likely `requireSuperadmin`):

```typescript
import * as terminalOrderSuperadminController from '../controllers/superadmin/terminalOrder.superadmin.controller'
import { assignSerialsSchema, markShippedSchema } from '../schemas/superadmin/terminalOrder.superadmin.schema'

router.get('/tpv-orders', requireSuperadmin, terminalOrderSuperadminController.listAllOrdersHandler)
router.get('/tpv-orders/:id', requireSuperadmin, terminalOrderSuperadminController.getOrderHandler)
router.post('/tpv-orders/:id/assign-serials', requireSuperadmin, validateBody(assignSerialsSchema), terminalOrderSuperadminController.assignSerialsHandler)
router.post('/tpv-orders/:id/mark-shipped', requireSuperadmin, validateBody(markShippedSchema), terminalOrderSuperadminController.markShippedHandler)
router.post('/tpv-orders/:id/mark-delivered', requireSuperadmin, terminalOrderSuperadminController.markDeliveredHandler)
```

- [ ] **Step 4: Build check**

Run: `cd avoqado-server && npm run build`
Expected: green.

- [ ] **Step 5: Commit**

```bash
cd avoqado-server
git add src/controllers/superadmin/terminalOrder.superadmin.controller.ts src/schemas/superadmin/terminalOrder.superadmin.schema.ts src/routes/superadmin.routes.ts
git commit -m "feat(tpv-orders): add superadmin endpoints (list, get, assign, ship, deliver)"
```

---

---

## Phase C — Frontend wizard refactor (FullScreenModal + catalog + cart)

### Task 17: TPV catalog (frontend mirror) + tpvOrder service

**Files:**
- Create: `avoqado-web-dashboard/src/config/tpvCatalog.ts` (mirror of backend, keep in sync)
- Create: `avoqado-web-dashboard/src/services/tpvOrder.service.ts`

- [ ] **Step 1: Write the frontend catalog**

```typescript
// avoqado-web-dashboard/src/config/tpvCatalog.ts
//
// This file is a mirror of avoqado-server/src/config/tpvCatalog.ts.
// Keep them in sync — update both when changing prices or specs.

export interface TpvSpecs {
  dimensions?: string
  weight?: string
  battery?: string
  display?: string
  os?: string
  connectivity?: string[]
  scanner?: string
  camera?: string
  printer?: string
}

export interface TpvCatalogEntry {
  brand: string
  model: string
  name: string
  description: string
  unitPriceCents: number // MXN, sin IVA
  image: string
  features: string[]
  specs: TpvSpecs
}

export const TPV_CATALOG: Record<string, TpvCatalogEntry> = {
  PAX_A910S: {
    brand: 'PAX',
    model: 'A910S',
    name: 'PAX A910S',
    description: 'Potente TPV de bolsillo con pagos integrados',
    unitPriceCents: 400_000,
    image: '/images/tpv/pax-a910s.png',
    features: ['Pantalla táctil 5"', 'Escáner integrado', 'Cámara para QR', 'Conectividad 4G'],
    specs: {
      dimensions: 'TBD', weight: 'TBD', battery: 'TBD',
      display: '5", 720x1280', os: 'Android 8.1',
      connectivity: ['4G LTE', 'WiFi 2.4/5GHz', 'Bluetooth 4.2'],
      scanner: '1D/2D', camera: '2MP rear', printer: 'Térmica 58mm',
    },
  },
  NEXGO_N62: {
    brand: 'NEXGO',
    model: 'N62',
    name: 'NexGo N62',
    description: 'TPV compacto, ideal para movilidad',
    unitPriceCents: 180_000,
    image: '/images/tpv/nexgo-n62.png',
    features: ['Pantalla compacta', 'Escáner por cámara', 'Conectividad 4G', 'Batería extendida'],
    specs: {
      dimensions: 'TBD', weight: 'TBD', battery: 'TBD',
      display: 'TBD', os: 'Android', connectivity: ['4G LTE'], scanner: 'Cámara',
    },
  },
  NEXGO_N86: {
    brand: 'NEXGO',
    model: 'N86',
    name: 'NexGo N86',
    description: 'TPV premium con pantalla grande y escáner físico',
    unitPriceCents: 300_000,
    image: '/images/tpv/nexgo-n86.png',
    features: ['Pantalla 6"', 'Escáner físico 1D/2D', 'Conectividad 4G + WiFi', 'Cámara para QR'],
    specs: {
      dimensions: 'TBD', weight: 'TBD', battery: 'TBD',
      display: '6"', os: 'Android', connectivity: ['4G LTE', 'WiFi'], scanner: '1D/2D',
    },
  },
}

export const TAX_RATE = 0.16

export type TpvCatalogKey = keyof typeof TPV_CATALOG

export function formatMxnCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export interface CartLine {
  catalogKey: TpvCatalogKey
  quantity: number
}

export function calculateCartTotals(cart: CartLine[]) {
  let subtotalCents = 0
  for (const line of cart) {
    const entry = TPV_CATALOG[line.catalogKey]
    if (!entry) continue
    subtotalCents += entry.unitPriceCents * line.quantity
  }
  const taxCents = Math.round(subtotalCents * TAX_RATE)
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents }
}
```

- [ ] **Step 2: Write the service**

```typescript
// avoqado-web-dashboard/src/services/tpvOrder.service.ts
import api from '@/api'

export type TerminalOrderPaymentMethod = 'CARD_STRIPE' | 'SPEI'
export type TerminalOrderPaymentStatus =
  | 'AWAITING_PAYMENT'
  | 'AWAITING_PROOF'
  | 'PROOF_UPLOADED'
  | 'PAID'
  | 'REJECTED'
  | 'EXPIRED'
  | 'REFUNDED'
export type TerminalOrderFulfillmentStatus =
  | 'NEW'
  | 'AWAITING_SERIALS'
  | 'SERIALS_ASSIGNED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'

export interface CreateOrderItemPayload {
  catalogKey: string
  quantity: number
  namePrefix?: string
}

export interface CreateOrderPayload {
  items: CreateOrderItemPayload[]
  contactName: string
  contactEmail: string
  contactPhone: string
  shippingAddress: string
  shippingAddress2?: string
  shippingCity: string
  shippingState: string
  shippingZip: string
  shippingCountry?: string
  paymentMethod: TerminalOrderPaymentMethod
}

export interface CreateOrderResponse {
  orderId: string
  orderNumber: string
  redirectUrl: string | null
}

export interface TerminalOrderItem {
  id: string
  brand: string
  model: string
  productName: string
  quantity: number
  unitPriceCents: number
  namePrefix: string
}

export interface TerminalOrder {
  id: string
  orderNumber: string
  venueId: string
  contactName: string
  contactEmail: string
  contactPhone: string
  shippingAddress: string
  shippingAddress2: string | null
  shippingCity: string
  shippingState: string
  shippingZip: string
  shippingCountry: string
  paymentMethod: TerminalOrderPaymentMethod
  paymentStatus: TerminalOrderPaymentStatus
  fulfillmentStatus: TerminalOrderFulfillmentStatus
  subtotalCents: number
  taxCents: number
  totalCents: number
  currency: string
  stripeReceiptUrl: string | null
  items: TerminalOrderItem[]
  terminals?: Array<{
    id: string
    name: string
    serialNumber: string | null
    activationCode: string | null
    status: string
  }>
  speiRecipient?: {
    beneficiary: string
    clabe: string
    rfc: string
    bank: string
  } | null
  createdAt: string
  updatedAt: string
}

export const tpvOrderService = {
  async create(venueId: string, payload: CreateOrderPayload): Promise<CreateOrderResponse> {
    const { data } = await api.post(`/api/v1/dashboard/venues/${venueId}/tpv-orders`, payload)
    return data.data
  },

  async listForVenue(venueId: string): Promise<TerminalOrder[]> {
    const { data } = await api.get(`/api/v1/dashboard/venues/${venueId}/tpv-orders`)
    return data.data
  },

  async getById(venueId: string, orderId: string): Promise<TerminalOrder> {
    const { data } = await api.get(`/api/v1/dashboard/venues/${venueId}/tpv-orders/${orderId}`)
    return data.data
  },
}
```

- [ ] **Step 3: Commit**

```bash
cd avoqado-web-dashboard
git add src/config/tpvCatalog.ts src/services/tpvOrder.service.ts
git commit -m "feat(tpv-orders): add frontend catalog + tpvOrder service"
```

---

### Task 18: Refactor wizard from `<Dialog>` to `<FullScreenModal>` (preserve behavior)

**Files:**
- Modify: `avoqado-web-dashboard/src/pages/Tpv/components/purchase-wizard/TerminalPurchaseWizard.tsx`

**Why this is its own task:** Refactoring the modal shell without changing form logic isolates risk. After this task the wizard should still work exactly as before — only the chrome changes.

- [ ] **Step 1: Replace the Dialog imports + JSX**

In `TerminalPurchaseWizard.tsx`:

Remove the import:
```typescript
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
```

Add:
```typescript
import { FullScreenModal } from '@/components/ui/full-screen-modal'
```

Replace the return JSX root from:
```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>{t('purchaseWizard.title')}</DialogTitle>
      <DialogDescription>{t('purchaseWizard.subtitle')}</DialogDescription>
    </DialogHeader>
    ...content...
    <DialogFooter className="flex justify-between sm:justify-between">
      ...buttons...
    </DialogFooter>
  </DialogContent>
</Dialog>
```

To:
```tsx
<FullScreenModal
  open={open}
  onClose={() => onOpenChange(false)}
  title={t('purchaseWizard.title')}
  subtitle={t('purchaseWizard.subtitle')}
  contentClassName="bg-muted/30"
  actions={
    <Button onClick={handleNext} disabled={isLoading} data-tour="tpv-wizard-next">
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {currentStep < TOTAL_STEPS ? (
        <>{tCommon('next')}<ChevronRight className="ml-2 h-4 w-4" /></>
      ) : (
        <>{t('purchaseWizard.step4.placeOrder')}<Check className="ml-2 h-4 w-4" /></>
      )}
    </Button>
  }
>
  <div className="mx-auto w-full max-w-3xl px-6 py-8 space-y-6">
    {/* Progress Bar */}
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{getStepTitle()}</span>
        <span>{tCommon('step')} {currentStep} {tCommon('of')} {TOTAL_STEPS}</span>
      </div>
      <Progress value={progressPercentage} className="h-2" />
    </div>

    {/* Step Content */}
    <div>
      {currentStep === 1 && (<Form {...step1Form}><Step1Configuration form={step1Form} /></Form>)}
      {currentStep === 2 && (<Form {...step2Form}><Step2ShippingInfo form={step2Form} wasPreFilled={wasPreFilled} /></Form>)}
      {currentStep === 3 && (<Form {...step3Form}><Step3PaymentMethod form={step3Form} /></Form>)}
      {currentStep === 4 && step1Data && step2Data && step3Data && (
        <Form {...step4Form}>
          <Step4ReviewConfirm form={step4Form} step1Data={step1Data} step2Data={step2Data} step3Data={step3Data} onEditStep={handleEditStep} />
        </Form>
      )}
    </div>

    {/* Back + Cancel below content */}
    <div className="flex justify-between pt-4 border-t border-input">
      <Button type="button" variant="outline" onClick={handleBack} disabled={currentStep === 1 || isLoading}>
        <ChevronLeft className="mr-2 h-4 w-4" />{tCommon('back')}
      </Button>
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
        {tCommon('cancel')}
      </Button>
    </div>
  </div>
</FullScreenModal>
```

- [ ] **Step 2: Smoke test the wizard manually**

Run dev server: `cd avoqado-web-dashboard && npm run dev`. Open `/venues/:slug/tpv`, click "Comprar Terminal". Confirm the wizard opens full-screen, the 4 steps still navigate, and the existing demo flow still completes (it'll be replaced in Task 22, but should still create the legacy demo terminals).

- [ ] **Step 3: Build + lint**

Run: `cd avoqado-web-dashboard && npm run build && npm run lint`
Expected: green.

- [ ] **Step 4: Commit**

```bash
cd avoqado-web-dashboard
git add src/pages/Tpv/components/purchase-wizard/TerminalPurchaseWizard.tsx
git commit -m "refactor(tpv-purchase): wizard uses FullScreenModal per ui-patterns rule"
```

---

### Task 19: New `Step1Configuration` — catalog cards + cart

**Files:**
- Modify: `avoqado-web-dashboard/src/pages/Tpv/components/purchase-wizard/wizard-steps/Step1Configuration.tsx` (full rewrite)

- [ ] **Step 1: Replace Step1Configuration with the catalog UI**

Replace the entire file with:

```tsx
import { Minus, Plus, Trash2, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { TPV_CATALOG, TpvCatalogKey, formatMxnCents, calculateCartTotals, type CartLine } from '@/config/tpvCatalog'

export interface Step1Data {
  cart: CartLine[]
}

interface Step1ConfigurationProps {
  cart: CartLine[]
  onChange: (cart: CartLine[]) => void
}

const CATALOG_ORDER: TpvCatalogKey[] = ['PAX_A910S', 'NEXGO_N62', 'NEXGO_N86']

export function Step1Configuration({ cart, onChange }: Step1ConfigurationProps) {
  const { t } = useTranslation('tpv')
  const totals = calculateCartTotals(cart)
  const totalUnits = cart.reduce((sum, l) => sum + l.quantity, 0)

  const updateQuantity = (key: TpvCatalogKey, delta: number) => {
    const existing = cart.find((l) => l.catalogKey === key)
    if (!existing) {
      if (delta > 0) onChange([...cart, { catalogKey: key, quantity: 1 }])
      return
    }
    const newQty = existing.quantity + delta
    if (newQty <= 0) {
      onChange(cart.filter((l) => l.catalogKey !== key))
    } else if (newQty <= 10) {
      onChange(cart.map((l) => (l.catalogKey === key ? { ...l, quantity: newQty } : l)))
    }
  }

  const removeFromCart = (key: TpvCatalogKey) => onChange(cart.filter((l) => l.catalogKey !== key))

  return (
    <div className="space-y-6">
      {/* Catalog cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CATALOG_ORDER.map((key) => {
          const entry = TPV_CATALOG[key]
          const inCart = cart.find((l) => l.catalogKey === key)
          return (
            <Card
              key={key}
              data-tour={`tpv-catalog-${entry.model.toLowerCase()}`}
              className="p-4 flex flex-col gap-3 border-input"
            >
              <div className="aspect-square w-full bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <img src={entry.image} alt={entry.name} className="object-contain max-w-full max-h-full"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">{entry.name}</h3>
                <p className="text-sm text-muted-foreground">{entry.description}</p>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground flex-1">
                {entry.features.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              <div className="pt-2">
                <div className="text-2xl font-bold">{formatMxnCents(entry.unitPriceCents)}</div>
                <div className="text-xs text-muted-foreground">+ IVA (16%) por unidad</div>
              </div>
              <SpecsDrawer entry={entry} />
              {inCart ? (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button size="icon" variant="outline" onClick={() => updateQuantity(key, -1)} data-tour={`tpv-cart-decrement-${entry.model.toLowerCase()}`}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-10 text-center font-semibold text-lg">{inCart.quantity}</span>
                  <Button size="icon" variant="outline" onClick={() => updateQuantity(key, 1)} disabled={totalUnits >= 10} data-tour={`tpv-cart-increment-${entry.model.toLowerCase()}`}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button onClick={() => updateQuantity(key, 1)} className="w-full" data-tour={`tpv-cart-add-${entry.model.toLowerCase()}`} disabled={totalUnits >= 10}>
                  {t('purchaseWizard.step1.catalog.add')}
                </Button>
              )}
            </Card>
          )
        })}
      </div>

      {/* Cart summary */}
      <Card className="border-input" data-tour="tpv-cart-summary">
        <div className="p-5 space-y-3">
          <h3 className="font-semibold">{t('purchaseWizard.step1.cart.title')}</h3>
          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('purchaseWizard.step1.cart.empty')}</p>
          ) : (
            <>
              <div className="space-y-2">
                {cart.map((line) => {
                  const entry = TPV_CATALOG[line.catalogKey]
                  if (!entry) return null
                  return (
                    <div key={line.catalogKey} className="flex items-center justify-between text-sm">
                      <span>{entry.name} × {line.quantity}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{formatMxnCents(entry.unitPriceCents * line.quantity)}</span>
                        <Button size="icon" variant="ghost" onClick={() => removeFromCart(line.catalogKey as TpvCatalogKey)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <hr className="border-input" />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t('purchaseWizard.step1.cart.subtotal')}</span><span>{formatMxnCents(totals.subtotalCents)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('purchaseWizard.step1.cart.tax')}</span><span>{formatMxnCents(totals.taxCents)}</span></div>
                <div className="flex justify-between text-base font-bold pt-1 border-t border-input"><span>{t('purchaseWizard.step1.cart.total')}</span><span>{formatMxnCents(totals.totalCents)} MXN</span></div>
              </div>
            </>
          )}
        </div>
      </Card>

      {totalUnits >= 10 && (
        <p className="text-sm text-amber-700 dark:text-amber-300">{t('purchaseWizard.step1.cart.maxUnits')}</p>
      )}
    </div>
  )
}

function SpecsDrawer({ entry }: { entry: typeof TPV_CATALOG[string] }) {
  const { t } = useTranslation('tpv')
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
          {t('purchaseWizard.step1.catalog.viewSpecs')}
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 text-xs text-muted-foreground space-y-1">
        {entry.specs.dimensions && <div><strong>Dimensiones:</strong> {entry.specs.dimensions}</div>}
        {entry.specs.weight && <div><strong>Peso:</strong> {entry.specs.weight}</div>}
        {entry.specs.display && <div><strong>Pantalla:</strong> {entry.specs.display}</div>}
        {entry.specs.battery && <div><strong>Batería:</strong> {entry.specs.battery}</div>}
        {entry.specs.os && <div><strong>SO:</strong> {entry.specs.os}</div>}
        {entry.specs.connectivity && <div><strong>Conectividad:</strong> {entry.specs.connectivity.join(', ')}</div>}
        {entry.specs.scanner && <div><strong>Escáner:</strong> {entry.specs.scanner}</div>}
        {entry.specs.camera && <div><strong>Cámara:</strong> {entry.specs.camera}</div>}
        {entry.specs.printer && <div><strong>Impresora:</strong> {entry.specs.printer}</div>}
      </CollapsibleContent>
    </Collapsible>
  )
}
```

- [ ] **Step 2: Update parent wizard to manage cart state**

In `TerminalPurchaseWizard.tsx`, replace `step1Form` state with cart state:

```typescript
const [cart, setCart] = useState<CartLine[]>([])
```

(Add `import { CartLine } from '@/config/tpvCatalog'` at the top.)

Remove the `useForm<Step1Data>` for step1 (no longer needed — cart isn't a form).

Update step 1 render:
```tsx
{currentStep === 1 && <Step1Configuration cart={cart} onChange={setCart} />}
```

Update `handleNext` for step 1:
```typescript
if (currentStep === 1) {
  if (cart.length === 0) {
    toast({ title: tCommon('common.error'), description: t('purchaseWizard.step1.cart.validationEmpty'), variant: 'destructive' })
    return
  }
  setCurrentStep(2)
  // existing pre-fill of step2 logic stays
}
```

In `handleComplete`, replace the `step1Data`-derived `quantity`/`prefix` logic with cart-derived items (this is set up properly in Task 22 below; for now the new mutation isn't wired yet).

- [ ] **Step 3: Smoke test**

Run dev. Open wizard. Add a PAX A910S to cart. Increment / decrement. Add a NexGo. Verify total math matches expected (`(400000 + 180000) * 1.16 = 672800` cents = $6,728.00 MXN). Click Siguiente → step 2 still works.

- [ ] **Step 4: Build + lint**

Run: `cd avoqado-web-dashboard && npm run build && npm run lint`
Expected: green. (You'll have TS errors in `handleComplete` referencing old `step1Data` — comment out or stub those temporarily until Task 22 fixes the mutation. Make this explicit in the commit message.)

- [ ] **Step 5: Commit**

```bash
cd avoqado-web-dashboard
git add src/pages/Tpv/components/purchase-wizard/wizard-steps/Step1Configuration.tsx src/pages/Tpv/components/purchase-wizard/TerminalPurchaseWizard.tsx
git commit -m "feat(tpv-purchase): step 1 = catalog cards + multi-model cart"
```

---

### Task 20: Simplify `Step2ShippingInfo` — remove shipping speed selector

**Files:**
- Modify: `avoqado-web-dashboard/src/pages/Tpv/components/purchase-wizard/wizard-steps/Step2ShippingInfo.tsx`

- [ ] **Step 1: Remove the `shippingSpeed` form field**

Find and delete the `FormField` for `shippingSpeed` (RadioGroup with "standard"/"express"/"overnight").

Remove the field from `Step2Data` interface (the type export).

In `TerminalPurchaseWizard.tsx`, remove `shippingSpeed: 'standard'` from the `step2Form` `defaultValues` and from the `useEffect` pre-fill block.

- [ ] **Step 2: Add `AddressAutocomplete` if not present**

Per project rule 13, address inputs should use `<AddressAutocomplete>`. Check the current Step2 — if it uses a plain `<Input>` for `address`, replace it:

```tsx
<AddressAutocomplete
  value={field.value}
  onChange={(val, details) => {
    field.onChange(val)
    if (details) {
      form.setValue('city', details.city ?? form.getValues('city'))
      form.setValue('state', details.state ?? form.getValues('state'))
      form.setValue('postalCode', details.zipCode ?? form.getValues('postalCode'))
      form.setValue('country', details.country ?? form.getValues('country'))
    }
  }}
  placeholder={t('purchaseWizard.step2.addressPlaceholder')}
/>
```

(Import: `import { AddressAutocomplete } from '@/components/address-autocomplete'`)

- [ ] **Step 3: Build + lint + smoke test**

Run: `npm run build && npm run lint`. Open wizard, advance to step 2, type an address — autocomplete suggestions should appear (requires Google Maps API key already configured for the project).

- [ ] **Step 4: Commit**

```bash
cd avoqado-web-dashboard
git add src/pages/Tpv/components/purchase-wizard/wizard-steps/Step2ShippingInfo.tsx src/pages/Tpv/components/purchase-wizard/TerminalPurchaseWizard.tsx
git commit -m "refactor(tpv-purchase): step 2 — drop shipping speed, use AddressAutocomplete"
```

---

### Task 21: Simplify `Step3PaymentMethod` — only Card + SPEI (SPEI disabled)

**Files:**
- Modify: `avoqado-web-dashboard/src/pages/Tpv/components/purchase-wizard/wizard-steps/Step3PaymentMethod.tsx` (full rewrite)

- [ ] **Step 1: Replace the file**

```tsx
import { CreditCard, Building } from 'lucide-react'
import { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

export type PaymentMethod = 'CARD_STRIPE' | 'SPEI'

export interface Step3Data {
  method: PaymentMethod
}

interface Step3PaymentMethodProps {
  form: UseFormReturn<Step3Data>
}

export function Step3PaymentMethod({ form }: Step3PaymentMethodProps) {
  const { t } = useTranslation('tpv')

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="method"
        rules={{ required: { value: true, message: t('purchaseWizard.step3.validation.methodRequired') } }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('purchaseWizard.step3.selectMethod')}</FormLabel>
            <FormControl>
              <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-1 gap-3">
                <Card
                  data-tour="tpv-payment-card"
                  className={`cursor-pointer transition-all border-input ${field.value === 'CARD_STRIPE' ? 'border-primary bg-accent/50' : 'hover:border-muted-foreground'}`}
                  onClick={() => field.onChange('CARD_STRIPE')}
                >
                  <CardContent className="flex items-center gap-3 p-4">
                    <RadioGroupItem value="CARD_STRIPE" id="CARD_STRIPE" />
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <Label htmlFor="CARD_STRIPE" className="font-normal cursor-pointer">{t('purchaseWizard.step3.methods.cardStripe.label')}</Label>
                      <p className="text-xs text-muted-foreground">{t('purchaseWizard.step3.methods.cardStripe.desc')}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* SPEI disabled in Plan 1 — ships in Plan 2 */}
                <Card data-tour="tpv-payment-spei" className="opacity-60 cursor-not-allowed border-input">
                  <CardContent className="flex items-center gap-3 p-4">
                    <RadioGroupItem value="SPEI" id="SPEI" disabled />
                    <Building className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="SPEI" className="font-normal">{t('purchaseWizard.step3.methods.spei.label')}</Label>
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">{t('common.comingSoon')}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{t('purchaseWizard.step3.methods.spei.desc')}</p>
                    </div>
                  </CardContent>
                </Card>
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
```

- [ ] **Step 2: Update default value in wizard**

In `TerminalPurchaseWizard.tsx`:
```typescript
const step3Form = useForm<Step3Data>({ defaultValues: { method: 'CARD_STRIPE' } })
```

- [ ] **Step 3: Build + lint**

Run: `npm run build && npm run lint`
Expected: green.

- [ ] **Step 4: Commit**

```bash
cd avoqado-web-dashboard
git add src/pages/Tpv/components/purchase-wizard/wizard-steps/Step3PaymentMethod.tsx src/pages/Tpv/components/purchase-wizard/TerminalPurchaseWizard.tsx
git commit -m "feat(tpv-purchase): step 3 = Card + SPEI (SPEI disabled until Plan 2)"
```

---

### Task 22: Update `Step4ReviewConfirm` + wire new mutation + Stripe redirect

**Files:**
- Modify: `avoqado-web-dashboard/src/pages/Tpv/components/purchase-wizard/wizard-steps/Step4ReviewConfirm.tsx`
- Modify: `avoqado-web-dashboard/src/pages/Tpv/components/purchase-wizard/TerminalPurchaseWizard.tsx`

- [ ] **Step 1: Update Step4 props + render to consume cart instead of step1Data**

In `Step4ReviewConfirm.tsx`, change the props interface:

```typescript
import { CartLine, TPV_CATALOG, formatMxnCents, calculateCartTotals } from '@/config/tpvCatalog'

interface Step4Props {
  form: UseFormReturn<Step4Data>
  cart: CartLine[]
  step2Data: Step2Data
  step3Data: Step3Data
  onEditStep: (step: number) => void
}
```

In the render, replace the existing summary block with:

```tsx
<Card className="border-input">
  <CardHeader className="flex flex-row items-center justify-between">
    <CardTitle className="text-base">{t('purchaseWizard.step4.itemsTitle')}</CardTitle>
    <Button variant="ghost" size="sm" onClick={() => onEditStep(1)}>{t('common.edit')}</Button>
  </CardHeader>
  <CardContent className="space-y-2 text-sm">
    {cart.map((line) => {
      const entry = TPV_CATALOG[line.catalogKey]
      if (!entry) return null
      return (
        <div key={line.catalogKey} className="flex justify-between">
          <span>{entry.name} × {line.quantity}</span>
          <span>{formatMxnCents(entry.unitPriceCents * line.quantity)}</span>
        </div>
      )
    })}
    {(() => {
      const totals = calculateCartTotals(cart)
      return (
        <div className="pt-2 border-t border-input space-y-1">
          <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatMxnCents(totals.subtotalCents)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>IVA (16%)</span><span>{formatMxnCents(totals.taxCents)}</span></div>
          <div className="flex justify-between font-bold pt-1"><span>Total</span><span>{formatMxnCents(totals.totalCents)} MXN</span></div>
        </div>
      )
    })()}
  </CardContent>
</Card>
```

- [ ] **Step 2: Rewrite the mutation in `TerminalPurchaseWizard.tsx`**

Replace `createTerminalsMutation` with:

```typescript
import { tpvOrderService } from '@/services/tpvOrder.service'

const createOrderMutation = useMutation({
  mutationFn: async () => {
    if (cart.length === 0 || !step2Data || !step3Data) {
      throw new Error('Missing wizard data')
    }
    return tpvOrderService.create(venueId!, {
      items: cart.map((line) => ({ catalogKey: line.catalogKey, quantity: line.quantity })),
      contactName: step2Data.contactName,
      contactEmail: step2Data.contactEmail,
      contactPhone: step2Data.contactPhone,
      shippingAddress: step2Data.address,
      shippingAddress2: step2Data.addressLine2 || undefined,
      shippingCity: step2Data.city,
      shippingState: step2Data.state,
      shippingZip: step2Data.postalCode,
      shippingCountry: step2Data.country,
      paymentMethod: step3Data.method,
    })
  },
  onSuccess: (result) => {
    if (result.redirectUrl) {
      // Stripe Card path — redirect to hosted checkout
      window.location.href = result.redirectUrl
      return
    }
    // SPEI path (Plan 2) — navigate to confirmation page
    queryClient.invalidateQueries({ queryKey: ['tpv-orders', venueId] })
    onOpenChange(false)
    navigate(`${fullBasePath}/tpv/orders/${result.orderId}`)
    onSuccess?.()
  },
  onError: (error: any) => {
    toast({
      title: tCommon('common.error'),
      description: error.response?.data?.message || error.message || t('purchaseWizard.errors.createFailed'),
      variant: 'destructive',
    })
  },
})
```

Replace `handleComplete` body with:

```typescript
const handleComplete = () => {
  const step4Values = step4Form.getValues()
  if (!step4Values.acceptTerms) {
    toast({ title: tCommon('common.error'), description: t('purchaseWizard.errors.termsRequired'), variant: 'destructive' })
    return
  }
  createOrderMutation.mutate()
}

const isLoading = createOrderMutation.isPending
```

Pass cart to Step4:
```tsx
{currentStep === 4 && step2Data && step3Data && (
  <Form {...step4Form}>
    <Step4ReviewConfirm form={step4Form} cart={cart} step2Data={step2Data} step3Data={step3Data} onEditStep={handleEditStep} />
  </Form>
)}
```

- [ ] **Step 3: Handle Stripe redirect-back on `/tpv?cancelled=true`**

In `avoqado-web-dashboard/src/pages/Tpv/Tpvs.tsx` (the page that hosts the wizard), add at top of the component:

```typescript
const [searchParams] = useSearchParams()
useEffect(() => {
  if (searchParams.get('cancelled') === 'true') {
    toast({
      title: t('purchaseWizard.cancelled.title'),
      description: t('purchaseWizard.cancelled.description'),
      variant: 'destructive',
    })
  }
}, [searchParams, toast, t])
```

- [ ] **Step 4: Build + lint + smoke test**

Run: `npm run build && npm run lint && npm run dev`. Open the wizard, complete all 4 steps with a real Stripe test card flow (configure `STRIPE_PUBLISHABLE_KEY` and backend `STRIPE_SECRET_KEY` first). Confirm redirect → pay with `4242 4242 4242 4242` → bounce back to `/tpv/orders/:id?session_id=...`. The page will 404 until Task 25 — that's expected. Confirm the order exists in DB.

- [ ] **Step 5: Commit**

```bash
cd avoqado-web-dashboard
git add src/pages/Tpv/components/purchase-wizard/ src/pages/Tpv/Tpvs.tsx
git commit -m "feat(tpv-purchase): wire wizard to new createOrder endpoint + Stripe redirect"
```

---

## Phase D — Pedidos tab + Order detail page (frontend, venue-side)

### Task 23: Add "Pedidos" pill-tab to `/tpv` + skeleton tab content

**Files:**
- Modify: `avoqado-web-dashboard/src/pages/Tpv/Tpvs.tsx` (or wherever the TPV page lives)
- Create: `avoqado-web-dashboard/src/pages/Tpv/components/TerminalOrdersTab.tsx`

- [ ] **Step 1: Add pill-style tabs wrapping existing content**

Locate the existing TPV page content (the list of Terminals). Wrap with:

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TerminalOrdersTab } from './components/TerminalOrdersTab'

// ...

const [searchParams, setSearchParams] = useSearchParams()
const tab = searchParams.get('tab') ?? 'terminals'
const setTab = (value: string) => {
  const params = new URLSearchParams(searchParams)
  params.set('tab', value)
  setSearchParams(params, { replace: true })
}

return (
  // ... existing page header ...
  <Tabs value={tab} onValueChange={setTab}>
    <TabsList className="rounded-full bg-muted/60 px-1 py-1 border border-border">
      <TabsTrigger value="terminals" className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background">
        {t('tabs.terminals')}
      </TabsTrigger>
      <TabsTrigger value="orders" className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background">
        {t('tabs.orders')}
      </TabsTrigger>
    </TabsList>
    <TabsContent value="terminals">
      {/* existing terminals list goes here */}
    </TabsContent>
    <TabsContent value="orders">
      <TerminalOrdersTab />
    </TabsContent>
  </Tabs>
)
```

- [ ] **Step 2: Create the (empty for now) TerminalOrdersTab skeleton**

```tsx
// avoqado-web-dashboard/src/pages/Tpv/components/TerminalOrdersTab.tsx
import { useTranslation } from 'react-i18next'

export function TerminalOrdersTab() {
  const { t } = useTranslation('tpv')
  return (
    <div className="py-6">
      <p className="text-sm text-muted-foreground">{t('orders.loadingPlaceholder')}</p>
    </div>
  )
}
```

(Real implementation in Task 24.)

- [ ] **Step 3: Build + lint + smoke test**

Run: `npm run build && npm run lint && npm run dev`. Go to `/venues/:slug/tpv`. Confirm 2 tabs (Terminales, Pedidos) with pill-style. Click Pedidos → empty state visible.

- [ ] **Step 4: Commit**

```bash
cd avoqado-web-dashboard
git add src/pages/Tpv/Tpvs.tsx src/pages/Tpv/components/TerminalOrdersTab.tsx
git commit -m "feat(tpv-purchase): add Pedidos pill-tab to /tpv with skeleton"
```

---

### Task 24: Implement `TerminalOrdersTab` — table with filters + search

**Files:**
- Modify: `avoqado-web-dashboard/src/pages/Tpv/components/TerminalOrdersTab.tsx`

- [ ] **Step 1: Implement the table**

```tsx
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { DataTable } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { FilterPill } from '@/components/filters/filter-pill'
import { CheckboxFilterContent } from '@/components/filters/checkbox-filter-content'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useVenueDateTime } from '@/utils/datetime'
import { useDebounce } from '@/hooks/use-debounce'
import { tpvOrderService, type TerminalOrder, type TerminalOrderPaymentStatus, type TerminalOrderFulfillmentStatus } from '@/services/tpvOrder.service'
import { formatMxnCents } from '@/config/tpvCatalog'

const PAYMENT_STATUS_OPTIONS: TerminalOrderPaymentStatus[] = ['AWAITING_PAYMENT', 'AWAITING_PROOF', 'PROOF_UPLOADED', 'PAID', 'REJECTED', 'EXPIRED', 'REFUNDED']
const FULFILLMENT_STATUS_OPTIONS: TerminalOrderFulfillmentStatus[] = ['NEW', 'AWAITING_SERIALS', 'SERIALS_ASSIGNED', 'SHIPPED', 'DELIVERED', 'CANCELLED']

export function TerminalOrdersTab() {
  const { t } = useTranslation('tpv')
  const { venueId, fullBasePath } = useCurrentVenue()
  const navigate = useNavigate()
  const { formatDate } = useVenueDateTime()
  const [paymentFilter, setPaymentFilter] = useState<string[]>([])
  const [fulfillmentFilter, setFulfillmentFilter] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['tpv-orders', venueId],
    queryFn: () => tpvOrderService.listForVenue(venueId!),
    enabled: !!venueId,
  })

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (paymentFilter.length > 0 && !paymentFilter.includes(o.paymentStatus)) return false
      if (fulfillmentFilter.length > 0 && !fulfillmentFilter.includes(o.fulfillmentStatus)) return false
      if (debouncedSearch && !o.orderNumber.toLowerCase().includes(debouncedSearch.toLowerCase())) return false
      return true
    })
  }, [orders, paymentFilter, fulfillmentFilter, debouncedSearch])

  const columns = useMemo(() => [
    { accessorKey: 'orderNumber', header: t('orders.columns.orderNumber'), cell: ({ row }: any) => <span className="font-mono">{row.original.orderNumber}</span> },
    { accessorKey: 'createdAt', header: t('orders.columns.date'), cell: ({ row }: any) => formatDate(row.original.createdAt) },
    { id: 'items', header: t('orders.columns.items'), cell: ({ row }: any) => <Badge variant="outline">{row.original.items.length} modelo(s) · {row.original.items.reduce((s: number, i: any) => s + i.quantity, 0)} u.</Badge> },
    { accessorKey: 'totalCents', header: t('orders.columns.total'), cell: ({ row }: any) => formatMxnCents(row.original.totalCents) + ' MXN' },
    { accessorKey: 'paymentMethod', header: t('orders.columns.method'), cell: ({ row }: any) => row.original.paymentMethod === 'CARD_STRIPE' ? t('orders.method.card') : t('orders.method.spei') },
    {
      id: 'status',
      header: t('orders.columns.status'),
      cell: ({ row }: any) => (
        <div className="flex flex-col gap-1">
          <Badge variant={paymentBadgeVariant(row.original.paymentStatus)}>{t(`orders.paymentStatus.${row.original.paymentStatus}`)}</Badge>
          <span className="text-xs text-muted-foreground">{t(`orders.fulfillmentStatus.${row.original.fulfillmentStatus}`)}</span>
        </div>
      ),
    },
  ], [t, formatDate])

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-wrap gap-2 items-center">
        <FilterPill label={t('orders.filters.payment')} count={paymentFilter.length} onClear={() => setPaymentFilter([])}>
          <CheckboxFilterContent
            options={PAYMENT_STATUS_OPTIONS.map((v) => ({ value: v, label: t(`orders.paymentStatus.${v}`) }))}
            selected={paymentFilter}
            onChange={setPaymentFilter}
          />
        </FilterPill>
        <FilterPill label={t('orders.filters.fulfillment')} count={fulfillmentFilter.length} onClear={() => setFulfillmentFilter([])}>
          <CheckboxFilterContent
            options={FULFILLMENT_STATUS_OPTIONS.map((v) => ({ value: v, label: t(`orders.fulfillmentStatus.${v}`) }))}
            selected={fulfillmentFilter}
            onChange={setFulfillmentFilter}
          />
        </FilterPill>
        <div className="ml-auto">
          <input
            type="text"
            placeholder={t('orders.search.placeholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-full bg-muted/60 border border-input px-4 py-1.5 text-sm"
          />
        </div>
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        showColumnCustomizer={false}
        onRowClick={(row: TerminalOrder) => navigate(`${fullBasePath}/tpv/orders/${row.id}`)}
        isLoading={isLoading}
      />
    </div>
  )
}

function paymentBadgeVariant(status: TerminalOrderPaymentStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'PAID') return 'default'
  if (status === 'REJECTED' || status === 'EXPIRED') return 'destructive'
  return 'secondary'
}
```

> Notes: `FilterPill` / `CheckboxFilterContent` paths might differ — verify with `grep -rn "FilterPill" src/components/filters/`. If DataTable does not accept `onRowClick` directly, wire it via a cell renderer that wraps the row.

- [ ] **Step 2: Build + lint + smoke test**

Run: `npm run build && npm run lint && npm run dev`. Make a test order (via wizard or directly in DB). Confirm it shows in the table with filters working.

- [ ] **Step 3: Commit**

```bash
cd avoqado-web-dashboard
git add src/pages/Tpv/components/TerminalOrdersTab.tsx
git commit -m "feat(tpv-purchase): implement orders tab with filters + search"
```

---

### Task 25: Order detail page `/tpv/orders/:id`

**Files:**
- Create: `avoqado-web-dashboard/src/pages/Tpv/TerminalOrderDetail.tsx`
- Modify: `avoqado-web-dashboard/src/routes/index.tsx` (or wherever venue routes are declared — find it via `grep -rn "venues/:slug/tpv" src/routes/`)

- [ ] **Step 1: Build the detail page**

```tsx
// avoqado-web-dashboard/src/pages/Tpv/TerminalOrderDetail.tsx
import { useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useVenueDateTime } from '@/utils/datetime'
import { formatMxnCents } from '@/config/tpvCatalog'
import { tpvOrderService } from '@/services/tpvOrder.service'

export default function TerminalOrderDetail() {
  const { t } = useTranslation('tpv')
  const { id } = useParams<{ id: string }>()
  const { venueId } = useCurrentVenue()
  const [searchParams] = useSearchParams()
  const { formatDate } = useVenueDateTime()
  const { toast } = useToast()

  // Stripe redirect-back detection
  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    if (sessionId) {
      toast({
        title: t('orders.detail.stripeReturn.title'),
        description: t('orders.detail.stripeReturn.description'),
      })
    }
  }, [searchParams, toast, t])

  const { data: order, isLoading } = useQuery({
    queryKey: ['tpv-order', venueId, id],
    queryFn: () => tpvOrderService.getById(venueId!, id!),
    enabled: !!venueId && !!id,
    refetchInterval: (q) => {
      const data = q.state.data as any
      // Poll every 3s if waiting for Stripe webhook to flip the order
      if (data?.paymentStatus === 'AWAITING_PAYMENT') return 3000
      return false
    },
  })

  if (isLoading) return <div className="p-6">{t('common.loading')}</div>
  if (!order) return <div className="p-6">{t('orders.detail.notFound')}</div>

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('orders.detail.title')} {order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={order.paymentStatus === 'PAID' ? 'default' : 'secondary'}>
            {t(`orders.paymentStatus.${order.paymentStatus}`)}
          </Badge>
          <span className="text-xs text-muted-foreground">{t(`orders.fulfillmentStatus.${order.fulfillmentStatus}`)}</span>
        </div>
      </div>

      {/* Items */}
      <Card className="border-input">
        <CardHeader><CardTitle className="text-base">{t('orders.detail.items')}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <span>{item.productName} × {item.quantity}</span>
              <span>{formatMxnCents(item.unitPriceCents * item.quantity)}</span>
            </div>
          ))}
          <hr className="border-input" />
          <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatMxnCents(order.subtotalCents)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>IVA (16%)</span><span>{formatMxnCents(order.taxCents)}</span></div>
          <div className="flex justify-between font-bold"><span>Total</span><span>{formatMxnCents(order.totalCents)} {order.currency}</span></div>
          {order.stripeReceiptUrl && (
            <a href={order.stripeReceiptUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
              {t('orders.detail.viewReceipt')} →
            </a>
          )}
        </CardContent>
      </Card>

      {/* Shipping */}
      <Card className="border-input">
        <CardHeader><CardTitle className="text-base">{t('orders.detail.shipping')}</CardTitle></CardHeader>
        <CardContent className="text-sm">
          <p><strong>{order.contactName}</strong></p>
          <p>{order.shippingAddress}{order.shippingAddress2 ? `, ${order.shippingAddress2}` : ''}</p>
          <p>{order.shippingCity}, {order.shippingState} {order.shippingZip}</p>
          <p>{order.shippingCountry}</p>
          <p className="mt-2 text-muted-foreground">{order.contactEmail} · {order.contactPhone}</p>
        </CardContent>
      </Card>

      {/* Terminals assigned (when fulfillmentStatus >= SERIALS_ASSIGNED) */}
      {order.terminals && order.terminals.length > 0 && (
        <Card className="border-input">
          <CardHeader><CardTitle className="text-base">{t('orders.detail.assignedTerminals')}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {order.terminals.map((tr) => (
              <div key={tr.id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                <div>
                  <div className="font-medium">{tr.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">Serial: {tr.serialNumber ?? '—'}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">{t('orders.detail.activationCode')}</div>
                  <div className="font-mono font-bold">{tr.activationCode ?? '—'}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add the route**

Find the venue routes file (likely `src/routes/index.tsx` or `src/routes/protected.routes.tsx`). Add:

```tsx
import TerminalOrderDetail from '@/pages/Tpv/TerminalOrderDetail'

// inside the venue route group:
<Route path="tpv/orders/:id" element={
  <PermissionProtectedRoute permission="tpv:read">
    <TerminalOrderDetail />
  </PermissionProtectedRoute>
} />
```

(Match exact guard naming used elsewhere for venue routes.)

- [ ] **Step 3: Smoke test**

Pay a test order with `4242 4242 4242 4242`, get redirected back to `/tpv/orders/:id?session_id=...`. Confirm the page shows order with `paymentStatus=PAID` (after the webhook fires; polls every 3s).

- [ ] **Step 4: Build + lint**

Run: `npm run build && npm run lint`
Expected: green.

- [ ] **Step 5: Commit**

```bash
cd avoqado-web-dashboard
git add src/pages/Tpv/TerminalOrderDetail.tsx src/routes/
git commit -m "feat(tpv-purchase): add order detail page with Stripe return polling"
```

---

## Phase E — Superadmin UI

### Task 26: `/superadmin/tpv-orders` list + detail pages

**Files:**
- Create: `avoqado-web-dashboard/src/pages/Superadmin/TpvOrders/index.tsx` (list)
- Create: `avoqado-web-dashboard/src/pages/Superadmin/TpvOrders/TpvOrderDetail.tsx`
- Create: `avoqado-web-dashboard/src/services/superadmin.tpvOrder.service.ts`
- Modify: superadmin routes (find via `grep -rn "/superadmin/" src/routes/`)

> Reminder per CLAUDE.md: Superadmin pages use hardcoded Spanish (no i18n).

- [ ] **Step 1: Superadmin service**

```typescript
// avoqado-web-dashboard/src/services/superadmin.tpvOrder.service.ts
import api from '@/api'
import type { TerminalOrder } from './tpvOrder.service'

export const superadminTpvOrderService = {
  async listAll(): Promise<(TerminalOrder & { venue: { id: string; name: string; slug: string } })[]> {
    const { data } = await api.get('/api/v1/superadmin/tpv-orders')
    return data.data
  },
  async getById(id: string): Promise<TerminalOrder & { venue: { id: string; name: string; slug: string } }> {
    const { data } = await api.get(`/api/v1/superadmin/tpv-orders/${id}`)
    return data.data
  },
  async assignSerials(id: string, items: { orderItemId: string; units: { name: string; serial: string }[] }[]) {
    const { data } = await api.post(`/api/v1/superadmin/tpv-orders/${id}/assign-serials`, { items })
    return data.data
  },
  async markShipped(id: string, trackingNumber: string, carrier: string) {
    const { data } = await api.post(`/api/v1/superadmin/tpv-orders/${id}/mark-shipped`, { trackingNumber, carrier })
    return data.data
  },
  async markDelivered(id: string) {
    const { data } = await api.post(`/api/v1/superadmin/tpv-orders/${id}/mark-delivered`)
    return data.data
  },
}
```

- [ ] **Step 2: List page**

```tsx
// avoqado-web-dashboard/src/pages/Superadmin/TpvOrders/index.tsx
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { superadminTpvOrderService } from '@/services/superadmin.tpvOrder.service'
import { formatMxnCents } from '@/config/tpvCatalog'

export default function SuperadminTpvOrdersList() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['superadmin-tpv-orders'],
    queryFn: superadminTpvOrderService.listAll,
  })

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Pedidos de TPV</h1>
      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      <div className="grid gap-3">
        {orders.map((o) => (
          <Link key={o.id} to={`/superadmin/tpv-orders/${o.id}`}>
            <Card className="p-4 hover:bg-accent/40 transition border-input">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-mono font-semibold">{o.orderNumber}</div>
                  <div className="text-sm text-muted-foreground">{o.venue.name} · {o.contactName}</div>
                  <div className="text-xs mt-1">{o.items.length} modelo(s) · {o.items.reduce((s: number, i: any) => s + i.quantity, 0)} unidades</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatMxnCents(o.totalCents)} {o.currency}</div>
                  <div className="mt-1 flex flex-col gap-1 items-end">
                    <Badge variant={o.paymentStatus === 'PAID' ? 'default' : 'secondary'}>{o.paymentStatus}</Badge>
                    <span className="text-xs text-muted-foreground">{o.fulfillmentStatus}</span>
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Detail page with assign-serials form**

```tsx
// avoqado-web-dashboard/src/pages/Superadmin/TpvOrders/TpvOrderDetail.tsx
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { superadminTpvOrderService } from '@/services/superadmin.tpvOrder.service'
import { formatMxnCents } from '@/config/tpvCatalog'

type DraftUnits = Record<string /* orderItemId */, Array<{ name: string; serial: string }>>

export default function SuperadminTpvOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: order } = useQuery({
    queryKey: ['superadmin-tpv-order', id],
    queryFn: () => superadminTpvOrderService.getById(id!),
    enabled: !!id,
  })

  const [draft, setDraft] = useState<DraftUnits>({})
  // Initialize draft when order loads
  if (order && Object.keys(draft).length === 0 && order.fulfillmentStatus === 'AWAITING_SERIALS') {
    const init: DraftUnits = {}
    for (const item of order.items) {
      init[item.id] = Array.from({ length: item.quantity }, (_, i) => ({
        name: `${item.namePrefix} ${i + 1}`,
        serial: '',
      }))
    }
    setDraft(init)
  }

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!id) return
      const items = Object.entries(draft).map(([orderItemId, units]) => ({ orderItemId, units }))
      return superadminTpvOrderService.assignSerials(id, items)
    },
    onSuccess: () => {
      toast({ title: 'Asignación enviada', description: 'Se crearon los terminales y se notificó al cliente.' })
      queryClient.invalidateQueries({ queryKey: ['superadmin-tpv-order', id] })
    },
    onError: (error: any) => toast({ title: 'Error', description: error.response?.data?.error ?? error.message, variant: 'destructive' }),
  })

  if (!order) return <div className="p-6">Cargando…</div>

  const canAssign = order.paymentStatus === 'PAID' && order.fulfillmentStatus === 'AWAITING_SERIALS'
  const allSerialsFilled = Object.values(draft).every((units) => units.every((u) => u.name.trim() && u.serial.trim()))

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold">{order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">{order.venue.name} · {order.contactName} · {order.contactEmail}</p>
        </div>
        <div className="text-right">
          <div className="font-bold text-xl">{formatMxnCents(order.totalCents)} {order.currency}</div>
          <div className="text-xs text-muted-foreground mt-1">Pago: <strong>{order.paymentStatus}</strong> · Fulfillment: <strong>{order.fulfillmentStatus}</strong></div>
        </div>
      </div>

      <Card className="border-input">
        <CardHeader><CardTitle>Envío</CardTitle></CardHeader>
        <CardContent className="text-sm">
          <p>{order.shippingAddress}{order.shippingAddress2 ? `, ${order.shippingAddress2}` : ''}</p>
          <p>{order.shippingCity}, {order.shippingState} {order.shippingZip}, {order.shippingCountry}</p>
          <p className="mt-2 text-muted-foreground">{order.contactPhone}</p>
        </CardContent>
      </Card>

      {canAssign && (
        <Card className="border-input">
          <CardHeader><CardTitle>Asignar números de serie</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {order.items.map((item) => (
              <div key={item.id} className="space-y-2 border border-input rounded-lg p-4">
                <h4 className="font-semibold">{item.productName} × {item.quantity}</h4>
                {(draft[item.id] ?? []).map((unit, idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Nombre del terminal</Label>
                      <Input value={unit.name} onChange={(e) => {
                        setDraft((prev) => ({
                          ...prev,
                          [item.id]: prev[item.id].map((u, i) => i === idx ? { ...u, name: e.target.value } : u),
                        }))
                      }} />
                    </div>
                    <div>
                      <Label className="text-xs">Número de serie</Label>
                      <Input value={unit.serial} onChange={(e) => {
                        setDraft((prev) => ({
                          ...prev,
                          [item.id]: prev[item.id].map((u, i) => i === idx ? { ...u, serial: e.target.value } : u),
                        }))
                      }} placeholder="Ej: A910S-2026-001234" />
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <Button onClick={() => assignMutation.mutate()} disabled={!allSerialsFilled || assignMutation.isPending}>
              {assignMutation.isPending ? 'Asignando…' : 'Asignar y notificar al cliente'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Already assigned terminals */}
      {order.terminals && order.terminals.length > 0 && (
        <Card className="border-input">
          <CardHeader><CardTitle>Terminales creados</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {order.terminals.map((t) => (
              <div key={t.id} className="flex justify-between p-2 rounded bg-muted/30">
                <span>{t.name}</span>
                <span className="font-mono">{t.serialNumber} · {t.activationCode}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Routes**

In the superadmin routes file (find via `grep -rn "/superadmin" src/routes/`), add:

```tsx
import SuperadminTpvOrdersList from '@/pages/Superadmin/TpvOrders'
import SuperadminTpvOrderDetail from '@/pages/Superadmin/TpvOrders/TpvOrderDetail'

<Route path="tpv-orders" element={<SuperProtectedRoute><SuperadminTpvOrdersList /></SuperProtectedRoute>} />
<Route path="tpv-orders/:id" element={<SuperProtectedRoute><SuperadminTpvOrderDetail /></SuperProtectedRoute>} />
```

- [ ] **Step 5: Add to superadmin navigation**

In `src/pages/Superadmin/constants/navigation.ts` (or wherever superadmin sidebar items live), add an entry:

```typescript
{ label: 'Pedidos TPV', icon: Package, path: '/superadmin/tpv-orders' },
```

- [ ] **Step 6: Smoke test**

Pay a test order. Log in as SUPERADMIN. Go to `/superadmin/tpv-orders`. Open the order. Assign serials. Confirm:
- Terminal records appear in DB (`SELECT * FROM "Terminal" WHERE "terminalOrderId" = '<order_id>'`)
- Activation codes are 6 chars
- Email #6 lands in the venue's inbox

- [ ] **Step 7: Build + lint**

Run: `npm run build && npm run lint`. Green.

- [ ] **Step 8: Commit**

```bash
cd avoqado-web-dashboard
git add src/pages/Superadmin/TpvOrders/ src/services/superadmin.tpvOrder.service.ts src/routes/ src/pages/Superadmin/constants/navigation.ts
git commit -m "feat(tpv-orders): add superadmin list + detail with assign-serials form"
```

---

## Phase F — i18n + E2E + final checklist

### Task 27: i18n keys in `tpv.json` (es + en)

**Files:**
- Modify: `avoqado-web-dashboard/src/locales/es/tpv.json`
- Modify: `avoqado-web-dashboard/src/locales/en/tpv.json`

- [ ] **Step 1: Add to `purchaseWizard` namespace (Spanish)**

In `src/locales/es/tpv.json`, under the existing `purchaseWizard.step1` block, add (and remove obsolete `quantity`/`namePrefix` fields tied to the old single-product wizard if you want to keep the JSON clean — but they don't hurt to leave):

```json
"purchaseWizard": {
  "title": "Comprar Terminal",
  "subtitle": "Elige los modelos para tu pedido",
  "cancelled": {
    "title": "Pago cancelado",
    "description": "No se cobró nada. Puedes volver a intentar en cualquier momento."
  },
  "step1": {
    "title": "Catálogo",
    "catalog": {
      "add": "Agregar",
      "viewSpecs": "Ver specs"
    },
    "cart": {
      "title": "Tu pedido",
      "empty": "Aún no has agregado ningún terminal.",
      "subtotal": "Subtotal",
      "tax": "IVA (16%)",
      "total": "Total",
      "maxUnits": "Máximo 10 unidades por pedido.",
      "validationEmpty": "Agrega al menos un terminal al carrito."
    }
  },
  "step3": {
    "selectMethod": "¿Cómo quieres pagar?",
    "methods": {
      "cardStripe": {
        "label": "Tarjeta de crédito",
        "desc": "Pago seguro vía Stripe. Confirmación inmediata."
      },
      "spei": {
        "label": "Transferencia SPEI",
        "desc": "Sube tu comprobante después. Confirmación 1-2 días."
      }
    },
    "validation": {
      "methodRequired": "Selecciona un método de pago"
    }
  },
  "step4": {
    "itemsTitle": "Items del pedido",
    "placeOrder": "Confirmar pedido"
  },
  "errors": {
    "createFailed": "No se pudo crear el pedido"
  }
},
"tabs": {
  "terminals": "Terminales",
  "orders": "Pedidos"
},
"orders": {
  "loadingPlaceholder": "Cargando pedidos…",
  "columns": {
    "orderNumber": "# Pedido",
    "date": "Fecha",
    "items": "Items",
    "total": "Total",
    "method": "Método",
    "status": "Estado"
  },
  "method": {
    "card": "Tarjeta",
    "spei": "SPEI"
  },
  "filters": {
    "payment": "Estado de pago",
    "fulfillment": "Envío"
  },
  "search": {
    "placeholder": "Buscar por # pedido"
  },
  "paymentStatus": {
    "AWAITING_PAYMENT": "Esperando pago",
    "AWAITING_PROOF": "Esperando comprobante",
    "PROOF_UPLOADED": "Comprobante recibido",
    "PAID": "Pagado",
    "REJECTED": "Rechazado",
    "EXPIRED": "Expirado",
    "REFUNDED": "Reembolsado"
  },
  "fulfillmentStatus": {
    "NEW": "Nuevo",
    "AWAITING_SERIALS": "Asignando serials",
    "SERIALS_ASSIGNED": "En preparación",
    "SHIPPED": "Enviado",
    "DELIVERED": "Entregado",
    "CANCELLED": "Cancelado"
  },
  "detail": {
    "title": "Pedido",
    "notFound": "Pedido no encontrado",
    "items": "Items",
    "shipping": "Dirección de envío",
    "assignedTerminals": "Terminales asignados",
    "activationCode": "Código de activación",
    "viewReceipt": "Ver recibo",
    "stripeReturn": {
      "title": "¡Gracias!",
      "description": "Estamos procesando tu pago. Esto puede tardar unos segundos."
    }
  }
}
```

- [ ] **Step 2: Mirror in `en/tpv.json`**

Add the same shape with English translations. Translate `Pedido` → `Order`, `Esperando pago` → `Awaiting payment`, etc. Do not skip — the ESLint rule `no-missing-translation-keys.js` will fail.

- [ ] **Step 3: Check common keys**

Make sure `common.comingSoon` exists in `src/locales/{es,en}/common.json`. If not, add:
- es: `"comingSoon": "Muy pronto"`
- en: `"comingSoon": "Coming soon"`

- [ ] **Step 4: Build + lint**

Run: `npm run build && npm run lint`
Expected: no missing-key errors.

- [ ] **Step 5: Commit**

```bash
cd avoqado-web-dashboard
git add src/locales/
git commit -m "i18n(tpv-orders): add keys for catalog wizard + orders tab + detail"
```

---

### Task 28: Playwright E2E — Card flow happy path

**Files:**
- Create: `avoqado-web-dashboard/e2e/tests/tpv/buy-terminal-card.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// avoqado-web-dashboard/e2e/tests/tpv/buy-terminal-card.spec.ts
import { test, expect } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'

test.describe('Buy TPV — Card flow', () => {
  test('creates an order and redirects to Stripe', async ({ page }) => {
    await setupApiMocks(page, { userRole: 'OWNER' })

    // Specific mock for createOrder — register LAST per LIFO matching
    await page.route('**/api/v1/dashboard/venues/*/tpv-orders', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            orderId: 'ord_test_1',
            orderNumber: 'AVO-0001',
            redirectUrl: 'https://checkout.stripe.com/mock/cs_test_123',
          },
        }),
      })
    })

    await page.goto('/venues/test-venue/tpv')
    await page.getByRole('button', { name: /comprar terminal/i }).click()

    // Step 1 — Add PAX A910S to cart
    await page.locator('[data-tour="tpv-cart-add-a910s"]').click()
    await expect(page.locator('[data-tour="tpv-cart-summary"]')).toContainText('PAX A910S × 1')
    await page.getByRole('button', { name: /next|siguiente/i }).click()

    // Step 2 — shipping (assume pre-filled, just continue)
    await page.getByRole('button', { name: /next|siguiente/i }).click()

    // Step 3 — Card is default
    await page.locator('[data-tour="tpv-payment-card"]').click()
    await page.getByRole('button', { name: /next|siguiente/i }).click()

    // Step 4 — accept terms + confirm
    await page.getByRole('checkbox').check()
    const navigationPromise = page.waitForURL(/checkout\.stripe\.com/, { timeout: 5000 }).catch(() => null)
    await page.getByRole('button', { name: /confirmar pedido/i }).click()
    await navigationPromise // either we navigate, or test fails on next assertion

    expect(page.url()).toContain('checkout.stripe.com')
  })

  test('returning from Stripe success_url shows the order in PAID state after polling', async ({ page }) => {
    await setupApiMocks(page, { userRole: 'OWNER' })

    // First call: AWAITING_PAYMENT, second call: PAID
    let callCount = 0
    await page.route('**/api/v1/dashboard/venues/*/tpv-orders/ord_test_1', async (route) => {
      callCount++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'ord_test_1', orderNumber: 'AVO-0001',
            venueId: 'venue_1', currency: 'MXN',
            subtotalCents: 400_000, taxCents: 64_000, totalCents: 464_000,
            paymentMethod: 'CARD_STRIPE',
            paymentStatus: callCount === 1 ? 'AWAITING_PAYMENT' : 'PAID',
            fulfillmentStatus: callCount === 1 ? 'NEW' : 'AWAITING_SERIALS',
            items: [{ id: 'oi_1', brand: 'PAX', model: 'A910S', productName: 'PAX A910S', quantity: 1, unitPriceCents: 400_000, namePrefix: 'PAX A910S' }],
            terminals: [],
            createdAt: new Date().toISOString(),
            contactName: 'Test', contactEmail: 't@t.com', contactPhone: '1',
            shippingAddress: 'A', shippingCity: 'C', shippingState: 'S', shippingZip: '1', shippingCountry: 'México',
            shippingAddress2: null, stripeReceiptUrl: null,
          },
        }),
      })
    })

    await page.goto('/venues/test-venue/tpv/orders/ord_test_1?session_id=cs_test_123')
    await expect(page.getByText('AVO-0001')).toBeVisible()
    // Initially awaiting
    await expect(page.getByText(/esperando pago/i)).toBeVisible()
    // After polling, should flip to PAID
    await expect(page.getByText(/^pagado$/i)).toBeVisible({ timeout: 10_000 })
  })

  test('cancel from Stripe shows toast', async ({ page }) => {
    await setupApiMocks(page, { userRole: 'OWNER' })
    await page.goto('/venues/test-venue/tpv?cancelled=true')
    await expect(page.getByText(/pago cancelado/i)).toBeVisible()
  })
})
```

- [ ] **Step 2: Run E2E**

Run: `cd avoqado-web-dashboard && npm run test:e2e -- buy-terminal-card`
Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
cd avoqado-web-dashboard
git add e2e/tests/tpv/
git commit -m "test(tpv-orders): E2E for Card flow (create, redirect, return, cancel)"
```

---

### Task 29: Pre-deploy verification + open PR

**Files:** None — verification only.

- [ ] **Step 1: Backend pre-deploy**

```bash
cd avoqado-server
npm run build
npm test
npm run lint  # if defined
```
All must pass.

- [ ] **Step 2: Dashboard pre-deploy**

```bash
cd avoqado-web-dashboard
npm run build
npm run lint
npm run test:e2e
```
All must pass.

- [ ] **Step 3: Manual end-to-end on dev with real Stripe test mode**

1. Configure local `.env.development` for both repos with Stripe **test** keys.
2. Start the backend webhook listener (Stripe CLI):
   ```bash
   stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
   ```
   Copy the printed `whsec_…` into backend `STRIPE_WEBHOOK_SECRET`.
3. Set `ORDER_NOTIFICATIONS_EMAIL=sales@avoqado.io` in backend env (or your own inbox for testing).
4. Boot backend + dashboard locally.
5. Go to `/venues/<test-venue>/tpv`. Click Comprar.
6. Add `PAX A910S × 1`. Continue through steps. Pay with `4242 4242 4242 4242` exp `12/34` CVC `123`.
7. Confirm redirect back. The page should poll and show "Pagado" within ~10s.
8. Confirm email `✅ Pago confirmado AVO-####` arrives at the test contact email.
9. Confirm email `💰 Asigna números de serie — AVO-####` arrives at `ORDER_NOTIFICATIONS_EMAIL`.
10. Log in as SUPERADMIN. Open `/superadmin/tpv-orders/<id>`. Assign serials.
11. Confirm Terminal records appear in DB and on `/venues/<slug>/tpv` (Terminales tab) with badge "Pendiente de activación".
12. Confirm email `📦 Tu pedido AVO-#### está en camino` arrives with activation codes.

- [ ] **Step 4: Open PR**

Create a branch and PR per repo. PR description must reference the spec doc and this plan.

Backend PR title: `feat(tpv-orders): TerminalOrder model + Stripe Card flow + superadmin (Plan 1)`
Dashboard PR title: `feat(tpv-orders): wizard refactor + catalog + orders tab + superadmin UI (Plan 1)`

Body must include:
- Link to spec: `docs/superpowers/specs/2026-05-28-tpv-shop-stripe-spei-design.md`
- Link to plan: `docs/superpowers/plans/2026-05-28-tpv-shop-plan-1-card-flow.md`
- Screenshots of: wizard catalog, orders tab, order detail page (PAID), superadmin assign-serials form
- "Closes" any matching GitHub issues
- Pre-deploy checklist from the spec (mark applicable items ✅)

- [ ] **Step 5: Stop here — wait for review**

Per `bug-fix-workflow.md`: nothing merges without Jose's review. Don't push to develop without explicit go-ahead.

---

## Self-Review Notes (author)

**Spec coverage check:**

| Spec requirement | Covered by |
|------------------|-----------|
| 3 device models with MXN+IVA prices | Tasks 3 (backend), 17 (frontend catalog) |
| Catalog cards with specs drawer | Task 19 |
| Multi-model cart | Task 19 |
| Wizard refactor to FullScreenModal | Task 18 |
| Remove "Saldo a la cuenta" | Task 21 |
| Real Stripe Card payment | Tasks 6, 9, 11, 22 |
| Stripe webhook → PAID | Task 11 |
| Email #4 payment confirmed (customer) | Tasks 12, 11 wires it |
| Email #5 serial assignment (sales) | Tasks 13, 11 wires it |
| Email #6 terminals shipped (customer) | Tasks 14, 15 wires it |
| Tab "Pedidos" with filters + search | Tasks 23, 24 |
| Order detail page (state-aware, Stripe return polling) | Task 25 |
| Superadmin orders list | Task 26 |
| Superadmin assign-serials form | Task 26 |
| Terminal records linked to order | Task 7 (assignSerials uses `terminalOrderId`) |
| Activation codes generated (existing pattern) | Task 7 |
| i18n keys es + en | Task 27 |
| E2E Card happy path | Task 28 |
| Pre-deploy checklist | Task 29 |

**Out of scope for Plan 1 (defer to Plan 2):**
- SPEI step 3 option (shown but disabled with "Muy pronto" badge — Task 21)
- Confirmation page bank details + dropzone (Plan 2)
- Upload-proof endpoint + Firebase Storage integration (Plan 2)
- Magic-link approve/reject (Plan 3)
- Email #1 SPEI instructions (Plan 2)
- Email #2 SPEI proof to sales (Plan 2)
- Email #3 SPEI rejected (Plan 2)

**Out of scope for Plan 1 (defer to Plan 3):**
- Magic-link version of `serialAssignmentForSales` email (Task 13 currently links to login-required superadmin URL)
- Background job for expired orders
- SPEI reminders (3 & 7 days)

**Known TBDs the engineer must NOT block on:**
- `TPV_CATALOG.specs` fields marked `TBD` in Tasks 3 + 17 — fill these from sales team confirmation right before release. Structure is what matters now.
- Exact env var name for backend dashboard URL (`DASHBOARD_URL` vs `APP_URL` vs `FRONTEND_URL`) — verify with `grep -rn "process.env\." src/config/env.ts`. Use whatever already exists in the repo.

**Risks the engineer should flag if hit:**
- If Stripe charges in `mxn` lowercase fails (some Stripe accounts are region-locked) — switch to using `mode: 'payment'` with `currency` at the session level instead of per-line-item.
- If `Staff` model doesn't actually have an `email` field (some auth setups put email on `User`), the `assignedBy` value in Task 16 may need adjustment.
- If `PermissionProtectedRoute` doesn't exist in the routes file, fall back to whatever existing wrapping pattern is used for venue-protected pages.



