import api from '@/api'
import { LoadingScreen } from '@/components/spinner'
import { useToast } from '@/hooks/use-toast'
import { User } from '@/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

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
  const params = useParams()

  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  // Ref to track the last unauthorized venueId to prevent duplicate toasts
  const lastUnauthorizedVenueRef = useRef<string | null>(null)
  // Ref to track when the last toast was shown (to prevent rapid duplicate toasts)
  const lastToastTimeRef = useRef<number>(0)

  const { data, isLoading, error, isError, isSuccess } = useQuery({
    queryKey: ['status'],
    queryFn: async () => {
      const response = await api.get(`/v1/auth/status-v2`)
      return response.data
    },
    // refetchOnWindowFocus: true,
  })
  // Synchronize local state with fetched data
  useEffect(() => {
    if (isSuccess && data) {
      setIsAuthenticated(data.authenticated)
      setUser(data.user)
    } else if (data && !data.authenticated) {
      setIsAuthenticated(false)
      setUser(null)
    }
  }, [data, isSuccess])

  // Venue authorization functions
  const checkVenueAccess = (venueId: string): boolean => {
    if (!user || !venueId) return false
    return user.venues.some(venue => venue.id === venueId)
  }

  const authorizeVenue = (venueId: string): boolean => {
    if (!user || !venueId) return false

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
      queryClient.invalidateQueries({ queryKey: ['status'] }) // Refetch status if necessary
      setIsAuthenticated(true)
      setUser(response.data.user)
      const soleVenueId = response.data.user.userVenues[0].venueId
      navigate(`/venues/${soleVenueId}/home`, { replace: true })
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
      queryClient.clear()
      setIsAuthenticated(false)
      setUser(null)

      Object.keys(localStorage).forEach(key => {
        if (!key.startsWith('persist:')) {
          localStorage.removeItem(key)
        }
      })
      navigate('/login', { replace: true })
    },
    onError: error => {
      console.error('Error al cerrar sesión', error)
    },
  })
  const logout = () => {
    logoutMutation.mutate()
  }
  if (isLoading || !data) {
    return <LoadingScreen message="Partiendo la cuenta y el aguacate…" />
  }
  if (isError) {
    return <div>Error: {error.message}</div>
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        login,
        logout,
        user,
        isLoading,
        error,
        checkVenueAccess,
        authorizeVenue,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
