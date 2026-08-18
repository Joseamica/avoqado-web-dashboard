# AGENTS.md — Avoqado Web Dashboard

Agent roles for multi-agent workflows. Each role defines scope, context to load, and role-specific focus areas.

**Shared context**: All agents auto-load `.claude/rules/*.md`. Additional context listed per role.

---

## 🔴 Antes de construir: tier + activación (dos decisiones, no una)

Este archivo NO reemplaza al `CLAUDE.md` de este repo — léelo. Lo que más se rompe si lo saltas:

- **Tier** ("¿lo pagó?") y **activación** ("¿lo quiere prendido?") son ejes DISTINTOS: se componen con AND.
- Un switch se justifica **solo** si puedes nombrar dos clientes reales que quieran lo contrario. Si no, es
  comportamiento core y va **sin** toggle — la app no se construye por toggles.
- El switch canónico vive en `avoqado-web-dashboard`. 🔴 **Nunca solo un `UPDATE` en Postgres.**
- El default ON/OFF lo decides tú midiendo el riesgo; pregunta al founder solo si toca dinero, fiscal,
  permisos, stock o algo irreversible (ahí el default es OFF).
- 🔴 **Apagado se VE y se EXPLICA** — nunca desaparecer en silencio.

Regla completa: `avoqado-server/.claude/rules/feature-gating.md` · cross-repo: `CLAUDE.md` del workspace.

## Entorno: varias sesiones de IA trabajan en paralelo (contexto, no un bloqueo)

Casi siempre hay 2+ agentes editando este workspace al mismo tiempo. Es lo normal: **no es una
anomalía, no es motivo para detenerte, preguntar ni "arreglar" nada.** Solo cambia cómo interpretas
lo que ves:

- **Archivos modificados que tú no tocaste** en `git status` / `git diff` = WIP de otra sesión. Normal.
- 🔴 **Nunca** `git reset --hard`, `git checkout .`, `git clean`, `git stash` ni cambies de rama "para
  dejar limpio": el árbol de trabajo es compartido y eso sí destruye trabajo ajeno irrecuperable.
  Es la única regla dura de esta sección.
- **Commitea por rutas explícitas** (`git add <ruta>`), nunca `git add -A` / `git add .`. Si aun así
  se cuela WIP ajeno en tu commit, **no es grave**: no lo reviertas ni lo reescribas — dilo en el reporte.
- **Ruido que no viene de tu cambio**: el dev server hace hot-reload o se reinicia solo, un test/build
  truena en un archivo que no tocaste, un puerto ocupado. Verifica con `git diff <archivo>`: si ese
  cambio no es tuyo, **no lo debuggees ni lo corrijas** — reintenta una vez y, si sigue, anótalo en el
  reporte y continúa con lo tuyo.
- **No mates procesos, servidores, emuladores ni daemons de build que no arrancaste tú**, ni reinicies
  o borres bases de datos locales: otras sesiones están usándolas.
- Si un `Edit` falla porque el archivo cambió debajo de ti, relee y reaplica. Sin drama.
- ¿Quién más está adentro? MCP **Huella**: `quien_trabaja(repo)` y `actividad_reciente(repo)`.

**Asume concurrencia, no conflicto. Sigue programando.**

## Verificar sí; cuánto verificar lo decide la máquina

Esta Mac (10 núcleos / 32 GB) está compartida con las demás sesiones y vive cerca del límite.

**Pasan por el chequeo de capacidad, y SOLO estas:** `./gradlew assemble*` / `bundle*`, `xcodebuild`,
la suite de tests completa, el typecheck de todo el monorepo.
**No pasan nunca — se corren siempre, aunque la máquina esté saturada:** typecheck o build de UN
proyecto, UN archivo de test, lint. Cuestan segundos: la carga NO es excusa para saltárselos.

```bash
sysctl -n hw.ncpu vm.loadavg   # núcleos y { 1min 5min 15min }
sysctl -n vm.swapusage         # 'free' es la señal que más importa
pgrep -fl "GradleDaemon|KotlinCompileDaemon|xcodebuild|jest|vitest|tsc" | head
```

- **Si swap `free` < 2 GB, o load de 1 min > 2× núcleos, o ya hay un build ajeno corriendo: no arranques.**
  Adelanta lo que no dependa de eso y reintenta (cada ~2 min, tope ~10 min). Si sigue saturado, corre la
  verificación corta y reporta la larga como pendiente — no te quedes esperando indefinidamente.
- **Nunca dos builds pesados a la vez**: dos daemons de Kotlin a `-Xmx6g` tumban la máquina.
- Única excepción a "no mates procesos ajenos": si `pgrep` no muestra ningún build activo,
  `./gradlew --stop` libera daemons ociosos (4–6 GB cada uno, viven 2 h sin usarse) — dilo en el reporte.
  Los servidores de dev, emuladores y bases de datos NO se tocan.
- Si el typecheck pelón (`npx tsc --noEmit`) revienta por memoria, usa el script del repo (`npm run build`).

**La carga nunca compra "no lo verifiqué" — compra "lo verifiqué en corto".** Si cambiaste código, se
comprueba antes de decir que está listo. Lo que la máquina decide es el *tamaño*: typecheck solo del
proyecto tocado, el archivo de test en vez de la suite completa, `assembleDebug` en vez de
`assembleRelease`. **Lo que difieras va explícito en el reporte, con el comando exacto para correrlo.**
Un "listo" que esconde lo que no se corrió es un reporte falso.

| Qué tocaste | Mínimo obligatorio |
|---|---|
| Dinero, fechas/timezone, tiers, permisos, stock, pagos/reembolsos, migraciones de datos | **Test primero (TDD)** + suite del módulo. No negociable: esto no se difiere ni con la máquina en llamas. |
| Cualquier otro código | Que compile / typechee el proyecto tocado. Un cambio que no compila no es un cambio. |
| Cambio amplio, o antes de commitear/lanzar | Suite completa + build completo. Aquí sí se espera capacidad. |
| Markdown, docs, comentarios, copy sin lógica | Nada. |

"No era importante" es una conclusión que se justifica en el reporte, no un default. Si dudas, córrelo.

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
- Canonical WL venue routes: generate and navigate only with `/wl/venues/:slug` (never `/wl/:slug`)
- For venue-level guards, use effective venue role (`staffInfo.role` / `useAccess().role`) over raw `user.role`
- Feature Registry: add new pages to `src/config/feature-registry.ts` when applicable

---

## UI/Design Specialist

**Scope**: Components, design system compliance, accessibility, visual polish.

**Context to load**:
- `docs/guides/DESIGN_SYSTEM_GUIDE.md` — GlassCard, StatusPulse, MetricCard, Bento grid
- `docs/guides/ui-patterns.md` — icon selections, horizontal nav
- `docs/features/theme.md` — semantic color tokens
- `docs/guides/onboarding-tours.md` — interactive `driver.js` tours

**Focus**:
- Follow mandatory UI patterns: pill tabs, Stripe filters, expandable search, FullScreenModal
- Superadmin gradient (`from-amber-400 to-pink-500`) for superadmin-only elements in `/dashboard/`
- Cursor pointer on all icon buttons (especially in Tooltip wrappers)
- Clickable selection rows: entire row clickable, not just checkbox
- All colors must be theme-aware (no hardcoded grays)
- **Interactive tours (`driver.js`)**: every new primary CTA, every new wizard field, every new form section MUST get a stable `data-tour="<key>"` attribute so an onboarding tour can target it. Key convention: `kebab-case`, scoped (e.g. `product-wizard-name`, `order-payment-submit`). Never couple tours to CSS classes or IDs. See `docs/guides/onboarding-tours.md`.

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
- Check auth invariants: `SUPERADMIN` has global access to all orgs/venues/features/modules
- Check auth invariants: `OWNER` scope is only organizations where user is OWNER (not global across all orgs)
- Check auth invariants: KYC redirects resolve to venue-scoped `kyc-required` route in both `/venues/:slug/*` and `/wl/venues/:slug/*`
- Check auth invariants: White-label canonical path stays `/wl/venues/:slug/*` across hooks, router and redirects
- Check memoization of DataTable props
- Check timezone handling uses `useVenueDateTime()`, not `new Date().toLocale*()`
- Verify `npm run build` and `npm run lint` pass
- Test with VIEWER, WAITER, MANAGER, OWNER roles

## 🔴 Cómo hablarle al founder

Regla completa en `~/.claude/CLAUDE.md` (aplica a todos sus proyectos) y en
`Avoqado/.claude/rules/como-hablarle-al-founder.md`.

- **Cuando le pidas una opinión o le hagas una pregunta: explícale FÁCIL.** Analogías antes que
  jerga, y **diagrama** (`mcp__visualize__show_widget`) siempre que sean dos caminos, dos
  mecanismos, un flujo o un antes/después. Una pregunta a la vez, opciones cortas, la consecuencia
  de cada una en una línea.
- **Las respuestas largas están bien** — le sirve que razones y no adivines.
- 🔴 **SIEMPRE cierra con 2-3 líneas en lenguaje llano**: qué pasó, qué significa para él, y qué
  necesitas de él. Sin ese cierre, el contenido puede ser correcto y aun así no llegarle.

