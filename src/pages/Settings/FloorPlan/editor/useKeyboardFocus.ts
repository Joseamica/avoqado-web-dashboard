import { useEffect, useRef, type MutableRefObject } from 'react'

/**
 * El elemento que recibió el foco por TECLADO (Tab, flechas…); `null` si llegó por el ratón. Una tecla antes del foco
 * = teclado; un toque de puntero = ratón. El lienzo lo usa para decidir de quién es Espacio: de un control al que se
 * llegó con el teclado, o la mano que mueve el plano.
 *
 * Lo lleva el EDITOR, no el lienzo (m1 de 15-D): el lienzo se desmonta con la vista del mesero y, al volver, olvidaba
 * que «Vista del mesero» tenía el foco por teclado: el tercer Espacio movía el plano en vez de pulsar el botón.
 * `enabled = false` no escucha nada (el lienzo suelto, en sus pruebas, usa el suyo).
 */
export function useKeyboardFocus(enabled = true): MutableRefObject<EventTarget | null> {
  const keyboardFocus = useRef<EventTarget | null>(null)
  useEffect(() => {
    if (!enabled) return
    let viaKeyboard = false
    const onAnyKey = () => {
      viaKeyboard = true
    }
    const onPointer = () => {
      viaKeyboard = false
    }
    const onFocusIn = (e: FocusEvent) => {
      keyboardFocus.current = viaKeyboard ? e.target : null
    }
    window.addEventListener('keydown', onAnyKey, true)
    window.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('focusin', onFocusIn, true)
    return () => {
      window.removeEventListener('keydown', onAnyKey, true)
      window.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('focusin', onFocusIn, true)
    }
  }, [enabled])
  return keyboardFocus
}
