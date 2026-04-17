import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Interactive onboarding tour for stock adjustments.
 * Teaches the day-to-day operation: "received mercancía, had a mermada, need to
 * fix a discrepancy → how do I reflect that here?"
 *
 * Designed for the Resumen de Existencias page. Targets the FIRST row's
 * "Existencias físicas" dropdown (assumes the venue has at least one tracked
 * product — empty state is handled by the page copy itself).
 *
 * Required `data-tour` attributes (added in InventorySummary.tsx):
 *   - `stock-edit-trigger`   — Popover trigger button (the clickable number)
 *   - `stock-edit-popover`   — Popover content container
 *   - `stock-edit-action`    — "Acción de existencias" select block
 *   - `stock-edit-quantity`  — Quantity input block
 *   - `stock-edit-save`      — Save button inside the popover
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

/**
 * Ensures the stock edit popover is open. Radix's Popover can close on
 * outside-click from driver.js's overlay, so we reopen it when needed.
 */
async function ensurePopoverOpen() {
  if (!exists('[data-tour="stock-edit-action"]')) {
    const trigger = document.querySelector<HTMLButtonElement>(
      '[data-tour="stock-edit-trigger"]',
    )
    trigger?.click()
    try {
      await waitForElement('[data-tour="stock-edit-action"]')
    } catch {
      /* noop */
    }
  }
}

export function useStockAdjustmentTour() {
  const { t } = useTranslation('inventory')
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
      onDestroyed: () => {
        // Remove the flag that suppresses Radix Popover auto-close
        document.body.classList.remove('tour-active')
        // Close the popover if it's still open when the tour ends/is closed
        const popoverOpen = document.querySelector('[data-tour="stock-edit-popover"]')
        if (popoverOpen) {
          // Simulate clicking the Cancelar button so Radix state stays in sync
          const cancelBtns = document.querySelectorAll('button')
          for (const b of cancelBtns) {
            if (b.textContent?.trim() === 'Cancelar') {
              b.click()
              break
            }
          }
        }
      },
      steps: [
        // 1) Welcome
        {
          popover: {
            title: t('tourStockAdjustment.welcome.title', {
              defaultValue: '📦 Ajustar existencias',
            }),
            description: t('tourStockAdjustment.welcome.description', {
              defaultValue:
                'Te enseñamos el flujo del día a día: <b>recibir mercancía</b>, registrar una <b>merma</b>, corregir un <b>robo</b>, o dejar constancia de un <b>conteo físico</b>.<br/><br/>Todo cambio queda registrado en <b>Historial</b> para auditoría.',
            }),
          },
        },

        // 2) Highlight the table — users learn where the action lives
        {
          element: '[data-tour="stock-edit-trigger"]',
          popover: {
            title: t('tourStockAdjustment.step1.title', {
              defaultValue: 'Haz clic en el número de existencias',
            }),
            description: t('tourStockAdjustment.step1.description', {
              defaultValue:
                'Cada fila de la tabla muestra el stock actual en la columna <b>Existencias físicas</b>. Al dar clic sobre ese número se abre un panel para ajustarlo.',
            }),
            side: 'left',
            align: 'start',
            onNextClick: async () => {
              if (!exists('[data-tour="stock-edit-popover"]')) {
                const trigger = document.querySelector<HTMLButtonElement>(
                  '[data-tour="stock-edit-trigger"]',
                )
                trigger?.click()
                try {
                  await waitForElement('[data-tour="stock-edit-popover"]')
                } catch {
                  /* noop */
                }
              }
              d.moveNext()
            },
          },
        },

        // 3) Action selector (6 movement types)
        {
          element: '[data-tour="stock-edit-action"]',
          onHighlightStarted: () => {
            void ensurePopoverOpen()
          },
          popover: {
            title: t('tourStockAdjustment.step2.title', {
              defaultValue: 'Elige el tipo de movimiento',
            }),
            description: t('tourStockAdjustment.step2.description', {
              defaultValue:
                'Hay 6 tipos. La regla es simple — elige el que describa qué pasó realmente:<br/><br/>• <b>Existencias recibidas</b>: llegó mercancía del proveedor (suma)<br/>• <b>Recuento de inventario</b>: corrige con el conteo físico (ajusta al total)<br/>• <b>Daño</b>: producto roto/inutilizable (resta)<br/>• <b>Robo</b>: faltante por robo/extravío (resta)<br/>• <b>Pérdida</b>: caducidad o desperdicio (resta)<br/>• <b>Devolución</b>: mercancía devuelta al proveedor (resta)',
            }),
            side: 'left',
            align: 'start',
          },
        },

        // 4) Quantity
        {
          element: '[data-tour="stock-edit-quantity"]',
          onHighlightStarted: () => {
            void ensurePopoverOpen()
          },
          popover: {
            title: t('tourStockAdjustment.step3.title', {
              defaultValue: 'Ingresa la cantidad',
            }),
            description: t('tourStockAdjustment.step3.description', {
              defaultValue:
                'Para <b>Existencias recibidas</b> o <b>Devolución</b>: la cantidad se suma o resta.<br/>Para <b>Recuento de inventario</b>: escribes el nuevo total después del conteo físico — el sistema calcula la diferencia.<br/><br/>El <b>Nuevo total</b> se calcula automáticamente debajo.',
            }),
            side: 'left',
            align: 'start',
          },
        },

        // 5) Save
        {
          element: '[data-tour="stock-edit-save"]',
          onHighlightStarted: () => {
            void ensurePopoverOpen()
          },
          popover: {
            title: t('tourStockAdjustment.step4.title', {
              defaultValue: 'Guarda el ajuste',
            }),
            description: t('tourStockAdjustment.step4.description', {
              defaultValue:
                'Al guardar, el stock se actualiza y queda un <b>registro permanente</b> en <b>Historial</b> con quién hizo el cambio, cuándo y por qué. Este historial es auditable y no se puede borrar.',
            }),
            side: 'left',
            align: 'end',
          },
        },

        // 6) Complete
        {
          popover: {
            title: t('tourStockAdjustment.complete.title', {
              defaultValue: '🎉 ¡Así se ajusta!',
            }),
            description: t('tourStockAdjustment.complete.description', {
              defaultValue:
                'La regla de oro: <b>siempre elige el tipo correcto</b>. Un ajuste mal clasificado hace imposible entender después si fue robo, merma o error. Si tienes dudas usa <b>Recuento de inventario</b>.',
            }),
          },
        },
      ],
    })

    return d
  }, [t])

  const start = useCallback(() => {
    driverRef.current?.destroy()
    // Signal to any Radix Popover/Dialog on the page that the tour is active,
    // so they won't auto-close on outside-click (which includes driver.js overlay).
    document.body.classList.add('tour-active')
    driverRef.current = buildDriver()
    driverRef.current.drive()
  }, [buildDriver])

  const stop = useCallback(() => {
    document.body.classList.remove('tour-active')
    driverRef.current?.destroy()
    driverRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      driverRef.current?.destroy()
    }
  }, [])

  return { start, stop }
}
