/**
 * Unit tests for AuthContext login navigation behavior
 * Tests the pendingInvitations feature:
 * - When login returns pendingInvitations, redirect to /invite/{token}
 * - When login returns normally, follow standard navigation flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Test the login mutation onSuccess logic in isolation
// This tests the decision logic without needing to render the full context

interface PendingInvitation {
  id: string
  token: string
  role: string
  venueId: string | null
  venueName: string | null
  organizationId: string
  organizationName: string
  expiresAt: string
}

interface LoginResponse {
  message: string
  staff: {
    id: string
    email: string
    firstName: string
    lastName: string
    venues: any[]
  }
  pendingInvitations?: PendingInvitation[]
}

// Type-safe mock function signatures
type NavigateFn = (path: string, options?: { replace?: boolean }) => void
type ToastFn = (params: { title: string; description?: string }) => void
type RefetchQueriesFn = () => Promise<void>
type SetLoginErrorFn = (error: string | null) => void
type TranslateFn = (key: string, options?: Record<string, unknown>) => string

// Replicate the login success handler logic from AuthContext
function handleLoginSuccess(
  data: LoginResponse,
  options: {
    navigate: NavigateFn
    toast: ToastFn
    refetchQueries: RefetchQueriesFn
    setLoginError: SetLoginErrorFn
    t: TranslateFn
  },
): { redirectedToInvite: boolean; inviteToken?: string } {
  const { navigate, toast, refetchQueries, setLoginError, t } = options

  // Enterprise pattern: Handle users with no active venues but pending invitations
  // Instead of blocking login, we allow them to login and redirect to accept the invitation
  if (data?.pendingInvitations && data.pendingInvitations.length > 0) {
    const firstInvitation = data.pendingInvitations[0]

    // Show informative toast about the invitation
    toast({
      title: t('toast.pending_invitation_title', { defaultValue: 'Tienes una invitación pendiente' }),
      description: t('toast.pending_invitation_desc', {
        defaultValue: `Te han invitado a unirte a ${firstInvitation.organizationName}`,
        org: firstInvitation.organizationName,
      }),
    })

    // Redirect to invitation acceptance page
    navigate(`/invite/${firstInvitation.token}`, { replace: true })
    setLoginError(null)
    return { redirectedToInvite: true, inviteToken: firstInvitation.token }
  }

  // Normal login flow - show success toast and refetch auth status
  toast({ title: t('toast.login_success') })
  refetchQueries()
  setLoginError(null)
  return { redirectedToInvite: false }
}

// Helper to create mock login response
function createMockLoginResponse(overrides: Partial<LoginResponse> = {}): LoginResponse {
  return {
    message: 'Login successful',
    staff: {
      id: 'staff-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      venues: [],
    },
    ...overrides,
  }
}

// Helper to create mock pending invitation
function createMockInvitation(overrides: Partial<PendingInvitation> = {}): PendingInvitation {
  return {
    id: 'inv-' + Math.random().toString(36).substr(2, 9),
    token: 'token-' + Math.random().toString(36).substr(2, 9),
    role: 'ADMIN',
    venueId: 'venue-123',
    venueName: 'Test Venue',
    organizationId: 'org-123',
    organizationName: 'Test Organization',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  }
}

describe('AuthContext Login Navigation', () => {
  let mockNavigate: NavigateFn
  let mockToast: ToastFn
  let mockRefetchQueries: RefetchQueriesFn
  let mockSetLoginError: SetLoginErrorFn
  let mockT: TranslateFn

  beforeEach(() => {
    mockNavigate = vi.fn<NavigateFn>()
    mockToast = vi.fn<ToastFn>()
    mockRefetchQueries = vi.fn<RefetchQueriesFn>().mockResolvedValue(undefined)
    mockSetLoginError = vi.fn<SetLoginErrorFn>()
    mockT = vi.fn<TranslateFn>((key: string, options?: Record<string, unknown>) => (options?.defaultValue as string) || key)
  })

  describe('pendingInvitations handling', () => {
    it('should redirect to /invite/{token} when user has pending invitations', () => {
      const invitation = createMockInvitation({ token: 'abc123' })
      const response = createMockLoginResponse({
        staff: {
          id: 'staff-123',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          venues: [], // No active venues
        },
        pendingInvitations: [invitation],
      })

      const result = handleLoginSuccess(response, {
        navigate: mockNavigate,
        toast: mockToast,
        refetchQueries: mockRefetchQueries,
        setLoginError: mockSetLoginError,
        t: mockT,
      })

      // Should redirect to invitation page
      expect(result.redirectedToInvite).toBe(true)
      expect(result.inviteToken).toBe('abc123')
      expect(mockNavigate).toHaveBeenCalledWith('/invite/abc123', { replace: true })

      // Should show toast about pending invitation
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Tienes una invitación pendiente',
        description: expect.stringContaining('Test Organization'),
      })

      // Should clear any previous login errors
      expect(mockSetLoginError).toHaveBeenCalledWith(null)

      // Should NOT refetch queries (we're redirecting to invite page)
      expect(mockRefetchQueries).not.toHaveBeenCalled()
    })

    it('should redirect to the FIRST invitation when multiple pending invitations exist', () => {
      const invitation1 = createMockInvitation({
        token: 'first-token',
        organizationName: 'First Org',
      })
      const invitation2 = createMockInvitation({
        token: 'second-token',
        organizationName: 'Second Org',
      })
      const response = createMockLoginResponse({
        pendingInvitations: [invitation1, invitation2],
      })

      const result = handleLoginSuccess(response, {
        navigate: mockNavigate,
        toast: mockToast,
        refetchQueries: mockRefetchQueries,
        setLoginError: mockSetLoginError,
        t: mockT,
      })

      // Should redirect to FIRST invitation
      expect(result.redirectedToInvite).toBe(true)
      expect(result.inviteToken).toBe('first-token')
      expect(mockNavigate).toHaveBeenCalledWith('/invite/first-token', { replace: true })

      // Toast should mention the first organization
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('First Org'),
        }),
      )
    })

    it('should follow normal flow when pendingInvitations is empty array', () => {
      const response = createMockLoginResponse({
        staff: {
          id: 'staff-123',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          venues: [{ id: 'v1', name: 'Venue 1', slug: 'venue-1' }],
        },
        pendingInvitations: [], // Empty array
      })

      const result = handleLoginSuccess(response, {
        navigate: mockNavigate,
        toast: mockToast,
        refetchQueries: mockRefetchQueries,
        setLoginError: mockSetLoginError,
        t: mockT,
      })

      // Should NOT redirect to invite page
      expect(result.redirectedToInvite).toBe(false)
      expect(result.inviteToken).toBeUndefined()

      // Should NOT navigate to /invite/...
      expect(mockNavigate).not.toHaveBeenCalled()

      // Should show normal login success toast
      expect(mockToast).toHaveBeenCalledWith({ title: 'toast.login_success' })

      // Should refetch auth status for normal flow
      expect(mockRefetchQueries).toHaveBeenCalled()

      // Should clear login errors
      expect(mockSetLoginError).toHaveBeenCalledWith(null)
    })

    it('should follow normal flow when pendingInvitations is undefined', () => {
      const response = createMockLoginResponse({
        staff: {
          id: 'staff-123',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          venues: [{ id: 'v1', name: 'Venue 1', slug: 'venue-1' }],
        },
        // pendingInvitations not present
      })

      const result = handleLoginSuccess(response, {
        navigate: mockNavigate,
        toast: mockToast,
        refetchQueries: mockRefetchQueries,
        setLoginError: mockSetLoginError,
        t: mockT,
      })

      // Should NOT redirect to invite page
      expect(result.redirectedToInvite).toBe(false)

      // Normal flow
      expect(mockNavigate).not.toHaveBeenCalled()
      expect(mockToast).toHaveBeenCalledWith({ title: 'toast.login_success' })
      expect(mockRefetchQueries).toHaveBeenCalled()
    })
  })

  describe('normal login flow', () => {
    it('should show success toast and refetch queries for user with venues', () => {
      const response = createMockLoginResponse({
        staff: {
          id: 'staff-123',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          venues: [
            { id: 'v1', name: 'Venue 1', slug: 'venue-1', role: 'ADMIN' },
            { id: 'v2', name: 'Venue 2', slug: 'venue-2', role: 'MANAGER' },
          ],
        },
      })

      const result = handleLoginSuccess(response, {
        navigate: mockNavigate,
        toast: mockToast,
        refetchQueries: mockRefetchQueries,
        setLoginError: mockSetLoginError,
        t: mockT,
      })

      expect(result.redirectedToInvite).toBe(false)
      expect(mockToast).toHaveBeenCalledWith({ title: 'toast.login_success' })
      expect(mockRefetchQueries).toHaveBeenCalled()
      expect(mockSetLoginError).toHaveBeenCalledWith(null)
    })

    it('should clear previous login errors on successful login', () => {
      const response = createMockLoginResponse()

      handleLoginSuccess(response, {
        navigate: mockNavigate,
        toast: mockToast,
        refetchQueries: mockRefetchQueries,
        setLoginError: mockSetLoginError,
        t: mockT,
      })

      expect(mockSetLoginError).toHaveBeenCalledWith(null)
    })
  })

  describe('invitation token handling', () => {
    it('should handle invitation with special characters in token', () => {
      const invitation = createMockInvitation({
        token: 'abc-123_XYZ',
      })
      const response = createMockLoginResponse({
        pendingInvitations: [invitation],
      })

      const result = handleLoginSuccess(response, {
        navigate: mockNavigate,
        toast: mockToast,
        refetchQueries: mockRefetchQueries,
        setLoginError: mockSetLoginError,
        t: mockT,
      })

      expect(mockNavigate).toHaveBeenCalledWith('/invite/abc-123_XYZ', { replace: true })
      expect(result.inviteToken).toBe('abc-123_XYZ')
    })

    it('should handle invitation without venueId (org-level invitation)', () => {
      const invitation = createMockInvitation({
        token: 'org-invite-token',
        venueId: null,
        venueName: null,
        organizationName: 'Enterprise Org',
      })
      const response = createMockLoginResponse({
        pendingInvitations: [invitation],
      })

      const result = handleLoginSuccess(response, {
        navigate: mockNavigate,
        toast: mockToast,
        refetchQueries: mockRefetchQueries,
        setLoginError: mockSetLoginError,
        t: mockT,
      })

      expect(result.redirectedToInvite).toBe(true)
      expect(mockNavigate).toHaveBeenCalledWith('/invite/org-invite-token', { replace: true })
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('Enterprise Org'),
        }),
      )
    })
  })

  describe('edge cases', () => {
    it('should handle user with venues AND pending invitations (redirects to invite)', () => {
      // User already has active venues but also has pending invitations
      // This is the case where an existing user gets invited to another org
      const invitation = createMockInvitation({ token: 'new-org-invite' })
      const response = createMockLoginResponse({
        staff: {
          id: 'staff-123',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          venues: [{ id: 'v1', name: 'Existing Venue', slug: 'existing-venue' }],
        },
        pendingInvitations: [invitation],
      })

      const result = handleLoginSuccess(response, {
        navigate: mockNavigate,
        toast: mockToast,
        refetchQueries: mockRefetchQueries,
        setLoginError: mockSetLoginError,
        t: mockT,
      })

      // NOTE: Current behavior redirects to invite even if user has venues
      // This prioritizes invitation acceptance flow
      // The backend only returns pendingInvitations when user has NO active venues
      expect(result.redirectedToInvite).toBe(true)
    })
  })
})

describe('Invitation Navigation Scenarios', () => {
  it('documents the full user journey for pending invitations', () => {
    /**
     * SCENARIO: Existing user with no active venues receives invitation
     *
     * 1. User is invited to Organization A (invitation created, email sent)
     * 2. User clicks login (or is redirected from invite link)
     * 3. User enters credentials
     * 4. Backend detects: user exists, has no active venues, has pending invitation
     * 5. Backend returns: { staff, pendingInvitations: [...] }
     * 6. Frontend's loginMutation.onSuccess handler:
     *    - Detects pendingInvitations.length > 0
     *    - Shows toast: "Tienes una invitación pendiente"
     *    - Redirects to: /invite/{token}
     * 7. User lands on invitation acceptance page
     * 8. User accepts invitation
     * 9. Backend creates StaffVenue relationship
     * 10. User is now part of the venue and can access dashboard
     */
    expect(true).toBe(true) // Documentation test
  })

  it('documents the scenario where user has active venues and gets new invitation', () => {
    /**
     * SCENARIO: User with active venues logs in and has pending invitation elsewhere
     *
     * Current Implementation:
     * - Backend ONLY returns pendingInvitations when user has NO active venues
     * - If user has active venues, they login normally
     * - They can check pending invitations via separate UI (notification bell, etc.)
     *
     * This prevents disrupting users who just want to access their existing venues.
     */
    expect(true).toBe(true) // Documentation test
  })
})

// ============================================
// HOTFIX TESTS: Explicit Redirect After Refetch
// ============================================
// These tests verify the explicit redirect logic added to fix the race condition
// where useEffect-based redirects competed with AuthContext redirect

interface SessionVenue {
  id: string
  name: string
  slug: string
  role: string
  modules?: Array<{ module: { code: string }; enabled: boolean }>
}

interface FreshUser {
  id: string
  email: string
  role: string
  venues: SessionVenue[]
}

interface FreshStatus {
  authenticated: boolean
  user: FreshUser
  allVenues: Array<SessionVenue & { modules?: Array<{ module: { code: string }; enabled: boolean }> }>
}

// Simulates the redirect logic from AuthContext onSuccess handler
function handleExplicitRedirect(
  freshStatus: FreshStatus | undefined,
  options: {
    navigate: NavigateFn
    toast: ToastFn
    setLoginError: SetLoginErrorFn
    t: TranslateFn
    getVenueBasePath: (venue: any) => string
    locationSearch: string
  },
): { redirected: boolean; path?: string } {
  const { navigate, toast, setLoginError, t, getVenueBasePath, locationSearch } = options
  const freshUser = freshStatus?.user

  if (!freshUser) {
    toast({ title: t('toast.login_success') })
    setLoginError(null)
    return { redirected: false }
  }

  // 1. Check returnTo parameter first (Stripe/GitHub pattern)
  const searchParams = new URLSearchParams(locationSearch)
  const returnTo = searchParams.get('returnTo')
  if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
    toast({ title: t('toast.login_success') })
    navigate(returnTo, { replace: true })
    setLoginError(null)
    return { redirected: true, path: returnTo }
  }

  // 2. SUPERADMIN → /superadmin
  if (freshUser.role === 'SUPERADMIN') {
    toast({ title: t('toast.login_success') })
    navigate('/superadmin', { replace: true })
    setLoginError(null)
    return { redirected: true, path: '/superadmin' }
  }

  const userVenues = freshUser.venues || []

  // 3. OWNER without venues → /onboarding
  if (userVenues.length === 0) {
    toast({ title: t('toast.login_success') })
    navigate('/onboarding', { replace: true })
    setLoginError(null)
    return { redirected: true, path: '/onboarding' }
  }

  // 4. Normal user with venues → default venue home
  const defaultSessionVenue = userVenues[0]
  const fullVenue = freshStatus?.allVenues?.find(v => v.slug === defaultSessionVenue.slug)
  const basePath = fullVenue ? getVenueBasePath(fullVenue) : `/venues/${defaultSessionVenue.slug}`
  const finalPath = `${basePath}/home`
  toast({ title: t('toast.login_success') })
  navigate(finalPath, { replace: true })
  setLoginError(null)
  return { redirected: true, path: finalPath }
}

describe('Explicit Redirect After Refetch (HOTFIX)', () => {
  let mockNavigate: NavigateFn
  let mockToast: ToastFn
  let mockSetLoginError: SetLoginErrorFn
  let mockT: TranslateFn
  let mockGetVenueBasePath: (venue: any) => string

  beforeEach(() => {
    mockNavigate = vi.fn<NavigateFn>()
    mockToast = vi.fn<ToastFn>()
    mockSetLoginError = vi.fn<SetLoginErrorFn>()
    mockT = vi.fn<TranslateFn>((key: string) => key)
    mockGetVenueBasePath = vi.fn((venue: any) => {
      // Simulate white-label check
      if (venue?.modules?.some((m: any) => m.module.code === 'WHITE_LABEL_DASHBOARD' && m.enabled)) {
        return `/wl/venues/${venue.slug}`
      }
      return `/venues/${venue.slug}`
    })
  })

  describe('returnTo parameter handling', () => {
    it('should redirect to returnTo when present in URL', () => {
      const freshStatus: FreshStatus = {
        authenticated: true,
        user: {
          id: 'user-1',
          email: 'test@test.com',
          role: 'ADMIN',
          venues: [{ id: 'v1', name: 'Venue', slug: 'venue-1', role: 'ADMIN' }],
        },
        allVenues: [{ id: 'v1', name: 'Venue', slug: 'venue-1', role: 'ADMIN' }],
      }

      const result = handleExplicitRedirect(freshStatus, {
        navigate: mockNavigate,
        toast: mockToast,
        setLoginError: mockSetLoginError,
        t: mockT,
        getVenueBasePath: mockGetVenueBasePath,
        locationSearch: '?returnTo=/invite/abc123',
      })

      expect(result.redirected).toBe(true)
      expect(result.path).toBe('/invite/abc123')
      expect(mockNavigate).toHaveBeenCalledWith('/invite/abc123', { replace: true })
    })

    it('should reject returnTo with protocol-relative URL (security)', () => {
      const freshStatus: FreshStatus = {
        authenticated: true,
        user: {
          id: 'user-1',
          email: 'test@test.com',
          role: 'ADMIN',
          venues: [{ id: 'v1', name: 'Venue', slug: 'venue-1', role: 'ADMIN' }],
        },
        allVenues: [{ id: 'v1', name: 'Venue', slug: 'venue-1', role: 'ADMIN' }],
      }

      const result = handleExplicitRedirect(freshStatus, {
        navigate: mockNavigate,
        toast: mockToast,
        setLoginError: mockSetLoginError,
        t: mockT,
        getVenueBasePath: mockGetVenueBasePath,
        locationSearch: '?returnTo=//evil.com/phishing',
      })

      // Should NOT redirect to external URL, should go to venue home instead
      expect(result.path).not.toBe('//evil.com/phishing')
      expect(result.path).toBe('/venues/venue-1/home')
    })

    it('should reject returnTo without leading slash (security)', () => {
      const freshStatus: FreshStatus = {
        authenticated: true,
        user: {
          id: 'user-1',
          email: 'test@test.com',
          role: 'ADMIN',
          venues: [{ id: 'v1', name: 'Venue', slug: 'venue-1', role: 'ADMIN' }],
        },
        allVenues: [{ id: 'v1', name: 'Venue', slug: 'venue-1', role: 'ADMIN' }],
      }

      const result = handleExplicitRedirect(freshStatus, {
        navigate: mockNavigate,
        toast: mockToast,
        setLoginError: mockSetLoginError,
        t: mockT,
        getVenueBasePath: mockGetVenueBasePath,
        locationSearch: '?returnTo=https://evil.com',
      })

      // Should NOT redirect to external URL
      expect(result.path).toBe('/venues/venue-1/home')
    })
  })

  describe('SUPERADMIN redirect', () => {
    it('should redirect SUPERADMIN to /superadmin', () => {
      const freshStatus: FreshStatus = {
        authenticated: true,
        user: {
          id: 'superadmin-1',
          email: 'master@avoqado.io',
          role: 'SUPERADMIN',
          venues: [],
        },
        allVenues: [],
      }

      const result = handleExplicitRedirect(freshStatus, {
        navigate: mockNavigate,
        toast: mockToast,
        setLoginError: mockSetLoginError,
        t: mockT,
        getVenueBasePath: mockGetVenueBasePath,
        locationSearch: '',
      })

      expect(result.redirected).toBe(true)
      expect(result.path).toBe('/superadmin')
      expect(mockNavigate).toHaveBeenCalledWith('/superadmin', { replace: true })
    })

    it('should prioritize returnTo over SUPERADMIN redirect', () => {
      const freshStatus: FreshStatus = {
        authenticated: true,
        user: {
          id: 'superadmin-1',
          email: 'master@avoqado.io',
          role: 'SUPERADMIN',
          venues: [],
        },
        allVenues: [],
      }

      const result = handleExplicitRedirect(freshStatus, {
        navigate: mockNavigate,
        toast: mockToast,
        setLoginError: mockSetLoginError,
        t: mockT,
        getVenueBasePath: mockGetVenueBasePath,
        locationSearch: '?returnTo=/venues/some-venue/settings',
      })

      expect(result.path).toBe('/venues/some-venue/settings')
    })
  })

  describe('OWNER without venues (onboarding)', () => {
    it('should redirect to /onboarding when user has no venues', () => {
      const freshStatus: FreshStatus = {
        authenticated: true,
        user: {
          id: 'owner-1',
          email: 'owner@test.com',
          role: 'OWNER',
          venues: [], // No venues yet
        },
        allVenues: [],
      }

      const result = handleExplicitRedirect(freshStatus, {
        navigate: mockNavigate,
        toast: mockToast,
        setLoginError: mockSetLoginError,
        t: mockT,
        getVenueBasePath: mockGetVenueBasePath,
        locationSearch: '',
      })

      expect(result.redirected).toBe(true)
      expect(result.path).toBe('/onboarding')
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding', { replace: true })
    })
  })

  describe('Normal user with venues', () => {
    it('should redirect to first venue home', () => {
      const freshStatus: FreshStatus = {
        authenticated: true,
        user: {
          id: 'user-1',
          email: 'test@test.com',
          role: 'ADMIN',
          venues: [
            { id: 'v1', name: 'First Venue', slug: 'first-venue', role: 'ADMIN' },
            { id: 'v2', name: 'Second Venue', slug: 'second-venue', role: 'MANAGER' },
          ],
        },
        allVenues: [
          { id: 'v1', name: 'First Venue', slug: 'first-venue', role: 'ADMIN' },
          { id: 'v2', name: 'Second Venue', slug: 'second-venue', role: 'MANAGER' },
        ],
      }

      const result = handleExplicitRedirect(freshStatus, {
        navigate: mockNavigate,
        toast: mockToast,
        setLoginError: mockSetLoginError,
        t: mockT,
        getVenueBasePath: mockGetVenueBasePath,
        locationSearch: '',
      })

      expect(result.redirected).toBe(true)
      expect(result.path).toBe('/venues/first-venue/home')
      expect(mockNavigate).toHaveBeenCalledWith('/venues/first-venue/home', { replace: true })
    })

    it('should use white-label path for WHITE_LABEL_DASHBOARD venues', () => {
      const freshStatus: FreshStatus = {
        authenticated: true,
        user: {
          id: 'user-1',
          email: 'test@test.com',
          role: 'ADMIN',
          venues: [{ id: 'wl-v1', name: 'White Label Venue', slug: 'wl-venue', role: 'ADMIN' }],
        },
        allVenues: [
          {
            id: 'wl-v1',
            name: 'White Label Venue',
            slug: 'wl-venue',
            role: 'ADMIN',
            modules: [{ module: { code: 'WHITE_LABEL_DASHBOARD' }, enabled: true }],
          },
        ],
      }

      const result = handleExplicitRedirect(freshStatus, {
        navigate: mockNavigate,
        toast: mockToast,
        setLoginError: mockSetLoginError,
        t: mockT,
        getVenueBasePath: mockGetVenueBasePath,
        locationSearch: '',
      })

      expect(result.redirected).toBe(true)
      expect(result.path).toBe('/wl/venues/wl-venue/home')
      expect(mockNavigate).toHaveBeenCalledWith('/wl/venues/wl-venue/home', { replace: true })
    })

    it('should fallback to /venues/:slug when allVenues is empty', () => {
      const freshStatus: FreshStatus = {
        authenticated: true,
        user: {
          id: 'user-1',
          email: 'test@test.com',
          role: 'ADMIN',
          venues: [{ id: 'v1', name: 'Venue', slug: 'my-venue', role: 'ADMIN' }],
        },
        allVenues: [], // Edge case: allVenues not populated
      }

      const result = handleExplicitRedirect(freshStatus, {
        navigate: mockNavigate,
        toast: mockToast,
        setLoginError: mockSetLoginError,
        t: mockT,
        getVenueBasePath: mockGetVenueBasePath,
        locationSearch: '',
      })

      // Should fallback to /venues/:slug when can't find full venue
      expect(result.redirected).toBe(true)
      expect(result.path).toBe('/venues/my-venue/home')
    })
  })

  describe('freshUser is null (fallback)', () => {
    it('should not redirect when freshUser is null', () => {
      const result = handleExplicitRedirect(undefined, {
        navigate: mockNavigate,
        toast: mockToast,
        setLoginError: mockSetLoginError,
        t: mockT,
        getVenueBasePath: mockGetVenueBasePath,
        locationSearch: '',
      })

      expect(result.redirected).toBe(false)
      expect(mockNavigate).not.toHaveBeenCalled()
      // Still shows toast and clears error for fallback to useEffect
      expect(mockToast).toHaveBeenCalled()
      expect(mockSetLoginError).toHaveBeenCalledWith(null)
    })
  })

  describe('toast and error handling', () => {
    it('should show success toast on all redirect scenarios', () => {
      const freshStatus: FreshStatus = {
        authenticated: true,
        user: {
          id: 'user-1',
          email: 'test@test.com',
          role: 'ADMIN',
          venues: [{ id: 'v1', name: 'Venue', slug: 'venue-1', role: 'ADMIN' }],
        },
        allVenues: [{ id: 'v1', name: 'Venue', slug: 'venue-1', role: 'ADMIN' }],
      }

      handleExplicitRedirect(freshStatus, {
        navigate: mockNavigate,
        toast: mockToast,
        setLoginError: mockSetLoginError,
        t: mockT,
        getVenueBasePath: mockGetVenueBasePath,
        locationSearch: '',
      })

      expect(mockToast).toHaveBeenCalledWith({ title: 'toast.login_success' })
      expect(mockSetLoginError).toHaveBeenCalledWith(null)
    })
  })
})
