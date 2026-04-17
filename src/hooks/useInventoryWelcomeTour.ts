import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { requestAtomicTour, type AtomicTourName } from '@/hooks/useAtomicTourListener'

/**
 * Master welcome tour for the complete inventory system.
 *
 * Walks the admin through each section with REAL navigation. Each navigation
 * step actually takes the user to the target page, then resumes the tour
 * there. State is persisted in `sessionStorage` so route changes don't
 * interrupt the flow — `useInventoryWelcomeTourOrchestrator` (mounted at
 * Dashboard level) picks the tour back up on every route change.
 *
 * Flow:
 *   Step 0: Welcome (at wherever the tour starts, usually stock-overview)
 *   Step 1: Two inventory methods (same page)
 *   Step 2: Categories → navigates to /menumaker/categories
 *   Step 3: Ingredients → /inventory/ingredients
 *   Step 4: Products → /menumaker/products
 *   Step 5: Purchase orders → /inventory/purchase-orders
 *   Step 6: Stock summary → /inventory/stock-overview
 *   Step 7: History → /inventory/history
 *   Step 8: Full flow recap (same page)
 *   Step 9: Complete
 */

const TOUR_STATE_KEY = 'avoqado:tour:inventory-welcome'
const TOUR_START_EVENT = 'avoqado-tour-inventory-welcome-start'

interface TourState {
  step: number
}

interface StepDef {
  titleKey: string
  titleFallback: string
  descKey: string
  descFallback: string
  /** Relative path (appended to fullBasePath). If present, we navigate BEFORE showing this step. */
  path?: string
  /**
   * Event name dispatched when the user clicks "Hacerlo paso a paso". The
   * section's atomic tour hook (e.g. `useCategoryCreationTour`) listens for
   * `avoqado-tour-start:<atomicEvent>` and starts its own walkthrough.
   */
  atomicEvent?: AtomicTourName
}

const STEPS: StepDef[] = [
  {
    titleKey: 'tourWelcome.welcome.title',
    titleFallback: '🎓 Bienvenido al sistema de inventario',
    descKey: 'tourWelcome.welcome.description',
    descFallback:
      'Este recorrido de <b>3 minutos</b> te enseña el sistema completo. Al final vas a saber:<br/><br/>• Qué hay en cada sección<br/>• Cuándo usar cada una<br/>• Por dónde empezar si es tu primer día<br/><br/><i>Cada sección tiene después su propio tour detallado con el botón <b>"?"</b> arriba a la derecha.</i>',
  },
  {
    titleKey: 'tourWelcome.methods.title',
    titleFallback: '🔀 Las 2 formas de controlar tu inventario',
    descKey: 'tourWelcome.methods.description',
    descFallback:
      'Cada producto puede controlarse de <b>dos maneras</b>:<br/><br/>📦 <b>Por unidad (QUANTITY)</b>: cuentas piezas enteras.<br/><i>Ejemplo: vendes hoodies o tazas — si vendes 1, tu inventario baja en 1.</i><br/><br/>🥣 <b>Por receta (RECIPE)</b>: el producto se hace con ingredientes.<br/><i>Ejemplo: un shake de proteína usa 120 ml de leche + 30 g de proteína. Al vender, se descuentan los ingredientes, no el shake.</i><br/><br/>⚠️ <b>Elige bien</b>: cambiar de método después es lioso.',
  },
  {
    titleKey: 'tourWelcome.categories.title',
    titleFallback: '📂 Paso 1 — Categorías',
    descKey: 'tourWelcome.categories.description',
    descFallback:
      'Todo producto necesita una <b>categoría</b>. Es el primer paso si estás arrancando de cero.<br/><br/>Ejemplos: <b>Bebidas</b>, <b>Comida</b>, <b>Postres</b>, <b>Merch</b>, <b>Shakes</b>.<br/><br/>Te recomendamos crear <b>3-5 categorías</b> antes de crear productos.',
    path: 'menumaker/categories',
    atomicEvent: 'category',
  },
  {
    titleKey: 'tourWelcome.ingredients.title',
    titleFallback: '🥣 Paso 2 — Ingredientes (opcional)',
    descKey: 'tourWelcome.ingredients.description',
    descFallback:
      'Los <b>ingredientes</b> (raw materials) son los insumos crudos que alimentan tus recetas.<br/><br/><i>Ejemplos: leche, café en grano, proteína, hielo, vaso 12 oz, popote.</i><br/><br/>⚠️ <b>Solo los necesitas si vas a usar el método de RECETA.</b> Si todos tus productos son por unidad (hoodies, tazas), puedes saltarte este paso.',
    path: 'inventory/ingredients',
    atomicEvent: 'ingredient',
  },
  {
    titleKey: 'tourWelcome.products.title',
    titleFallback: '📦 Paso 3 — Productos',
    descKey: 'tourWelcome.products.description',
    descFallback:
      'Los <b>productos</b> son lo que realmente vendes al cliente. Aquí eliges el método:<br/><br/>• <b>QUANTITY</b>: "Hoodie Negro M" — stock inicial 20 piezas.<br/>• <b>RECIPE</b>: "Shake de Chocolate" — receta de 120ml leche + 30g proteína.<br/><br/>Cada producto se asigna a una <b>categoría</b> (Paso 1) y opcionalmente tiene <b>SKU</b> y <b>código de barras (GTIN)</b>.',
    path: 'menumaker/products',
    atomicEvent: 'product',
  },
  {
    titleKey: 'tourWelcome.purchaseOrders.title',
    titleFallback: '🛒 Paso 4 — Órdenes de compra',
    descKey: 'tourWelcome.purchaseOrders.description',
    descFallback:
      'Las <b>órdenes de compra</b> son cómo le pides mercancía al proveedor. Al recibirlas, el sistema crea <b>lotes</b> con costo y caducidad.<br/><br/>💡 <b>Clave</b>: Sin órdenes de compra, tus productos con <b>receta</b> no saben cuánto cuestan — el margen queda incorrecto.<br/><br/>Para productos por unidad (QUANTITY), las órdenes de compra son <b>opcionales</b> pero recomendables para llevar el costo.',
    path: 'inventory/purchase-orders',
    atomicEvent: 'purchase-order',
  },
  {
    titleKey: 'tourWelcome.stockSummary.title',
    titleFallback: '📊 Paso 5 — Resumen de Existencias',
    descKey: 'tourWelcome.stockSummary.description',
    descFallback:
      'Tu panel de control diario. Muestra:<br/><br/>• <b>Existencias actuales</b> de cada producto/ingrediente<br/>• <b>Alertas</b> de stock bajo<br/>• <b>Ajustes manuales</b> (merma, daño, robo, recuento)<br/><br/>Desde aquí haces el día a día: <i>"llegó un pedido, corrige esto"</i>, <i>"se rompieron 2 cajas"</i>, <i>"hicimos conteo físico"</i>.',
    path: 'inventory/stock-overview',
    atomicEvent: 'stock-adjustment',
  },
  {
    titleKey: 'tourWelcome.history.title',
    titleFallback: '📋 Paso 6 — Historial',
    descKey: 'tourWelcome.history.description',
    descFallback:
      'Cada movimiento queda registrado para siempre: ventas, ajustes, órdenes recibidas. Es tu <b>auditoría</b>.<br/><br/>Útil cuando un inventario "no cuadra" y necesitas investigar qué pasó: <i>quién, cuándo, qué hizo y por qué</i>.<br/><br/>⚠️ <b>El historial nunca se borra</b>. Si algo se registró mal, se corrige con un <b>ajuste nuevo</b>, no borrando.',
    path: 'inventory/history',
    atomicEvent: 'history',
  },
  {
    titleKey: 'tourWelcome.flow.title',
    titleFallback: '🔄 El flujo completo',
    descKey: 'tourWelcome.flow.description',
    descFallback:
      'Así es como todo se conecta:<br/><br/>1️⃣ Creas <b>Categorías</b><br/>⬇️<br/>2️⃣ (Si usas receta) creas <b>Ingredientes</b><br/>⬇️<br/>3️⃣ Creas <b>Productos</b> (eligiendo QUANTITY o RECIPE)<br/>⬇️<br/>4️⃣ Levantas <b>Órdenes de compra</b> y las recibes → se crean <b>lotes</b> con costo<br/>⬇️<br/>5️⃣ Vendes en <b>TPV</b> → el stock baja automáticamente (unidad o receta)<br/>⬇️<br/>6️⃣ Ajustas manualmente merma/daño en <b>Resumen de Existencias</b><br/>⬇️<br/>7️⃣ Todo queda en <b>Historial</b>',
  },
  {
    titleKey: 'tourWelcome.complete.title',
    titleFallback: '🎉 ¡Ya conoces el sistema!',
    descKey: 'tourWelcome.complete.description',
    descFallback:
      'Para arrancar, sigue este orden:<br/><br/>✅ <b>Categorías</b> → crea 3-5<br/>✅ <b>Ingredientes</b> (solo si usas recetas)<br/>✅ <b>Productos</b> → 5-10 para empezar<br/>✅ <b>Orden de compra</b> → recibe mercancía inicial<br/>✅ <b>Venta de prueba</b> → verifica que el stock baje correcto<br/><br/>En cada sección verás el botón <b>"?"</b> con el tour detallado. Si te pierdes, regresa aquí y vuelve a abrir este recorrido.<br/><br/>¡Éxito!',
  },
]

function readState(): TourState | null {
  try {
    const raw = sessionStorage.getItem(TOUR_STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.step === 'number' && parsed.step >= 0 && parsed.step < STEPS.length) {
      return { step: parsed.step }
    }
  } catch {
    /* noop */
  }
  return null
}

function writeState(state: TourState | null): void {
  try {
    if (state) sessionStorage.setItem(TOUR_STATE_KEY, JSON.stringify(state))
    else sessionStorage.removeItem(TOUR_STATE_KEY)
  } catch {
    /* noop */
  }
}

/**
 * Called by pages that offer a "start the welcome tour" button. Writes the
 * initial state, then dispatches an event the Orchestrator listens to, so
 * the tour kicks off without a route change.
 */
export function useInventoryWelcomeTour() {
  const start = useCallback(() => {
    writeState({ step: 0 })
    window.dispatchEvent(new Event(TOUR_START_EVENT))
  }, [])

  const stop = useCallback(() => {
    writeState(null)
    window.dispatchEvent(new Event(TOUR_START_EVENT + ':stop'))
  }, [])

  return { start, stop }
}

/**
 * Single source of truth for the tour. Mount ONCE at a layout that spans
 * every route the tour may navigate to (at least the common ancestor of
 * `/venues/:slug/menumaker/*` and `/venues/:slug/inventory/*`).
 *
 * It listens to:
 *   1. The START event (dispatched by `useInventoryWelcomeTour().start`).
 *   2. Route changes — if `sessionStorage` has an active tour state, it
 *      resumes at the stored step as soon as the new page mounts.
 */
export function useInventoryWelcomeTourOrchestrator() {
  const { t } = useTranslation('inventory')
  const navigate = useNavigate()
  const location = useLocation()
  const { fullBasePath } = useCurrentVenue()
  const driverRef = useRef<Driver | null>(null)
  const suppressDestroyCleanupRef = useRef(false)

  const runStep = useCallback(
    (n: number) => {
      if (n < 0 || n >= STEPS.length) {
        writeState(null)
        return
      }
      const step = STEPS[n]
      suppressDestroyCleanupRef.current = true
      driverRef.current?.destroy()
      suppressDestroyCleanupRef.current = false

      const isFirst = n === 0
      const isLast = n === STEPS.length - 1

      const hasAtomic = !!step.atomicEvent

      const d = driver({
        showProgress: true,
        allowClose: true,
        animate: true,
        overlayOpacity: 0.7,
        stagePadding: 6,
        stageRadius: 8,
        nextBtnText: isLast
          ? t('tour.done', { defaultValue: '¡Listo!' })
          : hasAtomic
            ? t('tour.nextSection', { defaultValue: 'Siguiente sección →' })
            : t('tour.next', { defaultValue: 'Siguiente →' }),
        prevBtnText: t('tour.prev', { defaultValue: '← Anterior' }),
        doneBtnText: t('tour.done', { defaultValue: '¡Listo!' }),
        progressText: `${n + 1} / ${STEPS.length}`,
        onPopoverRender: (popover) => {
          if (!hasAtomic) return
          // Inject a "Hacerlo paso a paso" button before the Next button so
          // the admin can dive into the section's atomic tour right now.
          const btn = document.createElement('button')
          btn.type = 'button'
          btn.textContent = t('tour.doItStepByStep', {
            defaultValue: 'Hacerlo paso a paso',
          })
          btn.className = 'driver-popover-btn'
          btn.style.cssText = [
            'background: hsl(var(--primary))',
            'color: hsl(var(--primary-foreground))',
            'border: 0',
            'border-radius: 4px',
            'padding: 4px 12px',
            'margin-right: 6px',
            'font-size: 13px',
            'cursor: pointer',
            'text-shadow: none',
          ].join(';')
          btn.addEventListener('click', e => {
            e.preventDefault()
            e.stopPropagation()
            // Close the welcome tour and signal the section's atomic tour
            // hook (already mounted on this page) to start.
            writeState(null)
            suppressDestroyCleanupRef.current = true
            d.destroy()
            suppressDestroyCleanupRef.current = false
            if (step.atomicEvent) {
              // Launch the section's atomic tour. It will emit a completion
              // event when the user reaches the final step, and the
              // checklist picks that up to mark the matching step done.
              // (No marking here — that way Hacerlo + close-early does NOT
              // falsely mark the step.)
              requestAtomicTour(step.atomicEvent)
            }
          })
          const nextBtn = popover.nextButton
          if (nextBtn?.parentElement) {
            nextBtn.parentElement.insertBefore(btn, nextBtn)
          } else {
            popover.footerButtons?.prepend(btn)
          }
        },
        onDestroyed: () => {
          // If we're tearing down to move to the next step, don't clear state.
          if (suppressDestroyCleanupRef.current) return
          // User closed the popover manually → end the tour cleanly.
          writeState(null)
        },
        steps: [
          {
            popover: {
              title: t(step.titleKey, { defaultValue: step.titleFallback }),
              description: t(step.descKey, { defaultValue: step.descFallback }),
              showButtons: isFirst
                ? ['next', 'close']
                : isLast
                  ? ['previous', 'close']
                  : ['previous', 'next', 'close'],
              onNextClick: () => {
                const nextIdx = n + 1
                if (nextIdx >= STEPS.length) {
                  writeState(null)
                  suppressDestroyCleanupRef.current = true
                  d.destroy()
                  suppressDestroyCleanupRef.current = false
                  return
                }
                const nextStep = STEPS[nextIdx]
                writeState({ step: nextIdx })

                if (nextStep.path && fullBasePath) {
                  // Destroy current popover and navigate; the route-change
                  // effect below will re-invoke runStep on the new page.
                  suppressDestroyCleanupRef.current = true
                  d.destroy()
                  suppressDestroyCleanupRef.current = false
                  navigate(`${fullBasePath}/${nextStep.path}`)
                } else {
                  runStep(nextIdx)
                }
              },
              onPrevClick: () => {
                const prevIdx = n - 1
                if (prevIdx < 0) return
                writeState({ step: prevIdx })
                runStep(prevIdx)
              },
              onCloseClick: () => {
                writeState(null)
                suppressDestroyCleanupRef.current = true
                d.destroy()
                suppressDestroyCleanupRef.current = false
              },
            },
          },
        ],
      })

      driverRef.current = d
      d.drive()
    },
    [t, navigate, fullBasePath],
  )

  // Handler: start event
  useEffect(() => {
    const onStart = () => {
      const state = readState()
      runStep(state?.step ?? 0)
    }
    const onStop = () => {
      suppressDestroyCleanupRef.current = true
      driverRef.current?.destroy()
      suppressDestroyCleanupRef.current = false
      driverRef.current = null
    }
    window.addEventListener(TOUR_START_EVENT, onStart)
    window.addEventListener(TOUR_START_EVENT + ':stop', onStop)
    return () => {
      window.removeEventListener(TOUR_START_EVENT, onStart)
      window.removeEventListener(TOUR_START_EVENT + ':stop', onStop)
    }
  }, [runStep])

  // Resume on route change
  useEffect(() => {
    const state = readState()
    if (!state) return
    // Delay so the new page's elements exist before we draw the overlay.
    const timer = setTimeout(() => runStep(state.step), 400)
    return () => clearTimeout(timer)
    // We want this to re-fire on every pathname change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  // Unmount cleanup
  useEffect(() => {
    return () => {
      driverRef.current?.destroy()
    }
  }, [])
}
