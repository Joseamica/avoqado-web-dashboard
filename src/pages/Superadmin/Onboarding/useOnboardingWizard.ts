import { useReducer, useCallback, useEffect } from 'react'
import type {
  WizardState,
  OrganizationData,
  VenueData,
  PricingData,
  TerminalData,
  SettlementData,
  TeamData,
  ModuleSelection,
} from './onboarding.types'
import { INITIAL_STATE } from './onboarding.types'

const STORAGE_KEY = 'onboarding-wizard-state'
const STEP_STORAGE_KEY = 'onboarding-wizard-step'

function loadState(): WizardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return { ...INITIAL_STATE }
}

function saveState(state: WizardState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

export function loadStep(): number {
  try {
    const raw = localStorage.getItem(STEP_STORAGE_KEY)
    if (raw) return parseInt(raw, 10) || 0
  } catch {
    // ignore
  }
  return 0
}

export function saveStep(step: number) {
  try {
    localStorage.setItem(STEP_STORAGE_KEY, String(step))
  } catch {
    // ignore
  }
}

export function clearWizardStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STEP_STORAGE_KEY)
  } catch {
    // ignore
  }
}

type Action =
  | { type: 'SET_ORGANIZATION'; payload: Partial<OrganizationData> }
  | { type: 'SET_VENUE'; payload: Partial<VenueData> }
  | { type: 'SET_PRICING'; payload: Partial<PricingData> }
  | { type: 'SET_TERMINAL'; payload: TerminalData | null }
  | { type: 'SET_SETTLEMENT'; payload: Partial<SettlementData> }
  | { type: 'SET_TEAM'; payload: Partial<TeamData> }
  | { type: 'SET_FEATURES'; payload: string[] }
  | { type: 'SET_MODULES'; payload: ModuleSelection[] }
  | { type: 'RESET' }

function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case 'SET_ORGANIZATION':
      return { ...state, organization: { ...state.organization, ...action.payload } }
    case 'SET_VENUE':
      return { ...state, venue: { ...state.venue, ...action.payload } }
    case 'SET_PRICING':
      return { ...state, pricing: { ...state.pricing, ...action.payload } }
    case 'SET_TERMINAL':
      return { ...state, terminal: action.payload }
    case 'SET_SETTLEMENT':
      return { ...state, settlement: { ...state.settlement, ...action.payload } }
    case 'SET_TEAM':
      return { ...state, team: { ...state.team, ...action.payload } }
    case 'SET_FEATURES':
      return { ...state, features: action.payload }
    case 'SET_MODULES':
      return { ...state, modules: action.payload }
    case 'RESET':
      return { ...INITIAL_STATE }
    default:
      return state
  }
}

export function useOnboardingWizard() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  // Persist state to localStorage on every change
  useEffect(() => {
    saveState(state)
  }, [state])

  const setOrganization = useCallback((data: Partial<OrganizationData>) => {
    dispatch({ type: 'SET_ORGANIZATION', payload: data })
  }, [])

  const setVenue = useCallback((data: Partial<VenueData>) => {
    dispatch({ type: 'SET_VENUE', payload: data })
  }, [])

  const setPricing = useCallback((data: Partial<PricingData>) => {
    dispatch({ type: 'SET_PRICING', payload: data })
  }, [])

  const setTerminal = useCallback((data: TerminalData | null) => {
    dispatch({ type: 'SET_TERMINAL', payload: data })
  }, [])

  const setSettlement = useCallback((data: Partial<SettlementData>) => {
    dispatch({ type: 'SET_SETTLEMENT', payload: data })
  }, [])

  const setTeam = useCallback((data: Partial<TeamData>) => {
    dispatch({ type: 'SET_TEAM', payload: data })
  }, [])

  const setFeatures = useCallback((data: string[]) => {
    dispatch({ type: 'SET_FEATURES', payload: data })
  }, [])

  const setModules = useCallback((data: ModuleSelection[]) => {
    dispatch({ type: 'SET_MODULES', payload: data })
  }, [])

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
    clearWizardStorage()
  }, [])

  return {
    state,
    setOrganization,
    setVenue,
    setPricing,
    setTerminal,
    setSettlement,
    setTeam,
    setFeatures,
    setModules,
    reset,
  }
}
