import { useEffect, useRef } from 'react'

/**
 * Cross-component "launch this section's atomic tour" mechanism.
 *
 * Two entry points converge here:
 *
 *   1. `InventorySetupChecklist` — clicks "Hacerlo" on a step. It sets the
 *      sessionStorage flag and navigates to the target page. The target
 *      page's atomic tour hook is not yet mounted, so we use a flag that
 *      survives the navigation.
 *
 *   2. `useInventoryWelcomeTour` orchestrator — user is already on the
 *      target page (the welcome tour navigated them there). Here we also
 *      dispatch a DOM event so the hook picks it up immediately without
 *      waiting for remount.
 *
 * Each atomic tour hook calls `useAtomicTourListener(name, start)` which:
 *   - On mount: checks sessionStorage and fires `start()` if the flag matches.
 *   - Subscribes to the shared event and fires `start()` while mounted.
 */

const STORAGE_KEY = 'avoqado-tour-autostart'
const EVENT_NAME = 'avoqado-tour-autostart-check'
const COMPLETED_EVENT = 'avoqado-tour-completed'
// Cola de completions pendientes. Se persiste en sessionStorage porque el
// listener (HomeSetupChecklist) puede no estar mounted cuando el atomic
// tour completa — ej.: el user clickee "Empezar" en Home → navega a
// /inventory/ingredients → completa el tour ahí → la Home ya no está
// renderizada y el window event se dispara al vacío. Al volver a Home,
// el listener drena esta cola y ejecuta el handler.
const PENDING_COMPLETIONS_KEY = 'avoqado-tour-completions-pending'

// Path al que regresar después de completar un atomic tour. Se setea
// cuando el HomeSetupChecklist lanza un tour ("Empezar") y se consume
// cuando el tour completa, navegando al usuario de vuelta a Home.
const RETURN_PATH_KEY = 'avoqado-atomic-tour-return-path'

export function setAtomicTourReturnPath(path: string): void {
  try {
    sessionStorage.setItem(RETURN_PATH_KEY, path)
  } catch {
    /* noop */
  }
}

export function consumeAtomicTourReturnPath(): string | null {
  try {
    const value = sessionStorage.getItem(RETURN_PATH_KEY)
    if (value) sessionStorage.removeItem(RETURN_PATH_KEY)
    return value
  } catch {
    return null
  }
}

/**
 * Module-level registry of atomic tour `start()` functions, keyed by name.
 * Each atomic tour hook registers itself on mount (and unregisters on
 * unmount) via `useAtomicTourListener`, so other surfaces (like the welcome
 * tour's "Hacerlo" button) can call `start()` directly when the target page
 * is already rendered — no event indirection, no timing issues.
 *
 * Falls back to the sessionStorage flag when the target hook isn't mounted
 * (e.g. the checklist navigates from Resumen → Categorías and the hook
 * mounts a moment later).
 */
const registry = new Map<AtomicTourName, () => void>()

export type AtomicTourName =
  | 'category'
  | 'ingredient'
  | 'product'
  | 'recipe'
  | 'purchase-order'
  | 'stock-adjustment'
  | 'history'
  | 'team-invitation'
  | 'tpv-onboarding'
  | 'reservations-onboarding'
  | 'reservation-settings-onboarding'

/**
 * Call from launcher code (checklist, welcome tour) to queue an atomic tour.
 * If the target page is already mounted, the listener fires immediately via
 * the DOM event. Otherwise the next mount of that page's tour hook will
 * pick the flag up and fire.
 */
export function requestAtomicTour(name: AtomicTourName): void {
  // Fast path: if the target atomic tour is already mounted on the current
  // page, call it directly. Avoids sessionStorage + event round-trip and
  // the StrictMode double-mount corner cases.
  const directStart = registry.get(name)
  if (directStart) {
    directStart()
    return
  }

  // Otherwise, fall through to the flag-and-navigate path so the next
  // mount of the atomic tour hook picks it up.
  try {
    sessionStorage.setItem(STORAGE_KEY, name)
  } catch {
    /* quota / private mode */
  }
  window.dispatchEvent(new Event(EVENT_NAME))
}

/**
 * Dispatched by each atomic tour when the user CLICKS THROUGH TO THE LAST
 * STEP (i.e. actually finished the walkthrough). Not dispatched if the user
 * closes the tour early via the X.
 *
 * The inventory welcome tour orchestrator listens for this event and marks
 * the matching checklist step as done. That way "Hacerlo" only counts when
 * the user has actually seen the whole tour — clicking Hacerlo and closing
 * immediately does NOT mark the step complete.
 */
export function notifyAtomicTourCompleted(name: AtomicTourName): void {
  // Persistimos primero en sessionStorage para que un listener que se
  // monte después (HomeSetupChecklist al regresar de /inventory) pueda
  // drenar la cola.
  try {
    const raw = sessionStorage.getItem(PENDING_COMPLETIONS_KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    if (Array.isArray(list)) {
      list.push(name)
      sessionStorage.setItem(PENDING_COMPLETIONS_KEY, JSON.stringify(list))
    }
  } catch {
    /* quota / private mode */
  }
  window.dispatchEvent(new CustomEvent(COMPLETED_EVENT, { detail: { name } }))
}

/**
 * Subscribe to "atomic tour completed" events. Mount once (e.g. in the
 * welcome tour orchestrator) to react when any atomic tour finishes.
 *
 * Al montar también drena cualquier completion pendiente en sessionStorage
 * — necesario porque el listener puede haber estado desmontado cuando el
 * tour completó en otra página.
 */
export function useAtomicTourCompletionListener(
  handler: (name: AtomicTourName) => void,
  options: { enabled?: boolean } = {},
): void {
  const { enabled = true } = options
  // Ref para que el cleanup del effect no dependa de la identidad del
  // handler (que típicamente es una función inline que cambia cada render).
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    // Esperamos a que el caller esté listo (típicamente: state cargado del
    // backend) antes de drenar. Si drenáramos antes de isLoaded, markDone()
    // operaría sobre un state DEFAULT y luego la respuesta del backend lo
    // sobrescribiría, perdiendo nuestra marca.
    if (!enabled) return

    // Drain la cola persistida — es donde aterrizan las completions hechas
    // mientras este listener no estaba montado.
    let pending: AtomicTourName[] = []
    try {
      const raw = sessionStorage.getItem(PENDING_COMPLETIONS_KEY)
      if (raw) {
        const list = JSON.parse(raw) as unknown
        if (Array.isArray(list)) pending = list as AtomicTourName[]
        sessionStorage.removeItem(PENDING_COMPLETIONS_KEY)
      }
    } catch {
      /* noop */
    }
    pending.forEach(name => handlerRef.current(name))

    const wrapped = (event: Event) => {
      const detail = (event as CustomEvent<{ name: AtomicTourName }>).detail
      if (!detail?.name) return
      // Si el listener YA está montado y procesa el event vivo, removemos
      // la entry correspondiente de sessionStorage para que no se vuelva
      // a procesar en el próximo mount.
      try {
        const raw = sessionStorage.getItem(PENDING_COMPLETIONS_KEY)
        if (raw) {
          const list = JSON.parse(raw) as unknown
          if (Array.isArray(list)) {
            const idx = list.indexOf(detail.name)
            if (idx >= 0) list.splice(idx, 1)
            if (list.length === 0) sessionStorage.removeItem(PENDING_COMPLETIONS_KEY)
            else sessionStorage.setItem(PENDING_COMPLETIONS_KEY, JSON.stringify(list))
          }
        }
      } catch {
        /* noop */
      }
      handlerRef.current(detail.name)
    }
    window.addEventListener(COMPLETED_EVENT, wrapped)
    return () => window.removeEventListener(COMPLETED_EVENT, wrapped)
  }, [enabled])
}

/**
 * Listener "peek": escucha eventos de atomic tour completed pero NO drena
 * la cola persistida ni elimina del sessionStorage. Útil para componentes
 * globales (ej.: el orquestador de "regresar a Home") que necesitan
 * reaccionar sin robarle el evento al listener canónico que sí drena.
 */
export function usePeekAtomicTourCompletion(handler: (name: AtomicTourName) => void): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const wrapped = (event: Event) => {
      const detail = (event as CustomEvent<{ name: AtomicTourName }>).detail
      if (detail?.name) handlerRef.current(detail.name)
    }
    window.addEventListener(COMPLETED_EVENT, wrapped)
    return () => window.removeEventListener(COMPLETED_EVENT, wrapped)
  }, [])
}

/**
 * Clears the autostart flag. Useful for the launcher to cancel a pending
 * request if the user navigates away before the atomic tour starts.
 */
export function clearPendingAtomicTour(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* noop */
  }
}

/**
 * Hook: mount in each atomic tour hook so it auto-starts when requested.
 *
 * @param name  the atomic tour's identifier (e.g. 'category')
 * @param start the `start()` function returned by the tour hook
 * @param delay ms delay before calling start, so the page has time to settle
 */
export function useAtomicTourListener(
  name: AtomicTourName,
  start: () => void,
  delay = 350,
): void {
  // Keep the latest `start` without invalidating the effect. Otherwise a
  // parent re-render would drop this hook's deps, run cleanup (which clears
  // the pending setTimeout), and — because the sessionStorage flag was
  // already consumed — the tour would never fire. This used to silently
  // swallow `requestAtomicTour` calls.
  const startRef = useRef(start)
  useEffect(() => {
    startRef.current = start
  }, [start])

  // Register this hook's start in the module-level registry so callers
  // (welcome tour's "Hacerlo" button) can invoke it directly.
  useEffect(() => {
    const direct = () => startRef.current()
    registry.set(name, direct)
    return () => {
      // Only delete if we still own the slot — another mount for the same
      // name (e.g. two pages mount hooks in sequence during navigation)
      // could have overwritten it.
      if (registry.get(name) === direct) registry.delete(name)
    }
  }, [name])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const fireIfMatching = () => {
      let pending: string | null = null
      try {
        pending = sessionStorage.getItem(STORAGE_KEY)
      } catch {
        return
      }
      if (pending !== name) return

      // DO NOT remove the flag here — we wait until the setTimeout actually
      // fires. Otherwise React 18 StrictMode's mount→unmount→mount cycle
      // would: (1) consume the flag on first mount, (2) cleanup cancels the
      // scheduled start, (3) second mount sees no flag → tour never runs.
      // A page navigation followed by mount has the same shape.

      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        // Consume flag now so subsequent mounts of sibling hooks (e.g. other
        // atomic tours listening for their own names) don't re-trigger.
        try {
          if (sessionStorage.getItem(STORAGE_KEY) === name) {
            sessionStorage.removeItem(STORAGE_KEY)
          }
        } catch {
          /* noop */
        }
        startRef.current()
      }, delay)
    }

    fireIfMatching()
    window.addEventListener(EVENT_NAME, fireIfMatching)

    return () => {
      window.removeEventListener(EVENT_NAME, fireIfMatching)
      if (timer) clearTimeout(timer)
    }
  }, [name, delay])
}
