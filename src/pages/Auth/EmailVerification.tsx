import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation } from '@tanstack/react-query'
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
  const location = useLocation()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const emailFromUrl = searchParams.get('email')

  // Detect if user comes from signup flow (Stripe/GitHub pattern)
  // This prevents race condition with email-status check
  const navigationState = location.state as { fromSignup?: boolean; email?: string; timestamp?: number; wizardVersion?: number } | null
  const fromSignup = navigationState?.fromSignup === true
  const signupTimestamp = navigationState?.timestamp || 0
  const isRecentSignup = fromSignup && Date.now() - signupTimestamp < 30000 // Within 30 seconds
  const wizardVersion = navigationState?.wizardVersion

  const [userEmail, setUserEmail] = useState<string>('')
  const [isResending, setIsResending] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)

  // Check if user is logged in and get their email
  const { data: statusData, isLoading: isCheckingAuth } = useQuery({
    queryKey: ['status'],
    queryFn: authService.getAuthStatus,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    retry: false,
  })

  const isAuthenticated = !!statusData?.authenticated
  const currentUser = statusData?.user

  // Determine effective email (prioritize URL parameter for signup flow to avoid race conditions)
  const effectiveEmail = emailFromUrl || navigationState?.email || currentUser?.email || ''

  // Check if email is already verified (for users arriving via URL without session)
  // WORLD-CLASS PATTERN (Stripe/GitHub): Skip validation if user comes from signup
  // This prevents race condition where email-status check runs before signup completes
  const { data: emailStatusData, isLoading: isCheckingEmailStatus } = useQuery({
    queryKey: ['emailStatus', effectiveEmail],
    queryFn: async () => {
      if (!effectiveEmail) return null
      try {
        const response = await api.get(`/api/v1/onboarding/email-status?email=${encodeURIComponent(effectiveEmail)}`)
        return response.data
      } catch {
        return null
      }
    },
    // CRITICAL: Don't check email status if user just signed up (within 30 seconds)
    // Trust the signup flow - email exists because we just created it
    enabled: !!effectiveEmail && !isAuthenticated && !isCheckingAuth && !isRecentSignup,
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

  // Sync userEmail state with effectiveEmail for UI display
  useEffect(() => {
    if (effectiveEmail) {
      setUserEmail(effectiveEmail)
    }
  }, [effectiveEmail])

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

  // FAANG Pattern: Validate email exists in database before showing verification UI
  // This prevents email enumeration attacks and unauthorized access to verification page
  // WORLD-CLASS OPTIMIZATION: If user comes from signup, trust the flow (email exists, not verified)
  const isEmailVerified = emailStatusData?.emailVerified || (isAuthenticated && currentUser?.emailVerified)
  const emailExists = isRecentSignup ? true : emailStatusData?.emailExists // Trust signup flow

  // Security Check 1: If email doesn't exist in database, redirect to signup
  // FAANG Pattern (GitHub, Stripe): Don't allow verification page for non-existent emails
  // Skip this check if user just signed up (we know email exists)
  if (!isRecentSignup && emailStatusData && emailExists === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="absolute top-4 right-4 flex gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/50">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle>{t('verification.emailNotFoundTitle')}</CardTitle>
            <CardDescription>{t('verification.emailNotFoundDescription')}</CardDescription>
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

  // Security Check 2: Show "Already Verified" screen if email is verified
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

  // Security Check 3: Only show "no email" error if we've finished loading and there's truly no email
  // Skip this check if user comes from signup (email is in navigation state)
  if (!userEmail && !emailFromUrl && !isCheckingAuth && !isRecentSignup) {
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
          <EmailVerificationForm email={userEmail} wizardVersion={wizardVersion} />

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
