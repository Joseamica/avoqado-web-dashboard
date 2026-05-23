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

const KEY_PREFIX = 'merchant-setup-draft:'

/** Returns true when the draft has user-meaningful content (anything beyond
 *  the bare defaults that `initialState()` would produce). Used to avoid
 *  showing a recovery banner for a draft that's just an empty shell.
 *
 *  Heuristic: a slice is "touched" only when it carries user input. For
 *  cost/pricing/settlement we look at the rate values (not `skipped`) since
 *  fresh defaults already set `skipped:false` for sane onboarding. */
export function isDraftNonEmpty(state: SetupState): boolean {
  if (state.venue.id) return true
  if (state.login.mode !== 'empty') return true
  if (state.merchant.mode !== 'empty') return true
  if (state.slot.mode !== 'empty') return true
  if (
    state.cost.debitRate !== undefined ||
    state.cost.creditRate !== undefined ||
    state.cost.amexRate !== undefined ||
    state.cost.internationalRate !== undefined
  ) return true
  if (
    state.pricing.debitRate !== undefined ||
    state.pricing.creditRate !== undefined ||
    state.pricing.amexRate !== undefined ||
    state.pricing.internationalRate !== undefined
  ) return true
  if (!state.revenueShare.skipped) return true
  if ((state.terminals.terminalIds?.length ?? 0) > 0) return true
  return false
}

/** Enumerate every key currently in localStorage. Works with the standard
 *  Web Storage API (`length` + `key(i)`) and falls back to `Object.keys`
 *  for test shims that only proxy get/set/remove on the prototype. */
function enumerateKeys(): string[] {
  try {
    const out: string[] = []
    const len = (localStorage as Storage).length
    if (typeof len === 'number' && len > 0) {
      for (let i = 0; i < len; i++) {
        const k = localStorage.key(i)
        if (k) out.push(k)
      }
      return out
    }
  } catch {
    /* fall through to Object.keys */
  }
  try {
    return Object.keys(localStorage as unknown as Record<string, string>)
  } catch {
    return []
  }
}

/** Scans localStorage for the most recent merchant-setup draft and returns
 *  it (along with its storage key so the caller can clear it later). Returns
 *  null if nothing usable is present. Drafts with stale schema versions or
 *  obviously empty content are ignored. */
export function findActiveDraft(): { key: string; state: SetupState } | null {
  try {
    for (const k of enumerateKeys()) {
      if (!k.startsWith(KEY_PREFIX)) continue
      const raw = localStorage.getItem(k)
      if (!raw) continue
      let parsed: Partial<SetupState>
      try {
        parsed = JSON.parse(raw)
      } catch {
        continue
      }
      if (parsed.schemaVersion !== DRAFT_SCHEMA_VERSION) continue
      const state = parsed as SetupState
      if (!isDraftNonEmpty(state)) continue
      // First non-empty hit wins. (We don't store timestamps, so order is
      // implementation-defined; that's acceptable — usually there's one.)
      return { key: k, state }
    }
    return null
  } catch {
    return null
  }
}
