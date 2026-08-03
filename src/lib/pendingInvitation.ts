import type { PendingInvitation } from '@/services/auth.service'

/**
 * Where an invitation token is parked while the user is away at Google's consent screen.
 *
 * The OAuth redirect leaves the app entirely, so `/invite/:token` cannot hand the token to the
 * callback through React state or the URL — the callback only ever receives Google's `?code=`.
 * sessionStorage (not localStorage) on purpose: this is scoped to one sign-in attempt in one tab,
 * and a stale token surviving a browser restart would bounce an unrelated login into an invitation
 * screen.
 */
const INVITE_TOKEN_KEY = 'avoqado_pending_invite_token'

/** Park the invitation token right before sending the user off to Google. */
export function stashInviteToken(token: string): void {
  try {
    sessionStorage.setItem(INVITE_TOKEN_KEY, token)
  } catch {
    // Private mode / storage disabled. Not fatal: the backend still reports pending invitations
    // for users with no active venues, which covers the most common case on its own.
  }
}

/** Read and consume the parked token. Consuming is deliberate — it must not survive one round trip. */
export function consumeInviteToken(): string | null {
  try {
    const token = sessionStorage.getItem(INVITE_TOKEN_KEY)
    if (token) sessionStorage.removeItem(INVITE_TOKEN_KEY)
    return token
  } catch {
    return null
  }
}

export function clearInviteToken(): void {
  try {
    sessionStorage.removeItem(INVITE_TOKEN_KEY)
  } catch {
    /* no-op */
  }
}

interface ResolveArgs {
  /** `pendingInvitations` from the auth response — present only when the user has no active venues. */
  pendingInvitations?: PendingInvitation[]
  /**
   * True when the backend created the account from an invitation during THIS login, which means it
   * already marked that invitation ACCEPTED. Sending them to /invite/:token afterwards would render
   * "Invitación no encontrada o ya utilizada" for something that actually succeeded.
   */
  isNewUser?: boolean
}

/**
 * Decide where to land after a successful Google sign-in.
 *
 * Two independent signals, because they cover different people:
 *  - a token parked by the invitation page (works even when the user already has other venues,
 *    in which case the backend returns no `pendingInvitations` at all)
 *  - `pendingInvitations` from the backend (works for someone who came in through /login and had
 *    no idea an invitation was waiting)
 *
 * Returns the path to navigate to, or null to follow the normal post-login flow.
 */
export function resolvePostLoginRedirect({ pendingInvitations, isNewUser }: ResolveArgs): string | null {
  // Consume unconditionally, even on the isNewUser short-circuit below — a token left behind would
  // hijack the user's NEXT sign-in in this tab.
  const stashed = consumeInviteToken()

  // The backend already accepted the invitation while creating this account. Nothing left to do.
  if (isNewUser) return null

  if (stashed) return `/invite/${stashed}`

  if (pendingInvitations && pendingInvitations.length > 0) {
    return `/invite/${pendingInvitations[0].token}`
  }

  return null
}
