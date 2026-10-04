import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useFocoDeVuelta } from '../foco'

const crear = (html: string) => {
  const caja = document.createElement('div')
  caja.innerHTML = html
  document.body.appendChild(caja)
  return caja
}
const evento = () => new Event('focusScope.autoFocusOnUnmount', { cancelable: true })

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useFocoDeVuelta (QA defecto 12: el foco nunca cae al <body>)', () => {
  it('al cerrar vuelve al botón que abrió, si sigue ahí', () => {
    crear('<h3 tabindex="-1" data-staffpay-ancla>Periodo</h3><button id="abrir">Marcar pagado</button>')
    const { result } = renderHook(() => useFocoDeVuelta())
    document.getElementById('abrir')!.focus()
    result.current.onOpenAutoFocus()
    const e = evento()
    result.current.onCloseAutoFocus(e)
    expect(e.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(document.getElementById('abrir'))
  })

  it('si el botón ya no existe (se marcó pagado), va al encabezado del periodo', () => {
    crear('<h3 tabindex="-1" data-staffpay-ancla>Periodo</h3><button id="abrir">Marcar pagado</button>')
    const { result } = renderHook(() => useFocoDeVuelta())
    document.getElementById('abrir')!.focus()
    result.current.onOpenAutoFocus()
    document.getElementById('abrir')!.remove()
    result.current.onCloseAutoFocus(evento())
    expect(document.activeElement).toHaveAttribute('data-staffpay-ancla')
  })

  it('si el botón quedó apagado, también va al encabezado', () => {
    crear('<h3 tabindex="-1" data-staffpay-ancla>Periodo</h3><button id="abrir">Marcar todos</button>')
    const { result } = renderHook(() => useFocoDeVuelta())
    document.getElementById('abrir')!.focus()
    result.current.onOpenAutoFocus()
    ;(document.getElementById('abrir') as HTMLButtonElement).disabled = true
    result.current.onCloseAutoFocus(evento())
    expect(document.activeElement).toHaveAttribute('data-staffpay-ancla')
  })

  it('abierto desde otro modal (el foco ya estaba en el <body>) y sin encabezado todavía: al selector de periodo', () => {
    crear('<button id="staffpay-periodo">septiembre de 2026</button>')
    const { result } = renderHook(() => useFocoDeVuelta())
    ;(document.activeElement as HTMLElement | null)?.blur()
    result.current.onOpenAutoFocus()
    result.current.onCloseAutoFocus(evento())
    expect(document.activeElement).toBe(document.getElementById('staffpay-periodo'))
  })

  it('pantalla completa: al abrir el foco entra al contenedor del modal (no se queda en el botón de afuera)', () => {
    const caja = crear('<button id="abrir">Cerrar periodo</button><div id="modal" tabindex="-1"><input /></div>')
    const { result } = renderHook(() => useFocoDeVuelta())
    document.getElementById('abrir')!.focus()
    const modal = caja.querySelector<HTMLElement>('#modal')!
    const e = new Event('focusScope.autoFocusOnMount', { cancelable: true })
    modal.addEventListener('focusScope.autoFocusOnMount', result.current.onOpenAutoFocusPantallaCompleta)
    modal.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(modal)
    // …y al cerrar vuelve al botón que lo abrió.
    result.current.onCloseAutoFocus(evento())
    expect(document.activeElement).toBe(document.getElementById('abrir'))
  })
})
