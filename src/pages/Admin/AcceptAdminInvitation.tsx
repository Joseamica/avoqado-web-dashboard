import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/api'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, XCircle, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { themeClasses } from '@/lib/theme-utils'
import { useMutation } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

// Define a schema for password validation
const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .regex(/[A-Z]/, 'La contraseña debe contener al menos una letra mayúscula')
      .regex(/[a-z]/, 'La contraseña debe contener al menos una letra minúscula')
      .regex(/[0-9]/, 'La contraseña debe contener al menos un número'),
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

type PasswordFormValues = z.infer<typeof passwordSchema>

export default function AcceptAdminInvitation() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const { toast } = useToast()

  const [isVerifying, setIsVerifying] = useState(true)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // State for invitation data
  const [invitationData, setInvitationData] = useState<{
    token?: string
    venueName?: string
    email?: string
    name?: string
    needsPassword?: boolean
    isExistingUser?: boolean
  }>({})

  // Initialize form
  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  })

  // Mutation for verifying the invitation token
  const verifyInvitationMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await api.post('/v1/invitations/admin/verify', { token })
      return response.data
    },
    onSuccess: data => {
      setInvitationData(data.data)
      setIsVerifying(false)
    },
    onError: (error: any) => {
      console.error('Error verifying invitation:', error)
      setTokenError(error.response?.data?.message || 'Invitación inválida o expirada')
      setIsVerifying(false)
    },
  })

  // Mutation for accepting the invitation
  const acceptInvitationMutation = useMutation({
    mutationFn: async (data: { token: string; password?: string }) => {
      const response = await api.post('/v1/invitations/admin/accept', data)
      return response.data
    },
    onSuccess: data => {
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
          }),
        )
      }

      toast({
        title: '¡Invitación aceptada!',
        description: 'Has sido añadido como administrador exitosamente.',
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
        variant: 'destructive',
      })
    },
  })

  // Verify the token when component loads
  useEffect(() => {
    if (!token) {
      setTokenError('No se encontró un token de invitación válido')
      setIsVerifying(false)
      return
    }

    verifyInvitationMutation.mutate(token)
  }, [token])

  // Handle form submission for accepting invitation with password
  const onSubmit = (values: PasswordFormValues) => {
    if (!invitationData.token) return

    acceptInvitationMutation.mutate({
      token: invitationData.token,
      password: values.password,
    })
  }

  // Handle accepting invitation without password (for existing users with password)
  const handleAcceptInvitation = () => {
    if (!invitationData.token) return

    acceptInvitationMutation.mutate({
      token: invitationData.token,
    })
  }

  // Determine component state
  const isLoading = isVerifying || acceptInvitationMutation.isPending
  const hasError = tokenError || verifyInvitationMutation.isError || acceptInvitationMutation.isError
  const isSuccess = acceptInvitationMutation.isSuccess
  const errorMessage =
    tokenError ||
    (verifyInvitationMutation.error as any)?.response?.data?.message ||
    (acceptInvitationMutation.error as any)?.response?.data?.message ||
    'Ocurrió un error al procesar la invitación'

  const needsPassword = invitationData.needsPassword

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
              <p>{isVerifying ? 'Verificando invitación...' : 'Procesando solicitud...'}</p>
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
              <p className="text-sm text-gray-500 mb-4">
                Al aceptar esta invitación, tendrás acceso a gestionar este lugar en la plataforma Avoqado.
              </p>

              {needsPassword && (
                <div className="mt-6">
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3 mb-6">
                    <div className="flex items-start">
                      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mr-2 mt-0.5" />
                      <p className="text-sm text-amber-800 dark:text-amber-300">
                        {invitationData.isExistingUser
                          ? 'Tu cuenta existe pero necesitas definir una contraseña para continuar.'
                          : 'Necesitas crear una contraseña para tu nueva cuenta.'}
                      </p>
                    </div>
                  </div>

                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contraseña</FormLabel>
                            <div className="relative">
                              <FormControl>
                                <Input type={showPassword ? 'text' : 'password'} placeholder="Ingresa tu nueva contraseña" {...field} />
                              </FormControl>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirmar Contraseña</FormLabel>
                            <div className="relative">
                              <FormControl>
                                <Input type={showConfirmPassword ? 'text' : 'password'} placeholder="Confirma tu contraseña" {...field} />
                              </FormControl>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              >
                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="pt-2">
                        <Button type="submit" className="w-full" disabled={acceptInvitationMutation.isPending}>
                          {acceptInvitationMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Procesando...
                            </>
                          ) : (
                            'Definir contraseña y aceptar'
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </div>
              )}
            </div>
          )}
        </CardContent>

        {!isLoading && !hasError && !isSuccess && !needsPassword && (
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => window.close()}>
              Cancelar
            </Button>
            <Button onClick={handleAcceptInvitation} disabled={acceptInvitationMutation.isPending}>
              {acceptInvitationMutation.isPending ? (
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

        {needsPassword && (
          <CardFooter>
            <Button variant="outline" className="w-full" onClick={() => window.close()}>
              Cancelar
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
