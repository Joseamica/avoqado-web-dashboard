import api from '@/api'

// Server contract — see avoqado-server: src/services/venueChatAdmin.service.ts
export interface VenueChatStatus {
  mode: 'RELAY' | 'WA_ME_FALLBACK' | 'DISABLED'
  optInPhone: string | null
  optInAt: string | null
  fallbackPhone: string | null
  pendingActivation: { tokenLast4: string; expiresAt: string } | null
}

export interface ActivationGenerationResult {
  token: string
  expiresAt: string
  last4: string
}

// GET /dashboard/venues/:venueId/chat/status — requires `venues:read`.
// Polled by the activation panel every 5s while open so the UI flips from
// WA_ME_FALLBACK → RELAY the moment the venue sends ACTIVAR.
export async function getVenueChatStatus(venueId: string): Promise<VenueChatStatus> {
  const { data } = await api.get<VenueChatStatus>(`/api/v1/dashboard/venues/${venueId}/chat/status`)
  return data
}

// POST /dashboard/venues/:venueId/chat/activation — requires `venues:manage`.
// Returns the RAW activation token exactly once; the server only stores its
// hash + last4. Any pending token for this venue is invalidated server-side.
export async function generateActivation(venueId: string): Promise<ActivationGenerationResult> {
  const { data } = await api.post<ActivationGenerationResult>(`/api/v1/dashboard/venues/${venueId}/chat/activation`)
  return data
}

// POST /dashboard/venues/:venueId/chat/deactivate — requires `venues:manage`.
// Reverts the venue to WA_ME_FALLBACK, closes OPEN sessions, invalidates any
// open activation tokens. 204 on success.
export async function deactivateVenueChat(venueId: string): Promise<void> {
  await api.post(`/api/v1/dashboard/venues/${venueId}/chat/deactivate`)
}
