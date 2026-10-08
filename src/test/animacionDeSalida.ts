import { act } from '@testing-library/react'
import { vi } from 'vitest'

/**
 * Radix deja el contenido de un diálogo montado mientras dura su animación de salida (E6a-fix4 K-n1): lo que se pinta en ese rato
 * lo ve el usuario. jsdom no pinta CSS, así que esto la simula como la lee Radix (`Presence`): el elemento con ese `role` tiene una
 * animación al abrir (`entrar`) y OTRA al cerrar (`salir`). Llamar en `beforeEach`; `vi.restoreAllMocks()` la quita.
 */
export function simularAnimacionDeSalida(role = 'alertdialog') {
  const original = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element, pseudo?: string | null) => {
    const s = original(el, pseudo)
    if (el.getAttribute?.('role') !== role) return s
    return new Proxy(s, {
      get: (t, p) => (p === 'animationName' ? (el.getAttribute('data-state') === 'closed' ? 'salir' : 'entrar') : Reflect.get(t, p, t)),
    })
  })
}

/** Termina la animación de salida: Radix desmonta el contenido (y llama a `onCloseAutoFocus`). */
export function terminarAnimacion(el: Element) {
  act(() => {
    const fin = new Event('animationend', { bubbles: true })
    Object.assign(fin, { animationName: 'salir' })
    el.dispatchEvent(fin)
  })
}
