import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAtomicTourListener, notifyAtomicTourCompleted } from '@/hooks/useAtomicTourListener'

/**
 * Interactive onboarding tour for RECIPE-based product creation.
 * Covers shakes, lattes, fresh food — products that consume ingredients per sale.
 *
 * Flow-aware: clicking "Siguiente →" automatically executes the actions
 * (opens modals, picks "Comida y Bebida", selects "Basado en Recetas",
 * enables tracking, etc.) so the admin can just watch.
 *
 * Required `data-tour` attributes (already attached in the wizard):
 *   - `product-new-btn`
 *   - `product-type-food`  (Comida y Bebida tile in the type selector)
 *   - `product-type-next`
 *   - `product-wizard-name`
 *   - `product-wizard-price`
 *   - `product-wizard-category`
 *   - `product-wizard-track-inventory`
 *   - `product-wizard-method-recipe` (Recipe radio tile)
 *   - `product-wizard-portion-yield`
 *   - `product-wizard-ingredients`
 *   - `product-wizard-add-ingredient`
 *   - `product-wizard-finish`
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

export function useRecipeCreationTour() {
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
            title: t('tourRecipe.welcome.title', {
              defaultValue: '🥤 Crear un producto con receta',
            }),
            description: t('tourRecipe.welcome.description', {
              defaultValue:
                'Perfecto para shakes, lattes, bebidas frescas y comida preparada. El sistema descontará automáticamente los ingredientes con cada venta. <br/><br/>⚠️ Necesitas tener al menos un <b>ingrediente</b> creado antes. Si no, crea primero desde <b>Inventario → Ingredientes</b>.',
            }),
          },
        },

        // 2) New product button
        {
          element: '[data-tour="product-new-btn"]',
          popover: {
            title: t('tourRecipe.step1.title', { defaultValue: 'Nuevo producto' }),
            description: t('tourRecipe.step1.description', {
              defaultValue:
                'Haz clic aquí. Se abrirá un asistente para elegir el tipo de producto.',
            }),
            side: 'bottom',
            align: 'end',
            onNextClick: async () => {
              if (!exists('[data-tour="product-type-food"]')) {
                const btn = document.querySelector<HTMLButtonElement>(
                  '[data-tour="product-new-btn"]',
                )
                btn?.click()
                try {
                  await waitForElement('[data-tour="product-type-food"]')
                } catch {
                  /* noop */
                }
              }
              d.moveNext()
            },
          },
        },

        // 3) Food & Beverage type
        {
          element: '[data-tour="product-type-food"]',
          popover: {
            title: t('tourRecipe.step2.title', {
              defaultValue: 'Elige "Comida y Bebida"',
            }),
            description: t('tourRecipe.step2.description', {
              defaultValue:
                'Para productos preparados al momento (shakes, lattes, sandwiches). Este tipo te permite definir una <b>receta</b> con los ingredientes que consume.',
            }),
            side: 'right',
            align: 'start',
            onNextClick: async () => {
              if (!exists('[data-tour="product-wizard-name"]')) {
                const food = document.querySelector<HTMLButtonElement>(
                  '[data-tour="product-type-food"]',
                )
                food?.click()
                await new Promise(r => setTimeout(r, 120))
                const nextBtn = document.querySelector<HTMLButtonElement>(
                  '[data-tour="product-type-next"]',
                )
                nextBtn?.click()
                try {
                  await waitForElement('[data-tour="product-wizard-name"]')
                } catch {
                  /* noop */
                }
              }
              d.moveNext()
            },
          },
        },

        // 4) Name
        {
          element: '[data-tour="product-wizard-name"]',
          popover: {
            title: t('tourRecipe.step3.title', { defaultValue: 'Nombre del producto' }),
            description: t('tourRecipe.step3.description', {
              defaultValue:
                'Ejemplo: <b>Latte Chico</b>, <b>Zen Matcha</b>, <b>Sandwich Búfalo</b>. Este nombre es el que verá el cliente en el TPV.',
            }),
            side: 'bottom',
            align: 'start',
          },
        },

        // 5) Price
        {
          element: '[data-tour="product-wizard-price"]',
          popover: {
            title: t('tourRecipe.step4.title', { defaultValue: 'Precio de venta' }),
            description: t('tourRecipe.step4.description', {
              defaultValue:
                'Precio al público. Más adelante verás cuál es tu <b>Food Cost %</b> (qué porcentaje del precio son ingredientes).',
            }),
            side: 'bottom',
            align: 'start',
          },
        },

        // 6) SKU
        {
          element: '[data-tour="product-wizard-sku"]',
          popover: {
            title: t('tourRecipe.stepSku.title', {
              defaultValue: 'SKU (código interno)',
            }),
            description: t('tourRecipe.stepSku.description', {
              defaultValue:
                'Código único para este producto (ej. <b>LATTE-CHICO</b>). <br/><br/>💡 Déjalo vacío y se <b>genera automáticamente</b>. Úsalo solo si tienes tu propio sistema de nomenclatura.',
            }),
            side: 'top',
            align: 'start',
          },
        },

        // 7) GTIN
        {
          element: '[data-tour="product-wizard-gtin"]',
          popover: {
            title: t('tourRecipe.stepGtin.title', {
              defaultValue: 'GTIN / Código de barras',
            }),
            description: t('tourRecipe.stepGtin.description', {
              defaultValue:
                'Código de barras universal. Para productos preparados (bebidas, comida) <b>casi siempre se deja vacío</b> — no vienen con código impreso.',
            }),
            side: 'top',
            align: 'start',
          },
        },

        // 8) Category
        {
          element: '[data-tour="product-wizard-category"]',
          popover: {
            title: t('tourRecipe.step5.title', { defaultValue: 'Categoría' }),
            description: t('tourRecipe.step5.description', {
              defaultValue:
                'Selecciona dónde aparecerá en el menú: <b>Bebidas</b>, <b>Shakes</b>, <b>Comida</b>, etc.',
            }),
            side: 'left',
            align: 'start',
          },
        },

        // 7) Enable tracking
        {
          element: '[data-tour="product-wizard-track-inventory"]',
          popover: {
            title: t('tourRecipe.step6.title', {
              defaultValue: 'Activa el control de inventario',
            }),
            description: t('tourRecipe.step6.description', {
              defaultValue:
                'Al prender este switch podrás elegir el método de rastreo. Para recetas, cada venta descontará los ingredientes automáticamente.',
            }),
            side: 'top',
            align: 'start',
            onNextClick: async () => {
              // Ensure tracking is on so method selector appears
              if (!exists('[data-tour="product-wizard-method-recipe"]')) {
                const wrapper = document.querySelector(
                  '[data-tour="product-wizard-track-inventory"]',
                )
                const toggle = wrapper?.querySelector<HTMLButtonElement>(
                  'button[role="switch"]',
                )
                toggle?.click()
                try {
                  await waitForElement('[data-tour="product-wizard-method-recipe"]')
                } catch {
                  /* noop */
                }
              }
              d.moveNext()
            },
          },
        },

        // 8) Pick Recipe-Based
        {
          element: '[data-tour="product-wizard-method-recipe"]',
          popover: {
            title: t('tourRecipe.step7.title', {
              defaultValue: 'Elige "Basado en Recetas"',
            }),
            description: t('tourRecipe.step7.description', {
              defaultValue:
                'En lugar de contar unidades completas, el sistema rastrea los <b>ingredientes</b>. Al vender 1 Latte Chico se descuentan 120ml de leche + 9g de café, por ejemplo.',
            }),
            side: 'right',
            align: 'start',
            onNextClick: async () => {
              // Ensure Recipe is selected so the recipe section shows
              if (!exists('[data-tour="product-wizard-portion-yield"]')) {
                const recipeTile = document.querySelector<HTMLElement>(
                  '[data-tour="product-wizard-method-recipe"]',
                )
                recipeTile?.click()
                try {
                  await waitForElement('[data-tour="product-wizard-portion-yield"]')
                } catch {
                  /* noop */
                }
              }
              d.moveNext()
            },
          },
        },

        // 9) Portions per recipe
        {
          element: '[data-tour="product-wizard-portion-yield"]',
          popover: {
            title: t('tourRecipe.step8.title', {
              defaultValue: 'Porciones por receta',
            }),
            description: t('tourRecipe.step8.description', {
              defaultValue:
                'Si una receta completa da <b>1 porción</b> (típico para bebidas), deja 1. Si preparas una salsa que rinde para 10 tacos, pon 10. Así el sistema prorratea los ingredientes al vender 1 taco.',
            }),
            side: 'top',
            align: 'start',
          },
        },

        // 10) Ingredients area
        {
          element: '[data-tour="product-wizard-ingredients"]',
          popover: {
            title: t('tourRecipe.step9.title', {
              defaultValue: 'Agrega los ingredientes',
            }),
            description: t('tourRecipe.step9.description', {
              defaultValue:
                'Aquí defines qué lleva la receta. Ejemplo: <b>120 ml de Leche de Almendras</b> + <b>9 g de Café Espresso</b>. Cada ingrediente se descuenta automáticamente al vender.',
            }),
            side: 'top',
            align: 'start',
          },
        },

        // 11) Add ingredient button
        {
          element: '[data-tour="product-wizard-add-ingredient"]',
          popover: {
            title: t('tourRecipe.step10.title', {
              defaultValue: 'Botón + Agregar ingrediente',
            }),
            description: t('tourRecipe.step10.description', {
              defaultValue:
                'Al hacer clic se abre un diálogo donde eliges el ingrediente (debe existir ya en <b>Inventario → Ingredientes</b>), la cantidad y la unidad. Agrega uno por uno.',
            }),
            side: 'left',
            align: 'start',
          },
        },

        // 12) Finalizar
        {
          element: '[data-tour="product-wizard-finish"]',
          popover: {
            title: t('tourRecipe.step11.title', {
              defaultValue: 'Guarda la receta',
            }),
            description: t('tourRecipe.step11.description', {
              defaultValue:
                'Cuando termines de agregar ingredientes, haz clic en <b>Finalizar</b>. El sistema calcula automáticamente el <b>Costo Total</b> y el <b>Food Cost %</b>.',
            }),
            side: 'bottom',
            align: 'end',
          },
        },

        // 13) Complete
        {
          popover: {
            title: t('tourRecipe.complete.title', {
              defaultValue: '🎉 ¡Listo!',
            }),
            description: t('tourRecipe.complete.description', {
              defaultValue:
                'Ya sabes crear productos basados en recetas. Cada venta descontará los ingredientes automáticamente y te avisaremos cuando alguno baje del mínimo.',
            }),
            onNextClick: () => {
              notifyAtomicTourCompleted('recipe')
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

  useAtomicTourListener('recipe', start)

  return { start, stop }
}
