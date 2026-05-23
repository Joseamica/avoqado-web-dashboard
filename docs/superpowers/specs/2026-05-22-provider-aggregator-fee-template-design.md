# Provider × Aggregator Fee Template — Design

**Date:** 2026-05-22
**Status:** Approved (pending spec review)
**Repos affected:** `avoqado-server` (schema + API), `avoqado-web-dashboard` (config UI + wizard prefill)

## 1. Problem

Configuring payment fees is repetitive and error-prone. Today, every merchant account's
cost and venue pricing are typed by hand. There is no reusable template that says
"AngelPay through Moneygiver costs *this*". And because AngelPay→Moneygiver is more
expensive than Blumon→Moneygiver, the numbers genuinely differ per
`(provider, aggregator)` pair — so they must be captured per pair, once, and reused.

The operator wants: pick an aggregator → the fee layers are already there. With the
ability to split commissions across the processor, Avoqado, and the aggregator. And
configuration that is **not complicated**.

## 2. Current state — two separate fee subsystems

Avoqado's payment economics live in **two subsystems that do not talk to each other**:

- **Subsystem A — per-transaction cost/profit** (`transactionCost.service.ts`): for each
  payment, reads `ProviderCostStructure` (what the processor costs us) and
  `VenuePricingStructure` (what we charge the venue); `profit = charge − cost`; result
  stored in `TransactionCost`.
- **Subsystem B — aggregator settlement** (`moneygiver-settlement.job`,
  `settlement-report.service`): uses `Aggregator.baseFees` + `VenueCommission.rate` for
  settlement reports/jobs.

Subsystem A does **not** consume `Aggregator` or `VenueCommission`. The operator's mental
model — processor → Avoqado split → aggregator commission → net to venue — is split
across both subsystems, and two layers (Avoqado's cut, the aggregator/Avoqado profit
split) are not modeled at all.

## 3. Approach — a config template, calculation untouched

Add a **fee template keyed by `(provider, aggregator)`**. It holds the three stacked
fee layers. When a merchant account is configured (via the AngelPay wizard), picking an
aggregator **prefills** the cost and venue-pricing fields from the matching template.

**The per-transaction fee calculation does NOT change.** `transactionCost.service.ts`
keeps reading `ProviderCostStructure` and `VenuePricingStructure` exactly as today. The
template only *generates/prefills* those two existing structures at configuration time.
The processor/aggregator/Avoqado split is recorded **on the template** for reference and
configuration — recording the exact split per transaction is a future phase (see §9).

Rejected alternatives:
- **Change the per-transaction calc to record the 3-way split** — touches live money
  math; deferred as phase B.
- **Keep simple single-layer prefill from `Aggregator.baseFees`** — cannot express the
  3-layer split the operator needs.

## 4. The stacking-layer model

The venue's total fee is the **sum of three layers**, each with its own IVA treatment:

```
venue total rate  =  processor layer  +  aggregator margin  +  Avoqado margin
```

Each layer carries `{DEBIT, CREDIT, AMEX, INTERNATIONAL}` decimal rates and an
`includesTax` flag. IVA handling differs per layer — the processor layer normally does
**not** include IVA (so IVA is added on top), the aggregator layer **sometimes** does
not. Effective (tax-inclusive) rate of a layer:

```
effectiveRate = includesTax ? rate : rate × (1 + taxRate)
```

## 5. Schema — `ProviderAggregatorFee` (avoqado-server)

New model. Additive — a brand-new table, no change to any existing table.

```prisma
model ProviderAggregatorFee {
  id           String          @id @default(cuid())
  providerId   String
  provider     PaymentProvider @relation(fields: [providerId], references: [id])
  aggregatorId String
  aggregator   Aggregator      @relation(fields: [aggregatorId], references: [id])

  // Three stacked layers — each a JSON of {DEBIT,CREDIT,AMEX,INTERNATIONAL} decimals.
  processorFees  Json // cost the processor (AngelPay/Blumon) charges
  aggregatorFees Json // the aggregator's (e.g. Moneygiver) margin
  avoqadoFees    Json // Avoqado's margin

  // Per-layer IVA treatment. false = rate is base, IVA is added on calc.
  processorIncludesTax  Boolean @default(false)
  aggregatorIncludesTax Boolean @default(false)
  avoqadoIncludesTax    Boolean @default(false)
  taxRate               Decimal @default(0.16) @db.Decimal(5, 4)

  active    Boolean  @default(true)
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([providerId, aggregatorId])
  @@index([providerId])
  @@index([aggregatorId])
}
```

Back-relations `providerAggregatorFees ProviderAggregatorFee[]` added to
`PaymentProvider` and `Aggregator`.

`Aggregator.baseFees` and `VenueCommission` are **left as-is** — they keep serving the
settlement subsystem. Consolidating them into this model is explicitly out of scope.

## 6. How it feeds the AngelPay wizard

In the wizard's **Cost step (step 6)**, when the operator picks an aggregator, the
wizard looks up the `ProviderAggregatorFee` for `(ANGELPAY, aggregatorId)`:

- **Cost step (`ProviderCostStructure` source)** prefilled from the **processor layer**:
  rates ← `processorFees`, `includesTax` ← `processorIncludesTax`.
- **Pricing step (`VenuePricingStructure` source, step 7)** prefilled from the **sum of
  all three layers' effective rates**, per card type, stored with `includesTax = true`
  (the summed number is already tax-inclusive).

If no template exists for the pair, the wizard falls back to manual entry (current
behavior — nothing breaks). The operator can always adjust prefilled values.

The full-setup endpoint (`fullSetupAngelPayMerchant`) does **not** change — it already
accepts `cost`, `pricing` and `aggregatorId`. The template is read client-side for
prefill; the endpoint stays as-is.

## 7. Configuration UI

The existing `/superadmin/aggregators` page (`Aggregators.tsx`) gains a section to
manage `ProviderAggregatorFee` rows: choose provider + aggregator, enter the three
layers (rates + per-layer IVA flag). Configure "AngelPay × Moneygiver" once; every
account of that pair inherits it.

Backend: CRUD endpoints under the superadmin aggregator routes — list / get-by-pair /
create / update / delete.

## 8. Safety — what does NOT break

- **New table only** — additive migration; no existing table altered, no data touched.
- **Template is optional** — it acts only when a row exists for the pair AND the
  operator picks that aggregator. No aggregator / no template → manual entry, identical
  to today.
- **Per-transaction fee calc untouched** — `transactionCost.service.ts` is not modified.
  Accounts configured **without an aggregator** (`aggregatorId = null`) never trigger a
  template lookup and compute fees exactly as now.
- **Existing accounts are not rewritten** — they keep their current
  `ProviderCostStructure` / `VenuePricingStructure` / `aggregatorId`. The template
  applies only forward, at new-account configuration.
- **`Aggregator`, `VenueCommission`, the settlement subsystem — untouched.**

## 9. NOT in scope

- Changing `transactionCost.service.ts` to record the processor/aggregator/Avoqado split
  per transaction (phase B — needs its own design; touches live money math).
- Consolidating `Aggregator.baseFees` / `VenueCommission` into the new model.
- Retroactively generating templates for, or re-pricing, existing merchant accounts.
- Blumon wizard integration — the template model is provider-agnostic and Blumon flows
  can adopt prefill later; this spec implements the AngelPay-wizard prefill only.

## 10. Components

**Backend (`avoqado-server`):**
- `ProviderAggregatorFee` Prisma model + additive migration.
- CRUD: service + controller + routes + Zod schema (Spanish messages).

**Frontend (`avoqado-web-dashboard`):**
- `providerAggregatorFee` client service.
- Config UI in `Aggregators.tsx` (manage templates per provider × aggregator).
- AngelPay wizard Cost step: look up the template on aggregator pick; prefill cost and
  pricing steps from the three layers.

## 11. Testing

- Backend: CRUD unit/integration tests; uniqueness on `(providerId, aggregatorId)`.
- Frontend: a unit test for the layer-stacking + IVA math (effective rate, venue total);
  wizard prefill behavior (template found → prefilled; not found → manual).

## 12. Open questions

None. Phase B (per-transaction split recording) is deliberately deferred, not open.
