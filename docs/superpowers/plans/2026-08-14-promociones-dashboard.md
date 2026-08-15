# Promociones en el POS — Plan de implementación (2 de 3: dashboard)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un dueño pueda crear, editar, publicar y archivar promociones (combo, bundle, 2x1) desde el dashboard — con foto, vigencia,
los dos ajustes de panel, el candado PRO visible para FREE, y una guía de activación que no necesite manual.

**Architecture:** El server gana la cadena CRUD de dashboard que hoy no existe (`promotion.dashboard.service` + controller + rutas),
reutilizando las piezas ya construidas en el plan 1: `validatePromotionForPublish` es EL validador de publicar (todos los errores juntos) y
los modelos ya están migrados. El dashboard monta una página "Promociones" dentro de la sección Promotions existente: lista + editor en
FullScreenModal, publicar como acto deliberado, y los dos ajustes de panel escribiendo `VenueSettings`. El dinero viaja en PESOS por el API
(regla de plataforma); `priceCents` es interno del modelo y se convierte en la frontera del service.

**Tech Stack:** Express + Prisma + Zod + Jest (server) · React 18 + Vite + TS + Tailwind/Radix + TanStack Query + react-hook-form + Zod +
Playwright (dashboard)

**Spec:** `avoqado-server/docs/superpowers/specs/2026-08-12-promociones-en-el-pos-design.md` (v2). Plan hermano ya ejecutado:
`avoqado-server/docs/superpowers/plans/2026-08-12-promociones-server.md` (commits `d3a72d22..57fe6aef`).

## Global Constraints

- **Dos repos.** Tasks 1–4 en `avoqado-server` (rama `develop`); Tasks 5–12 en `avoqado-web-dashboard` (rama `develop`). Cada task dice su repo.
- **Tier PRO, código `PROMOTIONS`** — ya anclado por test en el server (`tests/unit/services/access/promotionsFeature.test.ts`). El
  dashboard es EL cliente que enforcea tiers: FREE ve el punto de entrada con candado y CTA de upsell, nunca desaparece en silencio.
- **Permisos: se REUTILIZAN `discounts:read/create/update/delete`** — no se crea namespace `promotions:*`. Es lo que ya hace el MCP
  (`src/mcp/tools/promotions.ts:31,63,105`) y evita el checklist completo de permissions-policy para un permiso gemelo.
- **Dinero en PESOS en el API** (`price: 99.00`), nunca centavos. `Promotion.priceCents` es interno: `Math.round(price * 100)` al escribir,
  `/ 100` al leer. Igual que el MCP.
- **Los mensajes de Zod en ESPAÑOL** — el middleware los muestra tal cual al usuario.
- **Zod = forma; service = reglas.** La validación de publicación vive SOLO en `validatePromotionForPublish` (server, ya existe). El
  dashboard muestra sus errores todos juntos; NUNCA reimplementa esas reglas en el front.
- **i18n en el dashboard**: todo texto visible con `t()`, llaves en `en` y `es`.
- **Sin colores hardcodeados** (tokens semánticos), **sin gradientes** (`bg-gradient-*` prohibido), bordes de Card con `border-input`.
- **Navegación siempre con `fullBasePath`** (white-label safe). Data-tours: todo CTA primario y campo de wizard lleva `data-tour="..."`.
- **Editar/archivar una promoción NUNCA toca lo ya vendido** — `OrderPromotion` guarda snapshot; el modelo ya lo garantiza y el borrado
  duro de una promoción vendida está bloqueado por FK (`onDelete: Restrict`). `DELETE` sólo existe para DRAFT jamás vendido.
- **TODO el ciclo de vida (publicar/archivar/desarchivar) y la EDICIÓN son deliberados y SÓLO del dashboard** — exclusión deliberada del
  MCP siguiendo el precedente de `upsell.ts` ("cambios visibles al cliente se leen aquí, se operan en el dashboard"): el MCP LEE y crea en
  DRAFT; nada más. Documentado también en el docstring de `src/mcp/tools/promotions.ts` (fix wave del review final).
- **Editar una promoción PUBLISHED pasa por el MISMO validador que publicarla** (ruling del review final, paridad Square: editar un ítem
  vivo aplica las mismas reglas que crearlo). DRAFT/ARCHIVED se editan libres — los borradores pueden estar incompletos.
- **ActivityLog en cada mutación** (`PROMOTION_CREATED/UPDATED/PUBLISHED/ARCHIVED/UNARCHIVED/DELETED`) con `staffId` del authContext.
- **TDD en el server** (dinero/estados). En el dashboard: Playwright E2E del happy path + build + lint.
- Referencias de patrón (server): rutas de discounts en `src/routes/dashboard.routes.ts:9868-10138`, service en
  `src/services/dashboard/discount.dashboard.service.ts`, schema en `src/schemas/dashboard/discount.schema.ts`.

---

## File Structure

| Repo | Archivo | Responsabilidad |
| --- | --- | --- |
| server | `src/schemas/dashboard/promotion.schema.ts` _(nuevo)_ | Forma de los bodies/params/query, mensajes en español |
| server | `src/services/dashboard/promotion.dashboard.service.ts` _(nuevo)_ | CRUD + publicar/archivar; convierte pesos↔centavos; arma el `PromotionDraft` para el validador; ActivityLog |
| server | `src/controllers/dashboard/promotion.dashboard.controller.ts` _(nuevo)_ | Thin: extrae, llama service, responde |
| server | `src/routes/dashboard.routes.ts` _(modificar)_ | Grupo `/venues/:venueId/promotions` con gate de plan + permisos por ruta |
| server | `src/schemas/dashboard/venueSettings.schema.ts` _(modificar)_ | `promotionsPanelCashier/Customer` en la whitelist Zod (Prisma ya los tiene) |
| dashboard | `src/types/promotion.ts` + `src/services/promotion.service.ts` _(nuevos)_ | Tipos + cliente API |
| dashboard | `src/pages/Promotions/Bundles.tsx` _(nuevo)_ | Lista con estados, publicar/archivar, empty state guiado |
| dashboard | `src/pages/Promotions/components/BundleEditor.tsx` _(nuevo)_ | Editor FullScreenModal: precio, grupos/opciones, 2x1, vigencia, foto |
| dashboard | `src/pages/Promotions/components/PanelSettingsCard.tsx` _(nuevo)_ | Los dos ajustes de panel (cajero/cliente) |
| dashboard | `src/routes/venueRoutes.tsx` + `src/routes/lazyComponents.ts` + `src/components/Sidebar/app-sidebar.tsx` + `src/config/feature-registry.ts` _(modificar)_ | Registro de la sección (teaser visible) |
| dashboard | `src/config/plan-catalog.ts` — **SIN cambios**: `PROMOTIONS` ya está en PRO (línea 61) | — |
| dashboard | `src/hooks/usePromotionCreationTour.ts` _(nuevo)_ + `useAtomicTourListener.ts` _(modificar)_ | Guía de activación (driver.js) |
| dashboard | `src/types.ts` + `src/locales/{en,es,fr}/…` _(modificar)_ | Tipo VenueSettings + llaves i18n |
| dashboard | `e2e/fixtures/promotions-mocks.ts` + `e2e/tests/promotions/bundles.spec.ts` _(nuevos)_ | E2E: happy path, errores de publicar, paywall FREE |

---

## Task 1 (server): La forma de la API — schemas Zod

**Files:**

- Create: `src/schemas/dashboard/promotion.schema.ts`

**Interfaces:**

- Consumes: nada
- Produces: `promotionVenueParamsSchema`, `promotionParamsSchema`, `getPromotionsQuerySchema`, `createPromotionBodySchema`,
  `updatePromotionBodySchema` + types `CreatePromotionRequest`, `UpdatePromotionRequest`. Los usan Tasks 2 y 3.

- [ ] **Step 1: Escribir el schema completo**

```typescript
// src/schemas/dashboard/promotion.schema.ts
import { z } from 'zod'

export const promotionVenueParamsSchema = z.object({
  venueId: z.string().min(1, 'El establecimiento es requerido'),
})

export const promotionParamsSchema = z.object({
  venueId: z.string().min(1, 'El establecimiento es requerido'),
  promotionId: z.string().min(1, 'La promoción es requerida'),
})

export const getPromotionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  search: z.string().trim().max(120).optional(),
})

const optionBodySchema = z.object({
  productId: z.string().min(1, 'Cada opción necesita un producto'),
  /** Unidades que ENTRAN al carrito. 2 en un 2x1. */
  quantity: z.coerce.number().int().min(1, 'Cada opción entrega al menos una unidad'),
  /** Unidades que se COBRAN. 1 en un 2x1. */
  chargedQuantity: z.coerce.number().int().min(0, 'La cantidad cobrada no puede ser negativa'),
  /** Sobreprecio en PESOS (sólo FIXED_TOTAL). */
  priceDelta: z.coerce
    .number()
    .min(0, 'El sobreprecio no puede ser negativo')
    .max(999999.99, 'El sobreprecio es demasiado grande')
    .refine(v => /^\d+(\.\d{1,2})?$/.test(String(v)), 'El sobreprecio lleva máximo dos decimales')
    .default(0),
})

const groupBodySchema = z.object({
  name: z.string().trim().min(1, 'El grupo necesita un nombre').max(80),
  options: z.array(optionBodySchema).min(1, 'El grupo necesita al menos una opción'),
})

// La vigencia tiene la MISMA forma que Discount (el POS la evalúa con el mismo
// predicado). daysOfWeek: 0=domingo..6=sábado. timeFrom/Until "HH:mm" local del venue.
const scheduleShape = {
  validFrom: z.coerce.date({ invalid_type_error: 'Fecha inválida' }).nullable().optional(),
  validUntil: z.coerce.date({ invalid_type_error: 'Fecha inválida' }).nullable().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  timeFrom: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe tener formato HH:mm')
    .nullable()
    .optional(),
  timeUntil: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe tener formato HH:mm')
    .nullable()
    .optional(),
}

export const createPromotionBodySchema = z.object({
  name: z.string().trim().min(1, 'La promoción necesita un nombre').max(120),
  description: z.string().trim().max(500).nullable().optional(),
  imageUrl: z.string().url('La imagen debe ser una URL válida').nullable().optional(),
  type: z.enum(['BUNDLE', 'COMBO']),
  pricingMode: z.enum(['FIXED_TOTAL', 'PER_UNIT']),
  /** Precio en PESOS. 0 en PER_UNIT. Tope y 2 decimales: 30M de pesos se
   * volverían 3e9 centavos y desbordan el Int de Prisma; 99.999 se redondearía
   * en silencio. */
  price: z.coerce
    .number()
    .min(0, 'El precio no puede ser negativo')
    .max(999999.99, 'El precio es demasiado grande')
    .refine(v => /^\d+(\.\d{1,2})?$/.test(String(v)), 'El precio lleva máximo dos decimales')
    .default(0),
  groups: z.array(groupBodySchema).min(1, 'La promoción necesita al menos un grupo de productos'),
  displayOrder: z.coerce.number().int().min(0).default(0),
  ...scheduleShape,
})

// El update permite mandar sólo lo que cambió; si vienen groups, REEMPLAZAN a
// los existentes (el editor siempre manda la estructura completa).
export const updatePromotionBodySchema = createPromotionBodySchema.partial()

export type CreatePromotionRequest = z.infer<typeof createPromotionBodySchema>
export type UpdatePromotionRequest = z.infer<typeof updatePromotionBodySchema>
```

- [ ] **Step 2: Verificar que compila**

Run (en `avoqado-server/`): `npx tsc --noEmit -p tsconfig.json 2>&1 | grep promotion.schema || echo OK` — si el tsc pelón revienta por
memoria, `npm run build`. Expected: sin errores del archivo nuevo.

- [ ] **Step 3: Commit**

```bash
git add src/schemas/dashboard/promotion.schema.ts
git commit -m "feat(promociones): schemas zod del CRUD de dashboard"
```

---

## Task 2 (server): El service de dashboard — CRUD + publicar/archivar (TDD)

**Files:**

- Create: `src/services/dashboard/promotion.dashboard.service.ts`
- Test: `tests/unit/services/dashboard/promotion.dashboard.service.test.ts`

**Interfaces:**

- Consumes: `validatePromotionForPublish` + `PromotionDraft` de `@/services/promotions/validatePromotion`;
  `CreatePromotionRequest`/`UpdatePromotionRequest` (Task 1); `logAction` de `./activity-log.service`; prisma.
- Produces (los usa Task 3):

```typescript
export async function getPromotions(venueId: string, page?: number, pageSize?: number, status?: PromotionStatus, search?: string)
export async function getPromotionById(venueId: string, promotionId: string)
export async function createPromotion(venueId: string, data: CreatePromotionRequest, staffId?: string)
export async function updatePromotion(venueId: string, promotionId: string, data: UpdatePromotionRequest, staffId?: string)
export async function publishPromotion(venueId: string, promotionId: string, staffId?: string) // 400 con errors[] si no pasa el validador
export async function archivePromotion(venueId: string, promotionId: string, staffId?: string)
export async function unarchivePromotion(venueId: string, promotionId: string, staffId?: string) // ARCHIVED → DRAFT
export async function deletePromotion(venueId: string, promotionId: string, staffId?: string) // sólo DRAFT sin ventas
```

  Todas las lecturas devuelven el precio en PESOS (`price`, `priceDelta`) además de la estructura de grupos/opciones.

- [ ] **Step 1: Escribir los tests que fallan**

```typescript
// tests/unit/services/dashboard/promotion.dashboard.service.test.ts
import prisma from '@/utils/prismaClient'
import {
  archivePromotion,
  createPromotion,
  deletePromotion,
  getPromotions,
  publishPromotion,
  unarchivePromotion,
  updatePromotion,
} from '@/services/dashboard/promotion.dashboard.service'
import { BadRequestError, NotFoundError } from '@/errors/AppError'

const prismaMock = prisma as any

const filaPromo = (over: Record<string, any> = {}) => ({
  id: 'promo-1',
  venueId: 'venue-1',
  name: 'Combo del día',
  description: null,
  imageUrl: null,
  type: 'BUNDLE',
  pricingMode: 'FIXED_TOTAL',
  priceCents: 9900,
  status: 'DRAFT',
  displayOrder: 0,
  validFrom: null,
  validUntil: null,
  daysOfWeek: [],
  timeFrom: null,
  timeUntil: null,
  createdAt: new Date('2026-08-14T00:00:00Z'),
  updatedAt: new Date('2026-08-14T00:00:00Z'),
  groups: [
    {
      id: 'g1',
      name: 'Plato',
      displayOrder: 0,
      minSelect: 1,
      maxSelect: 1,
      options: [{ id: 'o1', productId: 'p1', quantity: 1, chargedQuantity: 1, priceDeltaCents: 0, displayOrder: 0 }],
    },
  ],
  ...over,
})

const crearBody = (over: Record<string, any> = {}) => ({
  name: 'Combo del día',
  type: 'BUNDLE' as const,
  pricingMode: 'FIXED_TOTAL' as const,
  price: 99,
  displayOrder: 0,
  daysOfWeek: [],
  groups: [{ name: 'Plato', options: [{ productId: 'p1', quantity: 1, chargedQuantity: 1, priceDelta: 0 }] }],
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  prismaMock.$transaction = jest.fn((cb: any) => cb(prismaMock))
  prismaMock.promotion.findFirst.mockResolvedValue(filaPromo())
  prismaMock.promotion.findMany.mockResolvedValue([filaPromo()])
  prismaMock.promotion.count.mockResolvedValue(1)
  prismaMock.promotion.create.mockResolvedValue(filaPromo())
  prismaMock.promotion.update.mockResolvedValue(filaPromo())
  prismaMock.promotion.updateMany.mockResolvedValue({ count: 1 }) // CAS de estado
  prismaMock.promotion.delete.mockResolvedValue({})
  prismaMock.promotionGroup.deleteMany.mockResolvedValue({ count: 1 })
  prismaMock.orderPromotion.count.mockResolvedValue(0)
  prismaMock.product.findMany.mockResolvedValue([{ id: 'p1', venueId: 'venue-1', active: true, name: 'Hamburguesa' }])
  prismaMock.activityLog.create.mockResolvedValue({})
})

describe('promotion.dashboard.service', () => {
  describe('getPromotions', () => {
    it('pagina, filtra por venue y devuelve el precio en PESOS', async () => {
      const result = await getPromotions('venue-1', 1, 20)

      expect(prismaMock.promotion.findMany.mock.calls[0][0].where).toMatchObject({ venueId: 'venue-1' })
      expect(result.data[0].price).toBe(99)
      expect(result.meta).toMatchObject({ totalCount: 1, currentPage: 1 })
    })

    it('filtra por status cuando se pide', async () => {
      await getPromotions('venue-1', 1, 20, 'PUBLISHED')

      expect(prismaMock.promotion.findMany.mock.calls[0][0].where).toMatchObject({ venueId: 'venue-1', status: 'PUBLISHED' })
    })
  })

  describe('createPromotion', () => {
    it('crea SIEMPRE en DRAFT, convirtiendo pesos → centavos', async () => {
      await createPromotion('venue-1', crearBody({ price: 99.5 }) as any, 'staff-1')

      const data = prismaMock.promotion.create.mock.calls[0][0].data
      expect(data.status).toBe('DRAFT')
      expect(data.priceCents).toBe(9950)
      expect(data.groups.create[0].options.create[0].priceDeltaCents).toBe(0)
    })

    it('🔴 un producto de OTRO venue no entra ni en DRAFT', async () => {
      prismaMock.product.findMany.mockResolvedValue([]) // el where con venueId no lo encontró

      await expect(createPromotion('venue-1', crearBody() as any, 'staff-1')).rejects.toThrow(/no pertenece|no existe/i)
      expect(prismaMock.promotion.create).not.toHaveBeenCalled()
    })

    it('audita la creación con el actor', async () => {
      await createPromotion('venue-1', crearBody() as any, 'staff-1')

      expect(prismaMock.activityLog.create).toHaveBeenCalled()
      const log = prismaMock.activityLog.create.mock.calls[0][0].data
      expect(log).toMatchObject({ action: 'PROMOTION_CREATED', entity: 'Promotion', staffId: 'staff-1', venueId: 'venue-1' })
    })
  })

  describe('updatePromotion', () => {
    it('si vienen groups, REEMPLAZA la estructura completa en una transacción', async () => {
      await updatePromotion('venue-1', 'promo-1', crearBody() as any, 'staff-1')

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
      expect(prismaMock.promotionGroup.deleteMany).toHaveBeenCalledWith({ where: { promotionId: 'promo-1' } })
      expect(prismaMock.promotion.update).toHaveBeenCalled()
    })

    it('sin groups en el body, NO toca la estructura', async () => {
      await updatePromotion('venue-1', 'promo-1', { name: 'Nuevo nombre' } as any, 'staff-1')

      expect(prismaMock.promotionGroup.deleteMany).not.toHaveBeenCalled()
    })

    it('🔴 una promoción de otro venue no se edita', async () => {
      prismaMock.promotion.findFirst.mockResolvedValue(null)

      await expect(updatePromotion('venue-ajeno', 'promo-1', { name: 'x' } as any)).rejects.toThrow(NotFoundError)
    })
  })

  describe('publishPromotion', () => {
    it('🔴 publica con CAS de estado SÓLO si validatePromotionForPublish pasa', async () => {
      await publishPromotion('venue-1', 'promo-1', 'staff-1')

      expect(prismaMock.product.findMany).toHaveBeenCalled()
      expect(prismaMock.promotion.updateMany).toHaveBeenCalledWith({
        where: { id: 'promo-1', venueId: 'venue-1', status: 'DRAFT' },
        data: { status: 'PUBLISHED' },
      })
    })

    it('🔴 si el validador reprueba, devuelve TODOS los errores y NO publica', async () => {
      prismaMock.product.findMany.mockResolvedValue([{ id: 'p1', venueId: 'venue-1', active: false, name: 'Hamburguesa' }])

      await expect(publishPromotion('venue-1', 'promo-1')).rejects.toMatchObject({
        // BadRequestError cuyo message trae los errores unidos — el controller los expone como errors[]
        message: expect.stringMatching(/desactivado/i),
      })
      expect(prismaMock.promotion.updateMany).not.toHaveBeenCalled()
    })

    it('re-publicar una PUBLISHED es no-op idempotente, sin auditoría falsa', async () => {
      prismaMock.promotion.findFirst.mockResolvedValue(filaPromo({ status: 'PUBLISHED' }))

      const result = await publishPromotion('venue-1', 'promo-1')

      expect(result.status).toBe('PUBLISHED')
      expect(prismaMock.promotion.updateMany).not.toHaveBeenCalled()
      expect(prismaMock.activityLog.create).not.toHaveBeenCalled()
    })

    it('🔴 si el estado cambió entre validar y publicar (CAS count 0), truena claro', async () => {
      prismaMock.promotion.updateMany.mockResolvedValue({ count: 0 })

      await expect(publishPromotion('venue-1', 'promo-1')).rejects.toThrow(/cambió de estado/i)
    })

    it('una ARCHIVED no se publica directo: primero se desarchiva (regla de estados)', async () => {
      prismaMock.promotion.findFirst.mockResolvedValue(filaPromo({ status: 'ARCHIVED' }))

      await expect(publishPromotion('venue-1', 'promo-1')).rejects.toThrow(/archivada/i)
    })
  })

  describe('archive / unarchive / delete', () => {
    it('archivar una PUBLISHED la saca del POS sin tocar lo vendido (CAS)', async () => {
      prismaMock.promotion.findFirst.mockResolvedValue(filaPromo({ status: 'PUBLISHED' }))

      await archivePromotion('venue-1', 'promo-1', 'staff-1')

      expect(prismaMock.promotion.updateMany).toHaveBeenCalledWith({
        where: { id: 'promo-1', venueId: 'venue-1', status: { in: ['DRAFT', 'PUBLISHED'] } },
        data: { status: 'ARCHIVED' },
      })
    })

    it('desarchivar regresa a DRAFT (nunca directo a PUBLISHED) (CAS)', async () => {
      prismaMock.promotion.findFirst.mockResolvedValue(filaPromo({ status: 'ARCHIVED' }))

      await unarchivePromotion('venue-1', 'promo-1')

      expect(prismaMock.promotion.updateMany).toHaveBeenCalledWith({
        where: { id: 'promo-1', venueId: 'venue-1', status: 'ARCHIVED' },
        data: { status: 'DRAFT' },
      })
    })

    it('🔴 borrar sólo aplica a DRAFT sin ventas', async () => {
      prismaMock.promotion.findFirst.mockResolvedValue(filaPromo({ status: 'PUBLISHED' }))

      await expect(deletePromotion('venue-1', 'promo-1')).rejects.toThrow(/borrador|archívala/i)
      expect(prismaMock.promotion.delete).not.toHaveBeenCalled()
    })

    it('🔴 un DRAFT que ya tuvo ventas (histórico raro) tampoco se borra', async () => {
      prismaMock.orderPromotion.count.mockResolvedValue(3)

      await expect(deletePromotion('venue-1', 'promo-1')).rejects.toThrow(/ventas/i)
    })
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx jest --selectProjects unit --testPathPattern "promotion.dashboard.service"` Expected: FAIL — módulo no encontrado.
(🔴 En este repo el argumento posicional NO filtra: siempre `--testPathPattern`.)

- [ ] **Step 3: Escribir la implementación**

```typescript
// src/services/dashboard/promotion.dashboard.service.ts
import { Prisma, PromotionStatus } from '@prisma/client'

import prisma from '@/utils/prismaClient'
import { BadRequestError, NotFoundError } from '@/errors/AppError'
import { validatePromotionForPublish, type PromotionDraft } from '@/services/promotions/validatePromotion'
import type { CreatePromotionRequest, UpdatePromotionRequest } from '@/schemas/dashboard/promotion.schema'
import { logAction } from './activity-log.service'

const includeEstructura = {
  groups: {
    orderBy: { displayOrder: 'asc' as const },
    include: { options: { orderBy: { displayOrder: 'asc' as const } } },
  },
}

/** El API habla PESOS; priceCents es interno del modelo. */
function toDto(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    imageUrl: row.imageUrl,
    type: row.type,
    pricingMode: row.pricingMode,
    price: row.priceCents / 100,
    status: row.status,
    displayOrder: row.displayOrder,
    validFrom: row.validFrom,
    validUntil: row.validUntil,
    daysOfWeek: row.daysOfWeek,
    timeFrom: row.timeFrom,
    timeUntil: row.timeUntil,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    groups: (row.groups ?? []).map((g: any) => ({
      id: g.id,
      name: g.name,
      options: (g.options ?? []).map((o: any) => ({
        id: o.id,
        productId: o.productId,
        quantity: o.quantity,
        chargedQuantity: o.chargedQuantity,
        priceDelta: o.priceDeltaCents / 100,
      })),
    })),
  }
}

async function findOwnedOrThrow(venueId: string, promotionId: string) {
  const row = await prisma.promotion.findFirst({ where: { id: promotionId, venueId }, include: includeEstructura })
  if (!row) throw new NotFoundError('No encontramos esa promoción en este establecimiento.')
  return row
}

/**
 * 🔴 Tenant en la ESCRITURA, no sólo al publicar: un producto ajeno no entra ni
 * en DRAFT — el borrador viaja al editor y a la MCP, y un id ajeno guardado es
 * una bomba dormida aunque el validador de publicar lo atraparía después.
 */
async function assertProductsBelongToVenue(venueId: string, productIds: string[]) {
  const unicos = [...new Set(productIds)]
  const encontrados = await prisma.product.findMany({ where: { id: { in: unicos }, venueId }, select: { id: true } })
  if (encontrados.length !== unicos.length) {
    const halladas = new Set(encontrados.map(p => p.id))
    const faltante = unicos.find(id => !halladas.has(id))
    throw new BadRequestError(`El producto ${faltante} no existe o no pertenece a este establecimiento.`)
  }
}

function gruposCreate(groups: NonNullable<CreatePromotionRequest['groups']>) {
  return groups.map((g, gi) => ({
    name: g.name,
    displayOrder: gi,
    minSelect: 1,
    maxSelect: 1,
    options: {
      create: g.options.map((o, oi) => ({
        productId: o.productId,
        quantity: o.quantity,
        chargedQuantity: o.chargedQuantity,
        priceDeltaCents: Math.round((o.priceDelta ?? 0) * 100),
        displayOrder: oi,
      })),
    },
  }))
}

export async function getPromotions(venueId: string, page = 1, pageSize = 20, status?: PromotionStatus, search?: string) {
  const where: Prisma.PromotionWhereInput = {
    venueId,
    ...(status ? { status } : {}),
    ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
  }
  const [totalCount, rows] = await Promise.all([
    prisma.promotion.count({ where }),
    prisma.promotion.findMany({
      where,
      include: includeEstructura,
      orderBy: [{ status: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])
  return {
    data: rows.map(toDto),
    meta: {
      totalCount,
      pageSize,
      currentPage: page,
      totalPages: Math.ceil(totalCount / pageSize),
      hasNextPage: page * pageSize < totalCount,
      hasPrevPage: page > 1,
    },
  }
}

export async function getPromotionById(venueId: string, promotionId: string) {
  return toDto(await findOwnedOrThrow(venueId, promotionId))
}

export async function createPromotion(venueId: string, data: CreatePromotionRequest, staffId?: string) {
  await assertProductsBelongToVenue(
    venueId,
    data.groups.flatMap(g => g.options.map(o => o.productId)),
  )

  const created = await prisma.promotion.create({
    data: {
      venueId,
      name: data.name,
      description: data.description ?? null,
      imageUrl: data.imageUrl ?? null,
      type: data.type,
      pricingMode: data.pricingMode,
      priceCents: Math.round((data.price ?? 0) * 100),
      displayOrder: data.displayOrder ?? 0,
      validFrom: data.validFrom ?? null,
      validUntil: data.validUntil ?? null,
      daysOfWeek: data.daysOfWeek ?? [],
      timeFrom: data.timeFrom ?? null,
      timeUntil: data.timeUntil ?? null,
      status: 'DRAFT', // publicar es un acto aparte, siempre
      groups: { create: gruposCreate(data.groups) },
    },
    include: includeEstructura,
  })

  void logAction({ staffId, venueId, action: 'PROMOTION_CREATED', entity: 'Promotion', entityId: created.id, data: { name: created.name } })
  return toDto(created)
}

export async function updatePromotion(venueId: string, promotionId: string, data: UpdatePromotionRequest, staffId?: string) {
  await findOwnedOrThrow(venueId, promotionId)

  if (data.groups) {
    await assertProductsBelongToVenue(
      venueId,
      data.groups.flatMap(g => g.options.map(o => o.productId)),
    )
  }

  const escalares: Prisma.PromotionUpdateInput = {
    ...(data.name !== undefined && { name: data.name }),
    ...(data.description !== undefined && { description: data.description }),
    ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
    ...(data.type !== undefined && { type: data.type }),
    ...(data.pricingMode !== undefined && { pricingMode: data.pricingMode }),
    ...(data.price !== undefined && { priceCents: Math.round(data.price * 100) }),
    ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
    ...(data.validFrom !== undefined && { validFrom: data.validFrom }),
    ...(data.validUntil !== undefined && { validUntil: data.validUntil }),
    ...(data.daysOfWeek !== undefined && { daysOfWeek: data.daysOfWeek }),
    ...(data.timeFrom !== undefined && { timeFrom: data.timeFrom }),
    ...(data.timeUntil !== undefined && { timeUntil: data.timeUntil }),
  }

  // Con groups: estructura completa se REEMPLAZA en una transacción (el editor
  // siempre manda todo; parchar grupo por grupo invita a estados imposibles).
  // Lo ya vendido no se toca: OrderPromotion guarda snapshot.
  const updated = await prisma.$transaction(async tx => {
    if (data.groups) {
      await tx.promotionGroup.deleteMany({ where: { promotionId } })
    }
    return tx.promotion.update({
      where: { id: promotionId },
      data: { ...escalares, ...(data.groups ? { groups: { create: gruposCreate(data.groups) } } : {}) },
      include: includeEstructura,
    })
  })

  void logAction({ staffId, venueId, action: 'PROMOTION_UPDATED', entity: 'Promotion', entityId: promotionId, data: { fields: Object.keys(data) } })
  return toDto(updated)
}

export async function publishPromotion(venueId: string, promotionId: string, staffId?: string) {
  const row = await findOwnedOrThrow(venueId, promotionId)
  if (row.status === 'ARCHIVED') {
    throw new BadRequestError('Esta promoción está archivada: desarchívala antes de publicarla.')
  }
  if (row.status === 'PUBLISHED') {
    // Idempotente: re-publicar lo publicado no es error ni genera auditoría falsa.
    return toDto(row)
  }

  // El validador canónico decide — con los productos REALES del venue.
  const productIds = row.groups.flatMap(g => g.options.map(o => o.productId))
  const productos = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, venueId: true, active: true },
  })
  const porId = new Map(productos.map(p => [p.id, p]))

  const draft: PromotionDraft = {
    venueId,
    type: row.type as PromotionDraft['type'],
    pricingMode: row.pricingMode as PromotionDraft['pricingMode'],
    priceCents: row.priceCents,
    groups: row.groups.map(g => ({
      name: g.name,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      options: g.options.map(o => ({
        productId: o.productId,
        productVenueId: porId.get(o.productId)?.venueId ?? 'desconocido',
        productActive: porId.get(o.productId)?.active ?? false,
        quantity: o.quantity,
        chargedQuantity: o.chargedQuantity,
        priceDeltaCents: o.priceDeltaCents,
      })),
    })),
  }

  const result = validatePromotionForPublish(draft)
  if (!result.ok) {
    // El controller convierte CUALQUIER BadRequestError de publish en
    // { errors: [...] } — todos los motivos juntos.
    throw new BadRequestError(result.errors.join('\n'))
  }

  // 🔴 CAS sobre el estado (audit 2026-08-14): entre validar y publicar, otra
  // sesión pudo archivarla — el where condicionado evita publicar una archivada.
  const updated = await prisma.promotion.updateMany({
    where: { id: promotionId, venueId, status: 'DRAFT' },
    data: { status: 'PUBLISHED' },
  })
  if (updated.count === 0) {
    throw new BadRequestError('La promoción cambió de estado mientras se validaba. Recarga e intenta de nuevo.')
  }
  void logAction({ staffId, venueId, action: 'PROMOTION_PUBLISHED', entity: 'Promotion', entityId: promotionId, data: { name: row.name } })
  return getPromotionById(venueId, promotionId)
}

export async function archivePromotion(venueId: string, promotionId: string, staffId?: string) {
  const row = await findOwnedOrThrow(venueId, promotionId)
  if (row.status === 'ARCHIVED') {
    return toDto(row) // idempotente: archivar lo archivado es no-op
  }
  const updated = await prisma.promotion.updateMany({
    where: { id: promotionId, venueId, status: { in: ['DRAFT', 'PUBLISHED'] } },
    data: { status: 'ARCHIVED' },
  })
  if (updated.count > 0) {
    void logAction({ staffId, venueId, action: 'PROMOTION_ARCHIVED', entity: 'Promotion', entityId: promotionId, data: { name: row.name } })
  }
  return getPromotionById(venueId, promotionId)
}

export async function unarchivePromotion(venueId: string, promotionId: string, staffId?: string) {
  const row = await findOwnedOrThrow(venueId, promotionId)
  if (row.status !== 'ARCHIVED') {
    throw new BadRequestError('Sólo una promoción archivada se puede desarchivar.')
  }
  // Siempre a DRAFT: re-publicar exige pasar el validador otra vez (el catálogo
  // pudo cambiar mientras estuvo archivada). CAS igual que publish.
  const updated = await prisma.promotion.updateMany({
    where: { id: promotionId, venueId, status: 'ARCHIVED' },
    data: { status: 'DRAFT' },
  })
  if (updated.count > 0) {
    void logAction({ staffId, venueId, action: 'PROMOTION_UNARCHIVED', entity: 'Promotion', entityId: promotionId, data: { name: row.name } })
  }
  return getPromotionById(venueId, promotionId)
}

export async function deletePromotion(venueId: string, promotionId: string, staffId?: string) {
  const row = await findOwnedOrThrow(venueId, promotionId)
  if (row.status !== 'DRAFT') {
    throw new BadRequestError('Sólo un borrador se puede borrar. Si ya se publicó, archívala.')
  }
  const ventas = await prisma.orderPromotion.count({ where: { promotionId } })
  if (ventas > 0) {
    throw new BadRequestError('Esta promoción ya tiene ventas registradas: archívala en vez de borrarla.')
  }
  await prisma.promotion.delete({ where: { id: promotionId } })
  void logAction({ staffId, venueId, action: 'PROMOTION_DELETED', entity: 'Promotion', entityId: promotionId, data: { name: row.name } })
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx jest --selectProjects unit --testPathPattern "promotion.dashboard.service"` Expected: PASS — TODOS los tests del archivo (17).
Nota para el ejecutor: `logAction` escribe vía `prisma.activityLog.create` best-effort; si el test de auditoría no ve la llamada,
verifica que el mock global no la esté cortando y usa `await new Promise(setImmediate)` antes del assert.

- [ ] **Step 5: Verificar por mutación**

Cambiar en `publishPromotion` el `if (!result.ok)` por `if (false)` y correr. Expected: muere "si el validador reprueba…". **Revertir.**

- [ ] **Step 6: Commit**

```bash
git add src/services/dashboard/promotion.dashboard.service.ts tests/unit/services/dashboard/promotion.dashboard.service.test.ts
git commit -m "feat(promociones): service CRUD de dashboard con publicar deliberado"
```

---

## Task 3 (server): Controller + rutas con el gate en orden

**Files:**

- Create: `src/controllers/dashboard/promotion.dashboard.controller.ts`
- Modify: `src/routes/dashboard.routes.ts` (junto al grupo de discounts, ~línea 9877)

**Interfaces:**

- Consumes: el service (Task 2), schemas (Task 1), `checkPermission`, `checkFeatureAccess`, `validateRequest`.
- Produces: `GET|POST /api/v1/dashboard/venues/:venueId/promotions`, `GET|PUT|DELETE .../promotions/:promotionId`,
  `POST .../promotions/:promotionId/publish|archive|unarchive`. Respuesta de publish reprobado: `400 { errors: string[] }`.

- [ ] **Step 1: Escribir el controller**

```typescript
// src/controllers/dashboard/promotion.dashboard.controller.ts
import { NextFunction, Request, Response } from 'express'

import { BadRequestError } from '@/errors/AppError'
import * as promotionService from '@/services/dashboard/promotion.dashboard.service'
import { getPromotionsQuerySchema } from '@/schemas/dashboard/promotion.schema'

function actor(req: Request): string | undefined {
  return (req as any).authContext?.userId
}

export async function getPromotions(req: Request, res: Response, next: NextFunction) {
  try {
    const { venueId } = req.params
    const query = getPromotionsQuerySchema.parse(req.query)
    res.json(await promotionService.getPromotions(venueId, query.page, query.pageSize, query.status, query.search))
  } catch (error) {
    next(error)
  }
}

export async function getPromotionById(req: Request, res: Response, next: NextFunction) {
  try {
    const { venueId, promotionId } = req.params
    res.json(await promotionService.getPromotionById(venueId, promotionId))
  } catch (error) {
    next(error)
  }
}

export async function createPromotion(req: Request, res: Response, next: NextFunction) {
  try {
    const { venueId } = req.params
    res.status(201).json(await promotionService.createPromotion(venueId, req.body, actor(req)))
  } catch (error) {
    next(error)
  }
}

export async function updatePromotion(req: Request, res: Response, next: NextFunction) {
  try {
    const { venueId, promotionId } = req.params
    res.json(await promotionService.updatePromotion(venueId, promotionId, req.body, actor(req)))
  } catch (error) {
    next(error)
  }
}

export async function publishPromotion(req: Request, res: Response, next: NextFunction) {
  try {
    const { venueId, promotionId } = req.params
    res.json(await promotionService.publishPromotion(venueId, promotionId, actor(req)))
  } catch (error) {
    // 🔴 TODO BadRequestError de publish sale como { errors: [...] } — también
    // cuando es UN solo motivo (audit 2026-08-14: con un error único, dejarlo
    // pasar a next() respondía { message } y el dashboard esperaba errors[]).
    if (error instanceof BadRequestError) {
      res.status(400).json({ errors: error.message.split('\n') })
      return
    }
    next(error)
  }
}

export async function archivePromotion(req: Request, res: Response, next: NextFunction) {
  try {
    const { venueId, promotionId } = req.params
    res.json(await promotionService.archivePromotion(venueId, promotionId, actor(req)))
  } catch (error) {
    next(error)
  }
}

export async function unarchivePromotion(req: Request, res: Response, next: NextFunction) {
  try {
    const { venueId, promotionId } = req.params
    res.json(await promotionService.unarchivePromotion(venueId, promotionId, actor(req)))
  } catch (error) {
    next(error)
  }
}

export async function deletePromotion(req: Request, res: Response, next: NextFunction) {
  try {
    const { venueId, promotionId } = req.params
    await promotionService.deletePromotion(venueId, promotionId, actor(req))
    res.status(204).send()
  } catch (error) {
    next(error)
  }
}
```

- [ ] **Step 2: Montar las rutas**

En `src/routes/dashboard.routes.ts`, inmediatamente DESPUÉS del bloque de discounts (busca
`router.use('/venues/:venueId/customers/:customerId/discounts'` ~línea 9877) agregar — mismo patrón de gate de grupo:

```typescript
// ============================================================================
// Promotion Routes (combos, bundles, 2x1) — tier PRO 'PROMOTIONS'
// El gate de plan va al GRUPO, igual que discounts. checkPermission por ruta
// corre DESPUÉS del auth del use() — el 403 de plan sólo lo ve un miembro.
// ============================================================================
router.use('/venues/:venueId/promotions', authenticateTokenMiddleware, checkFeatureAccess('PROMOTIONS'))

router.get(
  '/venues/:venueId/promotions',
  authenticateTokenMiddleware,
  checkPermission('discounts:read'),
  validateRequest(z.object({ params: promotionVenueParamsSchema, query: getPromotionsQuerySchema })),
  promotionDashboardController.getPromotions,
)

router.post(
  '/venues/:venueId/promotions',
  authenticateTokenMiddleware,
  checkPermission('discounts:create'),
  validateRequest(z.object({ params: promotionVenueParamsSchema, body: createPromotionBodySchema })),
  promotionDashboardController.createPromotion,
)

router.get(
  '/venues/:venueId/promotions/:promotionId',
  authenticateTokenMiddleware,
  checkPermission('discounts:read'),
  validateRequest(z.object({ params: promotionParamsSchema })),
  promotionDashboardController.getPromotionById,
)

router.put(
  '/venues/:venueId/promotions/:promotionId',
  authenticateTokenMiddleware,
  checkPermission('discounts:update'),
  validateRequest(z.object({ params: promotionParamsSchema, body: updatePromotionBodySchema })),
  promotionDashboardController.updatePromotion,
)

router.post(
  '/venues/:venueId/promotions/:promotionId/publish',
  authenticateTokenMiddleware,
  checkPermission('discounts:update'),
  validateRequest(z.object({ params: promotionParamsSchema })),
  promotionDashboardController.publishPromotion,
)

router.post(
  '/venues/:venueId/promotions/:promotionId/archive',
  authenticateTokenMiddleware,
  checkPermission('discounts:update'),
  validateRequest(z.object({ params: promotionParamsSchema })),
  promotionDashboardController.archivePromotion,
)

router.post(
  '/venues/:venueId/promotions/:promotionId/unarchive',
  authenticateTokenMiddleware,
  checkPermission('discounts:update'),
  validateRequest(z.object({ params: promotionParamsSchema })),
  promotionDashboardController.unarchivePromotion,
)

router.delete(
  '/venues/:venueId/promotions/:promotionId',
  authenticateTokenMiddleware,
  checkPermission('discounts:delete'),
  validateRequest(z.object({ params: promotionParamsSchema })),
  promotionDashboardController.deletePromotion,
)
```

Y arriba, junto a los demás imports de controllers/schemas (~líneas 58 y 194):

```typescript
import * as promotionDashboardController from '../controllers/dashboard/promotion.dashboard.controller'
import {
  createPromotionBodySchema,
  getPromotionsQuerySchema,
  promotionParamsSchema,
  promotionVenueParamsSchema,
  updatePromotionBodySchema,
} from '../schemas/dashboard/promotion.schema'
```

- [ ] **Step 3: Verificar que compila y que las suites viven**

Run: `npm run build && npx jest --selectProjects unit --testPathPattern "promotion"` Expected: build OK, todas las suites de promotions verdes.

- [ ] **Step 4: Commit**

```bash
git add src/controllers/dashboard/promotion.dashboard.controller.ts src/routes/dashboard.routes.ts
git commit -m "feat(promociones): rutas CRUD de dashboard con gate PRO y permisos de discounts"
```

---

## Task 4 (server): Los dos ajustes de panel entran por la whitelist Zod

**Files:**

- Modify: `src/schemas/dashboard/venueSettings.schema.ts` (body de `UpdateVenueSettingsSchema`, ~línea 37+)
- Test: `tests/unit/schemas/venueSettingsPromotionsPanel.test.ts`

**Interfaces:**

- Consumes: nada nuevo — Prisma YA tiene `promotionsPanelCashier/Customer` (schema.prisma:838-839, migrados).
- Produces: `PUT /api/v1/dashboard/venues/:venueId/settings` acepta y persiste los dos campos. El service es passthrough
  (`venueSettings.dashboard.service.ts:225` hace upsert con `updates` tal cual): la ÚNICA pieza faltante es el Zod — sin ella,
  `validateRequest` reemplaza `req.body` con el objeto parseado y los campos **se pierden en silencio**.

- [ ] **Step 1: Escribir el test que falla**

```typescript
// tests/unit/schemas/venueSettingsPromotionsPanel.test.ts
import { UpdateVenueSettingsSchema } from '@/schemas/dashboard/venueSettings.schema'

describe('VenueSettings acepta los ajustes de panel de promociones', () => {
  it('🔴 promotionsPanelCashier/Customer sobreviven el parse (sin esto se pierden en silencio)', () => {
    const parsed = UpdateVenueSettingsSchema.parse({
      body: { promotionsPanelCashier: 'SIDE_PANEL', promotionsPanelCustomer: 'HIDDEN' },
      params: { venueId: 'venue-1' },
    })

    expect(parsed.body).toMatchObject({ promotionsPanelCashier: 'SIDE_PANEL', promotionsPanelCustomer: 'HIDDEN' })
  })

  it('un valor fuera del enum se rechaza con mensaje en español', () => {
    expect(() =>
      UpdateVenueSettingsSchema.parse({ body: { promotionsPanelCashier: 'GIGANTE' }, params: { venueId: 'venue-1' } }),
    ).toThrow()
  })
})
```

(Si `UpdateVenueSettingsSchema` no exporta o su shape difiere — p.ej. params con otro nombre — el ejecutor DEBE abrir
`src/schemas/dashboard/venueSettings.schema.ts` y ajustar el test al shape real antes de continuar; el objetivo del test no cambia.)

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx jest --selectProjects unit --testPathPattern "venueSettingsPromotionsPanel"` Expected: FAIL — los campos no sobreviven el parse.

- [ ] **Step 3: Agregar los campos al body del schema Y al create del upsert**

En `src/schemas/dashboard/venueSettings.schema.ts`, dentro del `body` de `UpdateVenueSettingsSchema`:

```typescript
  // Dónde salen las promociones en el POS (pantalla del cajero / del cliente).
  // HIDDEN es preferencia de layout del propio local, NO el candado de tier.
  promotionsPanelCashier: z.enum(['HIDDEN', 'TAB', 'SIDE_PANEL'], { message: 'Valor de panel inválido' }).optional(),
  promotionsPanelCustomer: z.enum(['HIDDEN', 'TAB', 'SIDE_PANEL'], { message: 'Valor de panel inválido' }).optional(),
```

🔴 Y en `src/services/dashboard/venueSettings.dashboard.service.ts`, el `createData` (~línea 137-177) del upsert: el PRIMER PUT de un
venue sin fila de VenueSettings entra por `create` (que usa `createData`, no `updates`) y perdería los dos campos en silencio
(audit 2026-08-14). Agregar al final del objeto `createData`:

```typescript
    ...(updates.promotionsPanelCashier !== undefined && { promotionsPanelCashier: updates.promotionsPanelCashier }),
    ...(updates.promotionsPanelCustomer !== undefined && { promotionsPanelCustomer: updates.promotionsPanelCustomer }),
```

Y un test más en el mismo archivo de test (mockear `prismaMock.venueSettings.upsert` y asertar que `create` trae los campos cuando
vienen en `updates`):

```typescript
  it('🔴 el PRIMER PUT (venue sin fila) también persiste los paneles — el create del upsert los lleva', async () => {
    prismaMock.venue.findUnique.mockResolvedValue({ id: 'venue-1' }) // el service valida el venue primero (:131-137)
    prismaMock.venueSettings.upsert.mockResolvedValue({})
    const { updateVenueSettings } = await import('@/services/dashboard/venueSettings.dashboard.service')

    await updateVenueSettings('venue-1', { promotionsPanelCashier: 'SIDE_PANEL' } as any, 'staff-1')

    const args = prismaMock.venueSettings.upsert.mock.calls[0][0]
    expect(args.create).toMatchObject({ promotionsPanelCashier: 'SIDE_PANEL' })
    expect(args.update).toMatchObject({ promotionsPanelCashier: 'SIDE_PANEL' })
  })
```

(Si `updateVenueSettings` exige más mocks —p.ej. el retry serializable de `cashReconciliationEnabled` NO aplica aquí porque no viene ese
campo— el ejecutor ajusta los mocks mínimos leyendo el service; la intención del assert no cambia.)

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx jest --selectProjects unit --testPathPattern "venueSettingsPromotionsPanel"` Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/schemas/dashboard/venueSettings.schema.ts tests/unit/schemas/venueSettingsPromotionsPanel.test.ts
git commit -m "feat(promociones): ajustes de panel del POS aceptados por venue settings"
```

---

## Task 5 (dashboard): Tipos + cliente API

**Files:**

- Create: `src/types/promotion.ts`
- Create: `src/services/promotion.service.ts`

**Interfaces:**

- Consumes: `api` de `@/api` (axios con auth/retry/offline ya integrados — NO duplicar).
- Produces: `promotionService.{getPromotions,getPromotionById,createPromotion,updatePromotion,publishPromotion,archivePromotion,unarchivePromotion,deletePromotion}` + tipos `Promotion`, `PromotionGroup`, `PromotionOption`, `UpsertPromotionRequest`, `PromotionsListResponse`. Los usan Tasks 6–11.

- [ ] **Step 1: Escribir los tipos**

```typescript
// src/types/promotion.ts
export type PromotionType = 'BUNDLE' | 'COMBO'
export type PromotionPricingMode = 'FIXED_TOTAL' | 'PER_UNIT'
export type PromotionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export interface PromotionOption {
  id?: string
  productId: string
  /** Unidades que ENTRAN al carrito. 2 en un 2x1. */
  quantity: number
  /** Unidades que se COBRAN. 1 en un 2x1. */
  chargedQuantity: number
  /** Sobreprecio en PESOS (sólo FIXED_TOTAL). */
  priceDelta: number
}

export interface PromotionGroup {
  id?: string
  name: string
  options: PromotionOption[]
}

export interface Promotion {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  type: PromotionType
  pricingMode: PromotionPricingMode
  /** PESOS — el API nunca habla centavos. */
  price: number
  status: PromotionStatus
  displayOrder: number
  validFrom: string | null
  validUntil: string | null
  daysOfWeek: number[]
  timeFrom: string | null
  timeUntil: string | null
  createdAt: string
  updatedAt: string
  groups: PromotionGroup[]
}

export interface UpsertPromotionRequest {
  name: string
  description?: string | null
  imageUrl?: string | null
  type: PromotionType
  pricingMode: PromotionPricingMode
  price: number
  groups: Array<{ name: string; options: Array<Omit<PromotionOption, 'id'>> }>
  validFrom?: string | null
  validUntil?: string | null
  daysOfWeek?: number[]
  timeFrom?: string | null
  timeUntil?: string | null
  displayOrder?: number
}

export interface PromotionsListResponse {
  data: Promotion[]
  meta: { totalCount: number; pageSize: number; currentPage: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }
}

/** El 400 de publicar trae TODOS los motivos juntos. */
export interface PublishValidationError {
  errors: string[]
}
```

- [ ] **Step 2: Escribir el cliente**

```typescript
// src/services/promotion.service.ts
import api from '@/api'
import type { Promotion, PromotionsListResponse, PromotionStatus, UpsertPromotionRequest } from '@/types/promotion'

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/promotions`

const promotionService = {
  async getPromotions(venueId: string, params: { page?: number; pageSize?: number; status?: PromotionStatus; search?: string } = {}) {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.pageSize) qs.set('pageSize', String(params.pageSize))
    if (params.status) qs.set('status', params.status)
    if (params.search) qs.set('search', params.search)
    const query = qs.toString()
    const response = await api.get<PromotionsListResponse>(`${base(venueId)}${query ? `?${query}` : ''}`)
    return response.data
  },

  async getPromotionById(venueId: string, promotionId: string) {
    const response = await api.get<Promotion>(`${base(venueId)}/${promotionId}`)
    return response.data
  },

  async createPromotion(venueId: string, data: UpsertPromotionRequest) {
    const response = await api.post<Promotion>(base(venueId), data)
    return response.data
  },

  async updatePromotion(venueId: string, promotionId: string, data: Partial<UpsertPromotionRequest>) {
    const response = await api.put<Promotion>(`${base(venueId)}/${promotionId}`, data)
    return response.data
  },

  /** El 400 llega como { errors: string[] } — el caller los pinta como lista. */
  async publishPromotion(venueId: string, promotionId: string) {
    const response = await api.post<Promotion>(`${base(venueId)}/${promotionId}/publish`)
    return response.data
  },

  async archivePromotion(venueId: string, promotionId: string) {
    const response = await api.post<Promotion>(`${base(venueId)}/${promotionId}/archive`)
    return response.data
  },

  async unarchivePromotion(venueId: string, promotionId: string) {
    const response = await api.post<Promotion>(`${base(venueId)}/${promotionId}/unarchive`)
    return response.data
  },

  async deletePromotion(venueId: string, promotionId: string) {
    await api.delete(`${base(venueId)}/${promotionId}`)
  },
}

export default promotionService
```

- [ ] **Step 3: Verificar que compila**

Run (en `avoqado-web-dashboard/`): `npm run build` Expected: sin errores TS.

- [ ] **Step 4: Commit**

```bash
git add src/types/promotion.ts src/services/promotion.service.ts
git commit -m "feat(promociones): tipos y cliente API de la seccion"
```

---

## Task 6 (dashboard): Registrar la sección — ruta, sidebar, lazy, registry, i18n base

**Files:**

- Create: `src/pages/Promotions/Bundles.tsx` (shell: título + FeatureGate + empty state; la lista real llega en Task 7)
- Modify: `src/routes/lazyComponents.ts` (~línea 228, junto a `Upsell`)
- Modify: `src/routes/venueRoutes.tsx` (después del bloque `promotions/coupons`, ~línea 692)
- Modify: `src/components/Sidebar/app-sidebar.tsx` (`promoItems`, ~línea 556-585)
- Modify: `src/config/feature-registry.ts` (rutas de `AVOQADO_PROMOTIONS`, ~línea 432)
- Modify: `src/locales/{en,es,fr}/promotions.json` (raíz nueva `bundles`) y `src/locales/{en,es,fr}/sidebar.json` (`promotionsMenu.bundles`)

**Interfaces:**

- Consumes: `promotionService` (Task 5), `FeatureGate` (`@/components/billing/FeatureGate`), `PermissionProtectedRoute`.
- Produces: ruta `promotions/bundles` visible en sidebar con candado PRO para FREE (patrón "visible teaser": `PermissionProtectedRoute permission="discounts:read"` en la ruta + `<FeatureGate feature="PROMOTIONS">` DENTRO de la página — NUNCA `FeatureProtectedRoute`, que redirige y esconde).

- [ ] **Step 1: Shell de la página**

```tsx
// src/pages/Promotions/Bundles.tsx
import { useTranslation } from 'react-i18next'

import { FeatureGate } from '@/components/billing/FeatureGate'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { useCurrentVenue } from '@/hooks/use-current-venue'

export default function Bundles() {
  const { t } = useTranslation('promotions')
  // (venueId entra hasta la Task 7 — declararlo sin uso aquí truena el lint)

  return (
    <FeatureGate feature="PROMOTIONS">
      <div className="p-4 bg-background text-foreground" data-tour="bundles-page">
        <PageTitleWithInfo title={t('bundles.title')} tooltip={t('bundles.subtitle')} />
        {/* Task 7 reemplaza esto con la lista real */}
        <p className="text-muted-foreground mt-6">{t('bundles.list.emptyStateDesc')}</p>
      </div>
    </FeatureGate>
  )
}
```

- [ ] **Step 2: Registrar lazy + ruta + sidebar + registry**

En `src/routes/lazyComponents.ts` (junto a la línea 228):

```typescript
export const Bundles = lazyWithRetry(() => import('@/pages/Promotions/Bundles'))
```

En `src/routes/venueRoutes.tsx`, después del bloque de coupons (~línea 692):

```tsx
    // Promotions - Combos y paquetes (BUNDLE/COMBO/2x1). Teaser visible: el
    // permiso protege la ruta; el tier lo gatea <FeatureGate> DENTRO de la
    // página para que FREE vea el candado y el upsell, no un redirect.
    {
      path: 'promotions/bundles',
      element: <PermissionProtectedRoute permission="discounts:read" />,
      children: [{ index: true, element: <Bundles /> }],
    },
```

(+ `Bundles` al import del barrel de lazyComponents en ese archivo.)

En `src/components/Sidebar/app-sidebar.tsx`, dentro de `promoItems` (~línea 557), como PRIMER item del grupo:

```tsx
  {
    title: t('sidebar:promotionsMenu.bundles'),
    url: 'promotions/bundles',
    permission: 'discounts:read',
    premiumLocked: !hasPromotionsFeature,
    gatedFeature: 'PROMOTIONS',
    keywords: ['combos', 'paquetes', '2x1', 'bundle', 'promo'],
  },
```

(🔴 En el sidebar se usa `hasFeatureAccess` — NUNCA `checkFeatureAccess`, documentado en el propio archivo.)

En `src/config/feature-registry.ts`, agregar a `routes` de `AVOQADO_PROMOTIONS` (~línea 432) una entrada `RouteDefinition` — el array
NO es de strings (`src/types/white-label.ts:206`): copiar la forma exacta de una entrada hermana existente, p.ej.
`{ path: 'promotions/bundles', element: 'Bundles' }` ajustada al shape real que usen las demás.

- [ ] **Step 3: i18n base**

En `src/locales/es/promotions.json`, raíz hermana de `discounts`/`coupons`/`common`:

```json
"bundles": {
  "title": "Combos y paquetes",
  "subtitle": "Arma combos, paquetes y 2x1 con precio exacto al centavo. Publícalos cuando estén listos y aparecen en el POS.",
  "list": {
    "emptyState": "Sin promociones todavía",
    "emptyStateDesc": "Crea tu primer combo o 2x1. Se guarda como borrador y no aparece en el POS hasta que lo publiques."
  }
}
```

En `src/locales/en/promotions.json`:

```json
"bundles": {
  "title": "Combos & bundles",
  "subtitle": "Build combos, bundles and 2-for-1 deals priced to the cent. Publish them when ready and they show up on the POS.",
  "list": {
    "emptyState": "No promotions yet",
    "emptyStateDesc": "Create your first combo or 2-for-1. It saves as a draft and won't show on the POS until you publish it."
  }
}
```

(fr: copiar la estructura de en con traducción francesa análoga.) En `src/locales/{en,es,fr}/sidebar.json`, bajo `promotionsMenu`:
es `"bundles": "Combos y paquetes"` · en `"bundles": "Combos & bundles"` · fr `"bundles": "Combos et formules"`.

- [ ] **Step 4: Verificar a ojo y por build**

Run: `npm run build && npm run lint` Expected: verdes. Levantar `npm run dev`, entrar a un venue → sidebar muestra "Combos y paquetes";
con venue FREE (no grandfathered) la página sale borrosa con candado PRO y CTA a suscripciones.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Promotions/Bundles.tsx src/routes/lazyComponents.ts src/routes/venueRoutes.tsx src/components/Sidebar/app-sidebar.tsx src/config/feature-registry.ts src/locales/en/promotions.json src/locales/es/promotions.json src/locales/fr/promotions.json src/locales/en/sidebar.json src/locales/es/sidebar.json src/locales/fr/sidebar.json
git commit -m "feat(promociones): seccion Combos y paquetes registrada con teaser PRO visible"
```

---

## Task 7 (dashboard): La lista

**Files:**

- Modify: `src/pages/Promotions/Bundles.tsx` (reemplaza el shell)
- Modify: `src/locales/{en,es,fr}/promotions.json` (llaves de lista/acciones/toasts)

**Interfaces:**

- Consumes: `promotionService` (Task 5), `DataTable`, `PermissionGate`, `useToast`, `useCurrentVenue`.
- Produces: lista con estado (badge por status), búsqueda debounced, filtro por status, menú de acciones por fila
  (editar/publicar/archivar/desarchivar/borrar) y CTA "Nueva promoción" que abre el editor (Task 8: `BundleEditor`).

- [ ] **Step 1: Implementar la lista completa**

```tsx
// src/pages/Promotions/Bundles.tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus, Rocket, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import DataTable from '@/components/data-table'
import { PermissionGate } from '@/components/PermissionGate'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CheckboxFilterContent, FilterPill } from '@/components/filters' // 🔴 regla ui-patterns: filtros Stripe, no Select — espejar props exactas de src/pages/Order/Orders.tsx
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { useToast } from '@/hooks/use-toast'
import promotionService from '@/services/promotion.service'
import type { Promotion, PromotionStatus } from '@/types/promotion'
import { BundleEditor } from './components/BundleEditor'

const STATUS_BADGE: Record<PromotionStatus, 'default' | 'secondary' | 'outline'> = {
  PUBLISHED: 'default',
  DRAFT: 'secondary',
  ARCHIVED: 'outline',
}

export default function Bundles() {
  const { t } = useTranslation('promotions')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { can } = useAccess()
  // 🔴 FeatureGate monta los children aunque no haya acceso (solo los blurea):
  // sin este enabled, un venue FREE dispararía queries que terminan en 403
  // escondidos bajo el paywall.
  const { hasAccess } = useTierFeatureAccess('PROMOTIONS')

  const [statusFilter, setStatusFilter] = useState<string[]>([]) // multi-select estilo Stripe; vacío = todas
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Promotion | null>(null)
  const [publishErrors, setPublishErrors] = useState<string[] | null>(null)
  const [toDelete, setToDelete] = useState<Promotion | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['promotions', venueId, statusFilter],
    queryFn: () =>
      promotionService.getPromotions(venueId!, {
        status: statusFilter.length === 1 ? (statusFilter[0] as PromotionStatus) : undefined,
        pageSize: 100,
      }),
    enabled: !!venueId && hasAccess,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['promotions', venueId] })

  const publishMutation = useMutation({
    mutationFn: (id: string) => promotionService.publishPromotion(venueId!, id),
    onSuccess: () => {
      toast({ title: t('bundles.toasts.published') })
      invalidate()
    },
    onError: (error: any) => {
      const errors: string[] | undefined = error?.response?.data?.errors
      if (errors?.length) setPublishErrors(errors) // TODOS los motivos, juntos
      else toast({ title: t('bundles.toasts.publishFailed'), variant: 'destructive' })
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => promotionService.archivePromotion(venueId!, id),
    onSuccess: () => {
      toast({ title: t('bundles.toasts.archived') })
      invalidate()
    },
  })

  const unarchiveMutation = useMutation({
    mutationFn: (id: string) => promotionService.unarchivePromotion(venueId!, id),
    onSuccess: () => {
      toast({ title: t('bundles.toasts.unarchived') })
      invalidate()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => promotionService.deletePromotion(venueId!, id),
    onSuccess: () => {
      toast({ title: t('bundles.toasts.deleted') })
      setToDelete(null)
      invalidate()
    },
    onError: (error: any) => {
      toast({ title: error?.response?.data?.message ?? t('bundles.toasts.deleteFailed'), variant: 'destructive' })
      setToDelete(null)
    },
  })

  const rows = useMemo(() => {
    const all = data?.data ?? []
    // Filtro multi-select en cliente (la lista cabe completa: pageSize 100)
    return statusFilter.length > 0 ? all.filter(p => statusFilter.includes(p.status)) : all
  }, [data, statusFilter])

  const columns = useMemo<ColumnDef<Promotion>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('bundles.list.name'),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            {row.original.imageUrl ? (
              <img src={row.original.imageUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-muted" />
            )}
            <span className="font-medium">{row.original.name}</span>
          </div>
        ),
      },
      {
        accessorKey: 'pricingMode',
        header: t('bundles.list.mode'),
        cell: ({ row }) =>
          row.original.pricingMode === 'PER_UNIT' ? t('bundles.list.modePerUnit') : t('bundles.list.modeFixed'),
      },
      {
        accessorKey: 'price',
        header: t('bundles.list.price'),
        cell: ({ row }) =>
          row.original.pricingMode === 'PER_UNIT' ? '—' : `$${row.original.price.toFixed(2)}`,
      },
      {
        accessorKey: 'status',
        header: t('bundles.list.status'),
        cell: ({ row }) => (
          <Badge variant={STATUS_BADGE[row.original.status]}>{t(`bundles.status.${row.original.status}`)}</Badge>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const promo = row.original
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="cursor-pointer" data-tour="bundle-row-actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* Cada acción gateada por su permiso: un VIEWER con discounts:read
                    no debe ver botones que terminan en 403 */}
                {can('discounts:update') && (
                  <DropdownMenuItem
                    onClick={() => {
                      setEditing(promo)
                      setEditorOpen(true)
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" /> {t('bundles.actions.edit')}
                  </DropdownMenuItem>
                )}
                {can('discounts:update') && promo.status === 'DRAFT' && (
                  <DropdownMenuItem onClick={() => publishMutation.mutate(promo.id)}>
                    <Rocket className="mr-2 h-4 w-4" /> {t('bundles.actions.publish')}
                  </DropdownMenuItem>
                )}
                {can('discounts:update') && promo.status === 'PUBLISHED' && (
                  <DropdownMenuItem onClick={() => archiveMutation.mutate(promo.id)}>
                    <Archive className="mr-2 h-4 w-4" /> {t('bundles.actions.archive')}
                  </DropdownMenuItem>
                )}
                {can('discounts:update') && promo.status === 'ARCHIVED' && (
                  <DropdownMenuItem onClick={() => unarchiveMutation.mutate(promo.id)}>
                    <ArchiveRestore className="mr-2 h-4 w-4" /> {t('bundles.actions.unarchive')}
                  </DropdownMenuItem>
                )}
                {can('discounts:delete') && promo.status === 'DRAFT' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => setToDelete(promo)}>
                      <Trash2 className="mr-2 h-4 w-4" /> {t('bundles.actions.delete')}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    // 🔴 Deps ESTABLES: el objeto de useMutation cambia cada render (rompería la
    // memoización de columnas); .mutate sí es estable. `can` va en deps.
    [t, can, publishMutation.mutate, archiveMutation.mutate, unarchiveMutation.mutate],
  )

  return (
    <FeatureGate feature="PROMOTIONS">
      <div className="p-4 bg-background text-foreground" data-tour="bundles-page">
        <div className="flex items-start justify-between gap-4">
          <PageTitleWithInfo title={t('bundles.title')} tooltip={t('bundles.subtitle')} />
          <div className="flex items-center gap-2">
            {/* Filtro estilo Stripe — props REALES: CheckboxFilterContent exige
                title/options/selectedValues/onApply (CheckboxFilterContent.tsx:13-24)
                y FilterPill NO acepta data-tour (sin rest spread) → va en el div. */}
            <div data-tour="bundle-status-filter">
              <FilterPill label={t('bundles.list.status')} activeCount={statusFilter.length}>
                <CheckboxFilterContent
                  title={t('bundles.list.status')}
                  options={[
                    { value: 'DRAFT', label: t('bundles.status.DRAFT') },
                    { value: 'PUBLISHED', label: t('bundles.status.PUBLISHED') },
                    { value: 'ARCHIVED', label: t('bundles.status.ARCHIVED') },
                  ]}
                  selectedValues={statusFilter}
                  onApply={setStatusFilter}
                />
              </FilterPill>
            </div>
            <PermissionGate permission="discounts:create">
              <Button
                onClick={() => {
                  setEditing(null)
                  setEditorOpen(true)
                }}
                data-tour="bundle-create"
              >
                <Plus className="mr-2 h-4 w-4" /> {t('bundles.create')}
              </Button>
            </PermissionGate>
          </div>
        </div>

        <div className="mt-6">
          {/* rowCount es prop OBLIGATORIA (data-table.tsx:28). enableSearch sin
              onSearch pinta una caja MUERTA (data-table.tsx:187): el filtrado
              client-side lo hace onSearch. */}
          <DataTable
            data={rows}
            columns={columns}
            rowCount={rows.length}
            isLoading={isLoading}
            enableSearch
            searchPlaceholder={t('bundles.list.searchPlaceholder')}
            onSearch={(term, items) => items.filter(p => p.name.toLowerCase().includes(term.toLowerCase()))}
            showColumnCustomizer={false}
          />
        </div>

        <BundleEditor
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          venueId={venueId!}
          editPromotion={editing}
          onSaved={() => {
            setEditorOpen(false)
            invalidate()
          }}
        />

        {/* Los errores de publicar, TODOS juntos — el dueño los corrige de una vez */}
        <AlertDialog open={!!publishErrors} onOpenChange={open => !open && setPublishErrors(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('bundles.publishErrors.title')}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <ul className="list-disc pl-5 space-y-1">
                  {(publishErrors ?? []).map(error => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setPublishErrors(null)}>{t('bundles.publishErrors.ok')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!toDelete} onOpenChange={open => !open && setToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('bundles.delete.title', { name: toDelete?.name })}</AlertDialogTitle>
              <AlertDialogDescription>{t('bundles.delete.description')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('bundles.delete.cancel')}</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => toDelete && deleteMutation.mutate(toDelete.id)}>
                {t('bundles.delete.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </FeatureGate>
  )
}
```

- [ ] **Step 2: Llaves i18n de la lista**

Agregar bajo `bundles` en es (y sus equivalentes en/fr):

```json
"create": "Nueva promoción",
"list": {
  "emptyState": "Sin promociones todavía",
  "emptyStateDesc": "Crea tu primer combo o 2x1. Se guarda como borrador y no aparece en el POS hasta que lo publiques.",
  "name": "Promoción", "mode": "Tipo de precio", "modeFixed": "Precio fijo", "modePerUnit": "2x1 / NxM",
  "price": "Precio", "status": "Estado", "filterAll": "Todas", "searchPlaceholder": "Buscar promoción…"
},
"status": { "DRAFT": "Borrador", "PUBLISHED": "Publicada", "ARCHIVED": "Archivada" },
"actions": { "edit": "Editar", "publish": "Publicar", "archive": "Archivar", "unarchive": "Desarchivar", "delete": "Borrar borrador" },
"toasts": {
  "published": "Promoción publicada: ya aparece en el POS",
  "publishFailed": "No se pudo publicar la promoción",
  "archived": "Promoción archivada: ya no aparece en el POS",
  "unarchived": "Promoción desarchivada: quedó como borrador",
  "deleted": "Borrador eliminado",
  "deleteFailed": "No se pudo borrar"
},
"publishErrors": { "title": "Así no se puede publicar", "ok": "Entendido" },
"delete": {
  "title": "¿Borrar \"{{name}}\"?",
  "description": "Sólo se borran borradores sin ventas. Esta acción no se puede deshacer.",
  "cancel": "Cancelar", "confirm": "Borrar"
}
```

- [ ] **Step 3: Verificar**

Run: `npm run build && npm run lint` Expected: verdes (el lint valida que las llaves i18n existan en los JSON).

- [ ] **Step 4: Commit**

```bash
git add src/pages/Promotions/Bundles.tsx src/locales/en/promotions.json src/locales/es/promotions.json src/locales/fr/promotions.json
git commit -m "feat(promociones): lista con estados, publicar con errores juntos y borrado de borradores"
```

---

## Task 8 (dashboard): El editor — FullScreenModal con grupos, 2x1, vigencia y foto

**Files:**

- Create: `src/pages/Promotions/components/BundleEditor.tsx`
- Modify: `src/locales/{en,es,fr}/promotions.json` (llaves `bundles.form.*`)

**Interfaces:**

- Consumes: `FullScreenModal` (`@/components/ui/full-screen-modal`, props `{open, onClose, title, subtitle?, children, actions?, contentClassName?}`),
  `useImageUploader` (`@/hooks/use-image-uploader`), `Cropper` de `react-easy-crop`,
  `useDiscountFormData` (`@/pages/Promotions/hooks/useDiscountFormData` — ya expone `productOptions` y `dayOptions`),
  `promotionService` (Task 5).
- Produces: `<BundleEditor open onClose venueId editPromotion onSaved />` — lo consume la lista (Task 7).

Reglas de UI que NO se negocian (de `.claude/rules/ui-patterns.md`): FullScreenModal (nunca `Dialog`), secciones como tarjetas
`rounded-2xl border border-border/50 bg-card p-6` (así lo manda ui-patterns para secciones DENTRO del modal; `border-input` es para
Cards/paneles sueltos), inputs `h-12 text-base`, **numéricos clearables** (`value={field.value ?? ''}`,
`raw === '' ? undefined : parseFloat(raw)` — prohibido `|| 0`), y **`data-tour` en CADA campo del wizard** — checklist mínimo:
`bundle-name`, `bundle-description`, `bundle-image`, `bundle-pricing-mode`, `bundle-price`, `bundle-add-group`,
`bundle-group-name-{gi}`, `bundle-product-{gi}-{oi}`, `bundle-qty-{gi}-{oi}`, `bundle-charged-{gi}-{oi}`, `bundle-delta-{gi}-{oi}`,
`bundle-valid-from`, `bundle-valid-until`, `bundle-time-from`, `bundle-time-until`, `bundle-days`, `bundle-save` (el ejecutor los
estampa aunque el snippet de abajo no repita todos, pasando `dataTour` a `NumberCell` y `data-tour` a los inputs de vigencia).

- [ ] **Step 1: Implementar el editor**

```tsx
// src/pages/Promotions/components/BundleEditor.tsx
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ImagePlus, Layers, Plus, Trash2 } from 'lucide-react'
import { DateTime } from 'luxon'
import { useEffect } from 'react'
import Cropper from 'react-easy-crop'
import { type FieldPath, type UseFormReturn, useFieldArray, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useImageUploader } from '@/hooks/use-image-uploader'
import { useToast } from '@/hooks/use-toast'
import promotionService from '@/services/promotion.service'
import type { Promotion, UpsertPromotionRequest } from '@/types/promotion'
import { useDiscountFormData } from '../hooks/useDiscountFormData'

// Zod = FORMA. Las reglas de publicación viven en el server y llegan como
// errors[] al publicar — aquí sólo se valida lo que no deja ni guardar.
const optionSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).optional(),
  chargedQuantity: z.number().int().min(0).optional(),
  priceDelta: z.number().min(0).optional(),
})
const groupSchema = z.object({ name: z.string().trim().min(1), options: z.array(optionSchema).min(1) })
const formSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().max(500).optional(),
  pricingMode: z.enum(['FIXED_TOTAL', 'PER_UNIT']),
  price: z.number().min(0).optional(),
  groups: z.array(groupSchema).min(1),
  daysOfWeek: z.array(z.number().int().min(0).max(6)),
  timeFrom: z.string().optional(),
  timeUntil: z.string().optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
})
type FormData = z.infer<typeof formSchema>

interface BundleEditorProps {
  open: boolean
  onClose: () => void
  venueId: string
  editPromotion: Promotion | null
  onSaved: () => void
}

const emptyOption = { productId: '', quantity: 1, chargedQuantity: 1, priceDelta: 0 }

export function BundleEditor({ open, onClose, venueId, editPromotion, onSaved }: BundleEditorProps) {
  const { t } = useTranslation('promotions')
  const { toast } = useToast()
  const { venue } = useCurrentVenue()
  const venueTz = venue?.timezone ?? 'America/Mexico_City'
  const { productOptions, dayOptions } = useDiscountFormData(venueId)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', pricingMode: 'FIXED_TOTAL', price: undefined, groups: [{ name: '', options: [{ ...emptyOption }] }], daysOfWeek: [] },
  })
  const groupsArray = useFieldArray({ control: form.control, name: 'groups' })
  const pricingMode = form.watch('pricingMode')

  const {
    uploading, imageUrl, imageForCrop, crop, zoom, setImageForCrop, setCrop, setZoom,
    onCropComplete, handleFileUpload, handleCropConfirm, handleFileRemove, initializeWithExistingUrl,
  } = useImageUploader(`venues/${venue?.slug}/promociones`, form.watch('name') || 'promocion', { minWidth: 320, minHeight: 320 })

  // Hidratar en modo edición cada vez que abre
  useEffect(() => {
    if (!open) return
    if (editPromotion) {
      form.reset({
        name: editPromotion.name,
        description: editPromotion.description ?? undefined,
        pricingMode: editPromotion.pricingMode,
        price: editPromotion.pricingMode === 'FIXED_TOTAL' ? editPromotion.price : undefined,
        groups: editPromotion.groups.map(g => ({
          name: g.name,
          options: g.options.map(o => ({ productId: o.productId, quantity: o.quantity, chargedQuantity: o.chargedQuantity, priceDelta: o.priceDelta })),
        })),
        daysOfWeek: editPromotion.daysOfWeek,
        timeFrom: editPromotion.timeFrom ?? undefined,
        timeUntil: editPromotion.timeUntil ?? undefined,
        validFrom: editPromotion.validFrom ? (DateTime.fromISO(editPromotion.validFrom).setZone(venueTz).toISODate() ?? undefined) : undefined,
        validUntil: editPromotion.validUntil ? (DateTime.fromISO(editPromotion.validUntil).setZone(venueTz).toISODate() ?? undefined) : undefined,
      })
      initializeWithExistingUrl(editPromotion.imageUrl ?? null) // firma real: string | null (use-image-uploader.tsx:128)
      // 🔴 Las fechas se hidratan de vuelta EN LA ZONA DEL VENUE. Un slice(0,10)
      // sobre el ISO UTC (…T05:59:59Z) mostraría el día SIGUIENTE y cada ciclo
      // editar→guardar estiraría la vigencia +1 día (audit 2026-08-14):
      // validFrom: editPromotion.validFrom ? DateTime.fromISO(editPromotion.validFrom).setZone(venueTz).toISODate() ?? undefined : undefined,
      // validUntil: editPromotion.validUntil ? DateTime.fromISO(editPromotion.validUntil).setZone(venueTz).toISODate() ?? undefined : undefined,
    } else {
      form.reset({ name: '', pricingMode: 'FIXED_TOTAL', price: undefined, groups: [{ name: '', options: [{ ...emptyOption }] }], daysOfWeek: [] })
      // 🔴 NUNCA handleFileRemove() aquí: ese helper BORRA el objeto de Firebase
      // (use-image-uploader.tsx:156) — al abrir el editor limpio sólo se resetea estado local.
      initializeWithExistingUrl(null)
      setImageForCrop(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editPromotion?.id])

  const saveMutation = useMutation({
    mutationFn: (payload: UpsertPromotionRequest) =>
      editPromotion
        ? promotionService.updatePromotion(venueId, editPromotion.id, payload)
        : promotionService.createPromotion(venueId, payload),
    onSuccess: () => {
      toast({ title: editPromotion ? t('bundles.form.savedEdit') : t('bundles.form.savedNew') })
      onSaved()
    },
    onError: (error: any) => {
      toast({ title: error?.response?.data?.message ?? t('bundles.form.saveFailed'), variant: 'destructive' })
    },
  })

  const onSubmit = form.handleSubmit(values => {
    // El TYPE se deriva de la estructura: si algún grupo ofrece varias opciones
    // es COMBO ("elige"); si todos tienen una, es BUNDLE (fijo). Es la MISMA
    // regla del validador del server (un COMBO sin grupos multi-opción es
    // impublicable), así que derivar no puede "degradar" un combo legítimo —
    // y el dueño no tiene que aprenderse los términos.
    const type = values.groups.some(g => g.options.length > 1) ? 'COMBO' : 'BUNDLE'
    const payload: UpsertPromotionRequest = {
      name: values.name,
      description: values.description ?? null,
      imageUrl: imageUrl || null, // el backend exige URL válida o campo ausente — nunca ''
      type,
      pricingMode: values.pricingMode,
      price: values.pricingMode === 'FIXED_TOTAL' ? (values.price ?? 0) : 0,
      groups: values.groups.map(g => ({
        name: g.name,
        options: g.options.map(o => ({
          productId: o.productId,
          quantity: o.quantity ?? 1,
          chargedQuantity: o.chargedQuantity ?? 1,
          priceDelta: values.pricingMode === 'FIXED_TOTAL' ? (o.priceDelta ?? 0) : 0,
        })),
      })),
      daysOfWeek: values.daysOfWeek,
      timeFrom: values.timeFrom || null,
      timeUntil: values.timeUntil || null,
      // 🔴 Las fechas se anclan en la zona del VENUE, jamás en la del navegador
      // (critical-warnings: timezone). Un admin en CDMX editando un venue de
      // Tijuana NO debe correr la vigencia 2 horas.
      validFrom: values.validFrom ? DateTime.fromISO(values.validFrom, { zone: venueTz }).startOf('day').toUTC().toISO() : null,
      validUntil: values.validUntil ? DateTime.fromISO(values.validUntil, { zone: venueTz }).endOf('day').toUTC().toISO() : null,
    }
    saveMutation.mutate(payload)
  })

  return (
    <FullScreenModal
      open={open}
      onClose={onClose}
      title={editPromotion ? t('bundles.form.editTitle') : t('bundles.form.createTitle')}
      subtitle={t('bundles.form.subtitle')}
      contentClassName="bg-muted/30"
      actions={
        <Button onClick={onSubmit} disabled={saveMutation.isPending || uploading} data-tour="bundle-save">
          {saveMutation.isPending ? t('bundles.form.saving') : t('bundles.form.save')}
        </Button>
      }
    >
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        {/* ── Básicos ─────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-border/50 bg-card p-6 space-y-4" data-tour="bundle-basics">
          <div className="space-y-2">
            <Label>{t('bundles.form.name')}</Label>
            <Input className="h-12 text-base" placeholder={t('bundles.form.namePlaceholder')} {...form.register('name')} data-tour="bundle-name" />
          </div>
          <div className="space-y-2">
            <Label>{t('bundles.form.description')}</Label>
            <Textarea rows={2} {...form.register('description')} />
          </div>
          <div className="space-y-2">
            <Label>{t('bundles.form.image')}</Label>
            {imageForCrop ? (
              <div className="space-y-3">
                <div className="relative h-64 w-full overflow-hidden rounded-xl">
                  <Cropper image={imageForCrop} crop={crop} zoom={zoom} maxZoom={2} aspect={4 / 3}
                    onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
                </div>
                <div className="flex gap-2">
                  <Button type="button" onClick={handleCropConfirm} disabled={uploading}>{t('bundles.form.imageConfirm')}</Button>
                  <Button type="button" variant="outline" onClick={() => setImageForCrop(null)}>{t('bundles.form.imageCancel')}</Button>
                </div>
              </div>
            ) : imageUrl ? (
              <div className="flex items-center gap-3">
                <img src={imageUrl} alt="" className="h-20 w-28 rounded-xl object-cover" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    // La foto EXISTENTE (ya guardada en la promo) sólo se desliga en
                    // local — borrarla de Storage rompería la promo si el usuario
                    // cancela. handleFileRemove (que SÍ borra de Firebase) es sólo
                    // para la foto recién subida en esta edición.
                    if (editPromotion?.imageUrl && imageUrl === editPromotion.imageUrl) initializeWithExistingUrl(null)
                    else void handleFileRemove()
                  }}
                >
                  {t('bundles.form.imageRemove')}
                </Button>
              </div>
            ) : (
              <label className="flex h-24 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-input text-muted-foreground" data-tour="bundle-image">
                <ImagePlus className="h-5 w-5" /> {t('bundles.form.imageUpload')}
                {/* handleFileUpload recibe File, NO el evento (use-image-uploader.tsx:49) */}
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleFileUpload(file)
                    e.target.value = ''
                  }}
                />
              </label>
            )}
          </div>
        </section>

        {/* ── Precio ──────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-border/50 bg-card p-6 space-y-4" data-tour="bundle-pricing">
          <div className="space-y-2">
            <Label>{t('bundles.form.pricingMode')}</Label>
            <Select value={pricingMode} onValueChange={v => form.setValue('pricingMode', v as FormData['pricingMode'], { shouldDirty: true })}>
              <SelectTrigger className="h-12" data-tour="bundle-pricing-mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FIXED_TOTAL">{t('bundles.form.modeFixed')}</SelectItem>
                <SelectItem value="PER_UNIT">{t('bundles.form.modePerUnit')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {pricingMode === 'PER_UNIT' ? t('bundles.form.modePerUnitHelp') : t('bundles.form.modeFixedHelp')}
            </p>
          </div>
          {pricingMode === 'FIXED_TOTAL' && (
            <div className="space-y-2">
              <Label>{t('bundles.form.price')}</Label>
              <Input
                className="h-12 text-base" type="number" inputMode="decimal" min={0} step="0.01" data-tour="bundle-price"
                value={form.watch('price') ?? ''}
                onChange={e => form.setValue('price', e.target.value === '' ? undefined : parseFloat(e.target.value), { shouldDirty: true })}
              />
            </div>
          )}
        </section>

        {/* ── Grupos y opciones ───────────────────────────────────── */}
        <section className="rounded-2xl border border-border/50 bg-card p-6 space-y-4" data-tour="bundle-groups">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Layers className="h-4 w-4" /><Label>{t('bundles.form.groups')}</Label></div>
            <Button type="button" variant="outline" size="sm"
              onClick={() => groupsArray.append({ name: '', options: [{ ...emptyOption }] })} data-tour="bundle-add-group">
              <Plus className="mr-1 h-4 w-4" /> {t('bundles.form.addGroup')}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{t('bundles.form.groupsHelp')}</p>

          {groupsArray.fields.map((group, gi) => (
            <GroupCard key={group.id} gi={gi} form={form} productOptions={productOptions} pricingMode={pricingMode}
              onRemove={groupsArray.fields.length > 1 ? () => groupsArray.remove(gi) : undefined} t={t} />
          ))}
        </section>

        {/* ── Vigencia ────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-border/50 bg-card p-6 space-y-4" data-tour="bundle-schedule">
          <Label>{t('bundles.form.schedule')}</Label>
          <p className="text-sm text-muted-foreground">{t('bundles.form.scheduleHelp')}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-sm">{t('bundles.form.validFrom')}</Label>
              <Input className="h-12" type="date" {...form.register('validFrom')} />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">{t('bundles.form.validUntil')}</Label>
              <Input className="h-12" type="date" {...form.register('validUntil')} />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">{t('bundles.form.timeFrom')}</Label>
              <Input className="h-12" type="time" {...form.register('timeFrom')} />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">{t('bundles.form.timeUntil')}</Label>
              <Input className="h-12" type="time" {...form.register('timeUntil')} />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 pt-1" data-tour="bundle-days">
            {dayOptions.map(day => {
              // 🔴 dayOptions[].value es STRING (useDiscountFormData.ts:56);
              // el API habla number[] — convertir aquí, no cambiar el hook.
              const dayNum = Number(day.value)
              return (
                <label key={day.value} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.watch('daysOfWeek').includes(dayNum)}
                    onCheckedChange={checked => {
                      const current = form.getValues('daysOfWeek')
                      form.setValue('daysOfWeek', checked ? [...current, dayNum] : current.filter(d => d !== dayNum), { shouldDirty: true })
                    }}
                  />
                  {day.label}
                </label>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">{t('bundles.form.daysHelp')}</p>
        </section>
      </div>
    </FullScreenModal>
  )
}

interface GroupCardProps {
  gi: number
  form: ReturnType<typeof useForm<FormData>>
  productOptions: Array<{ value: string; label: string }>
  pricingMode: FormData['pricingMode']
  onRemove?: () => void
  t: (key: string, opts?: Record<string, unknown>) => string
}

function GroupCard({ gi, form, productOptions, pricingMode, onRemove, t }: GroupCardProps) {
  const optionsArray = useFieldArray({ control: form.control, name: `groups.${gi}.options` as const })

  return (
    <div className="rounded-xl border border-input p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Input className="h-12 text-base" placeholder={t('bundles.form.groupNamePlaceholder')} {...form.register(`groups.${gi}.name` as const)} />
        {onRemove && (
          <Button type="button" variant="ghost" size="icon" className="cursor-pointer text-destructive" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {optionsArray.fields.map((option, oi) => (
        <div key={option.id} className="grid grid-cols-12 items-end gap-2">
          <div className="col-span-5 space-y-1">
            {oi === 0 && <Label className="text-xs text-muted-foreground">{t('bundles.form.product')}</Label>}
            <Select
              value={form.watch(`groups.${gi}.options.${oi}.productId`)}
              onValueChange={v => form.setValue(`groups.${gi}.options.${oi}.productId`, v, { shouldDirty: true })}
            >
              <SelectTrigger className="h-12" data-tour={`bundle-product-${gi}-${oi}`}>
                <SelectValue placeholder={t('bundles.form.productPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {productOptions.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <NumberCell form={form} name={`groups.${gi}.options.${oi}.quantity`} label={oi === 0 ? t('bundles.form.quantity') : undefined} />
          <NumberCell form={form} name={`groups.${gi}.options.${oi}.chargedQuantity`} label={oi === 0 ? t('bundles.form.chargedQuantity') : undefined} />
          {pricingMode === 'FIXED_TOTAL' && (
            <NumberCell form={form} name={`groups.${gi}.options.${oi}.priceDelta`} label={oi === 0 ? t('bundles.form.priceDelta') : undefined} step="0.01" />
          )}
          <div className="col-span-1">
            {optionsArray.fields.length > 1 && (
              <Button type="button" variant="ghost" size="icon" className="cursor-pointer" onClick={() => optionsArray.remove(oi)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={() => optionsArray.append({ ...emptyOption })}>
        <Plus className="mr-1 h-4 w-4" /> {t('bundles.form.addOption')}
      </Button>
      <p className="text-xs text-muted-foreground">
        {pricingMode === 'PER_UNIT' ? t('bundles.form.perUnitRowHelp') : t('bundles.form.fixedRowHelp')}
      </p>
    </div>
  )
}

/** Numérico CLEARABLE (regla ui-patterns): borrar deja undefined, nunca 0.
 *  Tipado real de RHF — nada de `any`: los paths anidados de useFieldArray SÍ
 *  son representables con FieldPath<FormData>. */
function NumberCell({
  form,
  name,
  label,
  step = '1',
  dataTour,
}: {
  form: UseFormReturn<FormData>
  name: FieldPath<FormData>
  label?: string
  step?: string
  dataTour?: string
}) {
  const value = form.watch(name) as number | undefined
  return (
    <div className="col-span-2 space-y-1">
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <Input
        className="h-12 text-base" type="number" inputMode="numeric" min={0} step={step} data-tour={dataTour}
        value={value ?? ''}
        onChange={e =>
          form.setValue(name, (e.target.value === '' ? undefined : parseFloat(e.target.value)) as never, { shouldDirty: true })
        }
      />
    </div>
  )
}
```

- [ ] **Step 2: Llaves i18n del formulario** (es; equivalentes en/fr):

```json
"form": {
  "createTitle": "Nueva promoción", "editTitle": "Editar promoción",
  "subtitle": "Se guarda como borrador. Publicarla es un paso aparte.",
  "save": "Guardar borrador", "saving": "Guardando…",
  "savedNew": "Borrador guardado. Publícalo cuando esté listo.",
  "savedEdit": "Cambios guardados. Lo ya vendido no cambia.",
  "saveFailed": "No se pudo guardar",
  "name": "Nombre", "namePlaceholder": "Combo del día",
  "description": "Descripción (opcional)",
  "image": "Foto (opcional)", "imageUpload": "Subir foto", "imageConfirm": "Usar recorte", "imageCancel": "Cancelar", "imageRemove": "Quitar foto",
  "pricingMode": "¿Cómo se cobra?",
  "modeFixed": "Precio fijo del paquete", "modePerUnit": "2x1 / paga menos unidades",
  "modeFixedHelp": "El paquete cuesta lo que digas aquí, sin importar lo que sumen los productos.",
  "modePerUnitHelp": "Entran más unidades de las que se cobran: en un 2x1 entran 2 y se cobra 1.",
  "price": "Precio del paquete",
  "groups": "Qué incluye", "addGroup": "Agregar parte",
  "groupsHelp": "Cada parte es algo que incluye la promoción. Si una parte tiene varias opciones, el cliente elige una.",
  "groupNamePlaceholder": "Ej. Elige tu plato",
  "product": "Producto", "productPlaceholder": "Elegir producto…",
  "quantity": "Entran", "chargedQuantity": "Se cobran", "priceDelta": "Sobreprecio",
  "addOption": "Agregar opción",
  "perUnitRowHelp": "\"Entran\" es lo que se lleva el cliente; \"se cobran\" es lo que paga. 2x1 = entran 2, se cobra 1.",
  "fixedRowHelp": "El sobreprecio se suma al precio del paquete si el cliente elige esa opción.",
  "schedule": "Vigencia (opcional)",
  "scheduleHelp": "Sin vigencia, la promoción aplica siempre que esté publicada.",
  "validFrom": "Desde", "validUntil": "Hasta", "timeFrom": "Hora inicio", "timeUntil": "Hora fin",
  "daysHelp": "Sin días marcados aplica todos los días."
}
```

- [ ] **Step 3: Verificar**

Run: `npm run build && npm run lint` Expected: verdes. En `npm run dev`: crear un 2x1 (una parte, una opción, entran 2 / se cobran 1),
guardar → aparece como Borrador; publicarlo → badge Publicada. Editar un publicado y guardar → sigue Publicada.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Promotions/components/BundleEditor.tsx src/locales/en/promotions.json src/locales/es/promotions.json src/locales/fr/promotions.json
git commit -m "feat(promociones): editor en FullScreenModal con grupos, 2x1, vigencia y foto"
```

---

## Task 9 (dashboard): Los dos ajustes de panel del POS

**Files:**

- Create: `src/pages/Promotions/components/PanelSettingsCard.tsx`
- Modify: `src/pages/Promotions/Bundles.tsx` (montar la card debajo de la lista)
- Modify: `src/types.ts` (agregar los 2 campos al tipo `VenueSettings`, junto a `trackInventory` ~línea 636)
- Modify: `src/locales/{en,es,fr}/promotions.json` (llaves `bundles.panel.*`)

**Interfaces:**

- Consumes: endpoint genérico `GET/PUT /api/v1/dashboard/venues/${venueId}/settings` (Task 4 lo hizo aceptar los campos);
  patrón exacto de `src/components/Review/BadReviewSettingsCard.tsx:59-97` (useQuery `['venue-settings', venueId]` + useMutation + invalidate).
- Produces: card "Dónde se ven en el POS" con dos selects (cajero / cliente), valores `TAB | SIDE_PANEL | HIDDEN`.

- [ ] **Step 1: Tipos**

En `src/types.ts`, dentro de `VenueSettings` (junto a `trackInventory`, ~línea 636):

```typescript
  /** Dónde salen las promociones en el POS. HIDDEN = preferencia de layout del local, no el candado de tier. */
  promotionsPanelCashier?: 'HIDDEN' | 'TAB' | 'SIDE_PANEL'
  promotionsPanelCustomer?: 'HIDDEN' | 'TAB' | 'SIDE_PANEL'
```

- [ ] **Step 2: La card**

```tsx
// src/pages/Promotions/components/PanelSettingsCard.tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import api from '@/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import type { VenueSettings } from '@/types'

type PanelMode = 'HIDDEN' | 'TAB' | 'SIDE_PANEL'

export function PanelSettingsCard({ venueId }: { venueId: string }) {
  const { t } = useTranslation('promotions')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: settings } = useQuery({
    queryKey: ['venue-settings', venueId],
    queryFn: async () => (await api.get<VenueSettings>(`/api/v1/dashboard/venues/${venueId}/settings`)).data,
    enabled: !!venueId,
  })

  const mutation = useMutation({
    mutationFn: async (patch: Partial<Pick<VenueSettings, 'promotionsPanelCashier' | 'promotionsPanelCustomer'>>) =>
      (await api.put(`/api/v1/dashboard/venues/${venueId}/settings`, patch)).data,
    onSuccess: () => {
      toast({ title: t('bundles.panel.saved') })
      queryClient.invalidateQueries({ queryKey: ['venue-settings', venueId] })
    },
  })

  const renderSelect = (
    field: 'promotionsPanelCashier' | 'promotionsPanelCustomer',
    fallback: PanelMode,
    tourKey: string,
  ) => (
    <Select value={(settings?.[field] as PanelMode) ?? fallback} onValueChange={v => mutation.mutate({ [field]: v as PanelMode })}>
      <SelectTrigger className="h-12" data-tour={tourKey}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="TAB">{t('bundles.panel.tab')}</SelectItem>
        <SelectItem value="SIDE_PANEL">{t('bundles.panel.sidePanel')}</SelectItem>
        <SelectItem value="HIDDEN">{t('bundles.panel.hidden')}</SelectItem>
      </SelectContent>
    </Select>
  )

  return (
    <Card className="border-input mt-8" data-tour="bundle-panel-settings">
      <CardHeader>
        <CardTitle>{t('bundles.panel.title')}</CardTitle>
        <CardDescription>{t('bundles.panel.description')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('bundles.panel.cashier')}</Label>
          {renderSelect('promotionsPanelCashier', 'TAB', 'bundle-panel-cashier')}
          <p className="text-xs text-muted-foreground">{t('bundles.panel.cashierHelp')}</p>
        </div>
        <div className="space-y-2">
          <Label>{t('bundles.panel.customer')}</Label>
          {renderSelect('promotionsPanelCustomer', 'SIDE_PANEL', 'bundle-panel-customer')}
          <p className="text-xs text-muted-foreground">{t('bundles.panel.customerHelp')}</p>
        </div>
      </CardContent>
    </Card>
  )
}
```

Montarla en `Bundles.tsx` justo después del `<DataTable …/>`, gateada por el permiso que exige su endpoint (PUT settings =
`venues:update`; sin esto un VIEWER vería selects que terminan en 403):

```tsx
<PermissionGate permission="venues:update">
  <PanelSettingsCard venueId={venueId!} />
</PermissionGate>
```

- [ ] **Step 3: i18n** (es; equivalentes en/fr):

```json
"panel": {
  "title": "Dónde se ven en el POS",
  "description": "Elige cómo aparecen las promociones publicadas en cada pantalla. Ocultarlas aquí es una preferencia de diseño: puedes revertirlo cuando quieras.",
  "cashier": "Pantalla del cajero", "customer": "Pantalla del cliente",
  "cashierHelp": "Pestaña deja más espacio a la cuadrícula; panel lateral las tiene siempre a la vista.",
  "customerHelp": "Lo que ve el cliente mientras le cobran.",
  "tab": "Pestaña", "sidePanel": "Panel lateral", "hidden": "Ocultas",
  "saved": "Ajuste guardado"
}
```

- [ ] **Step 4: Verificar y commit**

Run: `npm run build && npm run lint` Expected: verdes. Cambiar un select → toast + al recargar persiste (el PUT pega al server real).

```bash
git add src/pages/Promotions/components/PanelSettingsCard.tsx src/pages/Promotions/Bundles.tsx src/types.ts src/locales/en/promotions.json src/locales/es/promotions.json src/locales/fr/promotions.json
git commit -m "feat(promociones): ajustes de donde se ven las promos en el POS"
```

---

## Task 10 (dashboard): La guía de activación — tour + empty state que enseña el camino

**Files:**

- Create: `src/hooks/usePromotionCreationTour.ts`
- Modify: `src/hooks/useAtomicTourListener.ts` (agregar `'promotion'` a la unión `AtomicTourName`, ~línea 70-81)
- Modify: `src/components/ui/full-screen-modal.tsx` (`data-tour="bundle-editor-close"` en el botón Close, líneas 59-68)
- Modify: `src/pages/Promotions/Bundles.tsx` (banner de descubrimiento + trigger del tour + empty state guiado)
- Modify: `src/locales/{en,es,fr}/promotions.json` (llaves `bundles.tour.*` y `bundles.activation.*`)

**Interfaces:**

- Consumes: patrón EXACTO de `src/hooks/useProductCreationTour.ts` (driver.js + `useAtomicTourListener` + `waitForElement`),
  `TourDiscoveryBanner` (`@/components/onboarding/TourDiscoveryBanner`), los `data-tour` ya sembrados en Tasks 7–9.
- Produces: `usePromotionCreationTour()` → `{ start, stop }`. El tour ES la guía de activación pedida por el founder: recorre
  crear → publicar → dónde se ve en el POS, y termina explicando que la promoción publicada aparece sola en las terminales.

- [ ] **Step 1: El hook del tour**

Copiar la estructura de `useProductCreationTour.ts` (driver config idéntica: `popoverClass: 'avoqado-tour-popover'`, `showProgress`,
`overlayOpacity: 0.65`, `stagePadding: 6`) con `useTranslation('promotions')` y estos pasos:

🔴 **El tour es flow-aware, no una lista plana** (audit 2026-08-14): en lista vacía `bundle-row-actions` NO existe, y el editor no se
abre/cierra solo. Cada transición usa `onNextClick` + `waitForElement` (patrón LITERAL de `useProductCreationTour.ts:107+`) y los pasos
condicionales se filtran con `exists()` al construir:

```typescript
// src/hooks/usePromotionCreationTour.ts — construcción de pasos (driver config
// copiada de useProductCreationTour.ts; exists/waitForElement del mismo archivo)
const steps: DriveStep[] = [
  { element: '[data-tour="bundles-page"]', popover: { title: t('bundles.tour.welcomeTitle'), description: t('bundles.tour.welcomeDesc') } },
  {
    element: '[data-tour="bundle-create"]',
    popover: {
      title: t('bundles.tour.createTitle'),
      description: t('bundles.tour.createDesc'),
      // Avanzar ABRE el editor por el usuario y espera a que exista el campo
      onNextClick: async () => {
        ;(document.querySelector('[data-tour="bundle-create"]') as HTMLElement | null)?.click()
        await waitForElement('[data-tour="bundle-pricing-mode"]')
        driverRef.current?.moveNext()
      },
    },
  },
  { element: '[data-tour="bundle-pricing-mode"]', popover: { title: t('bundles.tour.modeTitle'), description: t('bundles.tour.modeDesc') } },
  { element: '[data-tour="bundle-groups"]', popover: { title: t('bundles.tour.groupsTitle'), description: t('bundles.tour.groupsDesc') } },
  {
    element: '[data-tour="bundle-save"]',
    popover: {
      title: t('bundles.tour.saveTitle'),
      description: t('bundles.tour.saveDesc'),
      // El tour NO guarda por el usuario (crearía borradores basura): al
      // avanzar CIERRA el editor y sigue en la lista.
      onNextClick: async () => {
        ;(document.querySelector('[data-tour="bundle-editor-close"]') as HTMLElement | null)?.click()
        await waitForElement('[data-tour="bundles-page"]')
        driverRef.current?.moveNext()
      },
    },
  },
  // Condicional: sólo si hay filas (en lista vacía este elemento no existe)
  ...(exists('[data-tour="bundle-row-actions"]')
    ? [{ element: '[data-tour="bundle-row-actions"]', popover: { title: t('bundles.tour.publishTitle'), description: t('bundles.tour.publishDesc') } }]
    : []),
  { element: '[data-tour="bundle-panel-settings"]', popover: { title: t('bundles.tour.panelTitle'), description: t('bundles.tour.panelDesc') } },
]
```

(🔴 El botón Close real vive en `full-screen-modal.tsx:59-68` y HOY no tiene selector estable — esta task le agrega
`data-tour="bundle-editor-close"`, por eso `src/components/ui/full-screen-modal.tsx` está en los Files. Si un objetivo queda detrás del
modal fijo, recordar los guards `onInteractOutside` con `document.body.classList.contains('tour-active')` de la regla ui-patterns.)

Registrar: `useAtomicTourListener('promotion', start)` y agregar `'promotion'` a `AtomicTourName` en
`src/hooks/useAtomicTourListener.ts`. (No se mapea en `STEP_BY_TOUR` — no hay paso de checklist de onboarding para esto todavía.)

- [ ] **Step 2: Banner + empty state guiado en la página**

En `Bundles.tsx`: `const { start: startPromotionTour } = usePromotionCreationTour()` y debajo del título:

```tsx
{/* storageKey es prop OBLIGATORIA (TourDiscoveryBanner.tsx:7) y ctaLabel se
    traduce — el fallback interno está hardcodeado en español (:66) */}
<TourDiscoveryBanner
  storageKey="bundles-activation"
  title={t('bundles.activation.bannerTitle')}
  description={t('bundles.activation.bannerDesc')}
  ctaLabel={t('bundles.activation.startGuide')}
  onStart={startPromotionTour}
/>
```

(El ejecutor verifica la firma real de `onStart`/`ctaLabel` en `TourDiscoveryBanner.tsx` y espeja los nombres exactos.)

Y cuando `rows.length === 0 && !isLoading`, en lugar del DataTable vacío, un empty state que ES la guía en 3 pasos:

```tsx
<div className="mt-10 rounded-2xl border border-input bg-card p-8 text-center space-y-3">
  <p className="text-lg font-medium">{t('bundles.activation.emptyTitle')}</p>
  <ol className="mx-auto max-w-md list-decimal space-y-1 pl-5 text-left text-sm text-muted-foreground">
    <li>{t('bundles.activation.step1')}</li>
    <li>{t('bundles.activation.step2')}</li>
    <li>{t('bundles.activation.step3')}</li>
  </ol>
  <Button className="mt-2" onClick={startPromotionTour} data-tour="bundle-guide-start">
    {t('bundles.activation.startGuide')}
  </Button>
</div>
```

- [ ] **Step 3: i18n** (es; equivalentes en/fr):

```json
"activation": {
  "bannerTitle": "¿Primera promoción?",
  "bannerDesc": "Te llevamos de la mano: crear, publicar y elegir dónde se ve en el POS.",
  "emptyTitle": "Así se prende una promoción",
  "step1": "Crea el combo o 2x1 con el botón \"Nueva promoción\" — se guarda como borrador.",
  "step2": "Publícalo desde el menú de la fila (⋯ → Publicar). Sólo lo publicado llega al POS.",
  "step3": "Elige abajo dónde se ve en cada pantalla del POS. Las terminales lo toman solas: no hay que instalar nada.",
  "startGuide": "Iniciar guía"
},
"tour": {
  "welcomeTitle": "Promociones", "welcomeDesc": "Aquí viven tus combos, paquetes y 2x1. Nada de lo que hagas aquí cobra distinto hasta que publiques.",
  "createTitle": "Crear", "createDesc": "Todo empieza como borrador: puedes armarlo con calma.",
  "modeTitle": "¿Cómo se cobra?", "modeDesc": "Precio fijo (\"todo por $99\") o 2x1 (entran 2, se cobra 1).",
  "groupsTitle": "Qué incluye", "groupsDesc": "Cada parte del combo. Si una parte tiene varias opciones, el cliente elige.",
  "saveTitle": "Guardar", "saveDesc": "Guarda el borrador. Aún no lo ve nadie.",
  "publishTitle": "Publicar", "publishDesc": "Este es el interruptor real: al publicar, la promoción aparece en el POS. Si algo está mal armado te decimos TODO lo que falta, de una vez.",
  "panelTitle": "Dónde se ve", "panelDesc": "Pestaña, panel lateral u oculta — por pantalla. Y listo: no hay que tocar las terminales."
}
```

- [ ] **Step 4: Verificar y commit**

Run: `npm run build && npm run lint`. En dev: con lista vacía se ve la guía de 3 pasos; el botón lanza el tour completo.

```bash
git add src/hooks/usePromotionCreationTour.ts src/hooks/useAtomicTourListener.ts src/pages/Promotions/Bundles.tsx src/locales/en/promotions.json src/locales/es/promotions.json src/locales/fr/promotions.json
git commit -m "feat(promociones): guia de activacion con tour y empty state que ensena el camino"
```

---

## Task 11 (dashboard): E2E — happy path, paywall FREE y errores de publicar

**Files:**

- Create: `e2e/fixtures/promotions-mocks.ts`
- Create: `e2e/tests/promotions/bundles.spec.ts`

**Interfaces:**

- Consumes: `setupApiMocks(page, options)` (`e2e/fixtures/api-mocks.ts:56`; paywall FREE = `planState: { planTier: 'GRATIS', grandfathered: false }`),
  patrón de mocks por dominio de `e2e/fixtures/inventory-mocks.ts` (🔴 Playwright rutea LIFO: catch-all primero, específicas después).
- Produces: cobertura E2E de: lista con datos → crear borrador → publicar OK → publicar reprobado muestra la lista de errores →
  FREE ve el paywall borroso con CTA.

- [ ] **Step 1: Mocks del dominio**

```typescript
// e2e/fixtures/promotions-mocks.ts
import type { Page } from '@playwright/test'

const promo = (over: Record<string, unknown> = {}) => ({
  id: 'promo-1',
  name: 'Combo del día',
  description: null,
  imageUrl: null,
  type: 'BUNDLE',
  pricingMode: 'FIXED_TOTAL',
  price: 99,
  status: 'DRAFT',
  displayOrder: 0,
  validFrom: null,
  validUntil: null,
  daysOfWeek: [],
  timeFrom: null,
  timeUntil: null,
  createdAt: '2026-08-14T00:00:00Z',
  updatedAt: '2026-08-14T00:00:00Z',
  groups: [{ id: 'g1', name: 'Plato', options: [{ id: 'o1', productId: 'p1', quantity: 1, chargedQuantity: 1, priceDelta: 0 }] }],
  ...over,
})

export async function setupPromotionMocks(page: Page, opts: { publishFails?: boolean } = {}) {
  // catch-all del recurso PRIMERO (LIFO: lo específico se registra después)
  // 🔴 SIEMPRE con guard de /api/: sin él, el goto() del SPA (cuyo pathname
  // también incluye /promotions) recibiría este JSON como documento y la
  // página jamás cargaría (patrón isApiPath de inventory-mocks.ts:23).
  await page.route(
    url => url.pathname.includes('/api/') && url.pathname.includes('/promotions') && !url.pathname.includes('/publish'),
    route => {
      const method = route.request().method()
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [promo(), promo({ id: 'promo-2', name: 'Martes 2x1', pricingMode: 'PER_UNIT', price: 0, status: 'PUBLISHED' })],
            meta: { totalCount: 2, pageSize: 100, currentPage: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
          }),
        })
      }
      if (method === 'POST') {
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(promo({ id: 'promo-nuevo' })) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(promo()) })
    },
  )

  await page.route(
    url => url.pathname.includes('/api/') && url.pathname.includes('/promotions/') && url.pathname.endsWith('/publish'),
    route =>
      opts.publishFails
        ? route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ errors: ['El producto p1 está desactivado.', 'El grupo "Plato" no tiene opciones.'] }),
          })
        : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(promo({ status: 'PUBLISHED' })) }),
  )
}
```

- [ ] **Step 2: El spec**

```typescript
// e2e/tests/promotions/bundles.spec.ts
import { expect, test } from '@playwright/test'

import { setupApiMocks } from '../../fixtures/api-mocks'
import { setupPromotionMocks } from '../../fixtures/promotions-mocks'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

// 🔴 Chromium corre en INGLÉS por default y los asserts son en español: fijar
// el idioma ANTES de navegar. La llave REAL del detector es 'lang'
// (src/i18n.ts:174-176); patrón: e2e/tests/master-catalog/catalog-core.spec.ts:8.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('lang', 'es'))
})

test.describe('Promociones (combos y paquetes)', () => {
  test('lista, crea y publica', async ({ page }) => {
    await setupApiMocks(page, { planState: { hasPlan: true, state: 'active', planTier: 'PRO', grandfathered: false } })
    await setupPromotionMocks(page)

    await page.goto('/venues/venue-alpha/promotions/bundles')
    await expect(page.getByText('Combo del día')).toBeVisible()
    await expect(page.getByText('Martes 2x1')).toBeVisible()

    await page.locator('[data-tour="bundle-create"]').click()
    await page.getByPlaceholder('Combo del día').fill('Combo prueba')
    // El schema exige nombre de grupo + producto elegido — sin esto el submit
    // no dispara (audit 2026-08-14). El producto viene del mock de productos.
    await page.getByPlaceholder('Ej. Elige tu plato').fill('Plato')
    await page.locator('[data-tour="bundle-product-0-0"]').click()
    await page.getByText('Hamburguesa mock').click()
    await page.locator('[data-tour="bundle-save"]').click()
    await expect(page.getByText(/Borrador guardado/)).toBeVisible()

    await page.locator('[data-tour="bundle-row-actions"]').first().click()
    await page.getByText('Publicar').click()
    await expect(page.getByText(/ya aparece en el POS/)).toBeVisible()
  })

  test('publicar reprobado muestra TODOS los errores juntos', async ({ page }) => {
    await setupApiMocks(page, { planState: { hasPlan: true, state: 'active', planTier: 'PRO', grandfathered: false } })
    await setupPromotionMocks(page, { publishFails: true })

    await page.goto('/venues/venue-alpha/promotions/bundles')
    await page.locator('[data-tour="bundle-row-actions"]').first().click()
    await page.getByText('Publicar').click()

    await expect(page.getByText('Así no se puede publicar')).toBeVisible()
    await expect(page.getByText('El producto p1 está desactivado.')).toBeVisible()
    await expect(page.getByText('El grupo "Plato" no tiene opciones.')).toBeVisible()
  })

  test('FREE ve el paywall con candado, no un redirect', async ({ page }) => {
    await setupApiMocks(page, { planState: { planTier: 'GRATIS', grandfathered: false } })
    await setupPromotionMocks(page)

    await page.goto('/venues/venue-alpha/promotions/bundles')
    // El contenido queda borroso y aparece la card de upgrade del FeatureGate
    await expect(page.getByText(/PRO/i).first()).toBeVisible()
  })
})
```

(El ejecutor ajusta: el slug del venue mock —`VENUE_ALPHA.slug` de `e2e/fixtures/mock-data.ts`—; los selectores del FeatureGate a los
textos reales de `billing.json` `featureGate.*`; la llave exacta de idioma copiándola de `sales-summary-filter.spec.ts:14`; y agrega a
`setupPromotionMocks` un route para el endpoint de PRODUCTOS que consume `useDiscountFormData` (ver su fetch en
`useDiscountFormData.ts:14` y espejar el shape de respuesta) devolviendo al menos `[{ id: 'p1', name: 'Hamburguesa mock' }]` — sin ese
mock el selector de producto queda vacío y el flujo de crear no puede completarse. El `SelectTrigger` de producto lleva
`data-tour="bundle-product-{gi}-{oi}"` (agregarlo en el editor). Si los devtools de React Query tapan clicks, ocultarlos con el
`page.evaluate` de `org-categories.spec.ts`.)

- [ ] **Step 3: Correr**

Run: `npx playwright test e2e/tests/promotions/ --project=chromium` Expected: 3 tests verdes.

- [ ] **Step 4: Commit**

```bash
git add e2e/fixtures/promotions-mocks.ts e2e/tests/promotions/bundles.spec.ts
git commit -m "test(promociones): e2e de lista, publicar con errores y paywall FREE"
```

---

## Task 12 (ambos repos): Verificación final del plan

**Files:** ninguno nuevo — es la pasada de cierre.

- [ ] **Step 1 (server):** `npm run build && npx jest --selectProjects unit --testPathPattern "promotion"` — build OK y TODAS las suites
  de promociones verdes (las del plan 1 + las nuevas de dashboard-CRUD).
- [ ] **Step 2 (dashboard):** `npm run build && npm run lint && npx playwright test e2e/tests/promotions/` — verdes.
- [ ] **Step 3 (a mano, contra el server real):** crear → publicar → `GET /api/v1/mobile/venues/:venueId/promotions` devuelve la promo
  en `active` (o `upcoming`); cambiar los selects de panel → `VenueSettings` en DB refleja los valores; leer el log del backend
  (`ls -t avoqado-server/logs/development*.log | head -1`) y verificar que NINGUNA operación del recorrido dejó `error:`.
- [ ] **Step 4:** Los checklists de tier quedan así — capacidad PRO gateada en server (grupo de rutas) y dashboard (FeatureGate);
  activación = publicar (interruptor del dueño) + ajustes de panel (preferencia); apagado se VE (teaser con candado para FREE, badge
  Borrador/Archivada para lo no publicado). Los clientes móviles (plan 3) leerán el tier por nombre exacto `PROMOTIONS`.
- [ ] **Step 5:** NO commitear nada fuera de las rutas listadas en cada task (árbol compartido entre sesiones).

---

## Qué sigue (fuera de este plan)

- **Plan 3 — Android + iOS juntos:** el panel (TAB/SIDE_PANEL/HIDDEN con caída automática bajo ~960dp), la hoja de combo, promotionRef
  al carrito, cache offline del catálogo y el PRIMER mecanismo de lectura de tier en los móviles.
- **Al cerrar el plan 3:** QA de recorrido completo (dashboard → POS → DB → log) con `/full-testingv2`, y la presentación de ventas
  (deck + one-pagers + regenerar los 3 PDFs) — obligación del workspace, va con el cierre del proyecto, no antes.
- **Exclusiones deliberadas** (no son huecos): publish vía MCP (el MCP crea en DRAFT a propósito), multi-selección por grupo
  (`minSelect/maxSelect` fijos en 1 en v1), BOGO entre SKUs distintos (eso es el Discount BOGO que ya existe).

---

## Registro de auditoría (Codex + Claude, 2026-08-14 — plan YA corregido)

**Tercera pasada (review Claude, adversarial contra ambos repos): 5 P1 + 6 P2, TODOS incorporados arriba** — props reales de
CheckboxFilterContent (`title/selectedValues/onApply`) y FilterPill sin data-tour · asserts de archive/unarchive alineados al CAS
`updateMany` · mocks E2E con guard `/api/` (sin él intercepta la navegación del SPA) · llave de idioma real `'lang'` (patrón
catalog-core.spec.ts:8) · hidratación de fechas con Luxon en zona del venue (el slice(0,10) estiraba la vigencia +1 día por edición) ·
`onSearch` en DataTable (enableSearch solo pinta la caja) · `data-tour` en el Close del FullScreenModal (nuevo Files en Task 10) · shell
sin venueId muerto · deps estables del useMemo de columnas · `invalid_type_error` en español para fechas · mock de `venue.findUnique` en
el test del upsert. La pasada también dejó ~30 contratos VERIFICADOS OK (deps luxon/react-easy-crop/@hookform/resolvers presentes,
useDiscountFormData(venueId) con endpoint `GET .../products?orderBy=name&…`, coherencia completa de llaves i18n del plan, imports exactos
de dashboard.routes.ts, updateMany en el prismaMock, FK Restrict de OrderPromotion).

Dos pasadas de Codex (server effort medium quirúrgico · dashboard effort high) ANTES de ejecutar; hallazgos adjudicados contra el código
real y **todos incorporados arriba** — esta sección es el rastro, no pendientes:

- **Server (2 P1 + 2 P2, los 4 confirmados):** el `create` del upsert de VenueSettings perdía los paneles en el primer PUT (→ Task 4
  parcha `createData` + test); publish con UN solo error respondía `{message}` en vez de `{errors:[]}` (→ el controller convierte TODO
  BadRequestError); tope y 2 decimales en precios (→ schema); transiciones de estado con CAS `updateMany` condicionado + no-ops
  idempotentes (→ Task 2).
- **Dashboard (9 P1 + 8 P2; confirmados los contratos):** `tooltip` en PageTitleWithInfo · `rowCount` obligatorio en DataTable ·
  `storageKey`/`ctaLabel` en TourDiscoveryBanner · `handleFileUpload(File)` e `initializeWithExistingUrl(string|null)` ·
  `handleFileRemove` BORRA de Firebase (nunca usarlo como reset) · `dayOptions` en string → `Number()` · E2E en español exige fijar
  idioma + mock de productos + flujo de crear completo · tour flow-aware con `onNextClick`/`exists` · vigencia anclada al timezone del
  VENUE con Luxon · acciones gateadas por `can('discounts:update'/'delete')` · queries con `enabled: hasAccess` (FeatureGate monta los
  children) · filtro FilterPill · `RouteDefinition` en feature-registry · tipado real de RHF en NumberCell.
- **Refutados (no re-litigar):** `border-border/50` en secciones DENTRO del FullScreenModal es lo que manda ui-patterns §6 (el
  `border-input` de critical-warnings aplica a Cards sueltas — ambas reglas conviven arriba); derivar `type` de la estructura no puede
  degradar un COMBO legítimo porque un COMBO sin grupos multi-opción es impublicable por el validador del server; los mensajes de error
  de publicación llegan en español a EN/FR — comportamiento de plataforma (los Zod del server son español-only por regla).

