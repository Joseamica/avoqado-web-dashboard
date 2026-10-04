import { useMemo, useRef } from 'react'

const usable = (el: Element | null | undefined): el is HTMLElement =>
  !!el && el !== document.body && el.isConnected && !el.matches(':disabled')

/**
 * Foco al abrir y cerrar los modales y paneles de pago por servicio (QA defecto 12). Se abren con estado, sin
 * `DialogTrigger`, y al cerrar Radix devuelve el foco a ese trigger que no existe: caía al <body> y el teclado (o el lector
 * de pantalla) perdía su lugar. Aquí se recuerda quién abrió y al cerrar se vuelve a él; si ya no está o quedó apagado (se
 * marcó pagado, se cerró el periodo, se abrió desde otro modal), al encabezado del periodo (`data-staffpay-ancla`) o, si
 * la vista todavía carga, al selector de periodo.
 */
export function useFocoDeVuelta() {
  const origen = useRef<Element | null>(null)
  return useMemo(
    () => ({
      /** Sheet y AlertDialog: Radix ya enfoca adentro; sólo se recuerda quién abrió. */
      onOpenAutoFocus: () => {
        origen.current = document.activeElement
      },
      /**
       * FullScreenModal: además el foco entra al modal (a su contenedor, sin enfocar un campo ni abrir el teclado). Si se
       * quedara en el botón de afuera, ese botón queda bajo `aria-hidden` y Chrome avisa «Blocked aria-hidden… retained focus».
       */
      onOpenAutoFocusPantallaCompleta: (e: Event) => {
        origen.current = document.activeElement
        e.preventDefault()
        ;(e.currentTarget as HTMLElement | null)?.focus({ preventScroll: true })
      },
      onCloseAutoFocus: (e: Event) => {
        e.preventDefault()
        const destino = [origen.current, document.querySelector('[data-staffpay-ancla]'), document.getElementById('staffpay-periodo')].find(usable)
        destino?.focus({ preventScroll: true })
      },
    }),
    [],
  )
}
