import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import api from '@/api'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { isDemoVenueStatus } from '@/types/superadmin'
import { Currency } from '@/utils/currency'

/**
 * Live-demo journey tour: "venta-tpv".
 *
 * A visitor finishes the simulated TPV charge on avoqado.io/demo and clicks
 * "míralo en TU dashboard" → lands on the demo dashboard (live-demo
 * auto-login) with a URL like:
 *
 *   /?demoTour=venta-tpv&amountCents=29500&tipCents=5310
 *
 * `DashboardRouteResolver` preserves the query string when redirecting `/` →
 * `/venues/:slug/home`, so this hook (mounted in the dashboard shell) sees
 * the params once the venue context resolves. It then:
 *
 *   1. POSTs `/api/v1/live-demo/sim/fast-payment` so the visitor's exact
 *      charge appears in the venue via the normal data flow (the endpoint
 *      emits the same socket event as a real TPV payment).
 *   2. Drives a driver.js tour: Ventas sidebar group → Transacciones →
 *      the payments table where THEIR payment just landed.
 *
 * Guards (the hook is inert unless ALL are true):
 *   - `demoTour=venta-tpv` is present in the URL query.
 *   - The active venue is a demo venue (`status` LIVE_DEMO / TRIAL — same
 *     signal `kyc-utils` uses via `isDemoVenueStatus`).
 *   - It hasn't fired before in this browser session (ref + sessionStorage;
 *     the query params are also stripped via `history.replaceState` so a
 *     refresh doesn't re-fire).
 *
 * Selectores requeridos en el DOM:
 *   - `data-tour="sidebar-sales"` — item "Ventas" del sidebar (auto-generado
 *     por `nav-main.tsx` via `tourKey('#sales')`).
 *   - `data-tour="sidebar-payments"` — item "Transacciones" del sub-sidebar
 *     de Ventas (auto-generado via `tourKey('payments')`).
 *   - `data-tour="payments-table"` — contenedor de la tabla en
 *     `src/pages/Payment/Payments.tsx`.
 */

import {
  TOUR_PARAM,
  VENTA_TPV_TOUR,
  SESSION_FIRED_KEY,
  SESSION_PENDING_KEY,
  DEFAULT_AMOUNT_CENTS,
  DEFAULT_TIP_CENTS,
  MIN_AMOUNT_CENTS,
  parseCents,
} from '@/lib/demo-tour-capture'

function waitForElement(selector: string, timeout = 4000): Promise<Element | null> {
  return new Promise(resolve => {
    const existing = document.querySelector(selector)
    if (existing) {
      resolve(existing)
      return
    }
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector)
      if (el) {
        observer.disconnect()
        resolve(el)
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeout)
  })
}

function exists(selector: string): boolean {
  return !!document.querySelector(selector)
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function useDemoTour() {
  const { t } = useTranslation('payment')
  const location = useLocation()
  const navigate = useNavigate()
  const { venue, fullBasePath } = useCurrentVenue()

  const driverRef = useRef<Driver | null>(null)
  const didFireRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startTour = useCallback(
    (totalLabel: string, simOk: boolean) => {
      document.body.classList.add('tour-active')
      driverRef.current?.destroy()

      const d: Driver = driver({
        popoverClass: 'avoqado-tour-popover',
        showProgress: true,
        allowClose: true,
        animate: true,
        smoothScroll: true,
        overlayOpacity: 0.65,
        stagePadding: 6,
        stageRadius: 8,
        nextBtnText: t('demoTour.next', { defaultValue: 'Siguiente →' }),
        prevBtnText: t('demoTour.prev', { defaultValue: '← Anterior' }),
        doneBtnText: t('demoTour.done', { defaultValue: '¡Listo!' }),
        progressText: t('demoTour.progress', { defaultValue: 'Paso {{current}} de {{total}}' }),
        onDestroyed: () => {
          document.body.classList.remove('tour-active')
        },
        steps: [
          {
            element: '[data-tour="sidebar-sales"]',
            popover: {
              title: t('demoTour.sales.title', { defaultValue: '💸 Ventas' }),
              description: t('demoTour.sales.description', {
                defaultValue:
                  'Aquí vive todo lo que cobras: pagos de terminal, pedidos, ligas de pago y más. Vamos a buscar tu cobro.',
              }),
              side: 'right',
              align: 'start',
              onNextClick: async () => {
                // Open the Ventas sub-sidebar if the Transacciones item
                // isn't rendered yet (idempotent — skip if already open).
                if (!exists('[data-tour="sidebar-payments"]')) {
                  document.querySelector<HTMLButtonElement>('[data-tour="sidebar-sales"] button')?.click()
                  await waitForElement('[data-tour="sidebar-payments"]')
                  // Let the sliding-panel transition (200ms) settle so the
                  // highlight is positioned on the final layout.
                  await delay(280)
                }
                d.moveNext()
              },
            },
          },
          {
            element: '[data-tour="sidebar-payments"]',
            popover: {
              title: t('demoTour.transactions.title', { defaultValue: 'Transacciones' }),
              description: t('demoTour.transactions.description', {
                defaultValue: 'La lista de cada cobro de tu negocio, al segundo. Entremos a ver el tuyo.',
              }),
              side: 'right',
              align: 'start',
              onNextClick: async () => {
                if (!exists('[data-tour="payments-table"]')) {
                  const link = document.querySelector<HTMLAnchorElement>('[data-tour="sidebar-payments"] a')
                  if (link) {
                    link.click()
                  } else {
                    // Sidebar not visible (e.g. collapsed/mobile) — navigate directly.
                    navigate(`${fullBasePath}/payments`)
                  }
                  await waitForElement('[data-tour="payments-table"]', 8000)
                  await delay(250)
                }
                d.moveNext()
              },
            },
          },
          {
            element: '[data-tour="payments-table"]',
            popover: {
              // Only claim "YOUR charge" when the sim payment was actually
              // created — otherwise the table shows seeded data and the copy
              // must say so (founder QA: a seeded $34.80 row under a "your
              // $348.10 charge" popover reads as a broken product).
              title: simOk
                ? t('demoTour.yourPayment.title', {
                    amount: totalLabel,
                    defaultValue: '¡Este es TU cobro de {{amount}}! 🎉',
                  })
                : t('demoTour.feedFallback.title', { defaultValue: 'Aquí caen tus cobros, al instante' }),
              description: simOk
                ? t('demoTour.yourPayment.description', {
                    defaultValue:
                      'Llegó al instante desde la terminal hasta tu dashboard — con propina, método de pago y quién cobró.',
                  })
                : t('demoTour.feedFallback.description', {
                    defaultValue:
                      'Cada venta de la terminal aparece aquí al momento — con propina, método de pago y quién cobró. Los cobros que ves son datos de ejemplo de este negocio demo.',
                  }),
              side: 'top',
              align: 'start',
            },
          },
          {
            popover: {
              title: t('demoTour.complete.title', { defaultValue: 'Así se ve cada venta de tu negocio, en vivo' }),
              description: t('demoTour.complete.description', {
                defaultValue:
                  'Cada cobro de tu equipo aparece aquí al momento, sin cierres ni esperas. Explora el resto del dashboard con libertad: es tuyo.',
              }),
            },
          },
        ],
      })

      driverRef.current = d
      d.drive()
    },
    [t, navigate, fullBasePath],
  )

  // CAPTURE at first param sight (any route, venue not needed yet): the auth +
  // venue-resolution redirects can drop the query string before useCurrentVenue
  // resolves, so the journey is stashed in sessionStorage immediately and the
  // params stripped right away.
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get(TOUR_PARAM) !== VENTA_TPV_TOUR) return

    try {
      if (sessionStorage.getItem(SESSION_FIRED_KEY) !== '1') {
        sessionStorage.setItem(
          SESSION_PENDING_KEY,
          JSON.stringify({
            amountCents: parseCents(params.get('amountCents'), DEFAULT_AMOUNT_CENTS, MIN_AMOUNT_CENTS),
            tipCents: parseCents(params.get('tipCents'), DEFAULT_TIP_CENTS, 0),
          }),
        )
      }
    } catch {
      /* noop */
    }

    // Strip the tour params from the address bar so refreshes/redirects are clean.
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete(TOUR_PARAM)
      url.searchParams.delete('amountCents')
      url.searchParams.delete('tipCents')
      window.history.replaceState(window.history.state, '', url.toString())
    } catch {
      /* noop */
    }
  }, [location.search])

  // FIRE once the demo venue is ready, reading the stashed journey.
  useEffect(() => {
    if (didFireRef.current) return

    let pendingRaw: string | null = null
    try {
      pendingRaw = sessionStorage.getItem(SESSION_PENDING_KEY)
    } catch {
      /* noop */
    }
    if (!pendingRaw) return

    // Only ever act on demo venues — inert everywhere else (no fetch, no tour).
    if (!venue || !isDemoVenueStatus(venue.status)) return

    let alreadyFired = false
    try {
      alreadyFired = sessionStorage.getItem(SESSION_FIRED_KEY) === '1'
    } catch {
      /* noop */
    }
    if (alreadyFired) {
      try {
        sessionStorage.removeItem(SESSION_PENDING_KEY)
      } catch {
        /* noop */
      }
      return
    }

    didFireRef.current = true
    try {
      sessionStorage.setItem(SESSION_FIRED_KEY, '1')
      sessionStorage.removeItem(SESSION_PENDING_KEY)
    } catch {
      /* noop */
    }

    let amountCents = DEFAULT_AMOUNT_CENTS
    let tipCents = DEFAULT_TIP_CENTS
    try {
      const pending = JSON.parse(pendingRaw) as { amountCents?: number; tipCents?: number }
      amountCents = parseCents(String(pending.amountCents ?? ''), DEFAULT_AMOUNT_CENTS, MIN_AMOUNT_CENTS)
      tipCents = parseCents(String(pending.tipCents ?? ''), DEFAULT_TIP_CENTS, 0)
    } catch {
      /* noop */
    }

    // Amounts arrive in cents; Currency() expects pesos.
    const totalLabel = Currency((amountCents + tipCents) / 100)

    // Create the visitor's payment via the live-demo sim endpoint. It emits
    // the same socket event as a real TPV charge, so the Payments page picks
    // it up through the normal data flow. Even if the sim fails (e.g. expired
    // demo session) we still run the tour — the demo venue has seeded data.
    api
      .post('/api/v1/live-demo/sim/fast-payment', { amountCents, tipCents })
      .then(() => true)
      .catch(error => {
        console.error('Demo tour: fast-payment simulation failed', error)
        return false
      })
      .then(simOk => {
        // Small delay so the dashboard finishes painting before the overlay.
        timerRef.current = setTimeout(() => {
          timerRef.current = null
          startTour(totalLabel, simOk)
        }, 900)
      })
  }, [location.search, venue, startTour])

  // Unmount-only cleanup: pending timer + driver overlay + body flag.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      driverRef.current?.destroy()
      driverRef.current = null
      document.body.classList.remove('tour-active')
    }
  }, [])
}
