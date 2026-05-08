import { useEffect, useRef } from 'react'
import { useOnboardingKey } from '@/hooks/useOnboardingState'
import {
  getKnownStepIds,
  hydrateTourProgress,
  subscribeTourProgressWrites,
} from '@/lib/tour-progress'

/**
 * Sync entre el cache módulo de `tour-progress.ts` y el registro
 * `home-checklist` del backend. Montar UNA sola vez en `dashboard.tsx`.
 *
 * Responsabilidades:
 *   1. Hidratar el cache cuando el backend value carga o cambia.
 *   2. Escuchar writes del cache y propagarlos al backend (debounced).
 *   3. Flush pendiente al unmount (best-effort — el async PUT no se
 *      garantiza si el browser está cerrando, pero TanStack Query
 *      maneja optimistic updates así que el state local queda OK).
 */

const STORAGE_KEY = 'home-checklist'
const DEBOUNCE_MS = 500

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

const DEFAULT_STATE: ChecklistState = { dismissed: false, steps: {} }

function buildCurrent(rawState: unknown): ChecklistState {
  if (rawState && typeof rawState === 'object') {
    const r = rawState as Partial<ChecklistState>
    return { dismissed: !!r.dismissed, steps: r.steps ?? {} }
  }
  return DEFAULT_STATE
}

export function useTourProgressSync(): void {
  const { value: rawState, isLoaded, setValue } = useOnboardingKey<ChecklistState>(STORAGE_KEY, DEFAULT_STATE)

  // Refs para que los handlers asíncronos lean siempre el state/setter
  // más reciente sin re-suscribirse en cada render.
  const rawStateRef = useRef(rawState)
  const setValueRef = useRef(setValue)
  rawStateRef.current = rawState
  setValueRef.current = setValue

  // Hidrata el Map desde backend cuando cambia el rawState (incluye
  // refetch tras refocus de window — gracias a TanStack Query).
  useEffect(() => {
    if (!isLoaded) return
    const current = buildCurrent(rawState)
    const map: Record<string, number> = {}
    for (const stepId of getKnownStepIds()) {
      const idx = current.steps[stepId]?.lastStepIndex
      if (typeof idx === 'number' && idx > 0) map[stepId] = idx
    }
    hydrateTourProgress(map)
  }, [rawState, isLoaded])

  // Suscribe a writes del cache → debounce → PUT al backend.
  useEffect(() => {
    // Map de step id → último index pendiente de escribir + timer asociado.
    const timers = new Map<string, ReturnType<typeof setTimeout>>()
    const pending = new Map<string, number>()

    const flush = (stepId: string) => {
      timers.delete(stepId)
      const index = pending.get(stepId)
      pending.delete(stepId)
      if (index === undefined) return

      const current = buildCurrent(rawStateRef.current)
      const prev = current.steps[stepId] ?? { done: false }
      // No-op si el backend ya tiene este index — evita PUT redundante
      // (ej: el cache se hidrató del backend y los listeners disparan
      // como "write").
      if (prev.lastStepIndex === index) return
      setValueRef.current({
        ...current,
        steps: {
          ...current.steps,
          [stepId]: { ...prev, lastStepIndex: index },
        },
      })
    }

    const unsubscribe = subscribeTourProgressWrites((stepId, index) => {
      pending.set(stepId, index)
      const existing = timers.get(stepId)
      if (existing) clearTimeout(existing)
      timers.set(
        stepId,
        setTimeout(() => flush(stepId), DEBOUNCE_MS),
      )
    })

    return () => {
      unsubscribe()
      // Flush final — best-effort para no perder el último step si el
      // user cierra el tour justo antes del debounce.
      for (const stepId of timers.keys()) {
        flush(stepId)
      }
      timers.forEach(t => clearTimeout(t))
      timers.clear()
    }
  }, [])
}
