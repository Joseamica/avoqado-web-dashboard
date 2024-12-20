import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Link, Navigate } from 'react-router-dom'

export function Test() {
  const { toast } = useToast()
  const { isAuthenticated, logout } = useAuth()

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
