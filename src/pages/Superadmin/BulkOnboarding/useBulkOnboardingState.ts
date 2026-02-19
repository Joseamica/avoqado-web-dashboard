import { useReducer, useEffect, useCallback, useRef, useState } from 'react'
import type { BulkOnboardingState, BulkOnboardingAction, BulkVenueEntry, PricingConfig, SettlementConfig } from './types'

const STORAGE_KEY = 'avoqado-bulk-onboarding-draft'

export const INITIAL_DEFAULTS: BulkOnboardingState['defaults'] = {
  venueType: 'RESTAURANT',
  timezone: 'America/Mexico_City',
  currency: 'MXN',
  country: 'MX',
  entityType: '',
}

// Rates stored as percentages (2.5 = 2.5%) — converted to decimals only in buildPayload()
export const INITIAL_PRICING: PricingConfig = {
  debitRate: 2.5,
  creditRate: 3.5,
  amexRate: 4.0,
  internationalRate: 4.5,
}

export const INITIAL_SETTLEMENT: SettlementConfig = {
  debitDays: 1,
  creditDays: 3,
  amexDays: 5,
  internationalDays: 7,
  otherDays: 3,
  dayType: 'BUSINESS_DAYS',
  cutoffTime: '23:00',
  cutoffTimezone: 'America/Mexico_City',
}

const INITIAL_STATE: BulkOnboardingState = {
  currentStep: 0,
  organizationId: '',
  defaults: INITIAL_DEFAULTS,
  pricing: INITIAL_PRICING,
  merchantAccountId: '',
  settlement: INITIAL_SETTLEMENT,
  venues: [],
}

function reducer(state: BulkOnboardingState, action: BulkOnboardingAction): BulkOnboardingState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.step }

    case 'SET_ORG':
      return { ...state, organizationId: action.organizationId }

    case 'SET_DEFAULTS':
      return { ...state, defaults: { ...state.defaults, ...action.defaults } }

    case 'SET_PRICING':
      return { ...state, pricing: { ...state.pricing, ...action.pricing } }

    case 'SET_MERCHANT':
      return { ...state, merchantAccountId: action.merchantAccountId }

    case 'SET_SETTLEMENT':
      return { ...state, settlement: { ...state.settlement, ...action.settlement } }

    case 'ADD_VENUE':
      return { ...state, venues: [...state.venues, action.venue] }

    case 'ADD_VENUES_BATCH':
      return { ...state, venues: [...state.venues, ...action.venues] }

    case 'UPDATE_VENUE':
      return {
        ...state,
        venues: state.venues.map(v => (v.clientId === action.clientId ? { ...v, ...action.updates } : v)),
      }

    case 'REMOVE_VENUE':
      return { ...state, venues: state.venues.filter(v => v.clientId !== action.clientId) }

    case 'DUPLICATE_VENUE': {
      const source = state.venues.find(v => v.clientId === action.clientId)
      if (!source) return state
      const clone: BulkVenueEntry = {
        ...source,
        clientId: crypto.randomUUID(),
        name: `${source.name} (copia)`,
        address: undefined,
        city: undefined,
        state: undefined,
        zipCode: undefined,
        latitude: undefined,
        longitude: undefined,
        terminals: source.terminals.map(t => ({
          ...t,
          clientId: crypto.randomUUID(),
          serialNumber: '',
          name: '',
        })),
      }
      const idx = state.venues.findIndex(v => v.clientId === action.clientId)
      const newVenues = [...state.venues]
      newVenues.splice(idx + 1, 0, clone)
      return { ...state, venues: newVenues }
    }

    case 'RESET':
      return INITIAL_STATE

    case 'LOAD_DRAFT':
      return action.state

    default:
      return state
  }
}

const RATE_KEYS = ['debitRate', 'creditRate', 'amexRate', 'internationalRate'] as const

/** Migrate old decimal rates (0.025) to percentage format (2.5) */
function migrateDecimalRates(parsed: BulkOnboardingState): void {
  if (parsed.pricing && parsed.pricing.debitRate < 1) {
    for (const key of RATE_KEYS) {
      if (typeof parsed.pricing[key] === 'number') parsed.pricing[key] *= 100
    }
  }
  for (const venue of parsed.venues || []) {
    if (venue.pricingOverride) {
      for (const key of RATE_KEYS) {
        if (typeof venue.pricingOverride[key] === 'number' && venue.pricingOverride[key] < 1) {
          venue.pricingOverride[key] *= 100
        }
      }
    }
  }
}

function loadDraft(): BulkOnboardingState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BulkOnboardingState
    // Basic shape validation
    if (parsed.venues && Array.isArray(parsed.venues) && typeof parsed.currentStep === 'number') {
      migrateDecimalRates(parsed)
      return parsed
    }
    return null
  } catch {
    return null
  }
}

function saveDraft(state: BulkOnboardingState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or blocked — ignore
  }
}

export function clearDraft() {
  localStorage.removeItem(STORAGE_KEY)
}

export function useBulkOnboardingState() {
  const draft = useRef(loadDraft())
  const [state, dispatch] = useReducer(reducer, draft.current || INITIAL_STATE)
  const [hasDraft, setHasDraft] = useState(!!draft.current)

  // Persist on every state change (debounced via effect)
  useEffect(() => {
    saveDraft(state)
  }, [state])

  const reset = useCallback(() => {
    clearDraft()
    dispatch({ type: 'RESET' })
  }, [])

  const loadSavedDraft = useCallback(() => {
    const saved = draft.current
    if (saved) {
      dispatch({ type: 'LOAD_DRAFT', state: saved })
    }
    setHasDraft(false)
  }, [])

  const dismissDraft = useCallback(() => {
    setHasDraft(false)
    clearDraft()
  }, [])

  return {
    state,
    dispatch,
    reset,
    hasDraft,
    loadSavedDraft,
    dismissDraft,
  }
}
