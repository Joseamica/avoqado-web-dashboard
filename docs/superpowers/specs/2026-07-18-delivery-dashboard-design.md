# Delivery en el Dashboard — Diseño (teaser + panel + solicitud de activación)

**Fecha:** 2026-07-18
**Estado:** Aprobado por founder (diseño); pendiente credenciales de staging de Deliverect para el go-live real.
**Repos:** `avoqado-web-dashboard` (grueso) + `avoqado-server` (pieza nueva chica: modelo/endpoints de solicitud).

## 1. Contexto y objetivo

El backend de delivery-channels (Deliverect como adapter #1) ya está construido y commiteado en `avoqado-server` (9 commits, `2f8be09c..8374c949`): feature PREMIUM `DELIVERY_CHANNELS`, ingesta de pedidos → Order/Payment, endpoints CRUD de canales (`GET/POST /venues/:venueId/channels`, `PATCH`, `pause`), MCP tool `delivery_channels`. Spec backend: `avoqado-server/docs/superpowers/specs/2026-07-18-delivery-channels-design.md`.

Falta la experiencia en el dashboard. El delivery **todavía no funciona** (falta que Deliverect emita credenciales de staging + certificación), así que la meta es: **teaser PREMIUM honesto visible YA, con el vertical completo construido y listo para encender solo cuando un venue quede conectado** — sin flags manuales, sin redeploys, sin promesa falsa.

Principio rector: **"readiness = dato"**. El estado que ve el dueño se deriva de datos reales (tiene el feature / tiene solicitud / tiene canal ACTIVE), no de una bandera. Cuando ops conecta un venue a Deliverect y su canal queda ACTIVE, el dashboard de ese venue se prende automáticamente.

## 2. Decisiones de producto (founder, 2026-07-18)

| Decisión | Valor |
|---|---|
| Quién conecta un canal | **Ops/superadmin** (requiere coordinar location ID + webhookSecret con Deliverect — no self-serve). El dueño **solicita** y luego **opera**. |
| Onboarding del dueño | Botón **"Solicitar activación"** self-serve → crea una solicitud que entra a la cola de ops. Autoservicio en la INTENCIÓN, ops en la CONEXIÓN. |
| Página en vivo | Estado + controles operativos (pausar canal, modo auto-accept) + **tira de stats por canal** + tabla de pedidos **reutilizando** el componente de órdenes filtrado a delivery. |
| Órdenes/Pagos generales | Los pedidos de delivery ya entran como Order/Payment normales → aparecen solos; se les agrega un **badge de canal** (Uber/Rappi/DiDi) en la fila. |
| Panel de delivery dedicado (feed en vivo, SLAs por canal) | **Fast-follow** — se construye cuando haya volumen real que lo moldee, NO especulativo. |
| Readiness | **Data-driven** (feature + solicitud + canal ACTIVE), cero flags. |

## 3. Los 4 estados de la página de Delivery

La página resuelve UNO de 4 estados con datos que ya existen o que agregamos:

1. **Sin PREMIUM** → `<FeatureGate>` estándar: página borrosa + CTA "Actualiza a PREMIUM" (patrón ya rodado: CFDI, inventario, comisiones).
2. **PREMIUM, sin solicitud** → pantalla de venta honesta: "Recibe pedidos de Uber Eats, Rappi y DiDi directo en tu POS" + botón **"Solicitar activación"** (confirma que tiene/quiere cuentas en las plataformas → crea `DeliveryActivationRequest`).
3. **Solicitud en proceso** (`DeliveryActivationRequest` PENDING/CONTACTED, sin canal ACTIVE) → "Recibimos tu solicitud, estamos conectando tus canales" + fecha.
4. **En vivo** (≥1 `DeliveryChannelLink` ACTIVE) → el panel completo (§5).

El paso 3→4 es automático (dato, no flag). Mientras Deliverect no dé luz verde global, ningún venue tiene canales ACTIVE → todos ven estado 2 o 3.

## 4. Backend (avoqado-server) — pieza nueva

### 4.1 Modelo `DeliveryActivationRequest` (aditivo)

```prisma
enum DeliveryActivationStatus { PENDING  CONTACTED  CONNECTED  DISMISSED }

model DeliveryActivationRequest {
  id            String  @id @default(cuid())
  venueId       String
  venue         Venue   @relation(...)
  requestedById String?              // Staff que solicitó (authContext.userId)
  status        DeliveryActivationStatus @default(PENDING)
  /// Canales que el dueño declara tener/querer (informativo para ops)
  requestedChannels String[]         // ['UBER_EATS','RAPPI','DIDI_FOOD']
  note          String?  @db.Text
  contactedAt   DateTime?
  connectedAt   DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@index([venueId])
  @@index([status])
}
```

Migración + `MODEL_TO_DOMAIN` en `scripts/generate-schema-map.ts` + `npm run schema:map` + prismaMock (`tests/__helpers__/setup.ts`) — todo en el mismo cambio (reglas del repo).

### 4.2 Endpoints

- **Dueño** (namespace dashboard, gated `checkFeatureAccess('DELIVERY_CHANNELS')` + permiso):
  - `POST /venues/:venueId/activation-request` — crea la solicitud (idempotente: si ya hay una PENDING/CONTACTED, la devuelve en vez de duplicar). ActivityLog `DELIVERY_ACTIVATION_REQUESTED`.
  - `GET /venues/:venueId/activation-request` — estado actual (para pintar estado 3). Devuelve `null` si no hay.
- **Ops** (namespace superadmin): `GET` lista de solicitudes (cola) + `PATCH .../:id` para avanzar status (CONTACTED/CONNECTED/DISMISSED). ActivityLog en cada transición. `connectedAt` se sella cuando el canal real queda ACTIVE (o manualmente al conectar).

### 4.3 MCP lockstep + auditoría

- Extender el tool `delivery_channels` (o tool nuevo `delivery_activation_requests`) para exponer la cola de solicitudes por el customer MCP — regla de lockstep del repo.
- Cada mutación escribe `ActivityLog` (regla del repo: mutaciones auditables).

## 5. Dashboard (avoqado-web-dashboard) — los 6 toques

Patrón ya rodado (mapa: CFDI/inventario/comisiones). Referencias exactas: `plan-catalog.ts`, `FeatureGate.tsx`, `app-sidebar.tsx`/`nav-main.tsx`, `use-tier-feature-access.ts`, `venueRoutes.tsx`, `lazyComponents.ts`, `locales/{en,es,fr}/`.

1. **`src/config/plan-catalog.ts`** → agregar `'DELIVERY_CHANNELS'` al array `includes` del tier PREMIUM (espejo obligatorio del backend `PREMIUM_ONLY_CODES`; con eso `getTierForFeature('DELIVERY_CHANNELS')` → `'PREMIUM'` y el badge 👑 sale solo). Opcional: bullet en `featureKeys` + copy en `billing.json`.
2. **Sidebar** (`app-sidebar.tsx`) → nuevo item con `premiumLocked: !hasFeatureAccess('DELIVERY_CHANNELS')` + `gatedFeature: 'DELIVERY_CHANNELS'` (usar `hasFeatureAccess` de `useVenueTier`, NO `canFeature`). Probable sub-item de "Ventas" o sección propia.
3. **Página** `src/pages/Delivery/` con los 4 estados (§3), envuelta en `<FeatureGate feature="DELIVERY_CHANNELS">`. Componentes: `DeliveryTeaser` (estado 2, CTA solicitar), `DeliveryPending` (estado 3), `DeliveryLivePanel` (estado 4: tira de stats + tarjetas de canal con controles + tabla de órdenes reutilizada filtrada a delivery). Hook nuevo `useDeliveryStatus(venueId)`.
4. **Ruta** en `venueRoutes.tsx` + lazy export en `lazyComponents.ts` (patrón teaser: `PermissionProtectedRoute`, SIN `FeatureProtectedRoute` — el FeatureGate vive dentro). Se monta para `/venues/:slug` y `/wl/venues/:slug`.
5. **Badge de canal** en las filas de las vistas de **Órdenes** y **Pagos** (etiqueta Uber/Rappi/DiDi cuando `source` es de delivery). Único toque a esas vistas: presentación, no lógica.
6. **i18n** `es/en/fr`: `sidebar.json` (item + tooltip), textos de la página de Delivery, y opcional `billing.json` (bullet del plan).

## 6. Data flow — `useDeliveryStatus`

El hook decide cuál de los 4 estados pintar con 3 lecturas (React Query, cacheadas):
- `useVenueTier()` / `useTierFeatureAccess('DELIVERY_CHANNELS')` → ¿tiene el feature? (estado 1 vs resto).
- `GET /venues/:venueId/channels` → ¿hay canal ACTIVE? → **estado 4**.
- `GET /venues/:venueId/activation-request` → ¿solicitud PENDING/CONTACTED? → **estado 3**; si no → **estado 2**.

La tira de stats del panel usa los números por-canal que el backend ya calcula (misma fuente que el MCP tool `delivery_channels`); expuesto vía un `GET` de resumen o el endpoint de channels enriquecido — se define en el plan.

## 7. Qué se prueba

- **Backend**: unit del modelo/endpoints (idempotencia de la solicitud, gating por feature, ActivityLog, tenant isolation `{venueId}`) + regresión de que los enums nuevos no rompen consumidores.
- **Dashboard**: cada estado renderiza según los datos (sin PREMIUM → candado; PREMIUM sin nada → CTA; con solicitud → "en proceso"; con canal ACTIVE → panel); el badge no rompe las vistas de Órdenes/Pagos existentes (regresión); el CTA "Solicitar activación" pega al endpoint correcto y transiciona a estado 3.

## 8. Orden de construcción

**Backend primero** (modelo + endpoints + MCP + deploy), luego dashboard contra esos endpoints (regla del repo: backend-first, esperar estable). El dashboard puede empezar la parte que no depende del endpoint nuevo (catalog mirror, sidebar, FeatureGate, badges) en paralelo, pero el CTA de solicitud y el estado 3 requieren el endpoint vivo.

## 9. Fuera de scope (explícito)

- **Panel de delivery dedicado con feed en vivo + SLAs por canal** → fast-follow, cuando haya pedidos reales que lo moldeen.
- **Conexión técnica self-serve** (el dueño metiendo location IDs / secrets) → siempre ops+Deliverect.
- **Flujo de menú-mapping en el dashboard** → fase staging con Deliverect.
- Auto-transición CONNECTED de la solicitud disparada por el webhook de Deliverect al conectar → puede ser manual (ops marca CONNECTED) en v1; automatizable después.

## 10. Abierto (se confirma con Deliverect / staging)

- El split exacto de quién aprieta qué dentro de Deliverect durante el onboarding del restaurante (autorización OAuth del merchant vs equipo de Deliverect) — la forma (restaurante trae sus cuentas de plataforma; ops+Deliverect hacen la conexión técnica) no cambia lo que construimos, pero el detalle fino se cierra con su doc de onboarding.
- Si alguna vista vieja de Órdenes/Pagos no expone `source` en su respuesta, el badge requeriría un ajuste chico en ese endpoint — verificar en el plan.
