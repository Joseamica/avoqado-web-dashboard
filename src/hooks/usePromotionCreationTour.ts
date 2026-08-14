import { driver, type Driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAtomicTourListener } from '@/hooks/useAtomicTourListener'

/**
 * Interactive activation guide for the Promotions (bundles) list — driver.js
 * tour that walks crear → publicar → dónde se ve en el POS.
 *
 * The tour is FLOW-AWARE, not a plain list of static steps: creating and
 * publishing a promotion happen inside a FullScreenModal that isn't mounted
 * until the user opens it, so each transition uses `onNextClick` +
 * `waitForElement` to open/close the editor for the user. The tour never
 * saves a draft on the user's behalf — it closes the editor at the "Guardar"
 * step instead of clicking Save, so it doesn't leave garbage drafts behind.
 * The `bundle-row-actions` step is conditional: on an empty list that
 * element doesn't exist, so it's filtered out at step-build time.
 *
 * Attach `data-tour="<key>"` to these elements for the tour to target them:
 *   - `bundles-page`            — page container (Bundles.tsx)
 *   - `bundle-create`           — "Nueva promoción" button
 *   - `bundle-pricing-mode`     — pricing mode selector inside the editor
 *   - `bundle-groups`           — "Qué incluye" section inside the editor
 *   - `bundle-save`             — "Guardar borrador" button inside the editor
 *   - `bundle-editor-close`     — Close button of the FullScreenModal
 *   - `bundle-row-actions`      — row actions (⋯) menu trigger — CONDITIONAL
 *   - `bundle-panel-settings`   — "Dónde se ven en el POS" panel card
 */

/**
 * Wait for an element matching the selector to appear in the DOM.
 * Uses a MutationObserver so it resolves as soon as the element mounts.
 */
function waitForElement(selector: string, timeout = 4000): Promise<Element> {
  return new Promise((resolve, reject) => {
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
      reject(new Error(`waitForElement: timeout waiting for ${selector}`))
    }, timeout)
  })
}

/** Returns true if the element exists in the DOM right now. */
function exists(selector: string): boolean {
  return !!document.querySelector(selector)
}

export function usePromotionCreationTour() {
  const { t } = useTranslation('promotions')
  const driverRef = useRef<Driver | null>(null)

  const buildDriver = useCallback((): Driver => {
    const steps: DriveStep[] = [
      {
        element: '[data-tour="bundles-page"]',
        popover: {
          title: t('bundles.tour.welcomeTitle'),
          description: t('bundles.tour.welcomeDesc'),
        },
      },
      {
        element: '[data-tour="bundle-create"]',
        popover: {
          title: t('bundles.tour.createTitle'),
          description: t('bundles.tour.createDesc'),
          // Avanzar ABRE el editor por el usuario y espera a que exista el campo
          onNextClick: async () => {
            if (!exists('[data-tour="bundle-pricing-mode"]')) {
              const btn = document.querySelector<HTMLButtonElement>('[data-tour="bundle-create"]')
              btn?.click()
              try {
                await waitForElement('[data-tour="bundle-pricing-mode"]')
              } catch {
                /* timeout — advance anyway */
              }
            }
            driverRef.current?.moveNext()
          },
        },
      },
      {
        element: '[data-tour="bundle-pricing-mode"]',
        popover: { title: t('bundles.tour.modeTitle'), description: t('bundles.tour.modeDesc') },
      },
      {
        element: '[data-tour="bundle-groups"]',
        popover: { title: t('bundles.tour.groupsTitle'), description: t('bundles.tour.groupsDesc') },
      },
      {
        element: '[data-tour="bundle-save"]',
        popover: {
          title: t('bundles.tour.saveTitle'),
          description: t('bundles.tour.saveDesc'),
          // El tour NO guarda por el usuario (crearía borradores basura): al
          // avanzar CIERRA el editor y sigue en la lista.
          onNextClick: async () => {
            if (exists('[data-tour="bundle-editor-close"]')) {
              const closeBtn = document.querySelector<HTMLButtonElement>('[data-tour="bundle-editor-close"]')
              closeBtn?.click()
              try {
                await waitForElement('[data-tour="bundles-page"]')
              } catch {
                /* timeout — advance anyway */
              }
            }
            driverRef.current?.moveNext()
          },
        },
      },
      // Condicional: sólo si hay filas (en lista vacía este elemento no existe)
      ...(exists('[data-tour="bundle-row-actions"]')
        ? [
            {
              element: '[data-tour="bundle-row-actions"]',
              popover: { title: t('bundles.tour.publishTitle'), description: t('bundles.tour.publishDesc') },
            } satisfies DriveStep,
          ]
        : []),
      {
        element: '[data-tour="bundle-panel-settings"]',
        popover: { title: t('bundles.tour.panelTitle'), description: t('bundles.tour.panelDesc') },
      },
    ]

    const d: Driver = driver({
      popoverClass: 'avoqado-tour-popover',
      showProgress: true,
      allowClose: true,
      animate: true,
      overlayOpacity: 0.65,
      stagePadding: 6,
      stageRadius: 8,
      nextBtnText: t('tour.next', { defaultValue: 'Siguiente →' }),
      prevBtnText: t('tour.prev', { defaultValue: '← Anterior' }),
      doneBtnText: t('tour.done', { defaultValue: '¡Listo!' }),
      progressText: t('tour.progress', { defaultValue: 'Paso {{current}} de {{total}}' }),
      steps,
    })

    return d
  }, [t])

  const start = useCallback(() => {
    driverRef.current?.destroy()
    driverRef.current = buildDriver()
    driverRef.current.drive()
  }, [buildDriver])

  const stop = useCallback(() => {
    driverRef.current?.destroy()
    driverRef.current = null
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      driverRef.current?.destroy()
    }
  }, [])

  useAtomicTourListener('promotion', start)

  return { start, stop }
}
