import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { notifyAtomicTourCompleted, useAtomicTourListener } from '@/hooks/useAtomicTourListener'

/** Espera a que un nodo exista (el modal del diseñador tarda en montarse). */
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
      reject(new Error(`waitForElement: timeout esperando ${selector}`))
    }, timeout)
  })
}

/** `true` si el nodo está en el DOM AHORA. */
function exists(selector: string): boolean {
  return !!document.querySelector(selector)
}

/**
 * Tour del diseñador del ticket.
 *
 * Lo que este tour tiene que lograr, y no es «enseñar la pantalla»: que el dueño entienda
 * POR QUÉ hay bloques que no puede quitar. Ése es el único punto donde la pantalla puede
 * parecer que le está negando algo sin motivo.
 *
 * `data-tour` requeridos:
 *   - `receipt-layout-design`     — el botón que abre el diseñador (en Ajustes)
 *   - `receipt-layout-block-list` — la lista de bloques (dentro del modal)
 *   - `receipt-layout-paper`      — el papel
 *   - `receipt-layout-width-58`   — el selector de 58 mm
 *   - `receipt-layout-save`       — Guardar
 */
export function useReceiptLayoutTour() {
  const { t } = useTranslation('receiptLayout')
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
      nextBtnText: t('tour.next'),
      prevBtnText: t('tour.prev'),
      doneBtnText: t('tour.done'),
      progressText: t('tour.progress'),
      steps: [
        {
          popover: {
            title: t('tour.welcome.title'),
            description: t('tour.welcome.description'),
          },
        },
        {
          element: '[data-tour="receipt-layout-design"]',
          popover: {
            title: t('tour.open.title'),
            description: t('tour.open.description'),
            side: 'bottom',
            align: 'start',
            // 🔴 Los pasos siguientes viven DENTRO del modal, así que el tour lo abre él mismo.
            // Sin esto, un tour lanzado desde la lista de tareas iluminaría elementos que no
            // existen y se vería roto — que es peor que no tener tour.
            onNextClick: async () => {
              if (!exists('[data-tour="receipt-layout-block-list"]')) {
                document.querySelector<HTMLButtonElement>('[data-tour="receipt-layout-design"]')?.click()
                try {
                  await waitForElement('[data-tour="receipt-layout-block-list"]')
                } catch {
                  /* si no abre, se avanza igual: el tour informa, no bloquea */
                }
              }
              d.moveNext()
            },
          },
        },
        {
          element: '[data-tour="receipt-layout-block-list"]',
          popover: { title: t('tour.list.title'), description: t('tour.list.description'), side: 'right', align: 'start' },
        },
        {
          // 🔴 El paso que de verdad importa: por qué hay candados y qué significa cada letra.
          element: '[data-tour="receipt-layout-block-list"]',
          popover: { title: t('tour.locks.title'), description: t('tour.locks.description'), side: 'right', align: 'center' },
        },
        {
          element: '[data-tour="receipt-layout-paper"]',
          popover: { title: t('tour.paper.title'), description: t('tour.paper.description'), side: 'left', align: 'start' },
        },
        {
          element: '[data-tour="receipt-layout-width-58"]',
          popover: { title: t('tour.width.title'), description: t('tour.width.description'), side: 'bottom', align: 'end' },
        },
        {
          element: '[data-tour="receipt-layout-save"]',
          popover: {
            title: t('tour.save.title'),
            description: t('tour.save.description'),
            side: 'bottom',
            align: 'end',
            onNextClick: () => {
              notifyAtomicTourCompleted('receipt-layout')
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

  useAtomicTourListener('receipt-layout', start)

  return { start, stop }
}
