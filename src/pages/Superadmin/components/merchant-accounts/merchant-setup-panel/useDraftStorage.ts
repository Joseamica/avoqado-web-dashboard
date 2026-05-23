import { useEffect, useRef } from 'react'
import type { SetupState } from './types'
import { DRAFT_SCHEMA_VERSION } from './types'

/** Storage key shape: `merchant-setup-draft:{venueId}:{userAccountId}`.
 *  Nulls become sentinels so we still have a stable key during create-from-zero.
 */
export function draftKey(venueId: string | null, userAccountId: string | null): string {
  return `merchant-setup-draft:${venueId ?? 'no-venue'}:${userAccountId ?? 'new-login'}`
}

export function saveDraft(venueId: string | null, userAccountId: string | null, state: SetupState): void {
  try {
    localStorage.setItem(draftKey(venueId, userAccountId), JSON.stringify(state))
  } catch {
    /* localStorage unavailable (private mode, quota) — silently no-op */
  }
}

export function loadDraft(venueId: string | null, userAccountId: string | null): SetupState | null {
  try {
    const raw = localStorage.getItem(draftKey(venueId, userAccountId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SetupState>
    if (parsed.schemaVersion !== DRAFT_SCHEMA_VERSION) return null
    return parsed as SetupState
  } catch {
    return null
  }
}

export function clearDraft(venueId: string | null, userAccountId: string | null): void {
  try {
    localStorage.removeItem(draftKey(venueId, userAccountId))
  } catch {
    /* no-op */
  }
}

/** Hook that auto-saves `state` to localStorage with a 500ms debounce.
 *  The caller is responsible for clearing the draft on successful activation. */
export function useDraftAutosave(
  venueId: string | null,
  userAccountId: string | null,
  state: SetupState,
  enabled: boolean,
): void {
  const timeoutRef = useRef<number | null>(null)
  useEffect(() => {
    if (!enabled) return
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => saveDraft(venueId, userAccountId, state), 500)
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    }
  }, [venueId, userAccountId, state, enabled])
}
