/**
 * AngelPay user account API client (Task 15 — Phase 2 dashboard).
 *
 * Typed wrapper for the 6 superadmin endpoints exposing per-venue AngelPay
 * SDK 1.0.5+ credentials. Backend controller:
 *   avoqado-server/src/controllers/superadmin/angelpayUserAccount.controller.ts
 *
 * Naming convention matches the rest of src/services/superadmin-*.service.ts
 * (kebab-case filename, `import api from '@/api'` HTTP wrapper).
 *
 * Endpoints (all require SUPERADMIN role, enforced backend-side):
 *   GET    /api/v1/superadmin/venues/:venueId/angelpay-account
 *   POST   /api/v1/superadmin/venues/:venueId/angelpay-account
 *   PATCH  /api/v1/superadmin/angelpay-accounts/:id/pin
 *   PATCH  /api/v1/superadmin/angelpay-accounts/:id/status
 *   DELETE /api/v1/superadmin/angelpay-accounts/:id
 *
 * The server strips `pinEncrypted` from every response — the dashboard never
 * sees the ciphertext, and PIN is set/rotated through dedicated endpoints.
 *
 * Spec ref: §4.5, §18.2.
 */

import api from '@/api'

export type AngelPayEnvironment = 'QA' | 'PROD'

export type AngelPayAccountStatus =
  | 'PENDING_PIN'
  | 'ACTIVE'
  | 'PIN_ROTATION_REQUIRED'
  | 'SUSPENDED'
  | 'DELETED'

/**
 * Sanitized AngelPay user account as returned by the backend.
 *
 * `pinEncrypted` is intentionally NOT in this interface — the server strips
 * it before responding. If you need to set/rotate the PIN, call `setPin()`.
 */
export interface AngelPayUserAccount {
  id: string
  venueId: string
  email: string
  environment: AngelPayEnvironment
  status: AngelPayAccountStatus
  externalUserId: number | null
  statusReason: string | null
  statusChangedAt: string | null
  statusChangedBy: string | null
  lastValidatedAt: string | null
  lastValidationErr: string | null
  createdAt: string
  updatedAt: string
  createdBy: string | null
}

export interface CreateAngelPayUserAccountRequest {
  email: string
  /** Optional — when omitted, status starts at PENDING_PIN and ops sets the PIN later via `setPin()`. */
  pin?: string
  environment: AngelPayEnvironment
}

/** Statuses an operator can set via PATCH /status. ACTIVE is reached only by `setPin()`. */
export type AngelPayStatusTransition = 'PIN_ROTATION_REQUIRED' | 'SUSPENDED'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

/**
 * Get the AngelPay account for a venue. Returns null if the venue has not
 * been provisioned yet — the dashboard renders a "Create AngelPay account"
 * CTA in that case.
 */
export async function getAngelPayUserAccountForVenue(venueId: string): Promise<AngelPayUserAccount | null> {
  const { data } = await api.get<ApiEnvelope<AngelPayUserAccount | null>>(
    `/api/v1/superadmin/venues/${venueId}/angelpay-account`,
  )
  return data.data
}

/**
 * Multi-AngelPay accounts per venue (2026-05-18). Returns the FULL list of
 * AngelPayUserAccount rows registered for the venue, oldest-first. Always
 * returns an array — empty when the venue has not been provisioned yet.
 *
 * Use this in the AngelPay onboarding wizard so the operator can see and
 * manage every account. The legacy singular `getAngelPayUserAccountForVenue`
 * is preserved for backward-compat callers that still assume "one account
 * per venue".
 */
export async function listAngelPayUserAccountsForVenue(venueId: string): Promise<AngelPayUserAccount[]> {
  const { data } = await api.get<ApiEnvelope<AngelPayUserAccount[]>>(
    `/api/v1/superadmin/venues/${venueId}/angelpay-accounts`,
  )
  return data.data
}

export interface FetchAngelPayMerchantsRequest {
  venueId: string
  /**
   * Optional — restricts the dispatch to a specific terminal. When omitted,
   * the backend targets the first ACTIVE NEXGO terminal in the venue.
   */
  terminalId?: string
  /**
   * Optional — when supplied, the TPV calls `switchAccount(accountId)` before
   * authenticating so the merchants discovered come from THAT login. Omit to
   * use whichever account the SDK is currently authenticated as.
   */
  angelpayUserAccountId?: string
}

export interface FetchAngelPayMerchantsResult {
  commandId: string
  terminalId: string
}

/**
 * Multi-AngelPay accounts per venue (2026-05-18). Dispatches a
 * `FETCH_ANGELPAY_MERCHANTS` socket command to the venue's NEXGO terminal.
 *
 * Returns 202 Accepted with the queued command id. The caller should poll
 * the discovered-merchants query for up to 30s to surface fresh results.
 */
export async function fetchAngelPayMerchantsFromTpv(
  payload: FetchAngelPayMerchantsRequest,
): Promise<FetchAngelPayMerchantsResult> {
  const { venueId, terminalId, angelpayUserAccountId } = payload
  const body: { terminalId?: string; angelpayUserAccountId?: string } = {}
  if (terminalId) body.terminalId = terminalId
  if (angelpayUserAccountId) body.angelpayUserAccountId = angelpayUserAccountId
  const { data } = await api.post<ApiEnvelope<FetchAngelPayMerchantsResult>>(
    `/api/v1/superadmin/venues/${venueId}/angelpay-fetch-merchants`,
    body,
  )
  return data.data
}

/** Create a per-venue AngelPay user account. Backend validates email + PIN format. */
export async function createAngelPayUserAccountForVenue(
  venueId: string,
  payload: CreateAngelPayUserAccountRequest,
): Promise<AngelPayUserAccount> {
  const { data } = await api.post<ApiEnvelope<AngelPayUserAccount>>(
    `/api/v1/superadmin/venues/${venueId}/angelpay-account`,
    payload,
  )
  return data.data
}

/**
 * Update email and/or environment on an UNCONFIRMED (PENDING_PIN) account.
 * Backend rejects with 400 ValidationError if status !== PENDING_PIN.
 * Throws 409 ConflictError if the new (venueId, email) pair already exists.
 */
export async function updateAngelPayUserAccountCredentials(
  id: string,
  updates: { email?: string; environment?: AngelPayEnvironment },
): Promise<AngelPayUserAccount> {
  const { data } = await api.patch<ApiEnvelope<AngelPayUserAccount>>(
    `/api/v1/superadmin/angelpay-accounts/${id}/credentials`,
    updates,
  )
  return data.data
}

/**
 * Set or rotate the PIN. Always transitions the account to ACTIVE and
 * clears any prior `lastValidationErr` / `statusReason`.
 */
export async function setAngelPayUserAccountPin(id: string, pin: string): Promise<AngelPayUserAccount> {
  const { data } = await api.patch<ApiEnvelope<AngelPayUserAccount>>(
    `/api/v1/superadmin/angelpay-accounts/${id}/pin`,
    { pin },
  )
  return data.data
}

/**
 * Mark the account as needing a PIN rotation. The TPV will refuse to
 * authenticate until ops sets a new PIN via `setPin()`. `reason` is
 * stored verbatim for audit.
 */
export async function markAngelPayUserAccountRotationRequired(
  id: string,
  reason: string,
): Promise<AngelPayUserAccount> {
  const { data } = await api.patch<ApiEnvelope<AngelPayUserAccount>>(
    `/api/v1/superadmin/angelpay-accounts/${id}/status`,
    { status: 'PIN_ROTATION_REQUIRED' as AngelPayStatusTransition, reason },
  )
  return data.data
}

/**
 * Suspend the account. Lifting a suspension requires a deliberate PIN
 * rotation (call `setPin()`) — there is no "unsuspend" endpoint by design.
 */
export async function suspendAngelPayUserAccount(id: string, reason: string): Promise<AngelPayUserAccount> {
  const { data } = await api.patch<ApiEnvelope<AngelPayUserAccount>>(
    `/api/v1/superadmin/angelpay-accounts/${id}/status`,
    { status: 'SUSPENDED' as AngelPayStatusTransition, reason },
  )
  return data.data
}

/** Soft delete (status=DELETED). Row is preserved for audit / FK integrity. */
export async function deleteAngelPayUserAccount(id: string): Promise<AngelPayUserAccount> {
  const { data } = await api.delete<ApiEnvelope<AngelPayUserAccount>>(
    `/api/v1/superadmin/angelpay-accounts/${id}`,
  )
  return data.data
}

/**
 * Option B closure — approve an auto-discovered AngelPay MerchantAccount
 * AND assign it to a VenuePaymentConfig slot in one atomic backend
 * transaction. Default slot is PRIMARY; pass `'SECONDARY'` or `'TERTIARY'`
 * to wire it into one of those slots instead.
 *
 * Backend: `approveAngelPayDiscoveredMerchantController` /
 *          `services/superadmin/merchantAccount.service.ts#approveDiscoveredAngelPayMerchant`.
 *
 * Errors surfaced to the caller:
 *  - 409 ConflictError — chosen slot already occupied by a *different* merchant
 *  - 400 BadRequestError — no VenuePaymentConfig exists yet AND slot != PRIMARY
 *  - 404 NotFoundError — venue or merchant doesn't exist
 *  - 400 BadRequestError — merchant is already active (nothing to approve)
 */
export type AngelPayVenuePaymentSlot = 'PRIMARY' | 'SECONDARY' | 'TERTIARY'

export interface ApproveDiscoveredAngelPayMerchantResult {
  merchantAccount: any // MerchantAccount + provider
  venuePaymentConfig: any // VenuePaymentConfig + slot relations
}

export interface ApproveDiscoveredAngelPayMerchantPayload {
  venueId: string
  merchantAccountId: string
  slot?: AngelPayVenuePaymentSlot
  /**
   * Optional per-terminal scoping. When provided non-empty, the merchant ID is
   * pushed onto each `Terminal.assignedMerchantIds` (idempotent on the server)
   * so the TPV config endpoint only surfaces this merchant on the listed
   * terminals. Omit (or empty) to make the merchant available on every
   * brand-compatible terminal in the venue via VenuePaymentConfig inheritance.
   */
  terminalIds?: string[]
}

export async function approveDiscoveredAngelPayMerchant(
  payload: ApproveDiscoveredAngelPayMerchantPayload,
): Promise<ApproveDiscoveredAngelPayMerchantResult> {
  const { venueId, merchantAccountId, slot = 'PRIMARY', terminalIds } = payload
  const body: { slot: AngelPayVenuePaymentSlot; terminalIds?: string[] } = { slot }
  if (terminalIds && terminalIds.length > 0) {
    body.terminalIds = terminalIds
  }
  const { data } = await api.post<ApiEnvelope<ApproveDiscoveredAngelPayMerchantResult>>(
    `/api/v1/superadmin/venues/${venueId}/angelpay-merchants/${merchantAccountId}/approve`,
    body,
  )
  return data.data
}

export interface ReserveAngelPaySlotPayload {
  venueId: string
  slot?: AngelPayVenuePaymentSlot
  displayName?: string
  /**
   * Optional — when supplied, links the placeholder to a specific
   * AngelPayUserAccount. The TPV's later discovery upgrade only overwrites
   * placeholders whose `angelpayUserAccountId` matches the authenticating
   * account, preventing cross-contamination between multi-account venues.
   * Omit (or empty string) for the legacy "first authenticated wins" path.
   */
  angelpayUserAccountId?: string
}

export interface ReserveAngelPaySlotResult {
  merchantAccountId: string
  slot: AngelPayVenuePaymentSlot
  externalMerchantId: string
}

/**
 * Reserve a VenuePaymentConfig slot for an AngelPay merchant BEFORE the real
 * Merchant ID / Affiliation are known. Returns a placeholder MerchantAccount
 * (active=false, externalMerchantId='AWAITING_<venueId>_<ts>') that the TPV
 * upgrades with real data when discovery fires.
 */
export async function reserveAngelPaySlot(
  payload: ReserveAngelPaySlotPayload,
): Promise<ReserveAngelPaySlotResult> {
  const { venueId, slot, displayName, angelpayUserAccountId } = payload
  const body: { slot?: AngelPayVenuePaymentSlot; displayName?: string; angelpayUserAccountId?: string } = {}
  if (slot) body.slot = slot
  if (displayName) body.displayName = displayName
  if (angelpayUserAccountId) body.angelpayUserAccountId = angelpayUserAccountId
  const { data } = await api.post<ApiEnvelope<ReserveAngelPaySlotResult>>(
    `/api/v1/superadmin/venues/${venueId}/angelpay-reserve-slot`,
    body,
  )
  return data.data
}

/**
 * Grouped namespace mirroring the `terminalAPI` / `paymentProviderAPI`
 * convention used across this dashboard. Components that prefer the
 * individual exports can still import them directly.
 */
export const angelpayUserAccountAPI = {
  get: getAngelPayUserAccountForVenue,
  listForVenue: listAngelPayUserAccountsForVenue,
  fetchMerchantsFromTpv: fetchAngelPayMerchantsFromTpv,
  create: createAngelPayUserAccountForVenue,
  updateCredentials: updateAngelPayUserAccountCredentials,
  setPin: setAngelPayUserAccountPin,
  markRotationRequired: markAngelPayUserAccountRotationRequired,
  suspend: suspendAngelPayUserAccount,
  delete: deleteAngelPayUserAccount,
  approveDiscoveredMerchant: approveDiscoveredAngelPayMerchant,
  reserveSlot: reserveAngelPaySlot,
}
