export interface SetupData {
  // Step 2: Business Info
  businessName?: string
  address?: string
  city?: string
  state?: string
  country?: string
  zipCode?: string
  latitude?: number
  longitude?: number
  noPhysicalAddress?: boolean
  // Step 3: Business Type
  businessType?: string
  businessCategory?: string
  // Step 4: Entity Type
  entityType?: string
  entitySubType?: string
  commercialName?: string
  phone?: string
  // Step 5: Identity
  legalFirstName?: string
  legalLastName?: string
  personalPhone?: string
  birthdate?: string
  rfc?: string
  curp?: string
  legalAddress?: string
  legalCity?: string
  legalState?: string
  legalCountry?: string
  legalZipCode?: string
  // Step 6: Terms
  termsAccepted?: boolean
  privacyAccepted?: boolean
  // Step 7: Bank Account
  clabe?: string
  bankName?: string
  accountHolder?: string
  accountType?: string
}

export interface StepProps {
  data: SetupData
  onNext: (stepData: Partial<SetupData>) => void
  onBack?: () => void
}
