import { driver, type Driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import api from '@/api'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { isDemoVenueStatus } from '@/types/superadmin'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'

/**
 * Live-demo journey tours (Avoqado Tour → dashboard handoff).
 *
 * A visitor finishes a guided demo on avoqado.io/demo and clicks the CTA →
 * lands on the demo dashboard (live-demo auto-login) with a URL like:
 *
 *   /?demoTour=venta-tpv&amountCents=29500&tipCents=5310
 *   /?demoTour=reserva
 *
 * The params are captured at app boot (src/lib/demo-tour-capture.ts, called
 * from main.tsx — the auth/venue redirects drop the query string before this
 * hook mounts) and stashed in sessionStorage. Once the demo venue context
 * resolves, this hook:
 *
 *   venta-tpv → POSTs /api/v1/live-demo/sim/fast-payment, then drives:
 *     Ventas (sidebar) → Transacciones → the payments table.
 *   reserva   → POSTs /api/v1/live-demo/sim/reservation, then drives:
 *     Reservaciones (sidebar) → Calendario → the calendar where the visitor's
 *     reservation just landed.
 *
 * Both sims fail open (the demo venue has seeded data) — but the "this is
 * YOURS" copy is only used when the sim actually succeeded.
 *
 * Selectores requeridos en el DOM (auto-generados por nav-main `tourKey`):
 *   - `data-tour="sidebar-sales"` / `data-tour="sidebar-payments"`
 *   - `data-tour="payments-table"` (Payments.tsx)
 *   - `data-tour="sidebar-reservations"` / `data-tour="sidebar-reservations-calendar"`
 *   - `data-tour="reservations-calendar"` (ReservationCalendar.tsx)
 */

import {
  TOUR_PARAM,
  VENTA_TPV_TOUR,
  RESERVA_TOUR,
  LIGA_TOUR,
  VALID_TOURS,
  firedKey,
  SESSION_PENDING_KEY,
  DEFAULT_AMOUNT_CENTS,
  DEFAULT_TIP_CENTS,
  MIN_AMOUNT_CENTS,
  parseCents,
  type DemoTourJourney,
  type PendingDemoTour,
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
  const { formatTime } = useVenueDateTime()

  const driverRef = useRef<Driver | null>(null)
  const didFireRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const buildDriver = useCallback(
    (steps: DriveStep[]): Driver => {
      document.body.classList.add('tour-active')
      driverRef.current?.destroy()
      const d = driver({
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
        steps,
      })
      driverRef.current = d
      return d
    },
    [t],
  )

  /* ------------------------- venta-tpv journey ------------------------- */
  const startVentaTour = useCallback(
    (totalLabel: string, simOk: boolean) => {
      const d = buildDriver([
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
              // Open the Ventas sub-sidebar if Transacciones isn't rendered yet.
              if (!exists('[data-tour="sidebar-payments"]')) {
                document.querySelector<HTMLButtonElement>('[data-tour="sidebar-sales"] button')?.click()
                await waitForElement('[data-tour="sidebar-payments"]')
                await delay(280) // let the sliding-panel transition settle
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
            // Only claim "YOUR charge" when the sim payment was actually created —
            // otherwise the table shows seeded data and the copy must say so.
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
      ])
      d.drive()
    },
    [buildDriver, t, navigate, fullBasePath],
  )

  /* -------------------------- reserva journey -------------------------- */
  const startReservaTour = useCallback(
    (timeLabel: string | null) => {
      const simOk = timeLabel !== null
      const d = buildDriver([
        {
          element: '[data-tour="sidebar-reservations"]',
          popover: {
            title: t('demoTour.reservations.title', { defaultValue: '📅 Reservaciones' }),
            description: t('demoTour.reservations.description', {
              defaultValue:
                'Cada reserva hecha desde tu página, Google o redes cae aquí solita — sin llamadas ni mensajes. Vamos a ver la tuya.',
            }),
            side: 'right',
            align: 'start',
            onNextClick: async () => {
              if (!exists('[data-tour="sidebar-reservations-calendar"]')) {
                document.querySelector<HTMLButtonElement>('[data-tour="sidebar-reservations"] button')?.click()
                await waitForElement('[data-tour="sidebar-reservations-calendar"]')
                await delay(280)
              }
              d.moveNext()
            },
          },
        },
        {
          element: '[data-tour="sidebar-reservations-calendar"]',
          popover: {
            title: t('demoTour.reservationsCalendar.title', { defaultValue: 'Calendario' }),
            description: t('demoTour.reservationsCalendar.description', {
              defaultValue: 'La agenda de tu negocio, al día. Entremos a ver tu reserva.',
            }),
            side: 'right',
            align: 'start',
            onNextClick: async () => {
              if (!exists('[data-tour="reservations-calendar"]')) {
                const link = document.querySelector<HTMLAnchorElement>('[data-tour="sidebar-reservations-calendar"] a')
                if (link) {
                  link.click()
                } else {
                  navigate(`${fullBasePath}/reservations/calendar`)
                }
                await waitForElement('[data-tour="reservations-calendar"]', 8000)
                await delay(350)
              }
              d.moveNext()
            },
          },
        },
        {
          element: '[data-tour="reservations-calendar"]',
          popover: {
            title: simOk
              ? t('demoTour.yourReservation.title', {
                  time: timeLabel,
                  defaultValue: '¡Esta es TU reserva de las {{time}}! 🎉',
                })
              : t('demoTour.reservaFallback.title', { defaultValue: 'Aquí cae cada reserva, al instante' }),
            description: simOk
              ? t('demoTour.yourReservation.description', {
                  defaultValue:
                    'Sofía reservó desde la página del negocio y la cita apareció aquí al momento — confirmada y con recordatorios automáticos por WhatsApp.',
                })
              : t('demoTour.reservaFallback.description', {
                  defaultValue:
                    'Cuando un cliente reserva en línea, su cita aparece aquí al momento — confirmada y con recordatorios automáticos. Las reservas que ves son datos de ejemplo de este negocio demo.',
                }),
            side: 'top',
            align: 'start',
          },
        },
        {
          popover: {
            title: t('demoTour.reservaComplete.title', { defaultValue: 'Tu agenda se llena sola' }),
            description: t('demoTour.reservaComplete.description', {
              defaultValue:
                'Reservas en línea 24/7, recordatorios por WhatsApp y tu calendario siempre al día. Explora el resto del dashboard con libertad: es tuyo.',
            }),
          },
        },
      ])
      d.drive()
    },
    [buildDriver, t, navigate, fullBasePath],
  )

  /* --------------------------- liga journey ---------------------------- */
  const startLigaTour = useCallback(
    (amountLabel: string | null) => {
      const simOk = amountLabel !== null
      const d = buildDriver([
        {
          element: '[data-tour="sidebar-sales"]',
          popover: {
            title: t('demoTour.sales.title', { defaultValue: '💸 Ventas' }),
            description: t('demoTour.paymentLinks.description', {
              defaultValue: 'Cobra a distancia sin terminal: comparte una liga por WhatsApp, QR o link directo. Entremos a ver la tuya.',
            }),
            side: 'right',
            align: 'start',
            onNextClick: async () => {
              // The "Ligas de Pago" sidebar group renders without a data-tour
              // (collapsible groups skip tourKey) — navigate straight to the page.
              if (!exists('[data-tour="payment-links-table"]')) {
                navigate(`${fullBasePath}/payment-links`)
                await waitForElement('[data-tour="payment-links-table"]', 8000)
                await delay(350)
              }
              d.moveNext()
            },
          },
        },
        {
          element: '[data-tour="payment-links-table"]',
          popover: {
            title: simOk
              ? t('demoTour.yourLink.title', {
                  amount: amountLabel,
                  defaultValue: '¡Esta es TU liga de {{amount}}! 🎉',
                })
              : t('demoTour.linkFallback.title', { defaultValue: 'Tus ligas de pago viven aquí' }),
            description: simOk
              ? t('demoTour.yourLink.description', {
                  defaultValue: '"Sesión de fotos" — creada y cobrada 1 vez. Cada liga muestra sus pagos, estado y total cobrado.',
                })
              : t('demoTour.linkFallback.description', {
                  defaultValue: 'Crea ligas de monto fijo, abierto o por artículo y compártelas por WhatsApp, QR o link directo.',
                }),
            side: 'top',
            align: 'start',
            onNextClick: async () => {
              if (!exists('[data-tour="payments-table"]')) {
                navigate(`${fullBasePath}/payments`)
                await waitForElement('[data-tour="payments-table"]', 8000)
                await delay(300)
              }
              d.moveNext()
            },
          },
        },
        {
          element: '[data-tour="payments-table"]',
          popover: {
            title: simOk
              ? t('demoTour.linkPayment.title', {
                  amount: amountLabel,
                  defaultValue: 'Y aquí está el pago de tu liga 💸',
                })
              : t('demoTour.feedFallback.title', { defaultValue: 'Aquí caen tus cobros, al instante' }),
            description: simOk
              ? t('demoTour.linkPayment.description', {
                  amount: amountLabel,
                  defaultValue:
                    'El cobro de {{amount}} llegó a Transacciones como cualquier venta — con método de pago y canal web.',
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
            title: t('demoTour.ligaComplete.title', { defaultValue: 'Cobra a distancia, sin terminal' }),
            description: t('demoTour.ligaComplete.description', {
              defaultValue:
                'Liga creada, compartida y cobrada — y todo reflejado al instante en tu dashboard. Explora el resto con libertad: es tuyo.',
            }),
          },
        },
      ])
      d.drive()
    },
    [buildDriver, t, navigate, fullBasePath],
  )

  // CAPTURE at first param sight (backup path — main.tsx already captured
  // before the router mounted; this covers in-app navigations with the param).
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const journey = params.get(TOUR_PARAM)
    if (!journey || !(VALID_TOURS as readonly string[]).includes(journey)) return

    try {
      if (sessionStorage.getItem(firedKey(journey)) !== '1') {
        const pending: PendingDemoTour = { journey: journey as DemoTourJourney }
        if (journey === VENTA_TPV_TOUR) {
          pending.amountCents = parseCents(params.get('amountCents'), DEFAULT_AMOUNT_CENTS, MIN_AMOUNT_CENTS)
          pending.tipCents = parseCents(params.get('tipCents'), DEFAULT_TIP_CENTS, 0)
        }
        sessionStorage.setItem(SESSION_PENDING_KEY, JSON.stringify(pending))
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

    let pending: PendingDemoTour
    try {
      pending = JSON.parse(pendingRaw) as PendingDemoTour
    } catch {
      pending = { journey: VENTA_TPV_TOUR }
    }
    const journey = (VALID_TOURS as readonly string[]).includes(pending.journey) ? pending.journey : VENTA_TPV_TOUR

    let alreadyFired = false
    try {
      alreadyFired = sessionStorage.getItem(firedKey(journey)) === '1'
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
      sessionStorage.setItem(firedKey(journey), '1')
      sessionStorage.removeItem(SESSION_PENDING_KEY)
    } catch {
      /* noop */
    }

    if (journey === LIGA_TOUR) {
      // Create the visitor's payment link + its web payment, then tour:
      // Ligas de Pago (TU liga) → Transacciones (TU pago). Fail-open with
      // honest copy when the sim fails.
      api
        .post('/api/v1/live-demo/sim/payment-link')
        .then(res => {
          const amountCents: number | undefined = res.data?.data?.amountCents
          return typeof amountCents === 'number' ? Currency(amountCents / 100) : Currency(350)
        })
        .catch(error => {
          console.error('Demo tour: payment-link simulation failed', error)
          return null
        })
        .then(amountLabel => {
          timerRef.current = setTimeout(() => {
            timerRef.current = null
            startLigaTour(amountLabel)
          }, 900)
        })
      return
    }

    if (journey === RESERVA_TOUR) {
      // Create the visitor's reservation via the live-demo sim endpoint, then
      // tour to the calendar. Fail-open: the tour runs over seeded data with
      // honest copy when the sim fails (expired session, old API, etc.).
      api
        .post('/api/v1/live-demo/sim/reservation')
        .then(res => {
          const startsAt: string | undefined = res.data?.data?.startsAt
          return startsAt ? formatTime(startsAt) : null
        })
        .catch(error => {
          console.error('Demo tour: reservation simulation failed', error)
          return null
        })
        .then(timeLabel => {
          timerRef.current = setTimeout(() => {
            timerRef.current = null
            startReservaTour(timeLabel)
          }, 900)
        })
      return
    }

    // venta-tpv (default)
    const amountCents = parseCents(String(pending.amountCents ?? ''), DEFAULT_AMOUNT_CENTS, MIN_AMOUNT_CENTS)
    const tipCents = parseCents(String(pending.tipCents ?? ''), DEFAULT_TIP_CENTS, 0)
    const totalLabel = Currency((amountCents + tipCents) / 100) // cents → pesos

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
          startVentaTour(totalLabel, simOk)
        }, 900)
      })
  }, [location.search, venue, startVentaTour, startReservaTour, startLigaTour, formatTime])

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
