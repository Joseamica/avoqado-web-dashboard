// src/lib/demo-tour-capture.ts
/**
 * Demo-tour journey capture (Avoqado Tour → dashboard handoff).
 *
 * The marketing tour at avoqado.io/demo hands off with
 *   /?demoTour=venta-tpv&amountCents=29500&tipCents=5310   (TPV journey)
 *   /?demoTour=reserva                                     (booking journey)
 * but the auth + venue-resolution redirect chain drops the query string long
 * before the dashboard shell (and `useDemoTour`) mounts. So the journey is
 * captured HERE, at the app entry point (called from main.tsx before React
 * renders), stashed in sessionStorage, and the params stripped immediately.
 * `useDemoTour` fires from the stash once the demo venue context resolves.
 *
 * Kept dependency-free so importing it in main.tsx adds nothing to the entry
 * chunk (driver.js etc. stay lazy inside the hook).
 */

export const TOUR_PARAM = 'demoTour'
export const VENTA_TPV_TOUR = 'venta-tpv'
export const RESERVA_TOUR = 'reserva'
export const VALID_TOURS = [VENTA_TPV_TOUR, RESERVA_TOUR] as const
export type DemoTourJourney = (typeof VALID_TOURS)[number]

/** One fired-flag per journey so each demo can run once per tab session. */
export const firedKey = (journey: string) => `avoqado-demo-tour-${journey}`
export const SESSION_PENDING_KEY = 'avoqado-demo-tour-pending'

export const DEFAULT_AMOUNT_CENTS = 29500
export const DEFAULT_TIP_CENTS = 5310
export const MIN_AMOUNT_CENTS = 100 // $1.00
export const MAX_CENTS = 99_999_900 // $999,999.00

export interface PendingDemoTour {
  journey: DemoTourJourney
  amountCents?: number
  tipCents?: number
}

export function parseCents(raw: string | null, fallback: number, min: number): number {
  if (raw == null || raw === '') return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.round(parsed), min), MAX_CENTS)
}

/** Stash the demo-tour params (if present) and strip them from the URL. Safe to call always. */
export function captureDemoTourParams(): void {
  try {
    const url = new URL(window.location.href)
    const journey = url.searchParams.get(TOUR_PARAM)
    if (!journey || !(VALID_TOURS as readonly string[]).includes(journey)) return

    if (sessionStorage.getItem(firedKey(journey)) !== '1') {
      const pending: PendingDemoTour = { journey: journey as DemoTourJourney }
      if (journey === VENTA_TPV_TOUR) {
        pending.amountCents = parseCents(url.searchParams.get('amountCents'), DEFAULT_AMOUNT_CENTS, MIN_AMOUNT_CENTS)
        pending.tipCents = parseCents(url.searchParams.get('tipCents'), DEFAULT_TIP_CENTS, 0)
      }
      sessionStorage.setItem(SESSION_PENDING_KEY, JSON.stringify(pending))
    }

    url.searchParams.delete(TOUR_PARAM)
    url.searchParams.delete('amountCents')
    url.searchParams.delete('tipCents')
    window.history.replaceState(window.history.state, '', url.toString())
  } catch {
    /* noop — capture must never break app boot */
  }
}
