import api from '@/api'

/**
 * Per-staff, per-venue onboarding UX state (tour banners, checklists,
 * welcome-tour auto-launch flags). Backed by `StaffOnboardingState` on the
 * server so progress persists across devices and supports analytics.
 *
 * Keys live under a flat namespace — e.g. `inventory-checklist`,
 * `tour-banner::inventory-welcome`. Payloads are arbitrary JSON (<= 8 KB).
 */

export type OnboardingStateMap = Record<string, unknown>

export const onboardingStateService = {
  /** Fetch all onboarding state for the authenticated staff at a venue. */
  getAll: async (venueId: string): Promise<OnboardingStateMap> => {
    const res = await api.get<{ success: boolean; data: OnboardingStateMap }>(
      `/api/v1/dashboard/venues/${venueId}/onboarding-state`,
    )
    return res.data?.data ?? {}
  },

  /** Upsert a single state key. */
  set: async <T = unknown>(venueId: string, key: string, state: T): Promise<void> => {
    await api.put(
      `/api/v1/dashboard/venues/${venueId}/onboarding-state/${encodeURIComponent(key)}`,
      { state },
    )
  },

  /** Clear a single state key. Idempotent. */
  clear: async (venueId: string, key: string): Promise<void> => {
    await api.delete(
      `/api/v1/dashboard/venues/${venueId}/onboarding-state/${encodeURIComponent(key)}`,
    )
  },
}
