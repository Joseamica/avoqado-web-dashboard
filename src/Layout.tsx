import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LogOut } from 'lucide-react'
import { Link, Navigate, useLocation } from 'react-router-dom'

export function Layout() {
  const { isAuthenticated, logout, user, isLoading } = useAuth()

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />
  }

  // This component is only used for the root "/" path now
  // Always redirect authenticated users to their first venue (unless SUPERADMIN)
  if (isAuthenticated && user.venues.length >= 1 && user.role !== 'SUPERADMIN') {
    return <Navigate to={`/venues/${user.venues[0].slug}/home`} />
  }

  // SUPERADMIN users should go to superadmin dashboard by default
  if (isAuthenticated && user.role === 'SUPERADMIN') {
    return <Navigate to="/superadmin" />
  }

  if (user.role !== 'SUPERADMIN' && isAuthenticated && user.venues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-6 text-center bg-background">
        <div className="w-full max-w-md p-8 bg-card rounded-lg shadow-lg text-card-foreground">
          <div className="absolute top-4 right-4">
            <ThemeToggle />
          </div>
          <h1 className="mb-4 text-2xl font-semibold text-foreground">¡No Tienes Sucursales Asignados!</h1>
          <p className="mb-6 text-muted-foreground">
            Para comenzar a usar la plataforma, crea un venue o contacta al administrador para que te asigne uno.
          </p>

          <p className="mt-4 mb-4 text-sm text-muted-foreground">
            ¿Necesitas ayuda?{' '}
            <a href="/support" className="text-primary underline hover:text-primary/80">
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
    <div className="p-4 bg-background text-foreground">
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
