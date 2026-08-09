# Candado "Revisar por promotor" nunca sin comentario — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que sea imposible dejar una venta en estado `FAILED` ("Revisar por promotor") sin un comentario de ≥5 caracteres que le diga al promotor qué corregir, por los tres caminos que existen (diálogo de revisión, diálogo de editar, y MCP).

**Architecture:** El backend es la fuente de verdad: un helper único (`assertPromoterFeedback`) vive en `sale-verification.dashboard.service.ts` y lo consumen los dos servicios y las dos herramientas MCP. El dashboard replica la regla en un componente compartido (`ReviewReasonsFields`) que consumen los dos diálogos, para que el usuario vea el error antes de mandar la petición. La TPV no se toca: ya lee `reviewNotes`/`rejectionReasons` y el socket ya se los manda.

**Tech Stack:** `avoqado-server` (Express + TypeScript + Prisma, tests con **jest**) · `avoqado-web-dashboard` (React 18 + Vite + TypeScript, tests con **vitest** + testing-library)

**Spec:** `docs/superpowers/specs/2026-08-09-candado-comentario-revisar-promotor-design.md`

## Global Constraints

- **Git read-only.** NO commitear, NO `git checkout/switch/stash/reset`, NO crear ramas ni worktrees. Todo queda en el árbol de trabajo. Hay otras sesiones de IA trabajando en paralelo en estos mismos repos — si ves archivos modificados que no tocaste, es WIP ajeno: déjalo en paz.
- **Mínimo de caracteres = 5.** Un solo número en todo el flujo. Reusa el umbral que ya existe para el "Motivo del cambio".
- **Mensaje de error único, en español** (el usuario lo ve crudo):
  `Para dejar la venta en "Revisar por promotor" escribe qué debe corregir el promotor (mínimo 5 caracteres).`
- **`REJECTED` ("Rechazada") NO se toca.** Su motivo sigue siendo opcional en todos los caminos. Decisión explícita del founder. Si un test existente de `REJECT_FINAL` empieza a fallar, el fix está mal.
- **Errores del server:** usa el `createServiceError(mensaje, 400)` local de cada archivo. NO introduzcas `AppError` aquí — estos controllers hacen `res.status(error.statusCode || 500)` en su propio `catch` y el 400 sí llega legible.
- **i18n:** estas pantallas (PlayTelecom / org) son español hardcodeado hoy. Mantén la convención del archivo; NO metas `t()` sólo en estas líneas.
- **No quites ni renombres campos de respuesta de la API.** Los parámetros nuevos son opcionales.

## File Structure

**`avoqado-server`**

| Archivo | Responsabilidad |
|---|---|
| `src/services/dashboard/sale-verification.dashboard.service.ts` | **Dueño de la regla.** Exporta `PROMOTER_FEEDBACK_MIN_CHARS`, `PROMOTER_FEEDBACK_REQUIRED_MESSAGE` y `assertPromoterFeedback()`. Aplica el candado en `reviewSaleVerification` (camino A). |
| `src/services/dashboard/sale-verification.org.dashboard.service.ts` | Aplica el candado en `editOrgSaleVerification` (camino B) y **deja de borrar** `reviewNotes`/`rejectionReasons`. |
| `src/controllers/dashboard/sale-verification.org.dashboard.controller.ts` | Pasa los dos campos nuevos del body al servicio y valida que los motivos sean del enum. |
| `src/mcp/tools/saleVerifications.ts` | Camino C: mismo candado en `review_sale_verification` y `edit_sale_verification`. |
| `tests/unit/services/dashboard/sale-verification.review.test.ts` | Tests del camino A (ya existe, se extiende). |
| `tests/unit/services/dashboard/sale-verification.org.edit-feedback.test.ts` | **Nuevo.** Tests del camino B. |

**`avoqado-web-dashboard`**

| Archivo | Responsabilidad |
|---|---|
| `src/components/sale-verification/ReviewReasonsFields.tsx` | **Nuevo.** Componente controlado: checkboxes de motivos + textarea obligatorio + mensaje de error. Exporta también `PROMOTER_FEEDBACK_MIN_CHARS` e `isPromoterFeedbackValid()`. |
| `src/components/sale-verification/ReviewReasonsFields.test.tsx` | **Nuevo.** Tests del componente. |
| `src/pages/playtelecom/Sales/components/ReviewSaleDialog.tsx` | Consume el componente en el modo `reject`. Modos `approve` y `mark-rejected` intactos. |
| `src/pages/organizations/SalesDetail/components/EditSaleDialog.tsx` | Despliega el componente cuando Estado = `FAILED`. |
| `src/pages/organizations/SalesDetail/components/EditSaleDialog.test.tsx` | **Nuevo.** Tests del diálogo. |
| `src/services/saleVerification.org.service.ts` | `EditOrgSaleParams` gana los dos campos opcionales. |

---

### Task 1: La regla, y el candado en el camino A (diálogo de revisión)

**Files:**
- Modify: `avoqado-server/src/services/dashboard/sale-verification.dashboard.service.ts:461-512`
- Test: `avoqado-server/tests/unit/services/dashboard/sale-verification.review.test.ts`

**Interfaces:**
- Consumes: nada (primera tarea).
- Produces:
  - `export const PROMOTER_FEEDBACK_MIN_CHARS = 5`
  - `export const PROMOTER_FEEDBACK_REQUIRED_MESSAGE: string`
  - `export function assertPromoterFeedback(reviewNotes?: string | null): string` — devuelve el texto trimmeado, o lanza un error con `statusCode = 400`.

- [ ] **Step 1: Escribe los tests que fallan**

En `tests/unit/services/dashboard/sale-verification.review.test.ts`, **reemplaza** el test existente `'rejects REJECT with no reasons and no notes (must give feedback)'` (línea ~207) por estos tres:

```ts
  it('rejects REJECT with no reasons and no notes (must give feedback)', async () => {
    mockedFindUnique.mockResolvedValue(baseExisting)

    await expect(
      reviewSaleVerification(VENUE_ID, {
        saleVerificationId: VERIFICATION_ID,
        reviewedById: REVIEWER_ID,
        decision: 'REJECT',
        rejectionReasons: [],
        reviewNotes: '   ',
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/mínimo 5 caracteres/i) })

    expect(mockedUpdate).not.toHaveBeenCalled()
    expect(mockedBroadcast).not.toHaveBeenCalled()
  })

  it('rejects REJECT with reasons but NO notes (un checkbox pelón no le dice al promotor qué corregir)', async () => {
    mockedFindUnique.mockResolvedValue(baseExisting)

    await expect(
      reviewSaleVerification(VENUE_ID, {
        saleVerificationId: VERIFICATION_ID,
        reviewedById: REVIEWER_ID,
        decision: 'REJECT',
        rejectionReasons: ['REVIEW_ILLEGIBLE_IMAGES'],
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/mínimo 5 caracteres/i) })

    expect(mockedUpdate).not.toHaveBeenCalled()
  })

  it('rejects REJECT when notes are shorter than 5 chars', async () => {
    mockedFindUnique.mockResolvedValue(baseExisting)

    await expect(
      reviewSaleVerification(VENUE_ID, {
        saleVerificationId: VERIFICATION_ID,
        reviewedById: REVIEWER_ID,
        decision: 'REJECT',
        rejectionReasons: ['REVIEW_ILLEGIBLE_IMAGES'],
        reviewNotes: 'mal',
      }),
    ).rejects.toMatchObject({ statusCode: 400 })

    expect(mockedUpdate).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Corre los tests y verifica que fallan**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx jest tests/unit/services/dashboard/sale-verification.review.test.ts
```

Esperado: los 3 tests nuevos FALLAN. El primero falla porque el mensaje actual es `"Rejection requires at least one reason or notes"`; el segundo y tercero fallan porque hoy la llamada **pasa** (no lanza).
Los otros 9 tests del archivo deben seguir PASANDO — en especial los dos de `REJECT_FINAL` (fuera de alcance).

- [ ] **Step 3: Agrega el helper**

En `sale-verification.dashboard.service.ts`, justo **después** de la función `createServiceError` (línea ~465):

```ts
/** Mínimo de caracteres del comentario que el promotor lee en su TPV. */
export const PROMOTER_FEEDBACK_MIN_CHARS = 5

/** Mensaje único del candado (en español: el usuario lo ve crudo). */
export const PROMOTER_FEEDBACK_REQUIRED_MESSAGE =
  'Para dejar la venta en "Revisar por promotor" escribe qué debe corregir el promotor (mínimo 5 caracteres).'

/**
 * Candado de "Revisar por promotor": una venta no puede quedar en FAILED sin un
 * comentario que le diga al promotor QUÉ corregir. Los `rejectionReasons`
 * (checkboxes) son opcionales — categorizan para el reporte a Walmart, pero un
 * checkbox solo no dice cuál imagen está mal.
 *
 * NO aplica a REJECTED ("Rechazada"): esa es terminal y el promotor no la corrige.
 *
 * @returns el texto ya trimmeado, listo para guardar.
 * @throws error con statusCode 400 si no alcanza el mínimo.
 */
export function assertPromoterFeedback(reviewNotes?: string | null): string {
  const trimmed = reviewNotes?.trim() ?? ''
  if (trimmed.length < PROMOTER_FEEDBACK_MIN_CHARS) {
    throw createServiceError(PROMOTER_FEEDBACK_REQUIRED_MESSAGE, 400)
  }
  return trimmed
}
```

- [ ] **Step 4: Aplica el candado en `reviewSaleVerification`**

Reemplaza el bloque de validación (línea ~508-513):

```ts
  const trimmedNotes = params.reviewNotes?.trim() || null
  const reasons = params.rejectionReasons ?? []

  if (params.decision === 'REJECT' && reasons.length === 0 && !trimmedNotes) {
    throw createServiceError('Rejection requires at least one reason or notes', 400)
  }
```

por:

```ts
  const reasons = params.rejectionReasons ?? []

  // Candado: "Revisar por promotor" (FAILED) SIEMPRE lleva comentario.
  // REJECT_FINAL ("Rechazada") sigue con motivo opcional a propósito.
  if (params.decision === 'REJECT') {
    assertPromoterFeedback(params.reviewNotes)
  }

  const trimmedNotes = params.reviewNotes?.trim() || null
```

- [ ] **Step 5: Actualiza el docblock de la función**

En el comentario de `reviewSaleVerification` (línea ~478), cambia la línea:

```
 *   - REJECT requires at least one rejectionReason OR reviewNotes (not silent rejection)
```

por:

```
 *   - REJECT requires reviewNotes with >= PROMOTER_FEEDBACK_MIN_CHARS chars (never a silent
 *     "revisar" — the promoter must know WHAT to fix). rejectionReasons stay optional.
```

Y en la lista de decisiones (línea ~472), cambia `reviewNotes optional but encouraged` por `reviewNotes REQUIRED (>=5 chars)`.

- [ ] **Step 6: Corre los tests y verifica que pasan**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx jest tests/unit/services/dashboard/sale-verification.review.test.ts
```

Esperado: los 12 tests PASAN.

- [ ] **Step 7: Verifica que no rompiste el resto del módulo**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx tsc --noEmit -p tsconfig.json
```

Esperado: sin errores. **NO commitees** (ver Global Constraints).

---

### Task 2: Candado + persistencia en el camino B (editar venta)

Este es el bug que reportó Isaac: hoy el servicio **borra activamente** `reviewNotes` y `rejectionReasons` al pasar una venta a `FAILED` desde "Editar".

**Files:**
- Modify: `avoqado-server/src/services/dashboard/sale-verification.org.dashboard.service.ts:1267-1350`
- Modify: `avoqado-server/src/controllers/dashboard/sale-verification.org.dashboard.controller.ts:313-360`
- Test: `avoqado-server/tests/unit/services/dashboard/sale-verification.org.edit-feedback.test.ts` (nuevo)

**Interfaces:**
- Consumes: `assertPromoterFeedback`, `PROMOTER_FEEDBACK_MIN_CHARS`, `PROMOTER_FEEDBACK_REQUIRED_MESSAGE` (Task 1).
- Produces: `editOrgSaleVerification(orgId, params)` donde `params` gana dos campos opcionales:
  - `reviewNotes?: string`
  - `rejectionReasons?: SaleVerificationRejectionReason[]`

**Regla exacta de este camino** (más sutil que el camino A, léela antes de escribir código):

El candado aplica cuando **el estado resultante es `FAILED`**, pero se satisface con el comentario **entrante O el ya guardado**:

| Caso | ¿Pasa? |
|---|---|
| Venta PENDING → FAILED, sin comentario | ❌ 400 |
| Venta PENDING → FAILED, con comentario | ✅ guarda notes + reasons |
| Venta ya FAILED **con** comentario, editas sólo el monto | ✅ conserva el comentario viejo (editar el monto no debe borrar el motivo) |
| Venta ya FAILED **sin** comentario (los 4 renglones legacy), editas cualquier cosa | ❌ 400 → obliga a rellenarlos. Es la vía por la que se auto-curan. |
| Cualquier cosa → COMPLETED / PENDING / REJECTED | ✅ sin cambios respecto a hoy |

- [ ] **Step 1: Escribe el archivo de tests que falla**

Crea `avoqado-server/tests/unit/services/dashboard/sale-verification.org.edit-feedback.test.ts`:

```ts
/**
 * Candado "Revisar por promotor" en el camino de EDITAR (Asana 1217299209026114).
 *
 * Bug original: editOrgSaleVerification ponía reviewNotes=null y rejectionReasons=[]
 * al pasar una venta a FAILED, dejando al promotor sin saber qué corregir.
 */

import { editOrgSaleVerification } from '@/services/dashboard/sale-verification.org.dashboard.service'
import prisma from '@/utils/prismaClient'

jest.mock('@/utils/prismaClient', () => {
  const tx = {
    payment: { update: jest.fn() },
    saleVerification: { update: jest.fn() },
    activityLog: { create: jest.fn() },
  }
  return {
    __esModule: true,
    default: {
      saleVerification: { findUnique: jest.fn() },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
      __tx: tx,
    },
  }
})

jest.mock('@/communication/sockets', () => ({
  __esModule: true,
  default: { broadcastToUser: jest.fn() },
}))

jest.mock('@/config/logger', () => ({
  __esModule: true,
  default: { warn: jest.fn(), debug: jest.fn(), info: jest.fn(), error: jest.fn() },
}))

const ORG_ID = 'org-1'
const SV_ID = 'sv-1'
const EDITOR_ID = 'staff-owner-1'

const tx = (prisma as any).__tx
const mockedFindUnique = prisma.saleVerification.findUnique as jest.Mock

function existingSale(overrides: Record<string, any> = {}) {
  return {
    id: SV_ID,
    venueId: 'venue-1',
    staffId: 'staff-promoter-1',
    paymentId: 'pay-1',
    status: 'PENDING',
    isPortabilidad: false,
    reviewNotes: null,
    rejectionReasons: [],
    payment: { id: 'pay-1', amount: 100, method: 'CASH' },
    venue: { organizationId: ORG_ID },
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  tx.saleVerification.update.mockResolvedValue({
    id: SV_ID,
    paymentId: 'pay-1',
    status: 'FAILED',
    reviewedAt: new Date(),
    reviewNotes: null,
    rejectionReasons: [],
    reviewedBy: null,
  })
})

describe('editOrgSaleVerification — candado "Revisar por promotor"', () => {
  it('rechaza pasar una venta a FAILED sin comentario', async () => {
    mockedFindUnique.mockResolvedValue(existingSale())

    await expect(
      editOrgSaleVerification(ORG_ID, {
        saleVerificationId: SV_ID,
        editedById: EDITOR_ID,
        status: 'FAILED',
        reason: 'Corrección de documentación',
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/mínimo 5 caracteres/i) })

    expect(tx.saleVerification.update).not.toHaveBeenCalled()
  })

  it('rechaza un comentario de menos de 5 caracteres', async () => {
    mockedFindUnique.mockResolvedValue(existingSale())

    await expect(
      editOrgSaleVerification(ORG_ID, {
        saleVerificationId: SV_ID,
        editedById: EDITOR_ID,
        status: 'FAILED',
        reviewNotes: 'mal',
        reason: 'Corrección de documentación',
      }),
    ).rejects.toMatchObject({ statusCode: 400 })

    expect(tx.saleVerification.update).not.toHaveBeenCalled()
  })

  it('PERSISTE reviewNotes y rejectionReasons al pasar a FAILED (regresión del bug)', async () => {
    mockedFindUnique.mockResolvedValue(existingSale())

    await editOrgSaleVerification(ORG_ID, {
      saleVerificationId: SV_ID,
      editedById: EDITOR_ID,
      status: 'FAILED',
      reviewNotes: '  Falta la imagen de vinculación, vuelve a subirla  ',
      rejectionReasons: ['REVIEW_MISSING_LINKING_IMAGE'],
      reason: 'Documentación incompleta',
    })

    expect(tx.saleVerification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          reviewNotes: 'Falta la imagen de vinculación, vuelve a subirla',
          rejectionReasons: ['REVIEW_MISSING_LINKING_IMAGE'],
        }),
      }),
    )
  })

  it('conserva el comentario existente al editar sólo el monto de una venta ya FAILED', async () => {
    mockedFindUnique.mockResolvedValue(
      existingSale({ status: 'FAILED', reviewNotes: 'Imagen ilegible', rejectionReasons: ['REVIEW_ILLEGIBLE_IMAGES'] }),
    )

    await editOrgSaleVerification(ORG_ID, {
      saleVerificationId: SV_ID,
      editedById: EDITOR_ID,
      status: 'FAILED',
      amount: 250,
      reason: 'Ajuste de monto',
    })

    expect(tx.saleVerification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewNotes: 'Imagen ilegible',
          rejectionReasons: ['REVIEW_ILLEGIBLE_IMAGES'],
        }),
      }),
    )
  })

  it('NO toca REJECTED: sigue aceptando motivo vacío (fuera de alcance)', async () => {
    mockedFindUnique.mockResolvedValue(existingSale())

    await expect(
      editOrgSaleVerification(ORG_ID, {
        saleVerificationId: SV_ID,
        editedById: EDITOR_ID,
        status: 'REJECTED',
        reason: 'Cliente desistió de la portabilidad',
      }),
    ).resolves.toBeDefined()
  })

  it('NO exige comentario al pasar a COMPLETED', async () => {
    mockedFindUnique.mockResolvedValue(existingSale())

    await expect(
      editOrgSaleVerification(ORG_ID, {
        saleVerificationId: SV_ID,
        editedById: EDITOR_ID,
        status: 'COMPLETED',
        reason: 'Documentación correcta tras revisión',
      }),
    ).resolves.toBeDefined()
  })
})
```

- [ ] **Step 2: Corre los tests y verifica que fallan**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx jest tests/unit/services/dashboard/sale-verification.org.edit-feedback.test.ts
```

Esperado: fallan los 4 primeros (los dos de 400 porque hoy NO lanza; los dos de persistencia porque hoy escribe `reviewNotes: null`). Los dos últimos (REJECTED / COMPLETED) deben PASAR ya.

- [ ] **Step 3: Amplía la firma y el `select` del servicio**

En `sale-verification.org.dashboard.service.ts`:

a) Agrega el import del helper a la línea de import que ya trae `reviewSaleVerification as reviewSaleVerificationVenue`:

```ts
import {
  reviewSaleVerification as reviewSaleVerificationVenue,
  PROMOTER_FEEDBACK_MIN_CHARS,
  PROMOTER_FEEDBACK_REQUIRED_MESSAGE,
  type ReviewDecision,
} from './sale-verification.dashboard.service'
```

> Este camino NO importa `assertPromoterFeedback`: acepta el comentario **heredado** además del entrante, así que necesita la constante y el mensaje, no el assert de un solo argumento.

b) En `editOrgSaleVerification`, agrega los dos campos al tipo de `params` (después de `status?: SaleVerificationStatus`):

```ts
    /** Comentario que el promotor lee en su TPV. OBLIGATORIO (>=5 chars) si el estado resultante es FAILED. */
    reviewNotes?: string
    /** Motivos categorizados (opcionales) para el reporte a Walmart. */
    rejectionReasons?: SaleVerificationRejectionReason[]
```

c) En el `select` del `findUnique` (línea ~1294), agrega los dos campos que hoy no se leen:

```ts
      status: true,
      isPortabilidad: true,
      reviewNotes: true,
      rejectionReasons: true,
```

- [ ] **Step 4: Aplica el candado**

Justo **después** de la línea `const nextStatus: SaleVerificationStatus = params.status ?? existing.status` (línea ~1319), inserta:

```ts
  // Candado "Revisar por promotor": la venta no puede quedar en FAILED sin un
  // comentario que le diga al promotor QUÉ corregir. Se satisface con el texto
  // entrante O con el ya guardado — así, editar el monto de una venta que ya
  // traía motivo no obliga a reescribirlo, pero los renglones legacy en blanco
  // sí se tienen que rellenar la primera vez que alguien los toca.
  let failedFeedback: { reviewNotes: string; rejectionReasons: SaleVerificationRejectionReason[] } | null = null
  if (nextStatus === 'FAILED') {
    const incoming = params.reviewNotes?.trim() ?? ''
    const carried = existing.reviewNotes?.trim() ?? ''
    const notes = incoming || carried
    if (notes.length < PROMOTER_FEEDBACK_MIN_CHARS) {
      throw createServiceError(PROMOTER_FEEDBACK_REQUIRED_MESSAGE, 400)
    }
    failedFeedback = {
      reviewNotes: notes,
      rejectionReasons: params.rejectionReasons ?? existing.rejectionReasons,
    }
  }
```

> Nota: aquí se usa `createServiceError` local + las constantes importadas en vez de `assertPromoterFeedback`, porque este camino acepta el comentario **heredado**, no sólo el entrante.

- [ ] **Step 5: Deja de borrar los motivos**

Reemplaza el bloque `reviewMeta` completo (línea ~1339-1347):

```ts
    const statusChanged = nextStatus !== existing.status
    const reviewMeta = !statusChanged
      ? {}
      : nextStatus === 'PENDING'
        ? { reviewedById: null, reviewedAt: null, reviewNotes: null, rejectionReasons: [] }
        : nextStatus === 'COMPLETED'
          ? { reviewedById: params.editedById, reviewedAt: new Date(), rejectionReasons: [] }
          : { reviewedById: params.editedById, reviewedAt: new Date(), reviewNotes: null, rejectionReasons: [] } // FAILED / REJECTED: stamp reviewer, clear stale notes/reasons (P1 doesn't collect a promoter note on edit)
```

por:

```ts
    const statusChanged = nextStatus !== existing.status
    // El sello de revisor sólo se reescribe cuando el estado TRANSICIONA — editar
    // el monto de una venta ya revisada no debe cambiar quién/cuándo la revisó.
    const reviewerStamp = statusChanged ? { reviewedById: params.editedById, reviewedAt: new Date() } : {}
    const reviewMeta =
      nextStatus === 'FAILED'
        ? // "Revisar por promotor": el comentario SIEMPRE viaja (garantizado arriba).
          { ...reviewerStamp, ...failedFeedback! }
        : !statusChanged
          ? {}
          : nextStatus === 'PENDING'
            ? { reviewedById: null, reviewedAt: null, reviewNotes: null, rejectionReasons: [] }
            : nextStatus === 'COMPLETED'
              ? { ...reviewerStamp, rejectionReasons: [] }
              : { ...reviewerStamp, reviewNotes: null, rejectionReasons: [] } // REJECTED (terminal): sin feedback de corrección
```

- [ ] **Step 6: Corre los tests y verifica que pasan**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx jest tests/unit/services/dashboard/sale-verification.org.edit-feedback.test.ts
```

Esperado: los 6 tests PASAN.

- [ ] **Step 7: Pasa los campos por el controller**

En `sale-verification.org.dashboard.controller.ts`, función `editOrgSaleVerification` (línea ~313):

a) Amplía el destructuring del body:

```ts
    const { amount, paymentForm, isPortabilidad, status, reason, reviewNotes, rejectionReasons } = req.body as {
      amount?: number
      paymentForm?: string
      isPortabilidad?: boolean
      status?: string
      reason?: string
      reviewNotes?: string
      rejectionReasons?: SaleVerificationRejectionReason[]
    }
```

b) Después de la validación de `status` (línea ~338), valida el enum de motivos — copia el patrón que ya usa el handler de review de este mismo archivo (línea ~241):

```ts
    if (Array.isArray(rejectionReasons)) {
      const invalid = rejectionReasons.filter(r => !validReasons.includes(r))
      if (invalid.length > 0) {
        res.status(400).json({ success: false, message: `Invalid rejectionReasons: ${invalid.join(', ')}` })
        return
      }
    }
```

> `validReasons` ya existe en este archivo (lo usa el handler de review). Si está declarado dentro de esa función, súbelo a constante de módulo para reusarlo — no lo dupliques.

c) Pásalos al servicio:

```ts
      status: status as SaleVerificationStatus | undefined,
      reason,
      reviewNotes,
      rejectionReasons,
```

- [ ] **Step 8: Corre la suite del módulo y el typecheck**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx jest tests/unit/services/dashboard tests/api-tests/dashboard/saleVerificationEdit.api.test.ts
```

Esperado: todo verde. Si `saleVerificationEdit.api.test.ts` falla, lee el caso: si es un test que pasa a `FAILED` sin comentario, **actualízalo** para que mande `reviewNotes` (el 400 es el comportamiento correcto nuevo).

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx tsc --noEmit -p tsconfig.json
```

**NO commitees.**

---

### Task 3: Mismo candado en el MCP (camino C)

CLAUDE.md: el MCP se actualiza en el MISMO cambio, nunca "después". Una capacidad que existe pero no es alcanzable/consistente por MCP está incompleta.

**Files:**
- Modify: `avoqado-server/src/mcp/tools/saleVerifications.ts:167-232` (`review_sale_verification`) y `:287-330` (`edit_sale_verification`)
- Test: `avoqado-server/tests/unit/mcp-customer/sale-verification-writes.test.ts`

**Interfaces:**
- Consumes: `PROMOTER_FEEDBACK_MIN_CHARS` (Task 1); el servicio ya validado de Tasks 1-2.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Escribe los tests que fallan**

El archivo ya trae su harness: `call(nombre, args)` invoca el handler y `parse(res)` devuelve el JSON. Los mocks `mockFindFirst` / `mockReview` / `mockEdit` y la fixture `PENDING` ya existen — **úsalos, no inventes otros**.

Agrega dentro del `describe('review_sale_verification', ...)` existente:

```ts
  it('reject con motivos pero SIN reviewNotes → error (un checkbox pelón no dice qué corregir)', async () => {
    mockFindFirst.mockResolvedValue(PENDING)
    const out = parse(
      await call('review_sale_verification', {
        saleVerificationId: 'sv1',
        decision: 'reject',
        rejectionReasons: ['REVIEW_ILLEGIBLE_IMAGES'],
        confirm: true,
      }),
    )
    expect(out.ok).toBe(false)
    expect(out.error).toMatch(/mínimo 5 caracteres/i)
    expect(mockReview).not.toHaveBeenCalled()
  })

  it('reject con reviewNotes válidas → llama al backend', async () => {
    mockFindFirst.mockResolvedValue(PENDING)
    mockReview.mockResolvedValue({ status: 'FAILED' })
    const out = parse(
      await call('review_sale_verification', {
        saleVerificationId: 'sv1',
        decision: 'reject',
        reviewNotes: 'Falta la imagen de vinculación',
        confirm: true,
      }),
    )
    expect(out.ok).toBe(true)
    expect(mockReview).toHaveBeenCalledWith('o1', expect.objectContaining({ decision: 'REJECT' }))
  })
```

Y dentro del `describe('edit_sale_verification', ...)` existente:

```ts
  it('status=FAILED sin reviewNotes → error, servicio no llamado', async () => {
    mockFindFirst.mockResolvedValue(PENDING)
    const out = parse(
      await call('edit_sale_verification', {
        saleVerificationId: 'sv1',
        status: 'FAILED',
        reason: 'Documentación incompleta',
        confirm: true,
      }),
    )
    expect(out.ok).toBe(false)
    expect(out.error).toMatch(/mínimo 5 caracteres/i)
    expect(mockEdit).not.toHaveBeenCalled()
  })

  it('status=FAILED con reviewNotes → las pasa al servicio', async () => {
    mockFindFirst.mockResolvedValue(PENDING)
    mockEdit.mockResolvedValue({ status: 'FAILED' })
    const out = parse(
      await call('edit_sale_verification', {
        saleVerificationId: 'sv1',
        status: 'FAILED',
        reviewNotes: 'Falta la imagen de vinculación',
        reason: 'Documentación incompleta',
        confirm: true,
      }),
    )
    expect(out.ok).toBe(true)
    expect(mockEdit).toHaveBeenCalledWith(
      'o1',
      expect.objectContaining({ status: 'FAILED', reviewNotes: 'Falta la imagen de vinculación' }),
    )
  })
```

> El test existente `'reject without reason/notes → error, service not called'` (línea ~84) sigue pasando tal cual — el error cambia de texto pero la aserción es sobre `ok: false`. No lo toques.

- [ ] **Step 2: Corre los tests y verifica que fallan**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx jest tests/unit/mcp-customer/sale-verification-writes.test.ts
```

- [ ] **Step 3: Aprieta `review_sale_verification`**

Reemplaza la guarda (línea ~200):

```ts
      if (decision === 'reject' && (!rejectionReasons || rejectionReasons.length === 0) && !reviewNotes?.trim()) {
        return text({ ok: false, error: 'Para rechazar (reject) indica al menos una razón en rejectionReasons o una nota en reviewNotes.' })
      }
```

por:

```ts
      if (decision === 'reject' && (reviewNotes?.trim().length ?? 0) < PROMOTER_FEEDBACK_MIN_CHARS) {
        return text({
          ok: false,
          error:
            'Para dejar la venta en "Revisar por promotor" escribe en reviewNotes qué debe corregir el promotor (mínimo 5 caracteres). Los rejectionReasons son opcionales.',
        })
      }
```

Importa `PROMOTER_FEEDBACK_MIN_CHARS` desde `@/services/dashboard/sale-verification.dashboard.service` (usa la ruta/alias que ya usen los otros imports de ese archivo).

- [ ] **Step 4: Actualiza los `.describe()` de `review_sale_verification`**

- Descripción de la tool: cambia `For "reject" you MUST give a rejectionReasons value or reviewNotes.` por
  `For "reject" you MUST give reviewNotes (min 5 chars) telling the promoter WHAT to fix; rejectionReasons are optional.`
- `rejectionReasons`: cambia `(required for "reject" unless you give reviewNotes)` por `(optional categorization for the Walmart report)`.
- `reviewNotes`: cambia `'Optional free-text note'` por `'Qué debe corregir el promotor — OBLIGATORIO (mín. 5 caracteres) cuando decision="reject"'`.

- [ ] **Step 5: Aprieta `edit_sale_verification`**

a) Agrega el parámetro al schema, después de `status`:

```ts
      reviewNotes: z
        .string()
        .optional()
        .describe('Qué debe corregir el promotor — OBLIGATORIO (mín. 5 caracteres) cuando status="FAILED"'),
```

b) Agrégalo al destructuring del handler y a la llamada al servicio (`svc.editOrgSaleVerification(...)` / el equivalente que use este archivo), junto a `reason`.

c) Agrega la guarda, junto a la validación de "indica al menos un campo a cambiar" (línea ~301):

```ts
      if (status === 'FAILED' && (reviewNotes?.trim().length ?? 0) < PROMOTER_FEEDBACK_MIN_CHARS) {
        return text({
          ok: false,
          error:
            'Para dejar la venta en "Revisar por promotor" escribe en reviewNotes qué debe corregir el promotor (mínimo 5 caracteres).',
        })
      }
```

d) En la descripción de la tool, agrega al final: `Si status="FAILED" ("Revisar por promotor"), reviewNotes es obligatorio (mín. 5 caracteres).`

- [ ] **Step 6: Corre los tests y el typecheck**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx jest tests/unit/mcp-customer/ && npx tsc --noEmit -p tsconfig.json
```

Esperado: verde. **NO commitees.**

---

### Task 4: Componente compartido `ReviewReasonsFields` (dashboard)

**Files:**
- Create: `avoqado-web-dashboard/src/components/sale-verification/ReviewReasonsFields.tsx`
- Test: `avoqado-web-dashboard/src/components/sale-verification/ReviewReasonsFields.test.tsx`

**Interfaces:**
- Consumes: `SALE_VERIFICATION_REJECTION_REASON_LABELS`, `SaleVerificationRejectionReason` de `@/services/saleVerification.service`.
- Produces:
  - `export const PROMOTER_FEEDBACK_MIN_CHARS = 5`
  - `export function isPromoterFeedbackValid(notes: string): boolean`
  - `export const PROMOTER_FEEDBACK_ERROR: string`
  - `export function ReviewReasonsFields(props: ReviewReasonsFieldsProps): JSX.Element` — componente **controlado**, el padre es dueño del estado:
    ```ts
    interface ReviewReasonsFieldsProps {
      reasons: SaleVerificationRejectionReason[]
      onReasonsChange: (reasons: SaleVerificationRejectionReason[]) => void
      notes: string
      onNotesChange: (notes: string) => void
      /** Muestra el error sólo después de un intento de submit. */
      showError?: boolean
    }
    ```

- [ ] **Step 1: Escribe el test que falla**

Crea `src/components/sale-verification/ReviewReasonsFields.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReviewReasonsFields, isPromoterFeedbackValid } from './ReviewReasonsFields'

describe('isPromoterFeedbackValid', () => {
  it('rechaza vacío, espacios y menos de 5 caracteres', () => {
    expect(isPromoterFeedbackValid('')).toBe(false)
    expect(isPromoterFeedbackValid('     ')).toBe(false)
    expect(isPromoterFeedbackValid('mal')).toBe(false)
  })

  it('acepta 5 caracteres o más', () => {
    expect(isPromoterFeedbackValid('ilegible')).toBe(true)
  })
})

describe('ReviewReasonsFields', () => {
  it('marca las observaciones como obligatorias', () => {
    render(<ReviewReasonsFields reasons={[]} onReasonsChange={vi.fn()} notes="" onNotesChange={vi.fn()} />)
    expect(screen.getByText(/observaciones/i)).toBeInTheDocument()
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('muestra el error sólo cuando showError está activo', () => {
    const { rerender } = render(
      <ReviewReasonsFields reasons={[]} onReasonsChange={vi.fn()} notes="" onNotesChange={vi.fn()} />,
    )
    expect(screen.queryByText(/mínimo 5 caracteres/i)).not.toBeInTheDocument()

    rerender(<ReviewReasonsFields reasons={[]} onReasonsChange={vi.fn()} notes="" onNotesChange={vi.fn()} showError />)
    expect(screen.getByText(/mínimo 5 caracteres/i)).toBeInTheDocument()
  })

  it('avisa al padre cuando se escribe una observación', () => {
    const onNotesChange = vi.fn()
    render(<ReviewReasonsFields reasons={[]} onReasonsChange={vi.fn()} notes="" onNotesChange={onNotesChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Falta vinculación' } })
    expect(onNotesChange).toHaveBeenCalledWith('Falta vinculación')
  })

  it('agrega y quita motivos sin perder los ya marcados', () => {
    const onReasonsChange = vi.fn()
    render(
      <ReviewReasonsFields
        reasons={['REVIEW_PORTABILIDAD']}
        onReasonsChange={onReasonsChange}
        notes="algo"
        onNotesChange={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByLabelText(/ilegibles/i))
    expect(onReasonsChange).toHaveBeenCalledWith(['REVIEW_PORTABILIDAD', 'REVIEW_ILLEGIBLE_IMAGES'])
  })
})
```

- [ ] **Step 2: Corre el test y verifica que falla**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard && npx vitest run src/components/sale-verification/ReviewReasonsFields.test.tsx
```

Esperado: FALLA — el módulo no existe.

- [ ] **Step 3: Escribe el componente**

Crea `src/components/sale-verification/ReviewReasonsFields.tsx`:

```tsx
/**
 * ReviewReasonsFields — motivos + observaciones para dejar una venta en
 * "Revisar por promotor" (SaleVerificationStatus.FAILED).
 *
 * Compartido por los DOS caminos que pueden producir ese estado:
 *   - ReviewSaleDialog (modo "reject")
 *   - EditSaleDialog (Estado = "Revisar por promotor")
 *
 * Regla (espejo del backend, `assertPromoterFeedback`): las observaciones son
 * OBLIGATORIAS con mínimo 5 caracteres — un checkbox solo no le dice al promotor
 * CUÁL imagen está mal. Los motivos son opcionales: categorizan para el reporte.
 *
 * Componente controlado: el padre es dueño del estado y de cuándo mostrar el error.
 */
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle } from 'lucide-react'
import {
  SALE_VERIFICATION_REJECTION_REASON_LABELS,
  type SaleVerificationRejectionReason,
} from '@/services/saleVerification.service'

/** Espejo de PROMOTER_FEEDBACK_MIN_CHARS en avoqado-server. */
export const PROMOTER_FEEDBACK_MIN_CHARS = 5

export const PROMOTER_FEEDBACK_ERROR = 'Escribe qué debe corregir el promotor (mínimo 5 caracteres).'

export function isPromoterFeedbackValid(notes: string): boolean {
  return notes.trim().length >= PROMOTER_FEEDBACK_MIN_CHARS
}

const REJECTION_REASONS: SaleVerificationRejectionReason[] = [
  'REVIEW_MISSING_LINKING_IMAGE',
  'REVIEW_PORTABILIDAD',
  'REVIEW_ILLEGIBLE_IMAGES',
  'REVIEW_DUPLICATE_VINCULACION',
  'OTHER',
]

export interface ReviewReasonsFieldsProps {
  reasons: SaleVerificationRejectionReason[]
  onReasonsChange: (reasons: SaleVerificationRejectionReason[]) => void
  notes: string
  onNotesChange: (notes: string) => void
  /** Muestra el error sólo después de un intento de submit. */
  showError?: boolean
}

export function ReviewReasonsFields({ reasons, onReasonsChange, notes, onNotesChange, showError }: ReviewReasonsFieldsProps) {
  const toggle = (reason: SaleVerificationRejectionReason) => {
    onReasonsChange(reasons.includes(reason) ? reasons.filter(r => r !== reason) : [...reasons, reason])
  }

  const invalid = showError && !isPromoterFeedbackValid(notes)

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-bold mb-2 block">Motivos de revisión (opcional)</Label>
        <div className="space-y-2">
          {REJECTION_REASONS.map(reason => (
            <div key={reason} className="flex items-start gap-2">
              <Checkbox id={`reason-${reason}`} checked={reasons.includes(reason)} onCheckedChange={() => toggle(reason)} />
              <Label htmlFor={`reason-${reason}`} className="text-sm leading-tight cursor-pointer">
                {SALE_VERIFICATION_REJECTION_REASON_LABELS[reason]}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="reviewNotes" className="text-sm font-bold mb-2 block">
          Observaciones <span className="text-red-600">*</span>
        </Label>
        <Textarea
          id="reviewNotes"
          value={notes}
          onChange={e => onNotesChange(e.target.value)}
          placeholder="Escribe qué debe corregir el promotor. Lo va a leer en su TPV."
          rows={3}
          maxLength={500}
          data-tour="review-promoter-notes"
        />
        <p className="text-[10px] text-muted-foreground mt-1 text-right">{notes.length}/500</p>
      </div>

      {invalid && (
        <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{PROMOTER_FEEDBACK_ERROR}</span>
        </div>
      )}
    </div>
  )
}

export default ReviewReasonsFields
```

- [ ] **Step 4: Corre el test y verifica que pasa**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard && npx vitest run src/components/sale-verification/ReviewReasonsFields.test.tsx
```

Esperado: los 6 tests PASAN. **NO commitees.**

---

### Task 5: `ReviewSaleDialog` consume el componente

**Files:**
- Modify: `avoqado-web-dashboard/src/pages/playtelecom/Sales/components/ReviewSaleDialog.tsx:63-69, 133-151, 224-268, 275-288`

**Interfaces:**
- Consumes: `ReviewReasonsFields`, `isPromoterFeedbackValid`, `PROMOTER_FEEDBACK_ERROR` (Task 4).
- Produces: nada nuevo.

- [ ] **Step 1: Borra la constante duplicada**

Elimina el arreglo local `REJECTION_REASONS` (línea ~63-69) — ahora vive dentro del componente compartido. Quita también los imports de `Checkbox` y `SALE_VERIFICATION_REJECTION_REASON_LABELS` si quedan sin uso (`Textarea` y `Label` siguen usándose en el modo `mark-rejected`).

- [ ] **Step 2: Importa el componente compartido**

```tsx
import { ReviewReasonsFields, isPromoterFeedbackValid, PROMOTER_FEEDBACK_ERROR } from '@/components/sale-verification/ReviewReasonsFields'
```

- [ ] **Step 3: Aprieta la validación de submit**

Reemplaza el bloque del `handleSubmit` (línea ~136-143):

```tsx
    if (mode === 'reject') {
      const hasReason = selectedReasons.length > 0
      const hasNotes = reviewNotes.trim().length > 0
      if (!hasReason && !hasNotes) {
        setValidationError('Selecciona al menos una opción o escribe una observación.')
        return
      }
    }
```

por:

```tsx
    // "Revisar por promotor" SIEMPRE lleva comentario: un checkbox solo no le dice
    // al promotor CUÁL imagen está mal. Los motivos siguen siendo opcionales.
    if (mode === 'reject' && !isPromoterFeedbackValid(reviewNotes)) {
      setValidationError(PROMOTER_FEEDBACK_ERROR)
      return
    }
```

- [ ] **Step 4: Sustituye el bloque de UI del modo `reject`**

Reemplaza TODO el contenido de la rama `else` final del render (el bloque `<div className="space-y-4 py-2">` que hoy dibuja a mano los checkboxes, el textarea y el `validationError`, línea ~224-268) por:

```tsx
          <div className="py-2">
            <ReviewReasonsFields
              reasons={selectedReasons}
              onReasonsChange={next => {
                setValidationError(null)
                setSelectedReasons(next)
              }}
              notes={reviewNotes}
              onNotesChange={next => {
                setValidationError(null)
                setReviewNotes(next)
              }}
              showError={Boolean(validationError)}
            />
          </div>
```

> El modo `mark-rejected` ("Rechazada") **no se toca**: su "Motivo (opcional)" se queda tal cual.

- [ ] **Step 5: Deshabilita el botón hasta que haya texto**

En el `<Button>` de submit (línea ~275), cambia:

```tsx
            disabled={isLoading}
```

por:

```tsx
            disabled={isLoading || (mode === 'reject' && !isPromoterFeedbackValid(reviewNotes))}
```

- [ ] **Step 6: Verifica**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard && npx tsc -p tsconfig.app.json --noEmit && npx eslint src/pages/playtelecom/Sales/components/ReviewSaleDialog.tsx src/components/sale-verification/
```

Esperado: sin errores. (Ojo: `npx tsc --noEmit` **pelón** en la raíz de este repo da un falso verde — usa `-p tsconfig.app.json`.) **NO commitees.**

---

### Task 6: `EditSaleDialog` — el bug que reportó Isaac

**Files:**
- Modify: `avoqado-web-dashboard/src/pages/organizations/SalesDetail/components/EditSaleDialog.tsx`
- Modify: `avoqado-web-dashboard/src/services/saleVerification.org.service.ts:368-378`
- Test: `avoqado-web-dashboard/src/pages/organizations/SalesDetail/components/EditSaleDialog.test.tsx` (nuevo)

**Interfaces:**
- Consumes: `ReviewReasonsFields`, `isPromoterFeedbackValid`, `PROMOTER_FEEDBACK_ERROR` (Task 4); el endpoint ampliado (Task 2).
- Produces: `EditOrgSaleParams` gana `reviewNotes?: string` y `rejectionReasons?: SaleVerificationRejectionReason[]`.

- [ ] **Step 1: Escribe el test que falla**

Crea `src/pages/organizations/SalesDetail/components/EditSaleDialog.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EditSaleDialog } from './EditSaleDialog'
import type { OrgSaleRow } from '@/services/saleVerification.org.service'

const editMock = vi.fn().mockResolvedValue({})
vi.mock('@/services/saleVerification.org.service', async orig => ({
  ...(await orig<typeof import('@/services/saleVerification.org.service')>()),
  editOrgSaleVerification: (...args: unknown[]) => editMock(...args),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const row = {
  id: 'sv-1',
  status: 'PENDING',
  serialNumbers: ['8952140064479454713F'],
  saleType: 'LINEA_NUEVA',
  venue: { name: 'BAE MEZQUITAL' },
  payment: { amount: 0, paymentForm: 'OTHER' },
} as unknown as OrgSaleRow

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <EditSaleDialog open row={row} orgId="org-1" onClose={vi.fn()} />
    </QueryClientProvider>,
  )
}

/** El Select de Radix no responde bien a fireEvent; el helper elige la opción por su texto. */
async function selectRevisarPorPromotor() {
  fireEvent.click(screen.getByRole('combobox', { name: /estado/i }))
  fireEvent.click(await screen.findByText('Revisar por promotor'))
}

beforeEach(() => editMock.mockClear())

describe('EditSaleDialog — candado "Revisar por promotor"', () => {
  it('no muestra el bloque de revisión mientras el estado no sea "Revisar por promotor"', () => {
    renderDialog()
    expect(screen.queryByText(/motivos de revisión/i)).not.toBeInTheDocument()
  })

  it('despliega el bloque de revisión al elegir "Revisar por promotor"', async () => {
    renderDialog()
    await selectRevisarPorPromotor()
    expect(await screen.findByText(/motivos de revisión/i)).toBeInTheDocument()
    expect(screen.getByText(/observaciones/i)).toBeInTheDocument()
  })

  it('bloquea el guardado si no hay observación para el promotor', async () => {
    renderDialog()
    await selectRevisarPorPromotor()
    fireEvent.change(screen.getByPlaceholderText(/explica por qué editas/i), {
      target: { value: 'Corrección de documentación' },
    })
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

    expect(await screen.findByText(/mínimo 5 caracteres/i)).toBeInTheDocument()
    expect(editMock).not.toHaveBeenCalled()
  })

  it('manda reviewNotes y rejectionReasons cuando el estado es "Revisar por promotor"', async () => {
    renderDialog()
    await selectRevisarPorPromotor()
    fireEvent.change(screen.getByPlaceholderText(/explica por qué editas/i), {
      target: { value: 'Corrección de documentación' },
    })
    fireEvent.change(screen.getByPlaceholderText(/qué debe corregir el promotor/i), {
      target: { value: 'Falta la imagen de vinculación' },
    })
    fireEvent.click(screen.getByLabelText(/vinculación/i, { selector: 'label' }))
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => expect(editMock).toHaveBeenCalled())
    expect(editMock.mock.calls[0][2]).toMatchObject({
      status: 'FAILED',
      reviewNotes: 'Falta la imagen de vinculación',
    })
  })
})
```

> Si el `Select` de Radix no coopera con `fireEvent` en jsdom, cambia `selectRevisarPorPromotor` por `userEvent` (`@testing-library/user-event`) — revisa primero cómo lo resuelven otros tests del repo antes de inventar un patrón.

- [ ] **Step 2: Corre el test y verifica que falla**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard && npx vitest run src/pages/organizations/SalesDetail/components/EditSaleDialog.test.tsx
```

Esperado: pasa el primero, fallan los otros tres.

- [ ] **Step 3: Amplía el tipo del servicio**

En `src/services/saleVerification.org.service.ts`, dentro de `EditOrgSaleParams` (línea ~368), después de `reason: string`:

```ts
  /** Qué debe corregir el promotor. Obligatorio (>=5 chars) cuando `status === 'FAILED'`. Lo lee en su TPV. */
  reviewNotes?: string
  /** Motivos categorizados (opcionales) para el reporte a Walmart. */
  rejectionReasons?: SaleVerificationRejectionReason[]
```

Agrega `SaleVerificationRejectionReason` al import de tipos que ya trae este archivo desde `./saleVerification.service`.

- [ ] **Step 4: Conecta el diálogo**

En `EditSaleDialog.tsx`:

a) Importa:

```tsx
import { ReviewReasonsFields, isPromoterFeedbackValid, PROMOTER_FEEDBACK_ERROR } from '@/components/sale-verification/ReviewReasonsFields'
import type { SaleVerificationRejectionReason } from '@/services/saleVerification.service'
```

b) Agrega estado (junto a `const [reason, setReason] = useState('')`):

```tsx
  const [reviewNotes, setReviewNotes] = useState('')
  const [rejectionReasons, setRejectionReasons] = useState<SaleVerificationRejectionReason[]>([])
```

c) Resetéalo en el `useEffect` de apertura, junto a `setReason('')`:

```tsx
      setReviewNotes('')
      setRejectionReasons([])
```

d) Amplía `handleSubmit`:

```tsx
  const handleSubmit = () => {
    if (reason.trim().length < 5) {
      setError('Escribe un motivo de al menos 5 caracteres (queda en la auditoría).')
      return
    }
    // Candado: dejar la venta en "Revisar por promotor" sin decirle qué corregir
    // lo deja atorado en su TPV sin instrucciones.
    if (status === 'FAILED' && !isPromoterFeedbackValid(reviewNotes)) {
      setError(PROMOTER_FEEDBACK_ERROR)
      return
    }
    mutation.mutate({
      amount,
      paymentForm,
      isPortabilidad,
      status,
      reason: reason.trim(),
      ...(status === 'FAILED' ? { reviewNotes: reviewNotes.trim(), rejectionReasons } : {}),
    })
  }
```

e) Limpia el error al cambiar de estado — reemplaza el `onValueChange` del Select de Estado:

```tsx
          <Select value={status} onValueChange={v => { setError(null); setStatus(v as SaleVerificationStatus) }}>
```

f) Inserta el bloque **entre** el Select de Estado y el campo "Motivo del cambio" (o sea, después del `</div>` que cierra el bloque del Select de Estado, línea ~165):

```tsx
        {status === 'FAILED' && (
          <div className="rounded-lg border border-input bg-card p-4">
            <p className="text-xs text-muted-foreground mb-3">
              El promotor va a ver esto en su TPV para poder corregir la venta.
            </p>
            <ReviewReasonsFields
              reasons={rejectionReasons}
              onReasonsChange={next => {
                setError(null)
                setRejectionReasons(next)
              }}
              notes={reviewNotes}
              onNotesChange={next => {
                setError(null)
                setReviewNotes(next)
              }}
              showError={error === PROMOTER_FEEDBACK_ERROR}
            />
          </div>
        )}
```

- [ ] **Step 5: Corre los tests y verifica que pasan**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard && npx vitest run src/pages/organizations/SalesDetail/components/EditSaleDialog.test.tsx src/components/sale-verification/
```

Esperado: todo PASA.

- [ ] **Step 6: Verificación final del repo**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard && npm run build && npm run lint
```

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npm run test:dashboard && npx tsc --noEmit -p tsconfig.json
```

Esperado: todo verde. Si la máquina está saturada, **corre igual y avisa que va a tardar** — subir el timeout, no rendirse. **NO commitees.**

---

## Verificación manual (después de la Task 6)

Con el dev server corriendo (`npm run dev`, o el que ya esté levantado — **no mates servidores ajenos**):

1. `/organizations/:orgId/sales` (o `/wl/organizations/:orgSlug/...`) → "Editar" en cualquier venta.
2. Estado → "Revisar por promotor": debe aparecer el bloque con los motivos y las observaciones.
3. Guardar sin escribir observación → error en rojo, la petición NO sale (verifícalo en la pestaña de red).
4. Escribir observación → guarda, y la columna **RAZÓN** de esa fila deja de mostrar `—`.
5. Probar en modo claro y oscuro.

## Reporte a Isaac (después de que Jose apruebe)

Comentar en la tarea de Asana:
- El candado ya aplica en los tres caminos.
- Los **4 renglones en blanco** que quedaron (todos de BAE MEZQUITAL, 2026-08-03) se corrigen desde el mismo "Editar", que ahora exige el comentario. Ids: `cmschlxqk02plk22akgf2hr7q`, `cmsb0stw200h3k22aizl6chbs`, `cmsb0wrks00hlk22acwh6awj6`, `cmsaxbu670037k22a2w26cb9a` (ICCIDs `…662F`, `…713F`, `…670F`, `…573F`).
- Dato aparte que él no pidió: **52 de 58** ventas en "Rechazada" están sin razón alguna. Preguntarle si quiere el mismo candado ahí (sería otra tarea).
