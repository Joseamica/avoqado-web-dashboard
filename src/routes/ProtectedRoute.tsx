import { useAuth } from '@/context/AuthContext'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

export const ProtectedRoute = () => {
  const { user, isAuthenticated } = useAuth()

  const location = useLocation()

  if (!user && !isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
