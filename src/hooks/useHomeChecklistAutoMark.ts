import { useOnboardingKey } from '@/hooks/useOnboardingState'
import { useAtomicTourCompletionListener, type AtomicTourName } from '@/hooks/useAtomicTourListener'

/**
 * Marca el paso correspondiente del HomeSetupChecklist como completado en
 * cuanto un atomic tour notifica completion. Vive en `dashboard.tsx` (no en
 * HomeSetupChecklist) para que el listener esté SIEMPRE montado cross-page,
 * incluso cuando el user está en /inventory/* completando el tour.
 *
 * Si lo dejáramos solo en HomeSetupChecklist, el listener no estaría
 * montado en el momento de la completion (la home no está renderizada
 * mientras el user recorre el tour) y el `markDone` se perdería.
 */

const STORAGE_KEY = 'home-checklist'

interface StepState {
  done: boolean
  doneAt?: string
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

export function useHomeChecklistAutoMark(): void {
  const { value: rawState, isLoaded, setValue } = useOnboardingKey<ChecklistState>(STORAGE_KEY, DEFAULT_STATE)

  useAtomicTourCompletionListener(
    name => {
      const stepId = STEP_BY_TOUR[name]
      if (!stepId) return
      const current: ChecklistState = rawState && typeof rawState === 'object'
        ? { dismissed: !!rawState.dismissed, steps: rawState.steps ?? {} }
        : DEFAULT_STATE
      if (current.steps[stepId]?.done) return
      setValue({
        ...current,
        steps: {
          ...current.steps,
          [stepId]: { done: true, doneAt: new Date().toISOString() },
        },
      })
    },
    { enabled: isLoaded },
  )
}
