# WL Organization Sidebar Section — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Organización" section to the WL sidebar with sub-sidebar navigation (same slide pattern as Ventas, Equipo, etc.), move the existing "Organizacional" tab content from TpvConfiguration into dedicated pages, and add a new "Asignación de Personal" page for staff↔store assignments.

**Architecture:** New sidebar trigger "Organización" (Building icon, OWNER+ only) opens a sub-sidebar with 4 items: Configuración TPV, Metas, Categorías, Mensajes. Each renders its existing Org* component as a standalone page. The "Organizacional" tab is removed from TpvConfiguration. A new "Asignación de Personal" page is added for future staff↔store management. All routes live under `/wl/venues/:slug/organization/*`.

**Tech Stack:** React 18, TypeScript, React Router v6, TanStack Query, Tailwind CSS, existing GlassCard/FullScreenModal components.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/pages/playtelecom/Organization/OrgConfigPage.tsx` | Standalone page wrapping `OrgTpvConfigSection` |
| Create | `src/pages/playtelecom/Organization/OrgGoalsPage.tsx` | Standalone page wrapping `OrgGoalConfigSection` |
| Create | `src/pages/playtelecom/Organization/OrgCategoriesPage.tsx` | Standalone page wrapping `OrgCategoryConfigSection` |
| Create | `src/pages/playtelecom/Organization/OrgMessagesPage.tsx` | Standalone page wrapping `OrgMessagesSection` |
| Create | `src/pages/playtelecom/Organization/StaffAssignmentPage.tsx` | New page — staff↔store assignment (MVP placeholder) |
| Create | `src/pages/playtelecom/Organization/index.ts` | Barrel exports |
| Modify | `src/components/Sidebar/app-sidebar.tsx` | Add "Organización" trigger + sub-sidebar section |
| Modify | `src/routes/lazyComponents.ts` | Add lazy imports for new pages |
| Modify | `src/routes/router.tsx` | Add `/organization/*` routes under WL playtelecom |
| Modify | `src/pages/playtelecom/TpvConfig/TpvConfiguration.tsx` | Remove "Organizacional" tab |
| Modify | `src/locales/es/sidebar.json` | Add sidebar translation keys |
| Modify | `src/locales/en/sidebar.json` | Add sidebar translation keys |

---

### Task 1: Add sidebar translations

**Files:**
- Modify: `src/locales/es/sidebar.json`
- Modify: `src/locales/en/sidebar.json`

- [ ] **Step 1: Add Spanish translations**

In `src/locales/es/sidebar.json`, add inside the root object (near the `playtelecom` section or at the end):

```json
"organizationMenu": {
  "title": "Organización",
  "config": "Configuración TPV",
  "goals": "Metas Organizacionales",
  "categories": "Categorías",
  "messages": "Mensajes",
  "staffAssignment": "Asignación de Personal"
}
```

- [ ] **Step 2: Add English translations**

In `src/locales/en/sidebar.json`, add the same keys:

```json
"organizationMenu": {
  "title": "Organization",
  "config": "TPV Configuration",
  "goals": "Organization Goals",
  "categories": "Categories",
  "messages": "Messages",
  "staffAssignment": "Staff Assignment"
}
```

- [ ] **Step 3: Commit**

```bash
git add src/locales/es/sidebar.json src/locales/en/sidebar.json
git commit -m "feat(wl): add organization sidebar translation keys"
```

---

### Task 2: Create standalone Organization pages

Each page is a thin wrapper that renders the existing Org* component as a standalone page with proper page title and spacing.

**Files:**
- Create: `src/pages/playtelecom/Organization/OrgConfigPage.tsx`
- Create: `src/pages/playtelecom/Organization/OrgGoalsPage.tsx`
- Create: `src/pages/playtelecom/Organization/OrgCategoriesPage.tsx`
- Create: `src/pages/playtelecom/Organization/OrgMessagesPage.tsx`
- Create: `src/pages/playtelecom/Organization/StaffAssignmentPage.tsx`
- Create: `src/pages/playtelecom/Organization/index.ts`

- [ ] **Step 1: Create OrgConfigPage.tsx**

```tsx
// src/pages/playtelecom/Organization/OrgConfigPage.tsx
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { OrgTpvConfigSection } from '../TpvConfig/components/OrgTpvConfigSection'

export default function OrgConfigPage() {
  return (
    <div className="space-y-6">
      <PageTitleWithInfo title="Configuración TPV Organizacional" />
      <OrgTpvConfigSection />
    </div>
  )
}
```

- [ ] **Step 2: Create OrgGoalsPage.tsx**

```tsx
// src/pages/playtelecom/Organization/OrgGoalsPage.tsx
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import OrgGoalConfigSection from '../Supervisor/OrgGoalConfigSection'

export default function OrgGoalsPage() {
  return (
    <div className="space-y-6">
      <PageTitleWithInfo title="Metas Organizacionales" />
      <OrgGoalConfigSection />
    </div>
  )
}
```

- [ ] **Step 3: Create OrgCategoriesPage.tsx**

```tsx
// src/pages/playtelecom/Organization/OrgCategoriesPage.tsx
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { OrgCategoryConfigSection } from '../TpvConfig/components/OrgCategoryConfigSection'

export default function OrgCategoriesPage() {
  return (
    <div className="space-y-6">
      <PageTitleWithInfo title="Categorías Organizacionales" />
      <OrgCategoryConfigSection />
    </div>
  )
}
```

- [ ] **Step 4: Create OrgMessagesPage.tsx**

```tsx
// src/pages/playtelecom/Organization/OrgMessagesPage.tsx
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { OrgMessagesSection } from '../TpvConfig/components/OrgMessagesSection'

export default function OrgMessagesPage() {
  return (
    <div className="space-y-6">
      <PageTitleWithInfo title="Mensajes Organizacionales" />
      <OrgMessagesSection />
    </div>
  )
}
```

- [ ] **Step 5: Create StaffAssignmentPage.tsx (MVP placeholder)**

```tsx
// src/pages/playtelecom/Organization/StaffAssignmentPage.tsx
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'

export default function StaffAssignmentPage() {
  return (
    <div className="space-y-6">
      <PageTitleWithInfo title="Asignación de Personal" />
      <GlassCard className="p-8 text-center">
        <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
        <h3 className="text-lg font-semibold mb-2">Asignación de Personal a Tiendas</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Reasigna promotores y supervisores entre tiendas de forma ágil.
        </p>
        <Badge variant="outline">Muy pronto</Badge>
      </GlassCard>
    </div>
  )
}
```

- [ ] **Step 6: Create barrel export index.ts**

```tsx
// src/pages/playtelecom/Organization/index.ts
export { default as OrgConfigPage } from './OrgConfigPage'
export { default as OrgGoalsPage } from './OrgGoalsPage'
export { default as OrgCategoriesPage } from './OrgCategoriesPage'
export { default as OrgMessagesPage } from './OrgMessagesPage'
export { default as StaffAssignmentPage } from './StaffAssignmentPage'
```

- [ ] **Step 7: Verify imports resolve**

Check that the imported Org* components are exported from their files. Run:

```bash
grep -n "export" src/pages/playtelecom/TpvConfig/components/OrgTpvConfigSection.tsx | head -3
grep -n "export" src/pages/playtelecom/TpvConfig/components/OrgCategoryConfigSection.tsx | head -3
grep -n "export" src/pages/playtelecom/TpvConfig/components/OrgMessagesSection.tsx | head -3
grep -n "export" src/pages/playtelecom/Supervisor/OrgGoalConfigSection.tsx | head -3
```

If any component uses `export default` instead of named export, adjust the import in the corresponding page to match (e.g., `import OrgGoalConfigSection from ...` instead of `import { OrgGoalConfigSection } from ...`).

- [ ] **Step 8: Commit**

```bash
git add src/pages/playtelecom/Organization/
git commit -m "feat(wl): create standalone Organization pages wrapping existing Org components"
```

---

### Task 3: Add lazy imports and routes

**Files:**
- Modify: `src/routes/lazyComponents.ts`
- Modify: `src/routes/router.tsx`

- [ ] **Step 1: Add lazy imports in lazyComponents.ts**

After the `PlayTelecomReporte` line (~line 229), add:

```typescript
// Organization pages (WL OWNER-only)
export const PlayTelecomOrgConfig = lazyWithRetry(() => import('@/pages/playtelecom/Organization/OrgConfigPage'))
export const PlayTelecomOrgGoals = lazyWithRetry(() => import('@/pages/playtelecom/Organization/OrgGoalsPage'))
export const PlayTelecomOrgCategories = lazyWithRetry(() => import('@/pages/playtelecom/Organization/OrgCategoriesPage'))
export const PlayTelecomOrgMessages = lazyWithRetry(() => import('@/pages/playtelecom/Organization/OrgMessagesPage'))
export const PlayTelecomStaffAssignment = lazyWithRetry(() => import('@/pages/playtelecom/Organization/StaffAssignmentPage'))
```

- [ ] **Step 2: Import new components in router.tsx**

Add the new imports to the existing destructuring from `lazyComponents`:

```typescript
PlayTelecomOrgConfig,
PlayTelecomOrgGoals,
PlayTelecomOrgCategories,
PlayTelecomOrgMessages,
PlayTelecomStaffAssignment,
```

- [ ] **Step 3: Add organization routes in router.tsx**

In **both** the `/venues/:slug/playtelecom` and `/wl/venues/:slug/playtelecom` route blocks, add the organization routes. After the `reporte` route (~line 624 for venues, ~line 753 for /wl/), add:

```tsx
// Organization pages (OWNER+ only)
{
  path: 'organization',
  element: (
    <ModuleProtectedRoute
      requiredModule="SERIALIZED_INVENTORY"
      allowedRoles={[StaffRole.OWNER, StaffRole.SUPERADMIN]}
    />
  ),
  children: [
    { index: true, element: <PlayTelecomOrgConfig /> },
    { path: 'goals', element: <PlayTelecomOrgGoals /> },
    { path: 'categories', element: <PlayTelecomOrgCategories /> },
    { path: 'messages', element: <PlayTelecomOrgMessages /> },
    { path: 'staff-assignment', element: <PlayTelecomStaffAssignment /> },
  ],
},
```

- [ ] **Step 4: Verify build compiles**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes/lazyComponents.ts src/routes/router.tsx
git commit -m "feat(wl): add organization routes under /playtelecom/organization/*"
```

---

### Task 4: Add "Organización" to sidebar with sub-sidebar

**Files:**
- Modify: `src/components/Sidebar/app-sidebar.tsx`

- [ ] **Step 1: Add Building icon import**

In the lucide-react imports at the top of `app-sidebar.tsx`, add `Building` to the import:

```typescript
import { Building } from 'lucide-react'
```

(If `Building` is already imported, skip this step.)

- [ ] **Step 2: Add organization sub-items definition**

Inside the `navMain` useMemo (after the `settingsSubItems` definition, ~line 491), add:

```typescript
// ── Organización (OWNER+ only, WL only) ──
const organizationSubItems = (isWhiteLabelVenue && ['OWNER', 'SUPERADMIN'].includes(effectiveRole)) ? [
  { title: t('sidebar:organizationMenu.config', { defaultValue: 'Configuración TPV' }), url: `${wlBasePath}/playtelecom/organization`, keywords: ['config', 'tpv', 'modulos'] },
  { title: t('sidebar:organizationMenu.goals', { defaultValue: 'Metas Organizacionales' }), url: `${wlBasePath}/playtelecom/organization/goals`, keywords: ['metas', 'objetivos', 'goals'] },
  { title: t('sidebar:organizationMenu.categories', { defaultValue: 'Categorías' }), url: `${wlBasePath}/playtelecom/organization/categories`, keywords: ['categorias', 'productos'] },
  { title: t('sidebar:organizationMenu.messages', { defaultValue: 'Mensajes' }), url: `${wlBasePath}/playtelecom/organization/messages`, keywords: ['mensajes', 'broadcast', 'comunicados'] },
  { title: t('sidebar:organizationMenu.staffAssignment', { defaultValue: 'Asignación de Personal' }), url: `${wlBasePath}/playtelecom/organization/staff-assignment`, comingSoon: true, keywords: ['asignar', 'promotores', 'tiendas', 'personal'] },
] as any[] : []
```

- [ ] **Step 3: Add "Organización" trigger to mainItems**

After the "Configuracion" block (~line 578), before the `isAvoqadoCore` marking block (~line 582), add:

```typescript
// Organización (OWNER+ only, WL only)
if (organizationSubItems.length > 0) {
  mainItems.push({
    title: t('sidebar:organizationMenu.title', { defaultValue: 'Organización' }),
    url: '#organization',
    icon: Building,
    subSidebar: 'organization',
    keywords: ['organizacion', 'org', 'empresa'],
  })
}
```

- [ ] **Step 4: Register sub-sidebar section**

In the `allSubSidebarSections` block (~line 597), add:

```typescript
if (organizationSubItems.length > 0) allSubSidebarSections.organization = organizationSubItems
```

- [ ] **Step 5: Verify build compiles**

```bash
npm run build
```

Expected: Build succeeds. The "Organización" item should appear in the sidebar for OWNER+ users in WL venues.

- [ ] **Step 6: Commit**

```bash
git add src/components/Sidebar/app-sidebar.tsx
git commit -m "feat(wl): add Organización section to sidebar with sub-sidebar navigation"
```

---

### Task 5: Remove "Organizacional" tab from TpvConfiguration

**Files:**
- Modify: `src/pages/playtelecom/TpvConfig/TpvConfiguration.tsx`

- [ ] **Step 1: Remove 'organizacional' from VALID_TABS**

Change line ~70 from:

```typescript
const VALID_TABS = ['general', 'organizacional', 'metas', 'tpv', 'categorias', 'mensajes'] as const
```

To:

```typescript
const VALID_TABS = ['general', 'metas', 'tpv', 'categorias', 'mensajes'] as const
```

- [ ] **Step 2: Remove the Organizacional tab button**

Remove the block at ~lines 436-452 that renders the "Organizacional" tab button. This is the `{isOwnerPlus && ( ... )}` block containing the separator `<div className="w-px h-5 bg-border mx-1" />` and the `organizacional` button.

- [ ] **Step 3: Remove the Organizacional TabsContent**

Remove the block at ~lines 660-668:

```tsx
{/* Organizacional Tab — OWNER+ only */}
{isOwnerPlus && (
  <TabsContent value="organizacional" className="space-y-6">
    <OrgTpvConfigSection />
    <OrgGoalConfigSection />
    <OrgCategoryConfigSection />
    <OrgMessagesSection />
  </TabsContent>
)}
```

- [ ] **Step 4: Clean up unused imports**

If `OrgTpvConfigSection`, `OrgGoalConfigSection`, `OrgCategoryConfigSection`, or `OrgMessagesSection` are no longer imported elsewhere in this file, remove their import statements. Also remove `isOwnerPlus` if it's no longer referenced (check if it's used elsewhere in the file first).

- [ ] **Step 5: Verify build compiles**

```bash
npm run build
```

Expected: Build succeeds. The "Configuración" page now shows only: General, Metas, TPV, Categorías, Mensajes.

- [ ] **Step 6: Commit**

```bash
git add src/pages/playtelecom/TpvConfig/TpvConfiguration.tsx
git commit -m "refactor(wl): remove Organizacional tab from TpvConfiguration — moved to sidebar section"
```

---

### Task 6: Verify full flow and visual test

**Files:** None (testing only)

- [ ] **Step 1: Run build**

```bash
npm run build
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

- [ ] **Step 3: Start dev server and test**

```bash
npm run dev
```

Manual verification checklist:
1. Login as OWNER to a PlayTelecom WL venue
2. Sidebar shows "Organización" item with `>` chevron (after Configuración)
3. Clicking "Organización" slides to sub-sidebar with 5 items
4. "Configuración TPV" renders `OrgTpvConfigSection`
5. "Metas Organizacionales" renders `OrgGoalConfigSection`
6. "Categorías" renders `OrgCategoryConfigSection`
7. "Mensajes" renders `OrgMessagesSection`
8. "Asignación de Personal" shows "Muy pronto" badge placeholder
9. "Configuración" page no longer shows "Organizacional" tab
10. Login as MANAGER — "Organización" does NOT appear in sidebar
11. Test in dark mode

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(wl): address visual/functional issues from organization sidebar testing"
```

---

## Summary

| Task | Description | Estimated |
|------|-------------|-----------|
| 1 | Sidebar translations (es/en) | 2 min |
| 2 | Create 5 standalone pages + barrel | 10 min |
| 3 | Lazy imports + routes | 5 min |
| 4 | Sidebar trigger + sub-sidebar | 5 min |
| 5 | Remove Organizacional tab | 5 min |
| 6 | Full verification | 5 min |
| **Total** | | **~30 min** |
