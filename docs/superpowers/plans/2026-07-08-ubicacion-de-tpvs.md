# Ubicación de TPVs (Supervisor + Org white-label) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exponer la última ubicación conocida de cada TPV (device-centric) en dos vistas del dashboard — una pestaña "Ubicación de TPVs" en el Supervisor (alcance = TPVs de sus promotores por custodia de SIMs) y una sección Org white-label "Ubicación de TPVs" (todas las TPVs de la org) — reutilizando el ping horario que el TPV ya envía, sin tocar el PAX.

**Architecture:** El TPV ya manda `PromoterLocationPing` cada hora con el serial en el JWT. Un cambio solo-servidor atribuye cada ping a su `Terminal` (nueva FK `terminalId`). Dos endpoints REST agrupan "último ping por terminal" con distinto alcance. El dashboard consume por polling (60s) y muestra "última ubicación · hace X" + link a Google Maps. Nada de WebSocket ni mapa embebido.

**Tech Stack:** avoqado-server (Express + TypeScript, Prisma/PostgreSQL, jest + supertest) · avoqado-web-dashboard (React 18 + Vite, TanStack Query, Tailwind/Radix, Playwright).

## Global Constraints

- **Spec de referencia:** `avoqado-web-dashboard/docs/superpowers/specs/2026-07-08-promoter-tpv-location-design.md`.
- **NO tocar `avoqado-tpv`** — el serial ya viaja en `req.authContext.terminalSerialNumber`; cero redeploy PAX.
- **`staffId` del promotor = `authContext.userId`** (NO existe `authContext.staffId`).
- **Etiquetado honesto (regla del repo):** nunca "LIVE" ni punto móvil. Siempre "última ubicación · hace X" + nota "se actualiza cada hora, 11–18h". Badges obligatorios para lo no-implementado.
- **API prefix:** todo path incluye `/api/v1/`.
- **i18n:** todo texto del dashboard usa `t()` con es + en. (Nota: `src/pages/playtelecom/Supervisor/**` ya es playtelecom-namespaced; NO es `Superadmin/**`, así que SÍ requiere i18n.)
- **Timezone:** front usa `useVenueDateTime()`, nunca timezone del browser.
- **White-label nav:** usar `fullBasePath` / `useCurrentOrganization().basePath`, nunca hardcodear `/venues/` o `/organizations/`.
- **Gating:** pestaña Supervisor bajo featureCode `SUPERVISOR_DASHBOARD` (+ `requireWhiteLabel`). Página Org solo OWNER (`requireOrgOwner`), sin featureCode.
- **MCP en sync:** el mismo cambio agrega/actualiza tools MCP (Task 11).
- **Git read-only por defecto (regla del founder):** los pasos "Commit" quedan como checkpoint; **NO commitear sin permiso explícito de Jose** — dejar staged/uncommitted salvo autorización. `Co-Authored-By` permitido SOLO: `Claude Opus 4.6 (1M context) <noreply@anthropic.com>`.
- **Money/decimales:** `latitude`/`longitude` son Prisma `Decimal` → convertir con `Number(x)` al serializar.
- **Verificación final:** correr `/full-testing` + auditoría tras terminar (feedback estándar del founder).

---

## File Structure

**avoqado-server**
- Modify: `prisma/schema.prisma` — `PromoterLocationPing` (+`terminalId`), `Terminal` (+back-relation).
- Create: `prisma/migrations/<ts>_add_terminal_to_promoter_location_ping/migration.sql` (generado).
- Modify: `src/services/promoters/promoterLocation.service.ts` — `RecordPromoterPingInput` + `create` data (+`terminalId`).
- Modify: `src/routes/tpv.routes.ts:6547` — resolver serial→terminalId y pasarlo.
- Create: `src/services/promoters/terminalLocation.service.ts` — `getSupervisorTerminalLocations`, `getOrgTerminalLocations`, helper `latestPingPerTerminal`.
- Create: `src/routes/dashboard/terminalLocation.routes.ts` — GET supervisor.
- Modify: `src/routes/dashboard/organizationDashboard.routes.ts` — GET org.
- Modify: `src/routes/dashboard.routes.ts` — montar la ruta supervisor.
- Create: `scripts/mcp/tools/terminalLocation.ts` (o extender el módulo de tools existente) — tool `terminal_location`.
- Tests: `tests/unit/services/terminalLocation.service.test.ts`, `tests/unit/routes/terminalLocation.routes.test.ts`.

**avoqado-web-dashboard**
- Create: `src/services/terminalLocation.service.ts` — client + tipos.
- Create: `src/components/location/LastLocationCell.tsx` — helper presentacional compartido.
- Modify: `src/pages/playtelecom/Supervisor/SupervisorDashboard.tsx` — pestaña `ubicacion`.
- Create: `src/pages/organizations/LiveLocation/LiveLocation.tsx` — página Org.
- Modify: `src/pages/organizations/components/WLOrgSidebar.tsx` — item sidebar.
- Modify: `src/routes/lazyComponents.ts` — `WLLiveLocation`.
- Modify: `src/routes/router.tsx` — ruta hija org.
- Modify: `src/locales/{es,en}/playtelecom.json` + `.../organization.json` — i18n.
- Tests: `e2e/tests/ubicacion-tpvs.spec.ts`.

---

## Task 1: Prisma migration — `terminalId` en `PromoterLocationPing`

**Files:**
- Modify: `prisma/schema.prisma` (models `PromoterLocationPing` ~L2358, `Terminal` ~L3221)
- Create: `prisma/migrations/<ts>_add_terminal_to_promoter_location_ping/migration.sql` (generado por Prisma)

**Interfaces:**
- Produces: columna `PromoterLocationPing.terminalId String?` + relación `terminal Terminal?` + índice `[terminalId, capturedAt]`; back-relation `Terminal.promoterLocationPings`.

- [ ] **Step 1: Editar el modelo `PromoterLocationPing`** — agregar el campo, la relación y el índice.

```prisma
model PromoterLocationPing {
  // ... campos existentes (venueId, staffId, latitude, longitude, accuracy, capturedAt, source, createdAt) ...
  terminalId String?
  terminal   Terminal? @relation(fields: [terminalId], references: [id], onDelete: SetNull)

  // ... índices existentes ...
  @@index([terminalId, capturedAt])
}
```

- [ ] **Step 2: Agregar la back-relation en `Terminal`** — Prisma exige el lado inverso.

```prisma
model Terminal {
  // ... campos existentes ...
  promoterLocationPings PromoterLocationPing[]
}
```

- [ ] **Step 3: Generar la migración**

Run: `cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx prisma migrate dev --name add_terminal_to_promoter_location_ping`
Expected: crea la carpeta de migración, aplica en la DB local, y `prisma generate` corre. El SQL debe ser un `ALTER TABLE "PromoterLocationPing" ADD COLUMN "terminalId" TEXT;` + `CREATE INDEX` + `ADD CONSTRAINT ... FOREIGN KEY`. Sin `DROP`/`NOT NULL` sobre datos existentes.

- [ ] **Step 4: Verificar que el cliente Prisma compila**

Run: `npx tsc -p tsconfig.json --noEmit` (o el build script del server)
Expected: sin errores de tipo por el nuevo campo/relación.

- [ ] **Step 5: Commit (checkpoint — requiere OK de Jose)**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(location): add terminalId to PromoterLocationPing"
```

---

## Task 2: Atribuir cada ping a su Terminal en la ingesta

**Files:**
- Modify: `src/services/promoters/promoterLocation.service.ts:17` (input) y `:57` (create)
- Modify: `src/routes/tpv.routes.ts:6547` (handler)
- Test: `tests/unit/services/promoterLocation.service.test.ts` (crear si no existe)

**Interfaces:**
- Consumes: `prisma.terminal.findFirst` (patrón del heartbeat), `req.authContext.terminalSerialNumber`.
- Produces: `RecordPromoterPingInput` gana `terminalId?: string | null`; el ping se persiste con `terminalId`.

- [ ] **Step 1: Test que falla** — el `create` debe incluir `terminalId` cuando se pasa.

```ts
// tests/unit/services/promoterLocation.service.test.ts
jest.mock('@/utils/prismaClient', () => ({
  __esModule: true,
  default: {
    venueSettings: { findUnique: jest.fn() },
    promoterLocationPing: { create: jest.fn() },
  },
}))
import prisma from '@/utils/prismaClient'
import { recordPromoterPing } from '@/services/promoters/promoterLocation.service'

const p = prisma as unknown as {
  venueSettings: { findUnique: jest.Mock }
  promoterLocationPing: { create: jest.Mock }
}

beforeEach(() => {
  jest.clearAllMocks()
  p.venueSettings.findUnique.mockResolvedValue({ trackPromoterLocation: true })
  p.promoterLocationPing.create.mockResolvedValue({ id: 'ping_1' })
})

it('persists terminalId when provided', async () => {
  await recordPromoterPing({
    venueId: 'v1', staffId: 's1', latitude: 1, longitude: 2,
    capturedAt: new Date('2026-07-08T18:00:00Z'), terminalId: 't1',
  })
  expect(p.promoterLocationPing.create).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ terminalId: 't1' }) }),
  )
})

it('defaults terminalId to null when absent', async () => {
  await recordPromoterPing({
    venueId: 'v1', staffId: 's1', latitude: 1, longitude: 2,
    capturedAt: new Date('2026-07-08T18:00:00Z'),
  })
  expect(p.promoterLocationPing.create).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ terminalId: null }) }),
  )
})
```

- [ ] **Step 2: Correr el test — debe fallar**

Run: `npx jest tests/unit/services/promoterLocation.service.test.ts -t terminalId`
Expected: FAIL (el `create` actual no incluye `terminalId`).

- [ ] **Step 3: Implementar en el service** — agregar el campo al input y al `create`.

```ts
// src/services/promoters/promoterLocation.service.ts  (interface, ~L17-25)
export interface RecordPromoterPingInput {
  venueId: string
  staffId: string
  latitude: number
  longitude: number
  accuracy?: number | null
  capturedAt: Date
  source?: PromoterLocationSourceInput
  terminalId?: string | null
}

// dentro de prisma.promoterLocationPing.create({ data: { ... } })  (~L58)
      accuracy: input.accuracy ?? null,
      capturedAt: input.capturedAt,
      source: input.source ?? 'PERIODIC',
      terminalId: input.terminalId ?? null,
```

- [ ] **Step 4: Correr el test — debe pasar**

Run: `npx jest tests/unit/services/promoterLocation.service.test.ts -t terminalId`
Expected: PASS (ambos casos).

- [ ] **Step 5: Resolver serial→terminalId en el handler del ping**

```ts
// src/routes/tpv.routes.ts  (handler POST /geolocation/promoter-ping, ~L6553)
import prisma from '@/utils/prismaClient' // ya importado en el archivo; reutilizar

const { userId, venueId, terminalSerialNumber } = (req as any).authContext
const { latitude, longitude, accuracy, capturedAt, source } = req.body

let terminalId: string | null = null
if (terminalSerialNumber) {
  const terminal = await prisma.terminal.findFirst({
    where: {
      OR: [
        { serialNumber: { equals: terminalSerialNumber, mode: 'insensitive' } },
        { serialNumber: { equals: `AVQD-${terminalSerialNumber}`, mode: 'insensitive' } },
        { id: terminalSerialNumber },
      ],
    },
    select: { id: true },
  })
  terminalId = terminal?.id ?? null
}

const ping = await recordPromoterPing({
  venueId,
  staffId: userId,
  latitude,
  longitude,
  accuracy: accuracy ?? null,
  capturedAt: capturedAt ? new Date(capturedAt) : new Date(),
  source: source ?? 'PERIODIC',
  terminalId,
})
```

- [ ] **Step 6: Type-check**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit (checkpoint — requiere OK de Jose)**

```bash
git add src/services/promoters/promoterLocation.service.ts src/routes/tpv.routes.ts tests/unit/services/promoterLocation.service.test.ts
git commit -m "feat(location): attribute promoter pings to their terminal on ingest"
```

---

## Task 3: Service `terminalLocation` — helper + alcance supervisor

**Files:**
- Create: `src/services/promoters/terminalLocation.service.ts`
- Test: `tests/unit/services/terminalLocation.service.test.ts`

**Interfaces:**
- Consumes: `prisma.serializedItem`, `prisma.promoterLocationPing`, `prisma.terminal`, `prisma.staff`, `prisma.venueSettings`.
- Produces:
  - type `TerminalLocationRow = { terminalId: string; serialNumber: string | null; venue: { id: string; name: string } | null; promoter: { staffId: string; name: string } | null; latest: { latitude: number; longitude: number; accuracy: number | null; capturedAt: string; source: string } | null }`
  - `latestPingPerTerminal(pings): Map<string, Ping>` (helper interno)
  - `getSupervisorTerminalLocations(params: { venueId: string; requesterStaffId: string; requesterRole: string; sinceHours?: number }): Promise<{ terminals: TerminalLocationRow[]; trackingEnabled: boolean }>`

- [ ] **Step 1: Test que falla** — MANAGER solo ve terminales de sus promotores de custodia; ADMIN ve todas las del venue.

```ts
// tests/unit/services/terminalLocation.service.test.ts
jest.mock('@/utils/prismaClient', () => ({
  __esModule: true,
  default: {
    venueSettings: { findUnique: jest.fn() },
    serializedItem: { findMany: jest.fn() },
    promoterLocationPing: { findMany: jest.fn() },
    staff: { findMany: jest.fn() },
  },
}))
import prisma from '@/utils/prismaClient'
import { getSupervisorTerminalLocations } from '@/services/promoters/terminalLocation.service'

const p = prisma as unknown as {
  venueSettings: { findUnique: jest.Mock }
  serializedItem: { findMany: jest.Mock }
  promoterLocationPing: { findMany: jest.Mock }
  staff: { findMany: jest.Mock }
}

beforeEach(() => {
  jest.clearAllMocks()
  p.venueSettings.findUnique.mockResolvedValue({ trackPromoterLocation: true })
})

it('MANAGER: solo terminales cuyos pings son de sus promotores de custodia', async () => {
  // supervisor sup1 tiene SIMs PROMOTER_HELD con prom A
  p.serializedItem.findMany.mockResolvedValue([{ assignedPromoterId: 'promA' }])
  p.promoterLocationPing.findMany.mockResolvedValue([
    { terminalId: 't1', staffId: 'promA', latitude: 1, longitude: 2, accuracy: 10, capturedAt: new Date('2026-07-08T18:00:00Z'), source: 'PERIODIC', terminal: { serialNumber: 'AVQD-1' }, venue: { id: 'v1', name: 'BAE 1' }, staff: { id: 'promA', firstName: 'Ana', lastName: 'X' } },
    { terminalId: 't2', staffId: 'promB', latitude: 3, longitude: 4, accuracy: 10, capturedAt: new Date('2026-07-08T18:00:00Z'), source: 'PERIODIC', terminal: { serialNumber: 'AVQD-2' }, venue: { id: 'v1', name: 'BAE 1' }, staff: { id: 'promB', firstName: 'Beto', lastName: 'Y' } },
  ])
  const res = await getSupervisorTerminalLocations({ venueId: 'v1', requesterStaffId: 'sup1', requesterRole: 'MANAGER' })
  expect(res.trackingEnabled).toBe(true)
  expect(res.terminals.map(r => r.terminalId)).toEqual(['t1']) // promB excluido
  expect(res.terminals[0].promoter).toEqual({ staffId: 'promA', name: 'Ana X' })
  expect(res.terminals[0].serialNumber).toBe('AVQD-1')
})

it('ADMIN: todas las terminales del venue (sin filtro de custodia)', async () => {
  p.promoterLocationPing.findMany.mockResolvedValue([
    { terminalId: 't1', staffId: 'promA', latitude: 1, longitude: 2, accuracy: 10, capturedAt: new Date('2026-07-08T18:00:00Z'), source: 'PERIODIC', terminal: { serialNumber: 'AVQD-1' }, venue: { id: 'v1', name: 'BAE 1' }, staff: { id: 'promA', firstName: 'Ana', lastName: 'X' } },
    { terminalId: 't2', staffId: 'promB', latitude: 3, longitude: 4, accuracy: 10, capturedAt: new Date('2026-07-08T18:00:00Z'), source: 'PERIODIC', terminal: { serialNumber: 'AVQD-2' }, venue: { id: 'v1', name: 'BAE 1' }, staff: { id: 'promB', firstName: 'Beto', lastName: 'Y' } },
  ])
  const res = await getSupervisorTerminalLocations({ venueId: 'v1', requesterStaffId: 'adm1', requesterRole: 'ADMIN' })
  expect(res.terminals.map(r => r.terminalId).sort()).toEqual(['t1', 't2'])
  expect(p.serializedItem.findMany).not.toHaveBeenCalled()
})

it('mantiene solo el ping más reciente por terminal', async () => {
  p.promoterLocationPing.findMany.mockResolvedValue([
    { terminalId: 't1', staffId: 'promA', latitude: 9, longitude: 9, accuracy: 5, capturedAt: new Date('2026-07-08T19:00:00Z'), source: 'PERIODIC', terminal: { serialNumber: 'AVQD-1' }, venue: { id: 'v1', name: 'BAE 1' }, staff: { id: 'promA', firstName: 'Ana', lastName: 'X' } },
    { terminalId: 't1', staffId: 'promA', latitude: 1, longitude: 1, accuracy: 5, capturedAt: new Date('2026-07-08T11:00:00Z'), source: 'PERIODIC', terminal: { serialNumber: 'AVQD-1' }, venue: { id: 'v1', name: 'BAE 1' }, staff: { id: 'promA', firstName: 'Ana', lastName: 'X' } },
  ])
  const res = await getSupervisorTerminalLocations({ venueId: 'v1', requesterStaffId: 'adm1', requesterRole: 'ADMIN' })
  expect(res.terminals).toHaveLength(1)
  expect(res.terminals[0].latest?.latitude).toBe(9) // el más reciente
})
```

- [ ] **Step 2: Correr — debe fallar**

Run: `npx jest tests/unit/services/terminalLocation.service.test.ts`
Expected: FAIL ("Cannot find module .../terminalLocation.service").

- [ ] **Step 3: Implementar el service**

```ts
// src/services/promoters/terminalLocation.service.ts
import prisma from '@/utils/prismaClient'

export interface TerminalLocationRow {
  terminalId: string
  serialNumber: string | null
  venue: { id: string; name: string } | null
  promoter: { staffId: string; name: string } | null
  latest: { latitude: number; longitude: number; accuracy: number | null; capturedAt: string; source: string } | null
}

// pings vienen ordenados capturedAt desc → el primero por terminal es el más reciente
function latestPingPerTerminal<T extends { terminalId: string | null }>(pings: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const ping of pings) {
    if (!ping.terminalId || seen.has(ping.terminalId)) continue
    seen.add(ping.terminalId)
    out.push(ping)
  }
  return out
}

function fullName(s: { firstName?: string | null; lastName?: string | null } | null): string {
  if (!s) return ''
  return `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()
}

const PING_INCLUDE = {
  terminal: { select: { serialNumber: true } },
  venue: { select: { id: true, name: true } },
  staff: { select: { id: true, firstName: true, lastName: true } },
} as const

function toRow(ping: any): TerminalLocationRow {
  return {
    terminalId: ping.terminalId,
    serialNumber: ping.terminal?.serialNumber ?? null,
    venue: ping.venue ? { id: ping.venue.id, name: ping.venue.name } : null,
    promoter: ping.staff ? { staffId: ping.staff.id, name: fullName(ping.staff) } : null,
    latest: {
      latitude: Number(ping.latitude),
      longitude: Number(ping.longitude),
      accuracy: ping.accuracy != null ? Number(ping.accuracy) : null,
      capturedAt: ping.capturedAt.toISOString(),
      source: ping.source,
    },
  }
}

export async function getSupervisorTerminalLocations(params: {
  venueId: string
  requesterStaffId: string
  requesterRole: string
  sinceHours?: number
}): Promise<{ terminals: TerminalLocationRow[]; trackingEnabled: boolean }> {
  const { venueId, requesterStaffId, requesterRole, sinceHours = 24 } = params

  const settings = await prisma.venueSettings.findUnique({
    where: { venueId },
    select: { trackPromoterLocation: true },
  })
  const trackingEnabled = !!settings?.trackPromoterLocation

  const isElevated = ['ADMIN', 'OWNER', 'SUPERADMIN'].includes(requesterRole)

  let staffFilter: { in: string[] } | undefined
  if (!isElevated) {
    // Promotores que cuelgan de la custodia de SIMs de este supervisor.
    const items = await prisma.serializedItem.findMany({
      where: {
        assignedSupervisorId: requesterStaffId,
        custodyState: 'PROMOTER_HELD',
        assignedPromoterId: { not: null },
      },
      select: { assignedPromoterId: true },
      distinct: ['assignedPromoterId'],
    })
    const promoterIds = items.map(i => i.assignedPromoterId!).filter(Boolean)
    if (promoterIds.length === 0) return { terminals: [], trackingEnabled }
    staffFilter = { in: promoterIds }
  }

  const since = new Date(Date.now() - sinceHours * 3600_000)
  const pings = await prisma.promoterLocationPing.findMany({
    where: {
      venueId,
      capturedAt: { gte: since },
      terminalId: { not: null },
      ...(staffFilter ? { staffId: staffFilter } : {}),
    },
    orderBy: { capturedAt: 'desc' },
    include: PING_INCLUDE,
  })

  return { terminals: latestPingPerTerminal(pings).map(toRow), trackingEnabled }
}
```

> Nota implementación: en jest los `pings` mockeados ya vienen "desc" en el test del más-reciente; el helper toma el primero por terminal. `Date.now()` es real aquí (server), no aplica la restricción del harness de Workflow.

- [ ] **Step 4: Correr — debe pasar**

Run: `npx jest tests/unit/services/terminalLocation.service.test.ts`
Expected: PASS (3 casos).

- [ ] **Step 5: Commit (checkpoint — requiere OK de Jose)**

```bash
git add src/services/promoters/terminalLocation.service.ts tests/unit/services/terminalLocation.service.test.ts
git commit -m "feat(location): supervisor terminal-locations service (custody-scoped)"
```

---

## Task 4: Endpoint supervisor + montaje

**Files:**
- Create: `src/routes/dashboard/terminalLocation.routes.ts`
- Modify: `src/routes/dashboard.routes.ts` (montaje, cerca de L4056 donde se montan las rutas `/venues/:venueId/...`)
- Test: `tests/unit/routes/terminalLocation.routes.test.ts`

**Interfaces:**
- Consumes: `getSupervisorTerminalLocations` (Task 3), `verifyAccess` (mismo helper que `promoters.routes.ts`), `authenticateTokenMiddleware`.
- Produces: `GET /api/v1/dashboard/venues/:venueId/supervisor/terminals-locations` → `{ success: true, data: { terminals, trackingEnabled } }`.

- [ ] **Step 1: Test de ruta que falla** (supertest + express bare + authContext por header)

```ts
// tests/unit/routes/terminalLocation.routes.test.ts
import express from 'express'
import request from 'supertest'

jest.mock('@/middlewares/authenticateToken.middleware', () => ({
  authenticateTokenMiddleware: (req: any, _res: any, next: any) => {
    const ctx = req.headers['x-test-auth-context']
    if (ctx) req.authContext = JSON.parse(ctx as string)
    next()
  },
}))
// verifyAccess → passthrough en test (el gating real se cubre en integración)
jest.mock('@/middlewares/checkFeatureAccess.middleware', () => ({
  verifyAccess: () => (_req: any, _res: any, next: any) => next(),
}))
jest.mock('@/services/promoters/terminalLocation.service', () => ({
  getSupervisorTerminalLocations: jest.fn(),
}))

import { getSupervisorTerminalLocations } from '@/services/promoters/terminalLocation.service'
import terminalLocationRoutes from '@/routes/dashboard/terminalLocation.routes'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/venues/:venueId/supervisor', terminalLocationRoutes)
  return app
}

it('GET terminals-locations devuelve data del service', async () => {
  ;(getSupervisorTerminalLocations as jest.Mock).mockResolvedValue({ terminals: [{ terminalId: 't1' }], trackingEnabled: true })
  const res = await request(makeApp())
    .get('/venues/v1/supervisor/terminals-locations')
    .set('x-test-auth-context', JSON.stringify({ userId: 'sup1', venueId: 'v1', role: 'MANAGER' }))
  expect(res.status).toBe(200)
  expect(res.body).toEqual({ success: true, data: { terminals: [{ terminalId: 't1' }], trackingEnabled: true } })
  expect(getSupervisorTerminalLocations).toHaveBeenCalledWith(
    expect.objectContaining({ venueId: 'v1', requesterStaffId: 'sup1', requesterRole: 'MANAGER' }),
  )
})
```

> Verificar el path real del `verifyAccess` mock: en `promoters.routes.ts` se importa desde el mismo módulo que exporta `verifyAccess`. Confirmar el import exacto (`import { verifyAccess } from '@/middlewares/checkFeatureAccess.middleware'`) y ajustar el `jest.mock` al path correcto antes de correr.

- [ ] **Step 2: Correr — debe fallar**

Run: `npx jest tests/unit/routes/terminalLocation.routes.test.ts`
Expected: FAIL (no existe el módulo de rutas).

- [ ] **Step 3: Implementar la ruta**

```ts
// src/routes/dashboard/terminalLocation.routes.ts
import { Router, Request, Response, NextFunction } from 'express'
import { authenticateTokenMiddleware } from '@/middlewares/authenticateToken.middleware'
import { verifyAccess } from '@/middlewares/checkFeatureAccess.middleware'
import { getSupervisorTerminalLocations } from '@/services/promoters/terminalLocation.service'

const router = Router({ mergeParams: true })

const access = verifyAccess({ featureCode: 'SUPERVISOR_DASHBOARD', requireWhiteLabel: true })

router.get(
  '/terminals-locations',
  authenticateTokenMiddleware,
  access,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const venueId = req.params.venueId || (req as any).authContext?.venueId
      const { userId, role } = (req as any).authContext
      const data = await getSupervisorTerminalLocations({
        venueId,
        requesterStaffId: userId,
        requesterRole: role,
      })
      res.json({ success: true, data })
    } catch (error) {
      next(error)
    }
  },
)

export default router
```

- [ ] **Step 4: Montar en `dashboard.routes.ts`** (junto a las otras rutas `/venues/:venueId/...`, ~L4056)

```ts
import terminalLocationRoutes from './dashboard/terminalLocation.routes'
// ...
router.use('/venues/:venueId/supervisor', terminalLocationRoutes)
```

- [ ] **Step 5: Correr — debe pasar** y type-check

Run: `npx jest tests/unit/routes/terminalLocation.routes.test.ts && npx tsc -p tsconfig.json --noEmit`
Expected: PASS + sin errores de tipo.

- [ ] **Step 6: Commit (checkpoint — requiere OK de Jose)**

```bash
git add src/routes/dashboard/terminalLocation.routes.ts src/routes/dashboard.routes.ts tests/unit/routes/terminalLocation.routes.test.ts
git commit -m "feat(location): supervisor terminals-locations endpoint"
```

---

## Task 5: Alcance org + endpoint OWNER

**Files:**
- Modify: `src/services/promoters/terminalLocation.service.ts` (agregar `getOrgTerminalLocations`)
- Modify: `src/routes/dashboard/organizationDashboard.routes.ts` (nueva GET con `checkOrgAccess` + `requireOrgOwner`)
- Test: extender `tests/unit/services/terminalLocation.service.test.ts`

**Interfaces:**
- Consumes: `prisma.venue` (para listar venueIds de la org), helpers de Task 3 (`latestPingPerTerminal`, `toRow`, `PING_INCLUDE`).
- Produces: `getOrgTerminalLocations(params: { orgId: string; sinceHours?: number }): Promise<{ terminals: TerminalLocationRow[] }>`; `GET /api/v1/dashboard/organizations/:orgId/terminals-locations`.

- [ ] **Step 1: Test que falla** — agrega venues de la org y devuelve último ping por terminal cruzando venues.

```ts
// añadir en tests/unit/services/terminalLocation.service.test.ts
// (extender el jest.mock del default prisma con: venue: { findMany: jest.fn() })
import { getOrgTerminalLocations } from '@/services/promoters/terminalLocation.service'

it('org: agrupa último ping por terminal a través de los venues de la org', async () => {
  ;(prisma as any).venue = { findMany: jest.fn().mockResolvedValue([{ id: 'v1' }, { id: 'v2' }]) }
  p.promoterLocationPing.findMany.mockResolvedValue([
    { terminalId: 't1', staffId: 'promA', latitude: 1, longitude: 2, accuracy: 10, capturedAt: new Date('2026-07-08T19:00:00Z'), source: 'PERIODIC', terminal: { serialNumber: 'AVQD-1' }, venue: { id: 'v1', name: 'BAE 1' }, staff: { id: 'promA', firstName: 'Ana', lastName: 'X' } },
    { terminalId: 't9', staffId: 'promZ', latitude: 5, longitude: 6, accuracy: 10, capturedAt: new Date('2026-07-08T18:00:00Z'), source: 'PERIODIC', terminal: { serialNumber: 'AVQD-9' }, venue: { id: 'v2', name: 'BAE 2' }, staff: { id: 'promZ', firstName: 'Zoe', lastName: 'W' } },
  ])
  const res = await getOrgTerminalLocations({ orgId: 'org1' })
  expect(res.terminals.map(r => r.terminalId).sort()).toEqual(['t1', 't9'])
  const t9 = res.terminals.find(r => r.terminalId === 't9')!
  expect(t9.venue).toEqual({ id: 'v2', name: 'BAE 2' })
  expect(t9.promoter).toEqual({ staffId: 'promZ', name: 'Zoe W' })
})
```

- [ ] **Step 2: Correr — debe fallar**

Run: `npx jest tests/unit/services/terminalLocation.service.test.ts -t "org:"`
Expected: FAIL (función no existe).

- [ ] **Step 3: Implementar `getOrgTerminalLocations`** (reutiliza helpers)

```ts
// añadir en src/services/promoters/terminalLocation.service.ts
export async function getOrgTerminalLocations(params: {
  orgId: string
  sinceHours?: number
}): Promise<{ terminals: TerminalLocationRow[] }> {
  const { orgId, sinceHours = 24 } = params
  const venues = await prisma.venue.findMany({ where: { organizationId: orgId }, select: { id: true } })
  const venueIds = venues.map(v => v.id)
  if (venueIds.length === 0) return { terminals: [] }

  const since = new Date(Date.now() - sinceHours * 3600_000)
  const pings = await prisma.promoterLocationPing.findMany({
    where: { venueId: { in: venueIds }, capturedAt: { gte: since }, terminalId: { not: null } },
    orderBy: { capturedAt: 'desc' },
    include: PING_INCLUDE,
  })
  return { terminals: latestPingPerTerminal(pings).map(toRow) }
}
```

> Verificar el nombre real del campo de relación org en `Venue` (`organizationId`). Si el schema usa otro (`orgId`), ajustar el `where`.

- [ ] **Step 4: Correr — debe pasar**

Run: `npx jest tests/unit/services/terminalLocation.service.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Agregar la ruta org** en `organizationDashboard.routes.ts` (copiar patrón de `/:orgId/vision-global`, +`requireOrgOwner`)

```ts
// imports (arriba del archivo): asegurar requireOrgOwner y checkOrgAccess están importados
import { getOrgTerminalLocations } from '@/services/promoters/terminalLocation.service'

router.get(
  '/:orgId/terminals-locations',
  authenticateTokenMiddleware,
  checkOrgAccess,
  requireOrgOwner,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orgId } = req.params
      const data = await getOrgTerminalLocations({ orgId })
      res.json({ success: true, data })
    } catch (error) {
      next(error)
    }
  },
)
```

- [ ] **Step 6: Type-check + tests**

Run: `npx tsc -p tsconfig.json --noEmit && npx jest tests/unit/services/terminalLocation.service.test.ts`
Expected: sin errores + PASS.

- [ ] **Step 7: Commit (checkpoint — requiere OK de Jose)**

```bash
git add src/services/promoters/terminalLocation.service.ts src/routes/dashboard/organizationDashboard.routes.ts tests/unit/services/terminalLocation.service.test.ts
git commit -m "feat(location): org-wide terminals-locations endpoint (OWNER)"
```

---

## Task 6: MCP tool `terminal_location`

**Files:**
- Create/Modify: `scripts/mcp/` — agregar tool `terminal_location` (seguir el patrón de un tool existente que llame a un service, p.ej. el que expone `promoter_location`).
- Modify: el registro de tools del MCP (donde se listan) para incluir el nuevo.

**Interfaces:**
- Consumes: `getOrgTerminalLocations` (org) y/o `getSupervisorTerminalLocations`.
- Produces: tool MCP `terminal_location` que dado `orgId` (o `venueId`) devuelve las terminales con su última ubicación + link Google Maps.

- [ ] **Step 1: Leer un tool MCP existente** para copiar el patrón exacto (input schema, handler, registro).

Run: `ls avoqado-server/scripts/mcp/tools && grep -rl "promoter_location" avoqado-server/scripts/mcp`
Expected: identificar el archivo del tool `promoter_location` y el archivo índice donde se registran los tools.

- [ ] **Step 2: Implementar el tool** siguiendo ese patrón: input `{ orgId?: string; venueId?: string }`, llama al service correspondiente, formatea filas como texto con `serialNumber`, promotor, "hace X", y `https://www.google.com/maps?q=lat,lng`. Registrarlo en el índice.

- [ ] **Step 3: Verificar arranque del MCP** (o el smoke test que use el repo).

Run: (comando de arranque/health del MCP según `scripts/mcp/README` si existe)
Expected: el tool aparece listado sin romper el server MCP.

- [ ] **Step 4: Commit (checkpoint — requiere OK de Jose)**

```bash
git add scripts/mcp
git commit -m "feat(mcp): expose terminal_location tool"
```

---

## Task 7: Dashboard — client service + tipos

**Files:**
- Create: `src/services/terminalLocation.service.ts`

**Interfaces:**
- Produces:
  - type `TerminalLocation` (espejo del server row)
  - `getSupervisorTerminalLocations(venueId: string): Promise<{ terminals: TerminalLocation[]; trackingEnabled: boolean }>`
  - `getOrgTerminalLocations(orgId: string): Promise<{ terminals: TerminalLocation[] }>`

- [ ] **Step 1: Implementar el client** (usa el axios `@/api`; NO agregar auth/retry — ya lo trae).

```ts
// src/services/terminalLocation.service.ts
import api from '@/api'

export interface TerminalLocation {
  terminalId: string
  serialNumber: string | null
  venue: { id: string; name: string } | null
  promoter: { staffId: string; name: string } | null
  latest: { latitude: number; longitude: number; accuracy: number | null; capturedAt: string; source: string } | null
}

export async function getSupervisorTerminalLocations(
  venueId: string,
): Promise<{ terminals: TerminalLocation[]; trackingEnabled: boolean }> {
  const { data } = await api.get(`/api/v1/dashboard/venues/${venueId}/supervisor/terminals-locations`)
  return data.data
}

export async function getOrgTerminalLocations(orgId: string): Promise<{ terminals: TerminalLocation[] }> {
  const { data } = await api.get(`/api/v1/dashboard/organizations/${orgId}/terminals-locations`)
  return data.data
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard && npx tsc -p tsconfig.app.json --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit (checkpoint — requiere OK de Jose)**

```bash
git add src/services/terminalLocation.service.ts
git commit -m "feat(location): dashboard terminal-location client"
```

---

## Task 8: Dashboard — componente compartido `LastLocationCell`

**Files:**
- Create: `src/components/location/LastLocationCell.tsx`

**Interfaces:**
- Consumes: `useVenueDateTime()` (`@/utils/datetime`), `TerminalLocation['latest']`.
- Produces: `<LastLocationCell latest={...} accuracyLabel />` — muestra "hace X" (tiempo relativo, venue tz), precisión en m, y botón "Ver en mapa" → Google Maps. Estado `null` → texto "Sin ubicación".

- [ ] **Step 1: Implementar el componente** (etiquetado honesto, i18n).

```tsx
// src/components/location/LastLocationCell.tsx
import { useTranslation } from 'react-i18next'
import { MapPin, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useVenueDateTime } from '@/utils/datetime'

interface LatestLocation {
  latitude: number
  longitude: number
  accuracy: number | null
  capturedAt: string
  source: string
}

export function LastLocationCell({ latest }: { latest: LatestLocation | null }) {
  const { t } = useTranslation('playtelecom')
  const { formatRelative } = useVenueDateTime()

  if (!latest) {
    return <span className="text-xs text-muted-foreground">{t('location.none', { defaultValue: 'Sin ubicación registrada' })}</span>
  }

  const mapsUrl = `https://www.google.com/maps?q=${latest.latitude},${latest.longitude}`
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col">
        <span className="text-xs font-medium">{formatRelative(latest.capturedAt)}</span>
        {latest.accuracy != null && (
          <span className="text-[10px] text-muted-foreground">±{Math.round(latest.accuracy)} m</span>
        )}
      </div>
      <Button asChild variant="outline" size="sm" className="h-7 cursor-pointer">
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
          <MapPin className="w-3.5 h-3.5 mr-1" />
          {t('location.viewOnMap', { defaultValue: 'Ver en mapa' })}
          <ExternalLink className="w-3 h-3 ml-1" />
        </a>
      </Button>
    </div>
  )
}
```

> Verificar que `useVenueDateTime()` exponga un formateador relativo; si el nombre difiere (p.ej. `formatDistanceToNow`/`formatRelative`), ajustar. Si no existe relativo, usar `formatDate(latest.capturedAt)` (absoluto, venue tz) — nunca `new Date().toLocaleString()` del browser.

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit (checkpoint — requiere OK de Jose)**

```bash
git add src/components/location/LastLocationCell.tsx
git commit -m "feat(location): shared LastLocationCell (honest relative time + maps link)"
```

---

## Task 9: Dashboard — pestaña "Ubicación de TPVs" en Supervisor

**Files:**
- Modify: `src/pages/playtelecom/Supervisor/SupervisorDashboard.tsx` (`VALID_TABS` L77, TabsList/TabsContent, i18n)
- Modify: `src/locales/es/playtelecom.json`, `src/locales/en/playtelecom.json`

**Interfaces:**
- Consumes: `getSupervisorTerminalLocations` (Task 7), `LastLocationCell` (Task 8), `useCurrentVenue()` (venueId), `useAuth()` (ya en el archivo).

- [ ] **Step 1: Agregar la tab a `VALID_TABS` y su label i18n**

```ts
// SupervisorDashboard.tsx:77
const VALID_TABS = ['operativo', 'checkin', 'ventas', 'ubicacion'] as const
```

```json
// src/locales/es/playtelecom.json  (bajo "supervisor": { "tabs": { ... } })
"ubicacion": "Ubicación de TPVs"
// y bajo la raíz playtelecom, agregar:
"location": { "none": "Sin ubicación registrada", "viewOnMap": "Ver en mapa", "hint": "Se actualiza cada hora (11:00–18:00, hora del local)", "trackingOff": "El seguimiento de ubicación no está activo en esta sucursal", "empty": "Sin TPVs con ubicación hoy" }
```

```json
// src/locales/en/playtelecom.json
"ubicacion": "Terminal Location"
"location": { "none": "No location on record", "viewOnMap": "View on map", "hint": "Updates hourly (11:00–18:00, venue time)", "trackingOff": "Location tracking is off for this venue", "empty": "No terminals with location today" }
```

- [ ] **Step 2: Query + render de la pestaña** (React Query polling 60s; DataTable con arrays memoizados)

```tsx
// imports nuevos en SupervisorDashboard.tsx
import { useQuery } from '@tanstack/react-query'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getSupervisorTerminalLocations } from '@/services/terminalLocation.service'
import { LastLocationCell } from '@/components/location/LastLocationCell'
import { Badge } from '@/components/ui/badge'

// dentro del componente:
const { venueId } = useCurrentVenue()
const { data: locData } = useQuery({
  queryKey: ['supervisor-terminal-locations', venueId],
  queryFn: () => getSupervisorTerminalLocations(venueId!),
  enabled: !!venueId && activeTab === 'ubicacion',
  refetchInterval: 60_000,
})
const terminals = locData?.terminals ?? []
```

```tsx
// Agregar el TabsTrigger junto a los existentes (seguir el estilo underline actual del archivo):
<TabsTrigger value="ubicacion">{t('supervisor.tabs.ubicacion')}</TabsTrigger>

// Y el contenido:
<TabsContent value="ubicacion" className="space-y-4">
  <p className="text-xs text-muted-foreground">{t('location.hint')}</p>
  {locData && !locData.trackingEnabled && (
    <Badge variant="outline">{t('location.trackingOff')}</Badge>
  )}
  {terminals.length === 0 ? (
    <p className="text-sm text-muted-foreground">{t('location.empty')}</p>
  ) : (
    <div className="rounded-lg border border-input divide-y divide-input">
      {terminals.map(term => (
        <div key={term.terminalId} className="flex items-center justify-between p-3">
          <div>
            <p className="font-mono text-sm font-semibold">{term.serialNumber ?? term.terminalId}</p>
            <p className="text-xs text-muted-foreground">{term.promoter?.name ?? '—'}</p>
          </div>
          <LastLocationCell latest={term.latest} />
        </div>
      ))}
    </div>
  )}
</TabsContent>
```

- [ ] **Step 3: Lint + type-check + build**

Run: `npm run lint && npx tsc -p tsconfig.app.json --noEmit`
Expected: sin errores; sin claves i18n faltantes (regla `no-missing-translation-keys`).

- [ ] **Step 4: Commit (checkpoint — requiere OK de Jose)**

```bash
git add src/pages/playtelecom/Supervisor/SupervisorDashboard.tsx src/locales/es/playtelecom.json src/locales/en/playtelecom.json src/components/location/LastLocationCell.tsx
git commit -m "feat(location): supervisor 'Ubicación de TPVs' tab"
```

---

## Task 10: Dashboard — sección Org "Ubicación de TPVs"

**Files:**
- Create: `src/pages/organizations/LiveLocation/LiveLocation.tsx`
- Modify: `src/pages/organizations/components/WLOrgSidebar.tsx` (agregar item en sección "Gestión", L85-96)
- Modify: `src/routes/lazyComponents.ts` (nuevo `WLLiveLocation`, junto a L227-232)
- Modify: `src/routes/router.tsx` (import + child route bajo `/wl/organizations/:orgSlug`, L754-771)
- Modify: `src/locales/es/organization.json`, `src/locales/en/organization.json`

**Interfaces:**
- Consumes: `useCurrentOrganization()` (`orgId`, `basePath`), `getOrgTerminalLocations` (Task 7), `LastLocationCell` (Task 8).

- [ ] **Step 1: Crear la página**

```tsx
// src/pages/organizations/LiveLocation/LiveLocation.tsx
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import { getOrgTerminalLocations } from '@/services/terminalLocation.service'
import { LastLocationCell } from '@/components/location/LastLocationCell'

export default function LiveLocation() {
  const { t } = useTranslation(['organization', 'playtelecom'])
  const { orgId } = useCurrentOrganization()
  const { data } = useQuery({
    queryKey: ['org-terminal-locations', orgId],
    queryFn: () => getOrgTerminalLocations(orgId!),
    enabled: !!orgId,
    refetchInterval: 60_000,
  })
  const terminals = data?.terminals ?? []

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('organization:liveLocation.title', { defaultValue: 'Ubicación de TPVs' })}</h1>
        <p className="text-xs text-muted-foreground">{t('playtelecom:location.hint')}</p>
      </div>
      {terminals.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('playtelecom:location.empty')}</p>
      ) : (
        <div className="rounded-lg border border-input divide-y divide-input">
          {terminals.map(term => (
            <div key={term.terminalId} className="flex items-center justify-between p-3">
              <div>
                <p className="font-mono text-sm font-semibold">{term.serialNumber ?? term.terminalId}</p>
                <p className="text-xs text-muted-foreground">
                  {(term.promoter?.name ?? '—')} · {(term.venue?.name ?? '—')}
                </p>
              </div>
              <LastLocationCell latest={term.latest} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

```json
// src/locales/es/organization.json → "liveLocation": { "title": "Ubicación de TPVs" }, y "sidebar": { ... "liveLocation": "Ubicación de TPVs" }
// src/locales/en/organization.json → "liveLocation": { "title": "Terminal Location" }, "sidebar": { ... "liveLocation": "Terminal Location" }
```

- [ ] **Step 2: Registrar lazy component**

```ts
// src/routes/lazyComponents.ts (junto a los WL*)
export const WLLiveLocation = lazyWithRetry(() => import('@/pages/organizations/LiveLocation/LiveLocation'))
```

- [ ] **Step 3: Agregar la ruta hija** en `router.tsx` (bajo `/wl/organizations/:orgSlug`, hermana de `managers`)

```tsx
// import (junto al bloque WL* ~L108-113)
WLLiveLocation,
// child route (dentro de children de WLOrganizationLayout)
{ path: 'live-location', element: <WLLiveLocation /> },
```

- [ ] **Step 4: Agregar el item de sidebar** en `WLOrgSidebar.tsx` (sección "Gestión")

```tsx
// import icon
import { MapPin } from 'lucide-react'
// dentro de items de la sección Gestión (después de "managers"):
{
  name: t('organization:sidebar.liveLocation', { defaultValue: 'Ubicación de TPVs' }),
  href: `${basePath}/live-location`,
  icon: MapPin,
},
```

- [ ] **Step 5: Lint + type-check**

Run: `npm run lint && npx tsc -p tsconfig.app.json --noEmit`
Expected: sin errores; sin claves i18n faltantes.

- [ ] **Step 6: Commit (checkpoint — requiere OK de Jose)**

```bash
git add src/pages/organizations/LiveLocation/LiveLocation.tsx src/pages/organizations/components/WLOrgSidebar.tsx src/routes/lazyComponents.ts src/routes/router.tsx src/locales/es/organization.json src/locales/en/organization.json
git commit -m "feat(location): org white-label 'Ubicación de TPVs' section"
```

---

## Task 11: E2E (Playwright) + verificación final

**Files:**
- Create: `e2e/tests/ubicacion-tpvs.spec.ts`

**Interfaces:**
- Consumes: `setupApiMocks(page, {...})` (`e2e/fixtures/api-mocks.ts`), routes LIFO.

- [ ] **Step 1: Test happy-path org** — mockear el endpoint org y validar que la lista + link a Google Maps se renderiza.

```ts
// e2e/tests/ubicacion-tpvs.spec.ts
import { test, expect } from '@playwright/test'
import { setupApiMocks } from '../fixtures/api-mocks'

test('Org: Ubicación de TPVs lista terminales con link a Google Maps', async ({ page }) => {
  await setupApiMocks(page, { userRole: 'OWNER' })
  // registrar DESPUÉS del catch-all (LIFO) la ruta específica:
  await page.route('**/api/v1/dashboard/organizations/*/terminals-locations', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { terminals: [
        { terminalId: 't1', serialNumber: 'AVQD-2840744194', venue: { id: 'v1', name: 'BAE PAPAGAYO' }, promoter: { staffId: 'p1', name: 'Isela Chávez' }, latest: { latitude: 22.14, longitude: -100.97, accuracy: 30, capturedAt: new Date().toISOString(), source: 'PERIODIC' } },
      ] } }),
    }),
  )
  // navegar a la ruta org live-location (ajustar orgSlug al fixture)
  await page.goto('/wl/organizations/<org-slug-de-fixture>/live-location')
  await expect(page.getByText('AVQD-2840744194')).toBeVisible()
  const mapLink = page.getByRole('link', { name: /Ver en mapa/i })
  await expect(mapLink).toHaveAttribute('href', /google\.com\/maps\?q=22\.14,-100\.97/)
})
```

> Ajustar el `org-slug` y el rol al fixture real de `api-mocks.ts`. Si el fixture no soporta contexto org white-label, extenderlo mínimamente (siguiendo su patrón) o cubrir esta ruta con un test de la pestaña Supervisor, que es más directa de montar.

- [ ] **Step 2: Correr E2E**

Run: `npm run test:e2e -- ubicacion-tpvs`
Expected: PASS.

- [ ] **Step 3: Verificación integral** — `/full-testing` del cambio (server + dashboard) contra Postgres local + tail del log, y auditoría (feedback estándar del founder). Probar light + dark y con roles MANAGER y OWNER.

- [ ] **Step 4: Commit (checkpoint — requiere OK de Jose)**

```bash
git add e2e/tests/ubicacion-tpvs.spec.ts
git commit -m "test(location): e2e for Ubicación de TPVs"
```

---

## Notas de rollout (post-plan)

1. Server a `develop` → verificar en demo/staging → `main` (FF `develop→main`, nunca cherry-pick — regla del founder). **Sin redeploy PAX.**
2. Dashboard a `develop` → verificar → `main`.
3. Prod: activar `trackPromoterLocation` en los venues objetivo (incluye la TPV serie **2840744194** del Asana).
4. Follow-up separado (NO en este plan): crear la tienda virtual "Cambaceo" + reasignar a Isela Chávez (tarea de datos/ops).
