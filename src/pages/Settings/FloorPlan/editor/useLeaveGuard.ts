import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'

/**
 * Salir sin pasar por el editor también pregunta (D3, Codex P1-3):
 * - cerrar o recargar la pestaña del navegador con cambios: `beforeunload`;
 * - cualquier navegación del router (Atrás del navegador, un enlace del menú o de la miga de pan): React Router
 *   desmontaba el editor sin pasar por «¿Salir sin guardar?» y el borrador se perdía.
 * Mientras se guarda (o se recarga el plano) no se navega: la salida ESPERA. Si sale bien, sigue sola (ya no hay nada
 * que perder); si falla, se pregunta como siempre. Una navegación que no cambia de página no se detiene.
 * `conflict`: está abierto «Alguien más cambió el plano». Una salida detenida se CANCELA en ese momento: si no, al
 * llegar el 409 se abrían dos diálogos encimados (ése y «¿Salir sin guardar?»). Para salir, se vuelve a pedir.
 */
export function useLeaveGuard({ dirty, saving, conflict = false }: { dirty: boolean; saving: boolean; conflict?: boolean }) {
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
    if (held && conflict) blocker.reset?.()
    else if (held && !saving && !dirty) blocker.proceed?.()
  }, [held, saving, dirty, conflict, blocker])

  return {
    /** Una navegación detenida espera la respuesta a «¿Salir sin guardar?». */
    asking: held && !saving && dirty && !conflict,
    leave: () => blocker.proceed?.(),
    stay: () => blocker.reset?.(),
  }
}
