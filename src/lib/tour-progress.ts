import type { AtomicTourName } from '@/hooks/useAtomicTourListener'

/**
 * Persistencia ligera del progreso DENTRO de un atomic tour. Se usa para
 * reanudar el tour desde el último step donde el usuario quedó cuando lo
 * cierra a media (X, ESC, click fuera) y vuelve después.
 *
 * Se guarda en sessionStorage — no necesita sobrevivir reload de tab; el
 * "En curso" persistente del HomeSetupChecklist (que sí va al backend) ya
 * indica que el tour fue empezado, y al re-clickear "En curso" se intenta
 * leer el índice desde aquí.
 *
 * Eventos:
 *   - `avoqado-tour-cancelled`: dispatched por buildFinalStepFooter cuando
 *     el user da Cancelar en el último step. dashboard.tsx escucha y
 *     limpia el flag inProgress del checklist.
 */

const STEP_KEY_PREFIX = 'avoqado-tour-step-index::'

export const TOUR_CANCELLED_EVENT = 'avoqado-tour-cancelled'

export function setTourStepIndex(name: AtomicTourName, index: number): void {
  try {
    sessionStorage.setItem(`${STEP_KEY_PREFIX}${name}`, String(index))
  } catch {
    /* noop */
  }
}

export function getTourStepIndex(name: AtomicTourName): number {
  try {
    const raw = sessionStorage.getItem(`${STEP_KEY_PREFIX}${name}`)
    if (!raw) return 0
    const n = Number.parseInt(raw, 10)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

export function clearTourStepIndex(name: AtomicTourName): void {
  try {
    sessionStorage.removeItem(`${STEP_KEY_PREFIX}${name}`)
  } catch {
    /* noop */
  }
}

export function notifyAtomicTourCancelled(name: AtomicTourName): void {
  window.dispatchEvent(new CustomEvent(TOUR_CANCELLED_EVENT, { detail: { name } }))
}
