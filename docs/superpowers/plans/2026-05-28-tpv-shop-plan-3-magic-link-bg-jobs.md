# TPV Shop — Plan 3: Magic-link serial assignment + background jobs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Hacer que sales pueda asignar números de serie **sin loguearse** (magic-link igual que aprobar/rechazar). Hoy (post Plan 1) el correo #5 a sales linkea al admin UI con login. Plan 3 lo cambia a magic-link público con form de serials. Además, agrega un cron job que:
- Marca como `EXPIRED` órdenes con `AWAITING_PAYMENT` > 7d o `AWAITING_PROOF` > 14d.
- Manda recordatorios al cliente SPEI a los 3 y 7 días sin comprobante.

**Architecture:** Reutilizamos el `token.service` de Plan 2 — ya soporta `action: 'approve' | 'reject'`, agregamos `'assign-serials'`. Cuando una orden pasa a `PAID`, generamos el token con esa action y guardamos en `serialAssignmentToken` (campo ya existente en el modelo). El correo #5 se cambia para construir la magic-link URL en vez de la URL de superadmin. Endpoint público nuevo recibe el form. Background job nuevo con patrón existente (`abandoned-orders-cleanup.job.ts` como referencia) — clase con `start()` / `stop()`, `CronJob` con timezone México, registrada en `server.ts`. La cron pattern: cada 6h. Emails de recordatorio reutilizan el helper de envío.

**Tech Stack:** Igual que Plans 1+2 más `cron` (ya instalado, patrón ya en uso por 25+ jobs en `src/jobs/`).

**Refs:**
- Spec: `docs/superpowers/specs/2026-05-28-tpv-shop-stripe-spei-design.md`
- Plan 1: `docs/superpowers/plans/2026-05-28-tpv-shop-plan-1-card-flow.md`
- Plan 2: `docs/superpowers/plans/2026-05-28-tpv-shop-plan-2-spei-flow.md`
- Token service (Plan 2): `avoqado-server/src/services/dashboard/terminalOrder/token.service.ts`
- Email service: `avoqado-server/src/services/email.service.ts`
- assignSerials service (Plan 1 Task 7): `avoqado-server/src/services/dashboard/terminalOrder/terminalOrder.service.ts`
- Stripe webhook handler (Plan 1 Task 11): `avoqado-server/src/services/stripe-webhooks/terminalOrderCheckoutCompleted.handler.ts`
- approveSpei (Plan 2 Task 2): same `terminalOrder.service.ts`
- Job reference: `avoqado-server/src/jobs/abandoned-orders-cleanup.job.ts` (class-based with CronJob + Mexico City TZ)
- Server bootstrap: `avoqado-server/src/server.ts` (where existing jobs are registered)

**Project conventions** (locked from Plans 1+2):
- Jest tests at `tests/unit/services/...`
- Prisma: `import prisma from '@/utils/prismaClient'`
- Email service: class with `async methodName(): Promise<boolean>` returning `this.sendEmail(...)`
- Working branch: `develop`. NO new branches. NO `git commit` — stage only.
- Off-limits files (do NOT touch): `classSession.*`, `createOrderFromReservation.ts`.

---

## Phase A — Token + magic-link backend

### Task 1: Extend `token.service` to support `assign-serials` action + tests

**Files:**
- Modify: `avoqado-server/src/services/dashboard/terminalOrder/token.service.ts`
- Modify: `avoqado-server/tests/unit/services/dashboard/terminalOrder/token.service.test.ts`

- [ ] **Step 1: Add `'assign-serials'` to the action union**

```typescript
export type TerminalOrderTokenAction = 'approve' | 'reject' | 'assign-serials'
```

Add a sign helper for explicit caller intent (optional convenience, but recommended):

```typescript
export function signSerialAssignmentToken(orderId: string, expiresInSeconds = 30 * 24 * 60 * 60): string {
  return signApprovalToken({ orderId, action: 'assign-serials', expiresInSeconds })
}

export function verifySerialAssignmentToken(token: string): TerminalOrderTokenPayload {
  return verifyApprovalToken(token, { expectedAction: 'assign-serials' })
}
```

Default expiry: 30 days (longer than the 7-day approve/reject window since serial assignment can be delayed by inventory).

- [ ] **Step 2: Add tests**

Append:

```typescript
describe('signSerialAssignmentToken / verifySerialAssignmentToken', () => {
  it('signs + verifies a serial-assignment token round-trip', () => {
    const token = signSerialAssignmentToken('ord_42')
    const payload = verifySerialAssignmentToken(token)
    expect(payload.orderId).toBe('ord_42')
    expect(payload.action).toBe('assign-serials')
  })

  it('rejects an approve token when verifying as assign-serials', () => {
    const approveToken = signApprovalToken({ orderId: 'ord_42', action: 'approve' })
    expect(() => verifySerialAssignmentToken(approveToken)).toThrow(/action mismatch/i)
  })
})
```

- [ ] **Step 3: Run jest, expect 7/7 pass**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server
npx jest tests/unit/services/dashboard/terminalOrder/token.service.test.ts
```

- [ ] **Step 4: Stage**

```bash
git add src/services/dashboard/terminalOrder/token.service.ts \
        tests/unit/services/dashboard/terminalOrder/token.service.test.ts
```

---

### Task 2: Generate + persist `serialAssignmentToken` when paymentStatus → PAID

**Files:**
- Modify: `avoqado-server/src/services/stripe-webhooks/terminalOrderCheckoutCompleted.handler.ts`
- Modify: `avoqado-server/src/services/dashboard/terminalOrder/terminalOrder.service.ts` (modify `approveSpei`)

Both flows (Stripe webhook AND SPEI approve) end with `paymentStatus = PAID + fulfillmentStatus = AWAITING_SERIALS`. Add token generation + persistence at both points so email #5 (sales notification) has a token to embed.

- [ ] **Step 1: Stripe webhook handler**

Replace the `prisma.terminalOrder.update({...})` block in `handleTerminalOrderCheckoutCompleted` with:

```typescript
const serialToken = (await import('@/services/dashboard/terminalOrder/token.service'))
  .signSerialAssignmentToken(order.id)
const tokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

const updated = await prisma.terminalOrder.update({
  where: { id: order.id },
  data: {
    paymentStatus: 'PAID',
    stripePaymentIntentId: paymentIntentId ?? undefined,
    fulfillmentStatus: 'AWAITING_SERIALS',
    serialAssignmentToken: serialToken,
    serialAssignmentTokenExpiresAt: tokenExpires,
  },
})
```

- [ ] **Step 2: `approveSpei` service**

Same change in `approveSpei`. Generate the serial token before the update, persist it in the same call. The token is passed to the email #5 trigger so the magic-link URL has it.

```typescript
const serialToken = signSerialAssignmentToken(order.id)
const tokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

const updated = await prisma.terminalOrder.update({
  where: { id: order.id },
  data: {
    paymentStatus: 'PAID',
    fulfillmentStatus: 'AWAITING_SERIALS',
    speiApprovedAt: new Date(),
    speiApprovedBy: input.approvedBy,
    speiApprovalToken: null,
    speiTokenExpiresAt: null,
    serialAssignmentToken: serialToken,
    serialAssignmentTokenExpiresAt: tokenExpires,
  },
  include: { items: true },
})
```

Import `signSerialAssignmentToken` at the top (alongside the existing `signApprovalToken` import).

- [ ] **Step 3: Build + run service tests**

```bash
npm run build
npx jest tests/unit/services/dashboard/terminalOrder/
```

Expect: still 25/25 pass (tests mock prisma — updated data assertion may need to include the new fields, but since most assertions check only specific keys, they should still pass; if any fail, update them to include `serialAssignmentToken: expect.any(String)`).

- [ ] **Step 4: Stage**

```bash
git add src/services/stripe-webhooks/terminalOrderCheckoutCompleted.handler.ts \
        src/services/dashboard/terminalOrder/terminalOrder.service.ts \
        tests/unit/services/dashboard/terminalOrder/terminalOrder.service.test.ts
```

---

### Task 3: Update Email #5 to use magic-link URL

**Files:**
- Modify: `avoqado-server/src/services/email.service.ts`

`sendTerminalOrderSerialAssignmentRequest` currently links to `/superadmin/tpv-orders/:id` (login required). Plan 3 swaps that to a magic-link URL.

- [ ] **Step 1: Extend `TerminalOrderEmailData` shape**

The current interface includes `order.id` + `order.orderNumber`. Add a new field for the magic-link URL:

Either:
- (a) Pass a new `serialAssignmentUrl` field on the data argument (cleaner).
- (b) Compute it inside the method by reading `order.serialAssignmentToken`.

Go with (a) — explicit, no env-var coupling in the email layer.

Extend the interface:

```typescript
export interface SerialAssignmentRequestEmailData extends TerminalOrderEmailData {
  serialAssignmentUrl: string  // magic link, no auth required
  adminUiUrl: string            // fallback to login-required superadmin UI
}
```

- [ ] **Step 2: Update the method signature and template**

Change `sendTerminalOrderSerialAssignmentRequest(data: TerminalOrderEmailData)` to `(data: SerialAssignmentRequestEmailData)`.

In the HTML, replace the existing single CTA button with TWO buttons side by side:

```html
<div style="text-align: center; margin-bottom: 24px;">
  <a href="${data.serialAssignmentUrl}" style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Asignar números de serie</a>
</div>
<div style="text-align: center; margin-bottom: 32px;">
  <a href="${data.adminUiUrl}" style="font-size: 13px; color: #666; text-decoration: none;">Ver en admin UI (login requerido) →</a>
</div>
```

In the text version:

```
Asignar serials: ${data.serialAssignmentUrl}
Admin UI:        ${data.adminUiUrl}
```

- [ ] **Step 3: Update all call sites**

Grep for `sendTerminalOrderSerialAssignmentRequest`:

```bash
grep -rn "sendTerminalOrderSerialAssignmentRequest" src/
```

Update each call site to pass `serialAssignmentUrl` and `adminUiUrl` instead of (or in addition to) the old single URL. There are two call sites:

1. `stripe-webhooks/terminalOrderCheckoutCompleted.handler.ts` — Stripe webhook after PAID.
2. `terminalOrder.service.ts` → `approveSpei` — SPEI approve.

Both must read the newly-persisted `serialAssignmentToken` from the updated order and build the URL using a helper.

Add a helper in `terminalOrder.service.ts` (or reuse `buildMagicLinkUrls` from Plan 2):

```typescript
function buildSerialAssignmentUrls(orderId: string, token: string) {
  const baseUrl =
    process.env.DASHBOARD_URL ??
    process.env.FRONTEND_URL ??
    process.env.APP_URL ??
    'https://dashboardv2.avoqado.io'
  return {
    serialAssignmentUrl: `${baseUrl}/admin/tpv-orders/${orderId}/assign-serials?token=${encodeURIComponent(token)}`,
    adminUiUrl: `${baseUrl}/superadmin/tpv-orders/${orderId}`,
  }
}
```

In `approveSpei`, after the update:

```typescript
const { serialAssignmentUrl, adminUiUrl } = buildSerialAssignmentUrls(updated.id, serialToken)
await emailService.sendTerminalOrderSerialAssignmentRequest({
  order: updated as any,
  items: order.items,
  serialAssignmentUrl,
  adminUiUrl,
})
```

Same change in the Stripe webhook handler — but the helper is in another file. Inline it there or move `buildSerialAssignmentUrls` to a shared util (e.g., a new `urls.ts` in `terminalOrder/`). Recommend a shared util — both handlers need it.

Create `src/services/dashboard/terminalOrder/urls.ts`:

```typescript
function getBaseUrl(): string {
  return (
    process.env.DASHBOARD_URL ??
    process.env.FRONTEND_URL ??
    process.env.APP_URL ??
    'https://dashboardv2.avoqado.io'
  )
}

export function buildMagicLinkUrls(orderId: string, token: string) {
  const base = getBaseUrl()
  return {
    approveUrl: `${base}/admin/tpv-orders/${orderId}/approve?token=${encodeURIComponent(token)}`,
    rejectUrl: `${base}/admin/tpv-orders/${orderId}/reject?token=${encodeURIComponent(token)}`,
    adminUiUrl: `${base}/superadmin/tpv-orders/${orderId}`,
  }
}

export function buildSerialAssignmentUrls(orderId: string, token: string) {
  const base = getBaseUrl()
  return {
    serialAssignmentUrl: `${base}/admin/tpv-orders/${orderId}/assign-serials?token=${encodeURIComponent(token)}`,
    adminUiUrl: `${base}/superadmin/tpv-orders/${orderId}`,
  }
}
```

Then refactor `terminalOrder.service.ts` to import from `./urls.ts` (remove the inlined `buildMagicLinkUrls` helper Plan 2 added).

- [ ] **Step 4: Build + run tests**

```bash
npm run build
npx jest tests/unit/services/dashboard/terminalOrder/
```

Existing tests mock email — should still pass.

- [ ] **Step 5: Stage**

```bash
git add src/services/dashboard/terminalOrder/ \
        src/services/email.service.ts \
        src/services/stripe-webhooks/
```

---

### Task 4: Public endpoint `POST /api/v1/public/tpv-orders/:id/assign-serials` + GET check

**Files:**
- Modify: `avoqado-server/src/controllers/public/tpvOrder.public.controller.ts` (add 2 handlers)
- Modify: `avoqado-server/src/schemas/public/tpvOrder.public.schema.ts` (add Zod schema)
- Modify: `avoqado-server/src/routes/public.routes.ts` (add 2 routes)

- [ ] **Step 1: Zod schema**

```typescript
export const assignSerialsPublicSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          orderItemId: z.string().min(1, 'orderItemId requerido'),
          units: z
            .array(
              z.object({
                name: z.string().min(1, 'El nombre del terminal es obligatorio'),
                serial: z.string().min(1, 'El número de serie es obligatorio'),
              }),
            )
            .min(1, 'Mínimo una unidad por item'),
        }),
      )
      .min(1, 'Mínimo un item'),
  }),
})
```

- [ ] **Step 2: Controller handlers**

```typescript
import { verifySerialAssignmentToken } from '@/services/dashboard/terminalOrder/token.service'
import { assignSerials } from '@/services/dashboard/terminalOrder/terminalOrder.service'

export async function assignSerialsCheckHandler(req: Request, res: Response) {
  const { id } = req.params
  const token = String(req.query.token ?? '')
  try {
    const payload = verifySerialAssignmentToken(token)
    if (payload.orderId !== id) {
      res.status(403).json({ success: false, error: 'Token does not match this order' })
      return
    }
    // Also include the order shape so the form can render with the right items
    const order = await prisma.terminalOrder.findUnique({
      where: { id },
      include: { items: true, venue: { select: { name: true, slug: true } } },
    })
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' })
      return
    }
    if (order.fulfillmentStatus !== 'AWAITING_SERIALS') {
      res.status(409).json({
        success: false,
        error: `Order is no longer in AWAITING_SERIALS state (current: ${order.fulfillmentStatus})`,
      })
      return
    }
    res.json({ success: true, data: order })
  } catch (err) {
    res.status(401).json({ success: false, error: err instanceof Error ? err.message : 'Token inválido' })
  }
}

export async function assignSerialsPublicHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const token = String(req.query.token ?? '')
    let payload
    try {
      payload = verifySerialAssignmentToken(token)
    } catch (err) {
      res.status(401).json({ success: false, error: err instanceof Error ? err.message : 'Token inválido' })
      return
    }
    if (payload.orderId !== id) {
      res.status(403).json({ success: false, error: 'Token does not match this order' })
      return
    }

    const updated = await assignSerials({
      orderId: id,
      assignedBy: 'magic-link',
      items: req.body.items,
    })

    // Clear the serial assignment token after successful use (single-use, like approve)
    await prisma.terminalOrder.update({
      where: { id },
      data: { serialAssignmentToken: null, serialAssignmentTokenExpiresAt: null },
    })

    res.json({ success: true, data: { orderId: updated.id, orderNumber: updated.orderNumber } })
  } catch (error) {
    logger.error('assignSerialsPublicHandler failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    if (error instanceof Error) {
      res.status(400).json({ success: false, error: error.message })
      return
    }
    next(error)
  }
}
```

(Add `import prisma from '@/utils/prismaClient'` at the top of the controller if not already present.)

- [ ] **Step 3: Routes**

```typescript
import { assignSerialsPublicSchema } from '../schemas/public/tpvOrder.public.schema'

router.get('/tpv-orders/:id/assign-serials/check', tpvOrderPublicController.assignSerialsCheckHandler)
router.post(
  '/tpv-orders/:id/assign-serials',
  validateRequest(assignSerialsPublicSchema),
  tpvOrderPublicController.assignSerialsPublicHandler,
)
```

Match the existing rate-limit pattern in `public.routes.ts` (likely `cancelLimit` for mutations).

- [ ] **Step 4: Build + stage**

```bash
npm run build
git add src/controllers/public/tpvOrder.public.controller.ts \
        src/schemas/public/tpvOrder.public.schema.ts \
        src/routes/public.routes.ts
```

---

## Phase B — Frontend magic-link page

### Task 5: Page `/admin/tpv-orders/:id/assign-serials`

**Files:**
- Create: `avoqado-web-dashboard/src/pages/PublicAdmin/AssignSerialsTpvOrder.tsx`
- Modify: `avoqado-web-dashboard/src/services/tpvOrder.service.ts` (add 2 methods to `tpvOrderPublicService`)
- Modify: `avoqado-web-dashboard/src/routes/lazyComponents.ts`
- Modify: `avoqado-web-dashboard/src/routes/router.tsx`

- [ ] **Step 1: Extend frontend service**

Add to `tpvOrderPublicService`:

```typescript
async checkAssignSerialsToken(orderId: string, token: string) {
  const { data } = await api.get(
    `/api/v1/public/tpv-orders/${orderId}/assign-serials/check?token=${encodeURIComponent(token)}`,
  )
  return data.data  // includes the order with items + venue
},
async submitAssignSerials(
  orderId: string,
  token: string,
  items: { orderItemId: string; units: { name: string; serial: string }[] }[],
) {
  const { data } = await api.post(
    `/api/v1/public/tpv-orders/${orderId}/assign-serials?token=${encodeURIComponent(token)}`,
    { items },
  )
  return data.data
},
```

- [ ] **Step 2: The page**

```tsx
// src/pages/PublicAdmin/AssignSerialsTpvOrder.tsx
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { tpvOrderPublicService } from '@/services/tpvOrder.service'

interface OrderItem {
  id: string
  productName: string
  brand: string
  model: string
  quantity: number
  namePrefix: string
}

interface OrderForAssign {
  id: string
  orderNumber: string
  contactName: string
  contactEmail: string
  items: OrderItem[]
  venue: { name: string; slug: string }
}

type DraftUnits = Record<string, Array<{ name: string; serial: string }>>

export default function AssignSerialsTpvOrder() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [tokenChecked, setTokenChecked] = useState(false)
  const [tokenError, setTokenError] = useState('')
  const [order, setOrder] = useState<OrderForAssign | null>(null)
  const [draft, setDraft] = useState<DraftUnits>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitState, setSubmitState] = useState<'idle' | 'ok' | 'error'>('idle')
  const [submitMessage, setSubmitMessage] = useState('')

  useEffect(() => {
    if (!id || !token) {
      setTokenError('Falta el token o el id del pedido.')
      setTokenChecked(true)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const data = await tpvOrderPublicService.checkAssignSerialsToken(id, token)
        if (cancelled) return
        setOrder(data)
        const init: DraftUnits = {}
        for (const item of data.items) {
          init[item.id] = Array.from({ length: item.quantity }, (_, i) => ({
            name: `${item.namePrefix} ${i + 1}`,
            serial: '',
          }))
        }
        setDraft(init)
      } catch (err: any) {
        if (cancelled) return
        setTokenError(err.response?.data?.error ?? err.message ?? 'Token inválido')
      } finally {
        if (!cancelled) setTokenChecked(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, token])

  const allFilled = Object.values(draft).every((units) =>
    units.every((u) => u.name.trim() && u.serial.trim()),
  )

  const handleSubmit = async () => {
    if (!id || !token || !order) return
    setSubmitting(true)
    setSubmitState('idle')
    try {
      const items = Object.entries(draft).map(([orderItemId, units]) => ({ orderItemId, units }))
      await tpvOrderPublicService.submitAssignSerials(id, token, items)
      setSubmitState('ok')
    } catch (err: any) {
      setSubmitMessage(err.response?.data?.error ?? err.message ?? 'No se pudieron asignar los serials.')
      setSubmitState('error')
    } finally {
      setSubmitting(false)
    }
  }

  if (!tokenChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (tokenError || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md text-center space-y-4">
          <XCircle className="h-12 w-12 mx-auto text-destructive" />
          <h1 className="text-2xl font-semibold">Link inválido</h1>
          <p className="text-muted-foreground">{tokenError || 'No se pudo cargar el pedido.'}</p>
          <p className="text-xs text-muted-foreground">
            Si el link expiró o ya fue usado, inicia sesión como superadmin para gestionar el pedido manualmente.
          </p>
        </div>
      </div>
    )
  }

  if (submitState === 'ok') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md text-center space-y-4">
          <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
          <h1 className="text-2xl font-semibold">Serials asignados</h1>
          <p className="text-muted-foreground">
            Se enviaron los códigos de activación al cliente y los terminales aparecen ya en su dashboard.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Asignar números de serie</h1>
          <p className="text-sm text-muted-foreground">
            Pedido <strong>{order.orderNumber}</strong> · {order.venue.name} · {order.contactName} ·{' '}
            <a href={`mailto:${order.contactEmail}`} className="hover:underline">{order.contactEmail}</a>
          </p>
        </div>

        {order.items.map((item) => (
          <Card key={item.id} className="border-input">
            <CardHeader>
              <CardTitle className="text-base">{item.productName} × {item.quantity}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(draft[item.id] ?? []).map((unit, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Nombre del terminal</Label>
                    <Input
                      value={unit.name}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          [item.id]: prev[item.id].map((u, i) => i === idx ? { ...u, name: e.target.value } : u),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Número de serie</Label>
                    <Input
                      value={unit.serial}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          [item.id]: prev[item.id].map((u, i) => i === idx ? { ...u, serial: e.target.value } : u),
                        }))
                      }
                      placeholder="Ej: A910S-2026-001234"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        {submitState === 'error' && (
          <p className="text-sm text-destructive">{submitMessage}</p>
        )}

        <Button onClick={handleSubmit} disabled={!allFilled || submitting} size="lg" className="w-full">
          {submitting ? 'Asignando…' : 'Asignar y notificar al cliente'}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Lazy export + route**

In `lazyComponents.ts`:

```typescript
export const AssignSerialsTpvOrder = lazyWithRetry(() => import('@/pages/PublicAdmin/AssignSerialsTpvOrder'))
```

In `router.tsx`, alongside the approve/reject routes:

```tsx
{
  path: '/admin/tpv-orders/:id/assign-serials',
  element: (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <AssignSerialsTpvOrder />
    </Suspense>
  ),
  errorElement: <ErrorPage />,
},
```

- [ ] **Step 4: Build + lint + stage**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard
npm run build && npm run lint
git add src/pages/PublicAdmin/AssignSerialsTpvOrder.tsx \
        src/services/tpvOrder.service.ts \
        src/routes/lazyComponents.ts \
        src/routes/router.tsx
```

---

## Phase C — Background job + reminder email

### Task 6: SPEI reminder email (#8)

**Files:**
- Modify: `avoqado-server/src/services/email.service.ts`

- [ ] **Step 1: Interface + method**

```typescript
export interface SpeiReminderEmailData extends TerminalOrderEmailData {
  daysSinceCreation: number  // 3 or 7
  daysRemaining: number      // 11 or 7 (14-day expiry)
  orderDetailUrl: string
  speiRecipient: {
    beneficiary: string
    clabe: string
    rfc: string
    bank: string
  }
}
```

```typescript
async sendTerminalOrderSpeiReminder(data: SpeiReminderEmailData): Promise<boolean> {
  const { order, daysSinceCreation, daysRemaining, orderDetailUrl, speiRecipient } = data
  const subject = `Recordatorio: pago pendiente ${order.orderNumber}`
  const logoUrl = 'https://avoqado.io/isotipo.svg'
  const fmtMx = (cents: number) =>
    `$${(cents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${order.currency}`

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #ffffff; color: #000000;">
  <div style="max-width: 600px; margin: 0 auto; padding: 32px 24px;">
    <div style="padding-bottom: 32px;">
      <img src="${logoUrl}" alt="Avoqado" width="32" height="32" style="display: inline-block; vertical-align: middle;">
      <span style="font-size: 18px; font-weight: 700; vertical-align: middle; margin-left: 8px;">Avoqado</span>
    </div>
    <div style="padding-bottom: 24px;">
      <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: 400;">Recordatorio de pago</h1>
      <p style="margin: 0; font-size: 16px; color: #666;">Pedido ${order.orderNumber} · creado hace ${daysSinceCreation} día${daysSinceCreation === 1 ? '' : 's'}</p>
    </div>
    <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <p style="font-size: 14px; color: #92400e; margin: 0;">
        Aún no recibimos tu comprobante SPEI. Tu pedido expira en <strong>${daysRemaining} día${daysRemaining === 1 ? '' : 's'}</strong>.
      </p>
    </div>
    <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Datos para tu transferencia</h3>
      <p style="font-size: 14px; margin: 0;">
        Beneficiario: <strong>${speiRecipient.beneficiary}</strong><br>
        CLABE: <strong style="font-family: monospace;">${speiRecipient.clabe}</strong><br>
        Banco: ${speiRecipient.bank}<br>
        Monto: <strong>${fmtMx(order.totalCents)}</strong><br>
        Concepto: <strong style="font-family: monospace;">${order.orderNumber}</strong>
      </p>
    </div>
    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${orderDetailUrl}" style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Subir comprobante</a>
    </div>
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 0;">
    <div style="padding-top: 24px;">
      <p style="margin: 0; font-size: 14px; color: #666;">Avoqado</p>
    </div>
  </div>
</body></html>`

  const text = `Recordatorio — ${order.orderNumber}\n\n` +
    `Aún no recibimos tu comprobante SPEI. Tu pedido expira en ${daysRemaining} días.\n\n` +
    `Beneficiario: ${speiRecipient.beneficiary}\n` +
    `CLABE: ${speiRecipient.clabe}\n` +
    `Monto: ${fmtMx(order.totalCents)}\n` +
    `Concepto: ${order.orderNumber}\n\n` +
    `Sube tu comprobante en: ${orderDetailUrl}\n\nAvoqado`

  return this.sendEmail({ to: order.contactEmail, subject, html, text })
}
```

- [ ] **Step 2: Build + stage**

---

### Task 7: Background job `tpv-order-expiry.job.ts`

**Files:**
- Create: `avoqado-server/src/jobs/tpv-order-expiry.job.ts`

Pattern: class with `start()` / `stop()` like `abandoned-orders-cleanup.job.ts`.

```typescript
// jobs/tpv-order-expiry.job.ts

import { CronJob } from 'cron'
import prisma from '@/utils/prismaClient'
import logger from '@/config/logger'
import emailService from '@/services/email.service'

/**
 * Job que maneja el ciclo de vida de órdenes TPV pendientes:
 *
 * 1. Marca como EXPIRED:
 *    - AWAITING_PAYMENT > 7 días (cliente abandonó Stripe Checkout)
 *    - AWAITING_PROOF > 14 días (cliente no subió comprobante SPEI)
 * 2. Manda recordatorios SPEI:
 *    - Día 3: primer recordatorio
 *    - Día 7: último recordatorio (faltan 7 para expirar)
 *
 * Corre cada 6 horas.
 */
export class TpvOrderExpiryJob {
  private job: CronJob | null = null
  private readonly CRON_PATTERN = '0 */6 * * *' // every 6 hours
  private readonly STRIPE_EXPIRY_DAYS = 7
  private readonly SPEI_EXPIRY_DAYS = 14
  private readonly REMINDER_DAYS = [3, 7] // days after creation

  constructor() {
    this.job = new CronJob(this.CRON_PATTERN, this.runOnce.bind(this), null, false, 'America/Mexico_City')
  }

  start(): void {
    if (this.job) {
      this.job.start()
      logger.info(`📅 TPV Order Expiry Job started — runs every 6h`)
    }
  }

  stop(): void {
    if (this.job) {
      this.job.stop()
      logger.info('📅 TPV Order Expiry Job stopped')
    }
  }

  async runOnce(): Promise<void> {
    try {
      await this.expireStripeOrders()
      await this.expireSpeiOrders()
      await this.sendSpeiReminders()
    } catch (err) {
      logger.error('TpvOrderExpiryJob failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  private async expireStripeOrders(): Promise<number> {
    const cutoff = new Date(Date.now() - this.STRIPE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    const result = await prisma.terminalOrder.updateMany({
      where: {
        paymentMethod: 'CARD_STRIPE',
        paymentStatus: 'AWAITING_PAYMENT',
        createdAt: { lt: cutoff },
      },
      data: { paymentStatus: 'EXPIRED' },
    })
    if (result.count > 0) {
      logger.info(`📅 Expired ${result.count} stale Stripe AWAITING_PAYMENT orders`)
    }
    return result.count
  }

  private async expireSpeiOrders(): Promise<number> {
    const cutoff = new Date(Date.now() - this.SPEI_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    const result = await prisma.terminalOrder.updateMany({
      where: {
        paymentMethod: 'SPEI',
        paymentStatus: 'AWAITING_PROOF',
        createdAt: { lt: cutoff },
      },
      data: { paymentStatus: 'EXPIRED' },
    })
    if (result.count > 0) {
      logger.info(`📅 Expired ${result.count} stale SPEI AWAITING_PROOF orders`)
    }
    return result.count
  }

  private async sendSpeiReminders(): Promise<number> {
    const baseUrl =
      process.env.DASHBOARD_URL ??
      process.env.FRONTEND_URL ??
      process.env.APP_URL ??
      'https://dashboardv2.avoqado.io'

    const speiRecipient = {
      beneficiary: process.env.SPEI_RECIPIENT_BENEFICIARY ?? '',
      clabe: process.env.SPEI_RECIPIENT_CLABE ?? '',
      rfc: process.env.SPEI_RECIPIENT_RFC ?? '',
      bank: process.env.SPEI_RECIPIENT_BANK ?? '',
    }

    let sent = 0
    for (const days of this.REMINDER_DAYS) {
      const windowStart = new Date(Date.now() - (days + 0.25) * 24 * 60 * 60 * 1000)
      const windowEnd = new Date(Date.now() - (days - 0.25) * 24 * 60 * 60 * 1000)
      // 6-hour window centered on the target day so the job catches each order exactly once

      const orders = await prisma.terminalOrder.findMany({
        where: {
          paymentMethod: 'SPEI',
          paymentStatus: 'AWAITING_PROOF',
          createdAt: { gte: windowStart, lt: windowEnd },
        },
        include: { items: true, venue: { select: { slug: true } } },
      })

      for (const order of orders) {
        try {
          const orderDetailUrl = `${baseUrl}/venues/${order.venue.slug}/tpv/orders/${order.id}`
          const daysRemaining = this.SPEI_EXPIRY_DAYS - days
          await emailService.sendTerminalOrderSpeiReminder({
            order: order as any,
            items: order.items as any,
            daysSinceCreation: days,
            daysRemaining,
            orderDetailUrl,
            speiRecipient,
          })
          sent++
        } catch (err) {
          logger.error('SPEI reminder failed for order', {
            orderId: order.id,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    if (sent > 0) logger.info(`📅 Sent ${sent} SPEI reminders`)
    return sent
  }
}

export const tpvOrderExpiryJob = new TpvOrderExpiryJob()
```

- [ ] **Step 1: Create file**
- [ ] **Step 2: Build (no test for this one — covered by manual smoke + the helper functions are simple).**
- [ ] **Step 3: Stage**

```bash
git add src/jobs/tpv-order-expiry.job.ts
```

---

### Task 8: Register the job in server bootstrap

**Files:**
- Modify: `avoqado-server/src/server.ts`

- [ ] **Step 1: Find the existing job-registration block**

```bash
grep -n "abandonedOrdersCleanupJob\|.start()" src/server.ts | head -10
```

- [ ] **Step 2: Add the new job**

Add the import near the other job imports:

```typescript
import { tpvOrderExpiryJob } from './jobs/tpv-order-expiry.job'
```

Where other jobs call `.start()`:

```typescript
tpvOrderExpiryJob.start()
```

Where they call `.stop()` on shutdown:

```typescript
tpvOrderExpiryJob.stop()
```

- [ ] **Step 3: Build + stage**

```bash
npm run build
git add src/server.ts
```

---

## Phase D — Pre-deploy verification

### Task 9: i18n keys + E2E for serial assignment magic link

**Files:**
- Modify: `avoqado-web-dashboard/src/locales/{es,en}/tpv.json` (optional — the public page is mostly hardcoded Spanish per the superadmin convention; only add keys if you want the page bilingual)
- Create: `avoqado-web-dashboard/e2e/tests/tpv/assign-serials-magic-link.spec.ts`

E2E spec (1 test minimum):

```typescript
import { test, expect } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'

test.describe('Assign serials via magic link', () => {
  test('valid token shows form, submit creates terminals', async ({ page }) => {
    await setupApiMocks(page, { userRole: 'OWNER' })

    await page.route(
      '**/api/v1/public/tpv-orders/ord_test/assign-serials/check*',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'ord_test',
              orderNumber: 'AVO-0099',
              contactName: 'Test',
              contactEmail: 't@t.com',
              venue: { name: 'Test Venue', slug: 'test-venue' },
              items: [
                {
                  id: 'oi_1',
                  productName: 'PAX A910S',
                  brand: 'PAX',
                  model: 'A910S',
                  quantity: 2,
                  namePrefix: 'PAX A910S',
                },
              ],
            },
          }),
        })
      },
    )

    await page.route(
      '**/api/v1/public/tpv-orders/ord_test/assign-serials',
      async (route) => {
        if (route.request().method() !== 'POST') return route.fallback()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { orderId: 'ord_test', orderNumber: 'AVO-0099' },
          }),
        })
      },
    )

    await page.goto('/admin/tpv-orders/ord_test/assign-serials?token=valid_token')

    // Form should render with 2 unit rows (quantity 2)
    await expect(page.getByText('PAX A910S × 2')).toBeVisible()

    // Fill in serials
    const serialInputs = page.locator('input[placeholder*="A910S"]')
    await serialInputs.nth(0).fill('PAX-2026-001')
    await serialInputs.nth(1).fill('PAX-2026-002')

    // Click submit
    await page.getByRole('button', { name: /asignar y notificar/i }).click()

    // Success state
    await expect(page.getByText(/serials asignados/i)).toBeVisible({ timeout: 5000 })
  })
})
```

- [ ] **Step 1: Create spec**
- [ ] **Step 2: Run**

```bash
npm run test:e2e -- assign-serials-magic-link
```

- [ ] **Step 3: Stage**

```bash
git add e2e/tests/tpv/assign-serials-magic-link.spec.ts
```

### Task 10: Pre-deploy verification

Same pattern as Plans 1 & 2 Task 29:

- [ ] Backend `npm run build` — PASS
- [ ] Backend `npx jest tests/unit/services/dashboard/terminalOrder/` — all pass (expect: 40+ tests)
- [ ] Dashboard `npm run build` + `npm run lint` — PASS
- [ ] Dashboard `npm run test:e2e -- buy-terminal-card buy-terminal-spei assign-serials-magic-link` — 7/7 PASS
- [ ] Staged-files audit — no off-limits files
- [ ] No commits

**Env vars new to Plan 3** (all already declared in Plan 2):
- None — `TERMINAL_ORDER_TOKEN_SECRET` already used. `SPEI_RECIPIENT_*` already used.

**Manual smoke test** (assumes Plan 2 already running):
1. Pay an order with Stripe Card OR approve an SPEI order from Plan 2's magic link.
2. Once `paymentStatus = PAID`, verify the email #5 to sales now contains TWO buttons:
   - **Asignar números de serie** → magic link
   - **Ver en admin UI** → login-required superadmin
3. Click the magic-link button. Page loads form with items + units pre-filled by namePrefix.
4. Fill in serials, click submit.
5. Verify terminales aparecen en `/venues/:slug/tpv` y el cliente recibió email #6 con códigos de activación.

**Reminders manual smoke test:**
1. Create a SPEI order, don't upload comprobante.
2. Manually `await tpvOrderExpiryJob.runOnce()` from a node REPL or temporarily reduce `REMINDER_DAYS` to `[0.001]` in the job to test.
3. Verify the customer received the reminder email.
4. Manually advance the createdAt in DB to 15 days ago, run job again, verify status flips to EXPIRED.

---

## Self-Review

| Spec requirement | Task |
|------------------|------|
| Magic-link version of serial-assignment email | Tasks 1, 2, 3 |
| Public endpoint for serial assignment with token | Task 4 |
| Magic-link page for serial assignment | Task 5 |
| Background job for expired orders | Task 7 |
| Reminder emails for SPEI at days 3 and 7 | Tasks 6, 7 (`sendSpeiReminders` method) |
| Job registration in server bootstrap | Task 8 |
| E2E for serial assignment magic link | Task 9 |
| Pre-deploy verification | Task 10 |

**Out of scope:**
- A "Refunds" flow (defer; not in original spec).
- Inventory tracking of physical serials (sales tracks externally).
- Multi-currency.

**Known assumptions:**
- The job's reminder window (6-hour windows centered on day 3 and day 7) catches orders exactly once. If the job is paused/restarted, an order might miss its reminder window but won't be double-sent.
- The `lazyWithRetry` import name in Plan 2 Task 13 (used in `lazyComponents.ts`) is reused — Plan 3 Task 5 uses the same convention.
- The `assignSerials` service already handles uniqueness + transaction (Plan 1 Task 7). The public endpoint just wraps it with token verification.

**Risks:**
- If sales submits the magic-link form twice (network retry, double-click), the second call hits a non-AWAITING_SERIALS order and `assignSerials` rejects it. The endpoint also clears the token after first use, so the second call gets 401. Defense-in-depth.
- If a token is intercepted from the email by a third party, they could submit arbitrary serials. Mitigation: short token TTL (30 days), single-use, logging of all assignments with `serialsAssignedBy=magic-link`, and the assigned serials are visible to sales in the superadmin UI for review.
- The cron job's 6-hour window for reminders means the email arrives within 0-6h of the target day. If the customer paid in the window, no email goes out (because they're no longer `AWAITING_PROOF`).
