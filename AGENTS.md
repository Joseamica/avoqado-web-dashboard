# AGENTS.md — Avoqado Web Dashboard

Agent roles for multi-agent workflows. Each role defines scope, context to load, and role-specific focus areas.

**Shared context**: All agents auto-load `.claude/rules/*.md`. Additional context listed per role.

---

## Frontend Developer

**Scope**: Feature implementation, new pages, API integration, forms, data tables.

**Context to load**:
- `docs/architecture/overview.md` — tech stack, data models
- `docs/architecture/routing.md` — route protection layers
- `docs/architecture/permissions.md` — permission gates
- `docs/features/i18n.md` — translation system

**Focus**:
- Use TanStack Query for all data fetching with proper cache invalidation
- Forms: React Hook Form + Zod validation
- Route protection: `PermissionProtectedRoute` for page-level, `PermissionGate` for element-level
- White-label: always use `fullBasePath` from `useCurrentVenue()`
- Feature Registry: add new pages to `src/config/feature-registry.ts` when applicable

---

## UI/Design Specialist

**Scope**: Components, design system compliance, accessibility, visual polish.

**Context to load**:
- `docs/guides/DESIGN_SYSTEM_GUIDE.md` — GlassCard, StatusPulse, MetricCard, Bento grid
- `docs/guides/ui-patterns.md` — icon selections, horizontal nav
- `docs/features/theme.md` — semantic color tokens

**Focus**:
- Follow mandatory UI patterns: pill tabs, Stripe filters, expandable search, FullScreenModal
- Superadmin gradient (`from-amber-400 to-pink-500`) for superadmin-only elements in `/dashboard/`
- Cursor pointer on all icon buttons (especially in Tooltip wrappers)
- Clickable selection rows: entire row clickable, not just checkbox
- All colors must be theme-aware (no hardcoded grays)

---

## Performance Engineer

**Scope**: Lazy loading, memoization, code splitting, render optimization.

**Context to load**:
- `docs/guides/performance.md` — React performance patterns
- `docs/troubleshooting/render-loops.md` — infinite re-render debugging

**Focus**:
- `useMemo` for ALL filtered/mapped/sorted arrays passed to DataTable
- `useCallback` for search handlers and event callbacks
- `useDebounce(searchTerm, 300)` for search inputs triggering API calls
- Superadmin code: dynamic `import()` + `enabled: isSuperadmin` on queries
- Column definitions: memoize with `useMemo`

---

## i18n Specialist

**Scope**: Translations, namespaces, locale-aware formatting.

**Context to load**:
- `docs/features/i18n.md` — translation system with JSON namespaces
- `src/locales/` — existing translation files

**Focus**:
- JSON-based architecture: `src/locales/[en|es|fr]/[namespace].json`
- All text uses `t()` from `useTranslation('namespace')`
- Both `en` and `es` translations required (match all keys)
- Use interpolation and pluralization, never string concatenation
- Namespace per feature (50+ keys), common strings in `common.json`
- Superadmin screens (`src/pages/Superadmin/**`) are exempt — hardcoded Spanish

---

## Code Reviewer

**Scope**: Quality checks, regression prevention, rule compliance.

**Focus**:
- Verify all 10 critical rules from CLAUDE.md are followed
- Check i18n completeness (no hardcoded strings, both languages)
- Check theme compliance (no `bg-gray-*` or `text-gray-*`)
- Check permissions sync between frontend `can()` and backend `verifyAccess()`
- Check memoization of DataTable props
- Check timezone handling uses `useVenueDateTime()`, not `new Date().toLocale*()`
- Verify `npm run build` and `npm run lint` pass
- Test with VIEWER, WAITER, MANAGER, OWNER roles
