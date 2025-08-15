import React, { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { LoadingScreen } from '@/components/spinner'
import { useToast } from '@/hooks/use-toast'
import * as authService from '@/services/auth.service'

const GoogleOAuthCallback: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code')
      const error = searchParams.get('error')

      if (error) {
        toast({
          title: 'Error de autenticación',
          variant: 'destructive',
          description: 'Se canceló la autenticación con Google',
        })
        navigate('/login', { replace: true })
        return
      }

      if (!code) {
        toast({
          title: 'Error de autenticación',
          variant: 'destructive',
          description: 'Código de autorización no encontrado',
        })
        navigate('/login', { replace: true })
        return
      }

      try {
        const result = await authService.googleOAuthCallback(code)
        
        // Success! Invalidate queries to refresh user state
        await queryClient.invalidateQueries({ queryKey: ['status'] })
        
        toast({
          title: result.message || 'Inicio de sesión exitoso',
          description: result.isNewUser ? 'Bienvenido! Tu cuenta ha sido creada.' : undefined,
        })

        // Navigate to home - AuthContext will handle the redirect
        navigate('/', { replace: true })
      } catch (error: any) {
        toast({
          title: 'Error de autenticación',
          variant: 'destructive',
          description: error.response?.data?.message || 'Error al autenticar con Google',
        })
        navigate('/login', { replace: true })
      }
    }

    handleCallback()
  }, [searchParams, navigate, queryClient, toast])

  return <LoadingScreen message="Autenticando con Google..." />
}

export default GoogleOAuthCallback