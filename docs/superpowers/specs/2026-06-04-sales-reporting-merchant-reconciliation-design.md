# Diseño — Desglose por comercio + conciliación de liquidación en Resumen de Ventas

- **Fecha:** 2026-06-04
- **Autor:** Jose Antonio Amieva (+ Claude)
- **Repos afectados:** `avoqado-server` (backend, aditivo), `avoqado-web-dashboard` (frontend), MCP (verificar)
- **Origen:** Feedback real de la clienta **Miranda (venue `amaena`)**, primera quincena usando la plataforma.

---

## 1. Problema

El reporteo de ventas (`/venues/:slug/reports/sales-summary`) es potente pero confunde a clientes no técnicos. Miranda reportó tres dolores concretos, todos confirmados en vivo contra producción:

1. **No puede ver varios comercios juntos.** El filtro "Comercio" es single-select (radio). Para saber "cuánto gané en total" tiene que ir cuenta por cuenta. Hoy tiene 3 cuentas: `Amaena A` (AngelPay/BBVA, afil. 7494104), `Amaena B` (AngelPay/MoneyGiver, afil. 9946475), `Externo` (Blumon PAX).
2. **La Ganancia Neta es un solo número mezclado.** No hay desglose por comercio. Ella necesita conciliar cada cuenta contra su banco/MoneyGiver por separado ("Amaena A me dio tanto, Amaena B tanto").
3. **Tiene que brincar entre dos páginas.** Cruza `sales-summary` (cuánto vendió, neto de comisión) con `available-balance` (cuándo cae) para saber "cuánto debería tener en mi cuenta y cuándo". Las dos páginas ni siquiera comparten rango de fechas.

### Insight de datos (producción, Amaena, 40 pagos COMPLETED)
El dinero está repartido en **3 procesadores a lo largo del tiempo**: Externo/Blumon es el más grande en mayo ($13,827), luego B ($3,047), A ($1,823), más efectivo ($9,070). Por eso los números "no le cuadran": está viendo un procesador a la vez.

---

## 2. Objetivos / No-objetivos

### Objetivos
- Mostrar la Ganancia Neta **desglosada por comercio**: por cada cuenta de tarjeta, `Cobrado − Comisión (lo que le cobramos) = Neto a recibir`.
- Mostrar **cuándo cae** ese dinero por comercio, como un **mini-calendario manejado por el date-range picker** (estimación por reglas de liquidación, días hábiles + festivos MX).
- Resolver el dolor de "brincar entre páginas": "cuánto debería tener y cuándo" queda en una sola pantalla (dentro de Ganancia Neta).
- **Cero regresiones.** Todo aditivo: solo se agregan campos nuevos opcionales; nada existente se modifica ni se quita.

### No-objetivos (YAGNI / fuera de alcance ahora)
- **Multi-select de comercios.** Con el desglose siempre visible por comercio, "Todos" ya muestra A/B/Externo por separado + total combinado — que era el fin real. El filtro se queda single-select solo para *enfocar*.
- **Confirmación real contra el banco.** No conectamos API bancaria todavía. Las fechas pasadas son **estimadas** ("debió caer"), no confirmadas.
- **Reusar el botón "confirmar" de Saldo Disponible** como fuente de verdad (nadie lo usa; se queda como está, no se borra, pero el calendario nuevo NO depende de él).
- Partir la comisión en "procesador vs Avoqado" (por ahora un solo número de comisión).
- Ganancia neta "por comercio" que incluya efectivo/propinas/descuentos/comisiones a empleados (no se atribuyen limpio a un comercio). El desglose por comercio es **dinero de tarjeta**; el efectivo va aparte como "ya en tu mano".

---

## 3. Realidad de datos y factibilidad (verificado en código + prod)

| Pieza | Hallazgo | Veredicto |
|------|----------|-----------|
| Filtro `merchantAccountId` en sales-summary | Ya existe y se aplica a gross/fees/comisiones | 🟢 |
| Patrón de arrays de desglose en la respuesta | Ya existe (`byPaymentMethod`, `byPeriod`) → agrego `byMerchantAccount` | 🟢 aditivo |
| Atribución comisión por comercio | Vive en `TransactionCost.venueChargeAmount`, tabla que **obliga** `merchantAccountId` (no-null) | 🟢 |
| `Payment.merchantAccountId` | Nullable, migración 2025-11-10. **Amaena: 0 null en tarjeta** (venue nuevo) | 🟢 Amaena / 🟡 legacy |
| `Payment.cardBrand` | Nullable; **Amaena: 0 null en tarjeta** | 🟢 Amaena |
| Motor de liquidación (`SettlementConfiguration`) | Ya keyed por `(merchantAccountId, cardType)`, días hábiles + festivos MX, acepta rangos arbitrarios | 🟢 |
| Agrupar liquidación por comercio | ~50–100 líneas (extender query + grouping key) | 🟡 moderado |

### Landmines (del feasibility, con mitigación)
1. **`Payment.merchantAccountId` null en venues legacy** (pre 2025-11-10). *No aplica a Amaena.* Mitigación: el desglose filtra/bucketea null como "(sin asignar)"; gate por-venue antes de habilitar Entrega 2 (ver §7).
2. **`SettlementConfiguration` se consulta con `effectiveTo: null`** (config activa, no la vigente al momento de la transacción). Si una regla cambió a media-quincena, proyecta histórico con la regla nueva. Mitigación: hacer match por fecha (`effectiveFrom <= createdAt AND (effectiveTo IS NULL OR effectiveTo > createdAt)`).
3. **`VenueTransaction.estimatedSettlementDate` puede faltar** si el job de settlement no corrió. Mitigación: el calendario calcula on-read con el motor si falta el dato persistido, y muestra "—" honesto si no hay config.

---

## 4. Diseño funcional (UI)

Modelo mental: **"seguir el dinero"** — contestar de un vistazo 3 preguntas: ¿cuánto entró?, ¿cuánto pagué de comisión?, ¿dónde está mi dinero ahorita? La **fila actual de Ganancia Neta se queda intacta** (número global, no breaking); todo lo nuevo es aditivo, debajo. Filtro Comercio = "Todos".

### 4.1 Tira "¿Dónde está tu dinero?" (elemento de primer nivel)

Lo primero que ve el dueño no-técnico (estilo Miranda). Simple, de un vistazo:

```
¿Dónde está tu dinero?              29 may – 4 jun

  💵 En tu mano (efectivo)     $9,070   ✓ ya lo tienes
  🏦 Ya en tu banco (est.)     $X,XXX   ✓ debió caer
  ⏳ Por caer                  $Z,ZZZ   📅 mié 5 – vie 7
  ─────────────────────────────────────────────────
  Vendiste $27,767  ·  pagaste $343 de comisión  ·  te queda $27,424
```

- **Efectivo visible y claro** ("ya lo tienes, en caja") — nunca escondido. No tiene "cae" porque ya cayó; es la única lana que ya está en su mano.
- **Línea de comisiones** = transparencia explícita de lo que paga por procesar, sin letra chica (construye confianza; deja claro que no es margen oculto de Avoqado).
- **Progresivo:** en **Entrega 1** la tira es `💵 Efectivo en mano · 💳 Tarjeta neto a recibir · comisiones pagadas` (sin separar caído/por-caer todavía). En **Entrega 2** se parte la tarjeta en `🏦 Ya en banco (est.)` vs `⏳ Por caer` con fechas.

### 4.2 Desglose por comercio (detalle)

```
Desglose por comercio · dinero de tarjeta       $X,XXX.XX
────────────────────────────────────────────────────────
Comercio        Cobrado    Comisión   Neto a recibir   Cae
Amaena A·BBVA   $1,823.00   -$XX.XX    $X,XXX.XX        mié 5 jun
Amaena B·MGiver $3,047.00   -$XX.XX    $X,XXX.XX        jue 6 jun
Externo·Blumon $13,827.00   -$XX.XX    $X,XXX.XX        vie 7 jun
────────────────────────────────────────────────────────
Efectivo (ya en tu mano)                          $9,070.00
────────────────────────────────────────────────────────
  ▾ Calendario de liquidación   (rango actual · estimado)
```

### 4.3 Mini-calendario (expandible, manejado por el date-range picker)
Regla única: **fecha en que cae = fecha de venta + regla de liquidación** (días hábiles, Amex 3, etc.). El picker acota *qué ventas*; el calendario muestra *cuándo cae el dinero de esas ventas*, desglosado por comercio por día:

```
jue 5 jun ───────────────────────── recibes $3,167  📅 proyectado
   Amaena A · BBVA        comisión -$54  →  recibes $1,446
   Amaena B · MoneyGiver  comisión -$84  →  recibes $1,721
```

- Fecha **< hoy** → `✓ estimado · debió caer` (conciliar vs banco; sin botón de confirmar).
- Fecha **= hoy** → `cae hoy`.
- Fecha **> hoy** → `📅 proyectado · se te pagará`.
- Rango que cruza hoy → muestra ambas.
- **Efectivo NO entra al calendario** (inmediato, ya es suyo).
- Nota visible de honestidad: *"Estimado según reglas de liquidación. Confirmación real cuando conectemos tu banco."* Cuando exista la API bancaria, `estimado` → `✓ confirmado` sin cambiar UI.

---

## 5. Arquitectura técnica

### 5.1 `avoqado-server` (aditivo, sin breaking changes)

**Endpoint:** `GET /api/v1/dashboard/reports/sales-summary`

Nuevos query params **opcionales** (default = comportamiento actual):
- `includeMerchantBreakdown=true` → agrega `byMerchantAccount[]` a la respuesta.
- `includeSettlementProjection=true` → agrega `estimatedSettlement` por comercio + `settlementCalendar[]` top-level.

**Nuevos campos opcionales en `SalesSummaryResponse`:**
```ts
byMerchantAccount?: MerchantAccountBreakdown[]   // Entrega 1
settlementCalendar?: SettlementCalendarDay[]     // Entrega 2

interface MerchantAccountBreakdown {
  merchantAccountId: string | null   // null = bucket "sin asignar" (legacy)
  displayName: string                // "Amaena - A"
  provider: string                   // "AngelPay (Nexgo)" | "Blumon PAX"
  affiliation?: string               // angelpayAffiliation
  collectedOnCard: number            // SUM(Payment.amount), solo tarjeta (¿incluye propina? confirmar en impl — las propinas hoy se muestran aparte)
  platformFee: number                // SUM(TransactionCost.venueChargeAmount)
  netToReceive: number               // collected - fee
  transactionCount: number
  estimatedSettlement?: {            // Entrega 2
    nextDate: string | null
    rule: string                     // "1 día háb." | "3 días háb."
  }
}

interface SettlementCalendarDay {    // Entrega 2
  date: string                       // YYYY-MM-DD (settlement date)
  status: 'settled' | 'pending' | 'projected'   // vs hoy
  totalNet: number
  byMerchant: Array<{ merchantAccountId: string; displayName: string; platformFee: number; netToReceive: number }>
}
```

- **Entrega 1 query:** `GROUP BY Payment.merchantAccountId` join `TransactionCost` + `MerchantAccount`, solo métodos de tarjeta, mismo `dateFilter`/permiso (`reports:read`) existentes.
- **Entrega 2:** reutiliza `settlementCalculation.service.ts` (`calculateSettlementDate`, `addBusinessDays`, festivos MX). Extiende el grouping del settlement-calendar a `(settlementDate, merchantAccount)`. Aplica fix de landmine #2 (match por `effectiveFrom/effectiveTo`).
- **No tocar** la forma actual de `summary`, `byPaymentMethod`, `byPeriod`, exports, ni el filtro existente.

### 5.2 `avoqado-web-dashboard` (frontend)

- `src/services/salesSummary.service.ts`: agregar params y tipos nuevos (opcionales).
- `src/pages/Reports/SalesSummary.tsx` (2.386 líneas — grande): **extraer** el render de Ganancia Neta a un componente nuevo `MerchantBreakdownPanel.tsx` (+ `SettlementMiniCalendar.tsx` en Entrega 2) para no engordar más el archivo. Memoizar arrays que van a tablas/listas.
- Reusar el patrón de la tabla "por tipo de tarjeta" que ya existe en `AvailableBalance/CardTypeBreakdownStrip.tsx` (mismo lenguaje visual: Método/Monto/Comisión/Liquidación).
- Tokens semánticos (sin grises hardcoded), `border-input` en cards, i18n en `t()`, timezone con `useVenueDateTime`.
- Filtro Comercio: se queda single-select (sin cambios).

### 5.3 MCP
- Verificar el tool `daily_sales` (y afines) del MCP de Avoqado: si expone ventas, agregar el desglose `byMerchantAccount` para mantener el MCP en sync (regla del repo). Ubicar el MCP real (el subagente no lo halló en `avoqado-server/scripts/mcp/`; confirmar ubicación antes de cerrar).

---

## 6. Manejo de errores / edge cases

- **Venue legacy con pagos sin comercio:** bucket `(sin asignar)` con tooltip "pagos previos a nov-2025 sin cuenta asignada". No rompe el total.
- **Sin `SettlementConfiguration` para un comercio/tarjeta:** fila muestra `Cae —` (sin inventar fecha).
- **Filtro de un solo comercio activo:** el desglose colapsa a esa cuenta (consistente con el filtro).
- **Sin tarjeta en el rango (solo efectivo):** desglose vacío + "Efectivo (ya en tu mano)".
- **Respuesta sin los campos nuevos** (server viejo / params off): el frontend degrada al número único actual.

---

## 7. Entrega y verificación

**Entrega 1 — Desglose por comercio + tira "¿Dónde está tu dinero?" (🟢 seguro, aditivo).**
`byMerchantAccount` en backend + `MerchantBreakdownPanel` en frontend + columna Comisión + tira simple (efectivo en mano · tarjeta neto a recibir · comisiones pagadas). Resuelve dolores #1 y #2. MCP en sync.

**Entrega 2 — Calendario de liquidación por comercio (🟡, con gate de dato).**
`settlementCalendar` + `SettlementMiniCalendar` manejado por el picker; la tira parte la tarjeta en `🏦 Ya en banco (est.)` vs `⏳ Por caer` con fechas. Resuelve dolor #3.
- **Gate por-venue antes de habilitar:** correr el check de `merchantAccountId` null en pagos de tarjeta del venue. Si > umbral → backfill desde `TransactionCost` (fácil) o arrancar calendario desde 2025-11-10. *Amaena: ya pasó el gate (0 null).*

**Checklist pre-deploy (ambas):**
- [ ] `npm run build` + `npm run lint` verdes (dashboard) · `npm run build` (server)
- [ ] Tests backend: unit del query de desglose + de la proyección de liquidación (incluye fix landmine #2)
- [ ] `npm run test:e2e` (no regresión del reporte actual)
- [ ] Probado claro + oscuro
- [ ] Probado con roles (VIEWER/MANAGER/OWNER) + permiso `reports:read`
- [ ] Sin warnings de React; arrays memoizados
- [ ] Verificado en vivo contra Amaena que el desglose suma al total actual

---

## 8. i18n
Nuevas keys en namespace `reports` (`salesSummary.merchantBreakdown.*`, `salesSummary.settlement.*`) en **es + en** (y **fr** si el namespace existe). Interpolación, nunca concatenación.

## 9. Futuro
- Conexión API bancaria (MoneyGiver/BBVA) → `estimado` pasa a `✓ confirmado`, conciliación automática. Esta feature deja el terreno listo (el calendario ya tiene las fechas/montos esperados por comercio).
- Registro de salidas de efectivo (comisiones/propinas pagadas en mano) — dolor adicional que mencionó Miranda; fuera de este spec.
