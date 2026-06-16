# ADMIN edita ventas (org SalesDetail) — Diseño

- **Fecha:** 2026-06-13
- **Asana:** [Permitir editar ventas a ADMIN desde Dashboard](https://app.asana.com/1/12709793723059/project/1213523434401320/task/1215677904344478) — Bait <> Play Telecom · `[Dashboard]` · Prioridad Alta
- **Repos:** `avoqado-server` (endpoint + lógica) y `avoqado-web-dashboard` (UI)
- **Alcance acordado:** **Edición completa** (todos los campos) con **selector de estado** en el modal.

---

## 1. Problema

En el flujo de verificación de ventas SIM (PlayTelecom/Bait), una venta puede quedar
en estado **FAILED** (badge amarillo "Revisar") cuando back-office la rechaza pidiendo
al promotor que corrija algo en el TPV. Si el **promotor ya salió de la empresa**, nadie
puede corregirla: la venta queda atorada para siempre.

Hoy, en la columna **Acciones** de `SalesDetail.tsx`:

- `PENDING` → botones *Aprobar* / *Revisar*
- `COMPLETED` → *Reabrir* (solo OWNER)
- **`FAILED` → ninguna acción.** Solo el promotor (en el TPV) podía resolverla.

Caso real (foto del ticket): venta de Ignacio Mitre marcada *"Otro motivo — me ayudas a
corregir la forma de pago, aquí pusiste gratis, pero en su momento fue un ESIM $100"*.
Ignacio ya no está → hay que dejar que un **ADMIN** corrija la venta y la destrabe.

## 2. Objetivo

Permitir que un **ADMIN** edite **cualquier venta** (cualquier estado) desde el dashboard:
corregir sus datos y fijar su estado final, con **motivo obligatorio** y **auditoría**.

## 3. No-objetivos

- **No** se recalculan comisiones. **PlayTelecom no usa el sistema de comisiones de
  Avoqado** (módulo COMMISSIONS habilitado pero con `config: {}`, sin `CommissionConfig`;
  la creación de `CommissionCalculation` está gateada: `if (configs.length === 0) return []`).
  Por lo tanto editar monto/promotor **no deja comisiones obsoletas** para este cliente.
  *(Insurance para otros orgs — ver §6.7.)*
- **No** se tocan `paymentId`, `venueId`, ni `createdAt` (inmutables).
- **No** es feature de tier (FREE/PRO/…). Es capacidad de back-office white-label,
  gateada por **rol/permiso**.

## 4. Hallazgos del sistema actual (contexto para el plan)

- Los gráficos de "Ventas" (confirmedRevenue, by-month, by-promoter, etc.) se calculan
  **en tiempo de query** desde `Payment.amount` + `SaleVerification.status` + `staffId`.
  → Editar esos campos **autocorrige todos los gráficos**. No hay caché.
- **"Forma de pago" es derivada, no almacenada:** `derivePaymentForm(Payment.method)`.
  `Payment` solo tiene `method` (enum `PaymentMethod`). "Gratis" = `amount === 0`.
- **`saleType` es derivado** de `SaleVerification.isPortabilidad` (`deriveSaleType`).
  eSIM es una **categoría** (Tipo de SIM), no un tipo de venta.
- **Tipo de SIM** = `SerializedItem.categoryId`, vía `Payment → Order → OrderItem →
  SerializedItem → ItemCategory`.
- Patrón de transacción a imitar: `refund.dashboard.service.ts` (`prisma.$transaction`
  con `SELECT … FOR UPDATE` del Payment).
- El modelo `ActivityLog` existe pero **no se usa** para sale-verifications hoy.

## 5. Mapa campo → registro

| Campo en el modal | Qué se escribe en BD |
|---|---|
| Monto | `Payment.amount` |
| Forma de pago | `Payment.method` (reverse-map, ver §6.5); "Gratis" ⇒ `amount = 0` |
| Tipo de venta (Línea/Portabilidad) | `SaleVerification.isPortabilidad` (saleType se deriva) |
| Tipo de SIM | `SerializedItem.categoryId` (1 SerializedItem por venta) |
| Promotor | `SaleVerification.staffId` |
| ICCID / SIMs | `SaleVerification.serialNumbers[]` (ver nota §6.6) |
| Evidencias (fotos) | `SaleVerification.photos[]` (Firebase) |
| Estado | `SaleVerification.status` (+ metadata de revisión, ver §6.4) |
| Motivo (obligatorio) | `ActivityLog` + log de servidor |

## 6. Backend (`avoqado-server`)

### 6.1 Endpoint + permiso
- `PATCH /api/v1/dashboard/organizations/:orgId/sale-verifications/:id`
  - Nuevo handler en `sale-verification.org.dashboard.controller.ts` + servicio
    `editOrgSaleVerification(orgId, id, params, editedById)` en
    `sale-verification.org.dashboard.service.ts` (valida que la verificación
    pertenece al org, igual que `reopenOrgSaleVerification`).
- Nuevo permiso **`sale-verifications:edit`** en `src/lib/permissions.ts`, otorgado a
  **OWNER + SUPERADMIN**. Ruta gateada con `checkPermission('sale-verifications:edit')`.
  - **Por qué OWNER (no ADMIN):** esta pantalla (org `SalesDetail`) vive bajo
    `OwnerProtectedRoute` → **solo OWNER (de ese org) + SUPERADMIN** pueden abrirla; un
    ADMIN de venue ni siquiera la ve. El "ADMIN" del ticket de Isaac es coloquial = los
    administradores de back-office, que en PlayTelecom son OWNERs (Isaac, Daniel). Mismo
    nivel y audiencia que el flujo *Reabrir* (`sale-verifications:reopen`, también OWNER-only).
    Permiso propio (no reusar `:reopen`) para poder otorgarlo aparte si algún día se
    quiere editar desde una pantalla por-venue (ver §11.5).

### 6.2 Body (todos opcionales salvo `reason`)
`{ amount?, paymentForm?, isPortabilidad?, categoryId?, staffId?, serialNumbers?, photos?, status?, reason }`
- Validación con Zod, **mensajes en español** (se muestran crudos al usuario vía
  `validation.ts`). `reason` mínimo 5 caracteres (paridad con reopen).

### 6.3 Transacción (qué escribe)
Dentro de un `prisma.$transaction` con `FOR UPDATE` del Payment:
1. Validar verificación ∈ org; cargar Payment + Order→OrderItem→SerializedItem.
2. `Payment`: `amount`, `method` (si vienen).
3. `SaleVerification`: `isPortabilidad`, `staffId`, `serialNumbers`, `photos`, `status` (+ §6.4).
4. `SerializedItem.categoryId` (si viene `categoryId`).
5. `ActivityLog` (§6.6 audit).
Efectos secundarios fuera de la tx (fire-and-forget): emitir socket de refresco si aplica.

### 6.4 Semántica del estado (selector)
El ADMIN elige el estado final; default **COMPLETED ("Venta correcta")**:
- **COMPLETED:** `reviewedById = editor`, `reviewedAt = now`, `rejectionReasons = []`.
- **PENDING:** limpiar metadata de revisión (como reopen).
- **FAILED ("Revisar"):** permitir `reviewNotes`/`rejectionReasons` opcionales; `reviewedById = editor`.

### 6.5 Mapeo forma de pago → method
La UI ofrece 3 buckets (+ "Gratis" implícito por monto = 0). Reverse-map:
- Efectivo → `CASH`
- Tarjeta → `CREDIT_CARD` *(canónico; confirmar vs `DEBIT_CARD`)*
- Otro → `OTHER`
Round-trip estable porque `derivePaymentForm(CREDIT_CARD) = CARD`.

### 6.6 Nota ICCID (decisión de implementación)
`SaleVerification.serialNumbers[]` es lo que muestra el dashboard, pero el serial canónico
de inventario vive en `SerializedItem.serialNumber` (con unicidad). **Decidir en P3:** editar
ICCID solo actualiza `serialNumbers` (display) **o** también `SerializedItem.serialNumber`
(registro de inventario). Recomendación: P3 edita solo `serialNumbers` salvo que se confirme
que se necesita re-vincular el inventario.

### 6.7 Auditoría + insurance comisiones
- `ActivityLog`: `action: 'SALE_VERIFICATION_EDIT'`, `entity: 'SaleVerification'`,
  `entityId: id`, `staffId: editor`, `data: { before, after, reason }`. + `logger.info`.
- Insurance: si existe alguna `CommissionCalculation` para ese `paymentId` (no aplica a
  PlayTelecom, sí podría a "Walmart"), incluir esa señal en el `ActivityLog`/respuesta
  como aviso — **sin** recalcular.

## 7. Frontend (`avoqado-web-dashboard`)

### 7.1 Botón "Editar"
- En la columna **Acciones** de `SalesDetail.tsx` (tabla desktop **y** `SaleCard` mobile),
  visible en **todos** los estados.
- Gating por rol **idéntico a `canReopen`** hoy (`useAccess()` está deshabilitado en el
  portal org porque no hay `venueId`): mostrar si `user.role ∈ {OWNER, SUPERADMIN}`. El
  backend igual valida `sale-verifications:edit`. (La página ya es OWNER+SUPERADMIN por
  `OwnerProtectedRoute`, así que esto solo controla la visibilidad del botón.)

### 7.2 Modal de edición
- **`FullScreenModal`** (el número de campos lo justifica; los Dialogs vecinos son más chicos).
- Campos: Monto (**clearable number input** per `ui-patterns.md`), Forma de pago (select),
  Tipo de venta (Línea/Portabilidad), Tipo de SIM (select de categorías), Promotor (select),
  ICCID/SIMs (lista editable), Evidencias (subida de imágenes), **Estado** (select, default
  *Venta correcta*), **Motivo** (textarea, requerido, ≥5).
- Prefill con los valores actuales de la fila (`OrgSaleRow`).
- Cliente de servicio nuevo: `editOrgSaleVerification(orgId, id, params)` en
  `saleVerification.org.service.ts`.
- On success: `invalidateQueries(['org', orgId, 'sale-verifications'])` +
  `['org', orgId, 'sales-summary']` (igual que reopen).

### 7.3 Pickers / subida
- **Tipo de SIM:** existe endpoint org-scoped (`orgItemCategory.routes.ts`) → cliente nuevo.
- **Promotor:** **no** existe endpoint de lista de promotores del org (solo agregaciones) →
  **agregar** `GET …/sale-verifications/promoters` (o reusar staff del org) en P2.
- **Fotos:** reusar `src/hooks/use-image-uploader.tsx` (Firebase). Ruta:
  `venues/{venueId}/verificaciones/{paymentId}/*`.

### 7.4 i18n
- **Exento de `t()`** — `SalesDetail.tsx` ya está en español hardcodeado (pantalla
  back-office white-label). Mantener consistencia.

## 8. Cross-cutting

- **MCP (obligatorio):** agregar tool en `avoqado-server/scripts/mcp/` para corregir una
  venta (p.ej. `edit_sale_verification`), espejando el endpoint. *(Nota: review/reopen
  tampoco tienen tool hoy — esta sería la primera de escritura para sale-verifications.)*
- **Deck de ventas:** **exento** (herramienta interna de back-office, no es capacidad
  vendible nueva).
- **Tier-gating:** N/A (gateado por permiso, no por tier).

## 9. Plan de pruebas (bug-fix-workflow: test de regresión obligatorio)

- **Backend:** test de `editOrgSaleVerification` — (a) actualiza Payment + SaleVerification +
  SerializedItem en una tx; (b) `403` sin `sale-verifications:edit`; (c) crea `ActivityLog`.
- **E2E (Playwright):** una venta **FAILED** muestra el botón *Editar*; al editar monto +
  forma de pago + estado=Venta correcta, la fila pasa a "Venta correcta" y desaparece de
  "Por revisar". (Falla sin el fix → pasa con el fix.)
- Verificar light/dark y que no se rompe el flujo Aprobar/Revisar/Reabrir existente.

## 10. Orden de construcción sugerido (aunque el alcance sea completo)

- **P1:** permiso + endpoint + botón + modal con Monto / Forma de pago / Tipo de venta /
  Estado / Motivo + auditoría + tests. *(Resuelve el caso de Isaac.)*
- **P2:** Promotor (nuevo endpoint de lista) + Tipo de SIM (categoría).
- **P3:** ICCID + Evidencias (subida de fotos).
- **P-final:** MCP tool.

## 11. Decisiones a confirmar en implementación

1. Tarjeta → `CREDIT_CARD` vs `DEBIT_CARD` (§6.5).
2. ICCID: solo `serialNumbers` vs también `SerializedItem.serialNumber` (§6.6).
3. Endpoint de lista de promotores del org: nuevo vs reusar (§7.3).
4. Estado=FAILED desde el editor: ¿exigir `rejectionReasons` o dejar libre? (§6.4).
5. ¿Exponer también edición en la pantalla **por-venue** (`playtelecom/Sales`) para ADMIN
   de tienda? Isaac pidió el dashboard **org** (OWNER) → **default: NO**. Si en el futuro
   sí, se otorga `sale-verifications:edit` a ADMIN y se agrega el botón en esa pantalla
   (que sí es accesible a ADMIN+).
