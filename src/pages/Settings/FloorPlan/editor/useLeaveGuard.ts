import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'

/**
 * Salir sin pasar por el editor también pregunta (D3, Codex P1-3):
 * - cerrar o recargar la pestaña del navegador con cambios: `beforeunload`;
 * - cualquier navegación del router (Atrás del navegador, un enlace del menú o de la miga de pan): React Router
 *   desmontaba el editor sin pasar por «¿Salir sin guardar?» y el borrador se perdía.
 * Mientras se guarda no se navega: la salida ESPERA. Si el guardado sale bien, sigue sola (ya no hay nada que perder);
 * si falla, se pregunta como siempre. Una navegación que no cambia de página no se detiene.
 */
export function useLeaveGuard({ dirty, saving }: { dirty: boolean; saving: boolean }) {
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const blocker = useBlocker(({ currentLocation, nextLocation }) => (dirty || saving) && currentLocation.pathname !== nextLocation.pathname)
  const held = blocker.state === 'blocked'
  useEffect(() => {
    if (held && !saving && !dirty) blocker.proceed?.()
  }, [held, saving, dirty, blocker])

  return {
    /** Una navegación detenida espera la respuesta a «¿Salir sin guardar?». */
    asking: held && !saving && dirty,
    leave: () => blocker.proceed?.(),
    stay: () => blocker.reset?.(),
  }
}
