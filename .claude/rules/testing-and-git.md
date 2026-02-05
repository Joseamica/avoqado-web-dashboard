# Testing & Git Policy

## The Golden Rule: No Regressions

When you fix or implement something, you MUST NOT break something else. Before committing any change, verify: (1) new feature works, (2) existing features still work, (3) related features are unaffected.

## Pre-Deploy Checklist

Before pushing any changes:

- [ ] `npm run build` passes (TypeScript + Vite)
- [ ] `npm run lint` passes
- [ ] All user-facing text uses `t('...')` with en + es translations
- [ ] Arrays/objects passed to DataTable are memoized
- [ ] Theme-aware colors used (no hardcoded grays)
- [ ] Tested in both light and dark modes
- [ ] Tested with multiple roles: VIEWER, WAITER, MANAGER, OWNER
- [ ] No React warnings in console
- [ ] Permissions synced between frontend and backend

## Role Testing

Always verify features work correctly across roles:

| Role | Access Level |
|------|-------------|
| VIEWER | Read-only |
| HOST | Customer-facing |
| WAITER | Order management |
| CASHIER | Payment processing |
| KITCHEN | Kitchen operations |
| MANAGER | Staff management |
| ADMIN | Venue configuration |
| OWNER | Full venue access |
| SUPERADMIN | System-wide access |

## Git Policy

- **Never commit without explicit user permission**
- **Never kill or restart dev servers manually** — Vite and nodemon auto-reload on file save
- **Never use `pkill`, `kill`, or restart commands** on dev servers
- Include `Co-Authored-By` when AI assists with commits

## Temporary Files

If you create temp/debug scripts, prefix with `temp-` or `debug-` and delete before committing:

```
scripts/temp-check-venue.ts     # DELETE before commit
scripts/debug-permissions.ts    # DELETE before commit
```

## Unused Code Detection

```bash
npm run check:unused      # Detect unimported files (fast)
npm run check:dead-code   # Comprehensive dead code analysis (slower)
npm run check:all         # Run both checks
```
