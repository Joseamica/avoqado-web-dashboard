# ADMIN edita ventas — P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an org back-office OWNER correct any stuck SIM sale (monto, forma de pago, tipo de venta, estado) from the org "Ventas — Detalle" dashboard, with a mandatory reason and an audit record.

**Architecture:** New org-scoped `PATCH …/sale-verifications/:id` endpoint (gated by a new `sale-verifications:edit` permission, OWNER+SUPERADMIN) writes `Payment.amount`/`method` + `SaleVerification.isPortabilidad`/`status` inside one `prisma.$transaction`, plus an `ActivityLog` row. Frontend adds an **Editar** button (all rows) + a `FullScreenModal` editor on `SalesDetail.tsx`. Mirrors the existing `reopenOrgSaleVerification` flow.

**Tech Stack:** Express + Prisma + Jest (avoqado-server) · React + TanStack Query + Playwright (avoqado-web-dashboard).

**Scope note:** This is the deployable **P1** slice that fixes Isaac's ticket. The agreed full-edit goal also includes **P2** (reasignar promotor + Tipo de SIM) and **P3** (ICCID + evidencias/fotos) + an **MCP tool** — each gets its **own** plan once P1 lands (they're independent, each ships working software). Spec: `docs/superpowers/specs/2026-06-13-admin-edit-sales-design.md`.

---

## File Structure

**avoqado-server**
- Modify `src/lib/permissions.ts` — add `sale-verifications:edit` (OWNER, SUPERADMIN, group map).
- Modify `src/services/dashboard/sale-verification.org.dashboard.service.ts` — add `editOrgSaleVerification()`.
- Modify `src/controllers/dashboard/sale-verification.org.dashboard.controller.ts` — add `editOrgSaleVerification` handler + import `SaleVerificationStatus`.
- Modify `src/routes/dashboard/saleVerification.org.dashboard.routes.ts` — add `PATCH /:id`.
- Create `tests/api-tests/dashboard/saleVerificationEdit.api.test.ts` — regression test.

**avoqado-web-dashboard**
- Modify `src/services/saleVerification.org.service.ts` — add `EditOrgSaleParams` + `editOrgSaleVerification()`.
- Create `src/pages/organizations/SalesDetail/components/EditSaleDialog.tsx` — the editor modal.
- Modify `src/pages/organizations/SalesDetail/SalesDetail.tsx` — Editar button (desktop + mobile) + render the dialog.
- Create `e2e/tests/playtelecom/sales-detail-edit.spec.ts` — regression E2E.

---

## Task 1: Backend permission `sale-verifications:edit`

**Files:**
- Modify: `avoqado-server/src/lib/permissions.ts` (OWNER block ~894, SUPERADMIN block ~929, group map ~1312)

- [ ] **Step 1: Add to the OWNER block**

Find the OWNER line (`'sale-verifications:reopen', // ...`) at ~line 894 and add directly below it:

```typescript
    'sale-verifications:reopen', // Can revert an approved sale back to PENDING for re-review (OWNER only)
    'sale-verifications:edit', // Can edit/correct any sale (amount, forma de pago, tipo, estado) — OWNER only
```

- [ ] **Step 2: Add explicit SUPERADMIN entry**

Find the SUPERADMIN explicit reopen line (~929) and add below it:

```typescript
    'sale-verifications:reopen', // Explicit for clarity — reopen approved sales for re-review
    'sale-verifications:edit', // Explicit for clarity — edit/correct sales
```

- [ ] **Step 3: Add to the permission group map**

Find (~line 1312) and extend the array:

```typescript
  'sale-verifications': ['sale-verifications:review', 'sale-verifications:reopen', 'sale-verifications:edit'],
```

- [ ] **Step 4: Typecheck**

Run: `cd avoqado-server && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
cd avoqado-server && git add src/lib/permissions.ts
git commit -m "feat(permissions): add sale-verifications:edit (OWNER, SUPERADMIN)"
```

---

## Task 2: Backend service `editOrgSaleVerification`

**Files:**
- Modify: `avoqado-server/src/services/dashboard/sale-verification.org.dashboard.service.ts` (append after `reopenOrgSaleVerification`, ~line 905)

Imports already present at top of file: `SaleVerificationStatus`, `PaymentMethod`, `Prisma` (line 1), `logger`, `prisma`, `socketManager`, `SocketEventType`, and the local `createServiceError` (line 755).

- [ ] **Step 1: Append the function**

```typescript
type EditableForm = 'CASH' | 'CARD' | 'OTHER'

// Reverse of derivePaymentForm: the UI's 3 buckets map back to a canonical
// PaymentMethod. CREDIT_CARD round-trips to 'CARD' so the row redisplays stably.
const PAYMENT_FORM_TO_METHOD: Record<EditableForm, PaymentMethod> = {
  CASH: 'CASH',
  CARD: 'CREDIT_CARD',
  OTHER: 'OTHER',
}

/**
 * Edit/correct a sale verification at org scope (back-office, OWNER-only).
 *
 * P1 fields: amount + forma de pago (Payment), isPortabilidad + status
 * (SaleVerification). Writes are atomic; an ActivityLog row records before/after
 * + reason for audit (this mutates a financial record). Commissions are NOT
 * recomputed (PlayTelecom doesn't use them; revenue charts are query-time and
 * self-correct). `reason` is mandatory (min 5 chars).
 */
export async function editOrgSaleVerification(
  orgId: string,
  params: {
    saleVerificationId: string
    editedById: string
    amount?: number
    paymentForm?: EditableForm
    isPortabilidad?: boolean
    status?: SaleVerificationStatus
    reason: string
  },
) {
  const trimmedReason = params.reason?.trim() ?? ''
  if (trimmedReason.length < 5) {
    throw createServiceError('Un motivo de al menos 5 caracteres es obligatorio para editar la venta', 400)
  }
  if (params.amount != null && (!Number.isFinite(params.amount) || params.amount < 0)) {
    throw createServiceError('El monto debe ser un número mayor o igual a 0', 400)
  }

  const existing = await prisma.saleVerification.findUnique({
    where: { id: params.saleVerificationId },
    select: {
      id: true,
      venueId: true,
      staffId: true,
      paymentId: true,
      status: true,
      isPortabilidad: true,
      payment: { select: { id: true, amount: true, method: true } },
      venue: { select: { organizationId: true } },
    },
  })

  if (!existing) throw createServiceError('Venta no encontrada', 404)
  if (existing.venue?.organizationId !== orgId) {
    throw createServiceError('La venta no pertenece a esta organización', 403)
  }

  const before = {
    status: existing.status,
    isPortabilidad: existing.isPortabilidad,
    amount: existing.payment ? Number(existing.payment.amount) : null,
    method: existing.payment?.method ?? null,
  }
  const nextStatus: SaleVerificationStatus = params.status ?? existing.status

  const updated = await prisma.$transaction(async tx => {
    // 1. Payment (monto / forma de pago)
    if (existing.payment && (params.amount != null || params.paymentForm != null)) {
      await tx.payment.update({
        where: { id: existing.payment.id },
        data: {
          ...(params.amount != null ? { amount: params.amount } : {}),
          ...(params.paymentForm != null ? { method: PAYMENT_FORM_TO_METHOD[params.paymentForm] } : {}),
        },
      })
    }

    // 2. SaleVerification (tipo de venta + estado + metadata de revisión)
    const reviewMeta =
      nextStatus === 'PENDING'
        ? { reviewedById: null, reviewedAt: null, reviewNotes: null, rejectionReasons: [] }
        : nextStatus === 'COMPLETED'
          ? { reviewedById: params.editedById, reviewedAt: new Date(), rejectionReasons: [] }
          : { reviewedById: params.editedById, reviewedAt: new Date() } // FAILED keeps existing reasons/notes

    const sv = await tx.saleVerification.update({
      where: { id: existing.id },
      data: {
        ...(params.isPortabilidad != null ? { isPortabilidad: params.isPortabilidad } : {}),
        status: nextStatus,
        ...reviewMeta,
      },
      include: {
        staff: { select: { id: true, firstName: true, lastName: true, email: true, photoUrl: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
        payment: { select: { id: true, amount: true, method: true, status: true, createdAt: true } },
      },
    })

    // 3. Audit (financial edit → DB record, not just logs)
    await tx.activityLog.create({
      data: {
        staffId: params.editedById,
        venueId: existing.venueId,
        action: 'SALE_VERIFICATION_EDIT',
        entity: 'SaleVerification',
        entityId: existing.id,
        data: {
          reason: trimmedReason,
          before,
          after: {
            status: nextStatus,
            isPortabilidad: params.isPortabilidad ?? existing.isPortabilidad,
            amount: params.amount ?? before.amount,
            method: params.paymentForm ? PAYMENT_FORM_TO_METHOD[params.paymentForm] : before.method,
          },
        } as Prisma.InputJsonValue,
      },
    })

    return sv
  })

  logger.info(
    `[SALE_VERIFICATION_EDIT] verification=${existing.id} org=${orgId} by=${params.editedById} ` +
      `status=${before.status}->${nextStatus} amount=${before.amount}->${params.amount ?? before.amount} ` +
      `reason="${trimmedReason.replace(/"/g, '\\"')}"`,
  )

  // Best-effort: refresh the promoter's TPV badge (harmless if the promoter left).
  try {
    socketManager.broadcastToUser(existing.staffId, SocketEventType.SALE_VERIFICATION_REVIEWED, {
      saleVerificationId: updated.id,
      paymentId: updated.paymentId,
      status: updated.status,
      reviewedAt: updated.reviewedAt,
      reviewNotes: updated.reviewNotes ?? null,
      rejectionReasons: updated.rejectionReasons ?? [],
      reviewedBy: updated.reviewedBy ?? null,
    })
  } catch (err: any) {
    logger.warn(`[SALE_VERIFICATION_EDIT] socket emit failed for staff ${existing.staffId}: ${err?.message ?? err}`)
  }

  return updated
}
```

- [ ] **Step 2: Typecheck**

Run: `cd avoqado-server && npx tsc --noEmit`
Expected: no new errors. (If `tx.activityLog` errors, confirm the model is `ActivityLog` in `schema.prisma` and the client is generated: `npx prisma generate`.)

- [ ] **Step 3: Commit**

```bash
cd avoqado-server && git add src/services/dashboard/sale-verification.org.dashboard.service.ts
git commit -m "feat(sale-verifications): editOrgSaleVerification service (atomic edit + audit)"
```

---

## Task 3: Backend controller handler

**Files:**
- Modify: `avoqado-server/src/controllers/dashboard/sale-verification.org.dashboard.controller.ts` (append after `reopenOrgSaleVerification`, ~line 278; and the import line for types)

- [ ] **Step 1: Ensure `SaleVerificationStatus` is imported**

At the top of the file, where `SaleVerificationRejectionReason` is imported from `@prisma/client`, add `SaleVerificationStatus`:

```typescript
import { SaleVerificationRejectionReason, SaleVerificationStatus } from '@prisma/client'
```
(If the existing import uses a different path/style, just add `SaleVerificationStatus` to the same import.)

- [ ] **Step 2: Append the handler**

```typescript
/**
 * PATCH /dashboard/organizations/:orgId/sale-verifications/:id
 *
 * Edit/correct a sale (OWNER-only via `sale-verifications:edit`). Body fields
 * are all optional except `reason` (min 5 chars). Delegates to the service.
 */
export async function editOrgSaleVerification(req: Request, res: Response): Promise<void> {
  try {
    const { orgId, id } = req.params
    const { amount, paymentForm, isPortabilidad, status, reason } = req.body as {
      amount?: number
      paymentForm?: string
      isPortabilidad?: boolean
      status?: string
      reason?: string
    }

    const editedById = (req as any).authContext?.userId
    if (!editedById) {
      res.status(401).json({ success: false, message: 'No staff context' })
      return
    }
    if (typeof reason !== 'string' || reason.trim().length < 5) {
      res.status(400).json({ success: false, message: 'Un motivo de al menos 5 caracteres es obligatorio' })
      return
    }
    if (paymentForm != null && !['CASH', 'CARD', 'OTHER'].includes(paymentForm)) {
      res.status(400).json({ success: false, message: `Forma de pago inválida: ${paymentForm}` })
      return
    }
    if (status != null && !['PENDING', 'COMPLETED', 'FAILED'].includes(status)) {
      res.status(400).json({ success: false, message: `Estado inválido: ${status}` })
      return
    }
    if (isPortabilidad != null && typeof isPortabilidad !== 'boolean') {
      res.status(400).json({ success: false, message: 'isPortabilidad debe ser booleano' })
      return
    }

    logger.info(`[ORG SALE VERIFICATION] PATCH ${id} (edit) org=${orgId} by=${editedById}`)

    const updated = await svc.editOrgSaleVerification(orgId, {
      saleVerificationId: id,
      editedById,
      amount,
      paymentForm: paymentForm as 'CASH' | 'CARD' | 'OTHER' | undefined,
      isPortabilidad,
      status: status as SaleVerificationStatus | undefined,
      reason,
    })

    res.status(200).json({ success: true, data: updated })
  } catch (error: any) {
    logger.error(`[ORG SALE VERIFICATION] edit error: ${error.message}`)
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Internal server error' })
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `cd avoqado-server && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
cd avoqado-server && git add src/controllers/dashboard/sale-verification.org.dashboard.controller.ts
git commit -m "feat(sale-verifications): editOrgSaleVerification controller handler"
```

---

## Task 4: Backend route

**Files:**
- Modify: `avoqado-server/src/routes/dashboard/saleVerification.org.dashboard.routes.ts:58`

- [ ] **Step 1: Add the PATCH route**

After the reopen line (58), add:

```typescript
router.post('/:id/reopen', checkPermission('sale-verifications:reopen'), ctrl.reopenOrgSaleVerification)
router.patch('/:id', checkPermission('sale-verifications:edit'), ctrl.editOrgSaleVerification)
```

- [ ] **Step 2: Typecheck + build**

Run: `cd avoqado-server && npx tsc --noEmit`
Expected: no errors (confirms `ctrl.editOrgSaleVerification` is exported).

- [ ] **Step 3: Commit**

```bash
cd avoqado-server && git add src/routes/dashboard/saleVerification.org.dashboard.routes.ts
git commit -m "feat(sale-verifications): PATCH /:id edit route (sale-verifications:edit)"
```

---

## Task 5: Backend regression test

**Files:**
- Create: `avoqado-server/tests/api-tests/dashboard/saleVerificationEdit.api.test.ts`
- Template to mirror for app bootstrap + auth/seed helpers: `avoqado-server/tests/api-tests/dashboard/manualPayment.api.test.ts`

> The api-test harness (how the Express app is imported, how a JWT/authContext + a seeded org/venue/payment/SaleVerification are created) is established in the existing `*.api.test.ts` files. Open `manualPayment.api.test.ts` and reuse its exact bootstrap. Then implement the three assertions below.

- [ ] **Step 1: Write the failing test**

Create the file with this shape (fill the `setup`/`auth` helpers from the template):

```typescript
import request from 'supertest'
import app from '../../../src/app' // match the import used by manualPayment.api.test.ts
import prisma from '../../../src/utils/prismaClient'
// + the same test bootstrap helpers (createTestOrg, createOwnerToken, seedSale, etc.) used by the template

describe('PATCH /api/v1/dashboard/organizations/:orgId/sale-verifications/:id (edit)', () => {
  // beforeAll/afterAll: seed org + venue + payment + SaleVerification(status=FAILED, amount=0),
  // an OWNER token for that org, and a MANAGER token (no sale-verifications:edit).

  it('403 without sale-verifications:edit (MANAGER)', async () => {
    const res = await request(app)
      .patch(`/api/v1/dashboard/organizations/${orgId}/sale-verifications/${saleId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ amount: 100, paymentForm: 'CASH', status: 'COMPLETED', reason: 'corrección de monto' })
    expect(res.status).toBe(403)
  })

  it('OWNER edits monto + forma de pago + estado and writes an ActivityLog', async () => {
    const res = await request(app)
      .patch(`/api/v1/dashboard/organizations/${orgId}/sale-verifications/${saleId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ amount: 100, paymentForm: 'CASH', status: 'COMPLETED', reason: 'era un ESIM $100, no gratis' })
    expect(res.status).toBe(200)

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
    expect(Number(payment!.amount)).toBe(100)
    expect(payment!.method).toBe('CASH')

    const sv = await prisma.saleVerification.findUnique({ where: { id: saleId } })
    expect(sv!.status).toBe('COMPLETED')

    const log = await prisma.activityLog.findFirst({
      where: { entity: 'SaleVerification', entityId: saleId, action: 'SALE_VERIFICATION_EDIT' },
    })
    expect(log).not.toBeNull()
    expect((log!.data as any).reason).toBe('era un ESIM $100, no gratis')
  })

  it('400 when reason is too short', async () => {
    const res = await request(app)
      .patch(`/api/v1/dashboard/organizations/${orgId}/sale-verifications/${saleId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ amount: 50, reason: 'x' })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run it red, then green**

Run: `cd avoqado-server && npx jest tests/api-tests/dashboard/saleVerificationEdit.api.test.ts`
Expected: with Tasks 1–4 implemented → **PASS**. (If you stash Task 4's route, the first two tests fail → confirms the test exercises the new endpoint.)

- [ ] **Step 3: Commit**

```bash
cd avoqado-server && git add tests/api-tests/dashboard/saleVerificationEdit.api.test.ts
git commit -m "test(sale-verifications): regression for PATCH /:id edit (perm + audit)"
```

---

## Task 6: Frontend service client

**Files:**
- Modify: `avoqado-web-dashboard/src/services/saleVerification.org.service.ts` (append after `reopenOrgSaleVerification`, end of file)

`SaleVerificationStatus` is already imported (line 11).

- [ ] **Step 1: Append the client**

```typescript
export interface EditOrgSaleParams {
  /** Payment.amount (MXN). */
  amount?: number
  /** Maps to Payment.method on the backend. */
  paymentForm?: 'CASH' | 'CARD' | 'OTHER'
  /** Tipo de venta: true = Portabilidad, false = Línea nueva. */
  isPortabilidad?: boolean
  status?: SaleVerificationStatus
  /** Mandatory, min 5 chars — recorded in the audit log. */
  reason: string
}

/**
 * Edit/correct a sale at org scope (OWNER-only, `sale-verifications:edit`).
 * Returns the updated verification; callers should invalidate the list +
 * summary queries.
 */
export async function editOrgSaleVerification(
  orgId: string,
  saleVerificationId: string,
  params: EditOrgSaleParams,
): Promise<unknown> {
  const url = `/api/v1/dashboard/organizations/${orgId}/sale-verifications/${saleVerificationId}`
  const response = await api.patch(url, params)
  return response.data.data
}
```

- [ ] **Step 2: Typecheck**

Run: `cd avoqado-web-dashboard && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd avoqado-web-dashboard && git add src/services/saleVerification.org.service.ts
git commit -m "feat(ventas): editOrgSaleVerification service client"
```

---

## Task 7: Frontend `EditSaleDialog`

**Files:**
- Create: `avoqado-web-dashboard/src/pages/organizations/SalesDetail/components/EditSaleDialog.tsx`

- [ ] **Step 1: Create the component**

```tsx
/**
 * EditSaleDialog — back-office editor for a single org sale (OWNER-only).
 *
 * P1 fields: Monto, Forma de pago, Tipo de venta, Estado, Motivo (obligatorio).
 * Uses FullScreenModal (mandatory for edit flows per ui-patterns.md). On success
 * invalidates the list + summary queries (same keys as the reopen flow).
 */
import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Save } from 'lucide-react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { editOrgSaleVerification, type EditOrgSaleParams, type OrgSaleRow } from '@/services/saleVerification.org.service'
import type { SaleVerificationStatus } from '@/services/saleVerification.service'

type PaymentFormChoice = 'CASH' | 'CARD' | 'OTHER'

function currentPaymentForm(row: OrgSaleRow): PaymentFormChoice {
  const f = row.payment?.paymentForm
  if (f === 'CASH') return 'CASH'
  if (f === 'CARD') return 'CARD'
  return 'OTHER'
}

export function EditSaleDialog({
  open,
  row,
  orgId,
  onClose,
}: {
  open: boolean
  row: OrgSaleRow | null
  orgId: string
  onClose: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [amount, setAmount] = useState<number | undefined>(undefined)
  const [paymentForm, setPaymentForm] = useState<PaymentFormChoice>('OTHER')
  const [isPortabilidad, setIsPortabilidad] = useState(false)
  const [status, setStatus] = useState<SaleVerificationStatus>('COMPLETED')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && row) {
      setAmount(row.payment ? Number(row.payment.amount) : undefined)
      setPaymentForm(currentPaymentForm(row))
      setIsPortabilidad(row.saleType === 'PORTABILIDAD')
      setStatus(row.status)
      setReason('')
      setError(null)
    }
  }, [open, row])

  const mutation = useMutation({
    mutationFn: (params: EditOrgSaleParams) => {
      if (!row) throw new Error('No row selected')
      return editOrgSaleVerification(orgId, row.id, params)
    },
    onSuccess: () => {
      toast({ title: 'Venta actualizada', description: 'Los cambios quedaron guardados y registrados en la auditoría.' })
      queryClient.invalidateQueries({ queryKey: ['org', orgId, 'sale-verifications'] })
      queryClient.invalidateQueries({ queryKey: ['org', orgId, 'sales-summary'] })
      onClose()
    },
    onError: (err: any) => {
      toast({
        title: 'No se pudo guardar',
        description: err?.response?.data?.message || err?.message || 'Intenta de nuevo.',
        variant: 'destructive',
      })
    },
  })

  const isLoading = mutation.isPending

  const handleSubmit = () => {
    if (reason.trim().length < 5) {
      setError('Escribe un motivo de al menos 5 caracteres (queda en la auditoría).')
      return
    }
    mutation.mutate({ amount, paymentForm, isPortabilidad, status, reason: reason.trim() })
  }

  return (
    <FullScreenModal
      open={open}
      onClose={() => !isLoading && onClose()}
      title="Editar venta"
      subtitle={row ? `${row.venue.name} · ${row.serialNumbers[0] ?? row.id.slice(-6)}` : undefined}
      contentClassName="bg-muted/30"
      actions={
        <Button onClick={handleSubmit} disabled={isLoading} data-tour="edit-sale-submit">
          {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Guardar
        </Button>
      }
    >
      <div className="mx-auto w-full max-w-lg p-4 space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="edit-amount">Monto (MXN)</Label>
          <Input
            id="edit-amount"
            type="number"
            inputMode="decimal"
            min={0}
            value={amount ?? ''}
            onChange={e => {
              const raw = e.target.value
              setAmount(raw === '' ? undefined : parseFloat(raw))
            }}
            className="h-12 text-base"
            placeholder="0"
          />
          <p className="text-[11px] text-muted-foreground">Si el monto es 0, la forma de pago se muestra como “Gratis”.</p>
        </div>

        <div className="space-y-1.5">
          <Label>Forma de pago</Label>
          <Select value={paymentForm} onValueChange={v => setPaymentForm(v as PaymentFormChoice)}>
            <SelectTrigger className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CASH">Efectivo</SelectItem>
              <SelectItem value="CARD">Tarjeta</SelectItem>
              <SelectItem value="OTHER">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Tipo de venta</Label>
          <Select value={isPortabilidad ? 'PORTABILIDAD' : 'LINEA_NUEVA'} onValueChange={v => setIsPortabilidad(v === 'PORTABILIDAD')}>
            <SelectTrigger className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LINEA_NUEVA">Línea nueva</SelectItem>
              <SelectItem value="PORTABILIDAD">Portabilidad</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Estado</Label>
          <Select value={status} onValueChange={v => setStatus(v as SaleVerificationStatus)}>
            <SelectTrigger className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="COMPLETED">Venta correcta</SelectItem>
              <SelectItem value="PENDING">Pendiente</SelectItem>
              <SelectItem value="FAILED">Revisar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-reason">
            Motivo del cambio <span className="text-red-600">*</span>
          </Label>
          <Textarea
            id="edit-reason"
            value={reason}
            onChange={e => {
              setError(null)
              setReason(e.target.value)
            }}
            placeholder="Explica por qué editas esta venta (mín. 5 caracteres). Queda registrado con tu nombre y la fecha."
            rows={3}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </FullScreenModal>
  )
}

export default EditSaleDialog
```

- [ ] **Step 2: Typecheck**

Run: `cd avoqado-web-dashboard && npx tsc --noEmit`
Expected: no errors. (Confirms `OrgSaleRow`/`EditOrgSaleParams` exports and the `Select` import path.)

- [ ] **Step 3: Commit**

```bash
cd avoqado-web-dashboard && git add src/pages/organizations/SalesDetail/components/EditSaleDialog.tsx
git commit -m "feat(ventas): EditSaleDialog (FullScreenModal) for admin sale edit"
```

---

## Task 8: Wire Editar button + dialog into `SalesDetail.tsx`

**Files:**
- Modify: `avoqado-web-dashboard/src/pages/organizations/SalesDetail/SalesDetail.tsx`

- [ ] **Step 1: Add imports**

Add `Pencil` to the lucide import block (lines 19–35):

```typescript
  ZoomOut,
  Smartphone,
  Pencil,
} from 'lucide-react'
```

Add the dialog import next to the `ReviewSaleDialog` import (line 56):

```typescript
import { ReviewSaleDialog, type ReviewMode } from '@/pages/playtelecom/Sales/components/ReviewSaleDialog'
import { EditSaleDialog } from './components/EditSaleDialog'
```

- [ ] **Step 2: Add state + gate**

After `const canReopen = …` (line 200), add:

```typescript
  const canEdit = user?.role === 'OWNER' || user?.role === 'SUPERADMIN'
  const [editRow, setEditRow] = useState<OrgSaleRow | null>(null)
```

- [ ] **Step 3: Add the Editar button to the desktop Acciones cell**

In the desktop actions cell, replace the opening of the actions wrapper (lines 732–733):

```tsx
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {row.status === 'PENDING' ? (
```

with (adds the Editar button before the status conditional):

```tsx
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/20"
                            onClick={() => setEditRow(row)}
                            data-tour="edit-sale-btn"
                            title="Editar venta"
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Editar
                          </Button>
                        )}
                        {row.status === 'PENDING' ? (
```

- [ ] **Step 4: Pass onEdit to the mobile `SaleCard`**

In the mobile card render (lines 588–599), add the `onEdit` prop:

```tsx
              <SaleCard
                key={row.id}
                row={row}
                formatDate={formatDate}
                formatTime={formatTime}
                onPhotoClick={url => setPhotoPreview(url)}
                onReview={mode => openReview(row, mode)}
                onReopen={canReopen ? () => openReopen(row) : undefined}
                onEdit={canEdit ? () => setEditRow(row) : undefined}
                onTerminalClick={row.terminal ? () => goToTerminal(row.terminal!.id) : undefined}
              />
```

- [ ] **Step 5: Add `onEdit` to `SaleCard` props + render it**

In the `SaleCard` function signature (props object ~lines 984–1002), add after `onReopen?`:

```tsx
  /** Provided only when the current user can edit (OWNER/SUPERADMIN). */
  onEdit?: () => void
```

And add `onEdit` to the destructured params list at the top of `SaleCard`:

```tsx
function SaleCard({
  row,
  formatDate,
  formatTime,
  onPhotoClick,
  onReview,
  onReopen,
  onEdit,
  onTerminalClick,
}: {
```

Then in the card Actions section, replace the wrapper opening (line 1084–1085):

```tsx
      <div className="pt-2 border-t border-border/30">
        {row.status === 'PENDING' ? (
```

with:

```tsx
      <div className="pt-2 border-t border-border/30 space-y-2">
        {onEdit && (
          <Button
            size="sm"
            variant="outline"
            className="w-full text-blue-700 border-blue-200 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/20"
            onClick={onEdit}
            data-tour="edit-sale-btn"
          >
            <Pencil className="h-4 w-4 mr-1" />
            Editar venta
          </Button>
        )}
        {row.status === 'PENDING' ? (
```

- [ ] **Step 6: Render the dialog**

After the `<ReviewSaleDialog … />` block (lines 802–809), add:

```tsx
      {/* Edit dialog (OWNER/SUPERADMIN) */}
      <EditSaleDialog open={!!editRow} row={editRow} orgId={orgId} onClose={() => setEditRow(null)} />
```

- [ ] **Step 7: Typecheck + lint**

Run: `cd avoqado-web-dashboard && npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd avoqado-web-dashboard && git add src/pages/organizations/SalesDetail/SalesDetail.tsx
git commit -m "feat(ventas): Editar button + edit dialog on SalesDetail (OWNER/SUPERADMIN)"
```

---

## Task 9: Dashboard E2E regression test

**Files:**
- Create: `avoqado-web-dashboard/e2e/tests/playtelecom/sales-detail-edit.spec.ts`
- Pattern to mirror: `e2e/tests/playtelecom/sales-executive.spec.ts` (mock helpers + `createMockVenue/User`, LIFO routing).

- [ ] **Step 1: Write the test**

```typescript
import { test, expect, Page } from '@playwright/test'
import { StaffRole, createMockVenue, createMockUser, createAuthStatusResponse, DEFAULT_ROLE_CONFIGS } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

const TEST_ORG_ID = 'org-playtelecom-001'

function json(data: unknown) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(data) }
}

const FAILED_ROW = {
  id: 'sv-stuck-1',
  paymentId: 'pay-1',
  status: 'FAILED',
  isPortabilidad: false,
  saleType: 'LINEA_NUEVA',
  photos: [],
  serialNumbers: ['8952140063883196217F'],
  reviewedById: null,
  reviewedAt: null,
  reviewNotes: 'me ayudas a corregir la forma de pago, era un ESIM $100',
  rejectionReasons: ['OTHER'],
  createdAt: '2026-05-29T20:45:00.000Z',
  updatedAt: '2026-05-29T20:45:00.000Z',
  venue: { id: 'venue-bae-001', name: 'SAMS CLUB CAMPESTRE (6315)', city: 'San Luis Potosí', slug: 'bae-pozos' },
  staff: { id: 's1', firstName: 'Ignacio', lastName: 'Mitre', email: null, photoUrl: null },
  reviewedBy: null,
  payment: { id: 'pay-1', amount: 0, method: 'OTHER', paymentForm: 'NONE', status: 'COMPLETED', createdAt: '2026-05-29T20:45:00.000Z' },
  category: { id: 'c1', name: 'E-SIM de promotor' },
  registeredFromVenue: null,
  terminal: null,
}

async function setupMocks(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('lang', 'es') } catch { /* ignore */ }
  })
  const venue = createMockVenue({
    id: 'venue-bae-001',
    name: 'SAMS CLUB CAMPESTRE (6315)',
    slug: 'bae-pozos',
    organizationId: TEST_ORG_ID,
    organization: { id: TEST_ORG_ID, name: 'PlayTelecom' },
    modules: [{ module: { id: 'mod-si', code: 'SERIALIZED_INVENTORY', name: 'Serialized Inventory' }, enabled: true }],
  })
  const venueWithRole = { ...venue, role: StaffRole.OWNER }
  const user = createMockUser(StaffRole.OWNER, [venueWithRole])

  await page.route('**/api/**', route => route.fulfill(json({})))
  await page.route(`**/api/v1/dashboard/organizations/${TEST_ORG_ID}/stats`, route =>
    route.fulfill(json({ id: TEST_ORG_ID, name: 'PlayTelecom', venueCount: 1, totalRevenue: 0, totalOrders: 0 })),
  )
  await page.route(`**/api/v1/dashboard/organizations/${TEST_ORG_ID}/venues`, route => route.fulfill(json([venueWithRole])))
  await page.route('**/api/v1/notifications*', route => route.fulfill(json({ data: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 0 } })))
  await page.route('**/api/v1/dashboard/venues/*/role-config', route => route.fulfill(json(DEFAULT_ROLE_CONFIGS)))
  await page.route('**/api/v1/me/access*', route =>
    route.fulfill(json({
      userId: user.id, venueId: venueWithRole.id, organizationId: TEST_ORG_ID, role: StaffRole.OWNER,
      corePermissions: venueWithRole.permissions, whiteLabelEnabled: true, enabledFeatures: [], featureAccess: {},
    })),
  )

  const base = `**/api/v1/dashboard/organizations/${TEST_ORG_ID}/sale-verifications`
  await page.route(`${base}/summary*`, route =>
    route.fulfill(json({ success: true, data: { totalRevenue: 0, confirmedRevenue: 0, totalCount: 1, completedCount: 0, pendingCount: 0, failedCount: 1, withoutVerificationCount: 0 } })),
  )
  // List — registered before auth/status; serves the single FAILED row.
  await page.route(`${base}?*`, route => route.fulfill(json({ success: true, data: [FAILED_ROW], pagination: { pageSize: 25, pageNumber: 1, totalCount: 1, totalPages: 1 } })))
  await page.route(`${base}`, route => route.fulfill(json({ success: true, data: [FAILED_ROW], pagination: { pageSize: 25, pageNumber: 1, totalCount: 1, totalPages: 1 } })))

  await page.route('**/api/v1/dashboard/auth/status', route => route.fulfill(json(createAuthStatusResponse(user))))
}

test.describe('SalesDetail — admin edit', () => {
  test('OWNER sees Editar on a FAILED row, edits it, and the PATCH is sent', async ({ page }) => {
    await setupMocks(page)

    // Capture the edit PATCH (registered last so LIFO matches it first).
    let patchBody: any = null
    await page.route(`**/api/v1/dashboard/organizations/${TEST_ORG_ID}/sale-verifications/sv-stuck-1`, route => {
      if (route.request().method() === 'PATCH') {
        patchBody = JSON.parse(route.request().postData() || '{}')
        return route.fulfill(json({ success: true, data: { id: 'sv-stuck-1', status: 'COMPLETED' } }))
      }
      return route.fulfill(json({}))
    })

    await page.goto(`/organizations/${TEST_ORG_ID}/sales/detail`)
    await expect(page.getByRole('heading', { name: 'Ventas — Detalle' })).toBeVisible({ timeout: 15_000 })

    // The Editar button exists on the stuck row (this fails before Task 8).
    await page.getByRole('button', { name: 'Editar' }).first().click()

    // Modal opens; correct monto + forma de pago + estado + motivo.
    await expect(page.getByRole('heading', { name: 'Editar venta' })).toBeVisible()
    await page.getByLabel('Monto (MXN)').fill('100')
    await page.getByLabel('Motivo del cambio *').fill('era un ESIM $100, no gratis')
    await page.getByRole('button', { name: 'Guardar' }).click()

    await expect.poll(() => patchBody).not.toBeNull()
    expect(patchBody.amount).toBe(100)
    expect(patchBody.reason).toContain('ESIM')
  })
})
```

- [ ] **Step 2: Run it**

Run: `cd avoqado-web-dashboard && npm run test:e2e -- sales-detail-edit`
Expected: PASS. (Run before Task 8 → FAILS at "Editar" not found, confirming it guards the fix.)

- [ ] **Step 3: Commit**

```bash
cd avoqado-web-dashboard && git add e2e/tests/playtelecom/sales-detail-edit.spec.ts
git commit -m "test(ventas): E2E regression for admin sale edit on SalesDetail"
```

---

## Task 10: Full verification + pre-deploy

- [ ] **Step 1: Server suite**

Run: `cd avoqado-server && npm run test:dashboard && npx tsc --noEmit`
Expected: green.

- [ ] **Step 2: Dashboard build + lint + e2e**

Run: `cd avoqado-web-dashboard && npm run build && npm run lint && npm run test:e2e`
Expected: green.

- [ ] **Step 3: Manual smoke (dev)**

With both dev servers running, as an OWNER of the PlayTelecom org:
1. Go to `/organizations/:orgId/sales/detail`.
2. On a **Revisar (FAILED)** row, click **Editar** → modal opens prefilled.
3. Set Monto = 100, Forma de pago = Efectivo, Estado = Venta correcta, Motivo = "era un ESIM $100".
4. Guardar → toast "Venta actualizada"; the row flips to **Venta correcta**; "Por revisar" KPI drops by 1.
5. Confirm the existing **Aprobar / Revisar / Reabrir** buttons still work.
6. Confirm a non-OWNER (e.g. MANAGER, if reachable) does NOT see **Editar**.
7. Test light + dark mode.

- [ ] **Step 4: Verify audit row**

Confirm an `ActivityLog` row exists: `action='SALE_VERIFICATION_EDIT'`, `entityId=<saleId>`, `data.reason` set, `data.before`/`data.after` populated.

- [ ] **Step 5: Do NOT merge without Jose's review** (per `.claude/rules/bug-fix-workflow.md`). Open the PR with `Closes`-style link to the Asana task, root cause, the fix, and the regression tests. Update the Avoqado MCP + run any P2/P3 planning only after this lands.

---

## Self-review (done at write time)

- **Spec coverage:** §6.1 perm (T1), §6.3 transaction + §6.4 status semantics + §6.7 audit (T2), endpoint (T3/T4), §7 button+modal+gating (T6/T7/T8), §9 tests (T5/T9). P2/P3/MCP intentionally deferred to their own plans (noted in scope).
- **Type consistency:** `editOrgSaleVerification` signature identical across service (T2), controller call (T3), and client (T6); `EditOrgSaleParams` / `paymentForm` union (`'CASH'|'CARD'|'OTHER'`) consistent service↔client; `PAYMENT_FORM_TO_METHOD` keys match the union.
- **Open items carried from spec §11** (not blockers for P1): Tarjeta→`CREDIT_CARD` (decided here), the rest (ICCID canonical serial, promoter list endpoint, FAILED-requires-reasons) belong to P2/P3.
