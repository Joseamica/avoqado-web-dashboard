import { useEffect, useRef } from 'react'
import { useOnboardingKey } from '@/hooks/useOnboardingState'
import { useAtomicTourCompletionListener, type AtomicTourName } from '@/hooks/useAtomicTourListener'
import { TOUR_CANCELLED_EVENT } from '@/lib/tour-progress'

/**
 * Marca el paso correspondiente del HomeSetupChecklist como completado en
 * cuanto un atomic tour notifica completion. Vive en `dashboard.tsx` (no en
 * HomeSetupChecklist) para que el listener esté SIEMPRE montado cross-page,
 * incluso cuando el user está en /inventory/* completando el tour.
 *
 * Si lo dejáramos solo en HomeSetupChecklist, el listener no estaría
 * montado en el momento de la completion (la home no está renderizada
 * mientras el user recorre el tour) y el `markDone` se perdería.
 *
 * También escucha el evento de cancelación (botón "Cancelar" en el último
 * step) y limpia el flag `inProgress` para que el badge "En curso"
 * desaparezca cuando el user explícitamente abandona el tour.
 */

const STORAGE_KEY = 'home-checklist'

interface StepState {
  done: boolean
  doneAt?: string
  inProgress?: boolean
  lastStepIndex?: number
}

interface ChecklistState {
  dismissed: boolean
  steps: Record<string, StepState>
}

const DEFAULT_STATE: ChecklistState = {
  dismissed: false,
  steps: {},
}

// Mapping atomic tour name → checklist step id. Mantén sincronizado con
// los STEPS de HomeSetupChecklist.tsx.
const STEP_BY_TOUR: Partial<Record<AtomicTourName, string>> = {
  product: 'catalog',
  ingredient: 'inventory',
  'team-invitation': 'team',
  'tpv-onboarding': 'tpv',
  'reservations-onboarding': 'reservations',
}

function buildCurrent(rawState: unknown): ChecklistState {
  if (rawState && typeof rawState === 'object') {
    const r = rawState as Partial<ChecklistState>
    return { dismissed: !!r.dismissed, steps: r.steps ?? {} }
  }
  return DEFAULT_STATE
}

export function useHomeChecklistAutoMark(): void {
  const { value: rawState, isLoaded, setValue } = useOnboardingKey<ChecklistState>(STORAGE_KEY, DEFAULT_STATE)

  // Refs para que el listener `window` (cancellation) lea siempre el
  // último state/setter sin re-registrarse.
  const rawStateRef = useRef(rawState)
  const setValueRef = useRef(setValue)
  rawStateRef.current = rawState
  setValueRef.current = setValue

  useAtomicTourCompletionListener(
    name => {
      const stepId = STEP_BY_TOUR[name]
      if (!stepId) return
      const current = buildCurrent(rawState)
      if (current.steps[stepId]?.done) return
      // Atomic: marcamos done + limpiamos inProgress + reseteamos
      // lastStepIndex en una sola PUT — evita race con el debounce de
      // useTourProgressSync que podría escribir un index obsoleto.
      setValue({
        ...current,
        steps: {
          ...current.steps,
          [stepId]: {
            done: true,
            doneAt: new Date().toISOString(),
            inProgress: false,
            lastStepIndex: 0,
          },
        },
      })
    },
    { enabled: isLoaded },
  )

  // Listener para cancelación — limpia el flag inProgress sin marcar done.
  useEffect(() => {
    if (!isLoaded) return
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ name: AtomicTourName }>).detail
      if (!detail?.name) return
      const stepId = STEP_BY_TOUR[detail.name]
      if (!stepId) return
      const current = buildCurrent(rawStateRef.current)
      const prev = current.steps[stepId]
      if (!prev?.inProgress) return
      // En cancelación también limpiamos lastStepIndex — el `cancel()` del
      // helper ya llama clearTourStepIndex, pero hacerlo aquí garantiza
      // atomicidad y evita que el debounce escriba un index posterior.
      setValueRef.current({
        ...current,
        steps: {
          ...current.steps,
          [stepId]: { ...prev, inProgress: false, lastStepIndex: 0 },
        },
      })
    }
    window.addEventListener(TOUR_CANCELLED_EVENT, handler)
    return () => window.removeEventListener(TOUR_CANCELLED_EVENT, handler)
  }, [isLoaded])
}
