import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAtomicTourListener, notifyAtomicTourCompleted } from '@/hooks/useAtomicTourListener'

/**
 * Interactive onboarding tour for category creation.
 * Categories are a PREREQUISITE for creating products — every product must
 * belong to a category. This is the first step a new admin should do.
 *
 * Required `data-tour` attributes:
 *   - `category-new-btn`        — "Nueva categoría" button in Categories page header
 *   - `category-wizard-name`    — Name field card inside CategoryWizardDialog (step 1)
 *   - `category-wizard-next`    — Next button (steps 1-2)
 *   - `category-wizard-finish`  — Create button (step 3)
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

function exists(selector: string): boolean {
  return !!document.querySelector(selector)
}

export function useCategoryCreationTour() {
  const { t } = useTranslation('menu')
  const driverRef = useRef<Driver | null>(null)

  const buildDriver = useCallback((): Driver => {
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
      progressText: t('tour.progress', {
        defaultValue: 'Paso {{current}} de {{total}}',
      }),
      steps: [
        // 1) Welcome
        {
          popover: {
            title: t('tourCategory.welcome.title', {
              defaultValue: '📂 Crear una categoría',
            }),
            description: t('tourCategory.welcome.description', {
              defaultValue:
                'Las categorías sirven para agrupar tus productos en el menú: <b>Merch</b>, <b>Bebidas</b>, <b>Comida</b>, <b>Postres</b>, etc.<br/><br/>⚠️ <b>Importante</b>: todo producto necesita una categoría. Si es tu primer día, crea estas antes que nada.',
            }),
          },
        },

        // 2) New category button
        {
          element: '[data-tour="category-new-btn"]',
          popover: {
            title: t('tourCategory.step1.title', {
              defaultValue: 'Botón "Nueva categoría"',
            }),
            description: t('tourCategory.step1.description', {
              defaultValue:
                'Haz clic aquí para abrir el asistente. Vas a llenar un nombre y listo.',
            }),
            side: 'bottom',
            align: 'end',
            onNextClick: async () => {
              if (!exists('[data-tour="category-wizard-name"]')) {
                const btn = document.querySelector<HTMLButtonElement>(
                  '[data-tour="category-new-btn"]',
                )
                btn?.click()
                try {
                  await waitForElement('[data-tour="category-wizard-name"]')
                } catch {
                  /* noop */
                }
              }
              d.moveNext()
            },
          },
        },

        // 3) Name field
        {
          element: '[data-tour="category-wizard-name"]',
          popover: {
            title: t('tourCategory.step2.title', {
              defaultValue: 'Ponle nombre a la categoría',
            }),
            description: t('tourCategory.step2.description', {
              defaultValue:
                'Usa un nombre claro que la admin o cajera vaya a reconocer. Ejemplos: <b>Merch</b>, <b>Bebidas frías</b>, <b>Comida</b>, <b>Shakes</b>, <b>Postres</b>.',
            }),
            side: 'right',
            align: 'start',
          },
        },

        // 4) Availability (step 2 of wizard) — optional
        {
          element: '[data-tour="category-wizard-next"]',
          popover: {
            title: t('tourCategory.step3.title', {
              defaultValue: 'Avanza al siguiente paso',
            }),
            description: t('tourCategory.step3.description', {
              defaultValue:
                'En los siguientes pasos puedes configurar <b>horarios de disponibilidad</b> (ej. categoría "Desayuno" solo antes de las 12 pm) o dejar todo por defecto si siempre está activa.',
            }),
            side: 'top',
            align: 'end',
          },
        },

        // 5) Complete
        {
          popover: {
            title: t('tourCategory.complete.title', {
              defaultValue: '🎉 ¡Así se hace!',
            }),
            description: t('tourCategory.complete.description', {
              defaultValue:
                'Al guardar, la categoría queda disponible para asignarse a productos. Te recomendamos crear <b>3-5 categorías</b> primero para tener tu menú organizado.<br/><br/>Siguiente: crea tus <b>Ingredientes</b> o tus <b>Productos</b>.',
            }),
            onNextClick: () => {
              notifyAtomicTourCompleted('category')
              d.destroy()
            },
          },
        },
      ],
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

  useEffect(() => {
    return () => {
      driverRef.current?.destroy()
    }
  }, [])

  // Listen for launch requests from the welcome tour / checklist.
  useAtomicTourListener('category', start)

  return { start, stop }
}
