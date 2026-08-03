import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import InviteAccept from '@/pages/InviteAccept'
import { useAuth } from '@/context/AuthContext'
import api from '@/api'
import { consumeInviteToken } from '@/lib/pendingInvitation'

/**
 * The invitation screen used to offer exactly one way in: create a password. That is the wrong ask
 * for two groups of people — someone who wants to use Google, and (worse) someone whose Avoqado
 * account was CREATED with Google and therefore has `password: null`. The second group was being
 * told to invent a credential they never had, on a screen with no Google option at all.
 */

const loginWithGoogle = vi.fn()
const toastSpy = vi.fn()

vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastSpy }) }))
vi.mock('@/api', () => ({
  __esModule: true,
  default: { get: vi.fn(), post: vi.fn() },
}))
vi.mock('@/services/auth.service', () => ({
  authService: { getAuthStatus: vi.fn().mockResolvedValue({ authenticated: true, user: null }) },
}))
vi.mock('react-i18next', () => {
  // Stable identities on purpose: InviteAccept lists `t` in effect/callback dependency arrays, so a
  // fresh function per render would re-run the invitation fetch on every render and drown the test
  // in re-renders. Returning the key itself also lets assertions target identifiers, not copy.
  const t = (key: string) => key
  const i18n = { language: 'es' }
  const translation = { t, i18n }
  return { useTranslation: () => translation }
})

const mockedUseAuth = vi.mocked(useAuth)
const mockedApi = vi.mocked(api) as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> }

const INVITATION = {
  id: 'inv-1',
  email: 'invited@test.com',
  role: 'WAITER',
  roleDisplayName: null,
  organizationName: 'Test Org',
  venueName: 'Main Venue',
  inviterName: 'The Boss',
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  status: 'PENDING',
  firstName: null,
  lastName: null,
  userAlreadyHasPassword: false,
  existsInDifferentOrg: false,
  requirePin: false,
}

function renderInvite() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/invite/tok-123']}>
        <Routes>
          <Route path="/invite/:token" element={<InviteAccept />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  mockedApi.get.mockResolvedValue({ data: INVITATION })
  mockedApi.post.mockResolvedValue({ data: {} })
  // Logged out by default.
  mockedUseAuth.mockReturnValue({ isAuthenticated: false, user: null, loginWithGoogle } as any)
})

describe('InviteAccept — Google is a first-class way to accept', () => {
  it('offers Google alongside the password form', async () => {
    renderInvite()

    expect(await screen.findByRole('button', { name: /continueWithGoogle/i })).toBeInTheDocument()
  })

  it('parks the invitation token before handing off to Google', async () => {
    // The OAuth redirect leaves the app; without parking the token, /auth/google/callback has no
    // way back to this specific invitation.
    renderInvite()
    const button = await screen.findByRole('button', { name: /continueWithGoogle/i })

    await userEvent.click(button)

    await waitFor(() => expect(loginWithGoogle).toHaveBeenCalledTimes(1))
    expect(consumeInviteToken()).toBe('tok-123')
  })

  it('shows direct accept — not a password form — to a signed-in account with no password', async () => {
    // This is the Google-registered user coming back from the OAuth round trip.
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { email: 'invited@test.com' },
      loginWithGoogle,
    } as any)

    renderInvite()

    expect(await screen.findByRole('button', { name: /directAccept.acceptButton/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/labels.password/i)).not.toBeInTheDocument()
  })

  it('accepts with an empty body when no PIN was demanded', async () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { email: 'invited@test.com' },
      loginWithGoogle,
    } as any)

    renderInvite()
    await userEvent.click(await screen.findByRole('button', { name: /directAccept.acceptButton/i }))

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/api/v1/invitations/tok-123/accept', {}))
  })

  describe('when the inviter demanded a PIN', () => {
    beforeEach(() => {
      mockedApi.get.mockResolvedValue({ data: { ...INVITATION, requirePin: true } })
      mockedUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { email: 'invited@test.com' },
        loginWithGoogle,
      } as any)
    })

    // Always await the accept button first: the full password form ALSO renders a
    // `labels.pinRequired` field, and it is on screen for one render while the session check
    // settles. The button is what proves we are looking at the direct-accept screen.
    const pinField = async () => {
      await screen.findByRole('button', { name: /directAccept.acceptButton/i })
      return screen.getByLabelText(/labels.pinRequired/i)
    }

    it('asks for the PIN only — never a password', async () => {
      renderInvite()

      expect(await pinField()).toBeInTheDocument()
      expect(screen.queryByLabelText(/labels.password/i)).not.toBeInTheDocument()
    })

    it('blocks accepting until the PIN is valid', async () => {
      renderInvite()
      const accept = await screen.findByRole('button', { name: /directAccept.acceptButton/i })

      expect(accept).toBeDisabled()

      await userEvent.type(await pinField(), '12')
      expect(accept).toBeDisabled() // 2 digits — below the 4-digit minimum

      await userEvent.type(await pinField(), '34')
      expect(accept).toBeEnabled()
    })

    it('sends the PIN with the accept', async () => {
      renderInvite()
      await userEvent.type(await pinField(), '4321')
      await userEvent.click(await screen.findByRole('button', { name: /directAccept.acceptButton/i }))

      await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/api/v1/invitations/tok-123/accept', { pin: '4321' }))
    })
  })

  describe('regressions', () => {
    it('still demands password verification from an account that HAS a password', async () => {
      mockedApi.get.mockResolvedValue({ data: { ...INVITATION, userAlreadyHasPassword: true } })
      mockedUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { email: 'invited@test.com' },
        loginWithGoogle,
      } as any)

      renderInvite()

      await waitFor(() => expect(mockedApi.get).toHaveBeenCalled())
      expect(screen.queryByRole('button', { name: /directAccept.acceptButton/i })).not.toBeInTheDocument()
    })

    it('warns on an email mismatch instead of accepting for the wrong person', async () => {
      mockedUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { email: 'someone.else@test.com' },
        loginWithGoogle,
      } as any)

      renderInvite()

      await waitFor(() => expect(mockedApi.get).toHaveBeenCalled())
      expect(screen.queryByRole('button', { name: /directAccept.acceptButton/i })).not.toBeInTheDocument()
    })
  })
})
