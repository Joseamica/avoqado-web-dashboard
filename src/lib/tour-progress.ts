import type { AtomicTourName } from '@/hooks/useAtomicTourListener'

/**
 * Persistencia del progreso DENTRO de un atomic tour. Permite reanudar el
 * tour desde el último step donde el usuario quedó si lo cierra (X, ESC,
 * navegación) y vuelve después.
 *
 * ## Arquitectura
 *
 * Persistimos en backend dentro del registro `home-checklist`
 * (`StaffOnboardingState`) — coherente con el flag `inProgress` del
 * checklist y soporta cross-device / cross-tab.
 *
 * Las callbacks de driver.js (`onHighlightStarted`, `start()`) corren
 * fuera del render de React y necesitan lectura/escritura síncrona. Para
 * salvar esa fricción mantenemos un cache en memoria (Map) que el hook
 * `useTourProgressSync` (montado en `dashboard.tsx`) hidrata desde
 * backend al boot y mantiene sincronizado:
 *
 *   - tour callback escribe → `setTourStepIndex` muta el Map → notifica
 *     listeners → `useTourProgressSync` debounce 500ms → PUT al backend.
 *   - backend cambia (otra pestaña / dispositivo) → TanStack Query
 *     re-fetch → `useTourProgressSync` re-hidrata el Map.
 *
 * Además exporta el evento `TOUR_CANCELLED_EVENT` que dispara el botón
 * "Cancelar" del último step del tour para que el checklist limpie el
 * flag `inProgress` sin marcar el step como done.
 */

/**
 * Mapeo atomic-tour → step id del HomeSetupChecklist. Mantén sincronizado
 * con `STEP_BY_TOUR` en `useHomeChecklistAutoMark.ts` (idealmente exportar
 * de un solo lugar — TODO en cleanup follow-up).
 */
const STEP_BY_TOUR: Partial<Record<AtomicTourName, string>> = {
  product: 'catalog',
  ingredient: 'inventory',
  'team-invitation': 'team',
  'tpv-onboarding': 'tpv',
  'reservations-onboarding': 'reservations',
}

// Cache módulo. Map<stepId, lastStepIndex>. Lectura/escritura O(1) síncrona.
const cache = new Map<string, number>()

// Listeners notificados ante cada `setTourStepIndex` para que
// `useTourProgressSync` propague al backend (con debounce).
type WriteListener = (stepId: string, index: number) => void
const writeListeners = new Set<WriteListener>()

export const TOUR_CANCELLED_EVENT = 'avoqado-tour-cancelled'

/**
 * Hidrata el cache desde el state del backend. Llamado por
 * `useTourProgressSync` cuando el `home-checklist` carga o cambia.
 * Reemplaza completamente el contenido del cache para reflejar el state
 * remoto (ej: otra pestaña actualizó).
 */
export function hydrateTourProgress(map: Record<string, number>): void {
  cache.clear()
  for (const [stepId, index] of Object.entries(map)) {
    cache.set(stepId, index)
  }
}

/**
 * Suscribe un listener a escrituras del cache. Devuelve función de cleanup.
 * Usado por `useTourProgressSync` para detectar writes y propagar al
 * backend.
 */
export function subscribeTourProgressWrites(listener: WriteListener): () => void {
  writeListeners.add(listener)
  return () => {
    writeListeners.delete(listener)
  }
}

export function setTourStepIndex(name: AtomicTourName, index: number): void {
  const stepId = STEP_BY_TOUR[name]
  if (!stepId) return
  const safeIndex = Number.isFinite(index) && index >= 0 ? index : 0
  // No-op si el valor no cambió (evita re-disparar el debounce + PUT).
  if (cache.get(stepId) === safeIndex) return
  cache.set(stepId, safeIndex)
  writeListeners.forEach(l => l(stepId, safeIndex))
}

export function getTourStepIndex(name: AtomicTourName): number {
  const stepId = STEP_BY_TOUR[name]
  if (!stepId) return 0
  return cache.get(stepId) ?? 0
}

export function clearTourStepIndex(name: AtomicTourName): void {
  // 0 es el estado canónico de "no empezado". El backend lo persiste
  // explícitamente para que un refresh desde otro dispositivo vea el
  // tour como "limpio" en vez de heredar un index obsoleto.
  setTourStepIndex(name, 0)
}

export function notifyAtomicTourCancelled(name: AtomicTourName): void {
  window.dispatchEvent(new CustomEvent(TOUR_CANCELLED_EVENT, { detail: { name } }))
}

// Helper para los hooks que necesitan iterar sobre los step ids conocidos
// (ej: `useTourProgressSync` al hidratar). NO exportamos el Map directo
// para mantener encapsulamiento.
export function getKnownStepIds(): string[] {
  return Object.values(STEP_BY_TOUR).filter((v): v is string => !!v)
}
