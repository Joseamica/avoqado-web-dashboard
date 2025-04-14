import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { ThemeToggle } from '@/components/ThemeToggle'
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
      <div className="flex flex-col items-center justify-center h-screen p-6 text-center bg-gray-100 dark:bg-gray-900">
        <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg dark:bg-gray-800 dark:text-white">
          <div className="absolute top-4 right-4">
            <ThemeToggle />
          </div>
          <h1 className="mb-4 text-2xl font-semibold text-gray-800 dark:text-white">¡No Tienes Sucursales Asignados!</h1>
          <p className="mb-6 text-gray-600 dark:text-gray-300">
            Para comenzar a usar la plataforma, crea un venue o contacta al administrador para que te asigne uno.
          </p>

          <p className="mt-4 mb-4 text-sm text-gray-500 dark:text-gray-400">
            ¿Necesitas ayuda?{' '}
            <a href="/support" className="text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
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
    <div className="p-4 dark:bg-gray-900 dark:text-white">
      <div className="flex justify-between items-center mb-4">
        <h1>Test Page</h1>
        <ThemeToggle />
      </div>
      {isAuthenticated ? <h2>Authenticated</h2> : <h2>Not Authenticated</h2>}

      <Link to="/login" className="mr-4">
        Login
      </Link>
      <Button variant="outline" onClick={() => logout()}>
        logout
      </Button>
    </div>
  )
}
