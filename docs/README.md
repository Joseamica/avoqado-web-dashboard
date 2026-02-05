# Avoqado Dashboard Documentation

> **Frontend-specific documentation only.**
>
> For cross-repo docs (architecture, features, payments): See [`avoqado-server/docs/`](../../avoqado-server/docs/README.md)

---

## Quick Reference

- [Quick Reference Guide](./quick-reference.md) - Commands, critical rules, common patterns

---

## Architecture

| Document | Description |
|----------|-------------|
| [overview.md](./architecture/overview.md) | Dashboard tech stack, data models, component guidelines |
| [routing.md](./architecture/routing.md) | React Router protection layers, navigation patterns |
| [permissions.md](./architecture/permissions.md) | Frontend permission gates, UI access control |

---

## Features

| Document | Description |
|----------|-------------|
| [i18n.md](./features/i18n.md) | Internationalization with JSON namespaces |
| [theme.md](./features/theme.md) | Light/dark mode with semantic colors |
| [inventory.md](./features/inventory.md) | Inventory UI components and pages |

---

## Guides

| Document | Description |
|----------|-------------|
| [ui-patterns.md](./guides/ui-patterns.md) | Icon selections, horizontal nav, common patterns |
| [performance.md](./guides/performance.md) | React performance, memoization |
| [DESIGN_SYSTEM_GUIDE.md](./guides/DESIGN_SYSTEM_GUIDE.md) | GlassCard, StatusPulse, MetricCard, Bento grid |
| [TIMEZONE_GUIDE.md](./guides/TIMEZONE_GUIDE.md) | Venue timezone handling (Luxon, currency, backend sync) |
| [REALTIME_GUIDE.md](./guides/REALTIME_GUIDE.md) | Socket.IO events, hooks, room management |

---

## Troubleshooting

| Document | Description |
|----------|-------------|
| [render-loops.md](./troubleshooting/render-loops.md) | Debug infinite re-renders |

---

## Design System

| Document | Description |
|----------|-------------|
| [DESIGN_AGENT.md](./DESIGN_AGENT.md) | Design agent configuration |
| [DESIGN_AGENT_EXAMPLES.md](./DESIGN_AGENT_EXAMPLES.md) | Design examples |
| [AVOQADO_DESIGN_QUICK_REF.md](./AVOQADO_DESIGN_QUICK_REF.md) | Design quick reference |

---

## Cross-Repo Documentation

For features that span multiple repos, see the central documentation hub:

| Topic | Location |
|-------|----------|
| Architecture & DB | [`avoqado-server/docs/ARCHITECTURE_OVERVIEW.md`](../../avoqado-server/docs/ARCHITECTURE_OVERVIEW.md) |
| Business Types & MCC | [`avoqado-server/docs/BUSINESS_TYPES.md`](../../avoqado-server/docs/BUSINESS_TYPES.md) |
| Payment Architecture | [`avoqado-server/docs/PAYMENT_ARCHITECTURE.md`](../../avoqado-server/docs/PAYMENT_ARCHITECTURE.md) |
| Blumon Integration | [`avoqado-server/docs/BLUMON_TWO_INTEGRATIONS.md`](../../avoqado-server/docs/BLUMON_TWO_INTEGRATIONS.md) |
| Permissions (Backend) | [`avoqado-server/docs/PERMISSIONS_SYSTEM.md`](../../avoqado-server/docs/PERMISSIONS_SYSTEM.md) |
| Inventory (Backend) | [`avoqado-server/docs/INVENTORY_REFERENCE.md`](../../avoqado-server/docs/INVENTORY_REFERENCE.md) |
| Settlement Incidents | [`avoqado-server/docs/features/SETTLEMENT_INCIDENTS.md`](../../avoqado-server/docs/features/SETTLEMENT_INCIDENTS.md) |

---

## Archive

Completed plans and one-time analyses are stored in [`_archive/`](./_archive/). These are kept for reference but are no longer actively maintained.

---

**Last Updated:** 2026-02-05
