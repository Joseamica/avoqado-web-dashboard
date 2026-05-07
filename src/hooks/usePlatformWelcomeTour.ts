import { driver, type Driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useCurrentVenue } from '@/hooks/use-current-venue'
import useAccess from '@/hooks/use-access'
import { useOnboardingKey } from '@/hooks/useOnboardingState'
import {
  clearPlatformTourState,
  getPlatformTourState,
  setPlatformTourState,
} from '@/lib/platform-tour-state'

/**
 * Cross-page platform welcome tour orchestrator (v2).
 *
 * Architecture:
 *   - A flat list of `TOUR_PAGES`, each with a relative route + a list of
 *     driver.js steps. Pages are filtered at `start()` time based on user
 *     access (permissions / white-label feature gates) so the tour silently
 *     skips inactive sections.
 *   - State persisted in sessionStorage (`active`, `pageIndex`). Navigations
 *     between pages destroy the driver.js instance, but the resume effect
 *     reads the state on each location change and re-creates a driver for
 *     the new page's steps.
 *   - On the LAST step of a page the user clicks "Siguiente sección →"
 *     which advances the pageIndex, navigates to the next page's route,
 *     and lets the resume effect pick up.
 *   - Closing via X (or `done` on the last step) clears the state.
 *   - On full completion, `platform-welcome-completed` is set in
 *     `useOnboardingKey` so the auto-launcher won't re-fire.
 */

interface TourPage {
  /** Stable id used as the i18n namespace under `home:newHome.welcomeTour.pages` */
  id: string
  /** Path relative to fullBasePath (no leading slash). `null` = stay on Home. */
  relativeRoute: string | null
  steps: TourStep[]
  /** Optional gate — if returns false, the page is skipped */
  gate?: (access: ReturnType<typeof useAccess>) => boolean
}

interface TourStep {
  /** Optional CSS selector for the element to highlight. If absent, popover-only. */
  element?: string
  /** i18n key suffix under `home:newHome.welcomeTour.pages.<page.id>.steps.<step.key>` */
  key: string
}

const TOUR_PAGES: TourPage[] = [
  {
    id: 'home',
    relativeRoute: null,
    steps: [
      { key: 'intro' },
      { element: '[data-tour="home-performance-section"]', key: 'kpis' },
      { element: '[data-tour="home-chatbot-overview"]', key: 'chatbot' },
    ],
  },
  {
    id: 'menu',
    relativeRoute: 'menumaker/products',
    gate: a => a.can('menu:read'),
    steps: [{ element: '[data-tour="product-new-btn"]', key: 'newProduct' }, { key: 'overview' }],
  },
  {
    id: 'inventory',
    relativeRoute: 'inventory/stock-overview',
    gate: a => a.can('inventory:read') && a.canFeature('INVENTORY_TRACKING'),
    steps: [{ key: 'overview' }],
  },
  {
    id: 'sales',
    relativeRoute: 'payments',
    gate: a => a.can('payments:read'),
    steps: [{ key: 'overview' }],
  },
  {
    id: 'reservations',
    relativeRoute: 'reservations',
    gate: a => a.can('reservations:read'),
    steps: [{ key: 'overview' }],
  },
  {
    id: 'team',
    relativeRoute: 'team',
    gate: a => a.can('teams:read'),
    steps: [{ key: 'overview' }],
  },
  {
    id: 'customers',
    relativeRoute: 'customers',
    gate: a => a.can('customers:read'),
    steps: [{ key: 'overview' }],
  },
  {
    id: 'reports',
    relativeRoute: 'reports/sales-summary',
    gate: a => a.can('reports:read'),
    steps: [{ key: 'overview' }],
  },
  {
    id: 'settings',
    relativeRoute: 'edit',
    gate: a => a.can('venues:read'),
    steps: [{ key: 'overview' }],
  },
]

const COMPLETED_KEY = 'platform-welcome-completed'

const SESSION_FLAG_RAN = 'avoqado-platform-tour-just-completed'

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

export function usePlatformWelcomeTour() {
  const { t } = useTranslation('home')
  const access = useAccess()
  const { fullBasePath } = useCurrentVenue()
  const location = useLocation()
  const navigate = useNavigate()
  const { setValue: setCompleted } = useOnboardingKey<boolean>(COMPLETED_KEY, false)

  const driverRef = useRef<Driver | null>(null)
  const userClosedRef = useRef(false)

  // Filter pages by access. Recomputed each render — stable while access is stable.
  const availablePages = useMemo(() => {
    if (access.isLoading) return TOUR_PAGES
    return TOUR_PAGES.filter(page => !page.gate || page.gate(access))
  }, [access])

  const cleanup = useCallback(() => {
    document.body.classList.remove('tour-active')
    driverRef.current?.destroy()
    driverRef.current = null
  }, [])

  const finish = useCallback(() => {
    cleanup()
    clearPlatformTourState()
    setCompleted(true)
    sessionStorage.setItem(SESSION_FLAG_RAN, '1')
  }, [cleanup, setCompleted])

  const cancel = useCallback(() => {
    cleanup()
    clearPlatformTourState()
  }, [cleanup])

  const advance = useCallback(() => {
    const state = getPlatformTourState()
    if (!state?.active) return
    const nextIndex = state.pageIndex + 1
    cleanup()
    if (nextIndex >= availablePages.length) {
      finish()
      // Send the user back to Home for a clean landing
      navigate(`${fullBasePath}/home`)
      return
    }
    setPlatformTourState({ active: true, pageIndex: nextIndex })
    const nextPage = availablePages[nextIndex]
    if (nextPage.relativeRoute) {
      navigate(`${fullBasePath}/${nextPage.relativeRoute}`)
    }
    // The resume effect will pick up on the next location change (or
    // immediately if we're already on the right page).
  }, [availablePages, cleanup, finish, fullBasePath, navigate])

  const buildPageDriver = useCallback(
    (page: TourPage, isLastPage: boolean): Driver => {
      userClosedRef.current = false

      const steps: DriveStep[] = page.steps.map((step, index) => {
        const isLastStepOfPage = index === page.steps.length - 1
        const i18nBase = `newHome.welcomeTour.pages.${page.id}.steps.${step.key}`
        // Build popover incrementally — driver.js v1.4 treats the *presence*
        // of `onNextClick` as a default-override even when the value is
        // `undefined`, which silently breaks the Next button.
        const popover: NonNullable<DriveStep['popover']> = {
          title: t(`${i18nBase}.title`),
          description: t(`${i18nBase}.description`),
        }
        if (isLastStepOfPage && !isLastPage) {
          popover.nextBtnText = t('newHome.welcomeTour.nextSection')
          popover.onNextClick = () => advance()
        } else if (isLastStepOfPage && isLastPage) {
          popover.doneBtnText = t('newHome.welcomeTour.done')
          popover.onNextClick = () => finish()
        }
        return { element: step.element, popover }
      })

      return driver({
        popoverClass: 'avoqado-tour-popover',
        showProgress: true,
        animate: true,
        smoothScroll: true,
        overlayOpacity: 0.65,
        stagePadding: 6,
        stageRadius: 8,
        allowClose: true,
        nextBtnText: t('newHome.welcomeTour.next'),
        prevBtnText: t('newHome.welcomeTour.prev'),
        doneBtnText: isLastPage ? t('newHome.welcomeTour.done') : t('newHome.welcomeTour.nextSection'),
        progressText: t('newHome.welcomeTour.progress'),
        onCloseClick: () => {
          userClosedRef.current = true
          cancel()
        },
        onDestroyed: () => {
          // Don't call finish/advance here — both branches are explicitly
          // handled by onNextClick on the last step (advance/finish) or by
          // onCloseClick (cancel). onDestroyed firing here just means the
          // driver was already torn down.
        },
        steps,
      })
    },
    [advance, cancel, finish, t],
  )

  const runCurrentPage = useCallback(async () => {
    const state = getPlatformTourState()
    if (!state?.active) return
    const page = availablePages[state.pageIndex]
    if (!page) {
      finish()
      return
    }

    // Wait for any required first-step element so highlighting works
    const firstStepSelector = page.steps[0]?.element
    if (firstStepSelector) {
      const el = await waitForElement(firstStepSelector, 4000)
      // If the element never appeared (dead page, missing data-tour attr),
      // proceed anyway with popover-only mode for the step.
      if (!el && page.steps.length === 1) {
        // Strip selector so driver shows centered popover
        page.steps[0] = { ...page.steps[0], element: undefined }
      }
    }

    cleanup()
    document.body.classList.add('tour-active')
    const isLastPage = state.pageIndex === availablePages.length - 1
    driverRef.current = buildPageDriver(page, isLastPage)
    driverRef.current.drive()
  }, [availablePages, buildPageDriver, cleanup, finish])

  // Resume effect: whenever the location changes and the tour is active,
  // try to run the current page.
  useEffect(() => {
    const state = getPlatformTourState()
    if (!state?.active) return
    const page = availablePages[state.pageIndex]
    if (!page) return

    const expectedPath = page.relativeRoute ? `${fullBasePath}/${page.relativeRoute}` : `${fullBasePath}/home`
    // Allow either exact match or trailing variations (e.g. with trailing slash)
    const matches =
      location.pathname === expectedPath ||
      location.pathname === expectedPath + '/' ||
      // Home can be either /home or root-of-venue
      (page.id === 'home' && (location.pathname === fullBasePath || location.pathname === fullBasePath + '/'))

    if (!matches) return

    // Defer one frame so the page has time to mount data-tour elements
    const timer = setTimeout(() => {
      runCurrentPage()
    }, 250)
    return () => clearTimeout(timer)
  }, [location.pathname, fullBasePath, availablePages, runCurrentPage])

  // Cleanup on hook unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  const start = useCallback(() => {
    if (availablePages.length === 0) return
    setPlatformTourState({ active: true, pageIndex: 0 })
    const firstPage = availablePages[0]
    if (firstPage.relativeRoute) {
      navigate(`${fullBasePath}/${firstPage.relativeRoute}`)
    } else {
      // Already on Home (or close to it); kick off immediately
      runCurrentPage()
    }
  }, [availablePages, fullBasePath, navigate, runCurrentPage])

  return { start, cancel }
}
