import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAtomicTourListener } from '@/hooks/useAtomicTourListener'
import { buildFinalStepFooter } from '@/lib/atomic-tour-final-step'
import { getTourStepIndex, setTourStepIndex } from '@/lib/tour-progress'
import { openProductWizardSection } from '@/lib/open-product-wizard-section'

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
      onDestroyed: () => { driverRef.current = null },
      progressText: t('tour.progress', {
        defaultValue: 'Paso {{current}} de {{total}}',
      }),
      onHighlightStarted: (_el, _step, opts) => {
        setTourStepIndex('product', opts.state.activeIndex ?? 0)
      },
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
                  return
                }
              }
              if (driverRef.current === d) d.moveNext()
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
                if (driverRef.current !== d) return
                const nextBtn = document.querySelector<HTMLButtonElement>(
                  '[data-tour="product-type-next"]',
                )
                nextBtn?.click()
                try {
                  await waitForElement('[data-tour="product-wizard-name"]')
                } catch {
                  return
                }
              }
              if (driverRef.current === d) d.moveNext()
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
            onNextClick: async () => {
              if (await openProductWizardSection('description', '[data-tour="product-wizard-optional-description"] textarea', waitForElement) && driverRef.current === d) d.moveNext()
            },
          },
        },

        {
          element: '[data-tour="product-wizard-optional-description"] textarea',
          popover: {
            title: t('tour.stepDescription.title', { defaultValue: 'Agrega una descripción' }),
            description: t('tour.stepDescription.description', {
              defaultValue: 'El botón + de Descripción abre este campo opcional. Cuenta brevemente qué vendes; puedes dejarlo vacío.',
            }),
            side: 'top',
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
            onNextClick: async () => {
              if (await openProductWizardSection('codes', '[data-tour="product-wizard-sku"]', waitForElement) && driverRef.current === d) d.moveNext()
            },
          },
        },

        // 6) SKU
        {
          element: '[data-tour="product-wizard-sku"]',
          popover: {
            title: t('tour.stepSku.title', {
              defaultValue: 'SKU (código interno)',
            }),
            description: t('tour.stepSku.description', {
              defaultValue:
                'Código único para identificar el producto en reportes. <br/><br/>💡 Puedes dejarlo en blanco y se <b>genera automáticamente</b>. Úsalo solo si ya tienes una nomenclatura propia (ej. <b>HOODIE-BLANCA-M</b>).',
            }),
            side: 'top',
            align: 'start',
          },
        },

        // 7) GTIN
        {
          element: '[data-tour="product-wizard-gtin"]',
          popover: {
            title: t('tour.stepGtin.title', {
              defaultValue: 'GTIN / Código de barras',
            }),
            description: t('tour.stepGtin.description', {
              defaultValue:
                'Es el código de barras universal (UPC/EAN) que viene impreso en el producto. <br/><br/>💡 Útil si vas a <b>escanear</b> productos en la venta o el conteo. Opcional — si no vendes con escáner, déjalo vacío.',
            }),
            side: 'top',
            align: 'start',
          },
        },

        // 8) Category
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
            onNextClick: async () => {
              if (await openProductWizardSection('inventory', '[data-tour="product-wizard-initial-stock"]', waitForElement) && driverRef.current === d) d.moveNext()
            },
          },
        },

        // 7) Track Inventory toggle — ensure it is ON so step 8 (stock input) exists
        {
          element: '[data-tour="product-wizard-track-inventory"]',
          popover: {
            title: t('tour.step6.title', {
              defaultValue: 'Abre el inventario',
            }),
            description: t('tour.step6.description', {
              defaultValue:
                'Con el botón + de Inventario abres el conteo por piezas. Cada venta descontará del stock que registres.',
            }),
            side: 'top',
            align: 'start',
            onNextClick: async () => {
              if (await openProductWizardSection('inventory', '[data-tour="product-wizard-initial-stock"]', waitForElement) && driverRef.current === d) d.moveNext()
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

        // 10) Complete — 3 botones (Cancelar / Listo / Volver a inicio)
        {
          popover: {
            title: t('tour.complete.title', {
              defaultValue: '🎉 ¡Felicidades!',
            }),
            description: t('tour.complete.description', {
              defaultValue:
                'Ya sabes crear productos. Puedes volver a ver este tour cuando quieras desde el ícono <b>?</b> arriba.',
            }),
            ...buildFinalStepFooter({
              tourName: 'product',
              cancelLabel: t('tour.cancel', { defaultValue: 'Cancelar' }),
              doneLabel: t('tour.done', { defaultValue: '¡Listo!' }),
              homeLabel: t('tour.backToHome', { defaultValue: 'Volver a inicio' }),
            }),
          },
        },
      ],
    })

    return d
  }, [t])

  const start = useCallback(async () => {
    const previous = driverRef.current
    driverRef.current = null
    previous?.destroy()
    const d = buildDriver()
    driverRef.current = d
    const index = getTourStepIndex('product')
    const target = d.getConfig().steps?.[index]?.element
    const current = () => driverRef.current === d

    // Resume through the same public actions; an open draft must stay untouched.
    if (typeof target === 'string' && target.includes('product-wizard-')) {
      if (!exists('[data-tour="product-wizard-name"]')) {
        if (!exists('[data-tour="product-type-regular"]')) {
          document.querySelector<HTMLButtonElement>('[data-tour="product-new-btn"]')?.click()
          try {
            await waitForElement('[data-tour="product-type-regular"]')
          } catch {
            return
          }
        }
        if (!current()) return
        document.querySelector<HTMLButtonElement>('[data-tour="product-type-regular"]')?.click()
        await new Promise(resolve => setTimeout(resolve, 120))
        if (!current()) return
        document.querySelector<HTMLButtonElement>('[data-tour="product-type-next"]')?.click()
        try {
          await waitForElement('[data-tour="product-wizard-name"]')
        } catch {
          return
        }
      }
      if (!current()) return
      if (target.includes('optional-description')) {
        if (!await openProductWizardSection('description', target, waitForElement)) return
      } else if (target.includes('-sku') || target.includes('-gtin')) {
        if (!await openProductWizardSection('codes', target, waitForElement)) return
      } else if (target.includes('-track-inventory') || target.includes('-initial-stock')) {
        if (!await openProductWizardSection('inventory', '[data-tour="product-wizard-initial-stock"]', waitForElement)) return
      }
    }
    if (current()) d.drive(index)
  }, [buildDriver])

  const stop = useCallback(() => {
    const current = driverRef.current
    driverRef.current = null
    current?.destroy()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const current = driverRef.current
      driverRef.current = null
      current?.destroy()
    }
  }, [])

  useAtomicTourListener('product', start)

  return { start, stop }
}
