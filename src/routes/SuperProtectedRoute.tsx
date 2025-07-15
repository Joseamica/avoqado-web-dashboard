import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { StaffRole } from '@/types'
import { LogOut } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

export const SuperProtectedRoute = ({ allowedRoles }: { allowedRoles?: StaffRole[] }) => {
  const { user, isAuthenticated, logout } = useAuth()
  const location = useLocation()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Si el usuario no tiene el rol requerido, mostrar un mensaje de error dentro del layout
  // Nota: para compatibilidad con código antiguo, convertimos el rol del user a StaffRole si es necesario
  if (allowedRoles && !allowedRoles.includes(user.role as StaffRole)) {
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
