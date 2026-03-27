# Home Dashboard Redesign Plan

**Date**: 2026-03-27
**Status**: Phase 1 In Progress

## Problem

All KPI cards have equal visual weight. A restaurant owner can't find "how much did we make today" in 3 seconds. Header has too many controls. Payment pie chart is overbuilt for 2-3 slices. No narrative insights.

## Personas

| Persona | Role | First 3 seconds | Ignores |
|---------|------|-----------------|---------|
| Don Carlos (owner, 55, iPhone) | OWNER | Revenue today, up/down vs yesterday | AOV, SPLH, pie chart |
| Omar (telecom supervisor, 30) | MANAGER | Revenue + txns this week | Tips, kitchen, satisfaction |
| Luisa (restaurant manager, 35) | MANAGER | Today vs yesterday, shift status | 30-day trends, exports |

## Phase 1: Quick Wins (no backend changes)

1. **Hero KPI split** — `heroKpis[0]` renders as full-width large card (`text-4xl`), rest as secondary row
   - File: `DashboardMetrics.tsx`

2. **Default to "Today"** — Change `useState('7days')` to `useState('today')`
   - File: `useDashboardData.ts`

3. **Header simplification** — Already done (pills in segmented control, icon-only export)
   - File: `DashboardHeader.tsx`

4. **Reorder charts** — Best sellers + staff ranking as priority 1-2 in all packs
   - File: `registry.ts`

5. **Demote payment pie** — Move to lower priority in all packs
   - File: `registry.ts`

## Phase 2: Medium Effort (frontend only)

6. HeroMetricCard component (animated counter, sparkline, comparison badge)
7. Smart insights section (auto-generated from comparison data)
8. Mobile horizontal scroll for secondary KPIs
9. Collapsible "More analytics" for low-priority charts
10. Contextual empty states (no data today, new venue, error with auto-retry)

## Phase 3: Backend Changes

11. Role-aware dashboard filtering in `use-dashboard-pack.ts`
12. Shift-aware scoping (requires shift status from backend)
13. Daily goal/target progress bar (new venue setting)
14. Activity feed (WebSocket event stream)

## Key Files

- `src/components/home/sections/DashboardMetrics.tsx` — Hero KPI rendering
- `src/components/home/sections/DashboardHeader.tsx` — Header/filters
- `src/components/home/DashboardRenderer.tsx` — Layout engine
- `src/config/dashboard-engine/registry.ts` — Pack ordering
- `src/hooks/useDashboardData.ts` — Default filter state
- `src/hooks/use-dashboard-pack.ts` — Category resolution

## Benchmarks

- Stripe: One hero metric, sparklines, natural language summaries
- Square: Default to Today, shift context, goal progress bars
- Toast: Real-time feed, shift-based defaults, ranked lists over pie charts
- Shopify: Contextual insights, activity timeline, onboarding empty states
