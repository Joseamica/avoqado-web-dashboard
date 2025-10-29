import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { ThemeToggle } from '@/components/theme-toggle'
import LanguageSwitcher from '@/components/language-switcher'
import { EmailVerificationForm } from './components/EmailVerificationForm'
import * as authService from '@/services/auth.service'
import api from '@/api'

export default function EmailVerification() {
  const { t } = useTranslation(['auth', 'common'])
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const emailFromUrl = searchParams.get('email')

  const [userEmail, setUserEmail] = useState<string>('')
  const [isResending, setIsResending] = useState(false)

  // Check if user is logged in and get their email
  const { data: statusData, isLoading: isCheckingAuth } = useQuery({
    queryKey: ['status'],
    queryFn: authService.getAuthStatus,
    retry: false,
  })

  const isAuthenticated = !!statusData?.authenticated
  const currentUser = statusData?.user

  // Mutation to resend verification code
  const resendCodeMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await api.post('/api/v1/onboarding/resend-verification', { email })
      return response.data
    },
    onSuccess: () => {
      toast({
        title: t('verification.resendSuccess'),
        description: t('verification.resendSuccessDescription'),
      })
      setIsResending(false)
    },
    onError: (error: any) => {
      toast({
        title: t('common:error'),
        description: error.response?.data?.message || t('verification.resendError'),
        variant: 'destructive',
      })
      setIsResending(false)
    },
  })

  // Determine which email to use
  useEffect(() => {
    if (emailFromUrl) {
      setUserEmail(emailFromUrl)
    } else if (currentUser?.email) {
      setUserEmail(currentUser.email)
    }
  }, [emailFromUrl, currentUser])

  // Redirect if already verified
  useEffect(() => {
    if (isAuthenticated && currentUser?.emailVerified) {
      toast({
        title: t('verification.alreadyVerified'),
        description: t('verification.alreadyVerifiedDescription'),
      })
      navigate('/')
    }
  }, [isAuthenticated, currentUser, navigate, toast, t])

  const handleResendCode = () => {
    if (!userEmail) return
    setIsResending(true)
    resendCodeMutation.mutate(userEmail)
  }

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">{t('common:loading')}</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!userEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/50">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle>{t('verification.noEmailTitle')}</CardTitle>
            <CardDescription>{t('verification.noEmailDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/signup')} className="w-full">
              {t('verification.goToSignup')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      {/* Left Side - Form */}
      <div className="flex w-full flex-col items-center justify-center px-4 py-12 lg:w-1/2">
        <div className="absolute top-4 right-4 flex gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md space-y-6">
          <div className="text-center mb-6">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/50">
              <Mail className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold">{t('verification.standalonTitle')}</h1>
            <p className="text-muted-foreground text-sm mt-2">
              {t('verification.standaloneSubtitle')}
            </p>
          </div>

          <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              {t('verification.checkEmailNote')} <strong>{userEmail}</strong>
            </AlertDescription>
          </Alert>

          <EmailVerificationForm email={userEmail} />

          <div className="space-y-3">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                {t('verification.didntReceiveCode')}
              </p>
              <Button
                variant="outline"
                onClick={handleResendCode}
                disabled={isResending || resendCodeMutation.isPending}
                className="w-full"
              >
                {isResending || resendCodeMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('verification.resending')}
                  </>
                ) : (
                  t('verification.resendCode')
                )}
              </Button>
            </div>

            <div className="text-center text-xs text-muted-foreground">
              <p>{t('verification.checkSpamFolder')}</p>
            </div>
          </div>

          <div className="text-center pt-4">
            <Button variant="ghost" onClick={() => navigate('/login')} className="text-sm">
              {t('verification.backToLogin')}
            </Button>
          </div>
        </div>
      </div>

      {/* Right Side - Image/Brand */}
      <div className="bg-muted hidden lg:flex lg:w-1/2 lg:items-center lg:justify-center">
        <div className="max-w-md text-center">
          <h2 className="text-foreground mb-4 text-3xl font-bold">
            {t('verification.brandTitle')}
          </h2>
          <p className="text-muted-foreground text-lg">
            {t('verification.brandSubtitle')}
          </p>
        </div>
      </div>
    </div>
  )
}
