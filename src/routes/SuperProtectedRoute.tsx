import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { LogOut } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

export const SuperProtectedRoute = ({ allowedRoles }: { allowedRoles?: string[] }) => {
  const { user, isAuthenticated, logout } = useAuth()
  const location = useLocation()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // If the user does not have the required role, show an error message inside the layout
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-gray-100 rounded-xl">
        <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
          <h1 className="mb-4 text-2xl font-semibold text-gray-800">Acceso restringido</h1>
          <p className="mb-6 text-gray-600">No tienes permiso para acceder a esta sección.</p>
          <Button onClick={() => logout()}>
            <LogOut className="mr-2" />
            Cerrar sesión
          </Button>
        </div>
      </div>
    )
  }

  return <Outlet />
}
