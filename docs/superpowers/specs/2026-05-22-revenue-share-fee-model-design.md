# Modelo de Revenue-Share de Fees — Diseño

**Fecha:** 2026-05-22
**Estado:** Aprobado en brainstorming — pendiente de plan de implementación
**Repos afectados:** `avoqado-server` (modelo + cálculo), `avoqado-web-dashboard` (UI superadmin)

---

## Objetivo

Modelar correctamente cómo se reparte el fee de una transacción entre **el procesador**
(AngelPay/Blumon), **el agregador** (cuando hay uno) y **Avoqado**, con porcentajes de
*revenue-share* **configurables por merchant** (incluyendo 0%). Hoy esto no se puede:
los splits están hardcodeados (70/30 o 30/70) y la "ganancia" se trata como un bloque
monolítico.

## Constraint duro (la regla de oro)

**El proceso de pago NO se toca.** Blumon sobre terminales PAX y AngelPay sobre
terminales NEXGO siguen idénticos. El revenue-share es una capa **aparte**, que se
calcula en reportes/liquidación — no vive en la ruta de cobro.

---

## Contexto — el problema

Hoy existen 3 sistemas de fees fragmentados:

1. **`transactionCost.service`** — calcula `providerCostAmount` (costo) vs
   `venueChargeAmount` (cobro al venue) y guarda `grossProfit = cobro − costo`. La
   ganancia es **un solo número monolítico**; no separa a quién le toca qué.
2. **`venue-commission-settlement.job`** — un job de liquidación con `SPLIT_RATIOS`
   **hardcodeados**: `EXTERNAL` = 70/30, `AGGREGATOR` = 30/70. Solo 2 opciones fijas.
3. **`ProviderAggregatorFee`** — entidad de "3 capas aditivas" construida recientemente.
   **No se usa en ningún cálculo** — solo prellena el wizard. Aislada.

Ninguno modela lo que el negocio necesita: una cadena de precios con *revenue-share*
configurable por margen.

## El modelo económico

Cada transacción recorre una cadena de precios. Hay dos casos.

### Caso directo (sin agregador)

```
AngelPay/Blumon ──costo──▶ Avoqado ──precio al venue──▶ Venue

Margen = precio al venue − costo
└─ se reparte: avoqadoShareOfProviderMargin → Avoqado ; el resto → provider
```

Ejemplo — pago $100, costo 2%, venue paga 5%, share 50/50:
- Margen = $5 − $2 = $3
- Avoqado = $3 × 0.50 = $1.50 ; Provider = $2 (costo) + $1.50 = $3.50
- Suma = $5.00 = lo que paga el venue ✓

### Caso con agregador

```
AngelPay/Blumon ──costo──▶ Avoqado ──precio agregador──▶ Agregador ──precio venue──▶ Venue

Margen 1 = precio agregador − costo
└─ se reparte avoqadoShareOfProviderMargin → Avoqado ; el resto → provider
Margen 2 = precio venue − precio agregador
└─ se reparte avoqadoShareOfAggregatorMargin → Avoqado ; el resto → agregador
```

Ejemplo — pago $100, costo 2%, precio agregador 4%, venue paga 7%, ambos shares 50/50:
- Margen 1 = $4 − $2 = $2 → Avoqado $1 · Provider $1
- Margen 2 = $7 − $4 = $3 → Avoqado $1.50 · Agregador $1.50
- Provider neto = $2 + $1 = $3 ; Avoqado neto = $1 + $1.50 = $2.50 ; Agregador = $1.50
- Suma = $7.00 = lo que paga el venue ✓

### IVA

Cada tasa de la cadena puede ser **"+ IVA"** (tax-exclusive) o **"IVA incluido"**
(tax-inclusive), igual que hoy con el flag `includesTax`. El IVA es un **impuesto de
traslado, no es ganancia**: el revenue-share se reparte sobre los montos **pre-IVA**;
el IVA se calcula por capa y cada parte lo entera a SAT. Patrón existente
(`applyTaxIfNeeded`, `effectiveRate`).

---

## Decisión de arquitectura

El revenue-share se ancla **por `MerchantAccount`** (Enfoque A). El `MerchantAccount`
ya es el nudo que une provider + agregador + venue-slot, y `TransactionCost` ya guarda
`merchantAccountId` por transacción. Es **aditivo**: una tabla nueva, sin tocar tablas
existentes. Cubre el caso por-venue (si los merchants de un venue comparten deal, se
configuran igual) y el caso multimerchant (cada merchant su propio deal).

---

## Sección 1 — Modelo de datos

Una entidad nueva en `avoqado-server/prisma/schema.prisma`:

```prisma
model MerchantRevenueShare {
  id                String   @id @default(cuid())
  merchantAccountId String   @unique
  merchantAccount   MerchantAccount @relation(fields: [merchantAccountId], references: [id], onDelete: Cascade)

  // Precio que Avoqado le cobra al agregador, por tipo de tarjeta
  // {DEBIT, CREDIT, AMEX, INTERNATIONAL}. null = venta DIRECTA (sin agregador).
  aggregatorPrice            Json?
  aggregatorPriceIncludesTax Boolean  @default(false)

  // Fracción (0..1) del margen procesador→Avoqado que se queda Avoqado.
  // El resto va al provider. Default 0.50 (50/50, el caso casi universal).
  avoqadoShareOfProviderMargin   Decimal @default(0.50) @db.Decimal(5, 4)

  // Fracción (0..1) del margen agregador→venue que se queda Avoqado.
  // El resto va al agregador. null cuando es venta directa.
  avoqadoShareOfAggregatorMargin Decimal? @db.Decimal(5, 4)

  taxRate   Decimal  @default(0.16) @db.Decimal(5, 4)
  active    Boolean  @default(true)
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Back-relation `merchantRevenueShare MerchantRevenueShare?` en `MerchantAccount`.

**No se duplica nada** — el costo del procesador se lee de `ProviderCostStructure`
(del merchant) y el precio al venue de `VenuePricingStructure` (del venue-slot que
ocupa el merchant en `VenuePaymentConfig`).

**Distinción automática de caso:** `aggregatorPrice = null` → directo (1 margen,
`avoqadoShareOfAggregatorMargin` se ignora). `aggregatorPrice` con valores → con
agregador (2 márgenes).

**Sin fila `MerchantRevenueShare`** → comportamiento de hoy: toda la ganancia a
Avoqado (default monolítico). Cero ruptura para merchants no configurados.

---

## Sección 2 — Motor de cálculo

Una **función pura nueva** en `avoqado-server/src/services/payments/revenueShare.service.ts`:

```ts
interface RevenueSplitInput {
  amount: number                 // monto de la transacción
  cardType: 'DEBIT' | 'CREDIT' | 'AMEX' | 'INTERNATIONAL'
  providerCostRate: number       // de ProviderCostStructure
  providerCostIncludesTax: boolean
  venueChargeRate: number        // de VenuePricingStructure
  venueChargeIncludesTax: boolean
  share: MerchantRevenueShare | null
}

interface RevenueSplit {
  providerNet: number            // costo + parte del margen que le toca al provider
  avoqadoNet: number             // suma de las partes de Avoqado
  aggregatorNet: number          // 0 si es directo
  ivaByLayer: { provider: number; aggregator: number; venue: number }
  // Invariante: providerNet + avoqadoNet + aggregatorNet === fee total pre-IVA al venue
}

export function computeRevenueSplit(input: RevenueSplitInput): RevenueSplit
```

Lógica:
- `share == null` → `avoqadoNet = fee − providerCost`, `aggregatorNet = 0` (hoy).
- Directo (`aggregatorPrice == null`): `margen = venueCharge − providerCost`;
  `avoqadoNet = margen × avoqadoShareOfProviderMargin`;
  `providerNet = providerCost + margen × (1 − avoqadoShareOfProviderMargin)`.
- Con agregador: `M1 = aggregatorPrice − providerCost`,
  `M2 = venueCharge − aggregatorPrice`;
  `providerNet = providerCost + M1 × (1 − shareProvider)`;
  `avoqadoNet = M1 × shareProvider + M2 × shareAggregator`;
  `aggregatorNet = M2 × (1 − shareAggregator)`.
- IVA: por capa, `includesTax ? incluido : monto × (1 + taxRate)`. Pass-through, no
  se reparte.

**Quién la llama:** los reportes de liquidación / un reporte nuevo de revenue en
superadmin. **NO** `transactionCost.service`. El cálculo es **report-time**, leyendo
`MerchantRevenueShare` + los `TransactionCost` que ya existen.

---

## Sección 3 — UI / UX

| Superficie | Qué pasa |
|---|---|
| Dashboard del venue (payments, orders, available-balance, sales-summary) | **INTACTO** — el venue nunca ve el revenue-share |
| Proceso de pago / TPV | **INTACTO** |
| Wizard de merchant AngelPay (`AngelPayWizard.tsx`) | En el paso de costo/precio: dropdown de agregador **+ "Crear agregador" inline** (diálogo rápido: nombre + IVA). Captura: `aggregatorPrice` + los 2 shares (provider prellenado 50/50, agregador configurable) |
| `/superadmin/aggregators` (`Aggregators.tsx`) | CRUD intuitivo: crear / editar / **eliminar** agregadores. La tarjeta muestra el revenue-share claro |
| Reporte de liquidación / revenue (superadmin) | Muestra el reparto: Avoqado / agregador / provider. Componente **nuevo y aditivo** |

El revenue-share es **100% superadmin/interno**. Ningún componente del dashboard del
venue cambia.

---

## Sección 4 — Limpieza / migración

- **`ProviderAggregatorFee`** — modelo, rutas, servicio y sección UI "Tarifas por
  proveedor × agregador" → **se retiran**. No se usa en ningún cálculo; solo tiene
  filas demo de prueba (las del "Agregador Demo"). La tabla se elimina con una
  migración `drop`.
- **Los 2 venues con agregador configurado** (`VenueCommission`) → se les quita la
  config vieja y se recapturan en `MerchantRevenueShare`. Son 2 — trivial, sin job
  de migración.
- **`venue-commission-settlement.job`** — los `SPLIT_RATIOS` hardcodeados (70/30,
  30/70) se reemplazan por `computeRevenueSplit` leyendo `MerchantRevenueShare`.
- **`VenueCommission`** — se deprecia tras recapturar los 2 venues; el modelo se
  puede dejar dormido o eliminar en una migración de seguimiento.
- **`Aggregator`** — se queda (nombre + `ivaRate`). El campo `baseFees` plano se deja
  de usar (no se elimina para no romper la migración; queda dormido).

---

## Lo que explícitamente NO se toca

- **Proceso de pago:** flujo TPV, SDK Blumon, SDK AngelPay, activación de terminales,
  `transactionCost.service`, `Payment`, `Order`, `TransactionCost`.
- **Dashboard del venue:** payments, orders, available-balance, sales-summary.
- **`VenuePricingStructure`** (cobro al venue) y **`ProviderCostStructure`** (costo) —
  se **leen**, nunca se escriben.

---

## Testing

- **Unit (vitest/jest):** `computeRevenueSplit` — casos: directo, con agregador,
  `share = 0`, `share = 1` (0-100 y 100-0), IVA incluido vs "+ IVA", e invariante
  *suma de partes = fee total pre-IVA*.
- **Integración (DB real):** CRUD de `MerchantRevenueShare`; el cómputo del reporte.
- **Regresión:** verificar que `transactionCost.service`, available-balance y
  sales-summary devuelven **exactamente los mismos números** que antes del cambio.
- **E2E / manual:** wizard con "Crear agregador" inline; CRUD de `/superadmin/aggregators`.

---

## Riesgos y decisiones asumidas

- **Cálculo report-time:** usa la config actual de `MerchantRevenueShare`, no la
  vigente al momento de la transacción. Si la config cambia, reportes históricos
  cambian. Aceptado — la liquidación es de bajo riesgo (pocos venues la revisan) y es
  consistente con cómo funciona hoy el job. Snapshot por transacción = refinamiento
  futuro.
- **Share provider↔Avoqado guardado por merchant:** es en realidad un acuerdo
  corporativo (Avoqado↔AngelPay/Blumon). Guardarlo por merchant lo repite; si el deal
  corporativo cambia se tocan todos los merchants. Aceptado (el default 0.50 lo
  prellena) — config provider-level es YAGNI por ahora.
- **Retiro de `ProviderAggregatorFee`:** feature reciente, pero aislada y con 1 fila
  demo. Riesgo bajo.

## Fuera de alcance

- Snapshot del revenue-share por transacción (precisión histórica).
- Automatización de facturación de IVA entre las partes.
- Config de revenue-share a nivel provider (corporativa).
