import { useCallback, useEffect, useState } from 'react'

export type SeccionDeLaFicha = 'checkout-steps' | 'customer-display'

const MAX_CUADROS = 60 // ~1 s

/** El `id` del ancla de cada sección de la ficha (`CheckoutStepsSection`, `CustomerDisplaySection`). */
export const idDeLaSeccion = (s: SeccionDeLaFicha) => `ficha-${s}`

/**
 * Aparatos claros, Paso 2: «Cambiar» de «¿Cómo cobra?» y de «Pantalla del cliente» lleva a su sección, que vive en la pestaña
 * «Información». Si otra pestaña está activa, primero cambia a ella; el desplazamiento y el foco van cuando la sección ya
 * está montada (Codex r1 #4), no antes.
 */
export function useIrALaSeccion(activeTab: string, irAInformacion: () => void) {
  const [pendiente, setPendiente] = useState<SeccionDeLaFicha | null>(null)

  useEffect(() => {
    if (!pendiente || activeTab !== 'info') return
    // Radix monta el contenido de la pestaña un render después del cambio (Codex final #2): se busca cada cuadro, con tope,
    // y se suelta el pendiente al llegar o al agotarlo para que nunca salte después por sorpresa.
    let cuadro = 0
    let intentos = 0
    const intentar = () => {
      const el = document.getElementById(idDeLaSeccion(pendiente))
      if (el) {
        el.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
        el.focus({ preventScroll: true })
      }
      if (el || ++intentos >= MAX_CUADROS) setPendiente(null)
      else cuadro = requestAnimationFrame(intentar)
    }
    intentar()
    return () => cancelAnimationFrame(cuadro)
  }, [pendiente, activeTab])

  return useCallback(
    (s: SeccionDeLaFicha) => {
      if (activeTab !== 'info') irAInformacion()
      setPendiente(s)
    },
    [activeTab, irAInformacion],
  )
}
