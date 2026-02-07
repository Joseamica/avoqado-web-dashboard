/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import * as authService from '@/services/auth.service'
import * as liveDemoService from '@/services/liveDemo.service'
import { clearAllChatStorage } from '@/services/chatService'
import { LoadingScreen } from '@/components/spinner'
import { useToast } from '@/hooks/use-toast'
import { User, Venue, StaffRole } from '@/types'

// Tipos y la Interfaz del Contexto
type LoginData = { email: string; password: string; venueSlug?: string }

type SignupData = {
  email: string
  password: string
  firstName: string
  lastName: string
  organizationName: string
}

interface AuthContextType {
  isAuthenticated: boolean
  user: User | null
  activeVenue: Venue | null
  isLoading: boolean
  login: (data: LoginData) => void
  signup: (data: SignupData) => Promise<void>
  loginWithGoogle: () => Promise<void>
  loginWithOneTap: (credential: string) => Promise<void>
  logout: (returnTo?: string) => void // Optional returnTo for URL-based state (Stripe/GitHub pattern)
  switchVenue: (newVenueSlug: string) => Promise<void> // Para cambiar de venue por slug
  authorizeVenue: (venueSlug: string) => boolean
  checkVenueAccess: (venueSlug: string) => boolean
  checkFeatureAccess: (featureCode: string) => boolean // VenueFeature (billing)
  checkModuleAccess: (moduleCode: string) => boolean // VenueModule (configurable modules like SERIALIZED_INVENTORY)
  getVenueBySlug: (slug: string) => Venue | null // Nueva función para obtener venue por slug
  getVenueBasePath: (venue: Venue) => string // Returns /wl/venues/:slug or /venues/:slug based on WHITE_LABEL_DASHBOARD module
  allVenues: Venue[]
  staffInfo: any | null
  loginError: string | null // Error message for login failures
  clearLoginError: () => void // Clear login error
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider')
  }
  return context
}

// Componente Proveedor
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation(['auth', 'common'])
  const navigate = useNavigate()
  const location = useLocation()
  const { slug } = useParams<{ slug: string }>()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [activeVenue, setActiveVenue] = useState<Venue | null>(null)
  const [isLiveDemoInitializing, setIsLiveDemoInitializing] = useState(false)
  const [liveDemoError, setLiveDemoError] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)

  // Track if we've already attempted live demo auto-login (prevent retry loops)
  const hasAttemptedLiveDemoLogin = useRef(false)
  const retryCountRef = useRef(0)

  // FLASH FIX: Track logout in progress to prevent LoadingScreen flash
  // When logging out, queryClient.clear() causes isStatusLoading to become true momentarily
  // This ref prevents showing LoadingScreen during that transition
  const isLoggingOutRef = useRef(false)

  // OPTIMISTIC AUTH: Check if user was previously logged in
  // Since we use HTTP-only cookies (more secure), we can't check the actual token
  // Instead, we store a simple flag 'avoqado_session_hint' when user logs in
  // This is NOT a security measure - just a UX hint to skip loading screen on reload
  const sessionHintOnMount = typeof window !== 'undefined' ? localStorage.getItem('avoqado_session_hint') === 'true' : false
  const hasSessionHintOnMount = useRef(sessionHintOnMount)

  // Get auth status first
  // staleTime reduced from 5min to 1min to ensure KYC status changes reflect faster
  const { data: statusData, isLoading: isStatusLoading } = useQuery({
    queryKey: ['status'],
    queryFn: authService.getAuthStatus,
    staleTime: 1 * 60 * 1000, // 1 minute - faster sync for KYC/status changes
    retry: false,
  })

  const isAuthenticated = !!statusData?.authenticated
  const user = statusData?.user || null

  // FAANG-style retry with exponential backoff
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  const isRetryableError = (error: any): boolean => {
    const status = error.response?.status
    // Retry on 5xx server errors or network errors
    return !status || status >= 500
  }

  const attemptLiveDemoLogin = useCallback(async (): Promise<void> => {
    const MAX_RETRIES = 3
    const BASE_DELAY = 1000 // 1 second

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        retryCountRef.current = attempt
        await liveDemoService.liveDemoAutoLogin()

        // Success! Refetch auth status and clear errors
        // SECURITY: Use refetchQueries to ensure auth state is updated before navigation
        await queryClient.refetchQueries({ queryKey: ['status'] })
        setLiveDemoError(null)
        return
      } catch (error: any) {
        console.error(`Live demo auto-login attempt ${attempt + 1}/${MAX_RETRIES} failed:`, error)

        const status = error.response?.status

        // Non-retryable errors (4xx client errors)
        if (status && status >= 400 && status < 500) {
          if (status === 404) {
            setLiveDemoError('Demo service is temporarily unavailable. Please try again later.')
          } else {
            setLiveDemoError('Unable to initialize demo. Please refresh the page.')
          }
          return // Don't retry
        }

        // Last attempt failed
        if (attempt === MAX_RETRIES - 1) {
          setLiveDemoError('Failed to initialize demo after multiple attempts. Please refresh the page.')
          return
        }

        // Retryable error - wait with exponential backoff
        if (isRetryableError(error)) {
          const delay = BASE_DELAY * Math.pow(2, attempt) // 1s, 2s, 4s
          console.log(`Retrying in ${delay}ms...`)
          await sleep(delay)
        } else {
          // Unknown error - don't retry
          setLiveDemoError('An unexpected error occurred. Please refresh the page.')
          return
        }
      }
    }
  }, [queryClient])

  // Live Demo Auto-Login: Detect demo.dashboard.avoqado.io and auto-login with retry
  useEffect(() => {
    const initializeLiveDemo = async () => {
      // Only attempt auto-login ONCE per session (user can manually retry via refresh)
      if (liveDemoService.isLiveDemoEnvironment() && !isAuthenticated && !hasAttemptedLiveDemoLogin.current) {
        hasAttemptedLiveDemoLogin.current = true
        setIsLiveDemoInitializing(true)
        setLiveDemoError(null)

        try {
          await attemptLiveDemoLogin()
        } finally {
          setIsLiveDemoInitializing(false)
        }
      }
    }

    initializeLiveDemo()
  }, [isAuthenticated, attemptLiveDemoLogin])

  const userRole = useMemo(() => {
    // SUPERADMIN: Always system-wide, don't derive from venue
    if (user?.role === 'SUPERADMIN') return StaffRole.SUPERADMIN

    // Multi-tenant pattern: Get role from ACTIVE venue's StaffVenue entry
    // This is the correct approach for venue-specific permissions
    if (activeVenue && user?.venues) {
      const venueEntry = user.venues.find(v => v.id === activeVenue.id)
      if (venueEntry?.role) return venueEntry.role
    }

    // Fallback to global role (OWNER without specific venue, etc.)
    if (user?.role) return user.role

    // Last fallback: First venue's role (backwards compatibility)
    return user?.venues?.[0]?.role
  }, [user?.role, user?.venues, activeVenue])

  // IMPORTANT: Use user.venues for all users (backend already combines direct + OWNER org venues)
  // Only SUPERADMIN uses statusData.allVenues (all system venues)
  // This was a bug where OWNER users would see different venues based on current venue role
  const allVenues = useMemo(
    () => (user?.role === 'SUPERADMIN' ? statusData?.allVenues : user?.venues) ?? [],
    [user?.role, user?.venues, statusData?.allVenues],
  )

  // Función para obtener venue por slug
  const getVenueBySlug = useCallback(
    (slug: string): Venue | null => {
      return allVenues.find(venue => venue.slug === slug) || null
    },
    [allVenues],
  )

  // --- FUNCIÓN 'getVenueBasePath' ---
  // Returns /wl/venues/:slug if WHITE_LABEL_DASHBOARD module is enabled, otherwise /venues/:slug
  // This ensures venue switcher and login redirect to the correct dashboard
  const getVenueBasePath = useCallback((venue: Venue): string => {
    // Check if venue has WHITE_LABEL_DASHBOARD module enabled
    if (venue?.modules) {
      const whiteLabelModule = venue.modules.find(m => m.module.code === 'WHITE_LABEL_DASHBOARD')
      if (whiteLabelModule?.enabled) {
        return `/wl/venues/${venue.slug}` // Consistent pattern: /wl/venues/:slug
      }
    }
    return `/venues/${venue.slug}`
  }, [])

  // Efecto para sincronizar el venue activo y manejar redirecciones
  useEffect(() => {
    if (isStatusLoading || !isAuthenticated || !user) return

    const userVenues = user.venues || []
    const isSuperAdmin = user.role === 'SUPERADMIN'
    const accessibleVenues = isSuperAdmin ? allVenues : userVenues

    // PRIORITY 1: URL-based returnTo parameter (Stripe/GitHub pattern)
    // This is the industry-standard way to preserve navigation state across login
    // Example: /login?returnTo=/invite/abc123 → after login → redirect to /invite/abc123
    const searchParams = new URLSearchParams(location.search)
    const returnTo = searchParams.get('returnTo')
    if (returnTo && location.pathname === '/login') {
      // Validate returnTo is a safe internal path (security: prevent open redirect)
      if (returnTo.startsWith('/') && !returnTo.startsWith('//')) {
        navigate(returnTo, { replace: true })
        return
      }
    }

    // World-Class Pattern (Stripe/Shopify): OWNER without venues → redirect to onboarding
    // This handles the case where user verified email but hasn't completed onboarding yet
    if (userVenues.length === 0 && userRole === StaffRole.OWNER) {
      // Don't redirect if already on onboarding or auth routes
      const isOnOnboardingRoute = location.pathname.startsWith('/onboarding')
      const isOnAuthRoute = location.pathname.startsWith('/auth/')

      if (!isOnOnboardingRoute && !isOnAuthRoute) {
        navigate('/onboarding', { replace: true })
      }
      return
    }

    // SUPERADMIN users should have access to all venues and superadmin routes
    if (accessibleVenues.length > 0 || isSuperAdmin) {
      // STRIPE/SHOPIFY PATTERN: Smart venue selection for login redirect
      // Priority: 1) Last accessed venue, 2) Highest role venue, 3) First venue
      const getSmartDefaultVenue = () => {
        // 1. Check localStorage for last used venue (Stripe pattern)
        const lastUsedSlug = localStorage.getItem('avoqado_current_venue_slug')
        if (lastUsedSlug) {
          const lastUsedVenue = accessibleVenues.find((v: any) => v.slug === lastUsedSlug)
          if (lastUsedVenue) return lastUsedVenue
        }

        // 2. Find venue with highest role (OWNER > ADMIN > MANAGER > etc.)
        const roleHierarchy: Record<string, number> = {
          SUPERADMIN: 100,
          OWNER: 90,
          ADMIN: 80,
          MANAGER: 70,
          CASHIER: 60,
          WAITER: 50,
          KITCHEN: 40,
          HOST: 30,
          VIEWER: 10,
        }
        const sortedByRole = [...accessibleVenues].sort((a: any, b: any) => {
          const roleA = roleHierarchy[a.role] || 0
          const roleB = roleHierarchy[b.role] || 0
          return roleB - roleA // Higher role first
        })
        if (sortedByRole.length > 0) return sortedByRole[0]

        // 3. Fallback to first venue
        return accessibleVenues[0] || allVenues[0]
      }

      const defaultVenue = getSmartDefaultVenue()

      // Redirigir desde rutas base a la home del venue por defecto (unless SUPERADMIN going to /superadmin)
      if (location.pathname === '/' || location.pathname === '/login') {
        if (isSuperAdmin) {
          navigate('/superadmin', { replace: true })
        } else {
          // Use getVenueBasePath to redirect to /wl/venues/:slug if WHITE_LABEL_DASHBOARD is enabled
          const basePath = getVenueBasePath(defaultVenue)
          navigate(`${basePath}/home`, { replace: true })
        }
        return
      }

      // Si hay venueSlug en la URL, buscar el venue correspondiente
      if (slug) {
        const venueFromSlug = accessibleVenues.find((v: any) => v.slug === slug)

        if (venueFromSlug) {
          // Si encontramos el venue y no es el activo, actualizarlo
          if (activeVenue?.id !== venueFromSlug.id) {
            setActiveVenue(venueFromSlug)
          }
        } else {
          // Si el slug no corresponde a ningún venue accesible, redirigir al default.
          // SUPERADMIN sin venues visibles regresa al dashboard global.
          if (defaultVenue) {
            const basePath = getVenueBasePath(defaultVenue)
            navigate(`${basePath}/home`, { replace: true })
          } else if (isSuperAdmin) {
            navigate('/superadmin', { replace: true })
          }
        }
      } else if (!slug && activeVenue) {
        // Si no hay slug en la URL pero hay venue activo, usar el activo para la navegación
        const currentPath = location.pathname
        // Don't redirect if user is on superadmin, admin, organization, or white-label routes
        const isOnAdminRoute = currentPath.startsWith('/superadmin') || currentPath.startsWith('/admin')
        const isOnOrgRoute = currentPath.startsWith('/organizations')
        const isOnWhiteLabelRoute = currentPath.startsWith('/wl/')
        if (!currentPath.includes('/venues/') && !isOnAdminRoute && !isOnOrgRoute && !isOnWhiteLabelRoute) {
          const basePath = getVenueBasePath(activeVenue)
          navigate(`${basePath}/home`, { replace: true })
        }
      }
    } else if (userRole !== StaffRole.OWNER && location.pathname !== '/venues/new') {
      // Don't redirect if user is on signup, onboarding, or auth flows (verification, etc.)
      const isOnSignupRoute = location.pathname.startsWith('/signup')
      const isOnOnboardingRoute = location.pathname.startsWith('/onboarding')
      const isOnAuthRoute = location.pathname.startsWith('/auth/')
      if (!isOnSignupRoute && !isOnOnboardingRoute && !isOnAuthRoute) {
        navigate('/venues/new', { replace: true })
      }
    }
  }, [
    slug,
    user,
    isAuthenticated,
    isStatusLoading,
    location.pathname,
    location.search,
    navigate,
    activeVenue?.id,
    getVenueBySlug,
    getVenueBasePath,
    activeVenue,
    allVenues,
    userRole,
  ])

  // --- MUTACIONES ---
  const loginMutation = useMutation({
    mutationFn: (credentials: LoginData) => authService.login(credentials),
    onSuccess: async data => {
      console.log('[AUTH] ✅ Login successful - showing toast')

      // Enterprise pattern: Handle users with no active venues but pending invitations
      // Instead of blocking login, we allow them to login and redirect to accept the invitation
      if (data?.pendingInvitations && data.pendingInvitations.length > 0) {
        console.log('[AUTH] 🎫 User has pending invitations, redirecting to accept first one')
        const firstInvitation = data.pendingInvitations[0]

        // Show informative toast about the invitation
        toast({
          title: t('toast.pending_invitation_title', { defaultValue: 'Tienes una invitación pendiente' }),
          description: t('toast.pending_invitation_desc', {
            defaultValue: `Te han invitado a unirte a ${firstInvitation.organizationName}`,
            org: firstInvitation.organizationName,
          }),
        })

        // Ensure auth state is synchronized before opening invitation flow
        await queryClient.fetchQuery({
          queryKey: ['status'],
          queryFn: authService.getAuthStatus,
          staleTime: 0,
        })

        // Optimistic auth hint for smoother reloads after invitation acceptance
        localStorage.setItem('avoqado_session_hint', 'true')

        // Redirect to invitation acceptance page
        navigate(`/invite/${firstInvitation.token}`, { replace: true })
        setLoginError(null)
        return
      }

      console.log('[AUTH] 🔄 Fetching fresh auth status...')
      // CRITICAL FIX: Use fetchQuery instead of refetchQueries
      // In TanStack Query v5, refetchQueries returns Promise<void>, NOT the data
      // fetchQuery directly returns the data, guaranteeing we have fresh data for redirect
      const freshStatus = await queryClient.fetchQuery({
        queryKey: ['status'],
        queryFn: authService.getAuthStatus,
        staleTime: 0, // Force fresh fetch, ignore any cached data
      })
      console.log('[AUTH] ✅ Fresh auth status received:', { authenticated: freshStatus?.authenticated, hasUser: !!freshStatus?.user })
      const freshUser = freshStatus?.user

      if (freshUser) {
        console.log('[AUTH] 🚀 Executing explicit redirect after login')

        // OPTIMISTIC AUTH: Set session hint for future page reloads
        // This is NOT a security measure - just a UX hint to skip loading screen
        localStorage.setItem('avoqado_session_hint', 'true')

        // 1. Check returnTo parameter first (Stripe/GitHub pattern)
        const searchParams = new URLSearchParams(location.search)
        const returnTo = searchParams.get('returnTo')
        if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
          console.log('[AUTH] ↩️ Redirecting to returnTo:', returnTo)
          toast({ title: t('toast.login_success') })
          navigate(returnTo, { replace: true })
          setLoginError(null)
          return
        }

        // 2. SUPERADMIN → /superadmin
        if (freshUser.role === 'SUPERADMIN') {
          console.log('[AUTH] 👑 SUPERADMIN redirect to /superadmin')
          toast({ title: t('toast.login_success') })
          navigate('/superadmin', { replace: true })
          setLoginError(null)
          return
        }

        const userVenues = freshUser.venues || []

        // 3. OWNER without venues → /onboarding
        if (userVenues.length === 0) {
          console.log('[AUTH] 🆕 No venues, redirect to /onboarding')
          toast({ title: t('toast.login_success') })
          navigate('/onboarding', { replace: true })
          setLoginError(null)
          return
        }

        // 4. Normal user with venues → smart venue selection (Stripe/Shopify pattern)
        // Priority: 1) Last accessed venue from localStorage, 2) Highest role venue, 3) First venue
        const getSmartVenue = () => {
          // Check localStorage for last used venue
          const lastUsedSlug = localStorage.getItem('avoqado_current_venue_slug')
          if (lastUsedSlug) {
            const lastUsedVenue = userVenues.find((v: any) => v.slug === lastUsedSlug)
            if (lastUsedVenue) return lastUsedVenue
          }

          // Find venue with highest role
          const roleHierarchy: Record<string, number> = {
            SUPERADMIN: 100, OWNER: 90, ADMIN: 80, MANAGER: 70,
            CASHIER: 60, WAITER: 50, KITCHEN: 40, HOST: 30, VIEWER: 10,
          }
          const sorted = [...userVenues].sort((a: any, b: any) =>
            (roleHierarchy[b.role] || 0) - (roleHierarchy[a.role] || 0)
          )
          return sorted[0] || userVenues[0]
        }

        const defaultVenue = getSmartVenue()
        const basePath = getVenueBasePath(defaultVenue)
        console.log('[AUTH] 🏠 Redirect to smart venue:', defaultVenue.slug, `${basePath}/home`)
        toast({ title: t('toast.login_success') })
        navigate(`${basePath}/home`, { replace: true })
        setLoginError(null)
        return
      }

      // Fallback: Si freshUser es null, el useEffect manejará el redirect
      console.log('[AUTH] ⚠️ freshUser is null, falling back to useEffect')
      toast({ title: t('toast.login_success') })
      setLoginError(null)
    },
    onError: (error: any, variables) => {
      // FAANG Pattern: Detect network errors first (server down, no internet)
      const isNetworkError =
        !error.response &&
        (error.code === 'ERR_NETWORK' ||
          error.code === 'ECONNREFUSED' ||
          error.message?.includes('Network Error') ||
          error.message?.includes('ERR_CONNECTION_REFUSED'))

      if (isNetworkError) {
        setLoginError(t('common:errors.serverUnavailable'))
        return
      }

      const errorMessage = error.response?.data?.message || ''
      const errorCode = error.response?.data?.code // World-Class: Stripe/GitHub pattern
      const statusCode = error.response?.status

      // FAANG Pattern: Detect email not verified and redirect to verification page
      if (
        statusCode === 403 &&
        (errorMessage.includes('verify') || errorMessage.includes('not verified') || errorMessage.includes('verification required'))
      ) {
        toast({
          title: t('toast.email_not_verified_title'),
          description: t('toast.email_not_verified_desc'),
          variant: 'destructive',
        })
        // Redirect to email verification page with email pre-filled
        navigate(`/auth/verify-email?email=${encodeURIComponent(variables.email)}`)
        return
      }

      // World-Class Pattern: Use error codes for detection (Stripe/GitHub)
      // This is language-agnostic and more reliable than string matching
      if (errorCode === 'NO_VENUE_ACCESS') {
        setLoginError(t('toast.no_venue_access_desc'))
        return
      }

      // Account locked errors should show the backend message (includes time remaining)
      if (statusCode === 403 && errorMessage.includes('locked')) {
        setLoginError(errorMessage)
        return
      }

      // Handle validation errors - clean up technical message format
      // Backend returns: "Validation failed: body.email: Email inválido."
      // We want to show: "Email inválido" (just the user-friendly part)
      if (errorMessage.includes('Validation failed:')) {
        // Extract the user-friendly message after the field path
        // Format: "Validation failed: body.fieldName: User friendly message"
        const cleanedMessage = errorMessage
          .replace(/Validation failed:\s*/i, '') // Remove "Validation failed: "
          .replace(/body\.\w+:\s*/g, '') // Remove "body.fieldName: "
          .replace(/query\.\w+:\s*/g, '') // Remove "query.fieldName: "
          .replace(/params\.\w+:\s*/g, '') // Remove "params.fieldName: "
          .trim()
        setLoginError(cleanedMessage || t('toast.login_error_desc'))
        return
      }

      // Generic authentication error (invalid credentials, etc.)
      // Use backend message if available, fallback to generic translated message
      setLoginError(errorMessage || t('toast.login_error_desc'))
    },
  })


  const signupMutation = useMutation({
    mutationFn: (signupData: SignupData) => authService.signup(signupData),
    onSuccess: () => {
      // Do NOT show toast here - user will be navigated immediately to verification page
      // The verification page already has clear instructions about checking email
      // Do NOT invalidate queries here - causes navigation conflicts
      // SignupForm will navigate to /auth/verify-email immediately
      // That page will fetch status when it mounts
    },
    onError: (error: any) => {
      // FAANG Pattern: Detect network errors first (server down, no internet)
      const isNetworkError =
        !error.response &&
        (error.code === 'ERR_NETWORK' ||
          error.code === 'ECONNREFUSED' ||
          error.message?.includes('Network Error') ||
          error.message?.includes('ERR_CONNECTION_REFUSED'))

      if (isNetworkError) {
        toast({
          title: t('toast.signup_error_title'),
          variant: 'destructive',
          description: t('common:errors.serverUnavailable'),
        })
        return
      }

      const backendMessage = error.response?.data?.message || ''

      // Use frontend translation for "Email already registered" message
      let errorMessage = backendMessage
      if (backendMessage.includes('Email already registered') || backendMessage.includes('already registered')) {
        errorMessage = t('toast.email_already_registered')
      } else if (!backendMessage) {
        errorMessage = t('toast.signup_error_desc')
      }

      toast({
        title: t('toast.signup_error_title'),
        variant: 'destructive',
        description: errorMessage,
      })
    },
  })

  // FAANG Pattern: Optimistic Logout
  // Order is CRITICAL to prevent UI flash AND unnecessary 401 errors:
  // 1. Set auth state to unauthenticated IMMEDIATELY (stops all auth-dependent renders)
  // 2. Clear local state
  // 3. Cancel in-flight queries
  // 4. Clear query cache
  // 5. Remove localStorage/sessionStorage
  // 6. Navigate to login
  // 7. Server logout (background, non-blocking)
  const logout = useCallback(
    async (returnTo?: string) => {
      console.log('[AUTH] 🚪 Step 0: Logout initiated', { returnTo, currentPath: location.pathname })

      // FLASH FIX: Set flag to prevent LoadingScreen from showing during logout
      isLoggingOutRef.current = true
      console.log('[AUTH] 🚪 Step 1: isLoggingOutRef = true')

      // Reset optimistic auth flag since session is being cleared
      hasSessionHintOnMount.current = false
      console.log('[AUTH] 🚪 Step 2: hasSessionHintOnMount = false')

      // 1. CRITICAL: Set auth state to unauthenticated IMMEDIATELY
      // This prevents any component from seeing stale auth state during logout transition
      // Components checking isAuthenticated/user will see "logged out" right away
      queryClient.setQueryData(['status'], { authenticated: false, user: null, allVenues: [] })
      console.log('[AUTH] 🚪 Step 3: setQueryData status = unauthenticated')

      // 2. Clear local state
      setActiveVenue(null)
      console.log('[AUTH] 🚪 Step 4: setActiveVenue = null')

      // 3. Cancel all in-flight queries
      // This stops pending requests that would otherwise return 401
      console.log('[AUTH] 🚪 Step 5: Cancelling queries...')
      await queryClient.cancelQueries()
      console.log('[AUTH] 🚪 Step 5: Queries cancelled')

      // 4. Remove localStorage and sessionStorage items BEFORE navigation
      // NOTE: We preserve 'avoqado_current_venue_slug' (Stripe/Shopify pattern)
      // This allows users to return to their last venue after re-login
      localStorage.removeItem('pendingInvitationUrl')
      localStorage.removeItem('avoqado_session_hint')
      sessionStorage.removeItem('inviteRedirected')
      clearAllChatStorage()
      console.log('[AUTH] 🚪 Step 6: localStorage/sessionStorage cleared')

      // 5. Navigate to login BEFORE clearing cache
      // This unmounts components first, preventing them from refetching when cache is cleared
      const loginUrl = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'
      console.log('[AUTH] 🚪 Step 7: Navigating to', loginUrl)
      navigate(loginUrl, { replace: true })

      // 6. Show logout success toast (user sees this on login page)
      toast({
        title: t('common:userMenu.logoutSuccess'),
        description: t('common:userMenu.logoutSuccessDesc'),
      })
      console.log('[AUTH] 🚪 Step 8: Toast shown')

      // 7. Clear cache AFTER navigation started (components are unmounting)
      // Use setTimeout with delay to ensure navigation completes and prevents flash
      setTimeout(() => {
        queryClient.clear()
        console.log('[AUTH] 🚪 Step 9: Query cache cleared (after navigation)')
      }, 100)

      // 8. Notify server in background (non-blocking)
      console.log('[AUTH] 🚪 Step 10: Calling server logout...')
      try {
        await authService.logout()
        console.log('[AUTH] 🚪 Step 10: Server logout success')
      } catch (error) {
        // Silently ignore - user is already logged out locally
        console.warn('[AUTH] 🚪 Step 10: Server logout failed (user already logged out locally):', error)
      } finally {
        // FLASH FIX: Keep isLoggingOutRef true longer to prevent LoadingScreen flash
        // Reset after a delay to ensure all re-renders from cache clear have completed
        setTimeout(() => {
          isLoggingOutRef.current = false
          console.log('[AUTH] ✅ Logout complete, isLoggingOutRef = false')
        }, 500)
      }
    },
    [navigate, queryClient, toast, t, location.pathname],
  )

  const switchVenueMutation = useMutation({
    mutationFn: (newVenueSlug: string) => {
      // Obtener el ID del venue por el slug para el servicio
      const targetVenue = getVenueBySlug(newVenueSlug)
      if (!targetVenue) {
        throw new Error(`Venue con slug '${newVenueSlug}' no encontrado`)
      }
      return authService.switchVenue(targetVenue.id)
    },
    onSuccess: async (data, newVenueSlug) => {
      // SECURITY: Use refetchQueries to ensure auth state is updated before navigation
      await queryClient.refetchQueries({ queryKey: ['status'] })

      const newVenue = getVenueBySlug(newVenueSlug)
      if (newVenue) {
        setActiveVenue(newVenue)
        toast({ title: t('toast.switched_to_venue', { name: newVenue.name }) })

        // Smart navigation: Respect current mode when switching venues
        const currentPath = location.pathname

        // Detect if we're currently in white-label mode
        const isCurrentlyInWLMode = currentPath.startsWith('/wl/venues/') || currentPath.startsWith('/wl/organizations/')

        // Check if new venue has white-label enabled
        const newVenueHasWL = newVenue.modules?.some(m => m.module.code === 'WHITE_LABEL_DASHBOARD' && m.enabled) ?? false

        // Determine target base path based on current mode and new venue capabilities
        let basePath: string
        if (isCurrentlyInWLMode && newVenueHasWL) {
          // Case: In WL mode + new venue has WL → Stay in WL mode
          basePath = `/wl/venues/${newVenue.slug}`
        } else if (isCurrentlyInWLMode && !newVenueHasWL) {
          // Case: In WL mode + new venue has NO WL → Switch to traditional
          basePath = `/venues/${newVenue.slug}`
        } else {
          // Case: In traditional mode → Always stay traditional (even if new venue has WL)
          basePath = `/venues/${newVenue.slug}`
        }

        // Extract the page part (after /venues/:slug/ or /wl/venues/:slug/)
        // This regex matches /venues/slug/, /wl/venues/slug/, and /organizations/:id/ patterns
        const pageMatch = currentPath.match(/^\/(?:venues|wl\/venues|organizations)\/[^/]+\/(.*)$/)
        const pagePart = pageMatch?.[1] || 'home'

        const newPath = `${basePath}/${pagePart}`
        navigate(newPath, { replace: true })
      }
    },
    onError: (error: any) => {
      toast({
        title: t('toast.switch_venue_error_title'),
        variant: 'destructive',
        description: error.response?.data?.message || t('toast.switch_venue_error_desc'),
      })
    },
  })

  // Google OAuth login
  const loginWithGoogle = useCallback(async (): Promise<void> => {
    try {
      // Get Google auth URL
      const { authUrl } = await authService.getGoogleAuthUrl()

      // Redirect to Google OAuth
      window.location.href = authUrl
    } catch (error: any) {
      toast({
        title: t('toast.auth_error_title'),
        variant: 'destructive',
        description: error.response?.data?.message || t('toast.google_login_error_desc'),
      })
      throw error
    }
  }, [toast, t])

  // Google One Tap login
  const loginWithOneTap = useCallback(
    async (credential: string): Promise<void> => {
      try {
        await authService.googleOneTapLogin(credential)

        // SECURITY: Use refetchQueries to ensure auth state is updated before navigation
        await queryClient.refetchQueries({ queryKey: ['status'] })

        toast({
          title: t('toast.login_success_title'),
          description: t('toast.login_success_desc'),
        })
      } catch (error: any) {
        toast({
          title: t('toast.auth_error_title'),
          variant: 'destructive',
          description: error.response?.data?.message || t('toast.google_login_error_desc'),
        })
        throw error
      }
    },
    [toast, t, queryClient],
  )

  // --- FUNCIONES EXPUESTAS ---

  const clearLoginError = useCallback(() => {
    setLoginError(null)
  }, [])

  const switchVenue = useCallback(
    async (newVenueSlug: string): Promise<void> => {
      if (activeVenue?.slug === newVenueSlug) return // No hacer nada si ya está activo

      try {
        await switchVenueMutation.mutateAsync(newVenueSlug)
      } catch (error) {
        console.error('Fallo en la operación de switchVenue:', error)
        throw error
      }
    },
    [activeVenue?.slug, switchVenueMutation],
  )

  const checkVenueAccess = useCallback(
    (slugToCheck: string): boolean => {
      if (!user || !slugToCheck) return false

      // SUPERADMIN is global, but still constrained to existing venues.
      // OWNER and other roles are constrained to venues returned by backend access scope.
      const accessibleVenues = userRole === StaffRole.SUPERADMIN ? allVenues : (user.venues ?? [])
      return accessibleVenues.some(venue => venue.slug === slugToCheck)
    },
    [user, userRole, allVenues],
  )

  const authorizeVenue = useCallback(
    (slugToCheck: string): boolean => {
      const hasAccess = checkVenueAccess(slugToCheck)

      // Si tiene acceso y no tenemos un venue activo, o es diferente al actual,
      // actualizar el venue activo para evitar problemas de sincronización
      if (hasAccess && (!activeVenue || activeVenue.slug !== slugToCheck)) {
        const venueToActivate = getVenueBySlug(slugToCheck)
        if (venueToActivate) {
          setActiveVenue(venueToActivate)
        }
      }

      return hasAccess
    },
    [checkVenueAccess, activeVenue, getVenueBySlug, setActiveVenue],
  )

  // --- FUNCIÓN 'checkFeatureAccess' ---
  // Checks VenueFeature (billing features like ADVANCED_ANALYTICS, MULTI_LOCATION)
  const checkFeatureAccess = useCallback(
    (featureCode: string): boolean => {
      if (!activeVenue?.features) {
        return false
      }
      const feature = activeVenue.features.find(f => f.feature.code === featureCode)
      return feature?.active ?? false
    },
    [activeVenue?.features],
  )

  // --- FUNCIÓN 'checkModuleAccess' ---
  // Checks VenueModule (configurable modules like SERIALIZED_INVENTORY)
  const checkModuleAccess = useCallback(
    (moduleCode: string): boolean => {
      if (!activeVenue?.modules) {
        return false
      }
      const module = activeVenue.modules.find(m => m.module.code === moduleCode)
      return module?.enabled ?? false
    },
    [activeVenue?.modules],
  )

  // Show loading screen with retry info
  // FLASH FIX: Skip LoadingScreen in these cases:
  // 1. During logout (isLoggingOutRef) - prevents flash when clearing cache
  // 2. When session hint exists on mount - optimistic rendering for page reload
  //    The status query runs in background; if session is invalid, routing will redirect to login
  // 3. When on /login page - no need to show "verifying session" on login page
  const isOnLoginPage = location.pathname === '/login'
  const shouldSkipLoadingScreen = isLoggingOutRef.current || hasSessionHintOnMount.current || isOnLoginPage

  if ((isStatusLoading || isLiveDemoInitializing) && !shouldSkipLoadingScreen) {
    const retryMessage =
      isLiveDemoInitializing && retryCountRef.current > 0
        ? `Initializing live demo... (attempt ${retryCountRef.current + 1}/3)`
        : isLiveDemoInitializing
          ? 'Initializing live demo...'
          : t('common:verifying_session')
    console.log('[AUTH] 📊 SHOWING LoadingScreen with message:', retryMessage)
    return <LoadingScreen message={retryMessage} />
  }

  // Show error banner if live demo initialization failed
  if (liveDemoError && liveDemoService.isLiveDemoEnvironment()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full mx-4">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center space-y-4">
            <div className="text-destructive text-lg font-semibold">{t('auth:liveDemo.initFailed')}</div>
            <p className="text-muted-foreground">{liveDemoError}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              {t('common:retry')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const value: AuthContextType = {
    isAuthenticated,
    user,
    activeVenue,
    isLoading:
      isStatusLoading || isLiveDemoInitializing || loginMutation.isPending || signupMutation.isPending || switchVenueMutation.isPending,
    login: loginMutation.mutate,
    signup: async (data: SignupData) => {
      await signupMutation.mutateAsync(data)
    },
    loginWithGoogle,
    loginWithOneTap,
    logout,
    switchVenue,
    checkVenueAccess,
    authorizeVenue,
    checkFeatureAccess,
    checkModuleAccess,
    getVenueBySlug,
    getVenueBasePath,
    allVenues,
    staffInfo: { ...user, role: userRole },
    loginError,
    clearLoginError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
