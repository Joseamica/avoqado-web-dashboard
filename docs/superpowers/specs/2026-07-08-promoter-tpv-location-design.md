# Ubicación de promotores (Supervisor) + Ubicación de TPVs (Org white-label)

**Fecha:** 2026-07-08
**Asana:** 1216095149541822 — "ADMIN y Supervisor tengan visibilidad de la geolocalización de un promotor"
**Repos afectados:** `avoqado-server` (autoritativo) + `avoqado-web-dashboard`. **NO** toca `avoqado-tpv`.
**Vertical:** PlayTelecom (white-label). Gating por módulo `WHITE_LABEL_DASHBOARD`, no por tier FREE/PRO/PREMIUM.

---

## 1. Contexto y problema

Los promotores de PlayTelecom venden SIMs Bait con una TPV PAX. Algunos ya no trabajan en
una tienda fija sino en "cambaceo" (venta ambulante en sitios públicos). Supervisores y OWNER
necesitan ver **dónde está** cada promotor / cada TPV.

**Lo que YA existe y funciona (verificado):**

- El TPV envía un ping de geolocalización **una vez por hora** (`PromoterLocationScheduler.kt`,
  `INTERVAL_MINUTES = 60`), gateado por: terminal activada **+** sesión iniciada **+** flag de
  servidor `venueSettings.trackPromoterLocation` **+** hora local del venue **11:00–17:59**.
  Fuente: triangulación celular/WiFi primero, fallback a GPS. Shipped en TPV v2.6.4 (2026-07-04).
- Modelo `PromoterLocationPing` (`prisma/schema.prisma`): `venueId`, `staffId`, `latitude`,
  `longitude`, `accuracy?`, `capturedAt`, `source` (`PERIODIC|CLOCK_IN|CLOCK_OUT`). Append-only,
  retención 90 días. **No tiene `terminalId`.**
- Lectura hoy: `GET /api/v1/dashboard/venues/:venueId/promoters/:promoterId/track?date=` →
  `{ points[], latest }` para **un** promotor / **un** venue / **un** día. Es puro REST (no hay
  WebSocket de ubicación).
- El serial de la terminal **ya viaja en el JWT del TPV** → disponible como
  `req.authContext.terminalSerialNumber` en el handler del ping. Otros endpoints (pagos, órdenes,
  heartbeat) ya lo resuelven a una `Terminal` vía `prisma.terminal.findFirst`.

**Brechas a cerrar:** (a) el ping no se atribuye a una terminal; (b) no hay endpoint org-wide de
"todas las ubicaciones"; (c) la UI no expone nada de esto de forma funcional (el
`PromoterLocationModal` del `PromotersAuditPage` es código muerto — su setter tiene prefijo `_` y
nunca se llama).

## 2. Decisiones tomadas (founder)

1. **"Tiempo real" = última ubicación conocida, refrescada cada hora.** Usamos el ping horario
   existente. La UI muestra timestamp relativo ("hace 12 min") + nota "se actualiza cada hora,
   11–18h". Sin cambios de TPV. **Prohibido** un badge "LIVE" o un punto que se mueva solo.
2. **Ambas vistas se llaman "Ubicación de TPVs" y son centradas en dispositivo.** Se muestra la
   ubicación de cada **TPV** (no por persona); el owner/supervisor ya sabe qué promotor trae cada
   TPV. Cada tarjeta: serial + promotor que la trae (del último ping) + última ubicación. Se
   atribuye el ping a la terminal con **cambio solo de servidor** (leer `terminalSerialNumber` del
   authContext). Difieren solo en **alcance**:
   - **Supervisor (pestaña):** solo las TPVs de los promotores que cuelgan de la custodia de SIMs de
     ese supervisor (venue-scoped).
   - **Org (sidebar):** todas las TPVs de todos los venues de la org.
3. **Gating de la página Org: sin featureCode, solo OWNER.** La cubre `OwnerProtectedRoute` que ya
   guarda `/wl/organizations/:orgSlug`. La pestaña Supervisor sigue bajo `SUPERVISOR_DASHBOARD`. El
   flag `trackPromoterLocation` (por venue) sigue siendo el master switch de captura.

## 3. No-goals (fuera de alcance)

- **Crear la tienda virtual "Cambaceo" y reasignar a Isela Chávez** — tarea de datos/ops aparte
  (receta add-venue). Follow-up separado.
- **Streaming verdadero en vivo** (WebSocket + foreground service en el PAX) — sobre-ingeniería.
- **Cadencia sub-hora** — requiere cambio de TPV + redeploy PAX (3-5 días). No ahora.
- **Mapa embebido con pines** — el MVP usa lista/tarjetas con clic → Google Maps (patrón actual).
- **Backfill de `terminalId` en pings históricos** — quedan `null`; solo pings nuevos se atribuyen.

## 4. Arquitectura

### 4.1 Backend — `avoqado-server`

**A. Migración Prisma.** Agregar a `PromoterLocationPing`:
- `terminalId String?`
- relación `terminal Terminal? @relation(fields: [terminalId], references: [id])`
- índice `@@index([terminalId, capturedAt])`

Nullable para no romper filas existentes ni pings donde el serial no resuelva a una `Terminal`.

**B. Atribución en ingesta.** En el handler de `POST /api/v1/tpv/geolocation/promoter-ping`
(`recordPromoterPing`): leer `req.authContext.terminalSerialNumber`, resolverlo a `terminalId`
reutilizando el lookup del heartbeat (`prisma.terminal.findFirst` con variantes `serialNumber`,
`'AVQD-'+serial`, `id`). Pasar `terminalId` (o `null`) a la creación del ping. Un solo punto de
escritura; no cambia el contrato con el TPV.

**C. Endpoint Supervisor (dispositivo, venue-scoped + custodia).**
`GET /api/v1/dashboard/venues/:venueId/supervisor/terminals-locations`
- Alcance de las terminales según rol del solicitante:
  - **MANAGER (supervisor):** terminales cuyo último ping pertenece a un promotor que cuelga de la
    custodia de SIMs de ese supervisor (vía servicio de sim-custody).
  - **ADMIN/OWNER/SUPERADMIN:** todas las terminales del venue.
- Para cada terminal: `serialNumber`, el `staff` (promotor) del último ping, y su `latest` ping
  (lat/lng/accuracy/capturedAt/source) o `null`.
- Respuesta: `{ terminals: [{ terminalId, serialNumber, promoter: {staffId,name}|null, latest: {lat,lng,accuracy,capturedAt} | null }], trackingEnabled: boolean }`.
- Gating white-label (`SUPERVISOR_DASHBOARD`) + rol MANAGER+.

**D. Endpoint Org (dispositivo).**
`GET /api/v1/dashboard/organizations/:orgId/terminals-locations`
- Para todos los venues de la org: última ubicación conocida **por `terminalId`** (agrupar
  `PromoterLocationPing` por terminal, tomar `capturedAt` máximo).
- Adjunta: `serialNumber`, `venue {id,name}`, y el `staff` (promotor) del último ping.
- Respuesta: `{ terminals: [{ terminalId, serialNumber, venue, promoter: {staffId,name}|null, latest: {lat,lng,accuracy,capturedAt} | null }] }`.
- Gating: OWNER de la org (mismo guard que el resto de `/organizations/:orgId`).

**E. MCP (regla crítica — mismo cambio).** Extender el tool `promoter_location` para cubrir el
alcance supervisor y agregar `terminal_location` (org-wide, device-centric) en
`avoqado-server/scripts/mcp/`.

### 4.2 Frontend — `avoqado-web-dashboard`

**F. Supervisor → pestaña "Ubicación de TPVs".** En `src/pages/playtelecom/Supervisor/SupervisorDashboard.tsx`:
- Agregar `'ubicacion'` a `VALID_TABS` (hash `#ubicacion`); label i18n
  `playtelecom:supervisor.tabs.ubicacion` = "Ubicación de TPVs" (es/en).
- `<TabsContent value="ubicacion">` con tabla centrada en dispositivo: **serial de TPV**, promotor
  que la trae, "última ubicación · hace X" + precisión (m), botón
  **"Ver en mapa" → `https://www.google.com/maps?q=lat,lng`**.
- Data: React Query al endpoint C con `refetchInterval: 60_000`.
- Si `trackingEnabled === false`: badge/aviso "Activar seguimiento" (no romper — solo informar).
- Estado vacío honesto: "Sin ubicación registrada hoy (se captura 11–18h)".

**G. Org → sección "Ubicación de TPVs".**
- `src/pages/organizations/components/WLOrgSidebar.tsx`: nuevo item en sección **Gestión**,
  icono `MapPin` de `lucide-react`, `href: ${basePath}/live-location`.
- Página nueva `src/pages/organizations/LiveLocation/LiveLocation.tsx` (default export; obtiene
  `orgId`/`basePath` de `useCurrentOrganization()`). Lista/tarjetas de TPVs: `serialNumber`, venue,
  promotor del último ping, "última ubicación · hace X", clic → Google Maps. `refetchInterval: 60_000`.
- Registrar en `src/routes/lazyComponents.ts` (`WLLiveLocation = lazyWithRetry(...)`) y en
  `src/routes/router.tsx` como hijo de `/wl/organizations/:orgSlug` → `{ path: 'live-location', element: <WLLiveLocation /> }`.
- **No** requiere `feature-registry.ts` (páginas org-internas white-label van por OWNER, no por featureCode).

**H. Etiquetado honesto (regla de badges del repo).** Componente/util compartido para render de
"última ubicación" con timestamp relativo vía `useVenueDateTime()` (nunca timezone del browser).
Tooltip/nota: "Actualización cada hora, 11:00–18:00 (hora del local)". Sin "LIVE".

## 5. Unidades y aislamiento

- `terminalId` en el ping = un solo punto de escritura (handler de ingesta). Lectura desacoplada.
- Endpoint C (persona) y D (dispositivo) son independientes; comparten el modelo pero distinto
  agrupamiento (por `staffId` vs por `terminalId`).
- Front: la pestaña Supervisor y la página Org no comparten componentes salvo el helper de
  "última ubicación" (H), que es puro/presentacional y testeable aislado.

## 6. Errores y bordes

- Promotor/terminal sin pings hoy → `latest: null` → UI muestra "Sin ubicación registrada".
- `trackPromoterLocation` apagado → sin datos; UI lo informa, no truena.
- Serial que no resuelve a `Terminal` → `terminalId = null`; el ping se guarda igual (no se pierde).
- Precisión pobre (celular/WiFi) → mostrar `accuracy` en metros para que el owner interprete.
- Zona horaria: SIEMPRE `useVenueDateTime()` en front y venue-local en server para el timestamp.

## 7. Pruebas

- **Server (unit/integration):** ingesta stampa `terminalId` correcto desde `terminalSerialNumber`
  (con y sin prefijo `AVQD-`, y serial inexistente → `null`); endpoint C devuelve solo promotores
  de la custodia del supervisor (MANAGER) vs todos (ADMIN/OWNER); endpoint D agrupa por terminal y
  toma el `capturedAt` máximo; gating de roles (403 correctos).
- **Front (E2E Playwright):** pestaña Promotores aparece y lista con "Ver en mapa"; página Org
  lista TPVs y el link a Google Maps es correcto; estados vacíos y `trackingEnabled=false`.
- **/full-testing** del cambio + auditoría (feedback estándar del founder).

## 8. Rollout (orden cross-repo)

1. Server: migración + ingesta + endpoints + MCP → develop (demo/staging) → verificar → main.
   **No requiere redeploy del PAX** (el TPV ya manda todo lo necesario).
2. Dashboard: pestaña + página + sidebar → develop → verificar → main.
3. Prod: activar `trackPromoterLocation` en los venues objetivo (incluye la TPV serie 2840744194
   del Asana).

## 9. Supuestos a validar en implementación

- **Nombre:** decidido → **"Ubicación de TPVs"** en ambas vistas (pestaña Supervisor + item de
  sidebar/ruta Org).
- **Query de custodia (default asumido):** "promotores en la custodia de un supervisor" =
  promotores que **actualmente** sostienen SIMs cuya custodia pertenece a ese supervisor (custodia
  activa, no histórico completo de assign-to-promoter). Validar contra el servicio real de
  sim-custody durante el plan; ajustar si el modelo expone mejor "histórico de asignaciones".
- **Terminal ↔ promotor en la vista Supervisor:** se decide por el `staffId` del **último** ping de
  cada terminal (¿ese promotor es de mi custodia?). Suficiente para el MVP; documentar el borde de
  una TPV compartida por varios promotores en el día.
