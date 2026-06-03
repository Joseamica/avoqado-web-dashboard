import type {
  CommissionSetupState,
  CardKey,
  RateSlice,
  StaffSlice,
  NameSlice,
  CalculationBaseSlice,
  CategoriesSlice,
  PeriodSlice,
  TiersSlice,
  RoleRatesSlice,
  LimitsSlice,
} from './types'

// ─── Actions ────────────────────────────────────────────────────

export type SetupAction =
  | { type: 'SET_RATE'; data: Partial<RateSlice> }
  | { type: 'SET_STAFF'; data: Partial<StaffSlice> }
  | { type: 'SET_NAME'; data: Partial<NameSlice> }
  | { type: 'SET_CALCULATION_BASE'; data: Partial<CalculationBaseSlice> }
  | { type: 'SET_CATEGORIES'; data: Partial<CategoriesSlice> }
  | { type: 'SET_PERIOD'; data: Partial<PeriodSlice> }
  | { type: 'SET_TIERS'; data: Partial<TiersSlice> }
  | { type: 'SET_ROLE_RATES'; data: Partial<RoleRatesSlice> }
  | { type: 'SET_LIMITS'; data: Partial<LimitsSlice> }
  | { type: 'RESET' }

// ─── Initial state ──────────────────────────────────────────────

export function initialState(): CommissionSetupState {
  return {
    rate: {
      calcType: 'PERCENTAGE',
      defaultRate: 0.03,
      fixedAmount: 50,
      recipient: 'SERVER',
    },
    staff: {
      mode: 'all',
      overrides: [],
    },
    name: {
      value: '',
      effectiveFrom: null,
      effectiveTo: null,
      priority: 1,
    },
    calculationBase: {
      includeTax: false,
      includeTips: false,
      includeDiscount: false,
    },
    categories: {
      filterEnabled: false,
      categoryIds: [],
    },
    period: {
      aggregationPeriod: 'MONTHLY',
    },
    tiers: {
      enabled: false,
      tierPeriod: 'MONTHLY',
      items: [
        { level: 1, name: 'Bronce', minThreshold: 0, maxThreshold: 10000, minThresholdType: 'FIXED', maxThresholdType: 'FIXED', rate: 0.02 },
        { level: 2, name: 'Plata', minThreshold: 10000, maxThreshold: 25000, minThresholdType: 'FIXED', maxThresholdType: 'FIXED', rate: 0.03 },
        { level: 3, name: 'Oro', minThreshold: 25000, maxThreshold: null, minThresholdType: 'FIXED', maxThresholdType: 'FIXED', rate: 0.04 },
      ],
    },
    roleRates: {
      enabled: false,
      rates: {},
    },
    limits: {
      enabled: false,
      minAmount: null,
      maxAmount: null,
    },
  }
}

// ─── Reducer ────────────────────────────────────────────────────

export function setupReducer(
  state: CommissionSetupState,
  action: SetupAction,
): CommissionSetupState {
  switch (action.type) {
    case 'SET_RATE':
      return { ...state, rate: { ...state.rate, ...action.data } }
    case 'SET_STAFF':
      return { ...state, staff: { ...state.staff, ...action.data } }
    case 'SET_NAME':
      return { ...state, name: { ...state.name, ...action.data } }
    case 'SET_CALCULATION_BASE':
      return { ...state, calculationBase: { ...state.calculationBase, ...action.data } }
    case 'SET_CATEGORIES':
      return { ...state, categories: { ...state.categories, ...action.data } }
    case 'SET_PERIOD':
      return { ...state, period: { ...state.period, ...action.data } }
    case 'SET_TIERS': {
      const next = { ...state.tiers, ...action.data }
      if (next.enabled && state.roleRates.enabled) {
        return { ...state, tiers: next, roleRates: { ...state.roleRates, enabled: false } }
      }
      return { ...state, tiers: next }
    }
    case 'SET_ROLE_RATES': {
      const next = { ...state.roleRates, ...action.data }
      if (next.enabled && state.tiers.enabled) {
        return { ...state, roleRates: next, tiers: { ...state.tiers, enabled: false } }
      }
      return { ...state, roleRates: next }
    }
    case 'SET_LIMITS':
      return { ...state, limits: { ...state.limits, ...action.data } }
    case 'RESET':
      return initialState()
    default:
      return state
  }
}

// ─── Validation helpers ─────────────────────────────────────────

export function isCardValid(state: CommissionSetupState, card: CardKey): boolean {
  switch (card) {
    case 'rate':
      return state.rate.calcType === 'PERCENTAGE'
        ? state.rate.defaultRate > 0
        : state.rate.fixedAmount > 0
    case 'name':
      return state.name.value.trim().length > 0
    case 'staff':
      if (state.staff.mode === 'selected') {
        return state.staff.overrides.some(o => !o.excluded)
      }
      return true
    case 'calculationBase':
      return true
    case 'categories':
      return !state.categories.filterEnabled || state.categories.categoryIds.length > 0
    case 'period':
      return true
    case 'tiers':
      return !state.tiers.enabled || state.tiers.items.length > 0
    case 'roleRates':
      return !state.roleRates.enabled || Object.keys(state.roleRates.rates).length > 0
    case 'limits':
      return true
  }
}

export function isRequiredComplete(state: CommissionSetupState): boolean {
  const required: CardKey[] = ['rate', 'name']
  return required.every(k => isCardValid(state, k))
}

/** True when the user has actively changed this card from its default. */
export function isCardTouched(state: CommissionSetupState, card: CardKey): boolean {
  const init = initialState()
  switch (card) {
    case 'rate':
      return (
        state.rate.calcType !== init.rate.calcType ||
        state.rate.defaultRate !== init.rate.defaultRate ||
        state.rate.fixedAmount !== init.rate.fixedAmount ||
        state.rate.recipient !== init.rate.recipient
      )
    case 'name':
      return state.name.value.trim().length > 0
    case 'staff':
      return state.staff.mode !== init.staff.mode || state.staff.overrides.length > 0
    case 'calculationBase':
      return (
        state.calculationBase.includeTax !== init.calculationBase.includeTax ||
        state.calculationBase.includeTips !== init.calculationBase.includeTips ||
        state.calculationBase.includeDiscount !== init.calculationBase.includeDiscount
      )
    case 'categories':
      return state.categories.filterEnabled !== init.categories.filterEnabled
    case 'period':
      return state.period.aggregationPeriod !== init.period.aggregationPeriod
    case 'tiers':
      return state.tiers.enabled !== init.tiers.enabled
    case 'roleRates':
      return state.roleRates.enabled !== init.roleRates.enabled
    case 'limits':
      return state.limits.enabled !== init.limits.enabled
  }
}
