import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAtomicTourListener } from '@/hooks/useAtomicTourListener'
import { buildFinalStepFooter } from '@/lib/atomic-tour-final-step'
import { getTourStepIndex, setTourStepIndex } from '@/lib/tour-progress'

/**
 * Interactive onboarding tour for ingredient (raw material) creation.
 * Ingredients (raw materials) are the building blocks of RECIPE products.
 *
 * Flow-aware: clicking "Siguiente →" automatically opens the dialog
 * and advances through the form sections so the admin can watch the flow.
 *
 * Required `data-tour` attributes (attached in RawMaterials.tsx + RawMaterialDialog.tsx):
 *   - `ingredient-add-btn`        — "Agregar Ingrediente" button on the list header
 *   - `ingredient-dialog-name`    — Name input
 *   - `ingredient-dialog-sku`     — SKU input
 *   - `ingredient-dialog-category`— Category selector
 *   - `ingredient-dialog-unit`    — Unit selector (kg, L, piezas, etc.)
 *   - `ingredient-dialog-stock`   — Current stock input
 *   - `ingredient-dialog-cost`    — Cost per unit input
 *   - `ingredient-dialog-save`    — Save button
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

export function useIngredientCreationTour() {
  const { t } = useTranslation('inventory')
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
      // Persistimos el step actual en sessionStorage para que el tour
      // reanude desde aquí si el user lo cierra y lo vuelve a abrir.
      onHighlightStarted: (_el, _step, opts) => {
        setTourStepIndex('ingredient', opts.state.activeIndex ?? 0)
      },
      steps: [
        // 1) Welcome
        {
          popover: {
            title: t('tourIngredient.welcome.title', {
              defaultValue: '🥛 Agregar un ingrediente',
            }),
            description: t('tourIngredient.welcome.description', {
              defaultValue:
                'Los ingredientes son los insumos que usas en tus recetas: <b>leche</b>, <b>café</b>, <b>matcha</b>, <b>azúcar</b>, <b>popotes</b>. No se venden solos — se consumen al preparar productos. <br/><br/>Cada ingrediente debe crearse antes de usarse en una receta.',
            }),
          },
        },

        // 2) Add button
        {
          element: '[data-tour="ingredient-add-btn"]',
          popover: {
            title: t('tourIngredient.step1.title', {
              defaultValue: 'Botón "Agregar Ingrediente"',
            }),
            description: t('tourIngredient.step1.description', {
              defaultValue:
                'Haz clic aquí para abrir el formulario. Vas a llenar unos pocos datos básicos.',
            }),
            side: 'bottom',
            align: 'end',
            onNextClick: async () => {
              if (!exists('[data-tour="ingredient-dialog-name"]')) {
                const btn = document.querySelector<HTMLButtonElement>(
                  '[data-tour="ingredient-add-btn"]',
                )
                btn?.click()
                try {
                  await waitForElement('[data-tour="ingredient-dialog-name"]')
                } catch {
                  /* noop */
                }
              }
              d.moveNext()
            },
          },
        },

        // 3) Name
        {
          element: '[data-tour="ingredient-dialog-name"]',
          popover: {
            title: t('tourIngredient.step2.title', { defaultValue: 'Nombre del ingrediente' }),
            description: t('tourIngredient.step2.description', {
              defaultValue:
                'Usa el nombre con el que lo conoces en la cocina. Ejemplo: <b>Leche de Almendras</b>, <b>Café Espresso</b>, <b>Matcha en Polvo</b>.',
            }),
            side: 'bottom',
            align: 'start',
          },
        },

        // 4) SKU
        {
          element: '[data-tour="ingredient-dialog-sku"]',
          popover: {
            title: t('tourIngredient.step3.title', { defaultValue: 'Código interno (SKU)' }),
            description: t('tourIngredient.step3.description', {
              defaultValue:
                'Un código único para identificarlo en reportes. Puedes dejar el que se genera automáticamente o usar uno tuyo (ej. <b>RM-LECHE-ALM</b>).',
            }),
            side: 'bottom',
            align: 'start',
          },
        },

        // 5) Unit
        {
          element: '[data-tour="ingredient-dialog-unit"]',
          popover: {
            title: t('tourIngredient.step4.title', { defaultValue: 'Unidad de medida' }),
            description: t('tourIngredient.step4.description', {
              defaultValue:
                'La unidad en la que mides este ingrediente. Ejemplos: <b>kg</b> para matcha, <b>litros</b> para leche, <b>piezas</b> para popotes. <br/><br/>⚠️ Elige bien — no se puede cambiar fácilmente después.',
            }),
            side: 'top',
            align: 'start',
          },
        },

        // 6) Category
        {
          element: '[data-tour="ingredient-dialog-category"]',
          popover: {
            title: t('tourIngredient.step5.title', { defaultValue: 'Categoría' }),
            description: t('tourIngredient.step5.description', {
              defaultValue:
                'Agrupa tus ingredientes para reportes: <b>Lácteos</b>, <b>Proteínas</b>, <b>Bebidas</b>, <b>Especias</b>, etc.',
            }),
            side: 'left',
            align: 'start',
          },
        },

        // 7) Current stock
        {
          element: '[data-tour="ingredient-dialog-stock"]',
          popover: {
            title: t('tourIngredient.step6.title', { defaultValue: 'Existencias actuales' }),
            description: t('tourIngredient.step6.description', {
              defaultValue:
                'Cuenta cuánto tienes AHORA en la unidad elegida. Ejemplo: si tienes 5 cartones de 1 litro de leche, escribe <b>5</b>. <br/><br/>También define el <b>mínimo</b> (cuándo te avisamos) y el <b>punto de reorden</b> (cuándo hacer pedido).',
            }),
            side: 'top',
            align: 'start',
          },
        },

        // 8) Cost
        {
          element: '[data-tour="ingredient-dialog-cost"]',
          popover: {
            title: t('tourIngredient.step7.title', { defaultValue: 'Costo por unidad' }),
            description: t('tourIngredient.step7.description', {
              defaultValue:
                'Cuánto pagas por cada unidad al proveedor. Ejemplo: <b>$45</b> por litro de leche. Usaremos este dato para calcular el costo de cada producto y tu <b>Food Cost %</b>.',
            }),
            side: 'top',
            align: 'start',
          },
        },

        // 9) Save
        {
          element: '[data-tour="ingredient-dialog-save"]',
          popover: {
            title: t('tourIngredient.step8.title', { defaultValue: 'Guarda el ingrediente' }),
            description: t('tourIngredient.step8.description', {
              defaultValue:
                'Al guardar, el ingrediente queda disponible para usarse en recetas. Puedes repetir este proceso por cada insumo que manejes.',
            }),
            side: 'bottom',
            align: 'end',
          },
        },

        // 10) Complete — 3 botones via helper compartido (Cancelar / Listo
        //     / Volver a inicio). Ver lib/atomic-tour-final-step.ts.
        {
          popover: {
            title: t('tourIngredient.complete.title', {
              defaultValue: '🎉 ¡Listo!',
            }),
            description: t('tourIngredient.complete.description', {
              defaultValue:
                'Ahora que tienes un ingrediente, puedes ir a <b>Productos</b> y crear una bebida con receta que lo use. Cada venta descontará automáticamente la cantidad que definas en la receta.',
            }),
            ...buildFinalStepFooter({
              tourName: 'ingredient',
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

  const start = useCallback(() => {
    driverRef.current?.destroy()
    driverRef.current = buildDriver()
    // Reanuda desde el step donde el user quedó (sessionStorage).
    driverRef.current.drive(getTourStepIndex('ingredient'))
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

  useAtomicTourListener('ingredient', start)

  return { start, stop }
}
