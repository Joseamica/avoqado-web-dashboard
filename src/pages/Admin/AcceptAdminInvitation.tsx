import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/api'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, XCircle, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'

export default function AcceptAdminInvitation() {
  const { t } = useTranslation()

  // Define a schema for password validation with i18n
  const passwordSchema = z
    .object({
      password: z
        .string()
        .min(8, t('adminInvitation.validation.passwordMin'))
        .regex(/[A-Z]/, t('adminInvitation.validation.passwordUppercase'))
        .regex(/[a-z]/, t('adminInvitation.validation.passwordLowercase'))
        .regex(/[0-9]/, t('adminInvitation.validation.passwordNumber')),
      confirmPassword: z.string(),
    })
    .refine(data => data.password === data.confirmPassword, {
      message: t('adminInvitation.validation.passwordsMismatch'),
      path: ['confirmPassword'],
    })

  type PasswordFormValues = z.infer<typeof passwordSchema>
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
      setTokenError(error.response?.data?.message || t('adminInvitation.invalidToken'))
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
        title: t('adminInvitation.invitationAccepted'),
        description: t('adminInvitation.invitationAcceptedDesc'),
      })

      // Redirect after a short delay
      setTimeout(() => {
        navigate('/venues')
      }, 2000)
    },
    onError: (error: any) => {
      console.error('Error accepting invitation:', error)
      toast({
        title: t('adminInvitation.error'),
        description: error.response?.data?.message || t('adminInvitation.processingError'),
        variant: 'destructive',
      })
    },
  })

  // Verify the token when component loads
  useEffect(() => {
    if (!token) {
      setTokenError(t('adminInvitation.noToken'))
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
    t('adminInvitation.processingError')

  const needsPassword = invitationData.needsPassword

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">{t('adminInvitation.title')}</CardTitle>
          <CardDescription>{invitationData.email && <>{t('adminInvitation.subtitle')}</>}</CardDescription>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p>{isVerifying ? t('adminInvitation.verifying') : t('adminInvitation.processing')}</p>
            </div>
          ) : hasError ? (
            <div className="flex flex-col items-center justify-center py-8 text-red-600">
              <XCircle className="h-12 w-12 mb-4" />
              <p className="text-center">{errorMessage}</p>
            </div>
          ) : isSuccess ? (
            <div className="flex flex-col items-center justify-center py-8 text-green-600">
              <CheckCircle className="h-12 w-12 mb-4" />
              <p className="text-center">{t('adminInvitation.accountActivated')}</p>
              <p className="text-center text-sm text-muted-foreground mt-2">{t('adminInvitation.redirecting')}</p>
            </div>
          ) : (
            <div className="py-4">
              <p className="mb-4">
                {t('adminInvitation.youHaveBeenInvited')}
                {invitationData.venueName && (
                  <span>
                    {' '}
                    {t('adminInvitation.of')} <strong>{invitationData.venueName}</strong>
                  </span>
                )}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {t('adminInvitation.acceptDescription')}
              </p>

              {needsPassword && (
                <div className="mt-6">
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3 mb-6">
                    <div className="flex items-start">
                      <AlertCircle className="h-5 w-5 text-amber-500 mr-2 mt-0.5" />
                      <p className="text-sm text-amber-400">
                        {invitationData.isExistingUser
                          ? t('adminInvitation.existingUserNeedsPassword')
                          : t('adminInvitation.newUserNeedsPassword')}
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
                            <FormLabel>{t('adminInvitation.password')}</FormLabel>
                            <div className="relative">
                              <FormControl>
                                <Input type={showPassword ? 'text' : 'password'} placeholder={t('adminInvitation.passwordPlaceholder')} {...field} />
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
                            <FormLabel>{t('adminInvitation.confirmPassword')}</FormLabel>
                            <div className="relative">
                              <FormControl>
                                <Input type={showConfirmPassword ? 'text' : 'password'} placeholder={t('adminInvitation.confirmPasswordPlaceholder')} {...field} />
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
                              {t('adminInvitation.processing')}
                            </>
                          ) : (
                            t('adminInvitation.setPasswordAndAccept')
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
              {t('adminInvitation.cancel')}
            </Button>
            <Button onClick={handleAcceptInvitation} disabled={acceptInvitationMutation.isPending}>
              {acceptInvitationMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('adminInvitation.processing')}
                </>
              ) : (
                t('adminInvitation.acceptInvitation')
              )}
            </Button>
          </CardFooter>
        )}

        {needsPassword && (
          <CardFooter>
            <Button variant="outline" className="w-full" onClick={() => window.close()}>
              {t('adminInvitation.cancel')}
            </Button>
          </CardFooter>
        )}

        {hasError && (
          <CardFooter>
            <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
              {t('adminInvitation.goToLogin')}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
