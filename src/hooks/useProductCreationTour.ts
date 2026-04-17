import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Interactive onboarding tour for product creation flow.
 * Uses driver.js to overlay step-by-step guidance on the live UI.
 *
 * The tour is FLOW-AWARE: clicking "Next" automatically executes the action
 * (opens modals, selects options, advances wizards) so the admin can just
 * watch and learn without having to click through the real UI themselves.
 *
 * Attach `data-tour="<key>"` to these elements for the tour to target them:
 *   - `product-new-btn`   — "Nuevo producto" button (header of Products list)
 *   - `product-type-regular` — Regular Item option in type selector modal
 *   - `product-type-next`  — "Siguiente" button in type selector modal
 *   - `product-wizard-name`  — Product name input in wizard
 *   - `product-wizard-price` — Price input in wizard
 *   - `product-wizard-category` — Category selector in wizard
 *   - `product-wizard-track-inventory` — Track inventory toggle
 *   - `product-wizard-initial-stock`  — Initial stock input
 *   - `product-wizard-finish` — "Finalizar" submit button
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

export function useProductCreationTour() {
  const { t } = useTranslation('menu')
  const driverRef = useRef<Driver | null>(null)

  const buildDriver = useCallback((): Driver => {
    const d: Driver = driver({
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
            title: t('tour.welcome.title', {
              defaultValue: '👋 Vamos a crear tu primer producto',
            }),
            description: t('tour.welcome.description', {
              defaultValue:
                'Te voy a guiar paso a paso. Puedes cerrar el tour en cualquier momento con la tecla ESC.',
            }),
          },
        },

        // 2) "Nuevo producto" button — clicking Next auto-opens the type selector
        {
          element: '[data-tour="product-new-btn"]',
          popover: {
            title: t('tour.step1.title', { defaultValue: 'Nuevo producto' }),
            description: t('tour.step1.description', {
              defaultValue:
                'Haz clic en este botón para empezar. Se abrirá un asistente que te pedirá qué tipo de producto quieres crear.',
            }),
            side: 'bottom',
            align: 'end',
            onNextClick: async () => {
              // If the type selector modal isn't open yet, open it
              if (!exists('[data-tour="product-type-regular"]')) {
                const btn = document.querySelector<HTMLButtonElement>(
                  '[data-tour="product-new-btn"]',
                )
                btn?.click()
                try {
                  await waitForElement('[data-tour="product-type-regular"]')
                } catch {
                  /* timeout — advance anyway */
                }
              }
              d.moveNext()
            },
          },
        },

        // 3) "Artículo Regular" option — clicking Next auto-selects + advances wizard
        {
          element: '[data-tour="product-type-regular"]',
          popover: {
            title: t('tour.step2.title', {
              defaultValue: 'Elige el tipo de artículo',
            }),
            description: t('tour.step2.description', {
              defaultValue:
                'Para merch (hoodies, gorras, botellas) usa <b>Artículo Regular</b>. Para bebidas preparadas o comida fresca usa <b>Comida y Bebida</b>.',
            }),
            side: 'right',
            align: 'start',
            onNextClick: async () => {
              // If the wizard isn't open yet, select Regular and click "Siguiente"
              if (!exists('[data-tour="product-wizard-name"]')) {
                const regular = document.querySelector<HTMLButtonElement>(
                  '[data-tour="product-type-regular"]',
                )
                regular?.click()
                // Give React a tick to update the selection state
                await new Promise(r => setTimeout(r, 120))
                const nextBtn = document.querySelector<HTMLButtonElement>(
                  '[data-tour="product-type-next"]',
                )
                nextBtn?.click()
                try {
                  await waitForElement('[data-tour="product-wizard-name"]')
                } catch {
                  /* timeout — advance anyway */
                }
              }
              d.moveNext()
            },
          },
        },

        // 4) Name field
        {
          element: '[data-tour="product-wizard-name"]',
          popover: {
            title: t('tour.step3.title', {
              defaultValue: 'Escribe el nombre',
            }),
            description: t('tour.step3.description', {
              defaultValue:
                'Usa un nombre claro y corto. Ejemplo: <b>Hoodie Blanca M</b>. Este nombre lo verá el cliente en el TPV.',
            }),
            side: 'bottom',
            align: 'start',
          },
        },

        // 5) Price
        {
          element: '[data-tour="product-wizard-price"]',
          popover: {
            title: t('tour.step4.title', {
              defaultValue: 'Define el precio de venta',
            }),
            description: t('tour.step4.description', {
              defaultValue:
                'Escribe el precio en pesos. Lo podrás cambiar después si hace falta.',
            }),
            side: 'bottom',
            align: 'start',
          },
        },

        // 6) Category
        {
          element: '[data-tour="product-wizard-category"]',
          popover: {
            title: t('tour.step5.title', {
              defaultValue: 'Asigna una categoría',
            }),
            description: t('tour.step5.description', {
              defaultValue:
                'Selecciona dónde aparecerá en el menú (ej. <b>Merch</b>, <b>Bebidas</b>, <b>Comida</b>). Si no existe la categoría, créala primero en la sección de <b>Categorías</b>.',
            }),
            side: 'left',
            align: 'start',
          },
        },

        // 7) Track Inventory toggle — ensure it is ON so step 8 (stock input) exists
        {
          element: '[data-tour="product-wizard-track-inventory"]',
          popover: {
            title: t('tour.step6.title', {
              defaultValue: 'Activa el control de inventario',
            }),
            description: t('tour.step6.description', {
              defaultValue:
                'Al prender este switch, cada venta descontará automáticamente del stock. Te avisará cuando esté por agotarse.',
            }),
            side: 'top',
            align: 'start',
            onNextClick: async () => {
              // Make sure the Track Inventory switch is ON so Stock Inicial becomes visible
              if (!exists('[data-tour="product-wizard-initial-stock"]')) {
                const wrapper = document.querySelector(
                  '[data-tour="product-wizard-track-inventory"]',
                )
                const toggle = wrapper?.querySelector<HTMLButtonElement>(
                  'button[role="switch"]',
                )
                toggle?.click()
                try {
                  await waitForElement('[data-tour="product-wizard-initial-stock"]')
                } catch {
                  /* timeout — advance anyway */
                }
              }
              d.moveNext()
            },
          },
        },

        // 8) Initial Stock
        {
          element: '[data-tour="product-wizard-initial-stock"]',
          popover: {
            title: t('tour.step7.title', {
              defaultValue: 'Ingresa el stock actual',
            }),
            description: t('tour.step7.description', {
              defaultValue:
                'Cuenta las piezas que tienes hoy y ponlas aquí. Ejemplo: <b>15</b> hoodies en bodega.',
            }),
            side: 'top',
            align: 'start',
          },
        },

        // 9) Finish button (we don't auto-click save — that's the real user's call)
        {
          element: '[data-tour="product-wizard-finish"]',
          popover: {
            title: t('tour.step8.title', {
              defaultValue: 'Guarda el producto',
            }),
            description: t('tour.step8.description', {
              defaultValue:
                'Haz clic en <b>Finalizar</b>. Tu producto queda listo para venderse desde el TPV.',
            }),
            side: 'bottom',
            align: 'end',
          },
        },

        // 10) Complete
        {
          popover: {
            title: t('tour.complete.title', {
              defaultValue: '🎉 ¡Felicidades!',
            }),
            description: t('tour.complete.description', {
              defaultValue:
                'Ya sabes crear productos. Puedes volver a ver este tour cuando quieras desde el ícono <b>?</b> arriba.',
            }),
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      driverRef.current?.destroy()
    }
  }, [])

  return { start, stop }
}
