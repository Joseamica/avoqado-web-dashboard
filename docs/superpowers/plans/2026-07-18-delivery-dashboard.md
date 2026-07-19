# Delivery en el Dashboard — Implementation Plan (avoqado-web-dashboard)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **DEPENDE del plan backend** `avoqado-server/docs/superpowers/plans/2026-07-18-delivery-activation-backend.md` — los endpoints deben existir (idealmente deployados) antes de las tasks que los consumen. Las tasks 1-2 (catalog, sidebar, FeatureGate, badge) NO dependen del endpoint nuevo y pueden ir en paralelo.

**Goal:** Vertical de delivery en el dashboard: teaser PREMIUM "próximamente" honesto que se convierte solo en panel de gestión cuando el venue queda conectado (readiness = dato, 4 estados), + badge de canal en Órdenes/Pagos.

**Architecture:** Patrón teaser ya rodado (CFDI/inventario/comisiones como referencia): feature PREMIUM en `plan-catalog.ts`, sidebar con `premiumLocked`+`gatedFeature`, página envuelta en `<FeatureGate>`. Un hook `useDeliveryStatus` resuelve cuál de 4 estados pintar leyendo feature-access + canales + solicitud. La tabla de pedidos del panel REUTILIZA el componente de órdenes filtrado a delivery (no tabla nueva).

**Tech Stack:** React 18 + Vite, TanStack Query, Tailwind/Radix, i18next (es/en/fr), axios (`@/api`).

## Global Constraints

- **Sin commits sin permiso del founder** (regla repo). Pasos "Commit" asumen permiso para la ejecución.
- **Feature code EXACTO `DELIVERY_CHANNELS`** — espejo del backend `PREMIUM_ONLY_CODES`; un mismatch falla en silencio.
- **Gating por tier: usar `hasFeatureAccess` de `useVenueTier`** — NUNCA `canFeature`/`checkFeatureAccess` (short-circuit a true en venues normales).
- **Servicios: `import api from '@/api'`**, desenvolver `response.data.data` (el backend envuelve en `{ success, data }`).
- **i18n en los 3 locales** `en/es/fr` para cada key nueva.
- **Ruta patrón teaser**: `PermissionProtectedRoute` SIN `FeatureProtectedRoute` (el FeatureGate vive dentro de la página).
- Después de editar: `npm run lint` + `npm run build` verdes. Tests con regresión.

---

### Task 1: Catálogo de planes — `DELIVERY_CHANNELS` en PREMIUM

**Files:**
- Modify: `src/config/plan-catalog.ts` (array `includes` del tier PREMIUM, ~línea 82-91)
- Modify: `src/locales/{en,es,fr}/billing.json` (opcional: bullet `plan.features.delivery`)
- Test: `src/config/plan-catalog.test.ts` (si existe; si no, verificación por `getTierForFeature`)

**Interfaces:**
- Produces: `getTierForFeature('DELIVERY_CHANNELS')` → `'PREMIUM'`.

- [ ] **Step 1: Test (RED)** — agregar/afirmar `expect(getTierForFeature('DELIVERY_CHANNELS')).toBe('PREMIUM')`. Si no hay archivo de test para plan-catalog, crear uno mínimo con ese assert.
- [ ] **Step 2: Implementar** — en `src/config/plan-catalog.ts`, tier PREMIUM, agregar `'DELIVERY_CHANNELS',` al array `includes` (junto a `MERCHANT_ROUTING_RULES`). Opcional (bullet en la tarjeta): agregar `'delivery'` a `featureKeys` de PREMIUM + `"delivery": "Delivery (Uber Eats, Rappi, DiDi)"` en `plan.features` de los 3 `billing.json`.
- [ ] **Step 3:** Correr test → PASS. `npm run build`.
- [ ] **Step 4: Commit** — `git commit -m "feat(delivery): DELIVERY_CHANNELS como feature PREMIUM en el catálogo"`

---

### Task 2: Badge de canal en Órdenes y Pagos

**Files:**
- Create: `src/components/delivery/ChannelBadge.tsx` (componente reutilizable)
- Modify: la fila/celda de la tabla de Órdenes y la de Pagos (localizar con grep: `grep -rn "source" src/pages/Orders src/pages/Payments` o el componente de fila compartido)
- Modify: `src/locales/{en,es,fr}/` (namespace de órdenes/pagos: etiquetas Uber/Rappi/DiDi)
- Test: `src/components/delivery/ChannelBadge.test.tsx`

**Interfaces:**
- Produces: `<ChannelBadge source={order.source} />` — renderiza etiqueta/logo para `UBER_EATS|RAPPI|DIDI_FOOD|DELIVERY_PLATFORM`, y `null` para cualquier otro source (no delivery).

- [ ] **Step 1: Test (RED).** Casos: `source='UBER_EATS'` → renderiza "Uber Eats"; `RAPPI`→"Rappi"; `DIDI_FOOD`→"DiDi Food"; `DELIVERY_PLATFORM`→"Delivery"; `source='TPV'` (o cualquier no-delivery) → renderiza `null` (no rompe filas normales).
- [ ] **Step 2: Implementar `ChannelBadge.tsx`:**

```tsx
const DELIVERY_LABELS: Record<string, string> = {
  UBER_EATS: 'Uber Eats',
  RAPPI: 'Rappi',
  DIDI_FOOD: 'DiDi Food',
  DELIVERY_PLATFORM: 'Delivery',
}

export function ChannelBadge({ source }: { source?: string | null }) {
  if (!source || !(source in DELIVERY_LABELS)) return null
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
      {DELIVERY_LABELS[source]}
    </span>
  )
}
```

- [ ] **Step 3: Insertar** `<ChannelBadge source={row.source} />` en la celda de la fila de Órdenes y de Pagos (junto al número de orden / método). Verificar primero que la fila ya recibe `source` en su data; si NO, es un ajuste de la query/tipo de esa vista — anotarlo como sub-paso y agregar `source` al select. **Regresión:** una fila sin delivery (source normal) no muestra badge y no cambia su layout.
- [ ] **Step 4:** Test → PASS. `npm run lint && npm run build`. Verificar en el navegador que Órdenes/Pagos se ven igual + badge en las de delivery (si hay data; si no, snapshot del test basta).
- [ ] **Step 5: Commit** — `git commit -m "feat(delivery): badge de canal en filas de Órdenes y Pagos"`

---

### Task 3: Capa de servicio + tipos

**Files:**
- Create: `src/services/delivery.service.ts`
- Create/Modify: `src/types/` (tipos `DeliveryChannelLink`, `DeliveryActivationRequest`, `DeliverySummary`)
- Test: `src/services/delivery.service.test.ts`

**Interfaces:**
- Produces:
  - `getChannels(venueId): Promise<DeliveryChannelLink[]>` → `GET /api/v1/delivery-channels/venues/:venueId/channels`
  - `getActivationRequest(venueId): Promise<DeliveryActivationRequest | null>` → `GET .../activation-request`
  - `createActivationRequest(venueId, body): Promise<DeliveryActivationRequest>` → `POST .../activation-request`
  - `getDeliverySummary(venueId): Promise<DeliverySummary>` → `GET .../delivery/summary`
  - `pauseChannel(venueId, linkId, paused): Promise<DeliveryChannelLink>` → `POST .../channels/:linkId/pause`

- [ ] **Step 1: Tipos** en `src/types/delivery.ts` (exportados desde `src/types`):

```typescript
export type DeliveryProvider = 'DELIVERECT' | 'UBER_EATS' | 'RAPPI' | 'DIDI_FOOD'
export type DeliveryChannelStatus = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'DISABLED'
export interface DeliveryChannelLink {
  id: string; venueId: string; provider: DeliveryProvider
  status: DeliveryChannelStatus; orderAcceptanceMode: 'AUTO' | 'MANUAL'
  autoSyncMenu: boolean; lastMenuSyncAt: string | null; externalLocationId: string
}
export type DeliveryActivationStatus = 'PENDING' | 'CONTACTED' | 'CONNECTED' | 'DISMISSED'
export interface DeliveryActivationRequest {
  id: string; venueId: string; status: DeliveryActivationStatus
  requestedChannels: string[]; note: string | null; createdAt: string
}
export interface DeliverySummary {
  channels: Array<{ channel: string; orders: number; totalPesos: number }>; generatedAt: string
}
```

- [ ] **Step 2: Tests (RED)** — mockear `@/api` y afirmar que cada fn pega a la URL correcta y desenvuelve `response.data.data`.
- [ ] **Step 3: Implementar `delivery.service.ts`:**

```typescript
import api from '@/api'
import type { DeliveryChannelLink, DeliveryActivationRequest, DeliverySummary } from '@/types/delivery'

const base = (venueId: string) => `/api/v1/delivery-channels/venues/${venueId}`

export const getChannels = async (venueId: string): Promise<DeliveryChannelLink[]> =>
  (await api.get(`${base(venueId)}/channels`)).data.data

export const getActivationRequest = async (venueId: string): Promise<DeliveryActivationRequest | null> =>
  (await api.get(`${base(venueId)}/activation-request`)).data.data

export const createActivationRequest = async (
  venueId: string,
  body: { requestedChannels: string[]; note?: string },
): Promise<DeliveryActivationRequest> => (await api.post(`${base(venueId)}/activation-request`, body)).data.data

export const getDeliverySummary = async (venueId: string): Promise<DeliverySummary> =>
  (await api.get(`${base(venueId)}/delivery/summary`)).data.data

export const pauseChannel = async (venueId: string, linkId: string, paused: boolean): Promise<DeliveryChannelLink> =>
  (await api.post(`${base(venueId)}/channels/${linkId}/pause`, { paused })).data.data
```

- [ ] **Step 4:** Test → PASS. `npm run build`.
- [ ] **Step 5: Commit** — `git commit -m "feat(delivery): capa de servicio + tipos del dashboard"`

---

### Task 4: Hook `useDeliveryStatus` (resuelve los 4 estados)

**Files:**
- Create: `src/hooks/use-delivery-status.ts`
- Test: `src/hooks/use-delivery-status.test.ts`

**Interfaces:**
- Consumes: `useVenueTier` (`hasFeatureAccess`); `getChannels`, `getActivationRequest` (Task 3).
- Produces: `useDeliveryStatus(venueId): { state: 'LOCKED' | 'TEASER' | 'PENDING' | 'LIVE'; channels: DeliveryChannelLink[]; activationRequest: DeliveryActivationRequest | null; isLoading: boolean }`.

- [ ] **Step 1: Tests (RED).** Casos (mockear `useVenueTier` + las queries):
  - sin feature (`hasFeatureAccess('DELIVERY_CHANNELS')` false) → `state: 'LOCKED'`.
  - con feature, sin canal ACTIVE, sin solicitud → `'TEASER'`.
  - con feature, sin canal ACTIVE, con solicitud viva → `'PENDING'`.
  - con feature, ≥1 canal `ACTIVE` → `'LIVE'` (aunque haya solicitud).
- [ ] **Step 2: Implementar:**

```typescript
import { useQuery } from '@tanstack/react-query'
import { useVenueTier } from '@/hooks/use-tier-feature-access'
import { getChannels, getActivationRequest } from '@/services/delivery.service'

export type DeliveryState = 'LOCKED' | 'TEASER' | 'PENDING' | 'LIVE'

export function useDeliveryStatus(venueId: string | undefined) {
  const { hasFeatureAccess, isLoading: tierLoading } = useVenueTier()
  const hasFeature = hasFeatureAccess('DELIVERY_CHANNELS')
  const enabled = !!venueId && hasFeature

  const { data: channels = [], isLoading: chLoading } = useQuery({
    queryKey: ['deliveryChannels', venueId], queryFn: () => getChannels(venueId!), enabled, staleTime: 60_000,
  })
  const { data: activationRequest = null, isLoading: reqLoading } = useQuery({
    queryKey: ['deliveryActivation', venueId], queryFn: () => getActivationRequest(venueId!), enabled, staleTime: 60_000,
  })

  const isLoading = tierLoading || (enabled && (chLoading || reqLoading))
  const hasActive = channels.some(c => c.status === 'ACTIVE')

  const state: DeliveryState = !hasFeature ? 'LOCKED' : hasActive ? 'LIVE' : activationRequest ? 'PENDING' : 'TEASER'
  return { state, channels, activationRequest, isLoading }
}
```

- [ ] **Step 3:** Test → PASS. `npm run build`.
- [ ] **Step 4: Commit** — `git commit -m "feat(delivery): hook useDeliveryStatus (4 estados data-driven)"`

---

### Task 5: Sidebar — item de Delivery con candado

**Files:**
- Modify: `src/components/Sidebar/app-sidebar.tsx` (nuevo item, patrón `premiumLocked`+`gatedFeature`; referencia CFDI ~592-610 / INVENTORY ~674-683)
- Modify: `src/locales/{en,es,fr}/sidebar.json` (label + tooltip)

**Interfaces:**
- Consumes: `hasFeatureAccess('DELIVERY_CHANNELS')` de `useVenueTier` (ya usado en el sidebar, ~línea 204).

- [ ] **Step 1: Implementar** — agregar el item (probable sub-item de la sección "Ventas" `salesSubItems`, o item propio), con:

```tsx
{
  title: t('salesMenu.delivery'), // o la key i18n que corresponda
  url: `${basePath}/delivery`,
  icon: Truck, // de lucide-react
  premiumLocked: !hasFeatureAccess('DELIVERY_CHANNELS'),
  gatedFeature: 'DELIVERY_CHANNELS',
}
```

El badge 👑 sale solo vía `getTierForFeature('DELIVERY_CHANNELS')` → PREMIUM (Task 1). NO usar `canFeature`.

- [ ] **Step 2: i18n** — `sidebar.json` (3 locales): agregar la key del label (ej. `salesMenu.delivery`: "Delivery" / "Delivery" / "Livraison").
- [ ] **Step 3:** `npm run build`. Verificar en navegador: el item aparece con 👑 para un venue no-PREMIUM (usar un venue de prueba FREE/PRO).
- [ ] **Step 4: Commit** — `git commit -m "feat(delivery): item de sidebar con candado PREMIUM"`

---

### Task 6: Página de Delivery — los 4 estados + ruta

**Files:**
- Create: `src/pages/Delivery/DeliveryPage.tsx` (orquesta los 4 estados vía `useDeliveryStatus`)
- Create: `src/pages/Delivery/components/DeliveryTeaser.tsx` (estado TEASER: venta + CTA solicitar)
- Create: `src/pages/Delivery/components/DeliveryPending.tsx` (estado PENDING)
- Create: `src/pages/Delivery/components/DeliveryLivePanel.tsx` (estado LIVE: stats + tarjetas de canal + tabla reutilizada)
- Create: `src/pages/Delivery/components/RequestActivationDialog.tsx` (form de solicitud)
- Modify: `src/routes/lazyComponents.ts` (lazy export `DeliveryPage`)
- Modify: `src/routes/venueRoutes.tsx` (ruta `delivery`, patrón teaser)
- Modify: `src/locales/{en,es,fr}/` (namespace nuevo `delivery.json` o dentro de uno existente)
- Test: `src/pages/Delivery/DeliveryPage.test.tsx`

**Interfaces:**
- Consumes: `useDeliveryStatus` (Task 4), `createActivationRequest`/`getDeliverySummary`/`pauseChannel` (Task 3), `<FeatureGate feature="DELIVERY_CHANNELS">`.

- [ ] **Step 1: Tests (RED)** de `DeliveryPage` — mockear `useDeliveryStatus` y afirmar que renderiza el sub-componente correcto por estado: LOCKED → dentro de `<FeatureGate>` (contenido borroso/upsell — el propio FeatureGate lo maneja, así que basta afirmar que la página está envuelta); TEASER → `DeliveryTeaser` (botón "Solicitar activación"); PENDING → `DeliveryPending` ("en proceso"); LIVE → `DeliveryLivePanel`.
- [ ] **Step 2: `DeliveryPage.tsx`** (orquestador; el `<FeatureGate>` cubre el caso LOCKED automáticamente porque bloquea a los no-PREMIUM):

```tsx
export default function DeliveryPage() {
  const { venueId } = useCurrentVenue()
  const { state, channels, activationRequest, isLoading } = useDeliveryStatus(venueId)
  return (
    <FeatureGate feature="DELIVERY_CHANNELS">
      <div className="p-4">
        {isLoading ? <Spinner/>
          : state === 'PENDING' ? <DeliveryPending request={activationRequest!} />
          : state === 'LIVE' ? <DeliveryLivePanel venueId={venueId!} channels={channels} />
          : <DeliveryTeaser venueId={venueId!} /> /* TEASER (y LOCKED nunca llega aquí: FeatureGate lo intercepta) */}
      </div>
    </FeatureGate>
  )
}
```

- [ ] **Step 3: `DeliveryTeaser.tsx`** — copy de venta ("Recibe pedidos de Uber Eats, Rappi y DiDi directo en tu POS", i18n) + botón "Solicitar activación" que abre `RequestActivationDialog`. Estructura visual siguiendo una página existente como referencia (`src/pages/Cfdi/CfdiList.tsx`). El dialog: checkboxes de canales (Uber/Rappi/DiDi) + nota opcional → `createActivationRequest(venueId, { requestedChannels, note })` → invalida `['deliveryActivation', venueId]` (React Query) → la página pasa a PENDING.
- [ ] **Step 4: `DeliveryPending.tsx`** — mensaje "Recibimos tu solicitud, estamos conectando tus canales" + fecha (`request.createdAt`) + lista de canales solicitados. Sin acciones.
- [ ] **Step 5: `DeliveryLivePanel.tsx`** — (a) **tira de stats** vía `getDeliverySummary` (pedidos/ingreso por canal hoy); (b) **una tarjeta por canal** de `channels` (provider, estado ACTIVE/PAUSED, `lastMenuSyncAt`, toggle pausar/reanudar → `pauseChannel`, selector de modo auto/manual → `updateChannel` — reusar del backend Task 10, o dejar el toggle de pausa como control v1 y el modo como fast-follow si `updateChannel` no está en el service); (c) **link "Ver pedidos de delivery"** que navega a la vista de Órdenes existente con filtro de source delivery (query param). NO reconstruir la tabla de órdenes.
- [ ] **Step 6: Ruta** — `lazyComponents.ts`: `export const DeliveryPage = lazy(() => import('@/pages/Delivery/DeliveryPage'))`. `venueRoutes.tsx` (patrón teaser, como CFDI ~622-637): `{ path: 'delivery', element: <PermissionProtectedRoute permission="delivery-channels:read"><DeliveryPage/></PermissionProtectedRoute> }` (SIN `FeatureProtectedRoute`).
- [ ] **Step 7: i18n** `delivery.json` en los 3 locales (títulos, copy de venta, estados, labels del panel, dialog).
- [ ] **Step 8:** Tests → PASS. `npm run lint && npm run build`. Verificar en navegador los estados con venues de prueba (FREE → candado; PREMIUM sin solicitud → teaser+CTA; tras solicitar → pending).
- [ ] **Step 9: Commit** — `git commit -m "feat(delivery): página de Delivery (4 estados) + ruta + i18n"`

---

### Task 7: Verificación final dashboard

- [ ] **Step 1:** `npm run lint` limpio en los archivos delivery.
- [ ] **Step 2:** `npm test` (o el runner del repo) → suite verde, incluida la regresión de Órdenes/Pagos (el badge no rompe).
- [ ] **Step 3:** `npm run build` → verde.
- [ ] **Step 4:** QA en navegador de los 4 estados (con la ayuda del preview/dev server): candado, teaser+solicitud, pending, y —si hay un venue con canal ACTIVE de prueba— el panel live.
- [ ] **Step 5: Commit** final si quedó algo de lint.

---

## Self-review del plan (hecho)
- **Cobertura spec §5:** catalog→T1; badge→T2; service→T3; hook→T4; sidebar→T5; página 4 estados+ruta→T6; i18n en T1/T2/T5/T6.
- **Sin placeholders:** los "localizar con grep" (fila de Órdenes/Pagos) y "confirmar que la fila recibe source" son lecturas puntuales de archivos existentes, no huecos; el modo auto/manual del panel se marca como fast-follow condicional explícito.
- **Consistencia de tipos:** `DeliveryChannelLink`/`DeliveryActivationRequest`/`DeliverySummary` (T3) consumidos por T4/T6; `useDeliveryStatus` estado `LOCKED|TEASER|PENDING|LIVE` (T4) consumido por T6; feature code `DELIVERY_CHANNELS` idéntico en T1/T4/T5/T6.
- **Dependencia backend:** T3/T4/T6 consumen endpoints del plan backend (activation-request, summary); T1/T2/T5 no.
