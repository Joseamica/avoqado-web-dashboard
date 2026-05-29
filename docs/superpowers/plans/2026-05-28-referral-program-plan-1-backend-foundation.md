# Referral Program — Plan 1: Backend Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la base backend del programa de referidos C2C: schema Prisma (3 modelos nuevos + 6 campos en Customer + ajustes a Coupon), servicios core con TDD (code generation, activación + migración legacy, captura + validación anti-fraude, calificación al pago, void al refund), endpoints REST, hooks en services existentes (Customer create, Order paid, Order refund), y registro de permisos.

**Architecture:** Schema-first: migrations primero, services TDD después. Cada service tiene unit tests (Jest + jest.mock) y una integration test que cubre el flujo end-to-end por subsistema. Endpoints van detrás de feature flag `REFERRAL_PROGRAM_ENABLED` (default OFF). Reutilizamos `Coupon` para premios del referidor y `Discount` one-time para el 10% del referido. Sin cambios a Loyalty (sistemas coexisten).

**Tech Stack:** Prisma + PostgreSQL · Express + TypeScript · Jest (no vitest) · Zod para validation · Sin nuevas dependencias en este plan.

**⚠️ Conventions reminder (de TPV Shop Plan 1):**
- avoqado-server usa **Jest** (no vitest). `jest.mock`, `jest.fn`, `jest.clearAllMocks`, `as jest.Mock`.
- Prisma singleton: `@/utils/prismaClient` (no `@/lib/prisma`).
- Test files: `tests/unit/services/...` (no co-located en `src/`).
- Implementación en `src/services/...`.

**Refs:**
- Spec: `docs/superpowers/specs/2026-05-28-referral-program-design.md`
- Patterns a seguir:
  - Service modular: `avoqado-server/src/services/terminalOrder/` (split por responsabilidad)
  - Service singleton + tests: `avoqado-server/src/services/terminalOrder.service.ts` + `tests/unit/services/terminalOrder.service.test.ts`
  - Permissions: `avoqado-server/src/lib/permissions.ts`
  - White-label mapping: `avoqado-server/src/services/access/access.service.ts` (`PERMISSION_TO_FEATURE_MAP`)
  - Customer model: `avoqado-server/prisma/schema.prisma:4795-4860`
  - LoyaltyConfig (para referencia): `avoqado-server/prisma/schema.prisma:4930-4970`
  - Coupon model: buscar en schema (verificar campos `active`, `deactivatedReason`, `source`, `redeemedAt`)
  - Auditoría existente (audit log model): grep `model AuditLog` o `model Audit*` en schema

**Working dirs:**
- Backend: `/Users/amieva/Documents/Programming/Avoqado/avoqado-server`
- Plan + spec: `/Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard/docs/superpowers/`

**Pre-implementation checks (NO empezar sin estas confirmaciones):**

- [ ] **Pre-1**: Verificar campos actuales en `Coupon` model (Read del schema). Si no existen `active`, `deactivatedReason`, `source`, `redeemedAt`, se agregan en Task 5.
- [ ] **Pre-2**: Identificar el nombre exacto del model de auditoría (`AuditLog`, `Audit`, `ActionLog`, etc.) para usar en Task 8.
- [ ] **Pre-3**: Confirmar que existe model `StaffVenue` con campo apropiado para `capturedByStaffVenueId` (debe ser cuid string).
- [ ] **Pre-4**: Identificar el feature flag mechanism — buscar `FEATURE_FLAG`, `featureFlag`, o variable de entorno pattern. Si no existe, este plan agrega un check por `process.env.REFERRAL_PROGRAM_ENABLED === 'true'`.

---

## Phase A — Schema (Tasks 1-6)

### Task 1: Agregar enums `ReferralStatus` y `ReferralTier`

**Files:**
- Modify: `avoqado-server/prisma/schema.prisma` (al final del archivo, junto a los otros enums)

- [ ] **Step 1: Agregar los enums**

Append al final del archivo `prisma/schema.prisma`, después del último enum existente:

```prisma
enum ReferralStatus {
  PENDING   // Capturado en TPV/dashboard, Order aún no se cobra
  QUALIFIED // Order PAID, referidor recibió crédito
  VOID      // Refund, fraude o anulado manualmente
}

enum ReferralTier {
  TIER_1
  TIER_2
  TIER_3
}
```

- [ ] **Step 2: Validar sintaxis Prisma**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server
npx prisma format
```

Expected: `Formatted X files in Y ms.` sin errores.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(referrals): add ReferralStatus and ReferralTier enums"
```

---

### Task 2: Agregar 6 campos nuevos al model `Customer`

**Files:**
- Modify: `avoqado-server/prisma/schema.prisma` (model `Customer`, ~líneas 4795-4860)

- [ ] **Step 1: Localizar el model Customer y agregar los campos**

Dentro del block `model Customer { ... }`, después del bloque `// Loyalty & tracking` (línea ~4810), agregar:

```prisma
  // Referral program — 6 campos
  referralCode         String?
  referralCount        Int           @default(0)
  referralTier         ReferralTier?
  tierUnlockedAt       DateTime?
  tierUpModalSeenAt    DateTime?
  referredByCustomerId String?
  referredByCustomer   Customer?     @relation("CustomerReferredBy", fields: [referredByCustomerId], references: [id], onDelete: SetNull)
  referredCustomers    Customer[]    @relation("CustomerReferredBy")

  referralsAsReferrer  Referral[]    @relation("ReferralsAsReferrer")
  referralsAsReferred  Referral[]    @relation("ReferralsAsReferred")
```

Y dentro del block de `@@unique` / `@@index` al final del model, agregar:

```prisma
  @@unique([venueId, referralCode])
  @@index([referredByCustomerId])
```

- [ ] **Step 2: Validar**

```bash
npx prisma format
```

(Va a fallar porque el model `Referral` aún no existe — eso lo resolvemos en Task 4. Por ahora ignorar el error de relación faltante.)

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(referrals): add 6 referral fields to Customer model"
```

---

### Task 3: Agregar model `ReferralProgramConfig`

**Files:**
- Modify: `avoqado-server/prisma/schema.prisma`
- Modify: `avoqado-server/prisma/schema.prisma` (model `Venue` → agregar relación inversa)

- [ ] **Step 1: Agregar el model**

Al final del archivo (después de los otros models de loyalty), antes de los enums:

```prisma
model ReferralProgramConfig {
  id      String @id @default(cuid())
  venueId String @unique
  venue   Venue  @relation(fields: [venueId], references: [id], onDelete: Cascade)

  active      Boolean   @default(false)
  activatedAt DateTime?

  // Premio al referido en su primera compra
  newCustomerDiscountPercent Decimal @default(10) @db.Decimal(5, 2)

  // 3 tiers — defaults del PDF de Mindform
  tier1ReferralsRequired Int     @default(7)
  tier1RewardPercent     Decimal @default(15) @db.Decimal(5, 2)
  tier2ReferralsRequired Int     @default(12)
  tier2RewardPercent     Decimal @default(20) @db.Decimal(5, 2)
  tier3ReferralsRequired Int     @default(20)
  tier3RewardPercent     Decimal @default(25) @db.Decimal(5, 2)

  // Vigencia del cupón emitido al desbloquear tier
  rewardCouponExpiryDays Int @default(90)

  // Templates editables (es-MX). Nullable = usa defaults del código.
  welcomeMessageTemplate String? @db.Text
  tierUpMessageTemplate  String? @db.Text

  // Prefijo del código de referido. Nullable = uppercase del venue slug
  codePrefix String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Agregar la relación inversa en `Venue`**

Localizar el model `Venue { ... }`, en la sección de relaciones, agregar:

```prisma
  referralProgramConfig ReferralProgramConfig?
```

- [ ] **Step 3: Validar**

```bash
npx prisma format
```

(Sigue fallando por `Referral` faltante. OK.)

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(referrals): add ReferralProgramConfig model"
```

---

### Task 4: Agregar model `Referral`

**Files:**
- Modify: `avoqado-server/prisma/schema.prisma`
- Modify: `avoqado-server/prisma/schema.prisma` (model `Venue`, `StaffVenue`, `Order`, `Coupon` → relaciones inversas)

- [ ] **Step 1: Agregar el model `Referral`**

Después de `ReferralProgramConfig`:

```prisma
model Referral {
  id      String @id @default(cuid())
  venueId String
  venue   Venue  @relation(fields: [venueId], references: [id], onDelete: Cascade)

  referrerCustomerId String
  referrerCustomer   Customer @relation("ReferralsAsReferrer", fields: [referrerCustomerId], references: [id], onDelete: Cascade)

  referredCustomerId String
  referredCustomer   Customer @relation("ReferralsAsReferred", fields: [referredCustomerId], references: [id], onDelete: Cascade)

  status ReferralStatus @default(PENDING)

  // Auditoría: quién capturó (staff en TPV / manager en dashboard)
  capturedByStaffVenueId String?
  capturedByStaffVenue   StaffVenue? @relation("ReferralsCaptured", fields: [capturedByStaffVenueId], references: [id], onDelete: SetNull)

  // Override de manager sobre regla EXISTING_CUSTOMER
  forcedOverride Boolean @default(false)
  overrideReason String? @db.Text

  // Order cuyo PAID gatilla la calificación
  qualifyingOrderId String?
  qualifyingOrder   Order?  @relation(fields: [qualifyingOrderId], references: [id], onDelete: SetNull)
  qualifiedAt       DateTime?

  // Void
  voidedAt   DateTime?
  voidReason String? @db.Text

  // Cupón emitido al desbloquear tier (FK)
  rewardCouponId String?
  rewardCoupon   Coupon? @relation(fields: [rewardCouponId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())

  @@index([venueId])
  @@index([referrerCustomerId])
  @@index([referredCustomerId])
  @@index([status])
}
```

- [ ] **Step 2: Agregar relaciones inversas**

En `model Venue`:

```prisma
  referrals Referral[]
```

En `model StaffVenue`:

```prisma
  referralsCaptured Referral[] @relation("ReferralsCaptured")
```

En `model Order` (junto a las otras relaciones):

```prisma
  referralsTriggered Referral[]
```

En `model Coupon`:

```prisma
  referrals Referral[]
```

- [ ] **Step 3: Validar Prisma compila**

```bash
npx prisma format
npx prisma validate
```

Expected: ambos pasan sin errores.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(referrals): add Referral model and inverse relations"
```

---

### Task 5: Verificar / agregar campos faltantes en `Coupon`

**Files:**
- Modify: `avoqado-server/prisma/schema.prisma` (model `Coupon`)

- [ ] **Step 1: Inspeccionar el model `Coupon` actual**

```bash
grep -A 30 "^model Coupon" prisma/schema.prisma
```

Confirmar cuáles de estos 4 campos ya existen:
- `active: Boolean @default(true)`
- `deactivatedReason: String?`
- `source: String?` (o `CouponSource?` si hay enum)
- `redeemedAt: DateTime?`

- [ ] **Step 2: Agregar los que falten**

Si falta `active`:

```prisma
  active Boolean @default(true)
```

Si falta `deactivatedReason`:

```prisma
  deactivatedReason String? @db.Text
```

Si falta `source`:

```prisma
  source String? // E.g., "REFERRAL_TIER", "MANUAL", "CAMPAIGN"
```

Si falta `redeemedAt`:

```prisma
  redeemedAt DateTime?
```

(El comentario explica para futuros lectores; el implementer evalúa si meterlos como enum.)

- [ ] **Step 3: Validar**

```bash
npx prisma format
npx prisma validate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(referrals): add Coupon fields needed for tier-up rewards (only if missing)"
```

(Si todos los campos ya existen, este task se salta el commit y solo se documenta "no changes needed".)

---

### Task 6: Generar y aplicar la migration

**Files:**
- Create: `avoqado-server/prisma/migrations/<TIMESTAMP>_add_referral_program/migration.sql`

- [ ] **Step 1: Generar migration**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server
npx prisma migrate dev --name add_referral_program --create-only
```

Expected: archivo `prisma/migrations/<TIMESTAMP>_add_referral_program/migration.sql` creado.

- [ ] **Step 2: Inspeccionar el SQL generado**

Read del migration.sql. Verificar:
- `CREATE TABLE "ReferralProgramConfig"` con todos los campos
- `CREATE TABLE "Referral"` con todos los campos
- `ALTER TABLE "Customer" ADD COLUMN ...` para los 6 campos
- `ALTER TABLE "Customer" ADD CONSTRAINT ... UNIQUE ("venueId", "referralCode")`
- `CREATE INDEX "Customer_referredByCustomerId_idx"`
- `CREATE INDEX "Referral_venueId_idx"`, `_referrerCustomerId_idx`, `_referredCustomerId_idx`, `_status_idx`
- Si Task 5 agregó campos a Coupon: `ALTER TABLE "Coupon" ADD COLUMN ...`

Si falta algo, ajustar el schema y regenerar.

- [ ] **Step 3: Aplicar migration a DB local**

```bash
npx prisma migrate dev
```

Expected: migration aplicada, Prisma Client regenerado.

- [ ] **Step 4: Verificar Prisma Client tipa correctamente**

Crear archivo temporal `tmp-check-types.ts`:

```ts
import { prisma } from '@/utils/prismaClient'
import type { Referral, ReferralProgramConfig, ReferralStatus, ReferralTier } from '@prisma/client'

async function check() {
  const r: Referral = await prisma.referral.findFirstOrThrow()
  const c: ReferralProgramConfig = await prisma.referralProgramConfig.findFirstOrThrow()
  const status: ReferralStatus = 'PENDING'
  const tier: ReferralTier = 'TIER_1'
  console.log(r, c, status, tier)
}
```

```bash
npx tsc --noEmit tmp-check-types.ts
```

Expected: 0 errors. (El runtime fallaría porque no hay registros, pero tipos compilan.)

```bash
rm tmp-check-types.ts
```

- [ ] **Step 5: Commit**

```bash
git add prisma/migrations/<TIMESTAMP>_add_referral_program/
git commit -m "feat(referrals): db migration for referral program schema"
```

---

## Phase B — Core Services (TDD) (Tasks 7-13)

### Task 7: Service `referralCode` — generación con TDD

**Files:**
- Create: `avoqado-server/src/services/referrals/referralCode.service.ts`
- Create: `avoqado-server/tests/unit/services/referrals/referralCode.service.test.ts`

- [ ] **Step 1: Crear directorio + test file con casos TDD**

Crear `tests/unit/services/referrals/referralCode.service.test.ts`:

```ts
import { generateReferralCode, normalizeNameForCode, CodeGenerationContext } from '@/services/referrals/referralCode.service'
import { prisma } from '@/utils/prismaClient'

jest.mock('@/utils/prismaClient', () => ({
  prisma: {
    customer: {
      findFirst: jest.fn(),
    },
    referralProgramConfig: {
      findUnique: jest.fn(),
    },
  },
}))

const mockedPrisma = prisma as unknown as {
  customer: { findFirst: jest.Mock }
  referralProgramConfig: { findUnique: jest.Mock }
}

describe('referralCode.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('normalizeNameForCode', () => {
    it('takes first 4 letters uppercased', () => {
      expect(normalizeNameForCode('María López')).toBe('MARI')
    })

    it('strips accents (NFD normalization)', () => {
      expect(normalizeNameForCode('José Pérez')).toBe('JOSE')
    })

    it('handles spaces and only uses first name', () => {
      expect(normalizeNameForCode('Ana Cristina Torres')).toBe('ANAC')
    })

    it('pads short names with X', () => {
      expect(normalizeNameForCode('Li')).toBe('LIXX')
      expect(normalizeNameForCode('A')).toBe('AXXX')
    })

    it('returns ANON for empty/null name', () => {
      expect(normalizeNameForCode('')).toBe('ANON')
      expect(normalizeNameForCode(null)).toBe('ANON')
      expect(normalizeNameForCode(undefined)).toBe('ANON')
    })

    it('strips ñ and special chars', () => {
      expect(normalizeNameForCode('Iñaki')).toBe('INAK')
    })
  })

  describe('generateReferralCode', () => {
    const baseCtx: CodeGenerationContext = {
      venueId: 'venue_123',
      venuePrefix: 'MINDFORM',
      customerName: 'María López',
    }

    it('generates code with format VENUE-NAMEN-R3', async () => {
      mockedPrisma.customer.findFirst.mockResolvedValue(null) // no collision
      const code = await generateReferralCode(baseCtx)
      expect(code).toMatch(/^MINDFORM-MARI[A-HJ-NP-Z2-9]{3}$/)
    })

    it('retries on collision up to 5 times', async () => {
      mockedPrisma.customer.findFirst
        .mockResolvedValueOnce({ id: 'collision-1' })
        .mockResolvedValueOnce({ id: 'collision-2' })
        .mockResolvedValueOnce(null) // 3rd attempt succeeds
      const code = await generateReferralCode(baseCtx)
      expect(code).toMatch(/^MINDFORM-MARI[A-HJ-NP-Z2-9]{3}$/)
      expect(mockedPrisma.customer.findFirst).toHaveBeenCalledTimes(3)
    })

    it('throws after 5 failed attempts', async () => {
      mockedPrisma.customer.findFirst.mockResolvedValue({ id: 'always-collides' })
      await expect(generateReferralCode(baseCtx)).rejects.toThrow(/collision/i)
      expect(mockedPrisma.customer.findFirst).toHaveBeenCalledTimes(5)
    })

    it('avoids ambiguous characters in random suffix', async () => {
      mockedPrisma.customer.findFirst.mockResolvedValue(null)
      const code = await generateReferralCode(baseCtx)
      const suffix = code.split('-').pop()!
      expect(suffix).not.toMatch(/[0OI1S5]/)
    })

    it('uppercases venuePrefix and caps at 8 chars', async () => {
      mockedPrisma.customer.findFirst.mockResolvedValue(null)
      const code = await generateReferralCode({
        ...baseCtx,
        venuePrefix: 'verylongvenuename',
      })
      expect(code.startsWith('VERYLONG-')).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Correr tests — DEBEN FALLAR (no hay implementation)**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server
npx jest tests/unit/services/referrals/referralCode.service.test.ts
```

Expected: `Cannot find module '@/services/referrals/referralCode.service'`

- [ ] **Step 3: Implementar el service mínimo**

Crear `src/services/referrals/referralCode.service.ts`:

```ts
import { prisma } from '@/utils/prismaClient'

const SAFE_POOL = 'ABCDEFGHJKLMNPQRTUVWXYZ23456789' // 28 chars, no 0/O/I/1/S/5

export interface CodeGenerationContext {
  venueId: string
  venuePrefix: string
  customerName: string | null | undefined
}

export function normalizeNameForCode(name: string | null | undefined): string {
  if (!name) return 'ANON'
  // NFD descompone "é" en "e" + U+0301. Removemos combining marks (U+0300..U+036F),
  // luego strip todo no-letra (espacios, dígitos, símbolos), uppercase, primeras 4.
  const stripped = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase()
  if (!stripped) return 'ANON'
  const first4 = stripped.slice(0, 4)
  return first4.padEnd(4, 'X')
}

function randomSuffix3(): string {
  let s = ''
  for (let i = 0; i < 3; i++) {
    s += SAFE_POOL[Math.floor(Math.random() * SAFE_POOL.length)]
  }
  return s
}

function normalizeVenuePrefix(prefix: string): string {
  return prefix
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 8)
}

export async function generateReferralCode(ctx: CodeGenerationContext): Promise<string> {
  const prefix = normalizeVenuePrefix(ctx.venuePrefix)
  const namePart = normalizeNameForCode(ctx.customerName)
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = randomSuffix3()
    const code = `${prefix}-${namePart}${suffix}`
    const existing = await prisma.customer.findFirst({
      where: { venueId: ctx.venueId, referralCode: code },
      select: { id: true },
    })
    if (!existing) return code
  }
  throw new Error(`Referral code generation collision: 5 attempts exhausted for venue ${ctx.venueId}`)
}
```

- [ ] **Step 4: Correr tests — DEBEN PASAR**

```bash
npx jest tests/unit/services/referrals/referralCode.service.test.ts
```

Expected: `Tests: 12 passed, 12 total` (o el número exacto según los `it()` declarados).

- [ ] **Step 5: Commit**

```bash
git add src/services/referrals/referralCode.service.ts tests/unit/services/referrals/referralCode.service.test.ts
git commit -m "feat(referrals): referralCode.service — generate, normalize, retry on collision"
```

---

### Task 8: Service `referralProgram` — activate + deactivate + updateConfig

**Files:**
- Create: `avoqado-server/src/services/referrals/referralProgram.service.ts`
- Create: `avoqado-server/tests/unit/services/referrals/referralProgram.service.test.ts`

- [ ] **Step 1: Test file con casos**

```ts
import {
  activateReferralProgram,
  deactivateReferralProgram,
  updateReferralConfig,
  ActivateInput,
} from '@/services/referrals/referralProgram.service'
import { prisma } from '@/utils/prismaClient'

jest.mock('@/utils/prismaClient', () => ({
  prisma: {
    $transaction: jest.fn(),
    referralProgramConfig: {
      upsert: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    venue: { findUnique: jest.fn() },
    customer: { findMany: jest.fn(), update: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}))

jest.mock('@/services/referrals/referralCode.service', () => ({
  generateReferralCode: jest.fn().mockResolvedValue('MINDFORM-TEST123'),
}))

const mockedPrisma = prisma as any
const { generateReferralCode } = require('@/services/referrals/referralCode.service')

describe('referralProgram.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // $transaction passes through with the same mocked client
    mockedPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockedPrisma))
  })

  describe('activateReferralProgram', () => {
    const input: ActivateInput = {
      venueId: 'venue_1',
      newCustomerDiscountPercent: 10,
      tier1ReferralsRequired: 7,
      tier1RewardPercent: 15,
      tier2ReferralsRequired: 12,
      tier2RewardPercent: 20,
      tier3ReferralsRequired: 20,
      tier3RewardPercent: 25,
      rewardCouponExpiryDays: 90,
      codePrefix: 'MINDFORM',
    }

    it('creates config with active=true and activatedAt set', async () => {
      mockedPrisma.referralProgramConfig.upsert.mockResolvedValue({ id: 'cfg_1', active: true })
      mockedPrisma.customer.findMany.mockResolvedValue([])
      await activateReferralProgram(input)
      expect(mockedPrisma.referralProgramConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { venueId: 'venue_1' },
          create: expect.objectContaining({ active: true, activatedAt: expect.any(Date) }),
          update: expect.objectContaining({ active: true, activatedAt: expect.any(Date) }),
        }),
      )
    })

    it('generates codes for legacy customers without referralCode', async () => {
      mockedPrisma.referralProgramConfig.upsert.mockResolvedValue({ id: 'cfg_1' })
      mockedPrisma.customer.findMany.mockResolvedValue([
        { id: 'cust_1', name: 'María López' },
        { id: 'cust_2', name: 'Jose Pérez' },
      ])
      mockedPrisma.customer.update.mockResolvedValue({})
      await activateReferralProgram(input)
      expect(mockedPrisma.customer.update).toHaveBeenCalledTimes(2)
      expect(generateReferralCode).toHaveBeenCalledTimes(2)
    })

    it('is idempotent — re-runs only set codes on customers with null', async () => {
      mockedPrisma.referralProgramConfig.upsert.mockResolvedValue({ id: 'cfg_1' })
      mockedPrisma.customer.findMany.mockResolvedValue([])
      await activateReferralProgram(input)
      expect(mockedPrisma.customer.update).not.toHaveBeenCalled()
    })

    it('validates tier requirements are strictly ascending', async () => {
      await expect(
        activateReferralProgram({ ...input, tier2ReferralsRequired: 5 }),
      ).rejects.toThrow(/tier requirements must be ascending/i)
    })

    it('rejects negative numbers', async () => {
      await expect(
        activateReferralProgram({ ...input, tier1RewardPercent: -5 }),
      ).rejects.toThrow(/non-negative/i)
    })

    it('writes audit log entry on activation', async () => {
      mockedPrisma.referralProgramConfig.upsert.mockResolvedValue({ id: 'cfg_1' })
      mockedPrisma.customer.findMany.mockResolvedValue([{ id: 'c1', name: 'X' }])
      await activateReferralProgram(input)
      expect(mockedPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'REFERRAL_PROGRAM_ACTIVATED',
            venueId: 'venue_1',
          }),
        }),
      )
    })
  })

  describe('deactivateReferralProgram', () => {
    it('sets active=false and preserves data', async () => {
      mockedPrisma.referralProgramConfig.update.mockResolvedValue({ active: false })
      await deactivateReferralProgram({ venueId: 'venue_1', reason: 'pausing for season' })
      expect(mockedPrisma.referralProgramConfig.update).toHaveBeenCalledWith({
        where: { venueId: 'venue_1' },
        data: { active: false },
      })
      expect(mockedPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'REFERRAL_PROGRAM_DEACTIVATED',
            metadata: expect.objectContaining({ reason: 'pausing for season' }),
          }),
        }),
      )
    })
  })

  describe('updateReferralConfig', () => {
    it('allows partial updates', async () => {
      mockedPrisma.referralProgramConfig.update.mockResolvedValue({})
      await updateReferralConfig({
        venueId: 'venue_1',
        patch: { tier1RewardPercent: 18 },
      })
      expect(mockedPrisma.referralProgramConfig.update).toHaveBeenCalledWith({
        where: { venueId: 'venue_1' },
        data: { tier1RewardPercent: 18 },
      })
    })

    it('validates tier ordering on patch', async () => {
      await expect(
        updateReferralConfig({
          venueId: 'venue_1',
          patch: { tier2ReferralsRequired: 5, tier1ReferralsRequired: 10 },
        }),
      ).rejects.toThrow(/ascending/i)
    })
  })
})
```

- [ ] **Step 2: Correr tests — fallar**

```bash
npx jest tests/unit/services/referrals/referralProgram.service.test.ts
```

Expected: `Cannot find module '@/services/referrals/referralProgram.service'`

- [ ] **Step 3: Implementación**

Crear `src/services/referrals/referralProgram.service.ts`:

```ts
import { prisma } from '@/utils/prismaClient'
import { generateReferralCode } from './referralCode.service'

export interface ActivateInput {
  venueId: string
  newCustomerDiscountPercent: number
  tier1ReferralsRequired: number
  tier1RewardPercent: number
  tier2ReferralsRequired: number
  tier2RewardPercent: number
  tier3ReferralsRequired: number
  tier3RewardPercent: number
  rewardCouponExpiryDays: number
  codePrefix?: string
  welcomeMessageTemplate?: string
  tierUpMessageTemplate?: string
}

function validateConfig(input: Partial<ActivateInput>): void {
  const numericFields: (keyof ActivateInput)[] = [
    'newCustomerDiscountPercent',
    'tier1ReferralsRequired',
    'tier1RewardPercent',
    'tier2ReferralsRequired',
    'tier2RewardPercent',
    'tier3ReferralsRequired',
    'tier3RewardPercent',
    'rewardCouponExpiryDays',
  ]
  for (const f of numericFields) {
    const v = input[f]
    if (v !== undefined && typeof v === 'number' && v < 0) {
      throw new Error(`Field ${f} must be non-negative`)
    }
  }
  const t1r = input.tier1ReferralsRequired
  const t2r = input.tier2ReferralsRequired
  const t3r = input.tier3ReferralsRequired
  if (t1r !== undefined && t2r !== undefined && t2r <= t1r) {
    throw new Error('Tier requirements must be ascending: tier2 > tier1')
  }
  if (t2r !== undefined && t3r !== undefined && t3r <= t2r) {
    throw new Error('Tier requirements must be ascending: tier3 > tier2')
  }
}

export async function activateReferralProgram(input: ActivateInput): Promise<void> {
  validateConfig(input)
  await prisma.$transaction(async tx => {
    const config = await tx.referralProgramConfig.upsert({
      where: { venueId: input.venueId },
      create: {
        venueId: input.venueId,
        active: true,
        activatedAt: new Date(),
        newCustomerDiscountPercent: input.newCustomerDiscountPercent,
        tier1ReferralsRequired: input.tier1ReferralsRequired,
        tier1RewardPercent: input.tier1RewardPercent,
        tier2ReferralsRequired: input.tier2ReferralsRequired,
        tier2RewardPercent: input.tier2RewardPercent,
        tier3ReferralsRequired: input.tier3ReferralsRequired,
        tier3RewardPercent: input.tier3RewardPercent,
        rewardCouponExpiryDays: input.rewardCouponExpiryDays,
        codePrefix: input.codePrefix,
        welcomeMessageTemplate: input.welcomeMessageTemplate,
        tierUpMessageTemplate: input.tierUpMessageTemplate,
      },
      update: {
        active: true,
        activatedAt: new Date(),
        newCustomerDiscountPercent: input.newCustomerDiscountPercent,
        tier1ReferralsRequired: input.tier1ReferralsRequired,
        tier1RewardPercent: input.tier1RewardPercent,
        tier2ReferralsRequired: input.tier2ReferralsRequired,
        tier2RewardPercent: input.tier2RewardPercent,
        tier3ReferralsRequired: input.tier3ReferralsRequired,
        tier3RewardPercent: input.tier3RewardPercent,
        rewardCouponExpiryDays: input.rewardCouponExpiryDays,
        codePrefix: input.codePrefix,
      },
    })

    // Migrate legacy customers
    const venuePrefix = config.codePrefix ?? 'VENUE' // TODO: resolve from venue slug
    const legacyCustomers = await tx.customer.findMany({
      where: { venueId: input.venueId, referralCode: null },
      select: { id: true, name: true },
    })
    for (const c of legacyCustomers) {
      const code = await generateReferralCode({
        venueId: input.venueId,
        venuePrefix,
        customerName: c.name,
      })
      await tx.customer.update({
        where: { id: c.id },
        data: { referralCode: code },
      })
    }

    await tx.auditLog.create({
      data: {
        venueId: input.venueId,
        action: 'REFERRAL_PROGRAM_ACTIVATED',
        metadata: { legacyCustomersMigrated: legacyCustomers.length },
      },
    })
  })
}

export interface DeactivateInput {
  venueId: string
  reason: string
}

export async function deactivateReferralProgram(input: DeactivateInput): Promise<void> {
  await prisma.referralProgramConfig.update({
    where: { venueId: input.venueId },
    data: { active: false },
  })
  await prisma.auditLog.create({
    data: {
      venueId: input.venueId,
      action: 'REFERRAL_PROGRAM_DEACTIVATED',
      metadata: { reason: input.reason },
    },
  })
}

export interface UpdateConfigInput {
  venueId: string
  patch: Partial<ActivateInput>
}

export async function updateReferralConfig(input: UpdateConfigInput): Promise<void> {
  validateConfig(input.patch)
  await prisma.referralProgramConfig.update({
    where: { venueId: input.venueId },
    data: input.patch,
  })
}
```

> **Nota al implementer**: el `venuePrefix` default necesita resolver del `venue.slug` real. Por ahora dejo el `TODO` y lo resolvemos en Task 9 cuando el venue lookup esté disponible. Si quieres, se hace ya en este task — abrir el venue con `tx.venue.findUnique({where:{id:input.venueId}})` y derivar el prefix de su slug.

- [ ] **Step 4: Tests pasan**

```bash
npx jest tests/unit/services/referrals/referralProgram.service.test.ts
```

Expected: todos pasan.

- [ ] **Step 5: Commit**

```bash
git add src/services/referrals/referralProgram.service.ts tests/unit/services/referrals/referralProgram.service.test.ts
git commit -m "feat(referrals): referralProgram.service — activate, deactivate, updateConfig"
```

---

### Task 9: Resolver `venuePrefix` desde `venue.slug` en activación

**Files:**
- Modify: `avoqado-server/src/services/referrals/referralProgram.service.ts`
- Modify: `avoqado-server/tests/unit/services/referrals/referralProgram.service.test.ts`

- [ ] **Step 1: Agregar test que falla**

Agregar al test file existente, dentro de `describe('activateReferralProgram')`:

```ts
it('derives codePrefix from venue.slug when not provided', async () => {
  mockedPrisma.referralProgramConfig.upsert.mockResolvedValue({
    id: 'cfg_1',
    codePrefix: null,
  })
  mockedPrisma.venue.findUnique.mockResolvedValue({ slug: 'mindform' })
  mockedPrisma.customer.findMany.mockResolvedValue([{ id: 'c1', name: 'María' }])
  await activateReferralProgram({ ...input, codePrefix: undefined })
  expect(generateReferralCode).toHaveBeenCalledWith(
    expect.objectContaining({ venuePrefix: 'mindform' }),
  )
})
```

- [ ] **Step 2: Verificar que falla**

```bash
npx jest tests/unit/services/referrals/referralProgram.service.test.ts -t "derives codePrefix"
```

Expected: FAIL (porque hoy usamos `'VENUE'` hardcoded).

- [ ] **Step 3: Reemplazar el TODO con la resolución real**

En `activateReferralProgram`, reemplazar:

```ts
const venuePrefix = config.codePrefix ?? 'VENUE' // TODO: resolve from venue slug
```

con:

```ts
let venuePrefix = config.codePrefix
if (!venuePrefix) {
  const venue = await tx.venue.findUnique({
    where: { id: input.venueId },
    select: { slug: true },
  })
  venuePrefix = venue?.slug ?? input.venueId.slice(-8)
}
```

- [ ] **Step 4: Tests pasan**

```bash
npx jest tests/unit/services/referrals/referralProgram.service.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/services/referrals/referralProgram.service.ts tests/unit/services/referrals/referralProgram.service.test.ts
git commit -m "feat(referrals): derive code prefix from venue.slug when codePrefix is null"
```

---

### Task 10: Service `referralCapture` — validate + capture

**Files:**
- Create: `avoqado-server/src/services/referrals/referralCapture.service.ts`
- Create: `avoqado-server/tests/unit/services/referrals/referralCapture.service.test.ts`

- [ ] **Step 1: Test file**

```ts
import {
  validateReferralCode,
  captureReferral,
  ValidationResult,
} from '@/services/referrals/referralCapture.service'
import { prisma } from '@/utils/prismaClient'

jest.mock('@/utils/prismaClient', () => ({
  prisma: {
    referralProgramConfig: { findUnique: jest.fn() },
    customer: { findFirst: jest.fn(), findUnique: jest.fn() },
    referral: { create: jest.fn() },
    order: { count: jest.fn() },
  },
}))

const mockedPrisma = prisma as any

describe('referralCapture.service', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('validateReferralCode', () => {
    const ctx = { venueId: 'venue_1', referralCode: 'MINDFORM-JOSE2K7', newCustomerId: 'cust_new' }

    it('rejects when program not active', async () => {
      mockedPrisma.referralProgramConfig.findUnique.mockResolvedValue({ active: false })
      const result = await validateReferralCode(ctx)
      expect(result).toMatchObject({ valid: false, reason: 'PROGRAM_INACTIVE' })
    })

    it('rejects when code does not exist in this venue', async () => {
      mockedPrisma.referralProgramConfig.findUnique.mockResolvedValue({ active: true })
      mockedPrisma.customer.findFirst.mockResolvedValue(null)
      const result = await validateReferralCode(ctx)
      expect(result).toMatchObject({ valid: false, reason: 'CODE_NOT_FOUND' })
    })

    it('rejects self-referral', async () => {
      mockedPrisma.referralProgramConfig.findUnique.mockResolvedValue({ active: true })
      mockedPrisma.customer.findFirst.mockResolvedValue({ id: 'cust_new', name: 'X' })
      const result = await validateReferralCode(ctx)
      expect(result).toMatchObject({ valid: false, reason: 'SELF_REFERRAL' })
    })

    it('rejects existing customer (has prior Orders)', async () => {
      mockedPrisma.referralProgramConfig.findUnique.mockResolvedValue({ active: true })
      mockedPrisma.customer.findFirst.mockResolvedValue({ id: 'cust_ref', name: 'Jose' })
      mockedPrisma.order.count.mockResolvedValue(3)
      const result = await validateReferralCode(ctx)
      expect(result).toMatchObject({ valid: false, reason: 'EXISTING_CUSTOMER' })
    })

    it('returns valid + referrer info when all checks pass', async () => {
      mockedPrisma.referralProgramConfig.findUnique.mockResolvedValue({
        active: true,
        newCustomerDiscountPercent: 10,
      })
      mockedPrisma.customer.findFirst.mockResolvedValue({ id: 'cust_ref', name: 'Jose Pérez' })
      mockedPrisma.order.count.mockResolvedValue(0)
      const result = await validateReferralCode(ctx)
      expect(result).toMatchObject({
        valid: true,
        referrer: { id: 'cust_ref', name: 'Jose Pérez' },
        discountPercent: 10,
      })
    })
  })

  describe('captureReferral', () => {
    it('creates Referral with status PENDING and capturedBy', async () => {
      mockedPrisma.referralProgramConfig.findUnique.mockResolvedValue({
        active: true,
        newCustomerDiscountPercent: 10,
      })
      mockedPrisma.customer.findFirst.mockResolvedValue({ id: 'cust_ref', name: 'Jose' })
      mockedPrisma.order.count.mockResolvedValue(0)
      mockedPrisma.referral.create.mockResolvedValue({ id: 'ref_1', status: 'PENDING' })
      const result = await captureReferral({
        venueId: 'venue_1',
        referralCode: 'MINDFORM-JOSE2K7',
        newCustomerId: 'cust_new',
        capturedByStaffVenueId: 'sv_1',
        intendedOrderId: 'order_pending',
      })
      expect(mockedPrisma.referral.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          venueId: 'venue_1',
          referrerCustomerId: 'cust_ref',
          referredCustomerId: 'cust_new',
          status: 'PENDING',
          capturedByStaffVenueId: 'sv_1',
          qualifyingOrderId: 'order_pending',
        }),
      })
      expect(result).toMatchObject({ id: 'ref_1' })
    })

    it('throws when validation fails', async () => {
      mockedPrisma.referralProgramConfig.findUnique.mockResolvedValue({ active: false })
      await expect(
        captureReferral({
          venueId: 'venue_1',
          referralCode: 'X',
          newCustomerId: 'cust_new',
          capturedByStaffVenueId: 'sv_1',
        }),
      ).rejects.toThrow(/PROGRAM_INACTIVE/)
    })
  })
})
```

- [ ] **Step 2: Tests fallan**

```bash
npx jest tests/unit/services/referrals/referralCapture.service.test.ts
```

- [ ] **Step 3: Implementación**

Crear `src/services/referrals/referralCapture.service.ts`:

```ts
import { prisma } from '@/utils/prismaClient'
import { Referral } from '@prisma/client'

export type ValidationReason =
  | 'PROGRAM_INACTIVE'
  | 'CODE_NOT_FOUND'
  | 'SELF_REFERRAL'
  | 'EXISTING_CUSTOMER'

export interface ValidationResult {
  valid: boolean
  reason?: ValidationReason
  referrer?: { id: string; name: string | null }
  discountPercent?: number
}

export interface ValidateInput {
  venueId: string
  referralCode: string
  newCustomerId: string
}

export async function validateReferralCode(input: ValidateInput): Promise<ValidationResult> {
  const config = await prisma.referralProgramConfig.findUnique({
    where: { venueId: input.venueId },
    select: { active: true, newCustomerDiscountPercent: true },
  })
  if (!config || !config.active) {
    return { valid: false, reason: 'PROGRAM_INACTIVE' }
  }

  const referrer = await prisma.customer.findFirst({
    where: { venueId: input.venueId, referralCode: input.referralCode },
    select: { id: true, name: true },
  })
  if (!referrer) {
    return { valid: false, reason: 'CODE_NOT_FOUND' }
  }

  if (referrer.id === input.newCustomerId) {
    return { valid: false, reason: 'SELF_REFERRAL' }
  }

  const priorOrderCount = await prisma.order.count({
    where: { customerId: input.newCustomerId, venueId: input.venueId },
  })
  if (priorOrderCount > 0) {
    return { valid: false, reason: 'EXISTING_CUSTOMER' }
  }

  return {
    valid: true,
    referrer,
    discountPercent: Number(config.newCustomerDiscountPercent),
  }
}

export interface CaptureInput {
  venueId: string
  referralCode: string
  newCustomerId: string
  capturedByStaffVenueId: string
  intendedOrderId?: string
}

export async function captureReferral(input: CaptureInput): Promise<Referral> {
  const validation = await validateReferralCode({
    venueId: input.venueId,
    referralCode: input.referralCode,
    newCustomerId: input.newCustomerId,
  })
  if (!validation.valid) {
    throw new Error(validation.reason)
  }

  return prisma.referral.create({
    data: {
      venueId: input.venueId,
      referrerCustomerId: validation.referrer!.id,
      referredCustomerId: input.newCustomerId,
      status: 'PENDING',
      capturedByStaffVenueId: input.capturedByStaffVenueId,
      qualifyingOrderId: input.intendedOrderId,
    },
  })
}
```

- [ ] **Step 4: Tests pasan**

```bash
npx jest tests/unit/services/referrals/referralCapture.service.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/services/referrals/referralCapture.service.ts tests/unit/services/referrals/referralCapture.service.test.ts
git commit -m "feat(referrals): referralCapture.service — validate + capture"
```

---

### Task 11: Service `referralCapture` — applyDiscountToOrder, forceOverride, manualVoid

**Files:**
- Modify: `avoqado-server/src/services/referrals/referralCapture.service.ts`
- Modify: `avoqado-server/tests/unit/services/referrals/referralCapture.service.test.ts`

- [ ] **Step 1: Agregar tests**

Agregar al test file:

```ts
import {
  applyDiscountToOrder,
  forceOverrideReferral,
  manualVoidReferral,
} from '@/services/referrals/referralCapture.service'

// Extender el jest.mock para incluir discount + auditLog
jest.mock('@/utils/prismaClient', () => ({
  prisma: {
    referralProgramConfig: { findUnique: jest.fn() },
    customer: { findFirst: jest.fn(), findUnique: jest.fn() },
    referral: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    order: { count: jest.fn() },
    discount: { create: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}))

describe('applyDiscountToOrder', () => {
  it('creates a one-time Discount linked to the Order', async () => {
    mockedPrisma.discount.create.mockResolvedValue({ id: 'disc_1' })
    await applyDiscountToOrder({
      venueId: 'venue_1',
      orderId: 'order_1',
      discountPercent: 10,
      sourceReferralId: 'ref_1',
    })
    expect(mockedPrisma.discount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        venueId: 'venue_1',
        orderId: 'order_1',
        type: 'PERCENT',
        value: 10,
        source: 'REFERRAL_NEW_CUSTOMER',
        sourceReferralId: 'ref_1',
      }),
    })
  })
})

describe('forceOverrideReferral', () => {
  it('creates Referral with forcedOverride=true and audit log', async () => {
    mockedPrisma.customer.findFirst.mockResolvedValue({ id: 'cust_ref', name: 'Jose' })
    mockedPrisma.referral.create.mockResolvedValue({ id: 'ref_force', forcedOverride: true })
    await forceOverrideReferral({
      venueId: 'venue_1',
      referralCode: 'MINDFORM-JOSE2K7',
      existingCustomerId: 'cust_existing',
      capturedByStaffVenueId: 'sv_1',
      managerStaffVenueId: 'sv_manager',
      reason: 'Cliente histórica, no se le había mencionado',
    })
    expect(mockedPrisma.referral.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        forcedOverride: true,
        overrideReason: 'Cliente histórica, no se le había mencionado',
      }),
    })
    expect(mockedPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'REFERRAL_FORCE_OVERRIDE',
          metadata: expect.objectContaining({ reason: expect.any(String) }),
        }),
      }),
    )
  })
})

describe('manualVoidReferral', () => {
  it('sets status VOID, voidedAt, voidReason and audit log', async () => {
    mockedPrisma.referral.findUnique.mockResolvedValue({ id: 'ref_1', status: 'PENDING' })
    mockedPrisma.referral.update.mockResolvedValue({ id: 'ref_1', status: 'VOID' })
    await manualVoidReferral({ referralId: 'ref_1', reason: 'Fraude detectado', staffVenueId: 'sv_1' })
    expect(mockedPrisma.referral.update).toHaveBeenCalledWith({
      where: { id: 'ref_1' },
      data: expect.objectContaining({
        status: 'VOID',
        voidedAt: expect.any(Date),
        voidReason: 'Fraude detectado',
      }),
    })
    expect(mockedPrisma.auditLog.create).toHaveBeenCalled()
  })

  it('rejects when Referral is already QUALIFIED (use refund flow instead)', async () => {
    mockedPrisma.referral.findUnique.mockResolvedValue({ id: 'ref_1', status: 'QUALIFIED' })
    await expect(
      manualVoidReferral({ referralId: 'ref_1', reason: 'X', staffVenueId: 'sv_1' }),
    ).rejects.toThrow(/already qualified/i)
  })
})
```

- [ ] **Step 2: Tests fallan**

- [ ] **Step 3: Agregar implementaciones a `referralCapture.service.ts`**

```ts
export interface ApplyDiscountInput {
  venueId: string
  orderId: string
  discountPercent: number
  sourceReferralId: string
}

export async function applyDiscountToOrder(input: ApplyDiscountInput) {
  return prisma.discount.create({
    data: {
      venueId: input.venueId,
      orderId: input.orderId,
      type: 'PERCENT',
      value: input.discountPercent,
      source: 'REFERRAL_NEW_CUSTOMER',
      sourceReferralId: input.sourceReferralId,
    },
  })
}

export interface ForceOverrideInput {
  venueId: string
  referralCode: string
  existingCustomerId: string
  capturedByStaffVenueId: string
  managerStaffVenueId: string
  reason: string
}

export async function forceOverrideReferral(input: ForceOverrideInput): Promise<Referral> {
  const referrer = await prisma.customer.findFirst({
    where: { venueId: input.venueId, referralCode: input.referralCode },
    select: { id: true },
  })
  if (!referrer) throw new Error('CODE_NOT_FOUND')
  if (referrer.id === input.existingCustomerId) throw new Error('SELF_REFERRAL')

  const referral = await prisma.referral.create({
    data: {
      venueId: input.venueId,
      referrerCustomerId: referrer.id,
      referredCustomerId: input.existingCustomerId,
      status: 'PENDING',
      capturedByStaffVenueId: input.capturedByStaffVenueId,
      forcedOverride: true,
      overrideReason: input.reason,
    },
  })

  await prisma.auditLog.create({
    data: {
      venueId: input.venueId,
      action: 'REFERRAL_FORCE_OVERRIDE',
      metadata: {
        referralId: referral.id,
        reason: input.reason,
        managerStaffVenueId: input.managerStaffVenueId,
      },
    },
  })

  return referral
}

export interface ManualVoidInput {
  referralId: string
  reason: string
  staffVenueId: string
}

export async function manualVoidReferral(input: ManualVoidInput): Promise<Referral> {
  const existing = await prisma.referral.findUnique({ where: { id: input.referralId } })
  if (!existing) throw new Error('REFERRAL_NOT_FOUND')
  if (existing.status === 'QUALIFIED') {
    throw new Error('Referral already qualified — use refund flow instead')
  }

  const updated = await prisma.referral.update({
    where: { id: input.referralId },
    data: {
      status: 'VOID',
      voidedAt: new Date(),
      voidReason: input.reason,
    },
  })

  await prisma.auditLog.create({
    data: {
      venueId: existing.venueId,
      action: 'REFERRAL_MANUAL_VOID',
      metadata: {
        referralId: input.referralId,
        reason: input.reason,
        staffVenueId: input.staffVenueId,
      },
    },
  })

  return updated
}
```

- [ ] **Step 4: Tests pasan**

```bash
npx jest tests/unit/services/referrals/referralCapture.service.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/services/referrals/referralCapture.service.ts tests/unit/services/referrals/referralCapture.service.test.ts
git commit -m "feat(referrals): applyDiscount, forceOverride, manualVoid"
```

---

### Task 12: Service `referralQualification` — onOrderPaid + computeTier + emitTierCoupon

**Files:**
- Create: `avoqado-server/src/services/referrals/referralQualification.service.ts`
- Create: `avoqado-server/tests/unit/services/referrals/referralQualification.service.test.ts`

- [ ] **Step 1: Test file**

```ts
import {
  onOrderPaid,
  computeTier,
  emitTierCoupon,
} from '@/services/referrals/referralQualification.service'
import { prisma } from '@/utils/prismaClient'

jest.mock('@/utils/prismaClient', () => ({
  prisma: {
    referral: { findFirst: jest.fn(), update: jest.fn() },
    customer: { update: jest.fn() },
    referralProgramConfig: { findUnique: jest.fn() },
    coupon: { create: jest.fn() },
  },
}))

const mockedPrisma = prisma as any

describe('computeTier', () => {
  const config = {
    tier1ReferralsRequired: 7,
    tier2ReferralsRequired: 12,
    tier3ReferralsRequired: 20,
  }

  it('returns null when count below tier1', () => {
    expect(computeTier(0, config)).toBeNull()
    expect(computeTier(6, config)).toBeNull()
  })

  it('returns TIER_1 at exactly 7', () => {
    expect(computeTier(7, config)).toBe('TIER_1')
  })

  it('returns TIER_2 at 12', () => {
    expect(computeTier(12, config)).toBe('TIER_2')
  })

  it('returns TIER_3 at 20+', () => {
    expect(computeTier(20, config)).toBe('TIER_3')
    expect(computeTier(99, config)).toBe('TIER_3')
  })

  it('returns highest applicable tier when count skips levels', () => {
    expect(computeTier(15, config)).toBe('TIER_2') // between 12 and 20
  })
})

describe('emitTierCoupon', () => {
  it('creates Coupon with correct values for TIER_1', async () => {
    mockedPrisma.coupon.create.mockResolvedValue({ id: 'coup_1' })
    const config = {
      tier1RewardPercent: 15,
      tier2RewardPercent: 20,
      tier3RewardPercent: 25,
      rewardCouponExpiryDays: 90,
      codePrefix: 'MINDFORM',
    }
    await emitTierCoupon({
      venueId: 'venue_1',
      referrer: { id: 'cust_abc123', name: 'Jose' },
      tier: 'TIER_1',
      config: config as any,
    })
    expect(mockedPrisma.coupon.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        venueId: 'venue_1',
        code: expect.stringMatching(/^MINDFORM-TIER1-/),
        discountType: 'PERCENT',
        discountValue: 15,
        maxRedemptions: 1,
        customerId: 'cust_abc123',
        source: 'REFERRAL_TIER',
        active: true,
        expiresAt: expect.any(Date),
      }),
    })
  })
})

describe('onOrderPaid', () => {
  beforeEach(() => jest.clearAllMocks())

  it('does nothing when no Referral exists for this order', async () => {
    mockedPrisma.referral.findFirst.mockResolvedValue(null)
    await onOrderPaid({ orderId: 'o1', venueId: 'venue_1' })
    expect(mockedPrisma.referral.update).not.toHaveBeenCalled()
  })

  it('qualifies PENDING Referral, increments referrer count', async () => {
    mockedPrisma.referral.findFirst.mockResolvedValue({
      id: 'ref_1',
      status: 'PENDING',
      referrerCustomerId: 'cust_ref',
    })
    mockedPrisma.customer.update.mockResolvedValue({
      id: 'cust_ref',
      referralCount: 3,
      referralTier: null,
    })
    mockedPrisma.referralProgramConfig.findUnique.mockResolvedValue({
      tier1ReferralsRequired: 7,
      tier2ReferralsRequired: 12,
      tier3ReferralsRequired: 20,
    })
    await onOrderPaid({ orderId: 'o1', venueId: 'venue_1' })
    expect(mockedPrisma.referral.update).toHaveBeenCalledWith({
      where: { id: 'ref_1' },
      data: expect.objectContaining({ status: 'QUALIFIED', qualifiedAt: expect.any(Date) }),
    })
    expect(mockedPrisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'cust_ref' },
      data: { referralCount: { increment: 1 } },
    })
  })

  it('emits tier coupon when crossing threshold', async () => {
    mockedPrisma.referral.findFirst.mockResolvedValue({
      id: 'ref_1',
      status: 'PENDING',
      referrerCustomerId: 'cust_ref',
    })
    mockedPrisma.customer.update
      .mockResolvedValueOnce({ id: 'cust_ref', referralCount: 7, referralTier: null }) // first call: increment
      .mockResolvedValueOnce({ id: 'cust_ref', referralTier: 'TIER_1' }) // second call: set tier
    mockedPrisma.referralProgramConfig.findUnique.mockResolvedValue({
      tier1ReferralsRequired: 7,
      tier2ReferralsRequired: 12,
      tier3ReferralsRequired: 20,
      tier1RewardPercent: 15,
      tier2RewardPercent: 20,
      tier3RewardPercent: 25,
      rewardCouponExpiryDays: 90,
      codePrefix: 'MINDFORM',
    })
    mockedPrisma.coupon.create.mockResolvedValue({ id: 'coup_tier1' })
    await onOrderPaid({ orderId: 'o1', venueId: 'venue_1' })
    expect(mockedPrisma.coupon.create).toHaveBeenCalled()
    expect(mockedPrisma.customer.update).toHaveBeenCalledTimes(2)
  })

  it('does NOT emit coupon when count is below threshold', async () => {
    mockedPrisma.referral.findFirst.mockResolvedValue({
      id: 'ref_1',
      status: 'PENDING',
      referrerCustomerId: 'cust_ref',
    })
    mockedPrisma.customer.update.mockResolvedValue({
      id: 'cust_ref',
      referralCount: 6,
      referralTier: null,
    })
    mockedPrisma.referralProgramConfig.findUnique.mockResolvedValue({
      tier1ReferralsRequired: 7,
      tier2ReferralsRequired: 12,
      tier3ReferralsRequired: 20,
    })
    await onOrderPaid({ orderId: 'o1', venueId: 'venue_1' })
    expect(mockedPrisma.coupon.create).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Tests fallan**

- [ ] **Step 3: Implementación**

Crear `src/services/referrals/referralQualification.service.ts`:

```ts
import { prisma } from '@/utils/prismaClient'
import { ReferralTier, ReferralProgramConfig, Coupon } from '@prisma/client'

type TierConfig = Pick<
  ReferralProgramConfig,
  'tier1ReferralsRequired' | 'tier2ReferralsRequired' | 'tier3ReferralsRequired'
>

export function computeTier(count: number, config: TierConfig): ReferralTier | null {
  if (count >= config.tier3ReferralsRequired) return 'TIER_3'
  if (count >= config.tier2ReferralsRequired) return 'TIER_2'
  if (count >= config.tier1ReferralsRequired) return 'TIER_1'
  return null
}

export interface EmitTierCouponInput {
  venueId: string
  referrer: { id: string; name: string | null }
  tier: ReferralTier
  config: ReferralProgramConfig
}

export async function emitTierCoupon(input: EmitTierCouponInput): Promise<Coupon> {
  const percent = {
    TIER_1: input.config.tier1RewardPercent,
    TIER_2: input.config.tier2RewardPercent,
    TIER_3: input.config.tier3RewardPercent,
  }[input.tier]

  const prefix = input.config.codePrefix ?? 'VENUE'
  const tierNum = input.tier.split('_')[1]
  const customerShort = input.referrer.id.slice(-6).toUpperCase()
  const code = `${prefix}-TIER${tierNum}-${customerShort}`

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + input.config.rewardCouponExpiryDays)

  return prisma.coupon.create({
    data: {
      venueId: input.venueId,
      code,
      discountType: 'PERCENT',
      discountValue: percent,
      maxRedemptions: 1,
      customerId: input.referrer.id,
      source: 'REFERRAL_TIER',
      active: true,
      expiresAt,
    },
  })
}

export interface OnOrderPaidInput {
  orderId: string
  venueId: string
}

export async function onOrderPaid(input: OnOrderPaidInput): Promise<void> {
  const referral = await prisma.referral.findFirst({
    where: { qualifyingOrderId: input.orderId, status: 'PENDING' },
  })
  if (!referral) return

  await prisma.referral.update({
    where: { id: referral.id },
    data: { status: 'QUALIFIED', qualifiedAt: new Date() },
  })

  const referrer = await prisma.customer.update({
    where: { id: referral.referrerCustomerId },
    data: { referralCount: { increment: 1 } },
  })

  const config = await prisma.referralProgramConfig.findUnique({
    where: { venueId: input.venueId },
  })
  if (!config) return

  const newTier = computeTier(referrer.referralCount, config)
  if (newTier && newTier !== referrer.referralTier) {
    const coupon = await emitTierCoupon({
      venueId: input.venueId,
      referrer: { id: referrer.id, name: referrer.name },
      tier: newTier,
      config,
    })
    await prisma.customer.update({
      where: { id: referrer.id },
      data: {
        referralTier: newTier,
        tierUnlockedAt: new Date(),
        tierUpModalSeenAt: null,
      },
    })
    await prisma.referral.update({
      where: { id: referral.id },
      data: { rewardCouponId: coupon.id },
    })
  }
}
```

- [ ] **Step 4: Tests pasan**

```bash
npx jest tests/unit/services/referrals/referralQualification.service.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/services/referrals/referralQualification.service.ts tests/unit/services/referrals/referralQualification.service.test.ts
git commit -m "feat(referrals): referralQualification.service — onOrderPaid + computeTier + emitTierCoupon"
```

---

### Task 13: Service `referralRefund` — onOrderRefunded + tier reversal

**Files:**
- Create: `avoqado-server/src/services/referrals/referralRefund.service.ts`
- Create: `avoqado-server/tests/unit/services/referrals/referralRefund.service.test.ts`

- [ ] **Step 1: Test file**

```ts
import { onOrderRefunded } from '@/services/referrals/referralRefund.service'
import { prisma } from '@/utils/prismaClient'

jest.mock('@/utils/prismaClient', () => ({
  prisma: {
    referral: { findFirst: jest.fn(), update: jest.fn() },
    customer: { update: jest.fn() },
    referralProgramConfig: { findUnique: jest.fn() },
    coupon: { findUnique: jest.fn(), update: jest.fn() },
  },
}))

const mockedPrisma = prisma as any

describe('referralRefund.service — onOrderRefunded', () => {
  beforeEach(() => jest.clearAllMocks())

  it('does nothing when no Referral is QUALIFIED for this order', async () => {
    mockedPrisma.referral.findFirst.mockResolvedValue(null)
    await onOrderRefunded({ orderId: 'o1', venueId: 'v1' })
    expect(mockedPrisma.referral.update).not.toHaveBeenCalled()
  })

  it('marks Referral as VOID with ORDER_REFUNDED reason', async () => {
    mockedPrisma.referral.findFirst.mockResolvedValue({
      id: 'ref_1',
      status: 'QUALIFIED',
      referrerCustomerId: 'cust_ref',
      rewardCouponId: null,
    })
    mockedPrisma.customer.update.mockResolvedValue({
      id: 'cust_ref',
      referralCount: 6,
      referralTier: 'TIER_1',
    })
    mockedPrisma.referralProgramConfig.findUnique.mockResolvedValue({
      tier1ReferralsRequired: 7,
      tier2ReferralsRequired: 12,
      tier3ReferralsRequired: 20,
    })
    await onOrderRefunded({ orderId: 'o1', venueId: 'v1' })
    expect(mockedPrisma.referral.update).toHaveBeenCalledWith({
      where: { id: 'ref_1' },
      data: expect.objectContaining({
        status: 'VOID',
        voidedAt: expect.any(Date),
        voidReason: 'ORDER_REFUNDED',
      }),
    })
  })

  it('decrements referrer count', async () => {
    mockedPrisma.referral.findFirst.mockResolvedValue({
      id: 'ref_1',
      status: 'QUALIFIED',
      referrerCustomerId: 'cust_ref',
      rewardCouponId: null,
    })
    mockedPrisma.customer.update.mockResolvedValue({
      id: 'cust_ref',
      referralCount: 6,
      referralTier: 'TIER_1',
    })
    mockedPrisma.referralProgramConfig.findUnique.mockResolvedValue({
      tier1ReferralsRequired: 7,
      tier2ReferralsRequired: 12,
      tier3ReferralsRequired: 20,
    })
    await onOrderRefunded({ orderId: 'o1', venueId: 'v1' })
    expect(mockedPrisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'cust_ref' },
      data: { referralCount: { decrement: 1 } },
    })
  })

  it('revokes unredeemed coupon when tier drops', async () => {
    mockedPrisma.referral.findFirst.mockResolvedValue({
      id: 'ref_1',
      status: 'QUALIFIED',
      referrerCustomerId: 'cust_ref',
      rewardCouponId: 'coup_1',
    })
    mockedPrisma.customer.update.mockResolvedValue({
      id: 'cust_ref',
      referralCount: 6,
      referralTier: 'TIER_1',
    })
    mockedPrisma.referralProgramConfig.findUnique.mockResolvedValue({
      tier1ReferralsRequired: 7,
      tier2ReferralsRequired: 12,
      tier3ReferralsRequired: 20,
    })
    mockedPrisma.coupon.findUnique.mockResolvedValue({ id: 'coup_1', redeemedAt: null })
    await onOrderRefunded({ orderId: 'o1', venueId: 'v1' })
    expect(mockedPrisma.coupon.update).toHaveBeenCalledWith({
      where: { id: 'coup_1' },
      data: expect.objectContaining({
        active: false,
        deactivatedReason: 'TIER_REVERSED_BY_REFUND',
      }),
    })
  })

  it('preserves already-redeemed coupon (no clawback)', async () => {
    mockedPrisma.referral.findFirst.mockResolvedValue({
      id: 'ref_1',
      status: 'QUALIFIED',
      referrerCustomerId: 'cust_ref',
      rewardCouponId: 'coup_1',
    })
    mockedPrisma.customer.update.mockResolvedValue({
      id: 'cust_ref',
      referralCount: 6,
      referralTier: 'TIER_1',
    })
    mockedPrisma.referralProgramConfig.findUnique.mockResolvedValue({
      tier1ReferralsRequired: 7,
      tier2ReferralsRequired: 12,
      tier3ReferralsRequired: 20,
    })
    mockedPrisma.coupon.findUnique.mockResolvedValue({
      id: 'coup_1',
      redeemedAt: new Date(),
    })
    await onOrderRefunded({ orderId: 'o1', venueId: 'v1' })
    expect(mockedPrisma.coupon.update).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Tests fallan**

- [ ] **Step 3: Implementación**

Crear `src/services/referrals/referralRefund.service.ts`:

```ts
import { prisma } from '@/utils/prismaClient'
import { computeTier } from './referralQualification.service'

export interface OnOrderRefundedInput {
  orderId: string
  venueId: string
}

export async function onOrderRefunded(input: OnOrderRefundedInput): Promise<void> {
  const referral = await prisma.referral.findFirst({
    where: { qualifyingOrderId: input.orderId, status: 'QUALIFIED' },
  })
  if (!referral) return

  await prisma.referral.update({
    where: { id: referral.id },
    data: {
      status: 'VOID',
      voidedAt: new Date(),
      voidReason: 'ORDER_REFUNDED',
    },
  })

  const referrer = await prisma.customer.update({
    where: { id: referral.referrerCustomerId },
    data: { referralCount: { decrement: 1 } },
  })

  const config = await prisma.referralProgramConfig.findUnique({
    where: { venueId: input.venueId },
  })
  if (!config) return

  const newTier = computeTier(referrer.referralCount, config)
  if (newTier !== referrer.referralTier) {
    // Tier changed (likely dropped). Handle coupon revocation if applicable.
    if (referral.rewardCouponId) {
      const coupon = await prisma.coupon.findUnique({
        where: { id: referral.rewardCouponId },
      })
      if (coupon && !coupon.redeemedAt) {
        await prisma.coupon.update({
          where: { id: coupon.id },
          data: {
            active: false,
            deactivatedReason: 'TIER_REVERSED_BY_REFUND',
          },
        })
      }
      // If already redeemed: no clawback. Just leave the referral marked VOID.
    }
    await prisma.customer.update({
      where: { id: referrer.id },
      data: {
        referralTier: newTier,
        tierUnlockedAt: newTier ? referrer.tierUnlockedAt : null,
      },
    })
  }
}
```

- [ ] **Step 4: Tests pasan**

```bash
npx jest tests/unit/services/referrals/referralRefund.service.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/services/referrals/referralRefund.service.ts tests/unit/services/referrals/referralRefund.service.test.ts
git commit -m "feat(referrals): referralRefund.service — onOrderRefunded + tier reversal + coupon revoke"
```

---

## Phase C — Endpoints REST (Tasks 14-16)

> **Pattern**: Endpoints siguen el patrón de `avoqado-server/src/routes/dashboard/...`. Cada router es montado en el router principal de venue. Zod para validation. Permisos chequeados con middleware existente.

### Task 14: Router + endpoints de configuración

**Files:**
- Create: `avoqado-server/src/routes/dashboard/referrals.router.ts`
- Create: `avoqado-server/src/schemas/referrals.schemas.ts`
- Modify: `avoqado-server/src/routes/dashboard/index.ts` (registrar el router)

- [ ] **Step 1: Zod schemas**

Crear `src/schemas/referrals.schemas.ts`:

```ts
import { z } from 'zod'

export const activateReferralProgramSchema = z.object({
  newCustomerDiscountPercent: z.number().min(0).max(100),
  tier1ReferralsRequired: z.number().int().min(1),
  tier1RewardPercent: z.number().min(0).max(100),
  tier2ReferralsRequired: z.number().int().min(2),
  tier2RewardPercent: z.number().min(0).max(100),
  tier3ReferralsRequired: z.number().int().min(3),
  tier3RewardPercent: z.number().min(0).max(100),
  rewardCouponExpiryDays: z.number().int().min(1),
  codePrefix: z.string().min(1).max(8).optional(),
  welcomeMessageTemplate: z.string().optional(),
  tierUpMessageTemplate: z.string().optional(),
})

export const updateReferralConfigSchema = activateReferralProgramSchema.partial()

export const deactivateReferralProgramSchema = z.object({
  reason: z.string().min(1, 'Razón obligatoria'),
})
```

- [ ] **Step 2: Router**

Crear `src/routes/dashboard/referrals.router.ts`:

```ts
import { Router } from 'express'
import { z } from 'zod'
import { validateBody } from '@/middlewares/validation'
import { requirePermission } from '@/middlewares/permissions'
import { asyncHandler } from '@/utils/asyncHandler'
import * as program from '@/services/referrals/referralProgram.service'
import * as capture from '@/services/referrals/referralCapture.service'
import { prisma } from '@/utils/prismaClient'
import {
  activateReferralProgramSchema,
  updateReferralConfigSchema,
  deactivateReferralProgramSchema,
} from '@/schemas/referrals.schemas'

const router = Router({ mergeParams: true })

router.get(
  '/config',
  requirePermission('referral:read'),
  asyncHandler(async (req, res) => {
    const config = await prisma.referralProgramConfig.findUnique({
      where: { venueId: req.params.venueId },
    })
    res.json(config ?? { active: false })
  }),
)

router.post(
  '/activate',
  requirePermission('referral:configure'),
  validateBody(activateReferralProgramSchema),
  asyncHandler(async (req, res) => {
    await program.activateReferralProgram({
      venueId: req.params.venueId,
      ...req.body,
    })
    res.status(201).json({ ok: true })
  }),
)

router.patch(
  '/config',
  requirePermission('referral:configure'),
  validateBody(updateReferralConfigSchema),
  asyncHandler(async (req, res) => {
    await program.updateReferralConfig({
      venueId: req.params.venueId,
      patch: req.body,
    })
    res.json({ ok: true })
  }),
)

router.post(
  '/deactivate',
  requirePermission('referral:configure'),
  validateBody(deactivateReferralProgramSchema),
  asyncHandler(async (req, res) => {
    await program.deactivateReferralProgram({
      venueId: req.params.venueId,
      reason: req.body.reason,
    })
    res.json({ ok: true })
  }),
)

// More endpoints added in Tasks 15 and 16

export default router
```

- [ ] **Step 3: Registrar el router en el index**

Modificar `src/routes/dashboard/index.ts` para agregar:

```ts
import referralsRouter from './referrals.router'

// ... dentro del setup del router principal:
router.use('/venues/:venueId/referrals', referralsRouter)
```

(El path exacto del prefix puede variar — adaptar al pattern actual del archivo.)

- [ ] **Step 4: Verificar compila**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server
npm run build
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/schemas/referrals.schemas.ts src/routes/dashboard/referrals.router.ts src/routes/dashboard/index.ts
git commit -m "feat(referrals): config endpoints (activate, deactivate, get, update)"
```

---

### Task 15: Endpoints de captura

**Files:**
- Modify: `avoqado-server/src/routes/dashboard/referrals.router.ts`
- Modify: `avoqado-server/src/schemas/referrals.schemas.ts`

- [ ] **Step 1: Agregar schemas Zod**

Append a `src/schemas/referrals.schemas.ts`:

```ts
export const validateReferralCodeSchema = z.object({
  referralCode: z.string().min(3).max(64),
  newCustomerId: z.string().cuid(),
})

export const captureReferralSchema = validateReferralCodeSchema.extend({
  capturedByStaffVenueId: z.string().cuid(),
  intendedOrderId: z.string().cuid().optional(),
})

export const forceOverrideSchema = z.object({
  referralCode: z.string().min(3).max(64),
  existingCustomerId: z.string().cuid(),
  capturedByStaffVenueId: z.string().cuid(),
  reason: z.string().min(10, 'Razón mínimo 10 caracteres'),
})

export const manualVoidSchema = z.object({
  reason: z.string().min(1),
})
```

- [ ] **Step 2: Agregar endpoints al router**

Append a `src/routes/dashboard/referrals.router.ts` (antes del `export default`):

```ts
import {
  validateReferralCodeSchema,
  captureReferralSchema,
  forceOverrideSchema,
  manualVoidSchema,
} from '@/schemas/referrals.schemas'

router.post(
  '/validate',
  requirePermission('referral:read'),
  validateBody(validateReferralCodeSchema),
  asyncHandler(async (req, res) => {
    const result = await capture.validateReferralCode({
      venueId: req.params.venueId,
      ...req.body,
    })
    res.json(result)
  }),
)

router.post(
  '/capture',
  requirePermission('referral:read'),
  validateBody(captureReferralSchema),
  asyncHandler(async (req, res) => {
    const referral = await capture.captureReferral({
      venueId: req.params.venueId,
      ...req.body,
    })
    res.status(201).json(referral)
  }),
)

router.post(
  '/force-override',
  requirePermission('referral:override-existing-customer'),
  validateBody(forceOverrideSchema),
  asyncHandler(async (req, res) => {
    const referral = await capture.forceOverrideReferral({
      venueId: req.params.venueId,
      managerStaffVenueId: req.user!.staffVenueId, // adapter al middleware de auth
      ...req.body,
    })
    res.status(201).json(referral)
  }),
)

router.post(
  '/:referralId/manual-void',
  requirePermission('referral:void-manual'),
  validateBody(manualVoidSchema),
  asyncHandler(async (req, res) => {
    const updated = await capture.manualVoidReferral({
      referralId: req.params.referralId,
      reason: req.body.reason,
      staffVenueId: req.user!.staffVenueId,
    })
    res.json(updated)
  }),
)
```

> Nota al implementer: el campo `req.user.staffVenueId` debe matchear el shape del middleware de auth actual. Adaptar si difiere.

- [ ] **Step 3: Compila**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/schemas/referrals.schemas.ts src/routes/dashboard/referrals.router.ts
git commit -m "feat(referrals): capture endpoints (validate, capture, force-override, manual-void)"
```

---

### Task 16: Endpoints de reads + customer-scoped

**Files:**
- Modify: `avoqado-server/src/routes/dashboard/referrals.router.ts`
- Create: `avoqado-server/src/services/referrals/referralReads.service.ts`
- Create: `avoqado-server/src/services/referrals/referralCsvExport.service.ts`

- [ ] **Step 1: Service `referralReads`**

Crear `src/services/referrals/referralReads.service.ts`:

```ts
import { prisma } from '@/utils/prismaClient'
import { ReferralStatus, ReferralTier } from '@prisma/client'

export interface ListReferralsInput {
  venueId: string
  status?: ReferralStatus
  tier?: ReferralTier
  dateFrom?: Date
  dateTo?: Date
  page?: number
  pageSize?: number
}

export async function listReferrals(input: ListReferralsInput) {
  const page = input.page ?? 1
  const pageSize = input.pageSize ?? 25
  const where: any = { venueId: input.venueId }
  if (input.status) where.status = input.status
  if (input.dateFrom || input.dateTo) {
    where.createdAt = {}
    if (input.dateFrom) where.createdAt.gte = input.dateFrom
    if (input.dateTo) where.createdAt.lte = input.dateTo
  }
  if (input.tier) {
    where.referrerCustomer = { referralTier: input.tier }
  }
  const [items, total] = await Promise.all([
    prisma.referral.findMany({
      where,
      include: {
        referrerCustomer: { select: { id: true, name: true, referralTier: true } },
        referredCustomer: { select: { id: true, name: true } },
        rewardCoupon: { select: { id: true, code: true, discountValue: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.referral.count({ where }),
  ])
  return { items, total, page, pageSize }
}

export async function getReferralSummary(venueId: string) {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const startOfPrevMonth = new Date(startOfMonth)
  startOfPrevMonth.setMonth(startOfPrevMonth.getMonth() - 1)

  const [thisMonth, prevMonth, qualifiedThisMonth, pendingThisMonth, couponsEmittedThisMonth, topReferrer] = await Promise.all([
    prisma.referral.count({ where: { venueId, createdAt: { gte: startOfMonth } } }),
    prisma.referral.count({
      where: { venueId, createdAt: { gte: startOfPrevMonth, lt: startOfMonth } },
    }),
    prisma.referral.count({
      where: { venueId, status: 'QUALIFIED', qualifiedAt: { gte: startOfMonth } },
    }),
    prisma.referral.count({
      where: { venueId, status: 'PENDING', createdAt: { gte: startOfMonth } },
    }),
    prisma.coupon.count({
      where: { venueId, source: 'REFERRAL_TIER', createdAt: { gte: startOfMonth } },
    }),
    prisma.customer.findFirst({
      where: { venueId, referralCount: { gt: 0 } },
      orderBy: { referralCount: 'desc' },
      select: { id: true, name: true, referralCount: true, referralTier: true },
    }),
  ])

  return {
    referralsThisMonth: thisMonth,
    referralsPrevMonth: prevMonth,
    conversionRate: thisMonth > 0 ? qualifiedThisMonth / thisMonth : 0,
    qualifiedThisMonth,
    pendingThisMonth,
    couponsEmittedThisMonth,
    topReferrer,
  }
}

export async function getHallOfFame(venueId: string, limit: number = 10) {
  return prisma.customer.findMany({
    where: { venueId, referralCount: { gt: 0 } },
    orderBy: { referralCount: 'desc' },
    take: limit,
    select: {
      id: true,
      name: true,
      referralCount: true,
      referralTier: true,
      tierUnlockedAt: true,
    },
  })
}

export async function searchCustomers(venueId: string, query: string) {
  return prisma.customer.findMany({
    where: {
      venueId,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query } },
        { referralCode: { contains: query, mode: 'insensitive' } },
      ],
    },
    take: 10,
    select: { id: true, name: true, phone: true, referralCode: true, lastVisitAt: true },
  })
}

export async function getCustomerReferrals(customerId: string) {
  return prisma.referral.findMany({
    where: { referrerCustomerId: customerId },
    orderBy: { createdAt: 'desc' },
    include: {
      referredCustomer: { select: { id: true, name: true } },
      rewardCoupon: { select: { id: true, code: true, discountValue: true, expiresAt: true } },
    },
  })
}
```

- [ ] **Step 2: Service `referralCsvExport`**

Crear `src/services/referrals/referralCsvExport.service.ts`:

```ts
import { prisma } from '@/utils/prismaClient'
import { Response } from 'express'

export async function exportCustomersCsv(venueId: string, res: Response): Promise<void> {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="customers-referrals-${venueId}.csv"`)
  res.write('id,name,phone,email,referralCode,referralCount,referralTier\n')

  const batchSize = 500
  let skip = 0
  while (true) {
    const batch = await prisma.customer.findMany({
      where: { venueId, referralCode: { not: null } },
      take: batchSize,
      skip,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        referralCode: true,
        referralCount: true,
        referralTier: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    if (batch.length === 0) break
    for (const c of batch) {
      const row = [
        c.id,
        escapeCsv(c.name ?? ''),
        c.phone ?? '',
        c.email ?? '',
        c.referralCode ?? '',
        c.referralCount,
        c.referralTier ?? '',
      ].join(',')
      res.write(row + '\n')
    }
    if (batch.length < batchSize) break
    skip += batchSize
  }
  res.end()
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}
```

- [ ] **Step 3: Agregar endpoints al router**

Append a `referrals.router.ts`:

```ts
import * as reads from '@/services/referrals/referralReads.service'
import { exportCustomersCsv } from '@/services/referrals/referralCsvExport.service'

router.get(
  '/',
  requirePermission('referral:read'),
  asyncHandler(async (req, res) => {
    const { status, tier, dateFrom, dateTo, page, pageSize } = req.query
    const result = await reads.listReferrals({
      venueId: req.params.venueId,
      status: status as any,
      tier: tier as any,
      dateFrom: dateFrom ? new Date(String(dateFrom)) : undefined,
      dateTo: dateTo ? new Date(String(dateTo)) : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    })
    res.json(result)
  }),
)

router.get(
  '/summary',
  requirePermission('referral:read'),
  asyncHandler(async (req, res) => {
    const summary = await reads.getReferralSummary(req.params.venueId)
    res.json(summary)
  }),
)

router.get(
  '/hall-of-fame',
  requirePermission('referral:read'),
  asyncHandler(async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 10
    const list = await reads.getHallOfFame(req.params.venueId, limit)
    res.json(list)
  }),
)

router.get(
  '/customers/search',
  requirePermission('referral:read'),
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? '').trim()
    if (q.length < 2) return res.json([])
    const list = await reads.searchCustomers(req.params.venueId, q)
    res.json(list)
  }),
)

router.get(
  '/customers/:customerId/referrals',
  requirePermission('referral:read'),
  asyncHandler(async (req, res) => {
    const list = await reads.getCustomerReferrals(req.params.customerId)
    res.json(list)
  }),
)

router.get(
  '/export-csv',
  requirePermission('referral:export-csv'),
  asyncHandler(async (req, res) => {
    await exportCustomersCsv(req.params.venueId, res)
  }),
)

router.post(
  '/customers/:customerId/dismiss-tier-modal',
  requirePermission('referral:read'),
  asyncHandler(async (req, res) => {
    await prisma.customer.update({
      where: { id: req.params.customerId },
      data: { tierUpModalSeenAt: new Date() },
    })
    res.json({ ok: true })
  }),
)

router.post(
  '/customers/:customerId/generate-code',
  requirePermission('referral:read'),
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.customerId },
      select: { id: true, name: true, venueId: true, referralCode: true },
    })
    if (!customer || customer.referralCode) return res.json({ code: customer?.referralCode })
    const config = await prisma.referralProgramConfig.findUnique({
      where: { venueId: customer.venueId },
      select: { codePrefix: true },
    })
    const venue = await prisma.venue.findUnique({
      where: { id: customer.venueId },
      select: { slug: true },
    })
    const { generateReferralCode } = await import('@/services/referrals/referralCode.service')
    const code = await generateReferralCode({
      venueId: customer.venueId,
      venuePrefix: config?.codePrefix ?? venue?.slug ?? customer.venueId.slice(-8),
      customerName: customer.name,
    })
    await prisma.customer.update({
      where: { id: customer.id },
      data: { referralCode: code },
    })
    res.json({ code })
  }),
)
```

- [ ] **Step 4: Compila**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/services/referrals/referralReads.service.ts src/services/referrals/referralCsvExport.service.ts src/routes/dashboard/referrals.router.ts
git commit -m "feat(referrals): read endpoints (list, summary, hall-of-fame, search, customer detail, CSV export, dismiss modal, generate code)"
```

---

## Phase D — Hooks en services existentes (Tasks 17-19)

### Task 17: Hook `customerService.create` para auto-generar `referralCode`

**Files:**
- Modify: `avoqado-server/src/services/customer.service.ts` (o el archivo equivalente — buscar con grep)
- Create: `avoqado-server/tests/unit/services/customer.referralHook.test.ts`

- [ ] **Step 1: Identificar el service de creación de Customer**

```bash
grep -l "customer.create" src/services/*.ts src/services/**/*.ts | head -5
```

Localizar la función que crea Customers (probablemente `createCustomer` o similar).

- [ ] **Step 2: Test del hook**

Crear `tests/unit/services/customer.referralHook.test.ts`:

```ts
import { createCustomer } from '@/services/customer.service'
import { prisma } from '@/utils/prismaClient'
import { generateReferralCode } from '@/services/referrals/referralCode.service'

jest.mock('@/utils/prismaClient', () => ({
  prisma: {
    customer: { create: jest.fn() },
    referralProgramConfig: { findUnique: jest.fn() },
    venue: { findUnique: jest.fn() },
  },
}))
jest.mock('@/services/referrals/referralCode.service', () => ({
  generateReferralCode: jest.fn().mockResolvedValue('MINDFORM-JANE2K7'),
}))

const mockedPrisma = prisma as any

describe('createCustomer + referral hook', () => {
  beforeEach(() => jest.clearAllMocks())

  it('does NOT generate referralCode when program inactive', async () => {
    mockedPrisma.referralProgramConfig.findUnique.mockResolvedValue({ active: false })
    mockedPrisma.customer.create.mockResolvedValue({ id: 'c1', referralCode: null })
    await createCustomer({ venueId: 'v1', name: 'Jane' } as any)
    expect(generateReferralCode).not.toHaveBeenCalled()
    expect(mockedPrisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ referralCode: expect.anything() }),
      }),
    )
  })

  it('generates referralCode when program active', async () => {
    mockedPrisma.referralProgramConfig.findUnique.mockResolvedValue({
      active: true,
      codePrefix: 'MINDFORM',
    })
    mockedPrisma.venue.findUnique.mockResolvedValue({ slug: 'mindform' })
    mockedPrisma.customer.create.mockResolvedValue({ id: 'c1', referralCode: 'MINDFORM-JANE2K7' })
    await createCustomer({ venueId: 'v1', name: 'Jane' } as any)
    expect(generateReferralCode).toHaveBeenCalledWith({
      venueId: 'v1',
      venuePrefix: 'MINDFORM',
      customerName: 'Jane',
    })
  })
})
```

- [ ] **Step 3: Implementar el hook**

En el archivo donde está `createCustomer` (o equivalente), modificar para llamar al hook ANTES del `prisma.customer.create`:

```ts
import { generateReferralCode } from '@/services/referrals/referralCode.service'

export async function createCustomer(input: CreateCustomerInput) {
  // ... lógica existente ...

  // Referral hook: auto-generate code if program is active
  let referralCode: string | undefined
  const config = await prisma.referralProgramConfig.findUnique({
    where: { venueId: input.venueId },
    select: { active: true, codePrefix: true },
  })
  if (config?.active) {
    const venue = await prisma.venue.findUnique({
      where: { id: input.venueId },
      select: { slug: true },
    })
    referralCode = await generateReferralCode({
      venueId: input.venueId,
      venuePrefix: config.codePrefix ?? venue?.slug ?? input.venueId.slice(-8),
      customerName: input.name,
    })
  }

  return prisma.customer.create({
    data: {
      // ... campos existentes ...
      ...(referralCode ? { referralCode } : {}),
    },
  })
}
```

- [ ] **Step 4: Tests pasan**

```bash
npx jest tests/unit/services/customer.referralHook.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/services/customer.service.ts tests/unit/services/customer.referralHook.test.ts
git commit -m "feat(referrals): auto-generate referralCode on customer creation when program active"
```

---

### Task 18: Hook `orderService.markAsPaid` → `referralQualification.onOrderPaid`

**Files:**
- Modify: `avoqado-server/src/services/order.service.ts` (o equivalente)
- Create: `avoqado-server/tests/unit/services/order.referralHook.test.ts`

- [ ] **Step 1: Localizar la función**

```bash
grep -rn "status: 'PAID'\|status: 'PAID'\|markAsPaid" src/services/*.ts src/services/**/*.ts | head
```

Localizar el lugar donde una Order cambia su `paymentStatus` o `status` a `PAID`.

- [ ] **Step 2: Test**

Crear `tests/unit/services/order.referralHook.test.ts`:

```ts
import { markOrderAsPaid } from '@/services/order.service'
import { onOrderPaid } from '@/services/referrals/referralQualification.service'

jest.mock('@/services/referrals/referralQualification.service', () => ({
  onOrderPaid: jest.fn(),
}))

jest.mock('@/utils/prismaClient', () => ({
  prisma: {
    order: {
      update: jest.fn().mockResolvedValue({ id: 'o1', venueId: 'v1', status: 'PAID' }),
    },
  },
}))

describe('markOrderAsPaid + referral hook', () => {
  beforeEach(() => jest.clearAllMocks())

  it('calls onOrderPaid after Order is marked PAID', async () => {
    await markOrderAsPaid({ orderId: 'o1', venueId: 'v1' })
    expect(onOrderPaid).toHaveBeenCalledWith({ orderId: 'o1', venueId: 'v1' })
  })
})
```

- [ ] **Step 3: Modificar el service**

Donde Order pasa a PAID, agregar:

```ts
import { onOrderPaid } from '@/services/referrals/referralQualification.service'

// ... después de update PAID:
await onOrderPaid({ orderId: order.id, venueId: order.venueId })
```

> Idealmente envuelto en try/catch para no romper el flujo de pago si el hook falla:

```ts
try {
  await onOrderPaid({ orderId: order.id, venueId: order.venueId })
} catch (err) {
  logger.error('referral.onOrderPaid failed', { orderId: order.id, err })
}
```

- [ ] **Step 4: Tests**

```bash
npx jest tests/unit/services/order.referralHook.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/services/order.service.ts tests/unit/services/order.referralHook.test.ts
git commit -m "feat(referrals): hook onOrderPaid into order payment flow"
```

---

### Task 19: Hook `orderService.refund` → `referralRefund.onOrderRefunded`

**Files:**
- Modify: `avoqado-server/src/services/order.service.ts` (o equivalente — flujo de refund)
- Create: `avoqado-server/tests/unit/services/order.refundHook.test.ts`

- [ ] **Step 1: Localizar refund flow**

```bash
grep -rn "REFUNDED\|refundOrder\|refund(" src/services/*.ts src/services/**/*.ts | head
```

- [ ] **Step 2: Test**

```ts
import { refundOrder } from '@/services/order.service'
import { onOrderRefunded } from '@/services/referrals/referralRefund.service'

jest.mock('@/services/referrals/referralRefund.service', () => ({
  onOrderRefunded: jest.fn(),
}))
jest.mock('@/utils/prismaClient', () => ({
  prisma: {
    order: {
      update: jest.fn().mockResolvedValue({ id: 'o1', venueId: 'v1', status: 'REFUNDED' }),
    },
  },
}))

describe('refundOrder + referral hook', () => {
  it('calls onOrderRefunded after refund', async () => {
    await refundOrder({ orderId: 'o1', venueId: 'v1', reason: 'customer request' })
    expect(onOrderRefunded).toHaveBeenCalledWith({ orderId: 'o1', venueId: 'v1' })
  })
})
```

- [ ] **Step 3: Modificar el service**

```ts
import { onOrderRefunded } from '@/services/referrals/referralRefund.service'

// ... después de update REFUNDED:
try {
  await onOrderRefunded({ orderId: order.id, venueId: order.venueId })
} catch (err) {
  logger.error('referral.onOrderRefunded failed', { orderId: order.id, err })
}
```

- [ ] **Step 4: Tests**

```bash
npx jest tests/unit/services/order.refundHook.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/services/order.service.ts tests/unit/services/order.refundHook.test.ts
git commit -m "feat(referrals): hook onOrderRefunded into refund flow"
```

---

## Phase E — Permisos + Feature mapping (Tasks 20-21)

### Task 20: Registrar permisos en `src/lib/permissions.ts`

**Files:**
- Modify: `avoqado-server/src/lib/permissions.ts`

- [ ] **Step 1: Localizar el archivo y la estructura existente**

```bash
grep -n "menu:" src/lib/permissions.ts | head
```

Esto muestra el patrón usado (e.g., `'menu:read'`, `'menu:write'`).

- [ ] **Step 2: Agregar los 5 permisos nuevos**

Donde están definidos los permisos, agregar:

```ts
'referral:read',
'referral:configure',
'referral:override-existing-customer',
'referral:void-manual',
'referral:export-csv',
```

- [ ] **Step 3: Mapear al role hierarchy**

Donde están definidas las assignations por rol, agregar:

```ts
// VIEWER, HOST, WAITER, CASHIER → solo referral:read
const READ_ROLES = ['VIEWER', 'HOST', 'WAITER', 'CASHIER']
for (const role of READ_ROLES) {
  rolePermissions[role].push('referral:read')
}

// MANAGER → read + override
rolePermissions.MANAGER.push('referral:read', 'referral:override-existing-customer')

// ADMIN, OWNER → todos
const FULL_REFERRAL = [
  'referral:read',
  'referral:configure',
  'referral:override-existing-customer',
  'referral:void-manual',
  'referral:export-csv',
]
rolePermissions.ADMIN.push(...FULL_REFERRAL)
rolePermissions.OWNER.push(...FULL_REFERRAL)
// SUPERADMIN bypassa (existing logic)
```

> Adaptar al exact pattern del archivo. Si usa una estructura diferente (e.g., enum + array map), seguir esa convención.

- [ ] **Step 4: Compila + tests existentes pasan**

```bash
npm run build
npm test -- --testPathPattern=permissions
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/permissions.ts
git commit -m "feat(referrals): register 5 new permissions and map to role hierarchy"
```

---

### Task 21: White-label feature mapping

**Files:**
- Modify: `avoqado-server/src/services/access/access.service.ts`

- [ ] **Step 1: Localizar `PERMISSION_TO_FEATURE_MAP`**

```bash
grep -n "PERMISSION_TO_FEATURE_MAP" src/services/access/access.service.ts
```

- [ ] **Step 2: Agregar mapeo**

Agregar al map:

```ts
'referral:read': 'REFERRAL_PROGRAM',
'referral:configure': 'REFERRAL_PROGRAM',
'referral:override-existing-customer': 'REFERRAL_PROGRAM',
'referral:void-manual': 'REFERRAL_PROGRAM',
'referral:export-csv': 'REFERRAL_PROGRAM',
```

(Adaptar a la sintaxis exacta del map.)

- [ ] **Step 3: Compila**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/services/access/access.service.ts
git commit -m "feat(referrals): white-label feature mapping for REFERRAL_PROGRAM"
```

---

## Phase F — Integration tests + verification (Tasks 22-23)

### Task 22: Integration test end-to-end

**Files:**
- Create: `avoqado-server/tests/integration/referrals.integration.test.ts`

- [ ] **Step 1: Test cubre el flujo completo**

Crear `tests/integration/referrals.integration.test.ts`:

```ts
import { prisma } from '@/utils/prismaClient'
import { activateReferralProgram } from '@/services/referrals/referralProgram.service'
import { captureReferral } from '@/services/referrals/referralCapture.service'
import { onOrderPaid } from '@/services/referrals/referralQualification.service'
import { onOrderRefunded } from '@/services/referrals/referralRefund.service'

// Usa una DB de test real (test DB con migrations aplicadas)
// Setup pattern existente del repo: revisar otros archivos en tests/integration/

describe('Referral program — integration', () => {
  let venueId: string
  let referrerCustomerId: string
  let newCustomerId: string
  let staffVenueId: string

  beforeEach(async () => {
    // Limpiar DB de test (adaptar al pattern existente)
    await prisma.referral.deleteMany()
    await prisma.referralProgramConfig.deleteMany()
    await prisma.customer.deleteMany()
    await prisma.venue.deleteMany()

    const venue = await prisma.venue.create({
      data: { name: 'Test Mindform', slug: 'testmf' /* + campos requeridos */ } as any,
    })
    venueId = venue.id

    const referrer = await prisma.customer.create({
      data: { venueId, name: 'Jose Test', phone: '111', referralCode: 'TESTMF-JOSE2K7' } as any,
    })
    referrerCustomerId = referrer.id

    const newCustomer = await prisma.customer.create({
      data: { venueId, name: 'Maria Test', phone: '222' } as any,
    })
    newCustomerId = newCustomer.id

    // ... crear staff venue ficticio (adaptar al schema)
  })

  it('full flow: activate → capture → pay → tier-up at 7 referrals', async () => {
    await activateReferralProgram({
      venueId,
      newCustomerDiscountPercent: 10,
      tier1ReferralsRequired: 1, // For test: trigger tier-up after 1 referral
      tier1RewardPercent: 15,
      tier2ReferralsRequired: 2,
      tier2RewardPercent: 20,
      tier3ReferralsRequired: 3,
      tier3RewardPercent: 25,
      rewardCouponExpiryDays: 90,
      codePrefix: 'TESTMF',
    })

    // Crear Order pendiente
    const order = await prisma.order.create({
      data: { venueId, customerId: newCustomerId, status: 'PENDING' /* + campos */ } as any,
    })

    // Capturar referido
    await captureReferral({
      venueId,
      referralCode: 'TESTMF-JOSE2K7',
      newCustomerId,
      capturedByStaffVenueId: staffVenueId,
      intendedOrderId: order.id,
    })

    // Verificar Referral PENDING
    const pendingRef = await prisma.referral.findFirst({ where: { qualifyingOrderId: order.id } })
    expect(pendingRef?.status).toBe('PENDING')

    // Simular pago
    await onOrderPaid({ orderId: order.id, venueId })

    // Verificar Referral QUALIFIED
    const qualifiedRef = await prisma.referral.findFirst({ where: { id: pendingRef!.id } })
    expect(qualifiedRef?.status).toBe('QUALIFIED')
    expect(qualifiedRef?.rewardCouponId).toBeTruthy()

    // Verificar tier asignado al referidor
    const updatedReferrer = await prisma.customer.findUnique({ where: { id: referrerCustomerId } })
    expect(updatedReferrer?.referralCount).toBe(1)
    expect(updatedReferrer?.referralTier).toBe('TIER_1')

    // Verificar Coupon emitido
    const coupon = await prisma.coupon.findUnique({ where: { id: qualifiedRef!.rewardCouponId! } })
    expect(coupon?.discountValue).toBe(15)
    expect(coupon?.customerId).toBe(referrerCustomerId)
    expect(coupon?.active).toBe(true)
  })

  it('refund: void Referral, decrement count, revoke coupon if not redeemed', async () => {
    // Setup: replicar el setup del test anterior hasta tener Referral QUALIFIED y Coupon
    // ... (extraer a helper si se vuelve verboso)

    const order = await prisma.order.create({
      data: { venueId, customerId: newCustomerId, status: 'PAID' } as any,
    })
    const referral = await prisma.referral.create({
      data: {
        venueId,
        referrerCustomerId,
        referredCustomerId: newCustomerId,
        status: 'QUALIFIED',
        qualifyingOrderId: order.id,
        qualifiedAt: new Date(),
      },
    })
    const coupon = await prisma.coupon.create({
      data: {
        venueId,
        code: 'TESTMF-TIER1-XYZ',
        discountType: 'PERCENT',
        discountValue: 15,
        maxRedemptions: 1,
        customerId: referrerCustomerId,
        source: 'REFERRAL_TIER',
        active: true,
        expiresAt: new Date(Date.now() + 90 * 86400000),
      } as any,
    })
    await prisma.referral.update({
      where: { id: referral.id },
      data: { rewardCouponId: coupon.id },
    })
    await prisma.customer.update({
      where: { id: referrerCustomerId },
      data: { referralCount: 1, referralTier: 'TIER_1' },
    })

    // Activar config con tier1=1
    await activateReferralProgram({
      venueId,
      newCustomerDiscountPercent: 10,
      tier1ReferralsRequired: 1,
      tier1RewardPercent: 15,
      tier2ReferralsRequired: 2,
      tier2RewardPercent: 20,
      tier3ReferralsRequired: 3,
      tier3RewardPercent: 25,
      rewardCouponExpiryDays: 90,
    })

    // Refund
    await onOrderRefunded({ orderId: order.id, venueId })

    // Verificar
    const voidedRef = await prisma.referral.findUnique({ where: { id: referral.id } })
    expect(voidedRef?.status).toBe('VOID')
    expect(voidedRef?.voidReason).toBe('ORDER_REFUNDED')

    const updatedReferrer = await prisma.customer.findUnique({ where: { id: referrerCustomerId } })
    expect(updatedReferrer?.referralCount).toBe(0)
    expect(updatedReferrer?.referralTier).toBeNull()

    const updatedCoupon = await prisma.coupon.findUnique({ where: { id: coupon.id } })
    expect(updatedCoupon?.active).toBe(false)
    expect(updatedCoupon?.deactivatedReason).toBe('TIER_REVERSED_BY_REFUND')
  })
})
```

- [ ] **Step 2: Correr integration tests**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server
npm run test:integration  # o el comando que use el repo
```

Expected: ambos tests pasan.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/referrals.integration.test.ts
git commit -m "test(referrals): integration test for full lifecycle (capture → pay → tier-up → refund)"
```

---

### Task 23: Pre-deploy verification

**Files:** (no files, comandos de verificación)

- [ ] **Step 1: Build completo**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server
npm run build
```

Expected: 0 TypeScript errors.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: 0 errors o warnings nuevos.

- [ ] **Step 3: Todos los tests**

```bash
npm test
```

Expected: todo verde. Si tests pre-existentes fallan por las modificaciones a `customer.service.ts`, `order.service.ts`, o `permissions.ts`, arreglarlos (no skip).

- [ ] **Step 4: Verificar prisma client generado**

```bash
npx prisma generate
ls -la node_modules/.prisma/client/index.d.ts
```

Expected: archivo existe y contiene los tipos `Referral`, `ReferralProgramConfig`, `ReferralStatus`, `ReferralTier`.

- [ ] **Step 5: Smoke test manual de endpoints (con curl o Bruno/Postman)**

Levantar el server local:

```bash
npm run dev
```

Test que `GET /api/v1/dashboard/venues/:venueId/referrals/config` regresa 200 con `{ active: false }` para un venue sin config.

Test que `POST /api/v1/dashboard/venues/:venueId/referrals/activate` con body válido devuelve `201 { ok: true }` y posteriormente `GET /config` regresa el config con `active: true`.

- [ ] **Step 6: Commit final con tag de checkpoint**

```bash
git tag plan-1-backend-foundation-complete
git push origin <branch>  # NO MERGE A MAIN aún
```

(Tag local sin push si así lo pide el usuario.)

---

## Verificación final del Plan 1

- [ ] Schema: 3 modelos + 2 enums + 6 campos en Customer (+ campos faltantes en Coupon)
- [ ] Migration aplicada y types regenerados
- [ ] 7 services con cobertura TDD ≥80% en cada uno
- [ ] 5 grupos de endpoints REST funcionando
- [ ] 3 hooks en services existentes (Customer create, Order paid, Order refund)
- [ ] 5 permisos registrados + mapping de roles + white-label
- [ ] 2 integration tests E2E pasan
- [ ] Build + lint + test all green

**Cuando este plan esté ✅ end-to-end, levantar Plan 2 (Dashboard UI).**

---

## Plans subsiguientes (referencia rápida)

- **Plan 2 — Dashboard UI** (avoqado-web-dashboard): sub-página `Programa de Referidos`, CustomerDetail card, modal celebración estructural, hooks TanStack Query, services frontend, i18n keys, E2E Playwright.
- **Plan 3 — Card PNG + Email**: server-side render (satori + sharp), R2 storage, welcome + tier-up email templates, signature en transaccionales, animaciones del modal.
- **Plan 4 — WhatsApp** (condicional a infra existente): templates configurables, send service, cupón expiry reminder.
- **Plan 5 — TPV capture** (avoqado-tpv, cross-repo): UI Kotlin/Compose, búsqueda por nombre, manager override, deploy 3-5 días.
