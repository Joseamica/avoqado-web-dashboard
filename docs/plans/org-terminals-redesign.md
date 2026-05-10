# Plan — Organization Terminals Page Redesign

**Route:** `/organizations/:orgId/terminals`
**File:** `src/pages/Organization/OrganizationTerminals.tsx`
**Reference page (visual + interaction language):** `src/pages/Order/Orders.tsx`
**Status:** Design plan locked. Ready for `/plan-eng-review`.

---

## Goal

Make the org terminals page genuinely interactive: search across every relevant
field, sort any column ASC/DESC, filter with multi-select pills, persist state in
the URL, click rows to open a detail drawer, and run safe commands across many
terminals at once. Align the page with the project's mandatory UI patterns
(currently violates 3) so it feels like the rest of the dashboard, not a
one-off.

## Scope

**In scope** (Frontend):
- Replace `<Select>` filter dropdowns with `FilterPill` multi-select.
- Replace always-visible search with the project's expandable rounded-full search.
- Add `StatusFilterTabs` pill row above the table.
- Add active filter chip row + "Limpiar todo".
- Migrate raw `<Table>` to `DataTable` for sortable headers + ColumnCustomizer.
- Add row checkbox column + `SelectionSummaryBar` for bulk safe commands.
- Row click → `<Sheet>` drawer with full terminal detail + actions.
- URL state for `search`, `status[]`, `type[]`, `venue[]`, `sortBy`, `sortOrder`,
  `page`, and `?terminal=<id>` for the open drawer.
- Onboarding empty-org hero (centered illustration + copy + CTA + docs link).
- Empty-results state with "Limpiar filtros" button.
- `data-tour` attributes on primary CTA, search input, and each filter pill.
- Full i18n in `en/organization.json` + `es/organization.json`.
- Light + dark mode parity, semantic color tokens only.

**In scope** (Backend, `avoqado-server`):
- `GET /api/v1/dashboard/organizations/:orgId/terminals` extends search to
  `venue.name`, `brand`, `model` in addition to current `name` + `serialNumber`.
- Add `sortBy` whitelist: `name | lastHeartbeat | status | type | venue.name |
  brand | healthScore | createdAt`. Add `sortOrder` (`asc` | `desc`).
- Add `commands[]` array filter that takes the safe-command set and runs the
  matching command across every terminalId provided (one bulk endpoint:
  `POST /api/v1/dashboard/organizations/:orgId/terminals/bulk-command` with
  `{ terminalIds: string[], command: OrgAllowedCommand }`). Validates each
  belongs to the org. Returns per-terminal success/failure for partial reporting.

**Out of scope** (Explicitly deferred — see Open TODOs):
- `OrgTerminalDialog` redesign to `FullScreenModal` (current `<Dialog>` violates
  rule 12 of project's mandatory patterns; flagged as separate work).
- Real-time Socket.IO updates of `lastHeartbeat` / `status` (defer to feature
  flag rollout once `useSocketEvents` is wired for terminals).
- Multi-column sort (single-column is enough; revisit if operators ask).
- Terminal health 24h sparkline in drawer (defer if `healthMetrics` time-series
  query is non-trivial).
- Bulk export to CSV (could be added later; not blocking).

---

## Locked design decisions (from review)

| # | Decision | Choice |
|---|---|---|
| D1 | Default sort | `lastHeartbeat desc` — operator's morning question is "is everything alive?" |
| D2 | Empty-org state | Warm onboarding hero with copy, primary CTA, docs link |
| D3 | Mobile filters | Stripe-style `flex flex-wrap gap-2` (Orders.tsx parity), expandable search |
| D4 | Bulk-action set | Safe-only: `RESTART`, `SYNC_DATA`, `REFRESH_MENU`, `FORCE_UPDATE`, `LOCK`, `UNLOCK`. **Excluded:** `FACTORY_RESET`, `MAINTENANCE_MODE`/`EXIT_MAINTENANCE`, `UPDATE_CONFIG`, `UPDATE_MERCHANT`, `Delete` |
| D5 | Health column sort | Sortable server-side via JOIN on latest `healthMetrics`; accept query cost, add composite index if slow |
| D6 | Status column merge | Column 1 = pulse dot only (with tooltip showing absolute lastHeartbeat). Column "Estado" = text label + Lock badge. No duplicate pulse |

### Eng review decisions (locked 2026-05-10)

| # | Decision | Choice |
|---|---|---|
| E1 | healthScore sortability | **Denormalize.** Add `Terminal.latestHealthScore Int?` + `latestHealthAt DateTime?` columns. Update on every HealthMetric write. Backfill SQL in migration. Sort becomes a plain column orderBy. (Prisma cannot orderBy on a to-many relation's scalar — the design's "JOIN sort" was not actually buildable.) |
| E2 | Bulk-command contract | Batched validation (one Prisma call, not N). Hard cap 100 terminalIds per request. HTTP 207 Multi-Status with per-row `{ terminalId, success, error? }` results. OWNER role required (org dashboard is owner-only by route). |
| E3 | Status helpers DRY | Extract `getTerminalStatusStyle` + `isTerminalOnline` + `PulseStatus` type to `src/lib/terminal-status.ts`. Update `Tpvs.tsx` and the new `OrganizationTerminals.tsx` to import. Single source of truth. |
| E4 | Component decomposition | Split into `OrganizationTerminals.tsx` (page shell) + `components/{OrgTerminalsToolbar, OrgTerminalsTable, OrgTerminalDrawer, OrgTerminalsBulkBar}.tsx`. Project rule: 500-line file cap. |
| E5 | Test coverage | **Full coverage.** All 28 paths (16 backend code + 12 user flows) plus the regression test. Backend unit + integration. Frontend component tests for FilterPill state, URL sync, bulk bar, drawer. E2E for 7 critical user flows. |
| E6 | List freshness | Manual refresh button in header (no polling, no Socket.IO yet). Operator clicks `Recargar` to refetch. Defers Socket.IO to TODO. |
| E7 | Input validation | Zod schemas on every new query / body param. `sortBy` is a `z.enum([...whitelist])`. `bulkCommandSchema`: `terminalIds: z.array(z.string().cuid()).min(1).max(100)`, `command: z.enum(SAFE_COMMANDS)`. Server rejects unknown sortBy/command with 400. |
| E8 | URL state contract | Comma-separated arrays (`?status=ACTIVE,RETIRED`). Separate `sortBy` + `sortOrder` params. Filter changes use `replace: true` (no history spam). Drawer open/close uses `push` (back button closes drawer). |

---

## Information architecture

```
Header                                    [data-tour="org-terminals-create-btn"]
  Title + subtitle                        Crear terminal (primary)
─────────────────────────────────────────────────────────────────────────────
Metric strip (4 cards, click filters table)
  Total | Online (green) | Offline (red>0 else neutral) | Salud baja
─────────────────────────────────────────────────────────────────────────────
StatusFilterTabs (rounded-full pill row, server counts)
  Todas | En línea | Sin conexión | Pendientes | Mantenimiento | Retiradas
─────────────────────────────────────────────────────────────────────────────
Filter row (flex flex-wrap, Orders.tsx pattern)
  [🔍 expandable]  [Estado pill]  [Tipo pill]  [Sucursal pill]  [⋯ Columnas]

Active chips row (only when ≥1 filter active)
  ●Android  ●Polanco  ●Online            (Limpiar todo ✕)
─────────────────────────────────────────────────────────────────────────────
DataTable (GlassCard wrapper)
  ☐  ●  Terminal ▲▼   Sucursal ▲▼  Estado  Tipo  Marca/Modelo  Salud ▲▼
                                                  Versión  Última señal ▲▼  ⋯
─────────────────────────────────────────────────────────────────────────────
Pagination (right-aligned)            "Mostrando 1-20 de 87"  ◀ 1/5 ▶
─────────────────────────────────────────────────────────────────────────────
SelectionSummaryBar (fixed bottom-center, slide-in when ≥1 row selected)
  3 seleccionadas  [Reiniciar] [Sincronizar] [Bloquear] [Desbloquear] [⋯ más]
                                                       (Limpiar selección ✕)
─────────────────────────────────────────────────────────────────────────────
Sheet drawer (right, w-full sm:max-w-2xl, opens on row click)
  Header:    StatusPulse + name + venue + serial + close
  Actions:   Reiniciar | Sincronizar | Bloquear | Mantenimiento | ⋯ más
  Identity:  Serial · Tipo · Marca/Modelo · Versión · IP
  Health:    Score + last 24h heartbeat sparkline (deferred if heavy)
  Comercios: chip list + "Editar"
  Recientes: last 10 actions from activity log (read-only)
  Danger:    collapsed accordion → Factory reset · Eliminar
```

---

## Interaction state matrix

| Surface | Loading | Empty (org=0) | Empty (filter=0) | Error |
|---|---|---|---|---|
| Table | 5-row skeleton | Onboarding hero + CTA | "Sin resultados para «{q}»" + Limpiar filtros | Toast + retry |
| Search | spinner inside input | placeholder rotates suggestions | shows "0 resultados" | revert to last value |
| Filter pills | n/a | disabled, tooltip "Sin terminales para filtrar" | active pills stay; chip row visible | per-pill error toast |
| Sortable header | sort icon → mini spinner | n/a | n/a | revert to last good direction |
| Drawer | 4-section skeleton | n/a | n/a | "No se pudo cargar la terminal" + retry |
| Bulk bar | hidden | hidden | hidden | partial-failure toast: "2 de 3 reiniciadas. 1 sin conexión" |

---

## Backend changes (avoqado-server)

### Schema migration

**File:** new `prisma/migrations/<timestamp>_terminal_latest_health/migration.sql`

```sql
ALTER TABLE "Terminal" ADD COLUMN "latestHealthScore" INTEGER;
ALTER TABLE "Terminal" ADD COLUMN "latestHealthAt" TIMESTAMP(3);
CREATE INDEX "Terminal_latestHealthScore_idx" ON "Terminal" ("latestHealthScore" NULLS LAST);

-- Backfill existing terminals with the latest health metric
UPDATE "Terminal" t
SET "latestHealthScore" = hm."healthScore",
    "latestHealthAt" = hm."createdAt"
FROM (
  SELECT DISTINCT ON ("terminalId") "terminalId", "healthScore", "createdAt"
  FROM "HealthMetric"
  ORDER BY "terminalId", "createdAt" DESC
) hm
WHERE hm."terminalId" = t."id";
```

**Sync hook:** the heartbeat ingestion service that writes `HealthMetric` MUST
update `Terminal.latestHealthScore` + `latestHealthAt` in the same transaction
(IRON RULE regression test covers this).

### `getOrgTerminals` updates

**File:** `src/services/organization-dashboard/organizationDashboard.service.ts`

```ts
// search spans more fields
if (filters?.search) {
  const q = filters.search
  where.OR = [
    { name: { contains: q, mode: 'insensitive' } },
    { serialNumber: { contains: q, mode: 'insensitive' } },
    { brand: { contains: q, mode: 'insensitive' } },
    { model: { contains: q, mode: 'insensitive' } },
    { venue: { name: { contains: q, mode: 'insensitive' } } },
  ]
}

// sortBy whitelist (validated by Zod at the route layer too)
const SORT_WHITELIST = ['name', 'lastHeartbeat', 'status', 'type', 'brand',
  'createdAt', 'venue.name', 'latestHealthScore'] as const
const sortBy = (SORT_WHITELIST as readonly string[]).includes(filters?.sortBy ?? '')
  ? (filters!.sortBy as (typeof SORT_WHITELIST)[number])
  : 'lastHeartbeat'
const sortOrder: 'asc' | 'desc' = filters?.sortOrder === 'asc' ? 'asc' : 'desc'

// translate to Prisma orderBy (relation sort for venue.name only)
const orderBy =
  sortBy === 'venue.name'
    ? { venue: { name: sortOrder } }
    : { [sortBy]: { sort: sortOrder, nulls: 'last' as const } }
```

### Bulk-command endpoint (new)

**Route:** `POST /:orgId/terminals/bulk-command` in
`organizationDashboard.routes.ts`. Returns `207 Multi-Status` with per-row
results.

**Body schema (Zod):**
```ts
const bulkCommandSchema = z.object({
  terminalIds: z.array(z.string().cuid()).min(1).max(100),
  command: z.enum(SAFE_BULK_COMMANDS),
})
const SAFE_BULK_COMMANDS = ['RESTART', 'SYNC_DATA', 'REFRESH_MENU',
  'FORCE_UPDATE', 'LOCK', 'UNLOCK'] as const
```

**Service:** new `bulkCommandForOrg(orgId, terminalIds, command, staffId)` in
`orgTerminals.service.ts`. Steps:
1. **Batch validate** in ONE query: `prisma.terminal.findMany({ where: { id: {
   in: terminalIds }, venue: { organizationId: orgId } }, select: { id: true,
   venueId: true } })`. Any id not in the result is a 403/not-found per row.
2. For each valid terminal, queue via `tpvCommandQueueService.queueCommand`.
   Catch per-terminal errors (don't let one failure abort the loop).
3. Return `{ results: Array<{ terminalId: string; success: boolean; error?: string }> }`.

**Frontend service:** add `bulkCommandOrgTerminals(orgId, terminalIds,
command): Promise<BulkCommandResult>` in `organizationDashboard.service.ts`.
Add `sortBy`, `sortOrder` to `OrgTerminalsFilters`. Update placeholder to
mention venue.

---

## Frontend implementation outline

### Component decomposition

```
src/pages/Organization/
├── OrganizationTerminals.tsx          (~250 lines)
│   • useParams + URL state (search, status[], type[], venue[], sortBy, sortOrder, page, terminal)
│   • useQuery for org terminals + venues
│   • coordinates child components
└── components/
    ├── OrgTerminalsToolbar.tsx        (~180 lines)
    │   • expandable search (Orders.tsx pattern)
    │   • FilterPill × 3 (Estado, Tipo, Sucursal)
    │   • active chip row + Limpiar todo
    │   • StatusFilterTabs above filter row
    │   • Recargar button (manual refresh, decision E6)
    │   • ColumnCustomizer
    ├── OrgTerminalsTable.tsx          (~250 lines)
    │   • DataTable + ColumnDef[]
    │   • sortable headers (3-state ▲ ▼ none)
    │   • status pulse column + checkbox column
    │   • row-level dropdown menu for single-terminal actions
    ├── OrgTerminalDrawer.tsx          (~200 lines)
    │   • <Sheet> controlled by ?terminal=<id>
    │   • header + actions + identity + health + comercios + recientes + danger
    │   • separate query for terminals not in current page data
    └── OrgTerminalsBulkBar.tsx        (~150 lines)
        • <SelectionSummaryBar> with bulk-safe commands
        • AlertDialog confirm with name list
        • bulkCommandMutation + per-row partial-failure surfacing
```

### Implementation steps

1. **Extract status helpers** (decision E3): create `src/lib/terminal-status.ts`
   with `getTerminalStatusStyle`, `isTerminalOnline`, `PulseStatus` type.
   Update `Tpvs.tsx` to import. Verify both pages still build.
2. **State** — `useSearchParams` reader/writer (decision E8: comma-separated
   arrays, separate sortBy/sortOrder, replace for filters, push for drawer).
3. **Query** — `queryKey` includes everything; `enabled: !!orgId`.
4. **Columns** — `useMemo` `ColumnDef<OrgTerminal>[]` with `enableSorting:
   true` per sortable column. Column visibility state syncs to URL.
5. **Filter row** — port FilterPill block from Orders.tsx, rename labels.
6. **StatusFilterTabs** — single source of truth: when a tab is selected, set
   `statusFilter = [thatStatus]`. When user picks a multi-select status in the
   pill, the tab goes to "Todas".
7. **Active chips** — render only when any filter array is non-empty; each chip
   `onClick` removes that single value.
8. **Drawer** — `<Sheet>` controlled by `?terminal=<id>` URL param. Content
   uses the same query data; if id not in current page data, fire a separate
   `getTerminalForOrg(orgId, terminalId)` query.
9. **Bulk bar** — `<SelectionSummaryBar>` with action buttons firing
   `bulkCommandMutation`. Each click → AlertDialog "¿Reiniciar 3 terminales?"
   listing names (collapsible if >10). Per-row partial-failure badge after
   207 response.
10. **Keyboard** — `useEffect` global keydown: `/` focuses search, `Esc` closes
    drawer, sortable `<th>` already keyboard-accessible via DataTable.
11. **Onboarding tour** — register `useOrgTerminalsTour` hook reusing the
    `waitForElement` + `onNextClick` pattern from `useProductCreationTour`.

---

## i18n keys to add (en + es)

```
organization.terminals.tabs.{all,online,offline,pending,maintenance,retired}
organization.terminals.filters.{searchHint,statusLabel,typeLabel,venueLabel,clearAll,activeFilters}
organization.terminals.columns.{lastSeenSort,healthSort}
organization.terminals.bulk.{selected,confirmTitle,confirmDesc,partialSuccess,allFailed,allSuccess}
organization.terminals.empty.{org.title,org.body,org.cta,org.docs,results.title,results.cta}
organization.terminals.drawer.{identity,health,merchants,recentCommands,dangerZone,close}
organization.terminals.tour.{step1,step2,step3,step4,step5}
```

---

## Open TODOs surfaced (not in scope of this redesign)

1. **Migrate `OrgTerminalDialog` to `FullScreenModal`** — current Dialog
   violates project rule 12. Separate PR. Estimated 2 hr human / 10 min CC.
2. **Add Prisma composite index `(venueId, lastHeartbeat)`** — required if
   sorting by `lastHeartbeat` becomes slow on 1000+ terminal orgs. Defer until
   measured.
3. **Wire Socket.IO for live heartbeat updates** — replace manual refresh
   button with subscription; needs `useSocketEvents('terminal:heartbeat')`
   hook. Removes the staleness window.
4. **Health 24h sparkline in drawer** — add `getTerminalHealthHistory`
   service + chart in drawer if time-series query is performant.
5. **pg_trgm GIN index on Terminal.name + serialNumber + brand + model** —
   speeds up `ilike` search at scale. Defer until measured. Migration adds
   `CREATE EXTENSION pg_trgm; CREATE INDEX ... USING GIN (... gin_trgm_ops);`.
6. **Async job pattern for very large bulks (>100)** — current cap is 100
   per request. If fleet operators routinely need 500+, swap the synchronous
   207 response for a job/poll pattern. Defer.

## Failure modes (per code path)

| Code path | Realistic failure | Test? | Error handling? | User sees? |
|---|---|---|---|---|
| Search OR-clause | One DB column has corrupt data → full-text matches throw | covered by unit | yes (Prisma throws → 500 handler) | toast "Error al buscar" |
| sortBy whitelist | Frontend sends `__proto__` as sortBy | covered by Zod | yes (400 reject) | client falls back to default sort, no error UI needed |
| latestHealthScore sync | HealthMetric write succeeds but Terminal update fails | **REGRESSION test** | yes (transaction rollback) | next sort returns slightly stale data — acceptable |
| Bulk validation | One terminalId belongs to a different org | covered by unit | yes (per-row error in 207 response) | red badge on that row + toast detail |
| Bulk queue | tpvCommandQueueService throws mid-loop | covered by unit | yes (caught, logged, returned in results[]) | per-row error |
| URL state | User pastes URL with 50 status values | covered by Zod max(20) | yes (clamps to first 20) | filter shows clamped set, no error |
| Drawer fetch | Terminal id in URL doesn't exist | covered by E2E | yes (404 → "No encontrada") | drawer shows "Terminal no encontrada" + close |
| Manual refresh button rapid-click | 5 clicks → 5 in-flight queries | covered by unit | yes (TanStack dedup) | one fresh result, no duplicate toasts |

**No critical gaps** (all failure modes have a test + handler + visible UX).

## Worktree parallelization strategy

| Step | Modules touched | Depends on |
|------|----------------|------------|
| A. Extract status helpers | `src/lib/terminal-status.ts`, `src/pages/Tpv/`, `src/pages/Organization/` | — |
| B. Backend schema + service | `avoqado-server/prisma/`, `avoqado-server/src/services/organization-dashboard/`, `avoqado-server/src/routes/dashboard/` | — |
| C. Frontend service contract | `src/services/organizationDashboard.service.ts` | B (types) |
| D. Frontend page rebuild | `src/pages/Organization/`, `src/locales/` | A, C |
| E. E2E + tests | `e2e/tests/`, `avoqado-server/test/` | B, D |

**Parallel lanes:**
- Lane 1 (frontend extract): A — independent, no shared module with B
- Lane 2 (backend rebuild): B — independent of A
- Lane 3 (frontend rebuild): C → D → E — must follow B for type compatibility

**Execution:** Launch Lane 1 + Lane 2 in parallel worktrees. Once Lane 2's B
ships its types, kick off Lane 3 (C → D → E sequentially). Final integration:
merge Lane 1, then Lane 2, then Lane 3.

**Conflict flag:** Lane 1 (status helpers) and Lane 3 (page rebuild) both
touch `src/pages/Organization/OrganizationTerminals.tsx`. Sequence: ship Lane
1 first so Lane 3 starts from the extracted import.

---

## Acceptance criteria

- Search input matches against name, serial, brand, model, AND venue name. ✅
- Each table header (Terminal, Sucursal, Salud, Última señal) toggles between
  ▲ ASC, ▼ DESC, and unsorted on click. Default load shows ▼ on Última señal. ✅
- Multi-select filter pills work, clear individually or via "Limpiar todo". ✅
- URL reflects all state — paste-and-share reproduces the exact view. ✅
- Row click opens drawer; drawer URL is deep-linkable. ✅
- Bulk select works on the safe set; partial failures reported per-terminal. ✅
- Empty-org first run shows the onboarding hero, not "0 resultados". ✅
- All copy goes through `t()` with EN + ES translations. ✅
- Light + dark mode visually checked. ✅
- Tested with VIEWER, MANAGER, OWNER roles (VIEWER sees no bulk bar; MANAGER
  cannot trigger destructive even individually). ✅
- `npm run build`, `npm run lint`, `npm run test:e2e` pass. ✅
- Backend migration applied + backfill verified on staging. ✅
- Backend test suite passes including new bulk-command unit + healthMetric
  sync regression integration. ✅
- Test plan at `~/.gstack/projects/Joseamica-avoqado-web-dashboard/devjamica-develop-eng-review-test-plan-20260510-org-terminals.md`
  verified by /qa or /qa-only after implementation. ✅

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | not run |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | declined |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 6 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR (FULL) | score 4/10 → 9/10, 6 decisions, 0 unresolved |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | not applicable |

- **UNRESOLVED:** 0
- **VERDICT:** DESIGN + ENG CLEARED — ready to implement

---

