# Candado: "Revisar por promotor" nunca sin comentario

**Asana**: [1217299209026114](https://app.asana.com/1/12709793723059/project/1213523434401320/task/1217299209026114) · [Dashboard] · Prioridad Media · pedido por Isaac Mayoral
**Fecha**: 2026-08-09
**Repos**: `avoqado-server` (fuente de verdad) + `avoqado-web-dashboard` (UI). **`avoqado-tpv` NO se toca.**

## Problema

Una venta puede quedar en estado `FAILED` ("Revisar por promotor") **sin una sola instrucción de qué corregir**. El promotor
la ve en rojo en su TPV y no sabe qué hacer; el reporte que se le entrega a Walmart sale con la razón vacía.

### Causa raíz (verificada en la BD de producción, 2026-08-09)

Hay tres caminos para llegar a `FAILED`. El hueco está en el de **"Editar"**:

| # | Camino | Validación hoy | ¿Fuga? |
|---|---|---|---|
| A | "Marcar para revisar" → `ReviewSaleDialog` (modo `reject`) | exige ≥1 checkbox **O** texto | Teórica: un checkbox pelón pasa sin texto |
| B | "Editar venta" → Estado = Revisar por promotor (`EditSaleDialog`) | **ninguna** | **Real: es la que reportó Isaac** |
| C | MCP `edit_sale_verification` | **ninguna** | Real, mismo hueco que B |

El "Motivo del cambio" que sí pide el diálogo de Editar es un campo de **auditoría** — se guarda en `ActivityLog`,
nunca llega al promotor. Peor: el backend **borra activamente** lo que hubiera:

```ts
// sale-verification.org.dashboard.service.ts:1345
// FAILED / REJECTED: stamp reviewer, clear stale notes/reasons (P1 doesn't collect a promoter note on edit)
{ reviewedById: params.editedById, reviewedAt: new Date(), reviewNotes: null, rejectionReasons: [] }
```

### Evidencia en producción

De 46 ventas en `FAILED`, **4 están completamente en blanco** (sin texto y sin motivos). Las 4:

- vinieron del camino B (`ActivityLog.action = 'SALE_VERIFICATION_EDIT'`),
- las hizo Daniel Samperio el 2026-08-03,
- todas en BAE MEZQUITAL (1298),
- una de ellas es el ICCID `8952140064479454713F` — literalmente el renglón del screenshot de Isaac.

Las otras 42 sí traen texto → **el camino A funciona bien en la práctica** (0 casos de checkbox-sin-texto). Apretarlo
es seguro barato, no una disrupción del flujo diario.

## La regla

> Para dejar una venta en `FAILED` ("Revisar por promotor") se exige `reviewNotes` con **≥5 caracteres** (tras `trim`).
> Los `rejectionReasons` (checkboxes) siguen **opcionales**: categorizan para el reporte a Walmart, no bloquean.

**Por qué el texto y no el checkbox:** el promotor necesita saber *cuál* imagen está ilegible, no sólo que algo lo está.
Un checkbox solo nunca le dice qué corregir — que es justo el reclamo. Y `OTHER` sin texto es cero información.

El mínimo de 5 caracteres reusa el umbral que ya existe para el "Motivo del cambio" del mismo diálogo — un solo número
que recordar en todo el flujo.

### Fuera de alcance (decisión explícita del founder)

`REJECTED` ("Rechazada") **no se toca**: su motivo sigue opcional en los dos caminos. Dato para el reporte a Isaac:
**52 de 58** ventas rechazadas están hoy sin razón alguna. Si lo quiere, es otra tarea.

## Cambios

### `avoqado-server` — 3 puntos, una sola regla

1. **`reviewSaleVerification()`** — `src/services/dashboard/sale-verification.dashboard.service.ts:511`.
   `if (decision === 'REJECT' && reasons.length === 0 && !trimmedNotes)` → pasa a exigir `trimmedNotes` con ≥5 chars.
   Cubre venue **y** org (`reviewOrgSaleVerification` reusa esta función).
2. **`editOrgSaleVerification()`** — `src/services/dashboard/sale-verification.org.dashboard.service.ts:1267`.
   - Acepta dos parámetros nuevos: `reviewNotes?: string`, `rejectionReasons?: SaleVerificationRejectionReason[]`.
   - Valida ≥5 chars **sólo cuando** `nextStatus === 'FAILED'`.
   - **Deja de borrarlos**: la rama `reviewMeta` de `FAILED` persiste lo recibido en vez de `null`/`[]`.
     La rama de `REJECTED` se queda igual (fuera de alcance).
   - El payload del socket `SALE_VERIFICATION_REVIEWED` ya manda `reviewNotes`/`rejectionReasons` → el promotor recibe
     el motivo en tiempo real sin tocar la TPV.
3. **MCP** — `src/mcp/tools/saleVerifications.ts`: mismo candado y mismo mensaje en `review_sale_verification` y
   `edit_sale_verification` (CLAUDE.md: el MCP se actualiza en el MISMO cambio, nunca "después"). Actualizar también
   el `.describe()` de los parámetros para que el agente sepa que ahora es obligatorio.

**Mensajes de error en español** (los ve el usuario crudos). Texto único, reusado en los 3 puntos:
`"Para dejar la venta en \"Revisar por promotor\" escribe qué debe corregir el promotor (mínimo 5 caracteres)."`

**Convención de error:** seguir el `createServiceError(message, 400)` local del archivo. Estos controllers hacen
`res.status(error.statusCode || 500)` en su propio `catch`, así que el 400 sí llega legible — no aplica aquí la regla
de `AppError` (que existe para rutas que delegan al handler global).

### `avoqado-web-dashboard` — 3 archivos

4. **Nuevo** `src/components/sale-verification/ReviewReasonsFields.tsx` — componente compartido con los checkboxes de
   motivos + el textarea obligatorio (contador 500, mín. 5) + su mensaje de validación. Un solo lugar donde viven las
   etiquetas y la regla. Expone `{ reasons, notes, isValid }` al padre.
5. **`ReviewSaleDialog`** (`src/pages/playtelecom/Sales/components/ReviewSaleDialog.tsx`) — el modo `reject` consume el
   componente. La etiqueta pasa de *"Observaciones (opcional)"* a *"Observaciones \*"*; el botón "Marcar para revisar"
   se deshabilita hasta que haya texto válido. Modos `approve` y `mark-rejected` **intactos**.
6. **`EditSaleDialog`** (`src/pages/organizations/SalesDetail/components/EditSaleDialog.tsx`) — al elegir
   Estado = "Revisar por promotor" se despliega el mismo bloque debajo del select. "Motivo del cambio" (auditoría) se
   queda aparte y sigue obligatorio. Si el usuario regresa a otro estado, el bloque se colapsa y no se envía.
   `EditOrgSaleParams` gana los dos campos opcionales.

### Nota de contrato

Esto **endurece** un endpoint existente: una llamada a `review` que hoy manda sólo checkboxes empezará a recibir 400.
Es intencional y es el punto de la tarea. No rompe compatibilidad de lectura: no se quita ni renombra ningún campo de
respuesta, y los dos parámetros nuevos del `edit` son opcionales. Ningún cliente fuera del dashboard y el MCP usa el
camino de revisión (la TPV sólo lee).

## Pruebas (TDD — obligatorio: toca estado de verificación de venta)

**Server** (`sale-verification.dashboard.service` / `.org.dashboard.service`):
- `REJECT` con checkbox pero sin texto → 400 (hoy pasa: es el test que falla antes del fix).
- `REJECT` con texto <5 chars → 400.
- `REJECT` con texto válido → `FAILED` + `reviewNotes` persistido.
- `edit` a `FAILED` sin `reviewNotes` → 400.
- `edit` a `FAILED` con texto → persiste `reviewNotes` **y** `rejectionReasons` (regresión directa del bug: hoy los borra).
- `edit` a `COMPLETED`/`PENDING` sin `reviewNotes` → sigue pasando (no se rompe el flujo normal).
- `edit` a `REJECTED` sin motivo → sigue pasando (fuera de alcance, blindar que no se coló).

**Dashboard** (vitest + testing-library):
- `EditSaleDialog`: el bloque aparece sólo con `FAILED`; submit bloqueado sin texto; el payload lleva los dos campos.
- `ReviewSaleDialog`: submit bloqueado con checkbox y sin texto.

## Datos existentes

**No hay migración.** Los 4 renglones en blanco no se pueden rellenar automáticamente — nadie sabe qué le faltaba a cada
venta. Con el fix, Daniel/Isaac los corrigen desde el mismo diálogo de "Editar" en un minuto. Los 4 ids van en el
comentario de Asana para que sea copy-paste.

## Decisiones asumidas (vetables)

- **Tier**: ninguno. Es endurecimiento de validación dentro de un flujo que ya existe (módulo `SERIALIZED_INVENTORY`,
  vertical PlayTelecom); no expone capacidad nueva, así que no se toca `plan-catalog.ts` ni se agrega `FeatureGate`.
- **Presentación de ventas**: exenta. No hay capacidad nueva visible al cliente — es un bugfix/hardening.
- **i18n**: los textos nuevos viven en pantallas PlayTelecom/org, que hoy son español hardcodeado igual que el resto del
  archivo. Se mantiene la convención local del archivo, no se introduce `t()` sólo en estas líneas.

## Definition of Done

- [ ] Test de regresión que falla sin el fix y pasa con él (el `edit` a `FAILED` que hoy borra los motivos)
- [ ] `npm run build` + `npm run lint` verdes en ambos repos
- [ ] MCP actualizado en el mismo cambio
- [ ] Los 4 ids en blanco reportados a Isaac en Asana, junto con el dato de las 52 "Rechazada" sin razón
- [ ] Revisión de Jose antes de merge (política de `bug-fix-workflow.md`)
