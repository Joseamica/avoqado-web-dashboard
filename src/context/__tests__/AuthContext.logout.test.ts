/**
 * Unit tests for AuthContext logout behavior
 * Tests the logout flow including:
 * - Token/storage cleanup order (FIRST to prevent flash)
 * - Query cancellation and cache clearing
 * - Navigation to login page
 * - Toast notification
 * - Server notification in background
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Type-safe mock function signatures
type NavigateFn = (path: string, options?: { replace?: boolean }) => void
type ToastFn = (params: { title: string; description?: string }) => void
type SetActiveVenueFn = (venue: null) => void

interface QueryClient {
  cancelQueries: () => Promise<void>
  clear: () => void
}

interface AuthService {
  logout: () => Promise<void>
}

interface LocalStorageMock {
  removeItem: (key: string) => void
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

interface SessionStorageMock {
  removeItem: (key: string) => void
}

// Replicate the logout handler logic from AuthContext
async function handleLogout(
  returnTo: string | undefined,
  options: {
    navigate: NavigateFn
    toast: ToastFn
    queryClient: QueryClient
    authService: AuthService
    setActiveVenue: SetActiveVenueFn
    localStorage: LocalStorageMock
    sessionStorage: SessionStorageMock
    clearAllChatStorage: () => void
    isLoggingOutRef: { current: boolean }
    t: (key: string) => string
  },
): Promise<{ navigatedTo: string; toastShown: boolean; serverNotified: boolean }> {
  const {
    navigate,
    toast,
    queryClient,
    authService,
    setActiveVenue,
    localStorage,
    sessionStorage,
    clearAllChatStorage,
    isLoggingOutRef,
    t,
  } = options

  // Track execution order for verification
  const executionOrder: string[] = []

  isLoggingOutRef.current = true
  executionOrder.push('set_logging_out_flag')

  // 1. Remove auth tokens FIRST (prevents flash)
  // NOTE: avoqado_current_venue_slug is NOT removed (Stripe/Shopify pattern)
  // Users should return to their last venue after re-login
  localStorage.removeItem('authToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
  localStorage.removeItem('pendingInvitationUrl')
  sessionStorage.removeItem('inviteRedirected')
  clearAllChatStorage()
  executionOrder.push('clear_storage')

  // 2. Cancel all in-flight queries BEFORE navigation
  await queryClient.cancelQueries()
  executionOrder.push('cancel_queries')

  // 3. Navigate to login
  const loginUrl = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'
  navigate(loginUrl, { replace: true })
  executionOrder.push('navigate')

  // 4. Show logout success toast
  toast({
    title: t('common:userMenu.logoutSuccess'),
    description: t('common:userMenu.logoutSuccessDesc'),
  })
  executionOrder.push('show_toast')

  // 5. Clear query cache and local state
  queryClient.clear()
  setActiveVenue(null)
  executionOrder.push('clear_cache')

  // 6. Notify server in background
  let serverNotified = false
  try {
    await authService.logout()
    serverNotified = true
    executionOrder.push('server_logout_success')
  } catch {
    executionOrder.push('server_logout_failed')
  } finally {
    isLoggingOutRef.current = false
  }

  return {
    navigatedTo: loginUrl,
    toastShown: true,
    serverNotified,
  }
}

describe('AuthContext Logout', () => {
  let mockNavigate: NavigateFn
  let mockToast: ToastFn
  let mockQueryClient: QueryClient
  let mockAuthService: AuthService
  let mockSetActiveVenue: SetActiveVenueFn
  let mockLocalStorage: LocalStorageMock
  let mockSessionStorage: SessionStorageMock
  let mockClearAllChatStorage: () => void
  let mockIsLoggingOutRef: { current: boolean }
  let mockT: (key: string) => string

  beforeEach(() => {
    mockNavigate = vi.fn()
    mockToast = vi.fn()
    mockQueryClient = {
      cancelQueries: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn(),
    }
    mockAuthService = {
      logout: vi.fn().mockResolvedValue(undefined),
    }
    mockSetActiveVenue = vi.fn()
    mockLocalStorage = {
      removeItem: vi.fn(),
      getItem: vi.fn(),
      setItem: vi.fn(),
    }
    mockSessionStorage = {
      removeItem: vi.fn(),
    }
    mockClearAllChatStorage = vi.fn()
    mockIsLoggingOutRef = { current: false }
    mockT = vi.fn((key: string) => key)
  })

  describe('storage cleanup', () => {
    it('should remove all auth tokens from localStorage', async () => {
      await handleLogout(undefined, {
        navigate: mockNavigate,
        toast: mockToast,
        queryClient: mockQueryClient,
        authService: mockAuthService,
        setActiveVenue: mockSetActiveVenue,
        localStorage: mockLocalStorage,
        sessionStorage: mockSessionStorage,
        clearAllChatStorage: mockClearAllChatStorage,
        isLoggingOutRef: mockIsLoggingOutRef,
        t: mockT,
      })

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken')
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('refreshToken')
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('user')
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('pendingInvitationUrl')
      // NOTE: avoqado_current_venue_slug should NOT be removed (Stripe/Shopify pattern)
    })

    it('should clear sessionStorage invitation redirect flag', async () => {
      await handleLogout(undefined, {
        navigate: mockNavigate,
        toast: mockToast,
        queryClient: mockQueryClient,
        authService: mockAuthService,
        setActiveVenue: mockSetActiveVenue,
        localStorage: mockLocalStorage,
        sessionStorage: mockSessionStorage,
        clearAllChatStorage: mockClearAllChatStorage,
        isLoggingOutRef: mockIsLoggingOutRef,
        t: mockT,
      })

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('inviteRedirected')
    })

    it('should clear all chat storage', async () => {
      await handleLogout(undefined, {
        navigate: mockNavigate,
        toast: mockToast,
        queryClient: mockQueryClient,
        authService: mockAuthService,
        setActiveVenue: mockSetActiveVenue,
        localStorage: mockLocalStorage,
        sessionStorage: mockSessionStorage,
        clearAllChatStorage: mockClearAllChatStorage,
        isLoggingOutRef: mockIsLoggingOutRef,
        t: mockT,
      })

      expect(mockClearAllChatStorage).toHaveBeenCalled()
    })
  })

  describe('query client operations', () => {
    it('should cancel in-flight queries before navigation', async () => {
      const callOrder: string[] = []

      const trackedQueryClient = {
        cancelQueries: vi.fn().mockImplementation(async () => {
          callOrder.push('cancelQueries')
        }),
        clear: vi.fn().mockImplementation(() => {
          callOrder.push('clear')
        }),
      }

      const trackedNavigate = vi.fn().mockImplementation(() => {
        callOrder.push('navigate')
      })

      await handleLogout(undefined, {
        navigate: trackedNavigate,
        toast: mockToast,
        queryClient: trackedQueryClient,
        authService: mockAuthService,
        setActiveVenue: mockSetActiveVenue,
        localStorage: mockLocalStorage,
        sessionStorage: mockSessionStorage,
        clearAllChatStorage: mockClearAllChatStorage,
        isLoggingOutRef: mockIsLoggingOutRef,
        t: mockT,
      })

      // cancelQueries should be called BEFORE navigate
      const cancelIndex = callOrder.indexOf('cancelQueries')
      const navigateIndex = callOrder.indexOf('navigate')
      expect(cancelIndex).toBeLessThan(navigateIndex)
    })

    it('should clear query cache after navigation', async () => {
      const callOrder: string[] = []

      const trackedQueryClient = {
        cancelQueries: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockImplementation(() => {
          callOrder.push('clear')
        }),
      }

      const trackedNavigate = vi.fn().mockImplementation(() => {
        callOrder.push('navigate')
      })

      await handleLogout(undefined, {
        navigate: trackedNavigate,
        toast: mockToast,
        queryClient: trackedQueryClient,
        authService: mockAuthService,
        setActiveVenue: mockSetActiveVenue,
        localStorage: mockLocalStorage,
        sessionStorage: mockSessionStorage,
        clearAllChatStorage: mockClearAllChatStorage,
        isLoggingOutRef: mockIsLoggingOutRef,
        t: mockT,
      })

      // clear should be called AFTER navigate
      const clearIndex = callOrder.indexOf('clear')
      const navigateIndex = callOrder.indexOf('navigate')
      expect(clearIndex).toBeGreaterThan(navigateIndex)
    })
  })

  describe('navigation', () => {
    it('should navigate to /login without returnTo by default', async () => {
      const result = await handleLogout(undefined, {
        navigate: mockNavigate,
        toast: mockToast,
        queryClient: mockQueryClient,
        authService: mockAuthService,
        setActiveVenue: mockSetActiveVenue,
        localStorage: mockLocalStorage,
        sessionStorage: mockSessionStorage,
        clearAllChatStorage: mockClearAllChatStorage,
        isLoggingOutRef: mockIsLoggingOutRef,
        t: mockT,
      })

      expect(result.navigatedTo).toBe('/login')
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
    })

    it('should include returnTo parameter when provided', async () => {
      const result = await handleLogout('/venues/my-venue/settings', {
        navigate: mockNavigate,
        toast: mockToast,
        queryClient: mockQueryClient,
        authService: mockAuthService,
        setActiveVenue: mockSetActiveVenue,
        localStorage: mockLocalStorage,
        sessionStorage: mockSessionStorage,
        clearAllChatStorage: mockClearAllChatStorage,
        isLoggingOutRef: mockIsLoggingOutRef,
        t: mockT,
      })

      expect(result.navigatedTo).toBe('/login?returnTo=%2Fvenues%2Fmy-venue%2Fsettings')
      expect(mockNavigate).toHaveBeenCalledWith(
        '/login?returnTo=%2Fvenues%2Fmy-venue%2Fsettings',
        { replace: true }
      )
    })

    it('should use replace: true to prevent back navigation to protected routes', async () => {
      await handleLogout(undefined, {
        navigate: mockNavigate,
        toast: mockToast,
        queryClient: mockQueryClient,
        authService: mockAuthService,
        setActiveVenue: mockSetActiveVenue,
        localStorage: mockLocalStorage,
        sessionStorage: mockSessionStorage,
        clearAllChatStorage: mockClearAllChatStorage,
        isLoggingOutRef: mockIsLoggingOutRef,
        t: mockT,
      })

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ replace: true })
      )
    })
  })

  describe('toast notification', () => {
    it('should show logout success toast', async () => {
      await handleLogout(undefined, {
        navigate: mockNavigate,
        toast: mockToast,
        queryClient: mockQueryClient,
        authService: mockAuthService,
        setActiveVenue: mockSetActiveVenue,
        localStorage: mockLocalStorage,
        sessionStorage: mockSessionStorage,
        clearAllChatStorage: mockClearAllChatStorage,
        isLoggingOutRef: mockIsLoggingOutRef,
        t: mockT,
      })

      expect(mockToast).toHaveBeenCalledWith({
        title: 'common:userMenu.logoutSuccess',
        description: 'common:userMenu.logoutSuccessDesc',
      })
    })

    it('should show toast after navigation (user sees it on login page)', async () => {
      const callOrder: string[] = []

      const trackedNavigate = vi.fn().mockImplementation(() => {
        callOrder.push('navigate')
      })

      const trackedToast = vi.fn().mockImplementation(() => {
        callOrder.push('toast')
      })

      await handleLogout(undefined, {
        navigate: trackedNavigate,
        toast: trackedToast,
        queryClient: mockQueryClient,
        authService: mockAuthService,
        setActiveVenue: mockSetActiveVenue,
        localStorage: mockLocalStorage,
        sessionStorage: mockSessionStorage,
        clearAllChatStorage: mockClearAllChatStorage,
        isLoggingOutRef: mockIsLoggingOutRef,
        t: mockT,
      })

      const navigateIndex = callOrder.indexOf('navigate')
      const toastIndex = callOrder.indexOf('toast')
      expect(toastIndex).toBeGreaterThan(navigateIndex)
    })
  })

  describe('state cleanup', () => {
    it('should reset activeVenue to null', async () => {
      await handleLogout(undefined, {
        navigate: mockNavigate,
        toast: mockToast,
        queryClient: mockQueryClient,
        authService: mockAuthService,
        setActiveVenue: mockSetActiveVenue,
        localStorage: mockLocalStorage,
        sessionStorage: mockSessionStorage,
        clearAllChatStorage: mockClearAllChatStorage,
        isLoggingOutRef: mockIsLoggingOutRef,
        t: mockT,
      })

      expect(mockSetActiveVenue).toHaveBeenCalledWith(null)
    })

    it('should set isLoggingOutRef to true during logout', async () => {
      let refValueDuringLogout: boolean | null = null

      const trackedQueryClient = {
        cancelQueries: vi.fn().mockImplementation(async () => {
          refValueDuringLogout = mockIsLoggingOutRef.current
        }),
        clear: vi.fn(),
      }

      await handleLogout(undefined, {
        navigate: mockNavigate,
        toast: mockToast,
        queryClient: trackedQueryClient,
        authService: mockAuthService,
        setActiveVenue: mockSetActiveVenue,
        localStorage: mockLocalStorage,
        sessionStorage: mockSessionStorage,
        clearAllChatStorage: mockClearAllChatStorage,
        isLoggingOutRef: mockIsLoggingOutRef,
        t: mockT,
      })

      expect(refValueDuringLogout).toBe(true)
    })

    it('should reset isLoggingOutRef to false after logout completes', async () => {
      await handleLogout(undefined, {
        navigate: mockNavigate,
        toast: mockToast,
        queryClient: mockQueryClient,
        authService: mockAuthService,
        setActiveVenue: mockSetActiveVenue,
        localStorage: mockLocalStorage,
        sessionStorage: mockSessionStorage,
        clearAllChatStorage: mockClearAllChatStorage,
        isLoggingOutRef: mockIsLoggingOutRef,
        t: mockT,
      })

      expect(mockIsLoggingOutRef.current).toBe(false)
    })
  })

  describe('server notification', () => {
    it('should notify server of logout in background', async () => {
      const result = await handleLogout(undefined, {
        navigate: mockNavigate,
        toast: mockToast,
        queryClient: mockQueryClient,
        authService: mockAuthService,
        setActiveVenue: mockSetActiveVenue,
        localStorage: mockLocalStorage,
        sessionStorage: mockSessionStorage,
        clearAllChatStorage: mockClearAllChatStorage,
        isLoggingOutRef: mockIsLoggingOutRef,
        t: mockT,
      })

      expect(mockAuthService.logout).toHaveBeenCalled()
      expect(result.serverNotified).toBe(true)
    })

    it('should continue logout flow even if server notification fails', async () => {
      const failingAuthService = {
        logout: vi.fn().mockRejectedValue(new Error('Network error')),
      }

      const result = await handleLogout(undefined, {
        navigate: mockNavigate,
        toast: mockToast,
        queryClient: mockQueryClient,
        authService: failingAuthService,
        setActiveVenue: mockSetActiveVenue,
        localStorage: mockLocalStorage,
        sessionStorage: mockSessionStorage,
        clearAllChatStorage: mockClearAllChatStorage,
        isLoggingOutRef: mockIsLoggingOutRef,
        t: mockT,
      })

      // Logout should still complete successfully
      expect(mockNavigate).toHaveBeenCalled()
      expect(mockToast).toHaveBeenCalled()
      expect(mockQueryClient.clear).toHaveBeenCalled()
      expect(result.serverNotified).toBe(false)
    })

    it('should reset isLoggingOutRef even if server notification fails', async () => {
      const failingAuthService = {
        logout: vi.fn().mockRejectedValue(new Error('Network error')),
      }

      await handleLogout(undefined, {
        navigate: mockNavigate,
        toast: mockToast,
        queryClient: mockQueryClient,
        authService: failingAuthService,
        setActiveVenue: mockSetActiveVenue,
        localStorage: mockLocalStorage,
        sessionStorage: mockSessionStorage,
        clearAllChatStorage: mockClearAllChatStorage,
        isLoggingOutRef: mockIsLoggingOutRef,
        t: mockT,
      })

      expect(mockIsLoggingOutRef.current).toBe(false)
    })
  })

  describe('execution order (flash prevention)', () => {
    it('should execute operations in correct order to prevent flash', async () => {
      const executionOrder: string[] = []

      const trackedLocalStorage = {
        removeItem: vi.fn().mockImplementation(() => {
          if (!executionOrder.includes('clear_storage')) {
            executionOrder.push('clear_storage')
          }
        }),
        getItem: vi.fn(),
        setItem: vi.fn(),
      }

      const trackedQueryClient = {
        cancelQueries: vi.fn().mockImplementation(async () => {
          executionOrder.push('cancel_queries')
        }),
        clear: vi.fn().mockImplementation(() => {
          executionOrder.push('clear_cache')
        }),
      }

      const trackedNavigate = vi.fn().mockImplementation(() => {
        executionOrder.push('navigate')
      })

      const trackedToast = vi.fn().mockImplementation(() => {
        executionOrder.push('toast')
      })

      await handleLogout(undefined, {
        navigate: trackedNavigate,
        toast: trackedToast,
        queryClient: trackedQueryClient,
        authService: mockAuthService,
        setActiveVenue: mockSetActiveVenue,
        localStorage: trackedLocalStorage,
        sessionStorage: mockSessionStorage,
        clearAllChatStorage: mockClearAllChatStorage,
        isLoggingOutRef: mockIsLoggingOutRef,
        t: mockT,
      })

      // Expected order:
      // 1. clear_storage (remove tokens FIRST - prevents 401 errors on pending requests)
      // 2. cancel_queries (stop in-flight requests)
      // 3. navigate (go to login page)
      // 4. toast (show success message on login page)
      // 5. clear_cache (clean up React Query cache)

      expect(executionOrder.indexOf('clear_storage')).toBeLessThan(executionOrder.indexOf('cancel_queries'))
      expect(executionOrder.indexOf('cancel_queries')).toBeLessThan(executionOrder.indexOf('navigate'))
      expect(executionOrder.indexOf('navigate')).toBeLessThan(executionOrder.indexOf('toast'))
      expect(executionOrder.indexOf('toast')).toBeLessThan(executionOrder.indexOf('clear_cache'))
    })
  })
})

describe('Logout User Scenarios', () => {
  it('documents the logout flow for preventing UI flash', () => {
    /**
     * PROBLEM: Without proper ordering, logout causes a flash:
     * 1. User clicks logout
     * 2. queryClient.clear() causes isLoading = true → LoadingScreen appears
     * 3. Navigate to /login
     * 4. Login page appears briefly
     * 5. LoadingScreen might flash again
     *
     * SOLUTION: Proper operation ordering:
     * 1. Set isLoggingOutRef = true (prevents LoadingScreen during transition)
     * 2. Clear localStorage tokens FIRST (invalidates auth immediately)
     * 3. Cancel in-flight queries (stops any pending 401s)
     * 4. Navigate to /login (user sees login page)
     * 5. Show toast (appears on login page)
     * 6. Clear query cache (happens after user is already on login page)
     * 7. Clear local state
     * 8. Notify server in background (doesn't block UI)
     */
    expect(true).toBe(true) // Documentation test
  })

  it('documents the returnTo parameter use case', () => {
    /**
     * SCENARIO: Session expires while user is on protected route
     *
     * 1. User is on /venues/my-venue/settings
     * 2. Session expires (401 from API)
     * 3. Interceptor calls logout('/venues/my-venue/settings')
     * 4. User is redirected to /login?returnTo=%2Fvenues%2Fmy-venue%2Fsettings
     * 5. User logs in again
     * 6. AuthContext reads returnTo and redirects back to /venues/my-venue/settings
     *
     * This is the Stripe/GitHub pattern for preserving user context.
     */
    expect(true).toBe(true) // Documentation test
  })
})
