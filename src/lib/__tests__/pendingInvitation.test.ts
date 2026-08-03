import { describe, it, expect, beforeEach } from 'vitest'
import { stashInviteToken, consumeInviteToken, clearInviteToken, resolvePostLoginRedirect } from '../pendingInvitation'
import type { PendingInvitation } from '@/services/auth.service'

/**
 * Post-Google-sign-in routing.
 *
 * The bug this pins: signing in with Google used to always land on '/'. Someone whose ONLY access
 * was a pending invitation signed in successfully and got an empty dashboard with no route to the
 * invitation — while the exact same person signing in with email/password was redirected to
 * /invite/:token. Two doors, two different outcomes.
 */

const invitation = (token: string): PendingInvitation => ({
  id: `id-${token}`,
  token,
  role: 'WAITER',
  venueId: 'venue-1',
  venueName: 'Main Venue',
  organizationId: 'org-1',
  organizationName: 'Test Org',
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
})

beforeEach(() => {
  sessionStorage.clear()
})

describe('invite token parking', () => {
  it('round-trips a token across the OAuth redirect', () => {
    stashInviteToken('tok-1')
    expect(consumeInviteToken()).toBe('tok-1')
  })

  it('consumes the token so it cannot hijack the next sign-in in this tab', () => {
    stashInviteToken('tok-1')
    consumeInviteToken()
    expect(consumeInviteToken()).toBeNull()
  })

  it('clears on an abandoned attempt', () => {
    stashInviteToken('tok-1')
    clearInviteToken()
    expect(consumeInviteToken()).toBeNull()
  })
})

describe('resolvePostLoginRedirect', () => {
  it('follows the normal flow when nothing is pending', () => {
    expect(resolvePostLoginRedirect({})).toBeNull()
  })

  it('routes to the invitation the backend reported', () => {
    expect(resolvePostLoginRedirect({ pendingInvitations: [invitation('tok-backend')] })).toBe('/invite/tok-backend')
  })

  it('routes to the token parked by the invitation page', () => {
    stashInviteToken('tok-parked')
    expect(resolvePostLoginRedirect({})).toBe('/invite/tok-parked')
  })

  it('prefers the parked token — it is the invitation the person actually clicked', () => {
    stashInviteToken('tok-parked')
    expect(resolvePostLoginRedirect({ pendingInvitations: [invitation('tok-other')] })).toBe('/invite/tok-parked')
  })

  it('does NOT bounce a brand-new user to an invitation the backend already accepted', () => {
    // isNewUser means loginWithGoogle created the account FROM the invitation and marked it
    // ACCEPTED. /invite/:token would then render "Invitación no encontrada o ya utilizada" for
    // something that in fact succeeded.
    stashInviteToken('tok-parked')
    expect(resolvePostLoginRedirect({ isNewUser: true, pendingInvitations: [invitation('tok-x')] })).toBeNull()
  })

  it('still consumes the parked token on the isNewUser short-circuit', () => {
    stashInviteToken('tok-parked')
    resolvePostLoginRedirect({ isNewUser: true })
    expect(consumeInviteToken()).toBeNull()
  })

  it('treats an empty pendingInvitations array as nothing pending', () => {
    expect(resolvePostLoginRedirect({ pendingInvitations: [] })).toBeNull()
  })

  it('takes the first invitation when several are pending', () => {
    expect(resolvePostLoginRedirect({ pendingInvitations: [invitation('tok-a'), invitation('tok-b')] })).toBe('/invite/tok-a')
  })
})
