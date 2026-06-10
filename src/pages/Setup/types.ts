export interface SetupData {
  // Step 2: Business Info
  businessName?: string
  /**
   * Business contact email. Pre-populated from the signup `Staff.email` but
   * editable so the operator can route notifications to a shared mailbox
   * (e.g. `gerencia@negocio.com`) instead of their personal one. Persisted
   * to `Venue.email` on completion.
   */
  email?: string
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
  // Step 8: Payment Providers (optional)
  paymentProviders?: {
    mpMerchantId?: string | null
    stripeMerchantId?: string | null
    skipped?: boolean
  }
  // Step: Plan (base subscription)
  plan?: {
    /**
     * Selected tier. FREE completes without a card; PRO/PREMIUM require a
     * paymentMethodId. ENTERPRISE is contact-sales only and never persisted.
     * Absent on payloads saved before the 4-tier step — backend defaults to PRO.
     */
    tier?: 'FREE' | 'PRO' | 'PREMIUM'
    paymentMethodId?: string
    interval?: 'monthly' | 'annual'
    payNow?: boolean
    acceptedAt?: string
  }
  // Step 9: TPV Purchase (optional)
  // Spec: ../../../avoqado-server/docs/superpowers/specs/2026-05-29-onboarding-tpv-purchase-design.md
  tpvPurchase?: {
    tpvOrderId?: string | null
    skipped?: boolean
    lastUpdatedAt?: string
  }
}

export interface StepProps {
  data: SetupData
  onNext: (stepData: Partial<SetupData>) => void
  onBack?: () => void
}
