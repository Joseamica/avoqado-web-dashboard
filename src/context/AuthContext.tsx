/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import * as authService from '@/services/auth.service'
import { clearAllChatStorage } from '@/services/chatService'
import { LoadingScreen } from '@/components/spinner'
import { useToast } from '@/hooks/use-toast'
import { User, Venue, StaffRole } from '@/types'

// Tipos y la Interfaz del Contexto
type LoginData = { email: string; password: string; venueSlug?: string }

interface AuthContextType {
  isAuthenticated: boolean
  user: User | null
  activeVenue: Venue | null
  isLoading: boolean
  login: (data: LoginData) => void
  loginWithGoogle: () => Promise<void>
  logout: () => void
  switchVenue: (newVenueSlug: string) => Promise<void> // Para cambiar de venue por slug
  authorizeVenue: (venueSlug: string) => boolean
  checkVenueAccess: (venueSlug: string) => boolean
  checkFeatureAccess: (featureCode: string) => boolean
  getVenueBySlug: (slug: string) => Venue | null // Nueva función para obtener venue por slug
  allVenues: Venue[]
  staffInfo: any | null
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
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { slug } = useParams<{ slug: string }>()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [activeVenue, setActiveVenue] = useState<Venue | null>(null)

  const { data: statusData, isLoading: isStatusLoading } = useQuery({
    queryKey: ['status'],
    queryFn: authService.getAuthStatus,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const isAuthenticated = !!statusData?.authenticated
  const user = statusData?.user || null

  const userRole = useMemo(() => {
    if (user?.role === StaffRole.SUPERADMIN) return StaffRole.SUPERADMIN
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
      navigate('/venues/new', { replace: true })
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
      toast({ title: t('auth.toast.login_success') })
      queryClient.invalidateQueries({ queryKey: ['status'] })
    },
    onError: (error: any) => {
      toast({
        title: t('auth.toast.login_error_title'),
        variant: 'destructive',
        description: error.response?.data?.message || t('auth.toast.login_error_desc'),
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
          toast({ title: t('auth.toast.switched_to_venue', { name: newVenue.name }) })

          // Navegar a la página correspondiente del nuevo venue
          const currentPath = location.pathname
          const newPath = currentPath.replace(/venues\/[^/]+/, `venues/${newVenueSlug}`)
          navigate(newPath, { replace: true })
        }
      })
    },
    onError: (error: any) => {
      toast({
        title: t('auth.toast.switch_venue_error_title'),
        variant: 'destructive',
        description: error.response?.data?.message || t('auth.toast.switch_venue_error_desc'),
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
        title: t('auth.toast.auth_error_title'),
        variant: 'destructive',
        description: error.response?.data?.message || t('auth.toast.google_login_error_desc'),
      })
      throw error
    }
  }, [toast, t])

  // --- FUNCIONES EXPUESTAS ---

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

  if (isStatusLoading) {
    return <LoadingScreen message={t('common.verifying_session')} />
  }

  const value: AuthContextType = {
    isAuthenticated,
    user,
    activeVenue,
    isLoading: isStatusLoading || loginMutation.isPending || logoutMutation.isPending || switchVenueMutation.isPending,
    login: loginMutation.mutate,
    loginWithGoogle,
    logout: logoutMutation.mutate,
    switchVenue,
    checkVenueAccess,
    authorizeVenue,
    checkFeatureAccess,
    getVenueBySlug,
    allVenues,
    staffInfo: { ...user, role: userRole },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
