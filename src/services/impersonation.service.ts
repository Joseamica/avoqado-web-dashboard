import api from '@/api'
import type { StaffRole } from '@/types'

export type ImpersonationMode = 'user' | 'role'

export interface ImpersonationState {
  isImpersonating: boolean
  mode: ImpersonationMode | null
  impersonatedUserId: string | null
  impersonatedRole: StaffRole | null
  expiresAt: number | null // Unix seconds
  extensionsUsed: number
  maxExtensions: number
  reason: string | null
  /** Real actor's role (always SUPERADMIN in v1). */
  realRole: StaffRole | null
  /** Real actor's staffId — used by the banner to distinguish user-mode target from the actor. */
  realUserId: string | null
}

export interface EligibleTarget {
  id: string
  firstName: string
  lastName: string
  email: string
  photoUrl: string | null
  role: StaffRole
}

export interface EligibleTargetsResponse {
  users: EligibleTarget[]
  roles: StaffRole[]
}

export interface StartImpersonationRequest {
  mode: ImpersonationMode
  targetUserId?: string
  targetRole?: StaffRole
  reason: string
}

export interface ImpersonationMutationResponse {
  success: boolean
  impersonation: ImpersonationState
}

/**
 * Frontend client for the SUPERADMIN impersonation API.
 *
 * See spec: docs/superpowers/specs/2026-04-20-superadmin-impersonation-design.md
 * All endpoints require the SUPERADMIN's normal session cookie.
 */
const impersonationService = {
  /**
   * Start a read-only impersonation session.
   * On success, the backend rotates the accessToken cookie to an impersonation token.
   */
  async start(payload: StartImpersonationRequest): Promise<ImpersonationMutationResponse> {
    const res = await api.post<ImpersonationMutationResponse>('/api/v1/dashboard/impersonation/start', payload)
    return res.data
  },

  /**
   * Extend the current impersonation session by +15 min. Max 2 extensions.
   */
  async extend(): Promise<ImpersonationMutationResponse> {
    const res = await api.post<ImpersonationMutationResponse>('/api/v1/dashboard/impersonation/extend')
    return res.data
  },

  /**
   * Stop the current impersonation session. Safe to call when no session is active (idempotent).
   */
  async stop(): Promise<{ success: true; impersonation: { isImpersonating: false } }> {
    const res = await api.post<{ success: true; impersonation: { isImpersonating: false } }>(
      '/api/v1/dashboard/impersonation/stop',
    )
    return res.data
  },

  /**
   * Fetch the current impersonation state from the backend.
   * Used on app mount and after venue switches to hydrate the banner/hook state.
   */
  async getStatus(): Promise<ImpersonationState> {
    const res = await api.get<ImpersonationState>('/api/v1/dashboard/impersonation/status')
    return res.data
  },

  /**
   * List staff members and roles that the SUPERADMIN may impersonate within the current venue.
   */
  async getEligibleTargets(): Promise<EligibleTargetsResponse> {
    const res = await api.get<EligibleTargetsResponse>('/api/v1/dashboard/impersonation/eligible-targets')
    return res.data
  },
}

export default impersonationService
