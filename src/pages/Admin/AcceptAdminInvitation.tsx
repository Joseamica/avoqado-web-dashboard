import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/api'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { themeClasses } from '@/lib/theme-utils'
import { useMutation } from '@tanstack/react-query'

export default function AcceptAdminInvitation() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const { toast } = useToast()
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [invitationData, setInvitationData] = useState<{
    venueName?: string
    email?: string
  }>({})

  // Mutation for accepting the invitation
  const acceptInvitationMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await api.post('/v2/dashboard/accept-admin-invitation', { token })
      return response.data
    },
    onSuccess: (data) => {
      // Store auth tokens
      if (data.data.authToken && data.data.refreshToken) {
        localStorage.setItem('authToken', data.data.authToken)
        localStorage.setItem('refreshToken', data.data.refreshToken)

        // Store user info
        localStorage.setItem(
          'user',
          JSON.stringify({
            id: data.data.id,
            name: data.data.name,
            email: data.data.email,
            role: data.data.role,
          })
        )
      }

      toast({
        title: '¡Invitación aceptada!',
        description: 'Has sido añadido como administrador exitosamente.'
      })

      // Redirect after a short delay
      setTimeout(() => {
        navigate('/venues')
      }, 2000)
    },
    onError: (error: any) => {
      console.error('Error accepting invitation:', error)
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Ocurrió un error al procesar la invitación',
        variant: 'destructive'
      })
    }
  })

  // Process the invitation token when component loads
  useEffect(() => {
    if (!token) {
      setTokenError('No se encontró un token de invitación válido')
      return
    }

    // Try to decode the token locally to show some information
    // Note: This is just for UI purposes, actual verification happens on the server
    try {
      const tokenData = JSON.parse(atob(token.split('.')[1]))
      setInvitationData({
        email: tokenData.email,
        venueName: tokenData.venueName || 'este lugar',
      })
    } catch (e) {
      console.error('Error decoding token:', e)
      setTokenError('Token de invitación inválido')
    }
  }, [token])

  // Handle the invitation acceptance
  const handleAcceptInvitation = () => {
    if (!token) return
    acceptInvitationMutation.mutate(token)
  }

  // Determine component state
  const isLoading = acceptInvitationMutation.isPending
  const hasError = tokenError || acceptInvitationMutation.isError
  const isSuccess = acceptInvitationMutation.isSuccess
  const errorMessage = tokenError || 
    (acceptInvitationMutation.error as any)?.response?.data?.message || 
    'Ocurrió un error al procesar la invitación'

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Invitación para Administrador</CardTitle>
          <CardDescription>{invitationData.email && <>Has sido invitado como administrador de Avoqado</>}</CardDescription>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p>Verificando invitación...</p>
            </div>
          ) : hasError ? (
            <div className={`flex flex-col items-center justify-center py-8 ${themeClasses.error.text}`}>
              <XCircle className="h-12 w-12 mb-4" />
              <p className="text-center">{errorMessage}</p>
            </div>
          ) : isSuccess ? (
            <div className={`flex flex-col items-center justify-center py-8 ${themeClasses.success.text}`}>
              <CheckCircle className="h-12 w-12 mb-4" />
              <p className="text-center">¡Tu cuenta ha sido activada exitosamente!</p>
              <p className="text-center text-sm text-gray-500 mt-2">Serás redirigido en un momento...</p>
            </div>
          ) : (
            <div className="py-4">
              <p className="mb-4">
                Has recibido una invitación para unirte como administrador
                {invitationData.venueName && (
                  <span>
                    {' '}
                    de <strong>{invitationData.venueName}</strong>
                  </span>
                )}
              </p>
              <p className="text-sm text-gray-500">
                Al aceptar esta invitación, tendrás acceso a gestionar este lugar en la plataforma Avoqado.
              </p>
            </div>
          )}
        </CardContent>

        {!isLoading && !hasError && !isSuccess && (
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => window.close()}>
              Cancelar
            </Button>
            <Button onClick={handleAcceptInvitation} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                'Aceptar Invitación'
              )}
            </Button>
          </CardFooter>
        )}

        {hasError && (
          <CardFooter>
            <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
              Ir al inicio de sesión
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
