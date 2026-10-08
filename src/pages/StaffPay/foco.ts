import { useMemo, useRef } from 'react'

const usable = (el: Element | null | undefined): el is HTMLElement =>
  !!el && el !== document.body && el.isConnected && !el.matches(':disabled')

/** Anillo de foco para los encabezados que reciben el foco por programa (`tabIndex -1`): se ve con teclado, no con ratón. */
export const ANCLA_FOCO = 'rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

let origenSoltado: Element | null = null
/**
 * Para abrir un modal desde DENTRO de otro (la tarjeta de pago en el diálogo de la clase, QA B-13): suelta el foco del botón
 * antes de que el modal nuevo oculte con `aria-hidden` el de abajo (si no, Chrome avisa «Blocked aria-hidden… descendant
 * retained focus») y recuerda el botón para volver a él al cerrar.
 */
export function soltarFocoAlAbrir(boton: Element | null) {
  origenSoltado = boton
  ;(boton as HTMLElement | null)?.blur?.()
}
/** Quién abrió: el que tiene el foco o, si se soltó para abrir (arriba), ese botón. */
const quienAbrio = () => {
  const activo = document.activeElement
  const el = usable(activo) ? activo : (origenSoltado ?? activo)
  origenSoltado = null
  return el
}

/**
 * Foco al abrir y cerrar los modales y paneles de pago por servicio (QA defecto 12). Se abren con estado, sin
 * `DialogTrigger`, y al cerrar Radix devuelve el foco a ese trigger que no existe: caía al <body> y el teclado (o el lector
 * de pantalla) perdía su lugar. Aquí se recuerda quién abrió y al cerrar se vuelve a él; si ya no está o quedó apagado (se
 * marcó pagado, se cerró el periodo, se abrió desde otro modal), al encabezado del periodo (`data-staffpay-ancla`) o, si
 * la vista todavía carga, al selector de periodo.
 */
export function useFocoDeVuelta(
  /**
   * Un lugar estable antes del encabezado del periodo (p. ej. `#staffpay-diferencias`): si el botón ya no está, ahí. Varios
   * selectores, en orden: el primero que exista y se pueda enfocar (p. ej. el botón de una tarjeta y, si ya no lo tiene, la
   * tarjeta misma; E6a-fix2 C3).
   */
  respaldo?: string | string[],
) {
  const origen = useRef<Element | null>(null)
  const respaldos = respaldo === undefined ? [] : Array.isArray(respaldo) ? respaldo : [respaldo]
  // La lista se recrea en cada pintada; el memo depende de su contenido.
  const clave = respaldos.join('\n')
  return useMemo(
    () => ({
      /** Sheet y AlertDialog: Radix ya enfoca adentro; sólo se recuerda quién abrió. */
      onOpenAutoFocus: () => {
        origen.current = quienAbrio()
      },
      /**
       * FullScreenModal: además el foco entra al modal (a su contenedor, sin enfocar un campo ni abrir el teclado). Si se
       * quedara en el botón de afuera, ese botón queda bajo `aria-hidden` y Chrome avisa «Blocked aria-hidden… retained focus».
       */
      onOpenAutoFocusPantallaCompleta: (e: Event) => {
        origen.current = quienAbrio()
        e.preventDefault()
        ;(e.currentTarget as HTMLElement | null)?.focus({ preventScroll: true })
      },
      onCloseAutoFocus: (e: Event) => {
        e.preventDefault()
        const destino = [
          origen.current,
          ...(clave ? clave.split('\n') : []).map(sel => document.querySelector(sel)),
          document.querySelector('[data-staffpay-ancla]'),
          document.getElementById('staffpay-periodo'),
        ].find(usable)
        destino?.focus({ preventScroll: true })
      },
    }),
    [clave],
  )
}
