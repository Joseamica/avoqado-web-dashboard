import api from '@/api'
import { LoadingScreen } from '@/components/spinner'
import { useToast } from '@/hooks/use-toast'
import { User, Venue } from '@/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// Define the shape of the auth context
interface AuthContextType {
  isAuthenticated: boolean
  login: (data: { email: string; password: string }) => void
  logout: () => void
  user: User | null
  isLoading: boolean
  error: any
  checkVenueAccess: (venueId: string) => boolean
  authorizeVenue: (venueId: string) => boolean
  allVenues: Venue[]
}

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
  user: null,
  isLoading: false,
  error: null,
  checkVenueAccess: () => false,
  authorizeVenue: () => false,
  allVenues: [],
})

// Custom hook to use the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
// Provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()


  const [allVenues, setAllVenues] = useState<Venue[]>([])
  // Ref to track the last unauthorized venueId to prevent duplicate toasts
  const lastUnauthorizedVenueRef = useRef<string | null>(null)
  // Ref to track when the last toast was shown (to prevent rapid duplicate toasts)
  const lastToastTimeRef = useRef<number>(0)

  const statusQuery = useQuery({
    staleTime: 5 * 60 * 1000, // 5 minutes, prevent refetch on mount if data is fresh
    gcTime: 10 * 60 * 1000,   // 10 minutes
    // refetchOnWindowFocus: true, // Keep if desired, but not the primary fix here
    queryKey: ['status'],
    queryFn: async () => {
      const response = await api.get(`/v1/auth/status-v2`);
      return response.data; // Expected: { authenticated: boolean, user: User | null, ... }
    },
  });

  // Derive auth state directly from the query result
  const isAuthenticated = !!statusQuery.data?.authenticated;
  const user = statusQuery.data?.user || null;

  // Fetch all venues if user is SUPERADMIN
  const { data: allVenuesData, isSuccess: allVenuesSuccess } = useQuery({
    queryKey: ['allVenues'],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/venues`)
      return response.data
    },
    enabled: !!user && user.role === 'SUPERADMIN', // This 'user' will now be the derived one
  })

  // useEffect for setting isAuthenticated and user from statusQuery is no longer needed.

  // Update allVenues when data is fetched
  useEffect(() => {
    if (allVenuesSuccess && allVenuesData) {
      setAllVenues(allVenuesData)
    }
  }, [allVenuesData, allVenuesSuccess])

  // Venue authorization functions
  const checkVenueAccess = (venueId: string): boolean => {
    if (!user || !venueId) return false

    // SUPERADMIN can access all venues
    if (user.role === 'SUPERADMIN') return true

    return user.venues.some(venue => venue.id === venueId)
  }

  const authorizeVenue = (venueId: string): boolean => {
    if (!user || !venueId) return false

    // SUPERADMIN can access all venues
    if (user.role === 'SUPERADMIN') return true

    const hasAccess = user.venues.some(venue => venue.id === venueId)

    if (!hasAccess) {
      // Check if we've already shown a toast for this venue recently
      const now = Date.now()
      const isDuplicate = lastUnauthorizedVenueRef.current === venueId && now - lastToastTimeRef.current < 2000 // 2 second debounce

      if (!isDuplicate) {
        // Redirect to default venue if user doesn't have access
        const defaultVenue = user.venues[0]
        if (defaultVenue) {
          // Update refs for debouncing
          lastUnauthorizedVenueRef.current = venueId
          lastToastTimeRef.current = now

          toast({
            title: 'Acceso no autorizado',
            description: 'No tienes permiso para acceder a esa sucursal.',
            variant: 'destructive',
          })

          // Create updated path by replacing the venue ID
          const currentPath = window.location.pathname
          const updatedPath = currentPath.replace(/venues\/[^/]+/, `venues/${defaultVenue.id}`)

          // Navigate to default venue
          navigate(updatedPath, { replace: true })
        }
      }
      return false
    }

    // Reset the unauthorized venue tracking when accessing an authorized venue
    lastUnauthorizedVenueRef.current = null

    return true
  }

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => api.post(`/v1/auth/login`, { email, password }),
    onSuccess: response => {
      // User and isAuthenticated state will be updated automatically when 'status' query refetches
      queryClient.invalidateQueries({ queryKey: ['status'] });

      if (response.data.user.role === 'SUPERADMIN') {
        navigate('/venues', { replace: true })
      } else {
        const soleVenueId = response.data.user.userVenues[0].venueId
        navigate(`/venues/${soleVenueId}/home`, { replace: true })
      }
      toast({ title: 'Haz iniciado sesión correctamente.' })
    },
    onError: (error: any) => {
      console.error('Login failed:', error.response.data.message)
      toast({ title: 'Login failed', variant: 'destructive', description: error.response.data.message })
      // Optionally, handle error (e.g., show a toast)
    },
  })

  const login = (data: { email: string; password: string }) => {
    loginMutation.mutate(data)
  }

  const logoutMutation = useMutation({
    mutationFn: () => api.post('/v1/auth/logout'),
    onSuccess: () => {
      queryClient.clear(); // Clear cache first
      queryClient.invalidateQueries({ queryKey: ['status'] }); // Then invalidate to refetch and update derived state

      Object.keys(localStorage).forEach(key => {
        if (!key.startsWith('persist:')) {
          localStorage.removeItem(key)
        }
      })
      navigate('/login', { replace: true })
      toast({ title: 'Haz cerrado sesión correctamente.' })
    },
    onError: error => {
      console.error('Error al cerrar sesión', error)
    },
  })
  const logout = () => {
    logoutMutation.mutate()
  }
  // Main loading condition for the auth context provider
  if (statusQuery.isLoading) {
    return <LoadingScreen message="Partiendo la cuenta y el aguacate…" />
  }
  if (statusQuery.isError) {
    // Consider how to handle auth status errors. For now, showing error message.
    // Alternatively, treat as logged out: isAuthenticated will be false, user null.
    return <div>Error: {statusQuery.error.message}</div>;
  }
  // If not loading and not error, statusQuery.data should be available (even if it means user is not authenticated)
  // If statusQuery.data is undefined (e.g. queryFn returned undefined successfully), 
  // isAuthenticated will be false and user null, which is a valid logged-out state.

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated, // Directly derived
        login,
        logout,
        user,            // Directly derived
        isLoading: loginMutation.isPending || logoutMutation.isPending, // Use isPending for mutations
        error: loginMutation.error || logoutMutation.error, 
        checkVenueAccess,
        authorizeVenue,
        allVenues,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
