# Testing & Git Policy

## The Golden Rule: No Regressions

When you fix or implement something, you MUST NOT break something else. Before committing any change, verify: (1) new feature works, (2) existing features still work, (3) related features are unaffected.

## Pre-Deploy Checklist

Before pushing any changes:

- [ ] `npm run build` passes (TypeScript + Vite)
- [ ] `npm run lint` passes
- [ ] `npm run test:e2e` passes (Playwright E2E tests)
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
- **ONLY allowed Co-Authored-By**: `Claude Opus 4.6 (1M context) <noreply@anthropic.com>` — NEVER use `claude-flow`, `ruv@ruv.net`, or any other Co-Authored-By identity

## Temporary Files

If you create temp/debug scripts, prefix with `temp-` or `debug-` and delete before committing:

```
scripts/temp-check-venue.ts     # DELETE before commit
scripts/debug-permissions.ts    # DELETE before commit
```

## E2E Testing (Playwright)

Tests live in `e2e/tests/`. Mocks and fixtures in `e2e/fixtures/`.

```bash
npm run test:e2e        # Run all E2E tests headless
npm run test:e2e:ui     # Visual UI runner (interactive)
npm run test:e2e:debug  # Step-through debugger
```

- Tests use `page.route()` to mock API responses — no running backend needed
- Mock setup via `setupApiMocks(page, { userRole, venues, venueCount })` in `e2e/fixtures/api-mocks.ts`
- Playwright routes use **LIFO matching** — register catch-all first, specific routes last

### 🔴 Obligatorio: la prueba que faltaba el 2026-09-02

«Añade E2E del happy path» era demasiado vago y por eso no atrapó nada. Un supervisor de
PlayTelecom perdió una hora de operación con dos defectos que **compilaban, tenían el typecheck en
verde y devolvían 200 en el servidor**. Estas tres pruebas son obligatorias y NO son negociables por
ser «sólo UI»:

**1. Escribir y VER el resultado.** Toda mutación que cambia una lista necesita una prueba que
haga la acción y afirme que **la lista cambió sin recargar**. Es la única que caza una invalidación
de caché mal dirigida, que es **silenciosa**: no hay error, no hay warning, el servidor contesta 200
y la pantalla se queda vieja. El usuario cree que falló, reintenta, y el segundo intento sí falla.

```ts
await asignarSim(page, ICCID)
await expect(page.getByText('1 SIM asignado')).toBeVisible()
// 🔴 esto es la prueba, no el toast:
await expect(fila(page, ICCID)).toContainText('Con Promotor')
```

**2. Teclear en un buscador conserva el foco.** Si la búsqueda va al servidor, entra en la
`queryKey` y el componente corta con `if (isLoading) return`, cada tecla desmonta el `<Input>` y en
Android se cierra el teclado.

```ts
await buscador.fill('0851')
await expect(buscador).toBeFocused()
await expect(buscador).toHaveValue('0851')
```

**3. Los estados que no son el happy path.** Vacío, sin resultados y error se distinguen entre sí y
del cargando. Una lista vacía por un fallo de red que se ve igual que «no hay nada» es un reporte
falso al usuario.

**Cuándo aplica:** cualquier PR que toque un `queryKey`, un `invalidateQueries`, un buscador que
llegue al servidor, o que mueva una lista de un endpoint a otro. Si el PR cambia de dónde lee una
lista, la prueba 1 es la que autoriza el merge.

**Cuándo NO aplica:** cambios de copy, estilos, y páginas de sólo lectura sin buscador de servidor.

**Por qué E2E y no sólo vitest:** una prueba unitaria puede afirmar que las claves están bien
cableadas hoy; Playwright afirma lo que el usuario vive («asigné y la lista no cambió») sin importar
cómo esté cableado mañana. Las dos sirven; la que faltaba era ésta.

⚠️ **Su límite, declarado:** las E2E de este repo usan respuestas fingidas. Prueban el navegador,
no el servidor. No sustituyen verificar contra producción — y verificar en producción incluye
**ejecutar una acción que escriba y teclear en los buscadores**, no sólo abrir pantallas y cuadrar
totales. Ése fue exactamente el hueco ese día.

## Unused Code Detection

```bash
npm run check:unused      # Detect unimported files (fast)
npm run check:dead-code   # Comprehensive dead code analysis (slower)
npm run check:all         # Run both checks
```
