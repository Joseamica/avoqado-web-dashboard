import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { StaffRole } from '@/types'
import { LogOut } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

export const ProtectedRoute = () => {
  const { user, isAuthenticated, logout } = useAuth() || {}
  const location = useLocation()
  if (user?.role !== StaffRole.OWNER && user?.role !== StaffRole.SUPERADMIN && isAuthenticated && user?.venues.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center p-6 h-screen text-center bg-gray-100">
        <div className="p-8 w-full max-w-md bg-white rounded-lg shadow-lg">
          <h1 className="mb-4 text-2xl font-semibold text-gray-800">¡No tienes sucursales asignadas!</h1>
          <p className="mb-6 text-gray-600">Para comenzar a usar la plataforma, contacta al administrador para que te asigne uno.</p>

          <p className="mt-4 mb-4 text-sm text-gray-500">
            ¿Necesitas ayuda?{' '}
            <a href="/support" className="text-blue-600 underline hover:text-blue-700">
              Contáctanos
            </a>
          </p>
          <Button onClick={() => logout()}>
            <LogOut />
            Cerrar sesión
          </Button>
        </div>
      </div>
    )
  }
  if (!user && !isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
