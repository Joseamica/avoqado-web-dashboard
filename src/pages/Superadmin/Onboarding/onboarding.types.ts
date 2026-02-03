export interface OrganizationOption {
  id: string
  name: string
  slug: string
  email: string
  _count: { venues: number }
  hasPaymentConfig: boolean
}

export interface OrganizationData {
  mode: 'existing' | 'new'
  id?: string
  name?: string
  email?: string
  phone?: string
}

export interface VenueData {
  name: string
  slug?: string
  venueType: string
  timezone?: string
  currency?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  latitude?: number
  longitude?: number
  phone?: string
  email?: string
  website?: string
  entityType?: 'PERSONA_FISICA' | 'PERSONA_MORAL'
  rfc?: string
  legalName?: string
  zoneId?: string
}

export interface OrgPaymentConfigCreate {
  primaryAccountId: string
  secondaryAccountId?: string
  tertiaryAccountId?: string
  preferredProcessor?: string
}

export interface PricingData {
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  fixedFeePerTransaction?: number
  monthlyServiceFee?: number
  useOrgConfig?: boolean
  merchantAccountId?: string
  createOrgConfig?: OrgPaymentConfigCreate
}

export interface MerchantAccountOption {
  id: string
  displayName: string | null
  alias: string | null
  externalMerchantId: string
  provider: { name: string }
}

export interface OrgPaymentStatus {
  hasConfig: boolean
  config: {
    primaryAccountId: string
    primaryAccount?: { displayName: string | null; provider: { name: string } }
  } | null
  pricing: Array<{
    accountType: string
    debitRate: number
    creditRate: number
    amexRate: number
    internationalRate: number
  }>
}

export interface TerminalData {
  serialNumber: string
  brand: string
  model: string
  name?: string
  environment: 'SANDBOX' | 'PRODUCTION'
}

export interface SettlementData {
  debitDays: number
  creditDays: number
  amexDays: number
  internationalDays: number
  otherDays: number
  dayType: 'BUSINESS_DAYS' | 'CALENDAR_DAYS'
  cutoffTime: string
  cutoffTimezone: string
}

export interface StaffInvite {
  email: string
  firstName: string
  lastName: string
  role: string
}

export interface TeamData {
  owner: StaffInvite
  additionalStaff: StaffInvite[]
}

export interface ModuleSelection {
  code: string
  config?: Record<string, unknown>
  preset?: string
}

export interface WizardState {
  organization: OrganizationData
  venue: VenueData
  pricing: PricingData
  terminal: TerminalData | null
  settlement: SettlementData
  team: TeamData
  features: string[]
  modules: ModuleSelection[]
}

export interface StepResult {
  step: string
  status: 'success' | 'skipped' | 'error'
  message?: string
  data?: Record<string, unknown>
}

export interface WizardResponse {
  success: boolean
  venueId: string
  venueSlug: string
  organizationId: string
  steps: StepResult[]
}

export const DEFAULT_SETTLEMENT: SettlementData = {
  debitDays: 1,
  creditDays: 3,
  amexDays: 5,
  internationalDays: 5,
  otherDays: 3,
  dayType: 'BUSINESS_DAYS',
  cutoffTime: '23:00',
  cutoffTimezone: 'America/Mexico_City',
}

export const INITIAL_STATE: WizardState = {
  organization: { mode: 'existing' },
  venue: { name: '', venueType: 'RESTAURANT' },
  pricing: { debitRate: 2.5, creditRate: 3.0, amexRate: 3.5, internationalRate: 4.0 },
  terminal: null,
  settlement: { ...DEFAULT_SETTLEMENT },
  team: {
    owner: { email: '', firstName: '', lastName: '', role: 'OWNER' },
    additionalStaff: [],
  },
  features: [],
  modules: [],
}
