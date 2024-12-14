import api from '@/api'
import { useToast } from '@/hooks/use-toast'
import { User } from '@/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// Define the shape of the auth context
interface AuthContextType {
  isAuthenticated: boolean

  login: (data: { email: string; password: string }) => void
  logout: () => void
  user: User | null
  isLoading: boolean
  error: any
}

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,

  login: () => {},
  logout: () => {},
  user: null,
  isLoading: false,
  error: null,
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

  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)

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

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => api.post(`/v1/auth/login`, { email, password }),
    onSuccess: response => {
      console.log('response', response)
      queryClient.invalidateQueries({ queryKey: ['status'] }) // Refetch status if necessary
      setIsAuthenticated(true)
      setUser(response.data.user)
      const soleVenueId = response.data.user.userVenues[0].venueId
      navigate(`/venues/${soleVenueId}/home`)
      toast({ title: 'Login successful!' })
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
      navigate('/login')
    },
    onError: error => {
      console.error('Error al cerrar sesión', error)
    },
  })
  const logout = () => {
    logoutMutation.mutate()
    setIsAuthenticated(false)
  }
  if (isLoading || !data) {
    return <div>Loading...</div>
  }
  if (isError) {
    return <div>Error: {error.message}</div>
  }

  return <AuthContext.Provider value={{ isAuthenticated, login, logout, user, isLoading, error }}>{children}</AuthContext.Provider>
}
