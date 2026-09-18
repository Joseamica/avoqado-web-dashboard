/**
 * Cuál de los montos que mandó el servidor corresponde a lo que el usuario tocó (§3.6, rama
 * STANDARD). Esto **elige**, no calcula: cada valor posible ya venía en `planQuote`.
 *
 * El número viaja como `expectedFirstChargeCents` y es EVIDENCIA de lo que la persona vio. El
 * servidor lo compara con su propia cotización y responde `OFFER_CHANGED` si no coinciden — por
 * eso aquí nunca se inventa un monto: sin cotización se devuelve `null` y no se intenta cobrar.
 */
import type { PlanQuote } from '../launchOffer.types'

export function expectedStandardFirstChargeCents(
  quote: PlanQuote | null | undefined,
  tier: 'PRO' | 'PREMIUM',
  interval: 'monthly' | 'annual',
  payNow: boolean,
): number | null {
  if (!quote) return null
  const t = quote.tiers?.[tier]
  if (!t) return null

  // Prueba gratis: hoy no se cobra nada, sin importar el tier ni la promo.
  if (!payNow) return 0

  const intro = t.intro
  if (intro && interval === intro.interval) return intro.monthlyCents

  return interval === 'annual' ? t.annualCents : t.monthlyCents
}
