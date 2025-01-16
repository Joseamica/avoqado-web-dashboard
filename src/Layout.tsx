import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { LogOut } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'

export function Layout() {
  const { isAuthenticated, logout, user, isLoading } = useAuth()

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />
  }

  if (isAuthenticated && user.venues.length >= 1) {
    return <Navigate to={`/venues/${user.venues[0].id}/home`} />
  }

  if (isAuthenticated && user.venues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-6 text-center bg-gray-100">
        <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
          <h1 className="mb-4 text-2xl font-semibold text-gray-800">¡No Tienes Sucursales Asignados!</h1>
          <p className="mb-6 text-gray-600">
            Para comenzar a usar la plataforma, crea un venue o contacta al administrador para que te asigne uno.
          </p>

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

  return (
    <div>
      <h1>Test Page</h1>
      {isAuthenticated ? <h2>Authenticated</h2> : <h2>Not Authenticated</h2>}

      <Link to="/login">Login</Link>
      <Button variant="outline" onClick={() => logout()}>
        logout
      </Button>
    </div>
  )
}
