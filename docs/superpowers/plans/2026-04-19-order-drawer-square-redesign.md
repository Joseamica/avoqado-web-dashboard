# Order Drawer Square-Style Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current dense order detail drawer body with a Square-style single-column receipt layout (Detalles / Artículos / Pagos / Actividad), wire a 3-dot actions sheet that bridges to the existing PaymentDrawer, and surface all available data including refunds and an audit-grade activity timeline.

**Architecture:**
- **Backend (avoqado-server):** small extensions to `getOrderById` (extend Prisma includes + post-query refund mapper). Zero migrations, zero new endpoints.
- **Frontend (avoqado-web-dashboard):** new `OrderDrawerContent.tsx` body composed of 4 section components, plus `OrderActionsSheet.tsx` for the 3-dot menu. Replaces `OrderId.tsx` (deleted). Drawer infrastructure (the `<Sheet>` mounted in `Orders.tsx`) is unchanged.

**Tech Stack:** TypeScript, React 18, React Query, Prisma, shadcn/ui (Sheet, Dialog, Collapsible), Tailwind, react-i18next, Luxon, Jest.

**Repos:** `avoqado-server` (backend tasks 1–3) and `avoqado-web-dashboard` (frontend tasks 4–17).

**Spec:** `avoqado-web-dashboard/docs/superpowers/specs/2026-04-19-order-drawer-square-redesign-design.md`

---

## ⚠ Commit policy

The user's standing rule (memory `feedback_no_commits.md`): **never commit without explicit user permission.** Each `git commit` step in this plan is a **proposed** commit — pause and ask the user before executing it. Do not chain multiple commits without confirmation. Suggested commit messages are provided.

---

## File map

### avoqado-server
| Path | Action |
|---|---|
| `src/services/dashboard/order.dashboard.service.ts` | Modify `getOrderById` (extend includes + apply mapper) |
| `src/services/dashboard/order.dashboard.service.ts` | Add internal helper `mapOrderPaymentsWithRefunds` (or as a separate small util) |
| `tests/unit/services/dashboard/order.dashboard.service.test.ts` | New test file for the refund mapper |

### avoqado-web-dashboard
| Path | Action |
|---|---|
| `src/utils/orderStatus.ts` | **Create** — extract `getOrderStatusConfig` and `getOrderTypeConfig` from `OrderId.tsx` |
| `src/types.ts` | **Modify** — extend `Order` and `Payment` interfaces |
| `src/services/order.service.ts` | **Modify** (only if needed) — adjust return type of `getOrder` |
| `src/utils/orderActivity.ts` | **Create** — pure function that builds the timeline event list |
| `src/utils/orderActivity.test.ts` | **Create** — unit tests for the timeline builder |
| `src/pages/Order/components/sections/DetailsSection.tsx` | **Create** |
| `src/pages/Order/components/sections/ItemsSection.tsx` | **Create** |
| `src/pages/Order/components/sections/PaymentsSection.tsx` | **Create** |
| `src/pages/Order/components/sections/ActivitySection.tsx` | **Create** |
| `src/pages/Order/components/OrderActionsSheet.tsx` | **Create** |
| `src/pages/Order/OrderDrawerContent.tsx` | **Create** — body rendered inside the existing `<Sheet>` |
| `src/pages/Order/Orders.tsx` | **Modify** — swap `<OrderId />` for `<OrderDrawerContent />` |
| `src/locales/es/orders.json` | **Modify** — add `drawer` namespace keys |
| `src/locales/en/orders.json` | **Modify** — add `drawer` namespace keys |
| `src/index.css` | **Modify** — add `@media print` rules |
| `src/pages/Order/OrderId.tsx` | **Delete** |

---

# PHASE 1 — Backend (avoqado-server)

Working directory: `/Users/amieva/Documents/Programming/Avoqado/avoqado-server`

## Task 1: Extend `getOrderById` includes

**Files:**
- Modify: `src/services/dashboard/order.dashboard.service.ts:153-200`

- [ ] **Step 1.1: Read the current `getOrderById` to confirm starting point**

Run: `sed -n '153,200p' src/services/dashboard/order.dashboard.service.ts`

Expected: shows `findFirst({ where: { id: orderId, venueId }, include: { createdBy, servedBy, table, payments: { include: { processedBy, saleVerification } }, items: { include: { product, modifiers: { include: { modifier } } } }, orderCustomers: { ... } } })`.

- [ ] **Step 1.2: Edit the include block — add `terminal`, `actions`, `payments.receipts`, and `payments` `orderBy`**

Replace the include object inside `getOrderById` with:

```ts
include: {
  createdBy: true,
  servedBy: true,
  table: true,
  terminal: true,
  actions: {
    include: { performedBy: true },
    orderBy: { createdAt: 'asc' },
  },
  payments: {
    orderBy: { createdAt: 'asc' },
    include: {
      processedBy: true,
      saleVerification: true,
      receipts: true,
    },
  },
  items: {
    include: {
      product: true,
      modifiers: {
        include: {
          modifier: true,
        },
      },
    },
  },
  orderCustomers: {
    include: {
      customer: {
        include: {
          customerGroup: true,
        },
      },
    },
    orderBy: {
      isPrimary: 'desc',
    },
  },
},
```

- [ ] **Step 1.3: Run typecheck to confirm Prisma types compile**

Run: `npm run build`

Expected: PASS (compiles without TS errors).

If it fails because `terminal`, `actions`, or `receipts` are not relations on the model, run `npx prisma generate` and re-try. They MUST exist — the spec verified they do via the Prisma schema (`Order.terminal`, `Order.actions`, `Payment.receipts`).

- [ ] **Step 1.4: PROPOSED COMMIT — ask user**

Suggested message:
```
feat(order-dashboard): include terminal, actions, and payment receipts in getOrderById

Surfaces audit trail (OrderAction[]), terminal name, and DigitalReceipt links for
the redesigned Square-style order drawer. Backwards-compatible — only adds fields.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Files to stage: `src/services/dashboard/order.dashboard.service.ts`

---

## Task 2: Add refund mapper (TDD)

Refunds are stored as `Payment` rows with `type === 'REFUND'` and `processorData.originalPaymentId`. The mapper hoists `originalPaymentId` and `refundReason` to top-level fields and builds a `payment.refunds` array on each non-refund payment.

**Files:**
- Modify: `src/services/dashboard/order.dashboard.service.ts` (add helper + call from `getOrderById`)
- Create: `tests/unit/services/dashboard/order.dashboard.service.test.ts`

- [ ] **Step 2.1: Write the failing test**

Create `tests/unit/services/dashboard/order.dashboard.service.test.ts`:

```ts
import { PaymentType } from '@prisma/client'
import { mapOrderPaymentsWithRefunds } from '@/services/dashboard/order.dashboard.service'

describe('order.dashboard.service — mapOrderPaymentsWithRefunds', () => {
  it('hoists originalPaymentId and refundReason from processorData on REFUND payments', () => {
    const payments = [
      {
        id: 'p-original',
        type: PaymentType.REGULAR,
        amount: 100,
        processorData: {},
      },
      {
        id: 'p-refund',
        type: PaymentType.REFUND,
        amount: -25,
        processorData: {
          originalPaymentId: 'p-original',
          refundReason: 'Producto defectuoso',
          amount: 25,
        },
      },
    ] as any[]

    const result = mapOrderPaymentsWithRefunds(payments)
    const refund = result.find(p => p.id === 'p-refund')!

    expect(refund.originalPaymentId).toBe('p-original')
    expect(refund.refundReason).toBe('Producto defectuoso')
  })

  it('attaches a refunds[] array to the original payment', () => {
    const payments = [
      {
        id: 'p-original',
        type: PaymentType.REGULAR,
        amount: 100,
        processorData: {},
      },
      {
        id: 'p-refund',
        type: PaymentType.REFUND,
        amount: -25,
        createdAt: new Date('2026-04-17T11:35:00Z'),
        processorData: {
          originalPaymentId: 'p-original',
          refundReason: 'Cliente insatisfecho',
        },
      },
    ] as any[]

    const result = mapOrderPaymentsWithRefunds(payments)
    const original = result.find(p => p.id === 'p-original')!

    expect(original.refunds).toHaveLength(1)
    expect(original.refunds[0]).toMatchObject({
      id: 'p-refund',
      amount: -25,
      refundReason: 'Cliente insatisfecho',
    })
  })

  it('handles orphan refund (no matching original payment) without throwing', () => {
    const payments = [
      {
        id: 'p-orphan-refund',
        type: PaymentType.REFUND,
        amount: -10,
        processorData: { originalPaymentId: 'p-missing', refundReason: 'x' },
      },
    ] as any[]

    expect(() => mapOrderPaymentsWithRefunds(payments)).not.toThrow()
    const refund = mapOrderPaymentsWithRefunds(payments)[0]
    expect(refund.originalPaymentId).toBe('p-missing')
  })

  it('does not mutate non-refund payments beyond adding empty refunds[]', () => {
    const payments = [
      { id: 'p1', type: PaymentType.REGULAR, amount: 50, processorData: {} },
    ] as any[]

    const result = mapOrderPaymentsWithRefunds(payments)
    expect(result[0].refunds).toEqual([])
    expect(result[0].id).toBe('p1')
  })

  it('handles missing or null processorData on a refund (defensive default)', () => {
    const payments = [
      {
        id: 'p-refund',
        type: PaymentType.REFUND,
        amount: -5,
        processorData: null,
      },
    ] as any[]

    const result = mapOrderPaymentsWithRefunds(payments)
    expect(result[0].originalPaymentId).toBeNull()
    expect(result[0].refundReason).toBeNull()
  })
})
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `npm run test:unit -- tests/unit/services/dashboard/order.dashboard.service.test.ts`

Expected: FAIL with "mapOrderPaymentsWithRefunds is not a function" (or similar — function not yet exported).

- [ ] **Step 2.3: Implement the mapper**

Add to `src/services/dashboard/order.dashboard.service.ts` (above `getOrderById`):

```ts
import { PaymentType } from '@prisma/client'

/**
 * Hoists refund metadata from `processorData` to top-level fields and attaches
 * a `refunds[]` array to each original payment that has been (partially or fully)
 * refunded. Pure read-side transform — no DB side effects.
 *
 * Refund Payments are linked to their original via
 * `processorData.originalPaymentId` (no FK column). See
 * `src/services/dashboard/refund.dashboard.service.ts` for where this is set.
 */
export function mapOrderPaymentsWithRefunds<T extends { id: string; type: any; processorData: any }>(
  payments: T[],
): Array<T & {
  originalPaymentId: string | null
  refundReason: string | null
  refunds: Array<{ id: string; amount: any; createdAt?: Date; refundReason: string | null }>
}> {
  // Pass 1: enrich each payment with hoisted refund fields
  const enriched = payments.map(p => {
    const data = (p.processorData ?? {}) as Record<string, any>
    const isRefund = p.type === PaymentType.REFUND
    return {
      ...p,
      originalPaymentId: isRefund ? (data.originalPaymentId ?? null) : null,
      refundReason: isRefund ? (data.refundReason ?? null) : null,
      refunds: [] as Array<{ id: string; amount: any; createdAt?: Date; refundReason: string | null }>,
    }
  })

  // Pass 2: for every original payment, collect refunds that point to it
  const byId = new Map(enriched.map(p => [p.id, p]))
  for (const p of enriched) {
    if (p.originalPaymentId && byId.has(p.originalPaymentId)) {
      byId.get(p.originalPaymentId)!.refunds.push({
        id: p.id,
        amount: (p as any).amount,
        createdAt: (p as any).createdAt,
        refundReason: p.refundReason,
      })
    }
  }

  return enriched
}
```

- [ ] **Step 2.4: Run tests to verify they pass**

Run: `npm run test:unit -- tests/unit/services/dashboard/order.dashboard.service.test.ts`

Expected: 5 tests PASS.

- [ ] **Step 2.5: Wire the mapper into `getOrderById`**

In `getOrderById`, after the `flattenOrderModifiers(order)` call, replace the return statement so the mapper is applied. Locate the current end of the function:

```ts
if (!order) {
  throw new NotFoundError(`Order with ID ${orderId} not found in this venue`)
}
return flattenOrderModifiers(order)
```

Replace with:

```ts
if (!order) {
  throw new NotFoundError(`Order with ID ${orderId} not found in this venue`)
}
const flattened = flattenOrderModifiers(order)
return {
  ...flattened,
  payments: mapOrderPaymentsWithRefunds(flattened.payments ?? []),
}
```

- [ ] **Step 2.6: Run typecheck and full unit suite**

Run: `npm run build && npm run test:unit -- tests/unit/services/dashboard/order.dashboard.service.test.ts`

Expected: build passes, 5 tests pass.

- [ ] **Step 2.7: PROPOSED COMMIT — ask user**

Suggested message:
```
feat(order-dashboard): hoist refund metadata and group refunds per payment

Adds mapOrderPaymentsWithRefunds() to surface payment.originalPaymentId,
payment.refundReason, and payment.refunds[] from processorData. Frontend no
longer needs to parse processorData JSON to render refunds. Pure read-side
transform — no DB changes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Files to stage:
- `src/services/dashboard/order.dashboard.service.ts`
- `tests/unit/services/dashboard/order.dashboard.service.test.ts`

---

## Task 3: Run pre-deploy and confirm no regressions

**Files:** none (verification only)

- [ ] **Step 3.1: Run lint + format + full test suite**

Run: `npm run format && npm run lint:fix && npm run pre-deploy`

Expected: PASS. If `pre-deploy` fails because of unrelated existing failures, capture the failures and report them — do NOT auto-fix unrelated test failures.

- [ ] **Step 3.2: Optional sanity test against a real order via curl**

Run: `npm run dev` in one terminal, then in another:
```bash
# Get an auth cookie (existing dev login flow)
# Then GET an order:
curl -s -b cookies.txt "http://localhost:3000/api/v1/dashboard/venues/<venueId>/orders/<orderId>" | jq '.payments[] | {id, type, originalPaymentId, refundReason, refunds}'
```

Expected: original payments show `originalPaymentId: null, refundReason: null, refunds: [...]`. Refund payments show `originalPaymentId: "<id>", refundReason: "<reason>"`.

If you don't have a refund order handy, skip — the unit tests cover the logic.

---

# PHASE 2 — Frontend prep (avoqado-web-dashboard)

Working directory: `/Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard`

## Task 4: Extract status helpers to shared util

The helpers `getOrderStatusConfig` and `getOrderTypeConfig` currently live inside `OrderId.tsx` (which we're deleting). Move them to a shared util so the new components can import them.

**Files:**
- Create: `src/utils/orderStatus.ts`

- [ ] **Step 4.1: Create the util file**

Create `src/utils/orderStatus.ts`:

```ts
import { CheckCircle2, Clock, XCircle } from 'lucide-react'

export const getOrderStatusConfig = (status: string) => {
  const s = status?.toUpperCase()
  switch (s) {
    case 'COMPLETED':
    case 'PAID':
    case 'CLOSED':
      return {
        icon: CheckCircle2,
        color: 'text-green-800 dark:text-green-400',
        bg: 'bg-green-100 dark:bg-green-900/30',
        border: 'border-transparent',
      }
    case 'PENDING':
    case 'OPEN':
    case 'CONFIRMED':
    case 'PREPARING':
    case 'READY':
      return {
        icon: Clock,
        color: 'text-yellow-800 dark:text-yellow-400',
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        border: 'border-transparent',
      }
    case 'CANCELLED':
    case 'CANCELED':
    case 'DELETED':
      return {
        icon: XCircle,
        color: 'text-red-800 dark:text-red-400',
        bg: 'bg-red-100 dark:bg-red-900/30',
        border: 'border-transparent',
      }
    default:
      return {
        icon: Clock,
        color: 'text-muted-foreground',
        bg: 'bg-muted',
        border: 'border-border',
      }
  }
}

export const getOrderTypeConfig = (type: string) => {
  const t = type?.toUpperCase()
  switch (t) {
    case 'DINE_IN':
      return { label: 'Dine In', bg: 'bg-blue-100 dark:bg-blue-900/30', color: 'text-blue-800 dark:text-blue-400' }
    case 'TAKEOUT':
      return { label: 'Takeout', bg: 'bg-purple-100 dark:bg-purple-900/30', color: 'text-purple-800 dark:text-purple-400' }
    case 'DELIVERY':
      return { label: 'Delivery', bg: 'bg-orange-100 dark:bg-orange-900/30', color: 'text-orange-800 dark:text-orange-400' }
    case 'PICKUP':
      return { label: 'Pickup', bg: 'bg-cyan-100 dark:bg-cyan-900/30', color: 'text-cyan-800 dark:text-cyan-400' }
    default:
      return { label: type || 'Unknown', bg: 'bg-muted', color: 'text-muted-foreground' }
  }
}

export const formatOrderNumber = (orderNumber?: string | null): string => {
  if (!orderNumber) return '-'
  const match = orderNumber.match(/(?:ORD|FAST)-(.+)/)
  if (!match) return orderNumber
  const digits = match[1].replace(/\D/g, '')
  if (!digits) return orderNumber
  return digits.length > 6 ? digits.slice(-6) : digits
}
```

- [ ] **Step 4.2: Typecheck**

Run: `npm run build` (in the dashboard repo)

Expected: PASS.

---

## Task 5: Extend `Order` and `Payment` TypeScript interfaces

**Files:**
- Modify: `src/types.ts:955-993` (Order) and `src/types.ts:1020+` (Payment)

- [ ] **Step 5.1: Add new fields to `Order` interface**

In `src/types.ts`, locate `export interface Order {` (around line 955). Add these fields **before the closing `}`**:

```ts
  // ▼ Square-style drawer additions (2026-04-19)
  terminalId: string | null
  terminal?: { id: string; name: string } | null
  actions?: OrderAction[]
  completedAt?: string | null
```

- [ ] **Step 5.2: Add `OrderAction` interface near the bottom of `types.ts`**

```ts
// Audit trail entry on an Order (COMP, VOID, DISCOUNT, SPLIT, MERGE, TRANSFER)
export interface OrderAction {
  id: string
  orderId: string
  actionType: 'COMP' | 'VOID' | 'DISCOUNT' | 'SPLIT' | 'MERGE' | 'TRANSFER'
  performedById: string
  performedBy?: { id: string; firstName: string; lastName: string } | null
  reason: string | null
  metadata: any | null
  createdAt: string
}
```

- [ ] **Step 5.3: Add new fields to `Payment` interface**

In `src/types.ts`, locate `export interface Payment {` (around line 1020). Add these fields **before the closing `}`**:

```ts
  // ▼ Square-style drawer additions (2026-04-19)
  receipts?: Array<{
    id: string
    accessKey: string
    status: string
    recipientEmail: string | null
    sentAt: string | null
    viewedAt: string | null
    createdAt: string
  }>
  // Hoisted by backend mapOrderPaymentsWithRefunds():
  originalPaymentId?: string | null
  refundReason?: string | null
  refunds?: Array<{
    id: string
    amount: number
    createdAt: string
    refundReason: string | null
  }>
  authorizationNumber?: string | null
  referenceNumber?: string | null
  cardBrand?: string | null
  maskedPan?: string | null
  entryMode?: string | null
```

- [ ] **Step 5.4: Typecheck**

Run: `npm run build`

Expected: PASS. If existing files break because they import `Order`/`Payment` and try to access nullable fields without checks, those are pre-existing issues — leave them and report.

---

## Task 6: Build `orderActivity.ts` timeline builder (TDD)

This is the pure logic that powers Section 4 (Actividad). Builds an ordered event list from the order, items, payments, and actions. Tested in isolation.

**Files:**
- Create: `src/utils/orderActivity.ts`
- Create: `src/utils/orderActivity.test.ts`

- [ ] **Step 6.1: Write the failing test**

Create `src/utils/orderActivity.test.ts`:

```ts
import { buildOrderActivity, ActivityEvent } from './orderActivity'
import type { Order } from '@/types'

const baseOrder = (overrides: Partial<Order> = {}): Order =>
  ({
    id: 'o1',
    orderNumber: 'ORD-1',
    createdAt: '2026-04-17T11:00:00.000Z',
    completedAt: null,
    items: [],
    payments: [],
    actions: [],
    createdBy: { id: 's1', firstName: 'Grace', lastName: 'APM' },
    ...overrides,
  } as any)

describe('buildOrderActivity', () => {
  it('emits a "created" event from order.createdAt', () => {
    const events = buildOrderActivity(baseOrder())
    expect(events[0].type).toBe('created')
    expect(events[0].timestamp).toBe('2026-04-17T11:00:00.000Z')
  })

  it('groups items added in the same minute into a single event', () => {
    const events = buildOrderActivity(
      baseOrder({
        items: [
          { id: 'i1', createdAt: '2026-04-17T11:05:10.000Z', productName: 'A', quantity: 1 } as any,
          { id: 'i2', createdAt: '2026-04-17T11:05:30.000Z', productName: 'B', quantity: 2 } as any,
        ],
      } as any),
    )
    const itemEvents = events.filter(e => e.type === 'items_added')
    expect(itemEvents).toHaveLength(1)
    expect(itemEvents[0].count).toBe(2)
  })

  it('emits separate "items_added" events for items added in different minutes', () => {
    const events = buildOrderActivity(
      baseOrder({
        items: [
          { id: 'i1', createdAt: '2026-04-17T11:05:00.000Z', productName: 'A', quantity: 1 } as any,
          { id: 'i2', createdAt: '2026-04-17T11:08:00.000Z', productName: 'B', quantity: 1 } as any,
        ],
      } as any),
    )
    const itemEvents = events.filter(e => e.type === 'items_added')
    expect(itemEvents).toHaveLength(2)
  })

  it('emits "payment" events for non-refund payments', () => {
    const events = buildOrderActivity(
      baseOrder({
        payments: [
          {
            id: 'p1',
            type: 'REGULAR',
            method: 'CREDIT_CARD',
            cardBrand: 'VISA',
            amount: 50,
            tipAmount: 0,
            createdAt: '2026-04-17T11:10:00.000Z',
          } as any,
        ],
      } as any),
    )
    const paymentEvents = events.filter(e => e.type === 'payment')
    expect(paymentEvents).toHaveLength(1)
    expect(paymentEvents[0].amount).toBe(50)
  })

  it('emits "refund" events for refund payments', () => {
    const events = buildOrderActivity(
      baseOrder({
        payments: [
          {
            id: 'p2',
            type: 'REFUND',
            method: 'CREDIT_CARD',
            amount: -25,
            tipAmount: 0,
            refundReason: 'Cliente insatisfecho',
            createdAt: '2026-04-17T11:35:00.000Z',
          } as any,
        ],
      } as any),
    )
    const refundEvents = events.filter(e => e.type === 'refund')
    expect(refundEvents).toHaveLength(1)
    expect(refundEvents[0].refundReason).toBe('Cliente insatisfecho')
  })

  it('emits action events from order.actions[]', () => {
    const events = buildOrderActivity(
      baseOrder({
        actions: [
          {
            id: 'a1',
            actionType: 'COMP',
            reason: 'Comp por error',
            performedBy: { firstName: 'Jose', lastName: 'A' },
            createdAt: '2026-04-17T11:15:00.000Z',
          } as any,
        ],
      } as any),
    )
    const actionEvents = events.filter(e => e.type === 'action')
    expect(actionEvents).toHaveLength(1)
    expect(actionEvents[0].actionType).toBe('COMP')
  })

  it('emits "completed" event when order.completedAt is set', () => {
    const events = buildOrderActivity(baseOrder({ completedAt: '2026-04-17T12:00:00.000Z' } as any))
    expect(events.some(e => e.type === 'completed')).toBe(true)
  })

  it('returns events sorted ascending by timestamp', () => {
    const events = buildOrderActivity(
      baseOrder({
        completedAt: '2026-04-17T12:00:00.000Z',
        payments: [
          { id: 'p1', type: 'REGULAR', method: 'CASH', amount: 10, tipAmount: 0, createdAt: '2026-04-17T11:30:00.000Z' } as any,
        ],
      } as any),
    )
    const ts = events.map(e => e.timestamp)
    const sorted = [...ts].sort()
    expect(ts).toEqual(sorted)
  })
})
```

- [ ] **Step 6.2: Run test to verify it fails**

Run: `npm test -- src/utils/orderActivity.test.ts`

Expected: FAIL with "Cannot find module './orderActivity'".

- [ ] **Step 6.3: Implement `buildOrderActivity`**

Create `src/utils/orderActivity.ts`:

```ts
import type { Order, OrderItem, Payment, OrderAction } from '@/types'

export type ActivityEvent =
  | { type: 'created'; timestamp: string; staffName: string | null }
  | { type: 'items_added'; timestamp: string; count: number; items: Array<{ name: string; quantity: number }> }
  | { type: 'action'; timestamp: string; actionType: OrderAction['actionType']; reason: string | null; staffName: string | null }
  | { type: 'payment'; timestamp: string; paymentId: string; amount: number; method: string; cardBrand: string | null }
  | { type: 'refund'; timestamp: string; paymentId: string; amount: number; refundReason: string | null }
  | { type: 'completed'; timestamp: string }

const minuteKey = (iso: string): string => iso.slice(0, 16) // "YYYY-MM-DDTHH:MM"

const staffName = (s?: { firstName?: string; lastName?: string } | null): string | null =>
  s ? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || null : null

export function buildOrderActivity(order: Order): ActivityEvent[] {
  const events: ActivityEvent[] = []

  // Order created
  events.push({
    type: 'created',
    timestamp: order.createdAt,
    staffName: staffName(order.createdBy),
  })

  // Items added — group by minute
  const itemGroups = new Map<string, OrderItem[]>()
  for (const item of order.items ?? []) {
    if (!item.createdAt) continue
    const key = minuteKey(item.createdAt)
    if (!itemGroups.has(key)) itemGroups.set(key, [])
    itemGroups.get(key)!.push(item)
  }
  for (const [, group] of itemGroups) {
    events.push({
      type: 'items_added',
      timestamp: group[0].createdAt!,
      count: group.length,
      items: group.map(i => ({
        name: i.productName ?? i.product?.name ?? 'Producto',
        quantity: i.quantity ?? 1,
      })),
    })
  }

  // Staff actions (COMP/VOID/etc.)
  for (const action of order.actions ?? []) {
    events.push({
      type: 'action',
      timestamp: action.createdAt,
      actionType: action.actionType,
      reason: action.reason,
      staffName: staffName(action.performedBy),
    })
  }

  // Payments + refunds
  for (const p of order.payments ?? []) {
    const isRefund = p.type === 'REFUND'
    const amount = Number(p.amount ?? 0) + Number(p.tipAmount ?? 0)
    if (isRefund) {
      events.push({
        type: 'refund',
        timestamp: p.createdAt,
        paymentId: p.id,
        amount,
        refundReason: p.refundReason ?? null,
      })
    } else {
      events.push({
        type: 'payment',
        timestamp: p.createdAt,
        paymentId: p.id,
        amount,
        method: p.method,
        cardBrand: p.cardBrand ?? null,
      })
    }
  }

  // Order completed
  if (order.completedAt) {
    events.push({ type: 'completed', timestamp: order.completedAt })
  }

  // Sort ascending
  return events.sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0))
}
```

- [ ] **Step 6.4: Run tests to verify pass**

Run: `npm test -- src/utils/orderActivity.test.ts`

Expected: 8 tests PASS.

---

# PHASE 3 — Frontend section components

## Task 7: `DetailsSection` component

**Files:**
- Create: `src/pages/Order/components/sections/DetailsSection.tsx`

- [ ] **Step 7.1: Create the component**

```tsx
import { Badge } from '@/components/ui/badge'
import type { Order } from '@/types'
import { getOrderTypeConfig } from '@/utils/orderStatus'
import { DateTime } from 'luxon'
import { useTranslation } from 'react-i18next'

interface Props {
  order: Order
  venueTimezone: string
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex justify-between gap-4 py-2 border-b border-border last:border-b-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-foreground text-right">{children}</span>
  </div>
)

export function DetailsSection({ order, venueTimezone }: Props) {
  const { t } = useTranslation('orders')

  const email = order.customerEmail || order.customer?.email
  const phone = order.customerPhone || order.customer?.phone
  const customerName = order.customer
    ? `${order.customer.firstName ?? ''} ${order.customer.lastName ?? ''}`.trim()
    : null
  const server = order.servedBy ?? order.createdBy
  const serverName = server ? `${server.firstName ?? ''} ${server.lastName ?? ''}`.trim() : null
  const createdAt = DateTime.fromISO(order.createdAt, { zone: 'utc' })
    .setZone(venueTimezone)
    .toFormat("d 'de' LLL yyyy, HH:mm", { locale: 'es' })
  const typeCfg = getOrderTypeConfig(order.type)

  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground mb-3">{t('drawer.sections.details')}</h2>
      <div className="rounded-lg border border-border bg-background px-4">
        {email && <Row label={t('drawer.details.email')}>{email}</Row>}
        {phone && <Row label={t('drawer.details.phone')}>{phone}</Row>}
        {customerName && <Row label={t('drawer.details.customer')}>{customerName}</Row>}
        <Row label={t('drawer.details.createdAt')}>{createdAt}</Row>
        <Row label={t('drawer.details.source')}>
          {t(`drawer.sources.${order.source}`, { defaultValue: order.source })}
        </Row>
        {order.terminal?.name && <Row label={t('drawer.details.terminal')}>{order.terminal.name}</Row>}
        {order.table?.number && <Row label={t('drawer.details.table')}>{order.table.number}</Row>}
        {serverName && <Row label={t('drawer.details.server')}>{serverName}</Row>}
        <Row label={t('drawer.details.type')}>
          <Badge variant="outline" className={`${typeCfg.bg} ${typeCfg.color} border-transparent`}>
            {typeCfg.label}
          </Badge>
        </Row>
      </div>
    </section>
  )
}
```

- [ ] **Step 7.2: Typecheck**

Run: `npm run build`

Expected: PASS. (Some `Order` field accesses may not exist on the current type — that's OK if Task 5 was completed first. Verify Task 5 is done.)

---

## Task 8: `ItemsSection` component

**Files:**
- Create: `src/pages/Order/components/sections/ItemsSection.tsx`

- [ ] **Step 8.1: Create the component**

```tsx
import { Separator } from '@/components/ui/separator'
import type { Order, OrderItem } from '@/types'
import { Currency } from '@/utils/currency'
import { useTranslation } from 'react-i18next'

interface Props {
  order: Order
}

const initials = (name: string) =>
  name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

const ItemRow = ({ item }: { item: OrderItem }) => {
  const { t } = useTranslation('orders')
  const name = item.productName || item.product?.name || t('drawer.items.customAmount')
  const sku = item.productSku || item.product?.sku
  const image = item.product?.image
  const isCustom = !item.productId
  const total = Number(item.total ?? 0)
  const unitPrice = Number(item.unitPrice ?? 0)

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-b-0">
      {image ? (
        <img src={image} alt="" className="w-10 h-10 rounded-md object-cover bg-muted" />
      ) : (
        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
          {isCustom ? 'Cu' : initials(name)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between gap-2">
          <p className="text-sm font-medium text-foreground line-clamp-2">
            <span className="font-semibold">{name}</span> × {item.quantity}
          </p>
          <p className="text-sm font-medium text-foreground whitespace-nowrap">{Currency(total)}</p>
        </div>
        {(sku || (item.quantity ?? 1) > 1) && (
          <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
            <span>{sku ? `${t('drawer.items.skuLabel', { defaultValue: 'SKU' })}: ${sku}` : ''}</span>
            {(item.quantity ?? 1) > 1 && <span>{Currency(unitPrice)} {t('drawer.items.perUnit')}</span>}
          </div>
        )}
        {item.modifiers && item.modifiers.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {item.modifiers.map((m, idx) => (
              <li key={idx} className="text-xs text-muted-foreground">
                • {m.name ?? m.modifier?.name} {Number(m.price ?? 0) > 0 && `(+${Currency(Number(m.price))})`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function ItemsSection({ order }: Props) {
  const { t } = useTranslation('orders')
  const items = order.items ?? []
  const subtotal = Number(order.subtotal ?? 0)
  const discount = Number((order as any).discountAmount ?? 0)
  const tax = Number(order.taxAmount ?? 0)
  const tip = Number(order.tipAmount ?? 0)
  const total = Number(order.total ?? 0)

  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground mb-3">{t('drawer.sections.items')}</h2>
      <div className="rounded-lg border border-border bg-background px-4">
        {items.length > 0 ? (
          items.map(item => <ItemRow key={item.id} item={item} />)
        ) : (
          <p className="py-4 text-sm text-muted-foreground">{t('drawer.items.noItems', { defaultValue: 'Sin artículos' })}</p>
        )}
        <Separator className="my-2" />
        <div className="py-2 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('drawer.totals.subtotal')}</span>
            <span className="text-foreground">{Currency(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('drawer.totals.discount')}</span>
              <span className="text-foreground">-{Currency(discount)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('drawer.totals.tax')}</span>
              <span className="text-foreground">{Currency(tax)}</span>
            </div>
          )}
          {tip > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('drawer.totals.tip')}</span>
              <span className="text-foreground">{Currency(tip)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-border">
            <span className="font-semibold text-foreground">{t('drawer.totals.total')}</span>
            <span className="font-bold text-base text-foreground">{Currency(total)}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
```

---

## Task 9: `PaymentsSection` component

**Files:**
- Create: `src/pages/Order/components/sections/PaymentsSection.tsx`

- [ ] **Step 9.1: Create the component**

```tsx
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { RECEIPT_PATHS } from '@/constants/receipt'
import type { Order, Payment } from '@/types'
import { Currency } from '@/utils/currency'
import { getOrderStatusConfig } from '@/utils/orderStatus'
import getIcon from '@/utils/getIcon'
import { Banknote, CreditCard, RotateCcw, Wallet, ChevronDown, ExternalLink } from 'lucide-react'
import { DateTime } from 'luxon'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

interface Props {
  order: Order
  venueTimezone: string
}

const PaymentIcon = ({ p }: { p: Payment }) => {
  const m = p.method?.toUpperCase()
  if (p.type === 'REFUND') return <div className="w-9 h-7 rounded-md bg-red-100 dark:bg-red-900/30 flex items-center justify-center"><RotateCcw className="w-4 h-4 text-red-700 dark:text-red-400" /></div>
  if (m === 'CASH') return <div className="w-9 h-7 rounded-md bg-muted flex items-center justify-center"><Banknote className="w-4 h-4 text-muted-foreground" /></div>
  if (m === 'DIGITAL_WALLET') return <div className="w-9 h-7 rounded-md bg-muted flex items-center justify-center"><Wallet className="w-4 h-4 text-muted-foreground" /></div>
  if ((m === 'CREDIT_CARD' || m === 'DEBIT_CARD') && p.cardBrand) return <>{getIcon(p.cardBrand)}</>
  return <div className="w-9 h-7 rounded-md bg-muted flex items-center justify-center"><CreditCard className="w-4 h-4 text-muted-foreground" /></div>
}

const PaymentRow = ({ p, venueTimezone }: { p: Payment; venueTimezone: string }) => {
  const { t } = useTranslation('orders')
  const { t: tPayment } = useTranslation('payment')
  const [open, setOpen] = useState(false)
  const isRefund = p.type === 'REFUND'
  const total = Number(p.amount ?? 0) + Number(p.tipAmount ?? 0)
  const date = DateTime.fromISO(p.createdAt, { zone: 'utc' }).setZone(venueTimezone).toFormat("d LLL, HH:mm", { locale: 'es' })
  const statusCfg = getOrderStatusConfig(p.status)
  const last4 = p.maskedPan?.slice(-4)
  const label = isRefund
    ? t('drawer.payments.refund')
    : p.cardBrand
      ? `${p.cardBrand}${last4 ? ` ····${last4}` : ''}`
      : tPayment(`methods.${String(p.method).toLowerCase()}`, { defaultValue: p.method })
  const receipt = p.receipts?.[0]
  const processedByName = p.processedBy ? `${p.processedBy.firstName ?? ''} ${p.processedBy.lastName ?? ''}`.trim() : null

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b border-border last:border-b-0">
      <div className="py-3 flex items-start gap-3">
        <PaymentIcon p={p} />
        <div className="flex-1 min-w-0">
          <div className="flex justify-between gap-2">
            <span className={`text-sm font-medium ${isRefund ? 'text-red-700 dark:text-red-400' : 'text-foreground'}`}>{label}</span>
            <span className={`text-sm font-medium ${isRefund ? 'text-red-700 dark:text-red-400' : 'text-foreground'}`}>
              {isRefund && '-'}{Currency(Math.abs(total))}
            </span>
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-xs text-muted-foreground">{date}</span>
            <Badge variant="outline" className={`${statusCfg.bg} ${statusCfg.color} ${statusCfg.border} text-[10px] py-0`}>
              {t(`detail.statuses.${p.status}`, { defaultValue: p.status })}
            </Badge>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-auto p-0 mt-1 text-xs underline" data-print-hide>
              {open ? t('drawer.payments.showLess') : t('drawer.payments.showMore')}
              <ChevronDown className={`ml-1 w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-1 text-xs">
            {isRefund ? (
              <>
                {p.refundReason && <Detail label={t('drawer.payments.reason')} value={p.refundReason} />}
                {receipt && <DetailLink label={t('drawer.payments.receipt')} href={`${RECEIPT_PATHS.PUBLIC}/${receipt.accessKey}`} text={receipt.accessKey.slice(0, 8)} />}
                {p.originalPaymentId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('drawer.payments.originalPayment')}</span>
                    <Link to={`../payments/${p.originalPaymentId}`} className="text-primary underline">{p.originalPaymentId.slice(0, 8)}</Link>
                  </div>
                )}
              </>
            ) : (
              <>
                {receipt && <DetailLink label={t('drawer.payments.receipt')} href={`${RECEIPT_PATHS.PUBLIC}/${receipt.accessKey}`} text={receipt.accessKey.slice(0, 8)} />}
                {processedByName && <Detail label={t('drawer.payments.processedBy')} value={processedByName} />}
                {p.authorizationNumber && <Detail label={t('drawer.payments.authorization')} value={p.authorizationNumber} />}
                {p.referenceNumber && <Detail label={t('drawer.payments.reference')} value={p.referenceNumber} />}
              </>
            )}
          </CollapsibleContent>
        </div>
      </div>
    </Collapsible>
  )
}

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-foreground">{value}</span>
  </div>
)

const DetailLink = ({ label, href, text }: { label: string; href: string; text: string }) => (
  <div className="flex justify-between">
    <span className="text-muted-foreground">{label}</span>
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">
      {text}<ExternalLink className="w-3 h-3" />
    </a>
  </div>
)

export function PaymentsSection({ order, venueTimezone }: Props) {
  const { t } = useTranslation('orders')
  const payments = order.payments ?? []

  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground mb-3">{t('drawer.sections.payments')}</h2>
      <div className="rounded-lg border border-border bg-background px-4">
        {payments.length > 0
          ? payments.map(p => <PaymentRow key={p.id} p={p} venueTimezone={venueTimezone} />)
          : <p className="py-4 text-sm text-muted-foreground">{t('drawer.payments.noPayments', { defaultValue: 'Sin pagos' })}</p>}
      </div>
    </section>
  )
}
```

- [ ] **Step 9.2: Confirm `RECEIPT_PATHS.PUBLIC` exists**

Run: `grep -n "PUBLIC" src/constants/receipt.ts`

Expected: a constant like `PUBLIC: '/r'` exists. If not, replace `${RECEIPT_PATHS.PUBLIC}/${receipt.accessKey}` with `/r/${receipt.accessKey}` (the public receipt URL pattern from `DigitalReceipt.accessKey`).

---

## Task 10: `ActivitySection` component

**Files:**
- Create: `src/pages/Order/components/sections/ActivitySection.tsx`

- [ ] **Step 10.1: Create the component**

```tsx
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import type { Order } from '@/types'
import { buildOrderActivity, type ActivityEvent } from '@/utils/orderActivity'
import { Currency } from '@/utils/currency'
import { CheckCircle2, ChevronDown, CreditCard, FileText, Plus, RotateCcw, AlertCircle } from 'lucide-react'
import { DateTime } from 'luxon'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  order: Order
  venueTimezone: string
}

const iconFor = (e: ActivityEvent) => {
  switch (e.type) {
    case 'created': return FileText
    case 'items_added': return Plus
    case 'action': return AlertCircle
    case 'payment': return CreditCard
    case 'refund': return RotateCcw
    case 'completed': return CheckCircle2
  }
}

const Node = ({ event, isLast, venueTimezone }: { event: ActivityEvent; isLast: boolean; venueTimezone: string }) => {
  const { t } = useTranslation('orders')
  const [open, setOpen] = useState(false)
  const Icon = iconFor(event)
  const time = DateTime.fromISO(event.timestamp, { zone: 'utc' }).setZone(venueTimezone).toFormat("d LLL, HH:mm", { locale: 'es' })

  let title = ''
  let detail: React.ReactNode = null
  switch (event.type) {
    case 'created':
      title = t('drawer.activity.created')
      if (event.staffName) detail = event.staffName
      break
    case 'items_added':
      title = t('drawer.activity.itemsAdded', { count: event.count })
      detail = (
        <ul className="mt-1 space-y-0.5">
          {event.items.map((it, i) => <li key={i}>• {it.name} × {it.quantity}</li>)}
        </ul>
      )
      break
    case 'action':
      title = `${event.actionType}${event.reason ? `: ${event.reason}` : ''}`
      if (event.staffName) detail = event.staffName
      break
    case 'payment':
      title = t('drawer.activity.paymentProcessed', {
        amount: Currency(event.amount),
        method: event.cardBrand ?? event.method,
      })
      break
    case 'refund':
      title = t('drawer.activity.refundIssued', { amount: Currency(Math.abs(event.amount)) })
      if (event.refundReason) detail = event.refundReason
      break
    case 'completed':
      title = t('drawer.activity.completed')
      break
  }

  const expandable = detail !== null
  const dotColor = event.type === 'refund' ? 'border-red-500 text-red-500'
    : event.type === 'completed' ? 'border-green-500 text-green-600'
    : 'border-border text-muted-foreground'

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-7 h-7 rounded-full border-2 ${dotColor} bg-background flex items-center justify-center shrink-0`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
      </div>
      <div className="flex-1 pb-4">
        <p className="text-sm text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{time}</p>
        {expandable && (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-auto p-0 mt-1 text-xs underline" data-print-hide>
                {open ? t('drawer.activity.hideDetails') : t('drawer.activity.showDetails')}
                <ChevronDown className={`ml-1 w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="text-xs text-muted-foreground mt-1">{detail}</CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  )
}

export function ActivitySection({ order, venueTimezone }: Props) {
  const { t } = useTranslation('orders')
  const events = buildOrderActivity(order)

  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground mb-3">{t('drawer.sections.activity')}</h2>
      <div className="rounded-lg border border-border bg-background p-4">
        {events.map((e, i) => (
          <Node key={i} event={e} isLast={i === events.length - 1} venueTimezone={venueTimezone} />
        ))}
      </div>
    </section>
  )
}
```

---

## Task 11: `OrderActionsSheet` component

**Files:**
- Create: `src/pages/Order/components/OrderActionsSheet.tsx`

- [ ] **Step 11.1: Create the component**

```tsx
import api from '@/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import type { Order, Payment } from '@/types'
import { Currency } from '@/utils/currency'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

interface Props {
  order: Order
  open: boolean
  onOpenChange: (open: boolean) => void
  fullBasePath: string
}

type View = 'menu' | 'select-for-view' | 'select-for-receipt' | 'send-receipt'

export function OrderActionsSheet({ order, open, onOpenChange, fullBasePath }: Props) {
  const { t } = useTranslation('orders')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [view, setView] = useState<View>('menu')
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null)
  const [email, setEmail] = useState(order.customerEmail ?? '')

  const payments = order.payments ?? []
  const hasOne = payments.length === 1
  const reset = () => {
    setView('menu')
    setSelectedPaymentId(null)
    setEmail(order.customerEmail ?? '')
  }

  const sendMutation = useMutation({
    mutationFn: async ({ paymentId, recipientEmail }: { paymentId: string; recipientEmail: string }) => {
      return api.post(`/api/v1/dashboard/venues/${venueId}/payments/${paymentId}/send-receipt`, { recipientEmail })
    },
    onSuccess: () => {
      toast({ title: t('drawer.toast.receiptSent', { defaultValue: 'Recibo enviado' }) })
      onOpenChange(false)
      reset()
    },
    onError: () => {
      toast({ title: t('drawer.toast.receiptError', { defaultValue: 'No se pudo enviar el recibo' }), variant: 'destructive' })
    },
  })

  const goToTransaction = (paymentId: string) => {
    navigate(`${fullBasePath}/payments/${paymentId}`)
    onOpenChange(false)
    reset()
  }

  const handleViewTransaction = () => {
    if (hasOne) goToTransaction(payments[0].id)
    else setView('select-for-view')
  }
  const handleSendReceipt = () => {
    if (hasOne) {
      setSelectedPaymentId(payments[0].id)
      setView('send-receipt')
    } else setView('select-for-receipt')
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {view === 'menu' && t('drawer.actions.title', { defaultValue: 'Acciones' })}
            {(view === 'select-for-view' || view === 'select-for-receipt') && t('drawer.actions.selectPayment')}
            {view === 'send-receipt' && t('drawer.actions.sendReceipt')}
          </DialogTitle>
        </DialogHeader>

        {view === 'menu' && (
          <div className="space-y-2">
            <Button variant="secondary" className="w-full justify-center h-12 rounded-full" onClick={handleViewTransaction} disabled={payments.length === 0}>
              {t('drawer.actions.viewTransaction')}
            </Button>
            <Button variant="secondary" className="w-full justify-center h-12 rounded-full" onClick={handleSendReceipt} disabled={payments.length === 0}>
              {t('drawer.actions.sendReceipt')}
            </Button>
          </div>
        )}

        {(view === 'select-for-view' || view === 'select-for-receipt') && (
          <div className="space-y-2">
            {payments.map(p => (
              <Button
                key={p.id}
                variant="outline"
                className="w-full justify-between"
                onClick={() => {
                  if (view === 'select-for-view') goToTransaction(p.id)
                  else { setSelectedPaymentId(p.id); setView('send-receipt') }
                }}
              >
                <span>{p.cardBrand || p.method}</span>
                <span>{Currency(Number(p.amount) + Number(p.tipAmount))}</span>
              </Button>
            ))}
          </div>
        )}

        {view === 'send-receipt' && selectedPaymentId && (
          <div className="space-y-3">
            <Label htmlFor="recipient-email">{t('drawer.details.email')}</Label>
            <Input
              id="recipient-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@email.com"
            />
            <Button
              className="w-full"
              disabled={!email || sendMutation.isPending}
              onClick={() => sendMutation.mutate({ paymentId: selectedPaymentId, recipientEmail: email })}
            >
              {sendMutation.isPending ? '...' : t('drawer.actions.sendReceipt')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

---

# PHASE 4 — Frontend integration

## Task 12: `OrderDrawerContent` (parent component)

**Files:**
- Create: `src/pages/Order/OrderDrawerContent.tsx`

- [ ] **Step 12.1: Create the component**

```tsx
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import * as orderService from '@/services/order.service'
import { formatOrderNumber, getOrderStatusConfig } from '@/utils/orderStatus'
import { useQuery } from '@tanstack/react-query'
import { MoreHorizontal, Printer, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { OrderActionsSheet } from './components/OrderActionsSheet'
import { ActivitySection } from './components/sections/ActivitySection'
import { DetailsSection } from './components/sections/DetailsSection'
import { ItemsSection } from './components/sections/ItemsSection'
import { PaymentsSection } from './components/sections/PaymentsSection'

interface Props {
  orderId: string
  onClose: () => void
}

export function OrderDrawerContent({ orderId, onClose }: Props) {
  const { t } = useTranslation('orders')
  const { venueId, venue, fullBasePath } = useCurrentVenue()
  const venueTimezone = venue?.timezone || 'America/Mexico_City'
  const [actionsOpen, setActionsOpen] = useState(false)

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', venueId, orderId],
    queryFn: () => orderService.getOrder(venueId, orderId),
    enabled: !!orderId,
  })

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        <div className="h-6 w-32 bg-muted rounded animate-pulse" />
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted rounded animate-pulse mt-6" />
        <div className="h-32 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-muted-foreground">{t('detail.notFound', { defaultValue: 'Orden no encontrada' })}</p>
        <Button onClick={onClose}>{t('detail.backToOrders', { defaultValue: 'Volver a pedidos' })}</Button>
      </div>
    )
  }

  const statusCfg = getOrderStatusConfig(order.status)
  const paymentStatusCfg = getOrderStatusConfig(order.paymentStatus)

  return (
    <div data-print-root className="flex flex-col h-full bg-background">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-background" data-print-hide>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
          <X className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => window.print()} className="rounded-full" title={t('drawer.actions.print')}>
            <Printer className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setActionsOpen(true)} className="rounded-full" title={t('drawer.actions.more')}>
            <MoreHorizontal className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {t('drawer.title', { number: formatOrderNumber(order.orderNumber) })}
          </h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline" className={`${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
              {t(`detail.statuses.${order.status}`, { defaultValue: order.status })}
            </Badge>
            <Badge variant="outline" className={`${paymentStatusCfg.bg} ${paymentStatusCfg.color} ${paymentStatusCfg.border}`}>
              {t(`detail.statuses.${order.paymentStatus}`, { defaultValue: order.paymentStatus })}
            </Badge>
          </div>
        </div>

        <DetailsSection order={order} venueTimezone={venueTimezone} />
        <ItemsSection order={order} />
        <PaymentsSection order={order} venueTimezone={venueTimezone} />
        <ActivitySection order={order} venueTimezone={venueTimezone} />
      </div>

      <OrderActionsSheet
        order={order}
        open={actionsOpen}
        onOpenChange={setActionsOpen}
        fullBasePath={fullBasePath}
      />
    </div>
  )
}
```

- [ ] **Step 12.2: Typecheck**

Run: `npm run build`

Expected: PASS.

---

## Task 13: Wire `OrderDrawerContent` in `Orders.tsx`

**Files:**
- Modify: `src/pages/Order/Orders.tsx:48` (import) and `:1481-1490` (Sheet body)

- [ ] **Step 13.1: Replace the import**

Replace:
```ts
import OrderId from './OrderId'
```
with:
```ts
import { OrderDrawerContent } from './OrderDrawerContent'
```

- [ ] **Step 13.2: Replace the Sheet body**

Locate the existing Sheet block (around line 1481):

```tsx
<Sheet open={!!drawerOrderId} ...>
  <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto p-0 [&>button]:z-20">
    {drawerOrderId && <OrderId />}
  </SheetContent>
</Sheet>
```

Replace the inner content so the Sheet itself stays untouched but renders `OrderDrawerContent`:

```tsx
<Sheet
  open={!!drawerOrderId}
  onOpenChange={(open) => {
    if (!open) navigate(`${fullBasePath}/orders`)
  }}
>
  <SheetContent side="right" className="w-full sm:max-w-2xl p-0 [&>button]:hidden">
    {drawerOrderId && (
      <OrderDrawerContent
        orderId={drawerOrderId}
        onClose={() => navigate(`${fullBasePath}/orders`)}
      />
    )}
  </SheetContent>
</Sheet>
```

Notes:
- `[&>button]:hidden` hides the default shadcn close button (we render our own X in the header).
- `sm:max-w-2xl` (~672px) is closer to Square's narrower drawer width. Adjust if it feels too tight.
- Removed `overflow-y-auto` because `OrderDrawerContent` manages its own scroll region.

- [ ] **Step 13.3: If `fullBasePath` is not in scope at this line, import the hook**

If `fullBasePath` is not already destructured from `useCurrentVenue()` in `Orders.tsx`, add it there (do NOT call the hook twice).

Run: `grep -n "useCurrentVenue\|fullBasePath" src/pages/Order/Orders.tsx | head -5`

Expected: hook is already used. Update destructure if missing.

- [ ] **Step 13.4: Typecheck and start dev server**

Run: `npm run build`

Expected: PASS.

---

## Task 14: Add i18n keys

**Files:**
- Modify: `src/locales/es/orders.json`
- Modify: `src/locales/en/orders.json`

- [ ] **Step 14.1: Add Spanish keys**

Add a `drawer` block to `src/locales/es/orders.json`. Merge with existing top-level keys — DO NOT replace the file:

```json
{
  "drawer": {
    "title": "Recibo n.° {{number}}",
    "actions": {
      "title": "Acciones",
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
      "skuLabel": "SKU",
      "noItems": "Sin artículos",
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
      "reason": "Motivo",
      "noPayments": "Sin pagos registrados"
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
    },
    "toast": {
      "receiptSent": "Recibo enviado",
      "receiptError": "No se pudo enviar el recibo"
    }
  }
}
```

- [ ] **Step 14.2: Add English keys (mirror, translated)**

Add the same `drawer` block to `src/locales/en/orders.json` with English values. Use Square's English wording where applicable: "Receipt #{{number}}", "Details", "Items", "Payments", "Activity", "View transaction details", "Send receipt", "Show more"/"Show less", "Refund issued: {{amount}}", etc.

- [ ] **Step 14.3: Verify the translations load**

Run: `npm run build`

Expected: PASS. JSON syntax errors will surface at build time.

---

## Task 15: Add print CSS

**Files:**
- Modify: `src/index.css`

- [ ] **Step 15.1: Append print rules**

Add at the bottom of `src/index.css`:

```css
@media print {
  /* Hide app shell and the orders list behind the drawer */
  body * { visibility: hidden; }
  [data-print-root], [data-print-root] * { visibility: visible; }
  [data-print-root] {
    position: absolute !important;
    left: 0; top: 0;
    width: 100% !important;
    max-width: 100% !important;
    box-shadow: none !important;
    border: none !important;
    overflow: visible !important;
    background: white !important;
    color: black !important;
  }
  [data-print-hide] { display: none !important; }
  /* Force light colors in print to save ink */
  [data-print-root] * {
    color: black !important;
    background-color: white !important;
    border-color: #ccc !important;
  }
}
```

- [ ] **Step 15.2: Manual print verification**

Open the dashboard in a browser, open an order drawer, hit the printer icon. Use the browser's print preview to confirm only the drawer body is visible (no sidebar, no orders list, no header chrome).

---

## Task 16: Delete `OrderId.tsx`

**Files:**
- Delete: `src/pages/Order/OrderId.tsx`

- [ ] **Step 16.1: Confirm no other file imports `OrderId`**

Run: `grep -rn "from './OrderId'\|from '@/pages/Order/OrderId'\|/Order/OrderId" src/`

Expected: zero matches (after Task 13). If any match exists, fix before deleting.

- [ ] **Step 16.2: Delete the file**

Run: `rm src/pages/Order/OrderId.tsx`

- [ ] **Step 16.3: Typecheck and full build**

Run: `npm run build`

Expected: PASS.

---

## Task 17: Manual smoke test + final verification

**Files:** none

- [ ] **Step 17.1: Start dev servers**

In `avoqado-server`: `npm run dev`
In `avoqado-web-dashboard`: `npm run dev`

- [ ] **Step 17.2: Smoke checklist**

Open the dashboard, navigate to Orders, click any order to open the drawer.

- [ ] Header shows X (left), Printer + ⋯ (right). Title shows "Recibo n.° XXXXXX".
- [ ] Status badges (e.g., "Completado", "Pagada") render in correct color.
- [ ] **Detalles** section shows email, fecha, origen, punto de venta, mesa, mesero, tipo (only those with values).
- [ ] **Artículos** section shows each item with image/initials, name × qty, SKU, modifiers, total. Totals block at the bottom.
- [ ] **Pagos** section shows each payment with icon, label (e.g., "Visa ····1111"), date, amount, status pill. Refund payments are red and labeled "Reembolso" with negative amount. "Mostrar más" expands to show extra fields.
- [ ] **Actividad** section shows vertical timeline with events in chronological order: Pedido creado → items added → pago → refund → completado. "Mostrar detalles" expands where applicable.
- [ ] Click ⋯ — `OrderActionsSheet` opens. Click "Ver la información de la transacción" — PaymentDrawer opens on top (URL becomes `/payments/:paymentId`). Close it — order drawer is still there.
- [ ] Click ⋯ → "Enviar recibo" — email input pre-filled, Enviar triggers toast.
- [ ] Click X — drawer closes, URL returns to `/orders`.
- [ ] Toggle dark mode — every section still legible, no hard-coded colors leaking.
- [ ] Print preview shows only the drawer content.

- [ ] **Step 17.3: Run frontend tests**

Run: `npm test -- src/utils/orderActivity.test.ts`

Expected: 8 tests PASS.

- [ ] **Step 17.4: Run lint and format**

Run: `npm run format && npm run lint:fix`

Expected: zero warnings.

- [ ] **Step 17.5: PROPOSED COMMITS — ask user for each**

Suggested split (one PR can include multiple commits, but ask before each):

1. `feat(order-status): extract status helpers to shared util` — `src/utils/orderStatus.ts`
2. `feat(types): extend Order and Payment with terminal/actions/refunds/receipts fields` — `src/types.ts`
3. `feat(order-activity): add buildOrderActivity timeline builder with tests` — `src/utils/orderActivity.ts`, `src/utils/orderActivity.test.ts`
4. `feat(order-drawer): Square-style drawer body with Detalles/Artículos/Pagos/Actividad sections` — all new files in `src/pages/Order/components/` and `OrderDrawerContent.tsx`
5. `feat(order-drawer): add 3-dot actions sheet for view-transaction and send-receipt` — `OrderActionsSheet.tsx`
6. `feat(order-drawer): wire OrderDrawerContent into Orders.tsx Sheet` — `Orders.tsx`
7. `feat(i18n): add drawer namespace keys for order Square-style drawer` — both `orders.json` files
8. `feat(print): add print CSS for order drawer` — `src/index.css`
9. `chore: delete deprecated OrderId.tsx (replaced by OrderDrawerContent)` — file deletion

All commits use the standard `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` line.

---

## Self-review (already applied)

- ✅ All spec sections (3.1 includes, 3.2 mapper, 4.1–4.10 components/i18n/print, 5 theme, 6 edge cases) are covered by at least one task.
- ✅ No "TODO", "TBD", or "implement later" placeholders.
- ✅ Type names consistent across tasks (`Order`, `Payment`, `OrderAction`, `ActivityEvent`).
- ✅ Function names consistent (`mapOrderPaymentsWithRefunds`, `buildOrderActivity`, `getOrderStatusConfig`, `formatOrderNumber`).
- ✅ File paths absolute and exact.
- ✅ Each commit step is marked PROPOSED to honor the user's no-auto-commit rule.
