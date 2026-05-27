import type { CommissionCalcType, CommissionRecipient } from '@/types/commission'

export type TierPeriod = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'
export type StaffAssignmentMode = 'all' | 'selected'

export interface TierItem {
  level: number
  name: string
  minThreshold: number
  maxThreshold: number | null
  rate: number
}

export interface StaffOverride {
  staffId: string
  staffName: string
  customRate: number | null
  excluded: boolean
}

// ─── Per-card slices ────────────────────────────────────────────

export interface RateSlice {
  calcType: CommissionCalcType
  defaultRate: number
  fixedAmount: number
  recipient: CommissionRecipient
}

export interface StaffSlice {
  mode: StaffAssignmentMode
  overrides: StaffOverride[]
}

export interface NameSlice {
  value: string
  effectiveFrom: string | null
  effectiveTo: string | null
  priority: number
}

export interface CalculationBaseSlice {
  includeTax: boolean
  includeTips: boolean
  includeDiscount: boolean
}

export interface CategoriesSlice {
  filterEnabled: boolean
  categoryIds: string[]
}

export interface PeriodSlice {
  aggregationPeriod: TierPeriod
}

export interface TiersSlice {
  enabled: boolean
  tierPeriod: TierPeriod
  items: TierItem[]
}

export interface RoleRatesSlice {
  enabled: boolean
  rates: Record<string, number>
}

export interface LimitsSlice {
  enabled: boolean
  minAmount: number | null
  maxAmount: number | null
}

// ─── Aggregate state ────────────────────────────────────────────

export interface CommissionSetupState {
  rate: RateSlice
  staff: StaffSlice
  name: NameSlice
  calculationBase: CalculationBaseSlice
  categories: CategoriesSlice
  period: PeriodSlice
  tiers: TiersSlice
  roleRates: RoleRatesSlice
  limits: LimitsSlice
}

// ─── Card validation ────────────────────────────────────────────

export type CardKey =
  | 'rate'
  | 'staff'
  | 'name'
  | 'calculationBase'
  | 'categories'
  | 'period'
  | 'tiers'
  | 'roleRates'
  | 'limits'

export const REQUIRED_CARDS: CardKey[] = ['rate', 'name']

export const OPTIONAL_WITH_DEFAULTS: CardKey[] = [
  'calculationBase',
  'period',
  'staff',
]

export const ADVANCED_CARDS: CardKey[] = ['categories', 'tiers', 'roleRates', 'limits']
