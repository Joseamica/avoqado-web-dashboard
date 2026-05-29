# TPV Shop — Plan 2: SPEI flow (transferencia bancaria + comprobante)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Habilitar el método de pago SPEI en el wizard de compra de TPV. El cliente recibe los datos bancarios de Avoqado por email + en su página de pedido, hace la transferencia desde su banco, vuelve a Avoqado y sube el comprobante (PDF/imagen). Sales recibe el comprobante por email con botones `Aprobar` / `Rechazar` que funcionan vía magic-link (sin necesidad de login). Una vez aprobado, el pedido sigue exactamente el mismo flujo que Plan 1 (sales asigna serials → email al venue con códigos de activación).

**Architecture:** Reutilizamos el modelo `TerminalOrder` ya creado en Plan 1 (los campos SPEI estaban presentes pero sin usar). Nuevo `terminalOrderToken.service.ts` que firma JWTs para magic links. Multer en memoria + Firebase Storage (patrón ya en uso por `venueKyc.service.ts`). Tres emails nuevos. Páginas públicas `/admin/tpv-orders/:id/approve|reject` que validan el token y disparan la transición de estado. SPEI deja de mostrar el badge "Muy pronto" en el wizard.

**Tech Stack:** Express + Prisma + jsonwebtoken (ya instalado) + Multer + Firebase Storage + Resend para emails con attachments · React 18 + Vite + TanStack Query + `react-dropzone` (verificar) · Playwright.

**Refs:**
- Spec: `docs/superpowers/specs/2026-05-28-tpv-shop-stripe-spei-design.md`
- Plan 1: `docs/superpowers/plans/2026-05-28-tpv-shop-plan-1-card-flow.md`
- Backend storage helper: `avoqado-server/src/services/storage.service.ts` (`uploadFileToStorage`)
- Multer pattern: `avoqado-server/src/routes/dashboard.routes.ts:276` + `avoqado-server/src/services/dashboard/venueKyc.service.ts:115`
- Email template style: `avoqado-server/src/services/email.service.ts:1530-1665` (`sendTerminalPurchaseAdminNotification`)
- Webhook dispatcher: `avoqado-server/src/services/stripe.webhook.service.ts:1027` (no se toca en Plan 2)
- Order detail page (Plan 1): `avoqado-web-dashboard/src/pages/Tpv/TerminalOrderDetail.tsx`
- Wizard Step3 (Plan 1): `avoqado-web-dashboard/src/pages/Tpv/components/purchase-wizard/wizard-steps/Step3PaymentMethod.tsx`

**Project conventions to apply** (locked-in during Plan 1):
- Backend tests: **Jest** (not Vitest). `jest.mock`, `jest.fn`, `as jest.Mock`.
- Prisma singleton: `import prisma from '@/utils/prismaClient'`.
- Backend test files: `tests/unit/services/...`.
- Backend email service: class `EmailService` with `async methodName(): Promise<boolean>` returning `this.sendEmail({to, subject, html, text})`.
- Frontend i18n: keys live in `src/locales/{es,en}/tpv.json` under `purchaseWizard` / `orders` / `tabs` namespaces.
- Frontend uses `useTranslation('tpv')` + `useTranslation()` (for common).
- Superadmin pages: **hardcoded Spanish** (no i18n).
- Working branch: **`develop`** in both repos. NO new branches. NO `git commit` — stage only.
- Off-limits files (do NOT touch): `classSession.*` files and `createOrderFromReservation.ts`.

---

## Phase A — Backend foundation (token + upload + state transitions)

### Task 1: Terminal order token service + unit tests (JWT sign/verify)

**Files:**
- Create: `avoqado-server/src/services/dashboard/terminalOrder/token.service.ts`
- Create: `avoqado-server/tests/unit/services/dashboard/terminalOrder/token.service.test.ts`

The token service signs and verifies JWTs used for magic-link actions on a `TerminalOrder`. Each token carries the order id, an action (`approve` or `reject`), and an expiration.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/services/dashboard/terminalOrder/token.service.test.ts
import {
  signApprovalToken,
  verifyApprovalToken,
  TerminalOrderTokenAction,
} from '@/services/dashboard/terminalOrder/token.service'

describe('terminalOrder token.service', () => {
  const ORIG_SECRET = process.env.TERMINAL_ORDER_TOKEN_SECRET

  beforeAll(() => {
    process.env.TERMINAL_ORDER_TOKEN_SECRET = 'test-secret-32chars-min-required-x'
  })

  afterAll(() => {
    process.env.TERMINAL_ORDER_TOKEN_SECRET = ORIG_SECRET
  })

  it('signs + verifies a token round-trip', () => {
    const token = signApprovalToken({ orderId: 'ord_1', action: 'approve' })
    const payload = verifyApprovalToken(token)
    expect(payload).toMatchObject({ orderId: 'ord_1', action: 'approve' })
  })

  it('rejects a token signed with a different secret', () => {
    const original = process.env.TERMINAL_ORDER_TOKEN_SECRET
    const token = signApprovalToken({ orderId: 'ord_1', action: 'approve' })
    process.env.TERMINAL_ORDER_TOKEN_SECRET = 'a-different-secret-32chars-minim'
    expect(() => verifyApprovalToken(token)).toThrow(/invalid|signature/i)
    process.env.TERMINAL_ORDER_TOKEN_SECRET = original
  })

  it('rejects a token whose action does not match the expected', () => {
    const token = signApprovalToken({ orderId: 'ord_1', action: 'approve' })
    expect(() =>
      verifyApprovalToken(token, { expectedAction: 'reject' as TerminalOrderTokenAction }),
    ).toThrow(/action mismatch/i)
  })

  it('rejects an expired token', () => {
    const token = signApprovalToken({ orderId: 'ord_1', action: 'approve', expiresInSeconds: -1 })
    expect(() => verifyApprovalToken(token)).toThrow(/expired/i)
  })

  it('throws if TERMINAL_ORDER_TOKEN_SECRET is unset at sign time', () => {
    const prev = process.env.TERMINAL_ORDER_TOKEN_SECRET
    delete process.env.TERMINAL_ORDER_TOKEN_SECRET
    expect(() => signApprovalToken({ orderId: 'x', action: 'approve' })).toThrow(
      /TERMINAL_ORDER_TOKEN_SECRET/,
    )
    process.env.TERMINAL_ORDER_TOKEN_SECRET = prev
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL (module missing)**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server
npx jest tests/unit/services/dashboard/terminalOrder/token.service.test.ts
```

- [ ] **Step 3: Implementation**

```typescript
// src/services/dashboard/terminalOrder/token.service.ts
import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken'

export type TerminalOrderTokenAction = 'approve' | 'reject'

export interface SignTokenInput {
  orderId: string
  action: TerminalOrderTokenAction
  /** Default: 7 days. Negative values are allowed to test expiry handling. */
  expiresInSeconds?: number
}

export interface TerminalOrderTokenPayload extends JwtPayload {
  orderId: string
  action: TerminalOrderTokenAction
  type: 'tpv-order'
}

const DEFAULT_EXPIRY_SECONDS = 7 * 24 * 60 * 60 // 7 days

function getSecret(): string {
  const secret = process.env.TERMINAL_ORDER_TOKEN_SECRET
  if (!secret || secret.length < 16) {
    throw new Error(
      'TERMINAL_ORDER_TOKEN_SECRET is not configured (must be at least 16 chars).',
    )
  }
  return secret
}

export function signApprovalToken(input: SignTokenInput): string {
  const expiresIn = input.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS
  const payload = {
    orderId: input.orderId,
    action: input.action,
    type: 'tpv-order' as const,
  }
  const options: SignOptions = { expiresIn }
  return jwt.sign(payload, getSecret(), options)
}

export function verifyApprovalToken(
  token: string,
  opts: { expectedAction?: TerminalOrderTokenAction } = {},
): TerminalOrderTokenPayload {
  let decoded: TerminalOrderTokenPayload
  try {
    decoded = jwt.verify(token, getSecret()) as TerminalOrderTokenPayload
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw new Error('Token expired')
    throw new Error('Token invalid signature')
  }

  if (decoded.type !== 'tpv-order') throw new Error('Token type mismatch')
  if (opts.expectedAction && decoded.action !== opts.expectedAction) {
    throw new Error('Token action mismatch')
  }
  return decoded
}
```

- [ ] **Step 4: Re-run tests — expect 5/5 pass**

```bash
npx jest tests/unit/services/dashboard/terminalOrder/token.service.test.ts
```

- [ ] **Step 5: Stage (no commit)**

```bash
git add src/services/dashboard/terminalOrder/token.service.ts \
        tests/unit/services/dashboard/terminalOrder/token.service.test.ts
```

---

### Task 2: `uploadSpeiProof` service + `approveSpei` + `rejectSpei` service functions + tests

**Files:**
- Modify: `avoqado-server/src/services/dashboard/terminalOrder/terminalOrder.service.ts` (append 3 functions)
- Modify: `avoqado-server/src/services/dashboard/terminalOrder/types.ts` (add input types)
- Modify: `avoqado-server/tests/unit/services/dashboard/terminalOrder/terminalOrder.service.test.ts` (append tests)

- [ ] **Step 1: Add types**

```typescript
// types.ts — append
export interface UploadSpeiProofInput {
  orderId: string
  file: {
    buffer: Buffer
    mimetype: string
    originalname: string
    size: number
  }
}

export interface ApproveSpeiInput {
  orderId: string
  approvedBy: string  // email or "system" or "magic-link"
}

export interface RejectSpeiInput {
  orderId: string
  reason: string
  rejectedBy: string
}
```

- [ ] **Step 2: Add failing tests**

Append to `terminalOrder.service.test.ts`:

```typescript
import {
  uploadSpeiProof,
  approveSpei,
  rejectSpei,
} from '@/services/dashboard/terminalOrder/terminalOrder.service'

// Mock storage helper used by uploadSpeiProof
const uploadFileMock = jest.fn()
jest.mock('@/services/storage.service', () => ({
  uploadFileToStorage: (...args: any[]) => uploadFileMock(...args),
  buildStoragePath: (path: string) => `dev/${path}`,
}))

describe('uploadSpeiProof', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    uploadFileMock.mockResolvedValue('https://firebase-storage.test/url?token=abc')
  })

  it('rejects non-SPEI orders', async () => {
    ;(prisma.terminalOrder.findUnique as jest.Mock).mockResolvedValue({
      id: 'ord_1', orderNumber: 'AVO-0001', venueId: 'v', paymentMethod: 'CARD_STRIPE', paymentStatus: 'AWAITING_PAYMENT',
    })
    await expect(
      uploadSpeiProof({
        orderId: 'ord_1',
        file: { buffer: Buffer.from('x'), mimetype: 'application/pdf', originalname: 'r.pdf', size: 100 },
      }),
    ).rejects.toThrow(/not a SPEI order/i)
  })

  it('rejects already-PAID orders', async () => {
    ;(prisma.terminalOrder.findUnique as jest.Mock).mockResolvedValue({
      id: 'ord_1', orderNumber: 'AVO-0001', venueId: 'v', paymentMethod: 'SPEI', paymentStatus: 'PAID',
    })
    await expect(
      uploadSpeiProof({
        orderId: 'ord_1',
        file: { buffer: Buffer.from('x'), mimetype: 'application/pdf', originalname: 'r.pdf', size: 100 },
      }),
    ).rejects.toThrow(/already paid/i)
  })

  it('rejects oversize files (>10MB)', async () => {
    ;(prisma.terminalOrder.findUnique as jest.Mock).mockResolvedValue({
      id: 'ord_1', orderNumber: 'AVO-0001', venueId: 'v', paymentMethod: 'SPEI', paymentStatus: 'AWAITING_PROOF',
    })
    await expect(
      uploadSpeiProof({
        orderId: 'ord_1',
        file: {
          buffer: Buffer.from('x'),
          mimetype: 'application/pdf',
          originalname: 'huge.pdf',
          size: 11 * 1024 * 1024,
        },
      }),
    ).rejects.toThrow(/too large|10/i)
  })

  it('rejects unsupported mimetypes', async () => {
    ;(prisma.terminalOrder.findUnique as jest.Mock).mockResolvedValue({
      id: 'ord_1', orderNumber: 'AVO-0001', venueId: 'v', paymentMethod: 'SPEI', paymentStatus: 'AWAITING_PROOF',
    })
    await expect(
      uploadSpeiProof({
        orderId: 'ord_1',
        file: {
          buffer: Buffer.from('x'),
          mimetype: 'application/zip',
          originalname: 'r.zip',
          size: 100,
        },
      }),
    ).rejects.toThrow(/file type|mimetype/i)
  })

  it('uploads to Firebase + updates order to PROOF_UPLOADED + generates approval token', async () => {
    ;(prisma.terminalOrder.findUnique as jest.Mock).mockResolvedValue({
      id: 'ord_1', orderNumber: 'AVO-0001', venueId: 'v', paymentMethod: 'SPEI', paymentStatus: 'AWAITING_PROOF',
    })
    ;(prisma.terminalOrder.update as jest.Mock).mockResolvedValue({
      id: 'ord_1', orderNumber: 'AVO-0001', paymentStatus: 'PROOF_UPLOADED',
    })
    process.env.TERMINAL_ORDER_TOKEN_SECRET = 'test-secret-32chars-min-required-x'

    await uploadSpeiProof({
      orderId: 'ord_1',
      file: { buffer: Buffer.from('hello'), mimetype: 'application/pdf', originalname: 'r.pdf', size: 100 },
    })

    expect(uploadFileMock).toHaveBeenCalledTimes(1)
    const updateCall = (prisma.terminalOrder.update as jest.Mock).mock.calls[0][0]
    expect(updateCall.data.paymentStatus).toBe('PROOF_UPLOADED')
    expect(updateCall.data.speiProofUrl).toBe('https://firebase-storage.test/url?token=abc')
    expect(updateCall.data.speiProofMimeType).toBe('application/pdf')
    expect(updateCall.data.speiProofUploadedAt).toBeInstanceOf(Date)
    expect(updateCall.data.speiApprovalToken).toBeTruthy()
    expect(updateCall.data.speiTokenExpiresAt).toBeInstanceOf(Date)
  })
})

describe('approveSpei', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects if order is not PROOF_UPLOADED', async () => {
    ;(prisma.terminalOrder.findUnique as jest.Mock).mockResolvedValue({
      id: 'ord_1', paymentStatus: 'AWAITING_PROOF',
    })
    await expect(approveSpei({ orderId: 'ord_1', approvedBy: 'sales@avoqado.io' })).rejects.toThrow(
      /not in PROOF_UPLOADED/i,
    )
  })

  it('marks PAID + AWAITING_SERIALS and clears approval token (single-use)', async () => {
    ;(prisma.terminalOrder.findUnique as jest.Mock).mockResolvedValue({
      id: 'ord_1', orderNumber: 'AVO-0001', paymentStatus: 'PROOF_UPLOADED', items: [],
    })
    ;(prisma.terminalOrder.update as jest.Mock).mockResolvedValue({
      id: 'ord_1', paymentStatus: 'PAID', fulfillmentStatus: 'AWAITING_SERIALS', items: [],
    })

    await approveSpei({ orderId: 'ord_1', approvedBy: 'sales@avoqado.io' })

    const call = (prisma.terminalOrder.update as jest.Mock).mock.calls[0][0]
    expect(call.data.paymentStatus).toBe('PAID')
    expect(call.data.fulfillmentStatus).toBe('AWAITING_SERIALS')
    expect(call.data.speiApprovedAt).toBeInstanceOf(Date)
    expect(call.data.speiApprovedBy).toBe('sales@avoqado.io')
    expect(call.data.speiApprovalToken).toBeNull()
  })
})

describe('rejectSpei', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects if order is not PROOF_UPLOADED', async () => {
    ;(prisma.terminalOrder.findUnique as jest.Mock).mockResolvedValue({
      id: 'ord_1', paymentStatus: 'PAID',
    })
    await expect(
      rejectSpei({ orderId: 'ord_1', reason: 'falso', rejectedBy: 'sales@avoqado.io' }),
    ).rejects.toThrow(/not in PROOF_UPLOADED/i)
  })

  it('marks REJECTED + persists reason + clears approval token', async () => {
    ;(prisma.terminalOrder.findUnique as jest.Mock).mockResolvedValue({
      id: 'ord_1', orderNumber: 'AVO-0001', paymentStatus: 'PROOF_UPLOADED',
    })
    ;(prisma.terminalOrder.update as jest.Mock).mockResolvedValue({
      id: 'ord_1', paymentStatus: 'REJECTED',
    })
    await rejectSpei({
      orderId: 'ord_1',
      reason: 'El monto no coincide',
      rejectedBy: 'sales@avoqado.io',
    })
    const call = (prisma.terminalOrder.update as jest.Mock).mock.calls[0][0]
    expect(call.data.paymentStatus).toBe('REJECTED')
    expect(call.data.speiRejectionReason).toBe('El monto no coincide')
    expect(call.data.speiApprovalToken).toBeNull()
  })
})
```

- [ ] **Step 3: Run, verify all new tests FAIL**

```bash
npx jest tests/unit/services/dashboard/terminalOrder/terminalOrder.service.test.ts
```

- [ ] **Step 4: Implementation**

Append to `src/services/dashboard/terminalOrder/terminalOrder.service.ts`:

```typescript
import { uploadFileToStorage, buildStoragePath } from '@/services/storage.service'
import { signApprovalToken } from './token.service'
import type {
  UploadSpeiProofInput,
  ApproveSpeiInput,
  RejectSpeiInput,
} from './types'

const MAX_PROOF_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_PROOF_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
])

export async function uploadSpeiProof(input: UploadSpeiProofInput) {
  const order = await prisma.terminalOrder.findUnique({ where: { id: input.orderId } })
  if (!order) throw new Error('Order not found')
  if (order.paymentMethod !== 'SPEI') {
    throw new Error('This is not a SPEI order')
  }
  if (order.paymentStatus === 'PAID') {
    throw new Error('Order is already paid')
  }
  if (order.paymentStatus !== 'AWAITING_PROOF' && order.paymentStatus !== 'REJECTED') {
    throw new Error(
      `Cannot upload proof in payment status ${order.paymentStatus}`,
    )
  }

  if (input.file.size > MAX_PROOF_BYTES) {
    throw new Error('File too large (max 10 MB)')
  }
  if (!ALLOWED_PROOF_MIME.has(input.file.mimetype)) {
    throw new Error(`Unsupported file mimetype: ${input.file.mimetype}`)
  }

  // Pick extension based on mimetype
  const extByMime: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
  }
  const ext = extByMime[input.file.mimetype]
  const path = buildStoragePath(`venues/${order.venueId}/tpv-orders/${order.id}/proof.${ext}`)
  const proofUrl = await uploadFileToStorage(input.file.buffer, path, input.file.mimetype)

  const token = signApprovalToken({ orderId: order.id, action: 'approve' })
  const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  return prisma.terminalOrder.update({
    where: { id: order.id },
    data: {
      paymentStatus: 'PROOF_UPLOADED',
      speiProofUrl: proofUrl,
      speiProofMimeType: input.file.mimetype,
      speiProofUploadedAt: new Date(),
      speiApprovalToken: token,
      speiTokenExpiresAt: tokenExpiresAt,
      // Clear previous rejection reason on resubmit
      speiRejectionReason: null,
    },
    include: { items: true },
  })
}

export async function approveSpei(input: ApproveSpeiInput) {
  const order = await prisma.terminalOrder.findUnique({
    where: { id: input.orderId },
    include: { items: true },
  })
  if (!order) throw new Error('Order not found')
  if (order.paymentStatus !== 'PROOF_UPLOADED') {
    throw new Error(`Order is not in PROOF_UPLOADED state (current: ${order.paymentStatus})`)
  }

  const updated = await prisma.terminalOrder.update({
    where: { id: order.id },
    data: {
      paymentStatus: 'PAID',
      fulfillmentStatus: 'AWAITING_SERIALS',
      speiApprovedAt: new Date(),
      speiApprovedBy: input.approvedBy,
      // Single-use: clear the approval token so it can't be replayed
      speiApprovalToken: null,
      speiTokenExpiresAt: null,
    },
    include: { items: true },
  })

  // Fire emails #4 (customer payment confirmed) + #5 (sales assign serials).
  // Same emails as Plan 1 webhook handler — keep behavior identical.
  try {
    const emailService = (await import('@/services/email.service')).default
    await emailService.sendTerminalOrderPaymentConfirmed({
      order: updated as any,
      items: order.items,
    })
  } catch (err) {
    logger.error('SPEI approve: failed to send payment-confirmed email', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
  try {
    const emailService = (await import('@/services/email.service')).default
    await emailService.sendTerminalOrderSerialAssignmentRequest({
      order: updated as any,
      items: order.items,
    })
  } catch (err) {
    logger.error('SPEI approve: failed to send serial-assignment email', {
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return updated
}

export async function rejectSpei(input: RejectSpeiInput) {
  const order = await prisma.terminalOrder.findUnique({ where: { id: input.orderId } })
  if (!order) throw new Error('Order not found')
  if (order.paymentStatus !== 'PROOF_UPLOADED') {
    throw new Error(`Order is not in PROOF_UPLOADED state (current: ${order.paymentStatus})`)
  }

  return prisma.terminalOrder.update({
    where: { id: order.id },
    data: {
      paymentStatus: 'REJECTED',
      speiRejectionReason: input.reason,
      speiApprovedBy: input.rejectedBy, // reuse the field as "last decision by"
      speiApprovalToken: null,
      speiTokenExpiresAt: null,
    },
    include: { items: true },
  })
}
```

- [ ] **Step 5: Re-run tests — expect all new + existing to pass**

```bash
npx jest tests/unit/services/dashboard/terminalOrder/
```

- [ ] **Step 6: Stage (no commit)**

```bash
git add src/services/dashboard/terminalOrder/ tests/unit/services/dashboard/terminalOrder/
```

---

### Task 3: Email #1 — `sendTerminalOrderSpeiInstructions` (to customer when order created)

**Files:**
- Modify: `avoqado-server/src/services/email.service.ts` (add method)

The customer just created a SPEI order. Send them the bank details and a link to the order page where they'll upload the proof.

- [ ] **Step 1: Add interface and method**

After the existing `TerminalOrderEmailData` interface (added in Plan 1 Task 12), add:

```typescript
export interface SpeiInstructionsEmailData extends TerminalOrderEmailData {
  speiRecipient: {
    beneficiary: string
    clabe: string
    rfc: string
    bank: string
  }
  orderDetailUrl: string  // dashboard URL to upload proof
}
```

In the `EmailService` class, after `sendTerminalOrderTerminalsShipped`, add:

```typescript
async sendTerminalOrderSpeiInstructions(data: SpeiInstructionsEmailData): Promise<boolean> {
  const { order, items, speiRecipient, orderDetailUrl } = data
  const subject = `Datos para completar tu pedido ${order.orderNumber}`
  const logoUrl = 'https://avoqado.io/isotipo.svg'
  const fmtMx = (cents: number) =>
    `$${(cents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${order.currency}`

  const itemsRows = items
    .map(
      (i) => `
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: #000;">${i.productName} × ${i.quantity}</td>
          <td style="padding: 8px 0; font-size: 14px; color: #000; text-align: right;">${fmtMx(i.unitPriceCents * i.quantity)}</td>
        </tr>`,
    )
    .join('')

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>SPEI ${order.orderNumber}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #ffffff; color: #000000;">
  <div style="max-width: 600px; margin: 0 auto; padding: 32px 24px;">
    <div style="padding-bottom: 32px;">
      <img src="${logoUrl}" alt="Avoqado" width="32" height="32" style="display: inline-block; vertical-align: middle;">
      <span style="font-size: 18px; font-weight: 700; color: #000; vertical-align: middle; margin-left: 8px;">Avoqado</span>
    </div>
    <div style="padding-bottom: 24px;">
      <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 400; color: #000;">Completa tu pago por SPEI</h1>
      <p style="margin: 0; font-size: 16px; color: #666;">Pedido ${order.orderNumber}</p>
    </div>
    <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <p style="font-size: 14px; color: #1e3a8a; margin: 0;">
        Haz la transferencia SPEI con estos datos y sube el comprobante en tu dashboard.
        Verificamos el depósito en 1-2 días hábiles.
      </p>
    </div>
    <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #000;">Datos para la transferencia</h3>
      <table cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr><td style="padding: 8px 0; font-size: 14px; color: #666;">Beneficiario</td><td style="padding: 8px 0; font-size: 14px; color: #000; text-align: right;">${speiRecipient.beneficiary}</td></tr>
        <tr style="background: #f5f5f5;"><td style="padding: 12px 8px; font-size: 14px; color: #666;">CLABE</td><td style="padding: 12px 8px; font-size: 16px; color: #000; text-align: right; font-family: monospace; font-weight: 600;">${speiRecipient.clabe}</td></tr>
        <tr><td style="padding: 8px 0; font-size: 14px; color: #666;">Banco</td><td style="padding: 8px 0; font-size: 14px; color: #000; text-align: right;">${speiRecipient.bank}</td></tr>
        <tr><td style="padding: 8px 0; font-size: 14px; color: #666;">RFC</td><td style="padding: 8px 0; font-size: 14px; color: #000; text-align: right; font-family: monospace;">${speiRecipient.rfc}</td></tr>
        <tr style="background: #fef3c7;"><td style="padding: 12px 8px; font-size: 14px; color: #666;">Monto exacto</td><td style="padding: 12px 8px; font-size: 18px; font-weight: 700; color: #000; text-align: right;">${fmtMx(order.totalCents)}</td></tr>
        <tr style="background: #fef3c7;"><td style="padding: 12px 8px; font-size: 14px; color: #666;">Concepto</td><td style="padding: 12px 8px; font-size: 16px; color: #000; text-align: right; font-family: monospace; font-weight: 600;">${order.orderNumber}</td></tr>
      </table>
    </div>
    <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Resumen de tu pedido</h3>
      <table cellpadding="0" cellspacing="0" style="width: 100%;">
        ${itemsRows}
        <tr><td style="padding: 8px 0; font-size: 14px; color: #666;">Subtotal</td><td style="padding: 8px 0; font-size: 14px; color: #000; text-align: right;">${fmtMx(order.subtotalCents)}</td></tr>
        <tr><td style="padding: 8px 0; font-size: 14px; color: #666;">IVA (16%)</td><td style="padding: 8px 0; font-size: 14px; color: #000; text-align: right;">${fmtMx(order.taxCents)}</td></tr>
        <tr style="border-top: 1px solid #e0e0e0;"><td style="padding: 16px 0 0 0; font-size: 16px; font-weight: 600;">Total</td><td style="padding: 16px 0 0 0; font-size: 16px; font-weight: 600; text-align: right;">${fmtMx(order.totalCents)}</td></tr>
      </table>
    </div>
    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${orderDetailUrl}" style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Subir comprobante</a>
      <p style="margin: 12px 0 0 0; font-size: 12px; color: #666;">Una vez que hagas la transferencia, sube el comprobante (PDF o imagen) en tu dashboard.</p>
    </div>
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 0;">
    <div style="padding-top: 24px;">
      <p style="margin: 0; font-size: 14px; color: #666;">Avoqado · Notificación de pedido</p>
    </div>
  </div>
</body></html>`

  const text = `Datos SPEI — ${order.orderNumber}\n\n` +
    `Beneficiario: ${speiRecipient.beneficiary}\n` +
    `CLABE: ${speiRecipient.clabe}\n` +
    `Banco: ${speiRecipient.bank}\n` +
    `RFC: ${speiRecipient.rfc}\n` +
    `Monto exacto: ${fmtMx(order.totalCents)}\n` +
    `Concepto: ${order.orderNumber}\n\n` +
    `Sube tu comprobante en: ${orderDetailUrl}\n\nAvoqado`

  return this.sendEmail({ to: order.contactEmail, subject, html, text })
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npm run build
```

- [ ] **Step 3: Stage**

```bash
git add src/services/email.service.ts
```

---

### Task 4: Wire email #1 into `createOrder` for SPEI orders

**Files:**
- Modify: `avoqado-server/src/services/dashboard/terminalOrder/terminalOrder.service.ts` (modify `createOrder`)

After `prisma.terminalOrder.create(...)`, if `paymentMethod === 'SPEI'`, fire email #1.

- [ ] **Step 1: Find `createOrder` and add the email-trigger block**

After the `return prisma.terminalOrder.create({...})` becomes capturing into a variable, like:

```typescript
export async function createOrder(input: CreateOrderInput) {
  // ... existing logic
  const created = await prisma.terminalOrder.create({ ... })

  // SPEI: send instructions email
  if (created.paymentMethod === 'SPEI') {
    try {
      const baseUrl =
        process.env.DASHBOARD_URL ??
        process.env.FRONTEND_URL ??
        process.env.APP_URL ??
        'https://dashboardv2.avoqado.io'
      const venue = await prisma.venue.findUniqueOrThrow({
        where: { id: created.venueId },
        select: { slug: true },
      })
      const orderDetailUrl = `${baseUrl}/venues/${venue.slug}/tpv/orders/${created.id}`

      const emailService = (await import('@/services/email.service')).default
      await emailService.sendTerminalOrderSpeiInstructions({
        order: created as any,
        items: created.items as any,
        speiRecipient: {
          beneficiary: process.env.SPEI_RECIPIENT_BENEFICIARY ?? '',
          clabe: process.env.SPEI_RECIPIENT_CLABE ?? '',
          rfc: process.env.SPEI_RECIPIENT_RFC ?? '',
          bank: process.env.SPEI_RECIPIENT_BANK ?? '',
        },
        orderDetailUrl,
      })
    } catch (err) {
      logger.error('createOrder: failed to send SPEI instructions email', {
        orderId: created.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return created
}
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

- [ ] **Step 3: Run tests (existing createOrder tests should still pass — they mock prisma but not email)**

```bash
npx jest tests/unit/services/dashboard/terminalOrder/
```

If the existing createOrder tests fail because they don't mock email, fix the mock pattern. Add at top of test file (or extend existing email mock):

```typescript
jest.mock('@/services/email.service', () => ({
  __esModule: true,
  default: {
    sendTerminalOrderSpeiInstructions: jest.fn(),
    sendTerminalOrderPaymentConfirmed: jest.fn(),
    sendTerminalOrderSerialAssignmentRequest: jest.fn(),
    sendTerminalOrderTerminalsShipped: jest.fn(),
  },
}))
```

- [ ] **Step 4: Stage**

```bash
git add src/services/dashboard/terminalOrder/terminalOrder.service.ts \
        tests/unit/services/dashboard/terminalOrder/terminalOrder.service.test.ts
```

---

### Task 5: Email #2 — `sendTerminalOrderSpeiProofForSales` (to sales w/ attachment + magic links)

**Files:**
- Modify: `avoqado-server/src/services/email.service.ts`

When the customer uploads the proof, sales receives this email with the comprobante attached and two big buttons: Aprobar / Rechazar.

- [ ] **Step 1: Verify Resend supports attachments**

Read existing `sendEmail` in `email.service.ts` and check whether the options accept an `attachments` field. Look at the project's Resend integration. If `sendEmail` already supports `attachments: [{filename, content}]`, use that. If not, extend the `EmailOptions` type and pass-through to Resend's `attachments` array.

The Resend Node SDK signature is:
```typescript
resend.emails.send({
  from, to, subject, html, text,
  attachments: [{ filename: 'r.pdf', content: Buffer }]
})
```

- [ ] **Step 2: Add interface**

```typescript
export interface SpeiProofForSalesEmailData extends TerminalOrderEmailData {
  proofUrl: string
  proofMimeType: string
  approveUrl: string
  rejectUrl: string
  adminUiUrl: string
  isResubmit?: boolean   // when true, subject becomes "🔁 Re-aprobar"
}
```

- [ ] **Step 3: Add method**

```typescript
async sendTerminalOrderSpeiProofForSales(data: SpeiProofForSalesEmailData): Promise<boolean> {
  const adminEmail = process.env.ORDER_NOTIFICATIONS_EMAIL
  if (!adminEmail) {
    logger.warn('ORDER_NOTIFICATIONS_EMAIL not configured — skipping SPEI-proof notification')
    return false
  }

  const { order, items, proofUrl, proofMimeType, approveUrl, rejectUrl, adminUiUrl, isResubmit } = data
  const subject = isResubmit
    ? `🔁 Re-aprobar SPEI — ${order.orderNumber}`
    : `⏳ Aprobar SPEI — ${order.orderNumber}`
  const logoUrl = 'https://avoqado.io/isotipo.svg'
  const fmtMx = (cents: number) =>
    `$${(cents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${order.currency}`

  const itemsRows = items
    .map((i) => `
      <tr>
        <td style="padding: 8px 0; font-size: 14px;">${i.productName}</td>
        <td style="padding: 8px 0; font-size: 14px; text-align: right;">${i.quantity} u.</td>
      </tr>`)
    .join('')

  // Try to fetch the proof file and attach. If too large (>5MB), fall back to URL only.
  let attachments: Array<{ filename: string; content: Buffer }> | undefined
  try {
    const res = await fetch(proofUrl)
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer())
      const MAX_ATTACH = 5 * 1024 * 1024
      if (buf.byteLength <= MAX_ATTACH) {
        const ext = proofMimeType === 'application/pdf' ? 'pdf'
          : proofMimeType === 'image/png' ? 'png'
          : proofMimeType === 'image/webp' ? 'webp'
          : 'jpg'
        attachments = [{ filename: `comprobante-${order.orderNumber}.${ext}`, content: buf }]
      } else {
        logger.warn('SPEI proof too large for attachment, falling back to link only', {
          orderId: order.id,
          size: buf.byteLength,
        })
      }
    }
  } catch (err) {
    logger.warn('Could not fetch SPEI proof for attachment', {
      orderId: order.id,
      error: err instanceof Error ? err.message : String(err),
    })
  }

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
      <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: 400;">${isResubmit ? 'Comprobante re-subido' : 'Comprobante SPEI recibido'}</h1>
      <p style="margin: 0; font-size: 16px; color: #666;">${order.orderNumber} · ${order.contactName} · ${fmtMx(order.totalCents)}</p>
    </div>
    <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <p style="font-size: 14px; color: #92400e; margin: 0;"><strong>Acción requerida:</strong> Verifica en el banco que llegó el SPEI por ${fmtMx(order.totalCents)} con concepto <strong>${order.orderNumber}</strong>, después aprueba o rechaza.</p>
    </div>
    <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Items</h3>
      <table cellpadding="0" cellspacing="0" style="width: 100%;">${itemsRows}</table>
    </div>
    <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Comprobante</h3>
      <p style="font-size: 14px; margin: 0;">
        ${attachments ? 'Adjunto en este correo' : 'No se pudo adjuntar (demasiado grande o no disponible)'}.
      </p>
      <p style="font-size: 13px; margin: 8px 0 0 0;">
        <a href="${proofUrl}" style="color: #1a73e8; text-decoration: none;">Ver comprobante online →</a>
      </p>
    </div>
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${approveUrl}" style="display: inline-block; background: #059669; color: #fff; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin-right: 12px;">✅ Aprobar pedido</a>
      <a href="${rejectUrl}" style="display: inline-block; background: #dc2626; color: #fff; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">❌ Rechazar pago</a>
    </div>
    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${adminUiUrl}" style="font-size: 13px; color: #666; text-decoration: none;">Ver en admin UI (login requerido) →</a>
    </div>
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 0;">
    <div style="padding-top: 24px;">
      <p style="margin: 0; font-size: 14px; color: #666;">Los botones expiran a los 7 días. Token único, single-use.</p>
    </div>
  </div>
</body></html>`

  const text = `${subject}\n\n` +
    `Cliente: ${order.contactName} <${order.contactEmail}>\n` +
    `Monto: ${fmtMx(order.totalCents)}\n` +
    `Concepto SPEI: ${order.orderNumber}\n\n` +
    `Comprobante: ${proofUrl}\n\n` +
    `Aprobar: ${approveUrl}\n` +
    `Rechazar: ${rejectUrl}\n` +
    `Admin UI: ${adminUiUrl}\n`

  return this.sendEmail({
    to: adminEmail,
    subject,
    html,
    text,
    ...(attachments ? { attachments } : {}),
  } as any)
}
```

**Note**: the `... as any` cast on the `sendEmail` argument is needed only if the `EmailOptions` type doesn't yet declare `attachments`. Prefer extending the type properly:

```typescript
// Find the EmailOptions interface in email.service.ts (around line 50-100)
interface EmailOptions {
  to: string
  subject: string
  html: string
  text: string
  attachments?: Array<{ filename: string; content: Buffer }>
}
```

And modify `sendEmail` to pass through the `attachments` field when constructing the Resend call.

- [ ] **Step 4: Build check**

```bash
npm run build
```

- [ ] **Step 5: Stage**

```bash
git add src/services/email.service.ts
```

---

### Task 6: Email #3 — `sendTerminalOrderSpeiRejected` (to customer when sales rejects)

**Files:**
- Modify: `avoqado-server/src/services/email.service.ts`

- [ ] **Step 1: Add interface + method**

```typescript
export interface SpeiRejectedEmailData extends TerminalOrderEmailData {
  reason: string
  orderDetailUrl: string
}
```

```typescript
async sendTerminalOrderSpeiRejected(data: SpeiRejectedEmailData): Promise<boolean> {
  const { order, reason, orderDetailUrl } = data
  const subject = `Necesitamos verificar tu pago ${order.orderNumber}`
  const logoUrl = 'https://avoqado.io/isotipo.svg'

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
      <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: 400;">Necesitamos verificar tu pago</h1>
      <p style="margin: 0; font-size: 16px; color: #666;">Pedido ${order.orderNumber}</p>
    </div>
    <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <p style="font-size: 14px; color: #92400e; margin: 0 0 8px 0;"><strong>No pudimos confirmar tu pago.</strong></p>
      <p style="font-size: 14px; color: #92400e; margin: 0;">Motivo: ${reason}</p>
    </div>
    <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <p style="margin: 0 0 12px 0; font-size: 14px;">Por favor verifica los datos del comprobante (monto exacto, concepto = <strong>${order.orderNumber}</strong>) y vuelve a subirlo desde tu dashboard.</p>
    </div>
    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${orderDetailUrl}" style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Volver a subir comprobante</a>
    </div>
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 0;">
    <div style="padding-top: 24px;">
      <p style="margin: 0; font-size: 14px; color: #666;">Si tienes dudas, escríbenos a sales@avoqado.io.</p>
    </div>
  </div>
</body></html>`

  const text = `Necesitamos verificar tu pago ${order.orderNumber}\n\n` +
    `Motivo: ${reason}\n\n` +
    `Vuelve a subir el comprobante: ${orderDetailUrl}\n\nAvoqado`

  return this.sendEmail({ to: order.contactEmail, subject, html, text })
}
```

- [ ] **Step 2: Build + stage**

```bash
npm run build
git add src/services/email.service.ts
```

---

### Task 7: Wire emails #2 and #3 into upload/reject flows

**Files:**
- Modify: `avoqado-server/src/services/dashboard/terminalOrder/terminalOrder.service.ts`

After `uploadSpeiProof` returns the updated order, fire email #2 (sales). After `rejectSpei`, fire email #3 (customer).

- [ ] **Step 1: Helper to build approve/reject URLs**

```typescript
function buildMagicLinkUrls(orderId: string, token: string) {
  const baseUrl =
    process.env.DASHBOARD_URL ??
    process.env.FRONTEND_URL ??
    process.env.APP_URL ??
    'https://dashboardv2.avoqado.io'
  return {
    approveUrl: `${baseUrl}/admin/tpv-orders/${orderId}/approve?token=${encodeURIComponent(token)}`,
    rejectUrl: `${baseUrl}/admin/tpv-orders/${orderId}/reject?token=${encodeURIComponent(token)}`,
    adminUiUrl: `${baseUrl}/superadmin/tpv-orders/${orderId}`,
  }
}
```

- [ ] **Step 2: Wire #2 into `uploadSpeiProof`**

Before `return prisma.terminalOrder.update({...})`, capture the result and fire the email after:

```typescript
const updated = await prisma.terminalOrder.update({...}) // same as before

// Fire sales-notification email (with attachment + magic links)
const isResubmit = order.paymentStatus === 'REJECTED'
try {
  const { approveUrl, rejectUrl, adminUiUrl } = buildMagicLinkUrls(updated.id, token)
  const emailService = (await import('@/services/email.service')).default
  await emailService.sendTerminalOrderSpeiProofForSales({
    order: updated as any,
    items: updated.items,
    proofUrl: updated.speiProofUrl!,
    proofMimeType: updated.speiProofMimeType!,
    approveUrl,
    rejectUrl,
    adminUiUrl,
    isResubmit,
  })
} catch (err) {
  logger.error('uploadSpeiProof: failed to send sales notification', {
    error: err instanceof Error ? err.message : String(err),
  })
}

return updated
```

- [ ] **Step 3: Wire #3 into `rejectSpei`**

After the `prisma.terminalOrder.update({...})` in `rejectSpei`, before `return`:

```typescript
const updated = await prisma.terminalOrder.update({...}) // same as before

try {
  const baseUrl =
    process.env.DASHBOARD_URL ??
    process.env.FRONTEND_URL ??
    process.env.APP_URL ??
    'https://dashboardv2.avoqado.io'
  const venue = await prisma.venue.findUniqueOrThrow({
    where: { id: updated.venueId },
    select: { slug: true },
  })
  const orderDetailUrl = `${baseUrl}/venues/${venue.slug}/tpv/orders/${updated.id}`

  const emailService = (await import('@/services/email.service')).default
  await emailService.sendTerminalOrderSpeiRejected({
    order: updated as any,
    items: [],
    reason: input.reason,
    orderDetailUrl,
  })
} catch (err) {
  logger.error('rejectSpei: failed to send customer rejection email', {
    error: err instanceof Error ? err.message : String(err),
  })
}

return updated
```

- [ ] **Step 4: Build + stage**

```bash
npm run build
git add src/services/dashboard/terminalOrder/terminalOrder.service.ts
```

---

## Phase B — Backend endpoints

### Task 8: Dashboard endpoint `POST /tpv-orders/:id/upload-proof` (multipart, Multer)

**Files:**
- Modify: `avoqado-server/src/controllers/dashboard/terminalOrder.controller.ts` (add handler)
- Modify: `avoqado-server/src/routes/dashboard.routes.ts` (add route w/ Multer middleware)

- [ ] **Step 1: Controller handler**

Append to `terminalOrder.controller.ts`:

```typescript
import { uploadSpeiProof } from '@/services/dashboard/terminalOrder/terminalOrder.service'

export async function uploadProofHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const file = (req as any).file as Express.Multer.File | undefined
    if (!file) {
      res.status(400).json({ success: false, error: 'No file uploaded (field name: proof)' })
      return
    }

    const updated = await uploadSpeiProof({
      orderId: id,
      file: {
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
        size: file.size,
      },
    })
    res.json({ success: true, data: updated })
  } catch (error) {
    logger.error('uploadProofHandler failed', {
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

- [ ] **Step 2: Route with Multer**

In `src/routes/dashboard.routes.ts`, near the existing TPV-order routes, add:

```typescript
import multer from 'multer'

const proofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
})

router.post(
  '/venues/:venueId/tpv-orders/:id/upload-proof',
  authenticateTokenMiddleware,
  proofUpload.single('proof'),
  terminalOrderController.uploadProofHandler,
)
```

If a `multer` instance is already declared at the top of the file for other uploads, reuse it instead of creating a new one (read the file first). The field name is `proof` (must match the frontend's FormData key).

- [ ] **Step 3: Build + stage**

```bash
npm run build
git add src/controllers/dashboard/terminalOrder.controller.ts \
        src/routes/dashboard.routes.ts
```

---

### Task 9: Public endpoints `GET/POST /api/v1/public/tpv-orders/:id/approve|reject` (token-based, no auth)

**Files:**
- Create: `avoqado-server/src/controllers/public/tpvOrder.public.controller.ts`
- Create: `avoqado-server/src/schemas/public/tpvOrder.public.schema.ts`
- Modify: `avoqado-server/src/routes/public.routes.ts` (add routes)

Two endpoints:
- `GET /approve?token=...` — performs the approval, redirects to a success page or returns JSON for the magic-link page to render success.
- `POST /reject?token=...` — body `{reason: string}`, performs the rejection.

We use **POST for reject** so the magic-link page collects the reason. **GET for approve** so click-from-email works directly. (Optional: also `GET /approve/check?token=...` for the magic-link page to validate before showing UI.)

- [ ] **Step 1: Zod schemas**

```typescript
// src/schemas/public/tpvOrder.public.schema.ts
import { z } from 'zod'

export const rejectSpeiSchema = z.object({
  body: z.object({
    reason: z.string().min(5, 'El motivo debe tener al menos 5 caracteres').max(500),
  }),
  query: z.object({
    token: z.string().min(1, 'token requerido'),
  }),
})

export const approveOrderQuerySchema = z.object({
  query: z.object({
    token: z.string().min(1, 'token requerido'),
  }),
})
```

- [ ] **Step 2: Controller**

```typescript
// src/controllers/public/tpvOrder.public.controller.ts
import { Request, Response, NextFunction } from 'express'
import logger from '@/config/logger'
import {
  verifyApprovalToken,
} from '@/services/dashboard/terminalOrder/token.service'
import {
  approveSpei,
  rejectSpei,
} from '@/services/dashboard/terminalOrder/terminalOrder.service'

export async function approveOrderHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const token = String(req.query.token ?? '')
    let payload
    try {
      payload = verifyApprovalToken(token)
    } catch (err) {
      res.status(401).json({ success: false, error: err instanceof Error ? err.message : 'Token inválido' })
      return
    }
    if (payload.orderId !== id) {
      res.status(403).json({ success: false, error: 'Token does not match this order' })
      return
    }

    const updated = await approveSpei({ orderId: id, approvedBy: 'magic-link' })
    res.json({ success: true, data: { orderId: updated.id, orderNumber: updated.orderNumber } })
  } catch (error) {
    logger.error('approveOrderHandler failed', { error: error instanceof Error ? error.message : String(error) })
    if (error instanceof Error) {
      res.status(400).json({ success: false, error: error.message })
      return
    }
    next(error)
  }
}

export async function rejectOrderHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const token = String(req.query.token ?? '')
    let payload
    try {
      payload = verifyApprovalToken(token)
    } catch (err) {
      res.status(401).json({ success: false, error: err instanceof Error ? err.message : 'Token inválido' })
      return
    }
    if (payload.orderId !== id) {
      res.status(403).json({ success: false, error: 'Token does not match this order' })
      return
    }

    const { reason } = req.body
    const updated = await rejectSpei({ orderId: id, reason, rejectedBy: 'magic-link' })
    res.json({ success: true, data: { orderId: updated.id, orderNumber: updated.orderNumber } })
  } catch (error) {
    logger.error('rejectOrderHandler failed', { error: error instanceof Error ? error.message : String(error) })
    if (error instanceof Error) {
      res.status(400).json({ success: false, error: error.message })
      return
    }
    next(error)
  }
}

/**
 * GET /approve/check — used by the magic-link UI BEFORE showing the success page.
 * Validates the token without performing the action (so we can show "Invalid token" early).
 */
export async function approveCheckHandler(req: Request, res: Response) {
  const { id } = req.params
  const token = String(req.query.token ?? '')
  try {
    const payload = verifyApprovalToken(token)
    if (payload.orderId !== id) {
      res.status(403).json({ success: false, error: 'Token does not match this order' })
      return
    }
    res.json({ success: true, data: { orderId: id, valid: true } })
  } catch (err) {
    res.status(401).json({ success: false, error: err instanceof Error ? err.message : 'Token inválido' })
  }
}
```

- [ ] **Step 3: Routes**

In `src/routes/public.routes.ts`, add:

```typescript
import * as tpvOrderPublicController from '../controllers/public/tpvOrder.public.controller'
import { rejectSpeiSchema } from '../schemas/public/tpvOrder.public.schema'

router.get('/tpv-orders/:id/approve', tpvOrderPublicController.approveOrderHandler)
router.get('/tpv-orders/:id/approve/check', tpvOrderPublicController.approveCheckHandler)
router.post(
  '/tpv-orders/:id/reject',
  validateRequest(rejectSpeiSchema),
  tpvOrderPublicController.rejectOrderHandler,
)
```

The full path is `/api/v1/public/tpv-orders/...` (where `/api/v1/public` is the prefix the existing public router uses — verify).

- [ ] **Step 4: Build check**

```bash
npm run build
```

- [ ] **Step 5: Stage**

```bash
git add src/controllers/public/ src/schemas/public/ src/routes/public.routes.ts
```

---

## Phase C — Frontend

### Task 10: Re-enable SPEI option in wizard Step 3

**Files:**
- Modify: `avoqado-web-dashboard/src/pages/Tpv/components/purchase-wizard/wizard-steps/Step3PaymentMethod.tsx`

Remove the disabled state + "Muy pronto" badge. Make the SPEI card behave like the Card option.

- [ ] **Step 1: Edits**

Find the SPEI `<Card>` block. Replace:
- `className="opacity-60 cursor-not-allowed border-input"` → use the same dynamic class as Card:
  ```tsx
  className={`cursor-pointer transition-all border-input ${
    field.value === 'SPEI'
      ? 'border-primary bg-accent/50'
      : 'hover:border-muted-foreground'
  }`}
  onClick={() => field.onChange('SPEI')}
  ```
- `disabled` on `<RadioGroupItem>` → remove
- Remove the `<Badge variant="outline" className="text-[10px] h-4 px-1.5">{tCommon('common.comingSoon', 'Muy pronto')}</Badge>` and the surrounding `<div className="flex items-center gap-2">` wrapper. The label can stand alone.

- [ ] **Step 2: Build + lint**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard
npm run build && npm run lint
```

- [ ] **Step 3: Stage**

```bash
git add src/pages/Tpv/components/purchase-wizard/wizard-steps/Step3PaymentMethod.tsx
```

---

### Task 11: Frontend TPV order service — add `uploadProof`

**Files:**
- Modify: `avoqado-web-dashboard/src/services/tpvOrder.service.ts`

- [ ] **Step 1: Add upload method**

Append to the `tpvOrderService` object:

```typescript
async uploadProof(venueId: string, orderId: string, file: File): Promise<TerminalOrder> {
  const formData = new FormData()
  formData.append('proof', file)
  const { data } = await api.post(
    `/api/v1/dashboard/venues/${venueId}/tpv-orders/${orderId}/upload-proof`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return data.data
},
```

Also add public-endpoint helpers:

```typescript
export const tpvOrderPublicService = {
  async approve(orderId: string, token: string) {
    const { data } = await api.get(
      `/api/v1/public/tpv-orders/${orderId}/approve?token=${encodeURIComponent(token)}`,
    )
    return data.data
  },
  async checkApproveToken(orderId: string, token: string) {
    const { data } = await api.get(
      `/api/v1/public/tpv-orders/${orderId}/approve/check?token=${encodeURIComponent(token)}`,
    )
    return data.data
  },
  async reject(orderId: string, token: string, reason: string) {
    const { data } = await api.post(
      `/api/v1/public/tpv-orders/${orderId}/reject?token=${encodeURIComponent(token)}`,
      { reason },
    )
    return data.data
  },
}
```

- [ ] **Step 2: Build + stage**

```bash
npm run build
git add src/services/tpvOrder.service.ts
```

---

### Task 12: Extend order detail page with SPEI bank details + dropzone

**Files:**
- Modify: `avoqado-web-dashboard/src/pages/Tpv/TerminalOrderDetail.tsx`

The page already exists (Plan 1 Task 25). Extend it: when `paymentMethod === 'SPEI'` and `paymentStatus` is `AWAITING_PROOF`, `PROOF_UPLOADED`, or `REJECTED`, show:

1. Bank details card with copy-to-clipboard buttons.
2. Upload dropzone (only when `AWAITING_PROOF` or `REJECTED`).
3. If `REJECTED`: show the rejection reason in amber + allow re-upload.
4. If `PROOF_UPLOADED`: show "Recibimos tu comprobante, en 1-2 días lo verificamos" + link to the uploaded file.

- [ ] **Step 1: Check if `react-dropzone` is installed**

```bash
grep "react-dropzone" /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard/package.json
```

If not, use a native `<input type="file">` with drag-and-drop styling (see Step 3 below). If present, prefer `react-dropzone`.

- [ ] **Step 2: Add a SPEI section to the detail page**

Below the existing items + shipping cards (but ABOVE the terminals card), add:

```tsx
{/* SPEI bank details + upload */}
{order.paymentMethod === 'SPEI' && order.speiRecipient && (
  <SpeiPaymentSection order={order} />
)}
```

And in the same file, define `SpeiPaymentSection`:

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useRef } from 'react'
import { Copy, Check, AlertTriangle, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { tpvOrderService, type TerminalOrder } from '@/services/tpvOrder.service'
import { useToast } from '@/hooks/use-toast'

function CopyableRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center justify-between py-2 border-b border-input last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono">{value}</span>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            void navigator.clipboard.writeText(value)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  )
}

function SpeiPaymentSection({ order }: { order: TerminalOrder }) {
  const { t } = useTranslation('tpv')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const showUpload = order.paymentStatus === 'AWAITING_PROOF' || order.paymentStatus === 'REJECTED'
  const showProofUploaded = order.paymentStatus === 'PROOF_UPLOADED'

  const uploadMutation = useMutation({
    mutationFn: (file: File) => tpvOrderService.uploadProof(order.venueId, order.id, file),
    onSuccess: () => {
      toast({ title: t('orders.detail.spei.uploadSuccess.title') })
      queryClient.invalidateQueries({ queryKey: ['tpv-order', order.venueId, order.id] })
    },
    onError: (err: any) => {
      toast({
        title: t('common.error'),
        description: err.response?.data?.error ?? err.message,
        variant: 'destructive',
      })
    },
  })

  const handleFileSelect = (file: File | undefined) => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: t('common.error'),
        description: t('orders.detail.spei.fileTooLarge'),
        variant: 'destructive',
      })
      return
    }
    uploadMutation.mutate(file)
  }

  const fmtMx = (cents: number) =>
    `$${(cents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${order.currency}`

  return (
    <>
      {/* Bank details */}
      <Card className="border-input">
        <CardHeader>
          <CardTitle className="text-base">{t('orders.detail.spei.bankDetailsTitle')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('orders.detail.spei.bankDetailsHelp')}
          </p>
        </CardHeader>
        <CardContent>
          <CopyableRow label={t('orders.detail.spei.beneficiary')} value={order.speiRecipient!.beneficiary} />
          <CopyableRow label="CLABE" value={order.speiRecipient!.clabe} />
          <CopyableRow label={t('orders.detail.spei.bank')} value={order.speiRecipient!.bank} />
          <CopyableRow label="RFC" value={order.speiRecipient!.rfc} />
          <CopyableRow label={t('orders.detail.spei.amount')} value={fmtMx(order.totalCents)} />
          <CopyableRow label={t('orders.detail.spei.concept')} value={order.orderNumber} />
        </CardContent>
      </Card>

      {/* Rejection notice */}
      {order.paymentStatus === 'REJECTED' && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-700 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <div className="font-medium text-amber-900 dark:text-amber-100">
                {t('orders.detail.spei.rejected.title')}
              </div>
              <div className="text-amber-800 dark:text-amber-200 mt-1">
                {(order as any).speiRejectionReason ?? t('orders.detail.spei.rejected.fallbackReason')}
              </div>
              <div className="text-amber-700 dark:text-amber-300 mt-2 text-xs">
                {t('orders.detail.spei.rejected.callToAction')}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload */}
      {showUpload && (
        <Card className="border-input">
          <CardHeader>
            <CardTitle className="text-base">{t('orders.detail.spei.uploadTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging ? 'border-primary bg-accent/30' : 'border-input hover:border-muted-foreground'
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragging(false)
                handleFileSelect(e.dataTransfer.files[0])
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">{t('orders.detail.spei.dropzone.title')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('orders.detail.spei.dropzone.help')}</p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
              />
            </div>
            {uploadMutation.isPending && (
              <p className="text-sm text-center mt-3 text-muted-foreground">
                {t('orders.detail.spei.uploading')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Proof uploaded — awaiting verification */}
      {showProofUploaded && (
        <Card className="border-blue-300 bg-blue-50 dark:bg-blue-950/30">
          <CardContent className="p-4 text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100">
              {t('orders.detail.spei.proofUploaded.title')}
            </p>
            <p className="text-blue-800 dark:text-blue-200 mt-1">
              {t('orders.detail.spei.proofUploaded.message')}
            </p>
            {(order as any).speiProofUrl && (
              <a
                href={(order as any).speiProofUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-700 dark:text-blue-300 hover:underline mt-2 inline-block"
              >
                {t('orders.detail.spei.proofUploaded.viewProof')} →
              </a>
            )}
          </CardContent>
        </Card>
      )}
    </>
  )
}
```

- [ ] **Step 3: Extend the `TerminalOrder` frontend type if needed**

In `src/services/tpvOrder.service.ts`, ensure `TerminalOrder` includes:
- `speiProofUrl: string | null`
- `speiRejectionReason: string | null`

Add these if missing.

- [ ] **Step 4: Build + lint + stage**

```bash
npm run build && npm run lint
git add src/pages/Tpv/TerminalOrderDetail.tsx src/services/tpvOrder.service.ts
```

---

### Task 13: Magic-link pages `/admin/tpv-orders/:id/approve` and `/reject`

**Files:**
- Create: `avoqado-web-dashboard/src/pages/PublicAdmin/ApproveTpvOrder.tsx`
- Create: `avoqado-web-dashboard/src/pages/PublicAdmin/RejectTpvOrder.tsx`
- Modify: router declaration — find where TOP-LEVEL public routes live (`grep -rln "Route path=\"/admin" src/` and `grep -rln "Route path=\"/legal" src/`). They should be siblings outside the venue + superadmin layouts so they don't require any auth.
- Modify: `src/routes/lazyComponents.ts` to add the lazy exports.

Both pages are intentionally simple. They take a `:id` route param + `?token=...` query. They call the backend; show success or error.

- [ ] **Step 1: ApproveTpvOrder.tsx**

```tsx
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

import { tpvOrderPublicService } from '@/services/tpvOrder.service'

export default function ApproveTpvOrder() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [orderNumber, setOrderNumber] = useState('')

  useEffect(() => {
    if (!id || !token) {
      setState('error')
      setMessage('Falta el token o el id del pedido.')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const result = await tpvOrderPublicService.approve(id, token)
        if (cancelled) return
        setOrderNumber(result.orderNumber)
        setState('ok')
      } catch (err: any) {
        if (cancelled) return
        setMessage(err.response?.data?.error ?? err.message ?? 'No se pudo aprobar el pedido.')
        setState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, token])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-4">
        {state === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Aprobando pedido…</p>
          </>
        )}
        {state === 'ok' && (
          <>
            <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
            <h1 className="text-2xl font-semibold">Pedido aprobado</h1>
            <p className="text-muted-foreground">
              {orderNumber} aprobado. Le enviamos los emails de confirmación al cliente y de asignación a sales.
            </p>
            <p className="text-xs text-muted-foreground">Puedes cerrar esta pestaña.</p>
          </>
        )}
        {state === 'error' && (
          <>
            <XCircle className="h-12 w-12 mx-auto text-destructive" />
            <h1 className="text-2xl font-semibold">No pudimos aprobar el pedido</h1>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-xs text-muted-foreground">
              Si el link expiró, inicia sesión como superadmin para gestionar el pedido manualmente.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: RejectTpvOrder.tsx**

```tsx
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { tpvOrderPublicService } from '@/services/tpvOrder.service'

export default function RejectTpvOrder() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [tokenChecked, setTokenChecked] = useState(false)
  const [tokenValid, setTokenValid] = useState(false)
  const [tokenError, setTokenError] = useState('')

  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitState, setSubmitState] = useState<'idle' | 'ok' | 'error'>('idle')
  const [submitMessage, setSubmitMessage] = useState('')

  useEffect(() => {
    if (!id || !token) {
      setTokenError('Falta el token o el id del pedido.')
      setTokenChecked(true)
      return
    }
    ;(async () => {
      try {
        await tpvOrderPublicService.checkApproveToken(id, token)
        setTokenValid(true)
      } catch (err: any) {
        setTokenError(err.response?.data?.error ?? err.message ?? 'Token inválido')
      } finally {
        setTokenChecked(true)
      }
    })()
  }, [id, token])

  const handleSubmit = async () => {
    if (!id || !token) return
    if (reason.trim().length < 5) {
      setSubmitMessage('El motivo debe tener al menos 5 caracteres.')
      setSubmitState('error')
      return
    }
    setSubmitting(true)
    setSubmitState('idle')
    try {
      await tpvOrderPublicService.reject(id, token, reason.trim())
      setSubmitState('ok')
    } catch (err: any) {
      setSubmitMessage(err.response?.data?.error ?? err.message ?? 'No se pudo rechazar el pedido.')
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

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md text-center space-y-4">
          <XCircle className="h-12 w-12 mx-auto text-destructive" />
          <h1 className="text-2xl font-semibold">Link inválido</h1>
          <p className="text-muted-foreground">{tokenError}</p>
        </div>
      </div>
    )
  }

  if (submitState === 'ok') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md text-center space-y-4">
          <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
          <h1 className="text-2xl font-semibold">Pedido rechazado</h1>
          <p className="text-muted-foreground">
            Se envió un email al cliente con el motivo del rechazo. Pueden re-subir el comprobante en su dashboard.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="max-w-md w-full space-y-4 border border-input rounded-lg p-6">
        <h1 className="text-2xl font-semibold">Rechazar pago SPEI</h1>
        <p className="text-sm text-muted-foreground">
          Explica al cliente qué falta para que pueda corregirlo y re-subir el comprobante.
        </p>
        <div className="space-y-2">
          <Label htmlFor="reason">Motivo del rechazo</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: El monto del comprobante no coincide con el total del pedido."
            rows={4}
          />
        </div>
        {submitState === 'error' && (
          <p className="text-sm text-destructive">{submitMessage}</p>
        )}
        <Button onClick={handleSubmit} disabled={submitting} className="w-full">
          {submitting ? 'Rechazando…' : 'Rechazar y notificar al cliente'}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add lazy exports**

In `src/routes/lazyComponents.ts`:

```typescript
export const ApproveTpvOrder = lazy(() => import('@/pages/PublicAdmin/ApproveTpvOrder'))
export const RejectTpvOrder = lazy(() => import('@/pages/PublicAdmin/RejectTpvOrder'))
```

- [ ] **Step 4: Register routes**

In the router config (probably `src/routes/router.tsx`), add the routes at the TOP LEVEL — sibling to the venue layout and superadmin layout, so they don't inherit auth guards:

```tsx
{
  path: '/admin/tpv-orders/:id/approve',
  element: (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <ApproveTpvOrder />
    </Suspense>
  ),
},
{
  path: '/admin/tpv-orders/:id/reject',
  element: (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <RejectTpvOrder />
    </Suspense>
  ),
},
```

(Adjust import of `Suspense` / `Loader2` if not present at the top of router.tsx.)

- [ ] **Step 5: Build + lint + stage**

```bash
npm run build && npm run lint
git add src/pages/PublicAdmin/ src/routes/lazyComponents.ts src/routes/router.tsx
```

---

## Phase D — i18n + E2E + verification

### Task 14: i18n keys for SPEI flow (es + en)

**Files:**
- Modify: `src/locales/es/tpv.json`
- Modify: `src/locales/en/tpv.json`

Add under `orders.detail`:

```jsonc
"spei": {
  "bankDetailsTitle": "Datos para tu transferencia SPEI",
  "bankDetailsHelp": "Copia los datos y haz la transferencia desde tu banco. El concepto debe ser exactamente el número de pedido.",
  "beneficiary": "Beneficiario",
  "bank": "Banco",
  "amount": "Monto exacto",
  "concept": "Concepto",
  "uploadTitle": "Sube tu comprobante",
  "uploading": "Subiendo comprobante…",
  "fileTooLarge": "El archivo es demasiado grande (máximo 10 MB).",
  "dropzone": {
    "title": "Arrastra el comprobante aquí",
    "help": "o haz click para seleccionar. PDF o imagen, máx 10 MB."
  },
  "uploadSuccess": { "title": "Comprobante recibido. Te avisamos cuando lo verifiquemos." },
  "rejected": {
    "title": "Necesitamos verificar tu pago",
    "fallbackReason": "Hubo un problema con el comprobante.",
    "callToAction": "Por favor verifica los datos y vuelve a subirlo."
  },
  "proofUploaded": {
    "title": "Recibimos tu comprobante",
    "message": "En 1-2 días hábiles confirmamos el depósito y te avisamos.",
    "viewProof": "Ver mi comprobante"
  }
}
```

Mirror in `en/tpv.json` with English values.

- [ ] **Step 1: Add keys**
- [ ] **Step 2: Build + lint**
- [ ] **Step 3: Stage**

---

### Task 15: Playwright E2E for SPEI flow

**Files:**
- Create: `avoqado-web-dashboard/e2e/tests/tpv/buy-terminal-spei.spec.ts`

Three tests:
1. Create SPEI order → redirects to detail page → bank details shown.
2. Upload comprobante → state flips to PROOF_UPLOADED → "Recibimos tu comprobante" visible.
3. Magic-link approve page renders success state with valid token mock.

```typescript
import { test, expect } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'

test.describe('Buy TPV — SPEI flow', () => {
  test('creates a SPEI order and shows bank details on the detail page', async ({ page }) => {
    await setupApiMocks(page, { userRole: 'OWNER' })

    // POST /tpv-orders for SPEI returns redirectUrl: null + an orderId we navigate to
    await page.route('**/api/v1/dashboard/venues/*/tpv-orders', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            orderId: 'ord_spei_1',
            orderNumber: 'AVO-0002',
            redirectUrl: null,
          },
        }),
      })
    })

    // GET /tpv-orders/:id returns the SPEI order with bank details
    await page.route('**/api/v1/dashboard/venues/*/tpv-orders/ord_spei_1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'ord_spei_1',
            orderNumber: 'AVO-0002',
            venueId: 'venue_1',
            currency: 'MXN',
            subtotalCents: 400_000,
            taxCents: 64_000,
            totalCents: 464_000,
            paymentMethod: 'SPEI',
            paymentStatus: 'AWAITING_PROOF',
            fulfillmentStatus: 'NEW',
            items: [{ id: 'oi_1', brand: 'PAX', model: 'A910S', productName: 'PAX A910S', quantity: 1, unitPriceCents: 400_000, namePrefix: 'PAX A910S' }],
            terminals: [],
            contactName: 'Test', contactEmail: 't@t.com', contactPhone: '+52',
            shippingAddress: 'A', shippingAddress2: null, shippingCity: 'C', shippingState: 'S', shippingZip: '01000', shippingCountry: 'México',
            stripeReceiptUrl: null,
            createdAt: new Date().toISOString(),
            speiRecipient: {
              beneficiary: 'SERVICIOS TECNOLOGICOS AVO SA DE CV',
              clabe: '699180600007741022',
              bank: 'STP',
              rfc: 'STA241210PW8',
            },
          },
        }),
      })
    })

    await page.goto('/venues/test-venue/tpv')
    await page.getByRole('button', { name: /comprar terminal/i }).click()
    await page.locator('[data-tour="tpv-cart-add-a910s"]').click()
    await page.locator('[data-tour="tpv-wizard-next"]').click()
    await page.locator('[data-tour="tpv-wizard-next"]').click()
    // Pick SPEI in Step 3
    await page.locator('[data-tour="tpv-payment-spei"]').click()
    await page.locator('[data-tour="tpv-wizard-next"]').click()
    await page.getByRole('checkbox').check()
    await page.locator('[data-tour="tpv-wizard-next"]').click()

    // Should land on order detail with bank details visible
    await expect(page).toHaveURL(/\/tpv\/orders\/ord_spei_1/)
    await expect(page.getByText('699180600007741022')).toBeVisible()
    await expect(page.getByText('SERVICIOS TECNOLOGICOS AVO SA DE CV')).toBeVisible()
  })

  test('uploading comprobante flips status to PROOF_UPLOADED', async ({ page }) => {
    await setupApiMocks(page, { userRole: 'OWNER' })

    let uploaded = false
    await page.route('**/api/v1/dashboard/venues/*/tpv-orders/ord_spei_1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'ord_spei_1', orderNumber: 'AVO-0002', venueId: 'venue_1', currency: 'MXN',
            subtotalCents: 400_000, taxCents: 64_000, totalCents: 464_000,
            paymentMethod: 'SPEI',
            paymentStatus: uploaded ? 'PROOF_UPLOADED' : 'AWAITING_PROOF',
            fulfillmentStatus: 'NEW',
            items: [{ id: 'oi_1', brand: 'PAX', model: 'A910S', productName: 'PAX A910S', quantity: 1, unitPriceCents: 400_000, namePrefix: 'PAX A910S' }],
            terminals: [],
            contactName: 'Test', contactEmail: 't@t.com', contactPhone: '+52',
            shippingAddress: 'A', shippingAddress2: null, shippingCity: 'C', shippingState: 'S', shippingZip: '01000', shippingCountry: 'México',
            stripeReceiptUrl: null, createdAt: new Date().toISOString(),
            speiRecipient: { beneficiary: 'AVO', clabe: '699180600007741022', bank: 'STP', rfc: 'STA' },
          },
        }),
      })
    })

    await page.route('**/api/v1/dashboard/venues/*/tpv-orders/ord_spei_1/upload-proof', async (route) => {
      uploaded = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { id: 'ord_spei_1', paymentStatus: 'PROOF_UPLOADED' } }),
      })
    })

    await page.goto('/venues/test-venue/tpv/orders/ord_spei_1')
    // dropzone is targeted by clicking the underlying file input
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'comprobante.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 mock'),
    })
    await expect(page.getByText(/recibimos tu comprobante|proof received/i)).toBeVisible({ timeout: 5000 })
  })

  test('magic-link approve page shows success on valid token', async ({ page }) => {
    await setupApiMocks(page, { userRole: 'OWNER' })

    await page.route('**/api/v1/public/tpv-orders/ord_spei_1/approve*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { orderId: 'ord_spei_1', orderNumber: 'AVO-0002' } }),
      })
    })

    await page.goto('/admin/tpv-orders/ord_spei_1/approve?token=test_valid_token')
    await expect(page.getByText(/pedido aprobado|order approved/i)).toBeVisible({ timeout: 5000 })
  })
})
```

- [ ] **Step 1: Create file**
- [ ] **Step 2: Run E2E**
- [ ] **Step 3: Stage**

---

### Task 16: Pre-deploy verification

Same shape as Plan 1 Task 29:

- [ ] Backend `npm run build` — PASS
- [ ] Backend `npx jest tests/unit/services/dashboard/terminalOrder/` — all pass
- [ ] Dashboard `npm run build` + `npm run lint` — PASS
- [ ] Dashboard `npm run test:e2e -- buy-terminal-spei` — 3/3 PASS
- [ ] `git diff --cached --name-only` audit — no `classSession.*` files staged
- [ ] No git commits made
- [ ] Manual smoke test guide (with env vars listed)

**Env vars required for Plan 2:**
```
SPEI_RECIPIENT_BENEFICIARY="SERVICIOS TECNOLOGICOS AVO SA DE CV"
SPEI_RECIPIENT_CLABE=699180600007741022
SPEI_RECIPIENT_RFC=STA241210PW8
SPEI_RECIPIENT_BANK=STP
TERMINAL_ORDER_TOKEN_SECRET=<32+ chars random>
ORDER_NOTIFICATIONS_EMAIL=sales@avoqado.io
```

**Manual smoke test:**
1. Set env vars, restart backend.
2. Create an order with payment method SPEI.
3. Verify customer receives email #1 (bank details).
4. On the order detail page, verify bank details + dropzone show.
5. Upload a PDF as comprobante. Verify state flips to PROOF_UPLOADED.
6. Verify sales receives email #2 with attachment + Aprobar/Rechazar buttons.
7. Click Aprobar (use the URL from the email). Verify the approve page shows success.
8. Verify paymentStatus is now PAID + fulfillmentStatus AWAITING_SERIALS.
9. Verify customer gets email #4 (payment confirmed) + sales gets email #5 (assign serials).
10. Continue with Plan 1's superadmin flow: assign serials → customer gets email #6 with codes.

For reject flow: at step 7, click Rechazar instead → enter reason → verify customer gets email #3.

---

## Self-Review Notes

**Spec coverage:**

| Spec requirement | Task |
|------------------|------|
| Enable SPEI in wizard step 3 | Task 10 |
| Bank details on confirmation page | Task 12 |
| Upload comprobante (Multer + Firebase) | Tasks 2, 8, 11, 12 |
| Magic-link Aprobar / Rechazar | Tasks 1, 9, 13 |
| Token expiration (7 days) | Task 1 |
| Single-use token | Tasks 2 (set null on approve/reject) |
| Email #1 (SPEI instructions to customer) | Tasks 3, 4 |
| Email #2 (sales w/ attachment + magic links) | Tasks 5, 7 |
| Email #3 (rejected to customer) | Tasks 6, 7 |
| Approve flow triggers emails #4 and #5 (already exist from Plan 1) | Task 2 (`approveSpei` reuses them) |
| Frontend i18n | Task 14 |
| E2E tests | Task 15 |

**Out of scope (defer to Plan 3):**
- Magic-link version of serial-assignment email (Plan 1 currently links to login-required superadmin UI).
- Background job for expired orders (`AWAITING_PAYMENT` > 7d, `AWAITING_PROOF` > 14d).
- Reminder emails at 3 and 7 days before SPEI expiry.

**Open assumptions:**
- The Resend `EmailOptions` type may not yet declare `attachments`. Task 5 extends if needed.
- Frontend uses native `<input type="file">` if `react-dropzone` isn't installed (Task 12).
- Public routes (`/admin/tpv-orders/:id/approve|reject`) sit at the top of the router tree outside venue/superadmin layouts — verify the router config supports this and adjust if needed.

**Risks:**
- If sales clicks Aprobar twice in quick succession (e.g. double-click in email), the second call hits a no-longer-PROOF_UPLOADED order and fails. That's the desired behavior (idempotent rejection of replays). UI shows error "Order is not in PROOF_UPLOADED state".
- If the proof file is borderline 10 MB, Multer may reject before our service does. Match limits — Multer at 10 MB matches our service check.
- If Firebase Storage upload fails (network), the order stays in AWAITING_PROOF and the user can retry from the dropzone. No data loss.
