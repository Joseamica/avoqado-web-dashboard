# Revenue-Share Fee Model — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ Política del proyecto — COMMITS:** NO commitear sin permiso explícito del usuario.
> Cada paso "Commit" significa: **stage los archivos y pídele OK al usuario antes de
> `git commit`**. Co-Authored-By permitido: `Claude Opus 4.6 (1M context)`.

**Goal:** Modelar el revenue-share configurable (provider↔Avoqado, agregador↔Avoqado)
por `MerchantAccount`, calcularlo en reportes, y retirar la entidad obsoleta
`ProviderAggregatorFee` — sin tocar el proceso de pago.

**Architecture:** Tabla nueva `MerchantRevenueShare` (aditiva, una fila por merchant) +
una función pura `computeRevenueSplit` que los reportes llaman. El cobro al venue
(`VenuePricingStructure`) y el costo (`ProviderCostStructure`) no se tocan — se leen.
El proceso de pago (`transactionCost.service`, SDKs, TPV) queda intacto.

**Tech Stack:** `avoqado-server` (Express + Prisma + PostgreSQL + Jest),
`avoqado-web-dashboard` (React + Vite + TanStack Query + Vitest).

**Spec:** `docs/superpowers/specs/2026-05-22-revenue-share-fee-model-design.md`

---

## Estructura de archivos

**Backend (`avoqado-server`):**
- Modificar: `prisma/schema.prisma` — modelo `MerchantRevenueShare` + back-relation.
- Crear: `prisma/migrations/<ts>_add_merchant_revenue_share/migration.sql` (generada).
- Crear: `src/services/payments/revenueShare.service.ts` — `computeRevenueSplit` (función pura).
- Crear: `tests/unit/services/payments/revenueShare.service.test.ts`.
- Crear: `src/schemas/dashboard/merchant-revenue-share.schema.ts` — Zod.
- Crear: `src/services/superadmin/merchantRevenueShare.service.ts` — CRUD.
- Crear: `src/controllers/superadmin/merchantRevenueShare.controller.ts`.
- Crear: `src/routes/superadmin/merchantRevenueShare.routes.ts`.
- Modificar: `src/routes/dashboard/superadmin.routes.ts` — montar la ruta nueva, quitar la vieja.
- Crear: `tests/integration/dashboard/merchant-revenue-share.test.ts`.
- Modificar: `src/jobs/venue-commission-settlement.job.ts` — usar `computeRevenueSplit`.
- Eliminar: `src/schemas/dashboard/provider-aggregator-fee.schema.ts`,
  `src/services/superadmin/providerAggregatorFee.service.ts`,
  `src/controllers/superadmin/providerAggregatorFee.controller.ts`,
  `src/routes/superadmin/providerAggregatorFee.routes.ts`.

**Frontend (`avoqado-web-dashboard`):**
- Crear: `src/services/merchantRevenueShare.service.ts` — API client.
- Modificar: `src/pages/Superadmin/Aggregators.tsx` — CRUD + revenue-share.
- Modificar: `src/pages/Superadmin/components/merchant-accounts/angelpay-wizard/AngelPayWizard.tsx`.
- Eliminar: `src/pages/Superadmin/components/ProviderAggregatorFeeSection.tsx`,
  `src/services/providerAggregatorFee.service.ts`.

---

## Phase A — Backend foundation

### Task A1: Modelo `MerchantRevenueShare` + migración

**Files:**
- Modify: `avoqado-server/prisma/schema.prisma`
- Create: migración Prisma (generada)

- [ ] **Step 1: Agregar el modelo al schema**

En `prisma/schema.prisma`, agregar después del modelo `ProviderCostStructure`:

```prisma
/// Revenue-share configurable por merchant. Aditivo: un merchant sin fila aquí
/// mantiene el comportamiento actual (toda la ganancia a Avoqado).
model MerchantRevenueShare {
  id                String          @id @default(cuid())
  merchantAccountId String          @unique
  merchantAccount   MerchantAccount @relation(fields: [merchantAccountId], references: [id], onDelete: Cascade)

  /// Precio que Avoqado le cobra al agregador, por tarjeta
  /// {DEBIT,CREDIT,AMEX,INTERNATIONAL}. null = venta DIRECTA (sin agregador).
  aggregatorPrice            Json?
  aggregatorPriceIncludesTax Boolean  @default(false)

  /// Fracción 0..1 del margen procesador→Avoqado que se queda Avoqado.
  avoqadoShareOfProviderMargin   Decimal  @default(0.50) @db.Decimal(5, 4)
  /// Fracción 0..1 del margen agregador→venue que se queda Avoqado. null si directo.
  avoqadoShareOfAggregatorMargin Decimal? @db.Decimal(5, 4)

  taxRate   Decimal  @default(0.16) @db.Decimal(5, 4)
  active    Boolean  @default(true)
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

En el modelo `MerchantAccount`, agregar la back-relation (junto a las otras relaciones):

```prisma
  merchantRevenueShare MerchantRevenueShare?
```

- [ ] **Step 2: Generar la migración**

Run: `cd avoqado-server && npx prisma migrate dev --name add_merchant_revenue_share`
Expected: migración creada y aplicada a la BD local; `MerchantRevenueShare` existe.

- [ ] **Step 3: Verificar el cliente Prisma**

Run: `cd avoqado-server && npx prisma generate && npx tsc --noEmit`
Expected: 0 errores; `prisma.merchantRevenueShare` disponible.

- [ ] **Step 4: Commit** (stage + pedir OK al usuario)

```bash
git add prisma/schema.prisma prisma/migrations
# pedir OK, luego:
git commit -m "feat: add MerchantRevenueShare model"
```

---

### Task A2: Función pura `computeRevenueSplit` (TDD)

**Files:**
- Create: `avoqado-server/src/services/payments/revenueShare.service.ts`
- Test: `avoqado-server/tests/unit/services/payments/revenueShare.service.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/unit/services/payments/revenueShare.service.test.ts`:

```ts
import { computeRevenueSplit, type RevenueSplitInput } from '@/services/payments/revenueShare.service'

const base: Omit<RevenueSplitInput, 'share'> = {
  amount: 100,
  cardType: 'CREDIT',
  providerCostRate: 0.02,
  providerCostIncludesTax: false,
  venueChargeRate: 0.05,
  venueChargeIncludesTax: false,
}

describe('computeRevenueSplit', () => {
  it('sin share → toda la ganancia a Avoqado (comportamiento actual)', () => {
    const r = computeRevenueSplit({ ...base, share: null })
    expect(r.providerNet).toBeCloseTo(2)
    expect(r.avoqadoNet).toBeCloseTo(3)
    expect(r.aggregatorNet).toBe(0)
  })

  it('directo: margen partido por avoqadoShareOfProviderMargin', () => {
    const r = computeRevenueSplit({
      ...base,
      share: {
        aggregatorPrice: null,
        aggregatorPriceIncludesTax: false,
        avoqadoShareOfProviderMargin: 0.5,
        avoqadoShareOfAggregatorMargin: null,
        taxRate: 0.16,
      },
    })
    // margen = 5 - 2 = 3 ; Avoqado 50% = 1.5 ; provider = 2 + 1.5 = 3.5
    expect(r.providerNet).toBeCloseTo(3.5)
    expect(r.avoqadoNet).toBeCloseTo(1.5)
    expect(r.aggregatorNet).toBe(0)
    expect(r.providerNet + r.avoqadoNet + r.aggregatorNet).toBeCloseTo(5)
  })

  it('con agregador: 2 márgenes, 2 splits', () => {
    const r = computeRevenueSplit({
      ...base,
      venueChargeRate: 0.07,
      share: {
        aggregatorPrice: { DEBIT: 0.04, CREDIT: 0.04, AMEX: 0.04, INTERNATIONAL: 0.04 },
        aggregatorPriceIncludesTax: false,
        avoqadoShareOfProviderMargin: 0.5,
        avoqadoShareOfAggregatorMargin: 0.5,
        taxRate: 0.16,
      },
    })
    // M1 = 4-2 = 2 → Avoqado 1, provider 1 ; M2 = 7-4 = 3 → Avoqado 1.5, agg 1.5
    expect(r.providerNet).toBeCloseTo(3)
    expect(r.avoqadoNet).toBeCloseTo(2.5)
    expect(r.aggregatorNet).toBeCloseTo(1.5)
    expect(r.providerNet + r.avoqadoNet + r.aggregatorNet).toBeCloseTo(7)
  })

  it('share 0-100: Avoqado se queda 0 del margen agregador', () => {
    const r = computeRevenueSplit({
      ...base,
      venueChargeRate: 0.07,
      share: {
        aggregatorPrice: { DEBIT: 0.04, CREDIT: 0.04, AMEX: 0.04, INTERNATIONAL: 0.04 },
        aggregatorPriceIncludesTax: false,
        avoqadoShareOfProviderMargin: 0.5,
        avoqadoShareOfAggregatorMargin: 0,
        taxRate: 0.16,
      },
    })
    expect(r.aggregatorNet).toBeCloseTo(3) // todo el M2
    expect(r.avoqadoNet).toBeCloseTo(1)    // solo su parte del M1
  })

  it('IVA: tasa "+ IVA" (includesTax=false) calcula IVA por capa', () => {
    const r = computeRevenueSplit({ ...base, share: null })
    // venueCharge pre-IVA = 5 ; IVA venue = 5 * 0.16 = 0.80
    expect(r.ivaByLayer.venue).toBeCloseTo(0.8)
  })
})
```

- [ ] **Step 2: Correr el test y verque falla**

Run: `cd avoqado-server && npx jest tests/unit/services/payments/revenueShare.service.test.ts`
Expected: FAIL — "Cannot find module '@/services/payments/revenueShare.service'".

- [ ] **Step 3: Implementar la función**

Crear `src/services/payments/revenueShare.service.ts`:

```ts
/**
 * Revenue-share: reparte el fee de una transacción entre provider, agregador y
 * Avoqado. Función PURA — no I/O. La llaman los reportes/liquidación, NUNCA el
 * proceso de pago. Spec: docs/superpowers/specs/2026-05-22-revenue-share-fee-model-design.md
 */
export type CardType = 'DEBIT' | 'CREDIT' | 'AMEX' | 'INTERNATIONAL'

export interface MerchantRevenueShareConfig {
  aggregatorPrice: Record<CardType, number> | null
  aggregatorPriceIncludesTax: boolean
  avoqadoShareOfProviderMargin: number
  avoqadoShareOfAggregatorMargin: number | null
  taxRate: number
}

export interface RevenueSplitInput {
  amount: number
  cardType: CardType
  providerCostRate: number
  providerCostIncludesTax: boolean
  venueChargeRate: number
  venueChargeIncludesTax: boolean
  share: MerchantRevenueShareConfig | null
}

export interface RevenueSplit {
  providerNet: number
  avoqadoNet: number
  aggregatorNet: number
  ivaByLayer: { provider: number; aggregator: number; venue: number }
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Devuelve el fee pre-IVA dado un fee que puede o no incluir IVA. */
const preIva = (fee: number, includesTax: boolean, taxRate: number) =>
  includesTax ? fee / (1 + taxRate) : fee

export function computeRevenueSplit(input: RevenueSplitInput): RevenueSplit {
  const { amount, cardType, providerCostRate, venueChargeRate, share } = input
  const taxRate = share?.taxRate ?? 0.16

  const providerCost = round2(
    preIva(amount * providerCostRate, input.providerCostIncludesTax, taxRate),
  )
  const venueCharge = round2(
    preIva(amount * venueChargeRate, input.venueChargeIncludesTax, taxRate),
  )

  let providerNet: number
  let avoqadoNet: number
  let aggregatorNet = 0
  let aggregatorPrice = 0

  if (!share) {
    // Comportamiento actual: toda la ganancia a Avoqado.
    providerNet = providerCost
    avoqadoNet = round2(venueCharge - providerCost)
  } else if (!share.aggregatorPrice) {
    // Directo: 1 margen, split provider↔Avoqado.
    const margin = venueCharge - providerCost
    avoqadoNet = round2(margin * share.avoqadoShareOfProviderMargin)
    providerNet = round2(venueCharge - avoqadoNet)
  } else {
    // Con agregador: 2 márgenes.
    aggregatorPrice = round2(
      preIva(amount * share.aggregatorPrice[cardType], share.aggregatorPriceIncludesTax, taxRate),
    )
    const m1 = aggregatorPrice - providerCost
    const m2 = venueCharge - aggregatorPrice
    const aggShare = share.avoqadoShareOfAggregatorMargin ?? 0
    const avoFromM1 = round2(m1 * share.avoqadoShareOfProviderMargin)
    const avoFromM2 = round2(m2 * aggShare)
    avoqadoNet = round2(avoFromM1 + avoFromM2)
    providerNet = round2(providerCost + (m1 - avoFromM1))
    aggregatorNet = round2(m2 - avoFromM2)
  }

  const iva = (fee: number, includesTax: boolean) =>
    includesTax ? 0 : round2(fee * taxRate)

  return {
    providerNet,
    avoqadoNet,
    aggregatorNet,
    ivaByLayer: {
      provider: iva(providerCost, input.providerCostIncludesTax),
      aggregator: share?.aggregatorPrice
        ? iva(aggregatorPrice, share.aggregatorPriceIncludesTax)
        : 0,
      venue: iva(venueCharge, input.venueChargeIncludesTax),
    },
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd avoqado-server && npx jest tests/unit/services/payments/revenueShare.service.test.ts`
Expected: PASS — 5/5.

- [ ] **Step 5: Commit** (stage + pedir OK)

```bash
git add src/services/payments/revenueShare.service.ts tests/unit/services/payments/revenueShare.service.test.ts
git commit -m "feat: add computeRevenueSplit pure function"
```

---

## Phase B — Backend CRUD + API

### Task B1: Zod schema

**Files:** Create `avoqado-server/src/schemas/dashboard/merchant-revenue-share.schema.ts`

- [ ] **Step 1: Crear el schema** — espejo de `provider-aggregator-fee.schema.ts` (mismo patrón de validación), con estos campos. Mensajes de error en **español** (regla del proyecto):

```ts
import { z } from 'zod'

const cardRates = z.object({
  DEBIT: z.number().min(0).max(1),
  CREDIT: z.number().min(0).max(1),
  AMEX: z.number().min(0).max(1),
  INTERNATIONAL: z.number().min(0).max(1),
})

export const createMerchantRevenueShareSchema = z.object({
  body: z.object({
    merchantAccountId: z.string().min(1, 'El merchant es obligatorio'),
    aggregatorPrice: cardRates.nullable().optional(),
    aggregatorPriceIncludesTax: z.boolean().default(false),
    avoqadoShareOfProviderMargin: z.number().min(0).max(1).default(0.5),
    avoqadoShareOfAggregatorMargin: z.number().min(0).max(1).nullable().optional(),
    taxRate: z.number().min(0).max(1).default(0.16),
    notes: z.string().optional(),
  }),
})

export const updateMerchantRevenueShareSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: createMerchantRevenueShareSchema.shape.body.partial().omit({ merchantAccountId: true }),
})
```

- [ ] **Step 2: Verificar build** — Run: `cd avoqado-server && npx tsc --noEmit` → 0 errores.
- [ ] **Step 3: Commit** (stage + pedir OK) — `git commit -m "feat: add merchant-revenue-share Zod schema"`

---

### Task B2: CRUD service

**Files:** Create `avoqado-server/src/services/superadmin/merchantRevenueShare.service.ts`

- [ ] **Step 1: Crear el service** — espejo estructural de `providerAggregatorFee.service.ts`
  (que se va a retirar, pero su forma de CRUD es el patrón a seguir). Funciones:

```ts
import prisma from '@/utils/prismaClient'
import { ConflictError, NotFoundError } from '@/errors/AppError'

export async function createMerchantRevenueShare(data: {
  merchantAccountId: string
  aggregatorPrice?: Record<string, number> | null
  aggregatorPriceIncludesTax?: boolean
  avoqadoShareOfProviderMargin?: number
  avoqadoShareOfAggregatorMargin?: number | null
  taxRate?: number
  notes?: string
}) {
  const existing = await prisma.merchantRevenueShare.findUnique({
    where: { merchantAccountId: data.merchantAccountId },
  })
  if (existing) throw new ConflictError('Este merchant ya tiene un revenue-share configurado')
  return prisma.merchantRevenueShare.create({ data })
}

export async function getMerchantRevenueShareByMerchant(merchantAccountId: string) {
  return prisma.merchantRevenueShare.findUnique({ where: { merchantAccountId } })
}

export async function updateMerchantRevenueShare(id: string, data: Record<string, unknown>) {
  const existing = await prisma.merchantRevenueShare.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError('Revenue-share no encontrado')
  return prisma.merchantRevenueShare.update({ where: { id }, data })
}

export async function deleteMerchantRevenueShare(id: string) {
  const existing = await prisma.merchantRevenueShare.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError('Revenue-share no encontrado')
  return prisma.merchantRevenueShare.delete({ where: { id } })
}

export async function listMerchantRevenueShares() {
  return prisma.merchantRevenueShare.findMany({ orderBy: { createdAt: 'desc' } })
}
```

- [ ] **Step 2: Verificar build** — `npx tsc --noEmit` → 0 errores.
- [ ] **Step 3: Commit** (stage + pedir OK) — `git commit -m "feat: add merchantRevenueShare CRUD service"`

---

### Task B3: Controller + routes

**Files:**
- Create: `avoqado-server/src/controllers/superadmin/merchantRevenueShare.controller.ts`
- Create: `avoqado-server/src/routes/superadmin/merchantRevenueShare.routes.ts`
- Modify: `avoqado-server/src/routes/dashboard/superadmin.routes.ts`

- [ ] **Step 1: Controller** — espejo de `providerAggregatorFee.controller.ts`: handlers
  `create`, `getByMerchant`, `update`, `delete`, `list`, cada uno `try/catch` con `next(error)`,
  llamando al service de B2.

- [ ] **Step 2: Routes** — espejo de `providerAggregatorFee.routes.ts`. Base path
  `/api/v1/dashboard/superadmin/merchant-revenue-shares`. `validateRequest` con los schemas de B1.

- [ ] **Step 3: Montar la ruta** — en `src/routes/dashboard/superadmin.routes.ts`, junto a
  las otras: `router.use('/merchant-revenue-shares', merchantRevenueShareRoutes)` con su import.

- [ ] **Step 4: Verificar build** — `npx tsc --noEmit` → 0 errores.
- [ ] **Step 5: Commit** (stage + pedir OK) — `git commit -m "feat: add merchant-revenue-share API routes"`

---

### Task B4: Integration test

**Files:** Create `avoqado-server/tests/integration/dashboard/merchant-revenue-share.test.ts`

- [ ] **Step 1: Escribir el test** — espejo de `tests/integration/dashboard/provider-aggregator-fee.test.ts`
  (CRUD contra BD real): crear merchant de prueba, crear revenue-share, rechazar duplicado,
  get-by-merchant, update, delete. Cleanup en `afterAll`.

- [ ] **Step 2: Correr** — Run: `cd avoqado-server && npm run test:integration -- merchant-revenue-share`
  Expected: PASS (todos).

- [ ] **Step 3: Commit** (stage + pedir OK) — `git commit -m "test: merchant-revenue-share integration"`

---

## Phase C — Frontend config UI

### Task C1: API client

**Files:** Create `avoqado-web-dashboard/src/services/merchantRevenueShare.service.ts`

- [ ] **Step 1: Crear el client** — espejo de `src/services/providerAggregatorFee.service.ts`.
  Tipo `MerchantRevenueShare`, `merchantRevenueShareAPI` con `getByMerchant`, `create`,
  `update`, `delete`, `list`. Base `/api/v1/dashboard/superadmin/merchant-revenue-shares`.

- [ ] **Step 2: Build** — Run: `cd avoqado-web-dashboard && npm run build` → pasa.
- [ ] **Step 3: Commit** (stage + pedir OK) — `git commit -m "feat: add merchantRevenueShare API client"`

---

### Task C2: Aggregators page — CRUD + revenue-share visible

**Files:** Modify `avoqado-web-dashboard/src/pages/Superadmin/Aggregators.tsx`

- [ ] **Step 1: Agregar botón Eliminar** al `Aggregator` card (junto a editar/toggle):
  `AlertDialog` de confirmación → `aggregatorAPI.delete(agg.id)` (verificar que el endpoint
  existe en `aggregator.service.ts`; si no, agregarlo — DELETE `/aggregators/:id`).

- [ ] **Step 2: La tarjeta del agregador** ya muestra las tarifas por proveedor (hecho en
  sesión previa). Confirmar que sigue correcto tras retirar `ProviderAggregatorFee` en Phase E
  — la tarjeta pasará a leer de `MerchantRevenueShare` agregado por agregador, o se simplifica
  a "nombre + IVA + # merchants". Decisión concreta: mostrar nombre + IVA + conteo de merchants.

- [ ] **Step 3: Build + lint** — `npm run build && npm run lint` → pasan.
- [ ] **Step 4: Commit** (stage + pedir OK) — `git commit -m "feat: aggregator delete + card cleanup"`

---

### Task C3: Wizard — crear agregador inline + capturar revenue-share

**Files:** Modify `.../angelpay-wizard/AngelPayWizard.tsx`; crear diálogo inline si hace falta.

- [ ] **Step 1: Dropdown de agregador con "+ Crear agregador"** — en el paso de costo del
  wizard, el `Select` de agregador gana una opción "+ Crear nuevo" que abre un diálogo rápido
  (nombre + IVA) → `aggregatorAPI.create(...)` → al volver, queda seleccionado.

- [ ] **Step 2: Capturar revenue-share** — en el mismo paso (o uno nuevo "Revenue-share"):
  campos `aggregatorPrice` (por tarjeta, solo si hay agregador), `avoqadoShareOfProviderMargin`
  (prellenado 50%), `avoqadoShareOfAggregatorMargin`. Usar `PercentField` (ya existe).

- [ ] **Step 3: Submit** — al confirmar el wizard, además de lo de hoy, llamar
  `merchantRevenueShareAPI.create({ merchantAccountId, ... })` para el merchant recién creado.
  (El backend `fullSetupAngelPayMerchant` puede recibir el bloque y crearlo en su transacción —
  preferido — o un POST aparte tras la creación.)

- [ ] **Step 4: Build + lint + E2E** — `npm run build && npm run lint && npm run test:e2e` → pasan.
- [ ] **Step 5: Commit** (stage + pedir OK) — `git commit -m "feat: wizard inline aggregator + revenue-share"`

---

## Phase D — Wire calc into reports + recapturar venues

### Task D1: Reemplazar el 70/30 hardcodeado

**Files:** Modify `avoqado-server/src/jobs/venue-commission-settlement.job.ts`

- [ ] **Step 1: Test** — agregar un test que verifique que el reporte de un merchant con
  `MerchantRevenueShare` usa `computeRevenueSplit` (no `SPLIT_RATIOS`).

- [ ] **Step 2: Implementar** — en `calculateVenueCommissions`, reemplazar el bloque
  `SPLIT_RATIOS[referredBy]` por: leer el `MerchantRevenueShare` del merchant y llamar
  `computeRevenueSplit`. Quitar la constante `SPLIT_RATIOS`.

- [ ] **Step 3: Correr** — `npm run test:unit -- venue-commission` → pasa.
- [ ] **Step 4: Commit** (stage + pedir OK) — `git commit -m "refactor: settlement uses computeRevenueSplit"`

### Task D2: Recapturar los 2 venues con agregador

- [ ] **Step 1:** Identificar (SELECT) los 2 venues con `VenueCommission` y sus merchants.
- [ ] **Step 2:** Por cada uno, crear su `MerchantRevenueShare` vía la UICRUD nueva (o un
  script `scripts/temp-recapture-aggregator-venues.ts`, borrado tras correr) que codifique su
  70/30 actual → `avoqadoShareOfAggregatorMargin = 0.30` o `0.70` según `referredBy`.
- [ ] **Step 3:** Verificar (SELECT) que el reporte da los mismos números que antes.

### Task D3: Vista del reparto en superadmin (aditiva)

- [ ] **Step 1:** Componente nuevo que muestra, por venue/merchant, el reparto
  Avoqado / agregador / provider — leyendo el cálculo. Aditivo, no toca nada existente.
- [ ] **Step 2: Build + lint** → pasan. **Commit** (stage + pedir OK).

---

## Phase E — Cleanup: retirar `ProviderAggregatorFee`

### Task E1: Frontend

**Files:** Delete `ProviderAggregatorFeeSection.tsx`, `services/providerAggregatorFee.service.ts`;
modify `Aggregators.tsx` (quitar el `<ProviderAggregatorFeeSection />` y su import).

- [ ] **Step 1:** Borrar los archivos y la referencia. **Step 2:** `npm run build && npm run lint`
  → pasan (sin imports rotos). **Step 3: Commit** (stage + pedir OK).

### Task E2: Backend

**Files:** Delete `provider-aggregator-fee.schema.ts`, `providerAggregatorFee.service.ts`,
`providerAggregatorFee.controller.ts`, `providerAggregatorFee.routes.ts`; modify
`superadmin.routes.ts` (quitar import + `router.use('/provider-aggregator-fees', ...)`).

- [ ] **Step 1:** Borrar archivos + referencia. **Step 2:** `npx tsc --noEmit` → 0 errores.
  **Step 3: Commit** (stage + pedir OK).

### Task E3: Drop de la tabla

**Files:** Modify `prisma/schema.prisma` (quitar modelo `ProviderAggregatorFee` + back-relations
en `PaymentProvider` y `Aggregator`).

- [ ] **Step 1:** Quitar el modelo y sus back-relations del schema.
- [ ] **Step 2:** `npx prisma migrate dev --name drop_provider_aggregator_fee` → migración `drop`.
- [ ] **Step 3:** `npx prisma generate && npx tsc --noEmit` → 0 errores.
- [ ] **Step 4: Commit** (stage + pedir OK) — `git commit -m "chore: drop ProviderAggregatorFee"`

---

## Verificación final (regresión)

- [ ] `avoqado-server`: `npm run test:unit` + `npm run test:integration` → verde.
- [ ] `avoqado-web-dashboard`: `npm run build` + `npm run lint` + `npm run test:e2e` → verde.
- [ ] **Regresión crítica:** confirmar (SELECT en local) que available-balance y sales-summary
  de un venue de prueba dan **los mismos números** que antes — el proceso de pago intacto.
- [ ] Probar en browser: wizard con crear-agregador inline; CRUD de `/superadmin/aggregators`.
