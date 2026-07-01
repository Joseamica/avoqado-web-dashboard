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
export function trackSignup(method = 'email'): void {
  gtag('event', 'sign_up', { method })
}
