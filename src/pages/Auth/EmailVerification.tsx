import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  const [resendCountdown, setResendCountdown] = useState(0)

  // Check if user is logged in and get their email
  const { data: statusData, isLoading: isCheckingAuth } = useQuery({
    queryKey: ['status'],
    queryFn: authService.getAuthStatus,
    retry: false,
  })

  const isAuthenticated = !!statusData?.authenticated
  const currentUser = statusData?.user

  // Check if email is already verified (for users arriving via URL without session)
  const { data: emailStatusData, isLoading: isCheckingEmailStatus } = useQuery({
    queryKey: ['emailStatus', userEmail],
    queryFn: async () => {
      if (!userEmail) return null
      try {
        const response = await api.get(`/api/v1/onboarding/email-status?email=${encodeURIComponent(userEmail)}`)
        return response.data
      } catch (error) {
        return null
      }
    },
    enabled: !!userEmail && !isAuthenticated, // Only check if we have email and user is not authenticated
    retry: false,
  })

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
      setResendCountdown(30) // Start 30-second countdown (FAANG pattern)
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

  // FAANG Pattern: Countdown timer for resend button
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => {
        setResendCountdown(resendCountdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCountdown])

  const handleResendCode = () => {
    if (!userEmail) return
    setIsResending(true)
    resendCodeMutation.mutate(userEmail)
  }

  // Show loading while checking auth or email status
  if (isCheckingAuth || isCheckingEmailStatus) {
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

  // FAANG Pattern: Show "Already Verified" screen if email is verified
  const isEmailVerified = emailStatusData?.emailVerified || (isAuthenticated && currentUser?.emailVerified)

  if (isEmailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="absolute top-4 right-4 flex gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/50">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">{t('verification.alreadyVerified')}</CardTitle>
            <CardDescription className="text-base mt-2">
              {t('verification.alreadyVerifiedDescriptionFull')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => navigate('/login')} className="w-full" size="lg">
              {t('verification.goToLogin')}
            </Button>
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

        <div className="w-full max-w-md space-y-8">
          {/* Header - Simplified */}
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{t('verification.title')}</h1>
            <p className="text-muted-foreground mt-2">
              {t('verification.subtitle')} <span className="font-medium text-foreground">{userEmail}</span>
            </p>
          </div>

          {/* Verification Form */}
          <EmailVerificationForm email={userEmail} />

          {/* Actions - Simplified */}
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={handleResendCode}
              disabled={isResending || resendCodeMutation.isPending || resendCountdown > 0}
              className="w-full"
            >
              {isResending || resendCodeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('verification.resending')}
                </>
              ) : resendCountdown > 0 ? (
                `${t('verification.resendCode')} (${resendCountdown}s)`
              ) : (
                t('verification.resendCode')
              )}
            </Button>

            <div className="text-center">
              <Button variant="link" onClick={() => navigate('/login')} className="text-sm text-muted-foreground">
                {t('verification.backToLogin')}
              </Button>
            </div>
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
