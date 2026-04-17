import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Interactive onboarding tour for purchase orders.
 * Teaches the full flow: new order → select supplier → add items → save.
 *
 * Purchase orders are how venues ORDER raw materials from their suppliers,
 * and when received they automatically create StockBatches that feed FIFO
 * for recipe-based products. Without purchase orders, recipe-based inventory
 * has no cost basis.
 *
 * Required `data-tour` attributes:
 *   - `po-new-btn`                  — "Nueva orden" button in header
 *   - `po-wizard-supplier`          — Supplier picker row inside wizard
 *   - `po-wizard-items`             — Items section container
 *   - `po-wizard-add-item`          — Add item button
 *   - `po-wizard-totals`            — Subtotal / tax / total block
 *   - `po-wizard-save-draft`        — Save as draft button
 *   - `po-wizard-submit`            — Primary submit button
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

export function usePurchaseOrderTour() {
  const { t } = useTranslation('purchaseOrders')
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
            title: t('tourPurchaseOrder.welcome.title', {
              defaultValue: '📦 Crear una orden de compra',
            }),
            description: t('tourPurchaseOrder.welcome.description', {
              defaultValue:
                'Las órdenes de compra son cómo <b>le pides mercancía a tus proveedores</b>. Cuando la recibes, el sistema crea <b>lotes (batches)</b> con costo y caducidad — es lo que permite que recetas como un shake sepan cuánto cuestan realmente.<br/><br/>Sin órdenes de compra, tu <b>costo de receta</b> queda en ceros.',
            }),
          },
        },

        // 2) New order button
        {
          element: '[data-tour="po-new-btn"]',
          popover: {
            title: t('tourPurchaseOrder.step1.title', {
              defaultValue: 'Botón "Crear orden"',
            }),
            description: t('tourPurchaseOrder.step1.description', {
              defaultValue:
                'Desde aquí abres el asistente. Al darle <b>Siguiente</b> lo abrimos por ti.',
            }),
            side: 'bottom',
            align: 'end',
            onNextClick: async () => {
              if (!exists('[data-tour="po-wizard-supplier"]')) {
                const btn = document.querySelector<HTMLButtonElement>(
                  '[data-tour="po-new-btn"]',
                )
                btn?.click()
                try {
                  await waitForElement('[data-tour="po-wizard-supplier"]')
                } catch {
                  /* noop */
                }
              }
              d.moveNext()
            },
          },
        },

        // 3) Supplier
        {
          element: '[data-tour="po-wizard-supplier"]',
          popover: {
            title: t('tourPurchaseOrder.step2.title', {
              defaultValue: 'Elige el proveedor',
            }),
            description: t('tourPurchaseOrder.step2.description', {
              defaultValue:
                'Cada orden necesita un proveedor. Si no lo tienes registrado, escríbelo y presiona <b>Crear</b> — se guarda al vuelo sin salir del asistente.<br/><br/>Ejemplo: <b>Sarais</b>, <b>Lácteos del Valle</b>, <b>Proveedor CDMX</b>.',
            }),
            side: 'bottom',
            align: 'start',
          },
        },

        // 4) Items section
        {
          element: '[data-tour="po-wizard-items"]',
          popover: {
            title: t('tourPurchaseOrder.step3.title', {
              defaultValue: 'Agrega los artículos',
            }),
            description: t('tourPurchaseOrder.step3.description', {
              defaultValue:
                'Cada renglón es un <b>ingrediente</b> (raw material) que le estás pidiendo al proveedor. Debe existir previamente en tu catálogo de Ingredientes — si no, créalo primero.<br/><br/>Pon la <b>cantidad</b> y el <b>precio unitario</b>. El subtotal se calcula solo.',
            }),
            side: 'top',
            align: 'start',
          },
        },

        // 5) Add item
        {
          element: '[data-tour="po-wizard-add-item"]',
          popover: {
            title: t('tourPurchaseOrder.step4.title', {
              defaultValue: 'Botón "Agregar artículo"',
            }),
            description: t('tourPurchaseOrder.step4.description', {
              defaultValue:
                'Si necesitas varios ingredientes en la misma orden, úsalo tantas veces como haga falta. Es normal tener 5-15 renglones en una orden semanal.',
            }),
            side: 'left',
            align: 'start',
          },
        },

        // 6) Totals / tax
        {
          element: '[data-tour="po-wizard-totals"]',
          popover: {
            title: t('tourPurchaseOrder.step5.title', {
              defaultValue: 'Subtotal, IVA y total',
            }),
            description: t('tourPurchaseOrder.step5.description', {
              defaultValue:
                'El <b>IVA</b> es opcional — activa <i>"Añadir impuesto"</i> si tu proveedor te lo factura. Puede ser porcentual (16%) o fijo. El <b>total</b> es lo que realmente vas a pagar.',
            }),
            side: 'top',
            align: 'end',
          },
        },

        // 7) Save draft vs submit
        {
          element: '[data-tour="po-wizard-submit"]',
          popover: {
            title: t('tourPurchaseOrder.step6.title', {
              defaultValue: 'Guardar o enviar',
            }),
            description: t('tourPurchaseOrder.step6.description', {
              defaultValue:
                '<b>Guardar como borrador</b>: la orden queda lista pero aún no se aprueba.<br/><b>Crear orden</b>: la envía al flujo de aprobación (si aplica) o queda lista para enviar al proveedor.<br/><br/>⚠️ El <b>inventario se actualiza al recibirla</b>, no al crearla.',
            }),
            side: 'top',
            align: 'end',
          },
        },

        // 8) Complete
        {
          popover: {
            title: t('tourPurchaseOrder.complete.title', {
              defaultValue: '🎉 ¡Ya sabes pedir mercancía!',
            }),
            description: t('tourPurchaseOrder.complete.description', {
              defaultValue:
                'Recuerda el ciclo: <b>Crear orden</b> → enviar al proveedor → <b>Recibir</b> (botón en el detalle de la orden) → se crean los lotes con costo → tus recetas ya conocen el costo real.<br/><br/>Cada orden recibida queda en <b>Historial</b> para auditoría.',
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

  useEffect(() => {
    return () => {
      driverRef.current?.destroy()
    }
  }, [])

  return { start, stop }
}
