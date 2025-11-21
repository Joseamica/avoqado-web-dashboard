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
  signup: (data: SignupData) => void
  loginWithGoogle: () => Promise<void>
  loginWithOneTap: (credential: string) => Promise<void>
  logout: () => void
  switchVenue: (newVenueSlug: string) => Promise<void> // Para cambiar de venue por slug
  authorizeVenue: (venueSlug: string) => boolean
  checkVenueAccess: (venueSlug: string) => boolean
  checkFeatureAccess: (featureCode: string) => boolean
  getVenueBySlug: (slug: string) => Venue | null // Nueva función para obtener venue por slug
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

  // Get auth status first
  const { data: statusData, isLoading: isStatusLoading } = useQuery({
    queryKey: ['status'],
    queryFn: authService.getAuthStatus,
    staleTime: 5 * 60 * 1000,
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
        queryClient.invalidateQueries({ queryKey: ['status'] })
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
    // World-Class Pattern: Use role field directly if present (for OWNER without venues, SUPERADMIN, etc.)
    if (user?.role) return user.role

    // Fallback: Derive role from venues (for backwards compatibility)
    return user?.venues?.some(v => v.role === StaffRole.OWNER) ? StaffRole.OWNER : user?.venues?.[0]?.role
  }, [user?.role, user?.venues])

  const allVenues = useMemo(
    () => (user?.role === 'SUPERADMIN' || userRole === StaffRole.OWNER ? statusData?.allVenues : user?.venues) ?? [],
    [user, userRole, statusData?.allVenues],
  )

  // Función para obtener venue por slug
  const getVenueBySlug = useCallback(
    (slug: string): Venue | null => {
      return allVenues.find(venue => venue.slug === slug) || null
    },
    [allVenues],
  )

  // Efecto para sincronizar el venue activo y manejar redirecciones
  useEffect(() => {
    if (isStatusLoading || !isAuthenticated || !user) return

    const userVenues = user.venues || []

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
    if (userVenues.length > 0 || user.role === 'SUPERADMIN') {
      const defaultVenue = userVenues[0] || allVenues[0] // Use first available venue for SUPERADMIN

      // Redirigir desde rutas base a la home del venue por defecto (unless SUPERADMIN going to /superadmin)
      if (location.pathname === '/' || location.pathname === '/login') {
        if (user.role === 'SUPERADMIN') {
          navigate('/superadmin', { replace: true })
        } else {
          navigate(`/venues/${defaultVenue.slug}/home`, { replace: true })
        }
        return
      }

      // Si hay venueSlug en la URL, buscar el venue correspondiente
      if (slug) {
        const venueFromSlug = userVenues.find((v: any) => v.slug === slug)

        if (venueFromSlug) {
          // Si encontramos el venue y no es el activo, actualizarlo
          if (activeVenue?.id !== venueFromSlug.id) {
            setActiveVenue(venueFromSlug)
          }
        } else {
          // Si el slug no corresponde a ningún venue del usuario, redirigir al default
          navigate(`/venues/${defaultVenue.slug}/home`, { replace: true })
        }
      } else if (!slug && activeVenue) {
        // Si no hay slug en la URL pero hay venue activo, usar el activo para la navegación
        const currentPath = location.pathname
        // Don't redirect if user is on superadmin or admin routes
        const isOnAdminRoute = currentPath.startsWith('/superadmin') || currentPath.startsWith('/admin')
        if (!currentPath.includes('/venues/') && !isOnAdminRoute) {
          navigate(`/venues/${activeVenue.slug}/home`, { replace: true })
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
    navigate,
    activeVenue?.id,
    getVenueBySlug,
    activeVenue,
    allVenues,
    userRole,
  ])

  // --- MUTACIONES ---
  const loginMutation = useMutation({
    mutationFn: (credentials: LoginData) => authService.login(credentials),
    onSuccess: () => {
      toast({ title: t('toast.login_success') })
      queryClient.invalidateQueries({ queryKey: ['status'] })
      setLoginError(null) // Clear any previous login errors
    },
    onError: (error: any, variables) => {
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

  const logoutMutation = useMutation({
    mutationFn: authService.logout,
    onSuccess: () => {
      clearAllChatStorage()
      queryClient.clear()
      setActiveVenue(null)
      navigate('/login', { replace: true })
    },
  })

  const switchVenueMutation = useMutation({
    mutationFn: (newVenueSlug: string) => {
      // Obtener el ID del venue por el slug para el servicio
      const targetVenue = getVenueBySlug(newVenueSlug)
      if (!targetVenue) {
        throw new Error(`Venue con slug '${newVenueSlug}' no encontrado`)
      }
      return authService.switchVenue(targetVenue.id)
    },
    onSuccess: (data, newVenueSlug) => {
      // Forzar la recarga del estado de autenticación para obtener el nuevo token/sesión
      queryClient.invalidateQueries({ queryKey: ['status'] }).then(() => {
        const newVenue = getVenueBySlug(newVenueSlug)
        if (newVenue) {
          setActiveVenue(newVenue)
          toast({ title: t('toast.switched_to_venue', { name: newVenue.name }) })

          // Navegar a la página correspondiente del nuevo venue
          const currentPath = location.pathname
          const newPath = currentPath.replace(/venues\/[^/]+/, `venues/${newVenueSlug}`)
          navigate(newPath, { replace: true })
        }
      })
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
  const loginWithOneTap = useCallback(async (credential: string): Promise<void> => {
    try {
      await authService.googleOneTapLogin(credential)

      // Refetch auth status to update user state
      queryClient.invalidateQueries({ queryKey: ['status'] })

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
  }, [toast, t, queryClient])

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
      if (!user) return false
      if (userRole === StaffRole.SUPERADMIN) return true // SUPERADMIN can access all venues
      if (userRole === StaffRole.OWNER) return true // OWNER can access all venues in their organization
      return user.venues.some(venue => venue.slug === slugToCheck)
    },
    [user, userRole],
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
  const checkFeatureAccess = useCallback(
    (featureCode: string): boolean => {
      if (!activeVenue?.features) {
        return false // Si no hay 'features' en el venue activo, no hay acceso
      }
      // La estructura es un array de { feature: { code: string }, active: boolean }
      const feature = activeVenue.features.find(f => f.feature.code === featureCode)
      return feature?.active ?? false // Devuelve true solo si la feature existe Y está activa
    },
    [activeVenue],
  )

  // Show loading screen with retry info
  if (isStatusLoading || isLiveDemoInitializing) {
    const retryMessage =
      isLiveDemoInitializing && retryCountRef.current > 0
        ? `Initializing live demo... (attempt ${retryCountRef.current + 1}/3)`
        : isLiveDemoInitializing
        ? 'Initializing live demo...'
        : t('common:verifying_session')
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
      isStatusLoading ||
      isLiveDemoInitializing ||
      loginMutation.isPending ||
      signupMutation.isPending ||
      logoutMutation.isPending ||
      switchVenueMutation.isPending,
    login: loginMutation.mutate,
    signup: signupMutation.mutate,
    loginWithGoogle,
    loginWithOneTap,
    logout: logoutMutation.mutate,
    switchVenue,
    checkVenueAccess,
    authorizeVenue,
    checkFeatureAccess,
    getVenueBySlug,
    allVenues,
    staffInfo: { ...user, role: userRole },
    loginError,
    clearLoginError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
