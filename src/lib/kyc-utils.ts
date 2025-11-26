/**
 * KYC (Know Your Customer) Utility Functions
 *
 * These utilities determine if a venue can access operational features
 * (Orders, Payments, TPV, Shifts, Analytics, Inventory) based on their KYC verification status.
 *
 * RULES:
 * - Demo venues: Always have full access (bypass KYC)
 * - Verified venues: Full access to all operational features
 * - NOT_SUBMITTED: Blocked - needs to upload KYC documents
 * - Pending/In Review: Blocked from operational features
 * - Rejected: Blocked from operational features
 */

import type { SessionVenue, Venue } from '@/types'

/**
 * Check if a venue can access operational features based on KYC status
 *
 * @param venue - The venue to check (SessionVenue or Venue)
 * @returns true if venue has access, false otherwise
 *
 * @example
 * ```typescript
 * const { activeVenue } = useAuth()
 *
 * if (!canAccessOperationalFeatures(activeVenue)) {
 *   return <KYCSetupRequired />
 * }
 *
 * return <OrdersPage />
 * ```
 */
export function canAccessOperationalFeatures(venue: SessionVenue | Venue | null): boolean {
  if (!venue) return false

  // Demo venues bypass KYC checks (can use all features for testing)
  if (venue.isOnboardingDemo) return true

  // Verified venues have full access to operational features
  if (venue.kycStatus === 'VERIFIED') return true

  // All other statuses are blocked:
  // - NOT_SUBMITTED: Documents not yet uploaded
  // - PENDING_REVIEW: KYC submitted, awaiting review
  // - IN_REVIEW: Currently being reviewed by superadmin
  // - REJECTED: KYC rejected, needs resubmission
  return false
}

/**
 * Get a user-friendly reason why operational features are blocked
 *
 * @param venue - The venue to check
 * @returns A human-readable reason string, or null if access is allowed
 *
 * @example
 * ```typescript
 * const reason = getKYCBlockReason(activeVenue)
 * if (reason) {
 *   console.log(reason) // "KYC verification pending"
 * }
 * ```
 */
export function getKYCBlockReason(venue: SessionVenue | Venue | null): string | null {
  if (!venue) return 'No venue selected'

  if (venue.isOnboardingDemo) return null // Demo venues not blocked
  if (venue.kycStatus === 'VERIFIED') return null // Verified venues not blocked

  switch (venue.kycStatus) {
    case 'NOT_SUBMITTED':
      return 'KYC verification not submitted'
    case 'PENDING_REVIEW':
      return 'KYC verification pending review'
    case 'IN_REVIEW':
      return 'KYC verification in progress'
    case 'REJECTED':
      return 'KYC verification rejected'
    default:
      return 'KYC verification required'
  }
}

/**
 * Check if a venue should show a KYC status banner
 *
 * @param venue - The venue to check
 * @returns true if a banner should be shown, false otherwise
 *
 * @example
 * ```typescript
 * {shouldShowKYCBanner(activeVenue) && <KYCStatusBanner />}
 * ```
 */
export function shouldShowKYCBanner(venue: SessionVenue | Venue | null): boolean {
  if (!venue) return false
  if (venue.isOnboardingDemo) return false // Don't show banner for demo venues

  // Show banner for all non-verified statuses
  return venue.kycStatus !== 'VERIFIED'
}

/**
 * Get the appropriate KYC banner variant based on venue status
 *
 * @param venue - The venue to check
 * @returns 'missing' | 'pending' | 'rejected' | null
 */
export function getKYCBannerVariant(venue: SessionVenue | Venue | null): 'missing' | 'pending' | 'rejected' | null {
  if (!venue) return null
  if (venue.isOnboardingDemo) return null
  if (venue.kycStatus === 'VERIFIED') return null

  switch (venue.kycStatus) {
    case 'PENDING_REVIEW':
    case 'IN_REVIEW':
      return 'pending'
    case 'REJECTED':
      return 'rejected'
    case 'NOT_SUBMITTED':
    default:
      return 'missing'
  }
}
