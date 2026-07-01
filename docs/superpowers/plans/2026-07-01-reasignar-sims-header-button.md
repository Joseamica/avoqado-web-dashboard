# Reasignar SIMs Header Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an orange "Reasignar SIMs" button to the Control de Stock page header, positioned immediately left of "Asignar SIMs", that opens the already-shipped `ReassignPromoterDialog` with no pre-selected SIMs.

**Architecture:** Two small, additive changes — (1) a reusable `warning` semantic color/Button variant, (2) wiring that variant into a new gated button + dialog mount in `OrgStockControlPage.tsx`. No backend changes, no new dialog logic — `ReassignPromoterDialog` already supports zero pre-selected SIMs via its default "Buscar" search tab.

**Tech Stack:** React 18 + TypeScript, Tailwind v4 (`@theme` tokens), CVA (`class-variance-authority`) for Button variants, Vitest + @testing-library/react for tests.

## Global Constraints

- No hardcoded colors — new button color must be a semantic Tailwind token (`bg-warning`/`text-warning-foreground`), not a raw `orange-*` class. (`.claude/rules/critical-warnings.md`)
- i18n: this entire PlayTelecom `Organization/StockControl` module hardcodes Spanish strings with no `useTranslation` anywhere in it. The new button label stays hardcoded Spanish (`"Reasignar SIMs"`) to match its siblings — confirmed with the founder, do not introduce `t()` here.
- Permission gate must exactly mirror `OrgDetalleSimsTab.tsx`'s existing `canReassignPromoter = can('sim-custody:reassign') || isAdminOrAbove` (where `isAdminOrAbove = ['SUPERADMIN','OWNER','ADMIN'].includes(currentUserRole)`) — NOT `canAssignToSupervisor` (a different permission for a different action; notably it excludes ADMIN).
- Button placement: immediately before the existing `Asignar SIMs` button in the header toolbar `<div className="flex flex-wrap items-center gap-3">`, per Isaac's approved mockup (Asana task 1216095149541817).
- No new "Cambiar Categoría" header button — out of scope, not requested.
- No changes to `ReassignPromoterDialog`, `reassignSimsToPromoter`, or the existing tab-local "Reasignar a Promotor" button — reuse as-is.
- `ReassignPromoterDialog` is mounted with no `preselectedSerials` prop — its default `mode: 'search'` state already handles an empty initial selection.

---

### Task 1: `warning` semantic color token + Button variant

**Files:**
- Modify: `src/index.css:34-36` (inside the `@theme` block)
- Modify: `src/components/ui/button.tsx:11-18` (CVA `variant` map)
- Test: `src/components/ui/__tests__/button.test.tsx` (new file)

**Interfaces:**
- Consumes: existing raw CSS custom properties `--warning`, `--warning-foreground`, `--warning-muted`, `--warning-border` already defined in `src/index.css` `:root` (line ~530) and `.dark` (line ~587) — untouched by this task.
- Produces: `<Button variant="warning">` — a new CVA variant string `'bg-warning text-warning-foreground shadow hover:bg-warning/90'`, consumed by Task 2.

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/__tests__/button.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from '../button'

describe('Button warning variant', () => {
  it('applies the warning (orange) semantic classes', () => {
    render(<Button variant="warning">Reasignar SIMs</Button>)
    const btn = screen.getByRole('button', { name: 'Reasignar SIMs' })
    expect(btn.className).toContain('bg-warning')
    expect(btn.className).toContain('text-warning-foreground')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/__tests__/button.test.tsx`
Expected: FAIL — TypeScript/CVA rejects `variant="warning"` (not a valid variant yet), or the rendered className doesn't contain `bg-warning`.

- [ ] **Step 3: Add the `--color-warning*` theme aliases**

In `src/index.css`, inside the `@theme { ... }` block, find:

```css
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
```

Replace with:

```css
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-warning-muted: var(--warning-muted);
  --color-warning-border: var(--warning-border);
  --color-border: var(--border);
```

This aliases the already-defined raw `--warning*` tokens into Tailwind v4's `--color-*` namespace so it generates `bg-warning`/`text-warning-foreground` utilities, mirroring the existing `--color-destructive` pattern immediately above it.

- [ ] **Step 4: Add the `warning` Button variant**

In `src/components/ui/button.tsx`, find:

```ts
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline: 'border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
```

Replace with:

```ts
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        warning: 'bg-warning text-warning-foreground shadow hover:bg-warning/90',
        outline: 'border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/ui/__tests__/button.test.tsx`
Expected: PASS

- [ ] **Step 6: Verify Tailwind actually generates the utility (build check)**

Run: `npm run build && grep -o '\.bg-warning{[^}]*}' dist/assets/*.css | head -1`
Expected: a non-empty CSS rule is printed (confirms Tailwind's JIT picked up the new `--color-warning` theme token and generated real CSS, not just a className string with no backing rule).

- [ ] **Step 7: Commit**

```bash
git add src/index.css src/components/ui/button.tsx src/components/ui/__tests__/button.test.tsx
git commit -m "feat(ui): add warning (orange) semantic color and Button variant"
```

---

### Task 2: Wire "Reasignar SIMs" header button into `OrgStockControlPage`

**Files:**
- Modify: `src/pages/playtelecom/Organization/OrgStockControlPage.tsx:30-36` (imports), `:66-84` (state/permissions), `:183-210` (header toolbar + dialog mounts)
- Test: `src/pages/playtelecom/Organization/__tests__/OrgStockControlPage.test.tsx` (new file)

**Interfaces:**
- Consumes: `<Button variant="warning">` from Task 1. `ReassignPromoterDialog` (existing, unchanged) at `./StockControl/components/ReassignPromoterDialog`, props `{ open: boolean; onOpenChange: (open: boolean) => void; orgId: string; venueId?: string; preselectedSerials?: string[]; onDone?: () => void }`.
- Produces: nothing new consumed by later tasks — this is the final integration point.

- [ ] **Step 1: Write the failing test**

Create `src/pages/playtelecom/Organization/__tests__/OrgStockControlPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ orgId: 'org-1' }),
  }
})

vi.mock('@/hooks/use-current-organization', () => ({
  useCurrentOrganization: () => ({
    organization: { name: 'PlayTelecom' },
    orgId: 'org-1',
    orgSlug: 'playtelecom',
    basePath: '/wl/organizations/playtelecom',
    venues: [{ id: 'v1', name: 'Sucursal 1' }],
    hasSerializedInventory: true,
    isLoading: false,
    isOwner: true,
    error: null,
  }),
}))

vi.mock('@/hooks/use-access', () => ({ useAccess: vi.fn() }))
vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn() }))

vi.mock('@/components/date-range-picker', () => ({ DateRangePicker: () => null }))
vi.mock('../StockControl/components/ExportButton', () => ({ ExportButton: () => null }))
vi.mock('../StockControl/components/AssignToSupervisorDialog', () => ({
  AssignToSupervisorDialog: () => null,
}))
vi.mock('../StockControl/components/OrgBulkUploadDialog', () => ({
  OrgBulkUploadDialog: () => null,
}))
vi.mock('../StockControl/components/ReassignPromoterDialog', () => ({
  ReassignPromoterDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="reassign-dialog-open" /> : null,
}))
vi.mock('../StockControl/tabs/OrgResumenTab', () => ({ OrgResumenTab: () => <div data-testid="resumen-tab" /> }))
vi.mock('../StockControl/tabs/OrgCargasTab', () => ({ OrgCargasTab: () => null }))
vi.mock('../StockControl/tabs/OrgDetalleSimsTab', () => ({ OrgDetalleSimsTab: () => null }))
vi.mock('../StockControl/tabs/OrgPorSucursalTab', () => ({ OrgPorSucursalTab: () => null }))
vi.mock('../StockControl/tabs/OrgPorCategoriaTab', () => ({ OrgPorCategoriaTab: () => null }))
vi.mock('../StockControl/tabs/OrgSolicitudesTab', () => ({ OrgSolicitudesTab: () => null }))

const mockStockOverview = {
  summary: {
    totalSims: 100,
    available: 50,
    sold: 40,
    damaged: 5,
    returned: 5,
    rotacionPct: 40,
    totalCargas: 3,
    sucursalesInvolucradas: 2,
    categoriasActivas: 2,
    dateRange: { from: '2026-01-01', to: '2026-07-01' },
    generatedAt: '2026-07-01T00:00:00.000Z',
    lastActivity: { timestamp: '2026-07-01T00:00:00.000Z', venueName: 'Sucursal 1', action: 'UPLOAD' },
  },
  items: [],
  bulkGroups: [],
  aggregatesBySucursal: [],
  aggregatesByCategoria: [],
}

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === 'org-stock-control') {
      return { data: mockStockOverview, isLoading: false, isError: false, error: null, refetch: vi.fn() }
    }
    return { data: 0, isLoading: false }
  },
}))

import { useAccess } from '@/hooks/use-access'
import { useAuth } from '@/context/AuthContext'
import OrgStockControlPage from '../OrgStockControlPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <OrgStockControlPage />
    </MemoryRouter>,
  )
}

describe('OrgStockControlPage — Reasignar SIMs header button', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: { role: 'VIEWER' }, staffInfo: null } as any)
    vi.mocked(useAccess).mockReturnValue({ can: () => false } as any)
  })

  it('renders "Reasignar SIMs" immediately before "Asignar SIMs" for an OWNER', () => {
    vi.mocked(useAuth).mockReturnValue({ user: { role: 'OWNER' }, staffInfo: null } as any)

    renderPage()

    const reassign = screen.getByRole('button', { name: 'Reasignar SIMs' })
    const asignar = screen.getByRole('button', { name: 'Asignar SIMs' })
    expect(reassign.compareDocumentPosition(asignar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('hides "Reasignar SIMs" for a role without the permission', () => {
    renderPage()

    expect(screen.queryByRole('button', { name: 'Reasignar SIMs' })).not.toBeInTheDocument()
  })

  it('shows "Reasignar SIMs" via the explicit sim-custody:reassign permission alone', () => {
    vi.mocked(useAccess).mockReturnValue({ can: (perm: string) => perm === 'sim-custody:reassign' } as any)

    renderPage()

    expect(screen.getByRole('button', { name: 'Reasignar SIMs' })).toBeInTheDocument()
  })

  it('shows "Reasignar SIMs" for an ADMIN role even without the explicit permission', () => {
    vi.mocked(useAuth).mockReturnValue({ user: { role: 'ADMIN' }, staffInfo: null } as any)

    renderPage()

    expect(screen.getByRole('button', { name: 'Reasignar SIMs' })).toBeInTheDocument()
  })

  it('opens ReassignPromoterDialog when clicked', () => {
    vi.mocked(useAuth).mockReturnValue({ user: { role: 'OWNER' }, staffInfo: null } as any)

    renderPage()

    expect(screen.queryByTestId('reassign-dialog-open')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reasignar SIMs' }))
    expect(screen.getByTestId('reassign-dialog-open')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/playtelecom/Organization/__tests__/OrgStockControlPage.test.tsx`
Expected: FAIL — no button named "Reasignar SIMs" exists yet in `OrgStockControlPage.tsx`.

- [ ] **Step 3: Add the import**

In `src/pages/playtelecom/Organization/OrgStockControlPage.tsx`, find:

```tsx
import { AssignToSupervisorDialog } from './StockControl/components/AssignToSupervisorDialog'
import { OrgBulkUploadDialog } from './StockControl/components/OrgBulkUploadDialog'
```

Replace with:

```tsx
import { AssignToSupervisorDialog } from './StockControl/components/AssignToSupervisorDialog'
import { OrgBulkUploadDialog } from './StockControl/components/OrgBulkUploadDialog'
import { ReassignPromoterDialog } from './StockControl/components/ReassignPromoterDialog'
```

- [ ] **Step 4: Add state + permission gate**

Find:

```tsx
  const currentUserRole = staffInfo?.role ?? user?.role
  const isSuperOrOwner = currentUserRole === 'SUPERADMIN' || currentUserRole === 'OWNER'
  const canAssignToSupervisor = can('sim-custody:assign-to-supervisor') || can('inventory:org-manage') || isSuperOrOwner
```

Replace with:

```tsx
  const currentUserRole = staffInfo?.role ?? user?.role
  const isSuperOrOwner = currentUserRole === 'SUPERADMIN' || currentUserRole === 'OWNER'
  const isAdminOrAbove = ['SUPERADMIN', 'OWNER', 'ADMIN'].includes(currentUserRole ?? '')
  const canAssignToSupervisor = can('sim-custody:assign-to-supervisor') || can('inventory:org-manage') || isSuperOrOwner
  // Mirrors OrgDetalleSimsTab.tsx's canReassignPromoter exactly — same action, same door.
  const canReassignPromoter = can('sim-custody:reassign') || isAdminOrAbove
```

Find:

```tsx
  const [assignOpen, setAssignOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
```

Replace with:

```tsx
  const [assignOpen, setAssignOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)
```

- [ ] **Step 5: Add the button + dialog mount**

Find:

```tsx
          {canAssignToSupervisor && <Button onClick={() => setAssignOpen(true)}>Asignar SIMs</Button>}
        </div>
      </div>

      {orgId && canAssignToSupervisor && <AssignToSupervisorDialog open={assignOpen} onOpenChange={setAssignOpen} orgId={orgId} />}
```

Replace with:

```tsx
          {canReassignPromoter && (
            <Button variant="warning" onClick={() => setReassignOpen(true)}>
              Reasignar SIMs
            </Button>
          )}
          {canAssignToSupervisor && <Button onClick={() => setAssignOpen(true)}>Asignar SIMs</Button>}
        </div>
      </div>

      {orgId && canAssignToSupervisor && <AssignToSupervisorDialog open={assignOpen} onOpenChange={setAssignOpen} orgId={orgId} />}

      {orgId && canReassignPromoter && (
        <ReassignPromoterDialog open={reassignOpen} onOpenChange={setReassignOpen} orgId={orgId} />
      )}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/pages/playtelecom/Organization/__tests__/OrgStockControlPage.test.tsx`
Expected: PASS (all 5 test cases)

- [ ] **Step 7: Full regression check**

Run: `npm run test:run && npm run lint && npm run build`
Expected: all three pass with no new errors.

- [ ] **Step 8: Commit**

```bash
git add src/pages/playtelecom/Organization/OrgStockControlPage.tsx src/pages/playtelecom/Organization/__tests__/OrgStockControlPage.test.tsx
git commit -m "feat(playtelecom): add Reasignar SIMs header button to Control de Stock"
```

---

## Manual Verification (after both tasks land)

1. Run `npm run dev`, navigate to `/organizations/:orgId/stock-control` (or `/wl/organizations/:orgSlug/stock-control`) as an OWNER on a PlayTelecom-style org.
2. Confirm the orange `Reasignar SIMs` button renders immediately left of the black `Asignar SIMs` button — matches Isaac's mockup.
3. Click it → dialog opens on the "Buscar" tab, empty selection, promoter + SIM search both usable.
4. Complete a reassignment → confirm the same bulk-result summary UI as the existing tab-local `Reasignar a Promotor` button.
5. Toggle dark mode → confirm the orange reads correctly in both themes.
6. Log in as a role without `sim-custody:reassign` and below ADMIN (e.g. MANAGER) → confirm the button is absent.
