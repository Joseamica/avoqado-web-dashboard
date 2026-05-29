# Programa de Referidos — C2C tier-based (Mindform-first, plataforma-level)

**Fecha**: 2026-05-28
**Owner**: Jose Amieva
**Repos afectados**: `avoqado-server`, `avoqado-web-dashboard`, `avoqado-tpv` (coordinación cross-repo)
**Status**: Design — Pendiente de aprobación

## Contexto y motivación

Sumi (Mindform, estudio boutique de wellness) pidió un programa de referidos donde los clientes recomiendan personas, acumulan referidos y desbloquean descuentos por niveles. El PDF que Sumi ya diseñó muestra 3 tiers:

- **Nivel 1**: 7 referidos → 15% en próxima compra
- **Nivel 2**: 12 referidos → 20% en próxima compra
- **Nivel 3**: 20 referidos → 25% en próxima compra

El cliente referido recibe 10% en su primera compra. Sumi usa WhatsApp como canal primario.

### Estado actual en Avoqado

Verificado en backend (`prisma/schema.prisma`, `src/`) y dashboard (`src/`): **no existe** sistema de referidos cliente-a-cliente.

Sistemas relacionados pero distintos que sí existen y se reusarán:

| Sistema existente | Para qué | Cómo se reusa |
|---|---|---|
| `Customer` model | Cliente per-venue (con `loyaltyPoints`, `totalSpent`, etc.) | Se le agregan 5 campos de referidos |
| `Coupon` + `CouponRedemption` | Cupones con código, expiración, max redenciones | Se emite un `Coupon` al desbloquear cada tier |
| `Discount` + `CustomerDiscount` | Descuentos manuales o ligados a CustomerGroup | El 10% al referido en su primera compra se aplica como `Discount` one-time |
| `CustomerGroup` | Agrupar clientes ("Coaches", "VIP") | Opcional — Mindform puede etiquetar por tier |

Sistemas explícitamente **no usados**:
- `LoyaltyConfig` / `LoyaltyTransaction`: es para loyalty de puntos transaccionales, mecánica diferente. Coexisten sin colisión si Mindform algún día quiere ambos.
- "Comisión de referido" en `Aggregators.tsx`: es B2B (agregador refiere venue a Avoqado), no aplica a clientes refiriendo clientes.

### Por qué plataforma y no Mindform-only

Mindform es el primer venue en activar, pero el diseño es per-venue (`ReferralProgramConfig` por venue, `@@unique([venueId, ...])` en códigos). Cualquier otro venue puede activarlo sin tocar código. Encaja con el plan de tiers Free/Pro/Premium en discusión paralela.

## Decisiones tomadas (brainstorm)

| # | Decisión | Por qué |
|---|---|---|
| 1 | **Scope**: feature de plataforma per-venue configurable | Mindform primero, pero cualquier venue puede encender. Encaja con plan de tiers. |
| 2 | **Identificación**: código único por cliente como mecanismo primario, búsqueda por nombre/teléfono como fallback | Elimina ambigüedad de nombres duplicados, shareable por WhatsApp, auditable. Search fallback cubre el caso humano "no tengo el código". |
| 3 | **Modelo de premio**: tiers basados en conteo de referidos (no puntos) | Matchea el PDF de Sumi. Más simple, mecánica visual clara de "subir nivel". Puntos quedan como opción V2 si se pide. |
| 4 | **Tier-up moment**: card digital PNG + modal de celebración en dashboard + WhatsApp/email al cliente | Es el "5-second visceral" (Norman). Sin esto el programa se siente como bookkeeping. |
| 5 | **Share UX**: dashboard (botón compartir) + email welcome + signature en cada email de booking + WhatsApp on-demand | Cobertura alta, fricción mínima. El cliente que se acuerda el domingo en casa tiene cómo llegar al código. |
| 6 | **Legacy customers**: auto-generar códigos para todos al activar + CSV export para campaña manual | 500 clientes leales se vuelven 500 referidores potenciales día 1. CSV evita construir broadcast masivo (es otra feature aparte). |
| 7 | **Tono visual**: personas primero, números después | Mindform es boutique. Hall of Fame con foto/avatar y top referidor con nombre. Anti-slop explícito. |
| 8 | **Anti-fraude**: rechazo de auto-referido (no override), rechazo de cliente existente (con override de manager + audit log), refund → VOID con clawback de cupón si no redimido | Protege el sistema sin volverlo rígido. Escape hatch controlado. |

## Arquitectura

### Modelo de datos (Prisma)

#### Cambios al modelo `Customer`

```prisma
model Customer {
  // ...campos existentes...

  // Referral program — 6 campos nuevos
  referralCode         String?       // formato VENUE-NAMEN-RND3, único por venue
  referralCount        Int           @default(0)
  referralTier         ReferralTier? // null | TIER_1 | TIER_2 | TIER_3
  tierUnlockedAt       DateTime?
  tierUpModalSeenAt    DateTime?     // para mostrar modal celebración solo 1 vez por unlock
  referredByCustomerId String?
  referredByCustomer   Customer?     @relation("CustomerReferredBy", fields: [referredByCustomerId], references: [id], onDelete: SetNull)
  referredCustomers    Customer[]    @relation("CustomerReferredBy")

  referralsAsReferrer  Referral[]    @relation("ReferralsAsReferrer")
  referralsAsReferred  Referral[]    @relation("ReferralsAsReferred")

  @@unique([venueId, referralCode])
}
```

#### Nueva tabla `ReferralProgramConfig`

```prisma
model ReferralProgramConfig {
  id      String @id @default(cuid())
  venueId String @unique
  venue   Venue  @relation(fields: [venueId], references: [id], onDelete: Cascade)

  active      Boolean   @default(false)
  activatedAt DateTime?

  // Premio al referido (su primera compra)
  newCustomerDiscountPercent Decimal @default(10) @db.Decimal(5, 2)

  // 3 tiers (defaults = los del PDF de Mindform)
  tier1ReferralsRequired Int     @default(7)
  tier1RewardPercent     Decimal @default(15) @db.Decimal(5, 2)
  tier2ReferralsRequired Int     @default(12)
  tier2RewardPercent     Decimal @default(20) @db.Decimal(5, 2)
  tier3ReferralsRequired Int     @default(20)
  tier3RewardPercent     Decimal @default(25) @db.Decimal(5, 2)

  // Vigencia del cupón emitido al desbloquear tier
  rewardCouponExpiryDays Int @default(90)

  // Templates editables por venue
  welcomeMessageTemplate String? @db.Text
  tierUpMessageTemplate  String? @db.Text

  // Prefijo del código de referido (default = uppercase del venue slug, max 8)
  codePrefix String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

#### Nueva tabla `Referral`

```prisma
model Referral {
  id      String @id @default(cuid())
  venueId String
  venue   Venue  @relation(fields: [venueId], references: [id], onDelete: Cascade)

  referrerCustomerId String
  referrerCustomer   Customer @relation("ReferralsAsReferrer", fields: [referrerCustomerId], references: [id], onDelete: Cascade)

  referredCustomerId String
  referredCustomer   Customer @relation("ReferralsAsReferred", fields: [referredCustomerId], references: [id], onDelete: Cascade)

  status ReferralStatus @default(PENDING)

  // Auditoría: quién capturó (staff en TPV / manager en dashboard)
  capturedByStaffVenueId String?
  capturedByStaffVenue   StaffVenue? @relation("ReferralsCaptured", fields: [capturedByStaffVenueId], references: [id], onDelete: SetNull)

  // Override de manager (cuando se forzó atribución sobre regla EXISTING_CUSTOMER)
  forcedOverride Boolean @default(false)
  overrideReason String? @db.Text

  // El order cuyo PAID gatilla la calificación
  qualifyingOrderId String?
  qualifyingOrder   Order?  @relation(fields: [qualifyingOrderId], references: [id], onDelete: SetNull)
  qualifiedAt       DateTime?

  // Void state
  voidedAt   DateTime?
  voidReason String? @db.Text

  // Si gatilló un cupón al desbloquear tier
  rewardCouponId String?
  rewardCoupon   Coupon? @relation(fields: [rewardCouponId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())

  @@index([venueId])
  @@index([referrerCustomerId])
  @@index([referredCustomerId])
  @@index([status])
}

enum ReferralStatus {
  PENDING    // capturado, esperando que el Order se cobre
  QUALIFIED  // Order PAID, referidor recibió crédito
  VOID       // refund, fraude, o anulado manualmente
}

enum ReferralTier {
  TIER_1
  TIER_2
  TIER_3
}
```

#### Reuso del modelo `Coupon` (campos a verificar / posiblemente agregar)

El `Coupon` emitido al desbloquear tier tiene:
- `code`: `{VENUE_PREFIX}-TIER{N}-{customerId.slice(-6).toUpperCase()}`
- `discountType: PERCENT`
- `discountValue: tierNRewardPercent` (de config)
- `expiresAt: now() + rewardCouponExpiryDays`
- `maxRedemptions: 1`
- `customerId: referrerCustomerId`

**Campos del modelo `Coupon` que este spec requiere y deben verificarse contra el schema actual:**

| Campo | Uso en este spec | Acción si no existe |
|---|---|---|
| `Coupon.active: Boolean` | Para revocar cupón en refund flow | Agregar (default `true`) |
| `Coupon.deactivatedReason: String?` | Audit del por qué se revocó (e.g., `'TIER_REVERSED_BY_REFUND'`) | Agregar nullable |
| `Coupon.source: String?` o enum | Distinguir cupones de referidos vs otros (e.g., `'REFERRAL_TIER'`) | Agregar nullable; útil para reports |
| `Coupon.redeemedAt: DateTime?` | Verificar si ya se redimió antes de clawback | Si no existe, derivar de `CouponRedemption.createdAt` |

Estos cambios son **aditivos** y compatibles backward con cupones existentes.

### Generación del `referralCode`

Formato: `{VENUE_PREFIX}-{NAME4}{R3}` — ejemplo `MINDFORM-MARI8K7`.

| Parte | Cómo se construye |
|---|---|
| `VENUE_PREFIX` | `ReferralProgramConfig.codePrefix` o uppercase del venue slug (max 8 chars) |
| `NAME4` | Primeras 4 letras del nombre normalizadas (Unicode → ASCII, sin espacios, sin acentos, padded con X) |
| `R3` | 3 chars random del pool `[A-HJ-NP-Z2-9]` (28 caracteres, sin 0/O/I/1/S/5 confundibles) |

Edge cases en generación:
- Customer sin nombre → `NAME4 = "ANON"`
- Nombre corto (`Li`, `An`) → padding con X (`LIXX`, `ANXX`)
- Colisión → retry hasta 5 veces con otro `R3`, fail-loud después con log de error
- Venue cambia su `codePrefix` después → códigos existentes intactos (estables); solo nuevos llevan el prefix nuevo

### Endpoints backend (`avoqado-server`)

Todos bajo `/api/v1/dashboard/venues/:venueId/referrals/...` con permisos correspondientes.

#### Activación / configuración

```
POST   /referrals/activate          { tier values, premios, codePrefix? }
PATCH  /referrals/config            { ...partial }
POST   /referrals/deactivate        { reason }
GET    /referrals/config            → ReferralProgramConfig
GET    /referrals/export-csv        → streaming CSV de Customers con códigos
```

#### Captura y calificación

```
POST   /referrals/validate          { referralCode, newCustomerId }
                                      → { valid: bool, referrer?, reason? }

POST   /referrals/capture           { referralCode, newCustomerId,
                                      capturedByStaffVenueId, intendedOrderId? }
                                      → Referral (status PENDING)

POST   /referrals/:id/manual-void   { reason }
                                      → Referral (status VOID)

POST   /referrals/:id/force-override { reason }
                                      → Referral con forcedOverride=true
```

#### Reads

```
GET    /referrals?status=&tier=&dateFrom=&dateTo=&page=
                                      → paginated list
GET    /referrals/summary             → KPIs del mes
GET    /referrals/hall-of-fame?limit=10
                                      → top referidores por count
GET    /customers/search?q=          → para buscar referidor por nombre/tel (con referralCode incluido)
```

#### Customer-scoped

```
POST   /customers/:id/generate-code  → genera referralCode si null (legacy reactivation)
GET    /customers/:id/referrals      → lista de Referrals donde este customer es referrer
POST   /customers/:id/dismiss-tier-modal → set tierUpModalSeenAt = now()
POST   /customers/:id/share-code-whatsapp { messageOverride? }
                                      → manda mensaje + card al teléfono del customer
```

### Servicios principales (`avoqado-server/src/services/referrals/`)

Estructura modular siguiendo el patrón del proyecto:

```
src/services/referrals/
├── referralCode.service.ts         # generateCode, validateCodeFormat, retry on collision
├── referralProgram.service.ts      # activate, deactivate, migrateLegacyCustomers, updateConfig
├── referralCapture.service.ts      # validate, capture, applyDiscountToOrder, manualVoid
├── referralQualification.service.ts # onOrderPaid, qualifyReferral, computeTier, emitTierCoupon
├── referralRefund.service.ts       # onOrderRefunded, voidReferral, revokeTierCoupon, recomputeTier
├── referralCard.service.ts         # generateCard (satori+sharp), uploadToR2, getCardUrl
├── referralNotification.service.ts # sendWelcomeMessage, sendTierUpMessage, sendCouponExpiringReminder
└── referralCsvExport.service.ts    # streaming CSV de Customers con códigos
```

Hooks en servicios existentes:
- `customerService.create`: si venue tiene programa activo, genera `referralCode` automáticamente
- `orderService.markAsPaid`: dispara `referralQualification.onOrderPaid`
- `orderService.refund`: dispara `referralRefund.onOrderRefunded`

## UI Dashboard

### Pantalla `Clientes › Programa de Referidos` (post-activación)

2 tabs: **Resumen** (default) y **Configuración**.

#### Tab Resumen

```
┌─ Programa de Referidos · Resumen ──────────────────────────────────┐
│                                                                    │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│ │ Referidos    │ │ Conversión   │ │ Premios      │ │ Top refe-  │ │
│ │ este mes     │ │ del mes      │ │ emitidos     │ │ ridor      │ │
│ │              │ │              │ │              │ │  ┌──┐      │ │
│ │     12       │ │     85%      │ │       3      │ │  │MP│ Jose │ │
│ │  ↑3 vs prev  │ │  10 de 12    │ │  2 redimidos │ │  └──┘ 5 ref│ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │
│                                                                    │
│ ─── Hall of Fame ─── (top 10 del mes)                              │
│ Grid de tarjetas con avatar/initials, nombre, conteo, badge tier   │
│ Horizontal scroll en mobile                                        │
│                                                                    │
│ ─── Referidos recientes ───  [Filtrar ▼] [Buscar...]              │
│ Tabla DataTable: Fecha | Referidor | Referido | Estado | Premio    │
│ Columnas memoizadas (regla performance del CLAUDE.md)              │
└────────────────────────────────────────────────────────────────────┘
```

**Decisiones visuales clave (anti-slop):**
- KPI strip usa `MetricCard` existente, **pero la 4ª card es distinta**: muestra avatar + nombre del top referidor (rompe el patrón "3 widgets idénticos")
- Hall of Fame es horizontal scroll en mobile, no grid rígido
- Tier badges: ⭐ (Nivel 1), ⭐⭐ (Nivel 2), ⭐⭐⭐ (Nivel 3) — estrellas redundantes a color para a11y
- Sin `bg-gradient-to-*` (regla #15 del CLAUDE.md)
- Filtros con `<FilterPill>` (Stripe pattern del `ui-patterns.md`)

#### Tab Configuración

Banner verde "✓ Activo desde {fecha} · {N} clientes con código". Tabla editable in-place con los valores de tiers, % premios, vigencia. Botón `Descargar CSV de clientes`. Toggle peligroso `Pausar programa` con modal de confirmación + razón obligatoria.

### Card inline en `CustomerDetail.tsx`

Tres estados según el cliente:

**Estado A — Customer sin tier desbloqueado:**

```
┌─ 🎁 Programa de Referidos ─────────────────────────┐
│  MINDFORM-MARI8K7      [📋 Copiar] [📱 WhatsApp]  │
│  ▓▓░░░░░░░░  2 de 7 hacia Nivel 1                 │
│  Referida por Jose Pérez →                         │
└────────────────────────────────────────────────────┘
```

**Estado B — Customer con tier desbloqueado:**

```
┌─ 🎁 Programa de Referidos ─────────────────────────┐
│  ⭐ Nivel 1 · desde 23 Mar  · Cupón 15% activo ✓   │
│  MINDFORM-MARI8K7      [📋 Copiar] [📱 WhatsApp]  │
│  ▓▓▓▓▓▓▓▓▓░░  9 de 12 hacia Nivel 2               │
│  Referida por Jose Pérez →                         │
│  Ha referido a 9 personas  [Ver lista ▼]          │
└────────────────────────────────────────────────────┘
```

**Estado C — Customer legacy sin código aún:**

```
┌─ 🎁 Programa de Referidos ─────────────────────────┐
│  Esta clienta aún no tiene código activo.         │
│         [Activar código ahora]                    │
└────────────────────────────────────────────────────┘
```

### Modal celebración tier-up

Trigger: cuando el manager abre `CustomerDetail` de un cliente que cruzó tier por primera vez después del unlock (`tierUnlockedAt > tierUpModalSeenAt` OR `tierUpModalSeenAt is null`).

Contenido:
- ✨ Confetti subtle 1.5s (respeta `prefers-reduced-motion`)
- Badge tier animado de gris → color con `scale 0.8 → 1`
- Nombre del cliente + tier desbloqueado + número de referidos
- Preview del tier-up card PNG
- Info del cupón emitido (% + vigencia)
- Confirmación "Notificación al cliente: ya enviada por WhatsApp"
- Botón `Mandar felicitación personal por WhatsApp` (abre wa.me con draft prellenado)
- Botón `Solo cerrar`

Al cerrar: `POST /customers/:id/dismiss-tier-modal` → `tierUpModalSeenAt = now()`.

### Tokens del design system

| Elemento | Token / componente | Notas |
|---|---|---|
| Container card | `<GlassCard>` con `border-input` | Regla CLAUDE.md sobre borders subtle |
| Tier badge | `<Badge>` con `bg-amber-100 text-amber-900` Lv1, escalando | ⭐ icon es señal redundante a color |
| Progress bar | `<Progress>` de Radix UI con `bg-primary` fill plano | Sin gradient (regla #15) |
| Botón WhatsApp | `<Button variant="outline" size="sm">` + `<MessageCircle>` | Inline action |
| Avatar | `<Avatar>` con `<AvatarFallback>` 2 letras | Hall of Fame sin foto |
| Code text | `<code className="font-mono text-sm">` | Monospace para distinguir |
| Empty Hall of Fame | Ilustración + CTA + texto cálido | Warmth-first |

### i18n

Nuevo namespace `referrals` en `src/locales/{en,es}/referrals.json` (mínimo es + en; fr si el namespace existe). Todas las cadenas con `t('referrals.xxx')`. ESLint `no-missing-translation-keys.js` valida.

### Onboarding tour (`driver.js`)

Tour de 4 pasos al activar por primera vez, hook `useReferralProgramOnboardingTour`. Selectors `data-tour="referrals-kpi-strip"`, `data-tour="referrals-hall-of-fame"`, `data-tour="referrals-recent-table"`, `data-tour="referrals-config-tab"`. Patrón de `useProductCreationTour` (regla #16 del CLAUDE.md).

### Responsive

| Breakpoint | KPI strip | Hall of Fame | Tabla |
|---|---|---|---|
| Desktop ≥1024px | 4 columnas | Grid 5×2 | Table |
| Tablet 768-1023px | 2×2 grid | Horizontal scroll | Table con scroll-x |
| Mobile <768px | 1 columna stack | Horizontal scroll | Cards vertical |

### Accesibilidad

- Progress bar: `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`
- Botones de share: `aria-label` descriptiva
- Tabla con `<th scope="col">`, filas focusable, Enter → CustomerDetail
- Tier badges: NUNCA color-only (estrella + texto + color)
- Touch targets ≥44×44px mobile
- Modal celebración: trap focus, ESC cierra, respeta `prefers-reduced-motion`

## Captura en TPV (cross-repo: `avoqado-tpv`)

> La UI vive en `avoqado-tpv` (Kotlin/Compose). Deploy 3-5 días por firma PAX. Este spec define los endpoints + contratos que TPV consume.

### UX en TPV (pantalla Cobrar)

Campo nuevo "¿Te recomendó alguien?" aparece solo si `ReferralProgramConfig.active = true` para el venue:

```
┌──────────────────────────────────────────┐
│  Cobrar                                  │
│  Cliente: [María López, 5511224455] [+]  │
│                                          │
│  ¿Te recomendó alguien? (opcional)       │
│  ┌────────────────────────────────────┐ │
│  │ MINDFORM-JOSE2K7   [✓ Validar]    │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ✓ Referido por Jose Pérez               │
│  Se aplicó 10% de descuento ($50 MXN)    │
│                                          │
│  Total: $450 MXN                         │
│  [Cobrar]                                │
└──────────────────────────────────────────┘
```

Si el staff no se sabe el código: botón secundario `Buscar por nombre` → modal con search → lista de candidatos → selecciona → toma su `referralCode`.

### Coordinación cross-repo

- **Avoqado envía** `X-App-Version-Code` ya hoy. Backend puede gate el campo basado en versión mínima.
- **Backend NO remueve ni renombra** ningún campo del response existente (CLAUDE.md ecosystem rule).
- Mensaje en activación del programa: "Activación toma efecto en TPV en 3-5 días. Mientras tanto, captura referidos manualmente desde CustomerDetail."

## Comunicación al cliente

### Card digital PNG

**Variantes (Instagram square 1080×1080):**
1. **Welcome card** — al crear Customer con código (logo Mindform + nombre + código + explicación del 10%)
2. **Tier-up card** — al desbloquear tier (logo + nombre + tier badge + conteo + cupón + vigencia)

**Stack:** `satori` (HTML/JSX → SVG) + `sharp` (SVG → PNG). Generación async, queue de jobs. <100ms por card.

**Storage:** Cloudflare R2 / S3 existente bajo `media.avoqado.io/referrals/cards/{customerId}-{kind}.png`. Cacheable, re-fetcheable. URL estable.

### WhatsApp (canal primario)

> **Riesgo identificado:** verificar que avoqado-server tiene WhatsApp Business API integrada (`messaging.service.ts` o equivalente). Si no, V1 sin WhatsApp proactivo, solo email + dashboard. Card PNG siempre se genera para envío manual.

**Eventos:**

| Evento | Mensaje | Adjunto |
|---|---|---|
| Customer creado con código | Plantilla `welcomeMessageTemplate` (configurable) | Welcome card PNG |
| Tier-up calificado | Plantilla `tierUpMessageTemplate` (configurable) | Tier-up card PNG |
| Cupón a 7 días de expirar | Mensaje fijo de recordatorio | — |

**Templates default (es-MX, editables):**

```
welcomeMessageTemplate:
"¡Hola {{customerName}}! 🌿 Bienvenida a {{venueName}}.
Tu código de referido es *{{referralCode}}*.
Compártelo: cada amiga que lo use recibe 10% en su primera compra,
y tú acumulas referidos hacia premios exclusivos."

tierUpMessageTemplate:
"¡{{customerName}}, lograste el Nivel {{tierLevel}}! ⭐
Refiriste a {{tierThreshold}} personas a {{venueName}}.
Tu premio: {{tierPercent}}% de descuento en tu próxima compra
(válido {{couponExpiryDays}} días). Código: {{couponCode}}"
```

Variables `{{...}}` con allowlist server-side; sin riesgo de injection.

### Email (canal secundario, siempre activo)

3 touchpoints:

1. **Email welcome** al crear cuenta con código — HTML branded + card PNG inline + deep link wa.me
2. **Email tier-up** al desbloquear — card tier-up + cupón code + cómo redimirlo
3. **Signature en TODOS los emails transaccionales existentes** — footer pequeño con código + botón compartir WhatsApp. Convierte cada email transaccional en micro-touchpoint de share.

### Anti-spam / consent

- `Customer.marketingConsent: true` requerido para WhatsApp/email proactivos.
- `marketingConsent: false`:
  - WhatsApp/email NO se manda.
  - Código aparece en dashboard (staff lo da en persona).
  - Footer en email transaccional SÍ va (no es marketing, es info de su cuenta).

## Reglas de negocio (anti-fraude)

| Regla | Comportamiento | Permite override de manager |
|---|---|---|
| **Self-referral** | Si `newCustomerId === referrer.customerId` → `400 SELF_REFERRAL` | ❌ No |
| **Cliente existente** | Si newCustomer tiene cualquier `Order` previa en el venue → `400 EXISTING_CUSTOMER` | ✅ Sí (con razón + audit log) |
| **Código de otro venue** | `@@unique([venueId, ...])` — código de venue B en venue A → `404 CODE_NOT_FOUND` | ❌ No (estructural) |
| **Una sola atribución por order** | Único `referralId` por Order; reemplazo solo con confirmación | ✅ Sí |
| **Programa pausado** | `config.active = false` → `409 PROGRAM_INACTIVE`. Campo en TPV no aparece. | ❌ No |

### Manager escape hatch (regla EXISTING_CUSTOMER)

Permiso `referral:override-existing-customer`. Modal en TPV: campo razón obligatoria → submit → `Referral { forcedOverride: true, overrideReason }` + audit log. **10% NO se aplica al Order** (no es realmente "primera compra"), pero el referidor SÍ recibe crédito.

### Qualification (Order PAID → referidor recibe crédito)

```ts
async function onOrderPaid(order: Order) {
  const referral = await prisma.referral.findFirst({
    where: { qualifyingOrderId: order.id, status: 'PENDING' },
  })
  if (!referral) return

  await prisma.referral.update({
    where: { id: referral.id },
    data: { status: 'QUALIFIED', qualifiedAt: new Date() },
  })

  const referrer = await prisma.customer.update({
    where: { id: referral.referrerCustomerId },
    data: { referralCount: { increment: 1 } },
  })

  const newTier = computeTier(referrer.referralCount, venueConfig)
  if (newTier && newTier !== referrer.referralTier) {
    const coupon = await emitTierCoupon(referrer, newTier, venueConfig)
    await prisma.customer.update({
      where: { id: referrer.id },
      data: { referralTier: newTier, tierUnlockedAt: new Date(), tierUpModalSeenAt: null },
    })
    await prisma.referral.update({
      where: { id: referral.id },
      data: { rewardCouponId: coupon.id },
    })
    await sendTierUpNotification(referrer, newTier, coupon)
  }
}
```

### Refund / void (reversibilidad)

```ts
async function onOrderRefunded(order: Order) {
  const referral = await prisma.referral.findFirst({
    where: { qualifyingOrderId: order.id, status: 'QUALIFIED' },
  })
  if (!referral) return

  await prisma.referral.update({
    where: { id: referral.id },
    data: { status: 'VOID', voidedAt: new Date(), voidReason: 'ORDER_REFUNDED' },
  })

  const referrer = await prisma.customer.update({
    where: { id: referral.referrerCustomerId },
    data: { referralCount: { decrement: 1 } },
  })

  const newTier = computeTier(referrer.referralCount, venueConfig)
  if (newTier !== referrer.referralTier) {
    if (referral.rewardCouponId) {
      const coupon = await prisma.coupon.findUnique({ where: { id: referral.rewardCouponId } })
      if (coupon && !coupon.redeemedAt) {
        await prisma.coupon.update({
          where: { id: coupon.id },
          data: { active: false, deactivatedReason: 'TIER_REVERSED_BY_REFUND' },
        })
      }
      // Si ya se redimió: NO se clawback al cliente; se marca Referral con nota
    }
    await prisma.customer.update({
      where: { id: referrer.id },
      data: { referralTier: newTier, tierUnlockedAt: newTier ? referrer.tierUnlockedAt : null },
    })
  }
}
```

## Edge cases consolidados

| Categoría | Caso | Comportamiento |
|---|---|---|
| **Código** | Customer sin nombre | `NAME4 = "ANON"` |
| | Nombre con acentos | Normalize Unicode → ASCII |
| | Nombre corto | Padding con X |
| | Colisión | Retry 5 veces con otro R3, fail-loud |
| | Venue cambia codePrefix | Códigos existentes estables; nuevos llevan prefix nuevo |
| **Referral** | Cliente nunca paga | PENDING indefinido; manager puede void manual |
| | Order pagado parcialmente | Solo cambio a `PAID` (no PARTIAL_PAID) califica |
| | Múltiples intentos sobre mismo Order | Único `referralId`; reemplazo con confirmación |
| | Cliente existió pero sin Order | Regla `EXISTING_CUSTOMER` chequea `firstVisitAt` + `Order.count > 0` |
| | Refund antes de redimir cupón | Cupón se revoca, tier puede bajar |
| | Refund después de redimir | Referral → VOID, NO clawback al cliente que ya usó cupón |
| **Tier** | Customer exactly 7 referidos | Desbloquea TIER_1 |
| | Customer brinca de 6 a 12 | Solo desbloquea TIER_2 (no emite cupones de TIER_1 + TIER_2 en cascada) |
| | Manager sube threshold después | Customers existentes **grandfathered** (no se les baja por cambio retroactivo) |
| | Tier 1 + Tier 2 cupón activos | Coexisten hasta expirar; cliente decide cuál usar |
| **Config** | Tier 2 requires ≤ Tier 1 requires | Validación Zod rechaza |
| | Tier 2 % < Tier 1 % | Validación advierte pero permite |
| | Negative numbers | Schema rechaza |
| **Multi-venue** | Customer en venue A y B | Cada venue le da código distinto; counts y tiers son per-venue |
| | Código de venue B en venue A | `404 CODE_NOT_FOUND` (estructural) |

## Permisos (`avoqado-server/src/lib/permissions.ts`)

Permisos nuevos:

```ts
'referral:read'
'referral:configure'
'referral:override-existing-customer'
'referral:void-manual'
'referral:export-csv'
```

Mapping al role hierarchy:

| Rol | read | configure | override | void | export |
|---|---|---|---|---|---|
| VIEWER | ✓ | | | | |
| HOST | ✓ | | | | |
| WAITER | ✓ | | | | |
| CASHIER | ✓ | | | | |
| KITCHEN | | | | | |
| MANAGER | ✓ | | ✓ | | |
| ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ |
| OWNER | ✓ | ✓ | ✓ | ✓ | ✓ |
| SUPERADMIN | bypass | bypass | bypass | bypass | bypass |

**White-label:** mapping en `avoqado-server/src/services/access/access.service.ts` (`PERMISSION_TO_FEATURE_MAP`) → nueva feature code `REFERRAL_PROGRAM`.

## Telemetría

Eventos a tracking (infra existente de Avoqado):

```ts
'referral_program_activated'         // { venueId, defaultsModified: bool }
'referral_code_captured'             // { venueId, referrerCustomerId, source: 'tpv' | 'manual' }
'referral_qualified'                 // { referralId, daysFromCapture: number }
'referral_tier_unlocked'             // { customerId, tier: 'TIER_1' | 'TIER_2' | 'TIER_3' }
'referral_coupon_redeemed'           // { couponId, customerId, tier }
'referral_voided'                    // { referralId, reason: 'REFUND' | 'MANUAL' | 'FRAUD' }
'referral_tier_up_modal_dismissed'   // { customerId, secondsBeforeDismiss }
'referral_card_shared_whatsapp'      // { customerId, source: 'dashboard' | 'tpv' }
'referral_csv_exported'              // { venueId, customerCount }
```

KPIs internos de Avoqado:
- Activation rate (% Customers con código del total del venue)
- Conversion rate (% PENDING → QUALIFIED dentro de 30 días)
- Tier unlock distribution (% en TIER_1/2/3/sin tier)
- Coupon redemption rate (% emitidos que se redimen antes de expirar)
- Refund-driven void rate (% Referrals que terminan en VOID por refund)

## Testing strategy

| Capa | Cobertura mínima | Herramienta |
|---|---|---|
| **Unit (backend)** | `generateReferralCode`, `computeTier`, `qualifyReferral`, `voidReferral`, `emitTierCoupon`, retry de colisión | Jest existente |
| **Integration (backend)** | Flujo completo: capture → PENDING → qualify on payment → tier-up → coupon emit. Refund flow. Anti-fraud rejections. | Jest + supertest |
| **E2E (dashboard)** | Activación flow, edición config, 3 estados CustomerDetail card, modal celebración (mocked), Hall of Fame con 0/few/many | Playwright (`npm run test:e2e`) |
| **TPV (cross-repo)** | Captura código + búsqueda nombre + validación + manager override | Manual + Espresso en avoqado-tpv |
| **Performance** | Migración 1000 customers <2s; PNG card gen <100ms; CustomerDetail load no regresiona | Benchmark inline + Lighthouse |

Tests de regresión (regla `bug-fix-workflow.md`): cada bug → test que falla sin fix, pasa con él.

## Rollout plan

**Mindform primero, feature flag globalmente.**

- **Fase 0 (días 1-3)**: Backend con migrations + endpoints + servicios detrás de flag `REFERRAL_PROGRAM_ENABLED` (default OFF). Tests unit + integration verdes.
- **Fase 1 (día 4)**: Deploy backend + dashboard a `staging.api.avoqado.io` + `staging.dashboard.avoqado.io` desde `develop`. QA con seed data.
- **Fase 2 (día 5)**: Deploy TPV inicia ventana 3-5 días firma PAX. Backend ya soporta endpoints (no rompe staging).
- **Fase 3 (días 5-8)**: Probar end-to-end en demo env con Mindform sample data. Sesión 30 min con Sumi para training.
- **Fase 4 (día 9+)**: Merge a `main` → prod. Activar flag SOLO para `venue.slug = 'mindform'` vía SuperadminV2. Monitor 2 semanas.
- **Fase 5 (post-Mindform)**: Si métricas son sanas, abrir a otros venues vía pricing tier (encaja con plan de tiers).

## Riesgos identificados

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| WhatsApp Business API no implementado en avoqado-server | Media (necesita verificación) | V1 sin WhatsApp proactivo, solo email + dashboard. Card PNG se genera siempre para envío manual. |
| TPV deploy delay rompe la experiencia | Alta (ventana 3-5 días) | Mensaje en activación: "Captura manualmente desde CustomerDetail durante ventana de deploy" |
| Migración pesada en venues grandes | Baja (Mindform es chico) | Batch chunks de 100, background job si >500 customers |
| Spam perception en broadcast | Media | Template default es opt-in suave; manager edita antes; `marketingConsent` se respeta |
| Manager cierra modal celebración rápido sin entender | Media | NO dismiss-on-blur; click explícito; animación corta 1.5s |

## NOT in scope (V2 / futuro)

| Feature | Razón de exclusión |
|---|---|
| Modelo de **puntos** (alternativa a tiers) | Sumi pidió tiers en PDF; agregar puntos duplica mecánicas y confunde |
| Customer-facing portal (`mindform.com/mi-cuenta`) | Mindform no tiene portal hoy; los touchpoints (dashboard + email + WhatsApp) cubren V1 |
| Broadcast WhatsApp/email masivo automatizado | Construir sistema de envío masivo es feature aparte. CSV export cubre V1. |
| Botón "Imprimir card física" desde dashboard | PNG ya se descarga; manager imprime externamente |
| Home widget "Top referidor" | Agregar V2 si vemos uso real del feature en Mindform |
| Página Reportes separada con gráficas | Consolidada en tab Resumen de la página principal |
| Múltiples tier levels más allá de 3 | Mindform pidió 3; aumentar requiere repensar UI |
| Referidos cross-venue (Customer refiere a venue B desde venue A) | Modelo es per-venue por diseño; cross-venue es otra mecánica |
| Tier de "embajador" / programa de afiliados | Es B2B con comisiones y contratos; modelo distinto al programa C2C |
| Integración con redes sociales (auto-post de tier-up) | Card PNG es manual share por ahora; integración OAuth es V2 |

## Qué ya existe que vamos a reusar (resumen)

- **`Customer` model**: agregamos 5 campos
- **`Coupon` + `CouponRedemption`**: emitimos `Coupon` al tier-up
- **`Discount`**: el 10% al referido en su primera compra
- **`CustomerGroup`**: opcional, Mindform puede etiquetar por tier
- **`MetricCard`, `GlassCard`, `Badge`, `Progress`, `Avatar`, `DataTable`, `FilterPill`**: componentes del design system
- **`useVenueDateTime`**: para fechas timezone-aware (regla CLAUDE.md)
- **`useAccess`**: para gates de permisos
- **`useCurrentVenue` (`fullBasePath`)**: white-label compat
- **`driver.js`**: onboarding tour pattern existente
- **i18n infra**: `src/locales/{en,es}/`, hook `useTranslation`, ESLint rule
- **Sistema de email transaccional**: para welcome, tier-up, signature
- **Cloudflare R2 / S3 media**: para hospedar PNGs
- **Queue de jobs (Bull/Redis)**: para card generation + notification dispatch
- **Auditoría existente**: para override de manager y void manual
- **Analytics/Telemetry infra**: Mixpanel/Segment (lo que use Avoqado)

## Open questions a confirmar con Jose antes de implementar

1. **WhatsApp Business API**: ¿avoqado-server tiene integración hoy? Si no, V1 cae a email-only y el WhatsApp del cliente se manda manualmente desde el botón "compartir" del manager. **Impacto:** define alcance de Sección "Comunicación al cliente".
2. **Campos del modelo `Coupon`** (`active`, `deactivatedReason`, `source`, `redeemedAt`): verificar cuáles ya existen en el schema actual y cuáles requieren migration aditiva como parte de este spec. **Impacto:** scope de la migration inicial.
3. **Template engine de email transaccional**: ¿permite inyectar una signature global en el footer de TODOS los emails existentes? Si no, agregar la signature requiere refactor de cada template uno por uno. **Impacto:** estimación de Sección "Email - signature en transaccionales".
4. **PNG generation server-side**: ¿hay infra existente (Avoqado server-side rendering, Cloudinary, etc.)? Si no, decidir entre `satori`+`sharp` instalado en avoqado-server vs servicio externo. **Impacto:** dependencias nuevas y deploy.
5. **Object storage para PNGs**: ¿qué bucket/CDN usa Avoqado para media de venues hoy? El spec asume Cloudflare R2 / S3 bajo `media.avoqado.io`. Verificar y ajustar URL pattern. **Impacto:** servicio `referralCard.service.ts`.
6. **Analytics platform**: ¿Mixpanel, Segment, PostHog, o propio? El spec lista eventos pero el implementador debe traducirlos al SDK que usa Avoqado.

## Referencias

- Brainstorm conversation: este chat (2026-05-28)
- PDF de Sumi: "Programa Referidos Mindform" (image attached)
- WhatsApp conversation: Sumi ↔ Jose, 22 May 2026
- `prisma/schema.prisma` (avoqado-server) líneas 4795-4985 (Customer + LoyaltyConfig + LoyaltyTransaction)
- `docs/guides/DESIGN_SYSTEM_GUIDE.md`
- `.claude/rules/critical-warnings.md` (i18n, theme, permisos, UI patterns, no gradients, onboarding tours)
- `CLAUDE.md` workspace + per-repo
