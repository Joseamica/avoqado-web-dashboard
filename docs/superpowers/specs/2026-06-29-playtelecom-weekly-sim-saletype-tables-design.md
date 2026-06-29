# PlayTelecom — Tablas semanales "Tipo de Venta" y "Tipo de SIM"

- **Asana:** 1216095149541827 ("Agregar tablas de Venta por Tipo de SIM y Tipo de Venta en Ventas") · proyecto "Bait <> Play Telecom" · [Dashboard] · Prioridad Media
- **Fecha:** 2026-06-29
- **Autor:** Jose + Claude (brainstorming)
- **Estado:** Diseño aprobado en sustancia; pendiente revisión del spec escrito

## 1. Objetivo

Agregar **dos tablas heatmap semanales** en la página org-level "Ventas"
(`SalesExecutive.tsx`, PlayTelecom/Walmart), con el mismo estilo que
"Ventas Totales por Ciudad", colocadas **justo debajo de "Ventas Totales
Semanales"** (antes de "por Ciudad"). Sólo cuentan ventas aprobadas
(`SaleVerification.status = COMPLETED`).

- **Tabla 1 — Tipo de Venta:** filas `Líneas Nuevas`, `Portabilidades` (+ Total).
- **Tabla 2 — Tipo de SIM:** filas `SIM de Intercambio`, `$100 de Promotor`,
  `SIM de Evento` (3 fijas, siempre presentes) + `Otros SIMs` (catch-all) (+ Total).

Columnas = **semanas** (histórico completo). Cada celda = conteo org-wide de
ventas aprobadas de ese tipo en esa semana, con renglón "Total País" arriba.

## 2. Decisiones tomadas

| # | Decisión | Resolución | Fuente |
|---|----------|-----------|--------|
| 1 | Alcance de columnas-semana | **Opción A: todas las semanas (histórico).** Diseñar para aceptar después una ventana "últimas N". | Isaac vía Jose |
| 2 | Filas de Tabla 2 cuando hay otras categorías | 3 fijas **siempre visibles** + **"Otros SIMs"** catch-all. **El Total siempre cuadra.** | Isaac vía Jose |
| 3 | Gráfica mensual existente "Ventas por Tipo de SIM" | **Reagrupar** a las mismas 4 cubetas (3 fijas + Otros SIMs) para consistencia de vocabulario. | Recomendación Claude, adoptada |
| 4 | Tier | **Exento** — amplía un reporte existente del dashboard white-label de la org; no es capacidad nueva con paywall. | CLAUDE.md tier-gate |
| 5 | i18n | **Español hardcoded** (sin `t()`), igual que el resto de `SalesExecutive.tsx`. | Convención del archivo |
| 6 | Etiqueta de semana | Legible en zona horaria del venue (p. ej. "9–15 jun"), no "W26". | UX "menos técnico" |

## 3. Invariante central — "el total debe cuadrar"

Requisito explícito de Isaac: **el total debe cuadrar en todas las tablas y
gráficas.**

Garantía de diseño: **las dos nuevas agregaciones iteran exactamente el mismo
conjunto base** que ya usa la barra "Ventas Totales Semanales"
(`baseAggregationWhere` → `SaleVerification.status='COMPLETED'`,
`venue.organizationId = orgId`). Como cada venta aprobada cae en **exactamente
una** fila de cada tabla:

- Tabla 1: partición binaria por `isPortabilidad` (Línea Nueva | Portabilidad).
- Tabla 2: partición por categoría mapeada a 4 cubetas exhaustivas
  (3 fijas + "Otros SIMs" que absorbe TODO lo demás, incl. eSIM/null/"Otro").

⇒ Para cada semana: `Σ Tabla 1 == Σ Tabla 2 == conteo barra semanal`, y los
totales generales == KPI "Total aprobadas". Esto se **blinda con un test de
regresión** (ver §7).

> Nota de fuente de datos: la barra semanal (`getSalesByWeek`) cuenta
> `SaleVerification` COMPLETED. La gráfica mensual de SIM (`getSalesBySimType`)
> hoy cuenta `Payment` COMPLETED con verificación COMPLETED. Para que **todo**
> cuadre con la misma base, las nuevas agregaciones parten de
> `SaleVerification` COMPLETED y resuelven la categoría navegando
> `verification → payment → order → items → serializedItem → category`.

## 4. Modelo de datos (verificado en código)

- **Tipo de venta:** `deriveSaleType(isPortabilidad)` → `PORTABILIDAD` si
  `isPortabilidad`, si no `LINEA_NUEVA`. La **eSIM NO es tipo de venta** (es la
  categoría "E-SIM de promotor"); una venta eSIM se clasifica como Línea
  Nueva/Portabilidad por su flag. ⇒ Tabla 1 tiene exactamente 2 filas.
- **Tipo de SIM:** `ItemCategory.name` vía
  `Payment → Order → OrderItem → SerializedItem → ItemCategory` (mismo join que
  `getSalesBySimType`; fallback "Otro" cuando no hay item serializado).
- **Semana:** ISO week. El `toWeekLabel` actual devuelve `"Wxx"` (sin año, se
  desordena entre años). Se agrega `toIsoWeekKey` → `"2026-W26"` (year-week ISO,
  ordenable lexicográficamente y entre años). **No se toca `toWeekLabel`** (lo
  usa la barra existente).

### 4.1 Nombres canónicos de categoría (⚠ datos del tenant)

Los nombres reales viven en `ItemCategory` (no en código/seed). Coexisten
**"$100 de Promotor"** y **"E-SIM de promotor"** ⇒ un match por substring
"promotor" sería **ambiguo**. Por eso el mapeo es por **nombre canónico exacto**
(normalizado: `trim` + `toLowerCase`), en una sola constante:

```ts
// Nombres canónicos tomados de Asana; VERIFICAR contra los ItemCategory reales
// de la org cmietitbn000zpr2d8213qkzq como Tarea 0 del plan, y ajustar si difieren.
const SIM_FIXED_BUCKETS = ['SIM de Intercambio', '$100 de Promotor', 'SIM de Evento'] as const
const SIM_OTHERS = 'Otros SIMs'
function toSimBucket(categoryName: string | null): SimBucket {
  const n = (categoryName ?? '').trim().toLowerCase()
  const hit = SIM_FIXED_BUCKETS.find(b => b.toLowerCase() === n)
  return hit ?? SIM_OTHERS
}
```

> **Tarea 0 obligatoria del plan:** leer los `ItemCategory.name` reales de la
> org PlayTelecom (read-only) y confirmar/ajustar `SIM_FIXED_BUCKETS`. Si los
> nombres difieren (acentos, "SIM" vs "Sim", "$100" vs "100"), corregir la
> constante. Un test (§7) alimenta nombres representativos (incl.
> "E-SIM de promotor" → "Otros SIMs") para fijar el contrato.

## 5. Backend (`avoqado-server`)

**Archivo:** `src/services/dashboard/sale-verification.org.dashboard.service.ts`

1. `toIsoWeekKey(d, tz)` → `"YYYY-Www"` (ISO year-week, en tz del venue).
2. `toSimBucket(name)` + constantes `SIM_FIXED_BUCKETS` / `SIM_OTHERS` (§4.1).
3. `getSalesBySaleTypeWeekly(orgId, range)` →
   `Array<{ name: 'Líneas Nuevas' | 'Portabilidades'; byWeek: Record<string, number>; total: number }>`.
   Itera `baseAggregationWhere`, bucket por `toIsoWeekKey(createdAt)`, fila por
   `isPortabilidad`. Devuelve SIEMPRE las 2 filas en orden fijo (Líneas Nuevas,
   Portabilidades), aunque alguna sea 0.
4. `getSalesBySimTypeWeekly(orgId, range)` →
   `Array<{ name: SimBucket; byWeek: Record<string, number>; total: number }>`.
   Itera `baseAggregationWhere` con `include` del path a `category`; bucket por
   semana y por `toSimBucket(category?.name)`. Devuelve SIEMPRE las 3 fijas en
   orden, y "Otros SIMs" **sólo si total > 0**.
5. **Reagrupar `getSalesBySimType` (mensual)** para usar `toSimBucket` ⇒ su
   `byCategory` pasa a tener llaves de las 4 cubetas. La gráfica mensual del
   front no cambia (itera categorías dinámicamente).

**Rutas/controller:** 2 endpoints nuevos, espejando el wiring de
`/by-city` y `/by-month` (misma auth/permiso):
- `GET /api/v1/dashboard/organizations/:orgId/sale-verifications/by-sale-type-weekly`
- `GET /api/v1/dashboard/organizations/:orgId/sale-verifications/by-sim-type-weekly`

Archivos: `src/routes/dashboard/saleVerification.org.dashboard.routes.ts`,
`src/controllers/dashboard/sale-verification.org.dashboard.controller.ts`.

**MCP (regla crítica — sync obligatorio):**
`src/mcp/tools/saleVerifications.ts` — exponer los desgloses semanales por tipo
de venta y tipo de SIM (herramienta nueva o extender la org-sales existente).

## 6. Frontend (`avoqado-web-dashboard`)

**`src/services/saleVerification.org.service.ts`:**
- Tipos `SalesBySaleTypeWeeklyRow`, `SalesBySimTypeWeeklyRow`
  (`{ name; byWeek: Record<string, number>; total }`).
- Fetchers `getSalesBySaleTypeWeekly(orgId)`, `getSalesBySimTypeWeekly(orgId)`.

**`src/pages/organizations/SalesExecutive/SalesExecutive.tsx`:**
- 2 `useQuery` nuevos (`enabled: !!orgId`, `staleTime: 60_000`).
- `weekBucketsAsc(keys: string[])` → `{key,label}[]` ordenado asc, **espejo de
  `monthBucketsAsc`**; calcula la etiqueta legible ("9–15 jun") desde la clave
  `"2026-W26"` con Luxon en tz del venue (`DateTime.fromObject({ weekYear,
  weekNumber }, { zone })` → lunes; rango lunes–domingo).
- 2 `GlassCard` con `<HeatmapTable>` insertadas tras la card "Ventas Totales
  Semanales" (~L350), antes de "por Ciudad":
  - "Ventas por Tipo de Venta (semanal)" → filas saleType, `sortRows={false}`.
  - "Ventas por Tipo de SIM (semanal)" → filas simBucket, `sortRows={false}`.

**`HeatmapTable` (mismo archivo):**
- Nuevo prop opcional `sortRows = true`. Cuando `true`: comportamiento actual
  (orden por total desc) — todas las tablas existentes intactas. Cuando
  `false`: respeta el orden recibido (orden fijo enumerado). Mínimo cambio,
  retro-compatible.

## 7. Pruebas

**Backend (unitarias, Prisma mock — patrón existente del servicio):**
- **Reconciliación (clave):** por semana, `Σ Tabla1 == Σ Tabla2 ==` conteo de
  `getSalesByWeek` para el mismo dataset mock.
- `toSimBucket`: "SIM de Intercambio"/"$100 de Promotor"/"SIM de Evento" →
  su cubeta; **"E-SIM de promotor" → "Otros SIMs"**; null/"Otro" → "Otros SIMs";
  case/trim-insensible.
- `toIsoWeekKey`: cruce de año (dic W52/W53 vs ene W01) ordena correcto.
- Filas fijas presentes aunque sean 0; "Otros SIMs" ausente si 0.

**Frontend:** smoke de render (las 2 tablas montan con datos mock; "Total País"
y orden fijo correctos). E2E sólo si toca un flujo existente.

**Gate:** `npm run build` + `npm run lint` + `npm run test:e2e` en verde
(dashboard); `npm test` del servicio en verde (server). Probar light/dark.

## 8. Fuera de alcance (YAGNI)

- Ventana "últimas N semanas" (sólo dejar la firma lista; se activa cuando
  Isaac recalibre).
- Export/CSV de estas tablas.
- Filtros por venue/ciudad dentro de las nuevas tablas (son org-wide).
- Romper compatibilidad de respuestas existentes.

## 9. Orden de entrega

1. Backend Tarea 0: confirmar nombres canónicos contra datos reales.
2. Backend: helpers + 2 agregaciones + reagrupar mensual + rutas/controller +
   tests (TDD) + **MCP**.
3. Frontend: service + `weekBucketsAsc` + `sortRows` + 2 tablas.
4. Verde local (build/lint/test) → PR a `develop` ligando `Closes #`/Asana.
   Merge lo da Jose.
