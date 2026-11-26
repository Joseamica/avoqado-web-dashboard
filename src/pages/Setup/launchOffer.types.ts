/**
 * Formas del contrato de campañas ligeras (§3.3, §3.6 y §4.5 del spec). Se copian TAL CUAL del
 * contrato congelado del servidor.
 *
 * 🔴 Regla dura de este archivo: el dinero viaja en CENTAVOS ENTEROS con IVA incluido, y el
 * dashboard NUNCA lo calcula. Todo lo que se pinta sale de aquí; lo único que hace el dashboard
 * es formatear. Por eso no hay ninguna constante de precio en el dashboard.
 */

export type LaunchOfferUnavailableReason = 'NOT_STARTED' | 'EXPIRED' | 'PAUSED' | 'ENDED' | 'SOLD_OUT' | 'NOT_PUBLISHED'

export interface LaunchOfferView {
  code: string
  slug: string
  offerVersion: number
  vertical: 'ALL' | 'FOOD_SERVICE' | 'RETAIL' | 'SERVICES' | 'HOSPITALITY' | 'ENTERTAINMENT'
  planTier: 'PRO' | 'PREMIUM'
  planName: string
  available: true
  currency: 'MXN'
  ivaIncluded: true
  requiresCard: true
  promo: { monthlyCents: number; months: number; subtotalCents: number; ivaCents: number; periodTotalCents: number }
  renewal: { monthlyCents: number; subtotalCents: number; ivaCents: number }
  firstChargeCents: number
  validUntil: string
  limited: true
  copy: { headline: string | null; subheadline: string | null; bullets: string[] }
}

export interface LaunchOfferUnavailableView {
  code: string
  slug: string
  available: false
  unavailableReason: LaunchOfferUnavailableReason
}

export type LaunchOfferState = LaunchOfferView | LaunchOfferUnavailableView

export function isOfferAvailable(offer: LaunchOfferState | null | undefined): offer is LaunchOfferView {
  return !!offer && offer.available === true
}

/** Precios estándar que publica el servidor en `GET progress` (§4.5). Todos con IVA. */
export interface PlanQuoteTier {
  monthlyCents: number
  annualCents: number
  /** Precio SIN IVA que publica el servidor; opcional (un servidor viejo no lo manda). Nunca se deriva aquí. */
  monthlyNetCents?: number
  annualNetCents?: number
  intro: { monthlyCents: number; months: number; interval: 'monthly'; requiresPayNow: boolean } | null
}

/**
 * Planes editables (B2): una opción de compra que el SERVIDOR cotizó y firmó (`OpcionCotizada` de
 * `opcionesDeCompra.ts`). `quoteToken` es el comprobante que viaja al pagar; los montos son centavos con IVA
 * (`precioCents` = el precio de la versión que se cobrará, también cuando hoy se paga $0).
 */
export interface OpcionCotizada {
  quoteToken: string
  precioCents: number
  netCents: number
  firstChargeCents: number
  /** Fin de la prueba que fijó el SERVIDOR (ISO); `null` = sin prueba, se paga hoy. */
  trialEndsAt: string | null
}

/** Un plan de la versión vigente, como lo cotiza el alta (`PlanCotizado` de `cotizacionDeLaOferta.ts`). */
export interface PlanCotizado {
  displayName: string
  onSale: boolean
  requiresCard: boolean
  trialDays: number
  monthly: OpcionCotizada | null
  annual: OpcionCotizada | null
}

/** La oferta de la versión del editor que publica `GET progress` (`OfertaDelAlta`). Sin versión del editor no viaja. */
export interface OfertaDelAlta {
  versionNumber: number
  free: { displayName: string }
  planes: { PRO: PlanCotizado; PREMIUM: PlanCotizado }
}

export interface PlanQuote {
  currency: 'MXN'
  ivaIncluded: true
  trialDays: number
  tiers: { PRO: PlanQuoteTier; PREMIUM: PlanQuoteTier }
  /** Planes editables (B2): sólo con una versión del editor. Sin ella, el alta es la de hoy. */
  oferta?: OfertaDelAlta
}

/** Lo que la pantalla dice de una tarjeta de Stripe (sin su id). */
export interface TarjetaVisible {
  brand: string | null
  last4: string | null
}

export interface PlanActivationState {
  status: 'NONE' | 'IN_PROGRESS' | 'ACTIVE' | 'DECLINED'
  attempt: number
  activatedAt: string | null
  /** Cómo termina la prueba, leído de la suscripción REAL (aditivo). */
  trialModality?: 'RENEWS_AS_PRO' | 'ENDS_FREE'
  trialEndsAt?: string
  /** Planes editables (B2): la prueba empezó sin tarjeta. Con ella viajan los dos de abajo, leídos de Stripe. */
  sinTarjeta?: true
  /** La tarjeta que Stripe cobraría al terminar (`null` = ninguna). Si Stripe no dejó leerla, NO viaja. */
  tarjetaQueCobrara?: TarjetaVisible | null
  /** Al terminar la prueba no habrá cobro (cancelación programada o cobranza en pausa). */
  noHabraCobro?: boolean
}

export interface LegalState {
  currentVersion: string
  acceptedVersion: string | null
  consentRequired: boolean
}

export interface OnboardingFeatureFlags {
  requiresBaseSubscriptionPlan?: boolean
  shortOnboarding?: boolean
}

/** Cuerpo de `POST …/v2/activate-plan` (§3.6). Discriminado por `offer.kind`. */
export type ActivatePlanOffer =
  | { kind: 'LAUNCH'; code: string; offerVersion: number; expectedFirstChargeCents: number }
  /** `quoteToken`: el comprobante de la opción cotizada; sólo con una versión del editor (planes editables, B2). */
  | { kind: 'STANDARD'; expectedFirstChargeCents: number; quoteToken?: string }

export interface ActivatePlanBody {
  tier: 'PRO' | 'PREMIUM'
  interval: 'monthly' | 'annual'
  payNow: boolean
  paymentMethodId: string
  offer: ActivatePlanOffer
  language?: 'es' | 'en'
  /** Plan Básico: la prueba de Pro que termina sola sin cobrar. Sólo con PRO mensual y `payNow: false`. */
  basicPlan?: boolean
}

/**
 * Planes editables (B2, §16 y §18): la prueba SIN tarjeta. Sin `paymentMethodId` y sin pagar hoy; su comprobante es
 * obligatorio. Sólo existe con una versión del editor (`planQuote.oferta`).
 */
export interface ActivatePlanSinTarjetaBody {
  tier: 'PRO' | 'PREMIUM'
  interval: 'monthly' | 'annual'
  payNow: false
  offer: { kind: 'STANDARD_SIN_TARJETA'; expectedFirstChargeCents: 0; quoteToken: string }
  language?: 'es' | 'en'
}

export interface ActivatePlanResult {
  status: 'ACTIVE'
  alreadyActive: boolean
  tier: 'PRO' | 'PREMIUM'
  interval: 'monthly' | 'annual'
  firstChargeCents: number
  nextChargeAt: string
  launchOffer?: { code: string; offerVersion: number; months: number; renewalMonthlyCents: number }
  /** Plan Básico: cómo termina la prueba, leído de la suscripción REAL. Sin prueba no viaja. */
  trialModality?: 'RENEWS_AS_PRO' | 'ENDS_FREE'
  trialEndsAt?: string
  /** Planes editables (B2): una prueba SIN tarjeta. Con ella viajan, leídos de Stripe en ese momento, los dos de abajo. */
  sinTarjeta?: true
  /** La tarjeta que cobraría al terminar (`null` = ninguna); si Stripe no dejó leerla, no viaja. */
  tarjetaQueCobrara?: TarjetaVisible | null
  /** Al terminar la prueba no habrá cobro (cancelación programada o cobranza en pausa). */
  noHabraCobro?: boolean
}

/** `GET …/v2/tarjeta-de-la-prueba`: la tarjeta que Stripe cobraría al terminar la prueba sin tarjeta, leída al abrir la ventana. */
export interface TarjetaDeLaPrueba {
  tarjeta: { id: string; brand: string | null; last4: string | null } | null
}

/** `POST …/v2/retomar-pago`: el reto del banco del intento a medio pago, o cómo quedó (B2 Task 5). */
export type RetomaDelPago = { estado: 'RETO'; clientSecret: string } | { estado: 'CERRADA' } | { estado: 'NADA' }

/** Códigos de error de `activate-plan` que la pantalla trata de forma distinta (§4.5). */
export type ActivatePlanErrorCode =
  | 'PLAN_PAYMENT_DECLINED'
  | 'PLAN_PAYMENT_REQUIRES_ACTION'
  | 'PLAN_ALREADY_ACTIVATED'
  | 'PLAN_ACTIVE_WITHOUT_OFFER'
  | 'LAUNCH_OFFER_UNAVAILABLE'
  | 'OFFER_CHANGED'
  | 'PLAN_ACTIVATION_IN_PROGRESS'
  | 'PLAN_ACTIVATION_PENDING'
  | 'PLAN_PRICE_MISMATCH'
  | 'PAYMENT_METHOD_MISMATCH'
  | 'LAUNCH_OFFER_NOT_APPLICABLE'
  | 'PLAN_VENUE_NOT_READY'
  // Planes editables (B2): el plan salió de venta o el comprobante ya no sirve (se tratan como `OFFER_CHANGED`), y la prueba
  // sin tarjeta terminó antes de cerrar el alta (el alta quedó en Gratis).
  | 'PLAN_NOT_ON_SALE'
  | 'QUOTE_EXPIRED'
  | 'QUOTE_INVALID'
  | 'PLAN_TRIAL_ENDED'
