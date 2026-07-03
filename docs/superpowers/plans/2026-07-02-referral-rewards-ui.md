# Referral Configurable Rewards — Dashboard UI · Plan de Implementación (avoqado-web-dashboard)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** UI para configurar premios por nivel (cupón % / % permanente / producto gratis) con defaults + revelación progresiva, ver/entregar cortesías pendientes, y mostrar premios múltiples — sobre el backend ya mergeado en avoqado-server develop.

**Architecture:** Extender las pantallas existentes (`ReferralsSettings.tsx`, `ReferralCard.tsx`, `RecentReferralsTable.tsx`) — NO crear páginas nuevas. Los endpoints ya existen: `GET/PATCH /referrals/config` (ahora con `tierRewards`), `GET …/customers/:id/referrals` (ahora con `rewards[]` por referral), `POST /referrals/grants/:grantId/fulfill` (permiso `referral:fulfill-courtesy`). Spec fuente: avoqado-server `docs/superpowers/specs/2026-06-26-referral-configurable-rewards-design.md` §7 (UX) — mockup aprobado: vista de lectura en lenguaje natural + "Editar nivel" con dropdown de tipo y campos condicionales.

**Tech Stack:** React 18 + Vite, TanStack Query, Tailwind/Radix, vitest.

## Global Constraints

- **Backward compat:** el backend devuelve TAMBIÉN los campos legacy (`tier{N}RewardPercent`, `rewardDiscount`) — el UI nuevo lee `tierRewards`/`rewards[]` como fuente de verdad, pero NUNCA debe romper si faltan (venue aún sin backend nuevo desplegado → fallback a legacy).
- **PERMANENT_DISCOUNT deshabilitado con aviso:** el TPV aún no aplica descuentos automáticos en el cobro. La opción aparece en el dropdown pero DISABLED con tooltip/nota: "Requiere actualización de la terminal (próximamente)". Decisión de founder ya tomada.
- **Permisos exactos** (mismos strings que backend): `referral:read` (ver), `referral:configure` (editar config), `referral:fulfill-courtesy` (entregar cortesía). Usar `PermissionGate`/`hasPermission` como el resto de la página.
- **Feature gate:** `REFERRAL_PROGRAM` (PRO) — ya está wired en sidebar/rutas; no tocar.
- **i18n:** seguir el patrón del repo (revisar cómo ReferralsSettings maneja strings hoy — si usa i18n keys, añadir es/en; si hardcodea español, seguir igual). UI copy en español.
- **Money/percent:** major units 1:1 (15 = 15%), nunca centavos.
- **UX regla de oro (spec D4):** la vista por defecto es LECTURA en lenguaje natural ("Nivel 3 · 20 referidos → 5% permanente + 1 Sesión Iyashi gratis"); la complejidad solo aparece al editar. Nunca 15 campos a la vez.
- Después de editar: `npm run lint` (y el build check del repo). Tests con vitest donde el repo ya tenga patrón de tests para páginas; si el repo no testea páginas, smoke de build + type-check basta (documentar).
- **NO commits sin flujo aprobado**: worktree aislado, commit por tarea, SIN push.

---

### Task 1: Types + service layer

**Files:**
- Modify: `src/types/referrals.ts`
- Modify: `src/services/referrals.service.ts`

**Interfaces (Produces):** `TierReward` (`{ id, tierLevel, rewardType: 'PERCENT_COUPON'|'PERMANENT_DISCOUNT'|'FREE_PRODUCT', recurrence: 'ONE_TIME'|'MONTHLY', rewardPercent?, rewardProductId?, rewardQuantity, active }`), `ReferralRewardGrantView` (`{ id, rewardType, rewardPercent?, rewardProductId?, rewardQuantity, status, couponCode? }`); config type extendido con `tierRewards?: TierReward[]`; referral row con `rewards?: ReferralRewardGrantView[]`; service: `updateConfig` acepta `tiers?: TierRewardInput[]`; nuevo `fulfillGrant(venueId, grantId)` → `POST /referrals/grants/${grantId}/fulfill`.

- [ ] Leer los types/service actuales y extender (campos OPTIONAL — backward compat).
- [ ] `npx tsc --noEmit` (o el type-check del repo) limpio.
- [ ] Commit: `feat(referrals): types + service for tier rewards, grants and fulfill`

### Task 2: ReferralsSettings — vista de lectura en lenguaje natural

**Files:** Modify: `src/pages/Referrals/ReferralsSettings.tsx` (+ subcomponente nuevo `components/TierRewardSummary.tsx` si el archivo crece)

- [ ] En la vista activa (read-only), por cada nivel renderizar la frase natural desde `tierRewards` (agrupar por tierLevel, solo `active`): "Nivel N · X referidos → <premios unidos por ' + '>" donde cupón % = "Y% en su próxima compra", permanente = "Y% permanente", producto = "N× <nombre del producto> gratis" (resolver nombre del producto vía el catálogo que la página ya tenga a mano o fetch de producto; si no hay nombre, mostrar cantidad + "producto"). Fallback: si `tierRewards` viene vacío/ausente → renderizar como hoy (legacy %).
- [ ] Verificar en build + (si hay patrón) test de render con config mock.
- [ ] Commit: `feat(referrals): natural-language tier reward summary`

### Task 3: ReferralsSettings — editor de nivel (dropdown + campos condicionales)

**Files:** Modify: `src/pages/Referrals/ReferralsSettings.tsx` + Create: `src/pages/Referrals/components/TierRewardEditor.tsx`

- [ ] "Editar nivel" (por nivel, gated `referral:configure`): umbral de referidos + lista de premios del nivel; cada premio = dropdown Tipo (`Cupón de descuento` / `Descuento permanente` **disabled + nota TPV** / `Producto gratis`) + campos condicionales (cupón/permanente → % ; producto → selector de producto del catálogo + cantidad + recurrencia `una vez`/`cada mes` con nota "entrega manual") + botón "Agregar otro premio" + quitar.
- [ ] Guardar → `updateConfig` con `tiers` (TODOS los premios activos del nivel editado; el backend versiona). Optimistic/invalidate query como el resto de la página.
- [ ] La sección de activación con defaults pre-cargados (7/12/20 + cupones 15/20/25) se mantiene — al activar sin tocar nada, mandar esos defaults como `tiers`.
- [ ] Verificar build/lint + flujo manual descrito en el reporte.
- [ ] Commit: `feat(referrals): per-tier reward editor with progressive disclosure`

### Task 4: ReferralCard — cortesías pendientes + entregar

**Files:** Modify: `src/pages/Customers/components/ReferralCard.tsx`

- [ ] Mostrar los `rewards[]` del cliente referidor (de `getCustomerReferrals`): badge por premio con estado; los `FREE_PRODUCT` en `MANUAL_PENDING` → bloque "Cortesía pendiente" con botón **"Marcar entregada"** (gated `referral:fulfill-courtesy`) → `fulfillGrant` → invalidate + toast. `MANUAL_FULFILLED` → check con fecha.
- [ ] Estados legacy sin `rewards[]` → card como hoy (sin romper).
- [ ] Commit: `feat(referrals): pending courtesy display + fulfill action on customer card`

### Task 5: RecentReferralsTable multi-premio + cierre

**Files:** Modify: `src/pages/Referrals/components/RecentReferralsTable.tsx`

- [ ] Columna de premio: si el referral trae `rewards[]`, mostrar chips por premio (tipo+valor); fallback al `rewardDiscount` legacy.
- [ ] Suite del repo: `npm run lint` + type-check + build verde; smoke manual del flujo completo documentado en el reporte.
- [ ] Commit: `feat(referrals): multi-reward display in referrals table`

## Fuera de alcance
- WhatsApp automático, captura manual de referidos en dashboard, FREE_PRODUCT automático (v2 del spec).
- TPV "Cobrar" auto-descuentos (repo avoqado-tpv, tarea aparte ya autorizada).
- Presentación de ventas (al decidir venderlo).

## Self-Review
- Cobertura: spec §7 dashboard = Tasks 2–3; fulfill = Task 4; m4 (multi-reward tabla) = Task 5; tipos/servicio = Task 1. PERMANENT_DISCOUNT disabled = decisión founder ejecutada (Task 3).
- Sin placeholders; señales de fallback legacy en cada task (backward compat).
