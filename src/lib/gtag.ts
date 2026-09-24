// src/lib/gtag.ts
//
// Helpers for the Google tag (gtag.js) loaded in index.html — Google Ads
// (AW-18201754401) + GA4 (G-F6JCDF9K3P). The dashboard is an ad-conversion
// destination (ads → landing → "Empieza ahora" → /signup), so it must carry the
// Google tag and fire the signup event to attribute paid conversions.
//
// Undefined-safe: no-ops if gtag isn't present (SSR / blocked by an ad blocker).

function gtag(...args: unknown[]): void {
  if (typeof window === 'undefined') return
  const w = window as unknown as { gtag?: (...a: unknown[]) => void }
  try {
    w.gtag?.(...args)
  } catch {
    /* never break the app for analytics */
  }
}

/**
 * Fire the GA4 `sign_up` event when an account is created. Mark `sign_up` as a
 * conversion in GA4 → it imports into Google Ads via the linked account, so
 * ad-driven signups attribute without a separate native Ads conversion action.
 */
export function trackSignup(method = 'email', launchOfferCode?: string): void {
  // Configure the MARKETING property just-in-time — it is intentionally NOT
  // configured in index.html, so daily dashboard usage sends NOTHING to it
  // (general usage goes to the product property G-RHVHM6V578 instead).
  // send_page_view:false so this JIT config emits no page_view; the shared
  // .avoqado.io cookies keep the ad-click session/attribution intact.
  gtag('config', 'G-F6JCDF9K3P', { send_page_view: false })
  // sign_up is the ONE event that must land in marketing so it keeps importing
  // into Google Ads as a conversion.
  gtag('event', 'sign_up', { send_to: 'G-F6JCDF9K3P', method, ...(launchOfferCode ? { launch_offer_code: launchOfferCode } : {}) })
}

/**
 * La conversión de DINERO: el primer cobro del plan (§4.5). `sign_up` mide registros; esto mide
 * pagos, que es lo que un anuncio de «$22 al mes» tiene que optimizar.
 *
 * 🔴 `value` va en PESOS, no en centavos: GA4 lo interpreta en la moneda de `currency`, y mandar
 * centavos infla el valor de cada conversión 100 veces y arruina la puja de Ads. El llamador
 * convierte una sola vez, desde los centavos que devolvió el servidor.
 */
export function trackPurchase(valueMXN: number, launchOfferCode?: string): void {
  gtag('config', 'G-F6JCDF9K3P', { send_page_view: false })
  gtag('event', 'purchase', {
    send_to: 'G-F6JCDF9K3P',
    value: valueMXN,
    currency: 'MXN',
    items: [{ item_id: launchOfferCode ?? 'plan' }],
  })
}
