# Rediseño: Planes y Facturación (Plan-first Billing)

**Fecha:** 2026-06-08
**Autor:** Jose (founder) + Claude
**Estado:** Diseño — pendiente de redline del founder
**Repos:** `avoqado-web-dashboard` (portal UI) + `avoqado-server` (modelo de tiers, access, Stripe, MCP)

---

## 1. Problema

La pantalla actual de `/settings/billing/subscriptions` **miente al usuario**: vende cada
funcionalidad à-la-carte con "Iniciar Prueba Gratuita de 2 días" como si hubiera que
comprarlas una por una — cuando el backend **ya** desbloquea todas las features no-tier al
tener `PLAN_PRO` activo (`basePlan.service.ts` → `PAID_PLAN_TIER_CODES`). Es un problema de
presentación, no de backend.

**Decisión del founder:** matar el à-la-carte por completo. Todo se vende bajo **planes**
(Free / Pro / Premium / Enterprise). Si tu plan no incluye una feature, ves un
**paywall-teaser** (contenido borroso + "Contrata el Plan X") como gancho de upsell.

## 2. Hallazgos de producción (read-only, 2026-06-08)

Query real contra prod (Render Oregon):

- **61 venues totales · 100% `planTier=null` (legacy) · 0 en `PLAN_PRO`.** Nadie está en el
  plan nuevo todavía.
- **Solo 7 de 61 venues tienen alguna feature de pago activa**, y son casi todos
  internos/del founder: `Avoqado Full` (9), `IQ` (4), `Amaena` (3), `Doña Simona` (2),
  `Mindform` (2), `BAE BANTHI` (2), `Testarudo Café` (2).
- **47 de 61 (77%) tienen 3+ staff activos** → un cap "Free = 2 usuarios" retroactivo sería
  catastrófico.
- À-la-carte **efectivamente no monetizó** → valida el movimiento a planes.

**Implicación:** el riesgo de migración es ~0. Es el mejor momento para reestructurar. La
política de grandfathering (sección 7) es trivial de aplicar porque casi no hay base de pago
que proteger.

## 3. Catálogo real (fuente de verdad para el empaquetado)

**Features vivas en prod (modelo `Feature`, 10):**

| code | nombre | precio actual | categoría |
|---|---|---|---|
| `PLAN_PRO` | Plan Avoqado Pro | $999 | OPERATIONS |
| `ONLINE_ORDERING` | Pedidos en Línea | $799 | INTEGRATIONS |
| `LOYALTY_PROGRAM` | Programa de Lealtad | $599 | MARKETING |
| `ADVANCED_ANALYTICS` | Analíticas Avanzadas | $499 | ANALYTICS |
| `CHATBOT` | Chatbot Inteligente | $399 | OPERATIONS |
| `RESERVATIONS` | Sistema de Reservas | $399 | OPERATIONS |
| `INVENTORY_TRACKING` | Control de Inventario | $299 | OPERATIONS |
| `AI_ASSISTANT_BUBBLE` | Asistente IA | $40 | ANALYTICS |
| `ADVANCED_REPORTS` | Reportes Avanzados | $20 | ANALYTICS |
| `AVAILABLE_BALANCE` | Saldo Disponible | $0 | PAYMENTS |

**Módulos vivos (modelo `Module`, 4):** `WHITE_LABEL_DASHBOARD`, `SERIALIZED_INVENTORY`,
`COMMISSIONS`, `ATTENDANCE_TRACKING`.

**Códigos `AVOQADO_*`** (en `PERMISSION_TO_FEATURE_MAP`, gatean permisos core, ~14):
`AVOQADO_ORDERS`, `AVOQADO_MENU`, `AVOQADO_PAYMENTS`, `AVOQADO_TPVS`, `AVOQADO_REPORTS`,
`AVOQADO_INVENTORY`, `AVOQADO_TEAM`, etc.

⚠️ **CFDI no es un `Feature`** — hoy vive como permiso/módulo. Para gatearlo en Premium hay
que volverlo una capability gateable (ver sección 8).

> **Las 3 taxonomías (Features facturables · Módulos · códigos `AVOQADO_*`) deben
> reconciliarse en UN solo mapa `tier → capability`.** Es el concepto central del backend.

## 4. Los 4 tiers

Iconografía + color (el ícono no ordena solo; lo hacen ícono + color + badge):

| Tier | Ícono (lucide) | Color | Badge |
|---|---|---|---|
| **Free** | `Sparkles` | neutral/gris | — |
| **Pro** | `Star` ⭐ | azul de marca | **"Más popular"** |
| **Premium** | `Crown` 👑 | dorado/ámbar | "Más completo" |
| **Enterprise** | `Building2` 🏢 | slate oscuro | "A la medida" |

**Filosofía de la escalera:**
- **Free = opera.** Corre el negocio de punta a punta. Monetizas vía **comisión por
  transacción** (`FeeSchedule` 2.5%→2.0%), no por suscripción. Como Square.
- **Pro = crece y entiende.** Insight (histórico) + crecimiento + IA.
- **Premium = profesionaliza.** Cumplimiento fiscal (CFDI) + operación seria (FIFO/recetas) +
  escala (multisucursal).
- **Enterprise = a la medida.** White-label, API, SLA, precio negociado por ventas (sin
  checkout self-serve).

## 5. Mapa tier → capability (strawman para redline)

**Table stakes — en TODOS los tiers incluido Free** (core para operar): órdenes · mesas ·
menú · pagos/TPV · `AVAILABLE_BALANCE` (Saldo) · reportes del día/corte · inventario básico
(conteo + alertas) · clientes básico.

| Capability | code real | Free | Pro ⭐ | Premium 👑 | Enterprise 🏢 |
|---|---|:--:|:--:|:--:|:--:|
| Usuarios | — | **máx 2** | + | ++ | ilimitado |
| Reportes avanzados + histórico | `ADVANCED_REPORTS` | teaser | ✅ | ✅ | ✅ |
| Asistente IA + MCP | `AI_ASSISTANT_BUBBLE` (+`MCP` nuevo) | teaser | ✅ | ✅ | ✅ |
| Pedidos en línea / QR | `ONLINE_ORDERING` | — | ✅ | ✅ | ✅ |
| Lealtad | `LOYALTY_PROGRAM` | — | ✅ | ✅ | ✅ |
| Reservas | `RESERVATIONS` | — | ✅ | ✅ | ✅ |
| Chatbot (Beta) | `CHATBOT` | ✅ Beta | ✅ | ✅ | ✅ |
| CFDI / Facturación | *(nuevo gate)* | — | — | ✅ | ✅ |
| Inventario FIFO avanzado (recetas, costeo, POs) | `INVENTORY_TRACKING` avanzado + `SERIALIZED_INVENTORY` | — | — | ✅ | ✅ |
| Analítica predictiva | `ADVANCED_ANALYTICS` | — | — | ✅ | ✅ |
| Comisiones / Metas | `COMMISSIONS` | — | — | ✅ | ✅ |
| Control de asistencia | `ATTENDANCE_TRACKING` | — | — | ✅ | ✅ |
| White-label · API · SLA | `WHITE_LABEL_DASHBOARD` | — | — | — | ✅ |

**Multisucursal — NO es un gate.** El cobro es por venue; cada sucursal tiene su propio plan y
se mezclan libremente (Pro en una, Free en otra). Operar varias sucursales **nunca se bloquea**.
(Los reportes cross-venue avanzados pueden quedar en Premium, pero la operación multi-venue es libre.)

**Decisiones del founder (2026-06-08, RESUELTAS):**
- Lealtad + Reservas → **Pro** ✅
- Chatbot → **Free con badge `Beta`** (no se monetiza hasta ser confiable; sube a Premium al madurar) ⚠️
- Multisucursal → **sin bloqueo, per-venue** ✅
- Nombre → **Premium** ✅
- **Precio Premium: $1,699 + IVA / mes** (Pro $999 + IVA). Anual = ~2 meses gratis vía toggle.
- Inventario → confirmar split básico (Free) vs FIFO avanzado (Premium).

> ⚠️ **Chatbot en Free:** Free es la capa más expuesta. Va con **badge `Beta`**
> (regla `critical-warnings.md`). Plan: Free+Beta ahora → mover a Premium cuando sea confiable.

## 6. El `<FeatureGate>` — paywall-teaser reusable

Patrón único, no una pantalla. Envuelve **cualquier** página/sección gateada:

```tsx
<FeatureGate requiredTier="PREMIUM" feature="cfdi">
  <FacturasPage />
</FeatureGate>
```

**Comportamiento:**
- Si el venue **tiene** acceso → renderiza el contenido normal.
- Si **no** → renderiza el contenido **borroso de fondo** (gancho: "ves que existe pero no lo
  tienes") + tarjeta central con: ícono del tier, "Esta función es parte del Plan **X**",
  copy de valor, y CTA **que nombra el tier correcto** (`"Mejora a Premium 👑"`, no un genérico).
- El tier mínimo lo declara la feature; el componente adapta texto/ícono/color/destino.
- Link secundario: "Ver todos los planes".

Construye **una vez**, reúsalo en CFDI, Inventario avanzado, Analítica, Chatbot, etc.

## 7. 🔴 Política de venues existentes (grandfathering) — DECISIÓN CENTRAL

**Decisión: "Untouchable AHORA, migración deliberada DESPUÉS."**

1. **El modelo nuevo aplica solo a venues NUEVOS.** Ya nacen en Pro (`onboarding.controller.ts`
   les pone `planTier:'PRO'`); solo reciben la UI nueva.
2. **La base actual (61 venues) se congela como grandfathered.** Nadie pierde acceso, nadie
   recibe cobro sorpresa.
3. **Se migra después, como Fase C**, campaña deliberada por cohorte, con números reales.

### La regla técnica que lo hace seguro y barato

```
tieneAcceso(feature) = featureIncluidaEnTier(venue.tier)  OR  venueTieneGrantExplícito(feature)
```

- El grandfathering **ya existe**: las filas `VenueFeature` actuales **son** esos grants. El
  grant explícito siempre gana sobre el gate del tier.
- Venues nuevos: sin grants → modelo de tier puro.
- Reúsa el mecanismo existente; solo se agrega un marcador `grandfathered`/`source` para
  reportar y apagar cuando toque.

### El cap de 2 usuarios NO es retroactivo
47/61 venues tienen 3+ staff. El cap aplica solo a **Free nuevos**; los existentes quedan
grandfathered por encima del límite (con aviso + gracia si algún día se migran).

### Cohortes para la Fase C
- **Pagan `PLAN_PRO`** (0 hoy) → grandfather a Premium a su precio. Nunca se les quita lo pagado.
- **Pagan à-la-carte** (~7, casi todos internos) → grandfather la feature; oferta de migración.
- **Legacy gratis** (~54) → a Free, grandfather lo que usen + cap con gracia.
- **Demos** → intactos (saltan billing).

## 8. Arquitectura backend (avoqado-server)

1. **Mapa `tier → capability`** como fuente de verdad. **v1: config en código**
   (`TIER_CAPABILITIES = { PRO: [...], PREMIUM: [...] }`), no tabla DB (YAGNI). Promover a
   tabla `PlanTierCapability` después si superadmin necesita editar sin deploy.
2. **Reescribir `venueHasFeatureAccess()`** (`basePlan.service.ts`): de "¿tiene plan base?" a
   "¿está la feature en el bundle de SU tier? OR ¿tiene grant explícito?".
3. **Volver CFDI gateable**: hoy es permiso/módulo; agregarlo al mapa tier→capability.
4. **Stripe productos/precios por tier**: `PLAN_PRO` ya existe (`seed-plan-pro.ts`). Clonar
   para Premium. Free = sin sub. Enterprise = manual.
5. **Endpoint `POST /plan/change`** (upgrade/downgrade) con prorrateo Stripe + aviso
   "qué pierdes al bajar".
6. **Marcador `grandfathered`** en `VenueFeature` (o `source` enum) para reportar/sunset.
7. **🔴 MCP en lockstep:** actualizar/crear las herramientas espejo en `scripts/mcp/`
   (`subscription_status`, `venue_features`, y un nuevo `plan_change`/`tier_capabilities`)
   en el MISMO cambio. Regla de CLAUDE.md.

## 9. IA del portal (estilo Square / Linear / Notion)

Sección **"Plan y Facturación"** con pestañas:

1. **Plan** — tier actual + las 4 tarjetas de tier + tabla comparativa (el héroe). Pro con
   badge "Más popular". Enterprise con "Contactar ventas" (sin checkout).
2. **Facturas** — recibos/CFDI descargables (lo que ya existe en `History.tsx`).
3. **Métodos de pago** — tarjetas (lo que ya existe).
4. **Tokens IA** — add-on de uso, transversal a todos los tiers.

**Control de superadmin** (Otorgar Prueba / Activar Función) → se conserva intacto pero
**movido a un panel colapsable** "Control de Superadmin", fuera de la vista del cliente.

**Reuso (DRY) — clave:** `/setup` (`src/pages/Setup/steps/PlanStep.tsx`) ya tiene el **toggle
Mensual/Anual + Stripe SetupIntent + modelo `{interval, payNow}`** funcionando — PERO hoy es de
**un solo plan (Pro)**, no un picker de tiers. El trabajo real no es "agregar una tarjeta": es
**convertir ese paso en un picker multi-tier** (Free/Pro/Premium) y extraer un **`<PlanPicker>`
compartido** que usen TANTO el onboarding como la pestaña "Plan" del portal. Alinear con el spec
base `2026-06-02-venue-base-subscription-design.md`. Toggle anual: Premium ~$16,990/año (~2 meses gratis).

## 10. Secuencia A → B → C

- **Fase A — Portal UI (rápido, shippeable ya).** Reorganizar a plan-first, esconder
  à-la-carte, construir `<FeatureGate>`, mover superadmin a panel colapsable. Arregla HOY el
  problema de que la pantalla miente. El portal se construye para renderizar **N tiers**, así
  que la Fase B solo llena tarjetas.
- **Fase B — Modelo de 4 tiers (backend).** Mapa tier→capability, rework de access, Stripe
  Premium, `/plan/change`, CFDI gateable, MCP en lockstep.
- **Fase C — Migración de la base** (deliberada, por cohorte, con números reales). Bajo riesgo
  dado que la base es ~100% legacy-gratis.

## 11. Riesgos

| Riesgo | Mitigación |
|---|---|
| Quitar acceso a quien ya lo usa | Regla `grant explícito gana` + grandfathering (sección 7) |
| Cap de 2 usuarios rompe operación | No retroactivo; solo Free nuevos |
| Las 3 taxonomías se desincronizan | Un solo mapa tier→capability como fuente de verdad |
| MCP se queda atrás | Actualizar herramientas en el mismo PR (regla CLAUDE.md) |
| Cross-repo TPV desfasado | Backend primero → estable → luego clientes |

## 12. Pendientes del founder (antes de implementar)

- [x] Redline del mapa tier→capability — RESUELTO (sección 5).
- [x] Nombres `Free → Pro → Premium → Enterprise` — RESUELTO.
- [x] Precio Premium: **$1,699 + IVA/mes** — RESUELTO. Enterprise: custom.
- [ ] Confirmar split de Inventario básico (Free) vs FIFO avanzado (Premium).
- [ ] Precio anual de Premium (sugerencia ~$16,990 = 2 meses gratis) + ¿promo intro?
- [ ] Visto bueno del **mockup** → luego Fase A (writing-plans → implementación).

## 13. Flujo de cancelación con retención (`<CancelPlanDialog>`)

Patrón canónico de la industria (Netflix/Spotify/NYT; Churnkey reporta ~34% save rate):
**razón → oferta de retención (con urgencia) → confirmación → email post-cancelación + win-back.**
Fricción respetuosa, no dark-pattern engañoso: el usuario SIEMPRE puede cancelar, pero cada
paso le recuerda lo que pierde y le ofrece una salida que se siente como ganancia.

### Disparador
Reemplaza el "Cancelar plan" actual de `CurrentPlanCard` (que hoy llama directo `POST /plan/cancel`).

### Botones invertidos (clave — como los grandes)
En cada paso el botón **primario (negro)** es la opción de **QUEDARSE** (cierra el diálogo);
el **secundario (ghost/muted)** es **continuar cancelando**. El camino de salida existe pero
no es el botón prominente.

### Pasos (multi-step dialog)
1. **Razón (exit survey).** "Antes de irte, ¿por qué cancelas?" — radios: *Muy caro · No lo
   uso · Me falta una función · Me cambio a otra · Cierre/pausa temporal · Otro* (+ texto
   libre). Guarda la razón (datos para win-back + tailoring). Primario: **"Quedarme con mi
   plan"** (cierra) · Secundario: "Continuar".
2. **Oferta de retención (con TIMER).** Tailored por razón:
   - *Muy caro* → **descuento** (ej. 30% off × 3 meses) con **countdown** ("Esta oferta vence
     en 14:59").
   - *No lo uso* → **pausa** ("Pausa tu plan 2 meses, sin perder tu data").
   - genérico → descuento.
   Primario: **"Aceptar y quedarme"** (aplica cupón → cierra) · Secundario: "No gracias,
   cancelar".
3. **Confirmación final.** "Tu plan sigue activo hasta **[fin de periodo]**. Después pierdes:
   [beneficios clave]." Primario: **"No, quedarme"** (cierra) · Secundario: "Sí, cancelar".

### Al cancelar (paso 3)
- `POST /plan/cancel` (existe — cancela a fin de periodo).
- Backend envía **email de cancelación** + **descuento win-back con vencimiento** (timer:
  "recupera tu plan con X% off — válido 7 días, vence el [fecha]"). El cupón
  `WINBACK_FIRST_MONTH_FREE` ya existe; el de retención (ej. `RETENTION_30_3M`) es nuevo.

### Timers
- **En el diálogo:** countdown real (estado React, ej. 15:00) en la oferta de retención → urgencia.
- **En el email:** los emails no llevan countdown vivo confiable → mostrar **fecha límite** +
  copy de urgencia (o GIF de countdown opcional). El cupón en Stripe lleva `redeem_by`/expiry real.

### Backend a construir
- **Cupón de retención** (`RETENTION_30_3M`, 30% off 3 meses) — script tipo `seed-plan-pro.ts`
  (Stripe `coupons.create`). + cupón win-back de email si difiere del existente.
- **Endpoint `POST /plan/retention-offer`** → aplica el cupón a la suscripción (Stripe
  `subscriptions.update` con `coupon`/`discounts`) + marca que ya se ofreció (anti-abuso:
  máx 1 oferta cada N meses por venue).
- **Endpoint de pausa** (opcional, si se ofrece pausa): Stripe `subscriptions.update` con
  `pause_collection`.
- **Email de cancelación + win-back**: verificar si existe (hay infra de win-back en
  `email.service.ts` "Win-back email Phase 1.5"); añadir el de confirmación-de-cancelación con
  el cupón + deadline.
- 🔴 MCP en lockstep si se exponen estas acciones.

### Frontend
`src/components/billing/CancelPlanDialog.tsx` — multi-step (estado `step`), countdown hook,
botones invertidos. Se abre desde `CurrentPlanCard`. i18n es/en. `data-tour` en los CTAs.
