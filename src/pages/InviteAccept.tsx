import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle, AlertCircle, Eye, EyeOff, Loader2, Check, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DateTime } from 'luxon'
import { getIntlLocale } from '@/utils/i18n-locale'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import { EmailMismatchWarning } from './Auth/components/EmailMismatchWarning'
import { DirectAcceptInvitation } from './Auth/components/DirectAcceptInvitation'
import api from '@/api'
import { authService } from '@/services/auth.service'

// Schema will be created inside the component to access t() function
const createAcceptInvitationSchema = (t: any) =>
  z
    .object({
      firstName: z.string().min(1, t('validation.firstNameRequired')).max(50, t('validation.firstNameMax')),
      lastName: z.string().min(1, t('validation.lastNameRequired')).max(50, t('validation.lastNameMax')),
      password: z
        .string()
        .min(8, t('validation.passwordMin'))
        .regex(/[A-Z]/, t('validation.passwordUppercase'))
        .regex(/[a-z]/, t('validation.passwordLowercase'))
        .regex(/[0-9]/, t('validation.passwordNumber')),
      confirmPassword: z.string(),
      pin: z
        .string()
        .regex(/^\d{4,10}$/, t('validation.pinFormat'))
        .optional()
        .or(z.literal('')),
    })
    .refine(data => data.password === data.confirmPassword, {
      message: t('validation.passwordMatch'),
      path: ['confirmPassword'],
    })

type AcceptInvitationFormData = {
  firstName: string
  lastName: string
  password: string
  confirmPassword: string
  pin?: string
}

interface InvitationDetails {
  id: string
  email: string
  role: string
  roleDisplayName?: string // Custom role name from venue settings (if configured)
  organizationName: string
  venueName: string
  inviterName: string
  expiresAt: string
  status: string
  firstName?: string | null
  lastName?: string | null
  // Multi-venue support fields
  userAlreadyHasPassword?: boolean // If true, skip password form (user already has account)
  existsInDifferentOrg?: boolean // If true, show "contact support" message
}

export default function InviteAccept() {
  const { t, i18n } = useTranslation(['inviteAccept', 'common'])
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { isAuthenticated, user } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [invitationDetails, setInvitationDetails] = useState<InvitationDetails | null>(null)
  const [isLoadingInvitation, setIsLoadingInvitation] = useState(true)
  const [invitationError, setInvitationError] = useState<string | null>(null)
  const [sessionStatus, setSessionStatus] = useState<{
    hasSession: boolean
    sessionEmail?: string
    emailMatches?: boolean
  }>({ hasSession: false })
  const [isProcessingAutoLogin, setIsProcessingAutoLogin] = useState(false)

  const fetchFreshAuthStatus = async () => {
    return queryClient.fetchQuery({
      queryKey: ['status'],
      queryFn: authService.getAuthStatus,
      staleTime: 0,
    })
  }

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isValid },
  } = useForm<AcceptInvitationFormData>({
    resolver: zodResolver(createAcceptInvitationSchema(t)),
    mode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      password: '',
      confirmPassword: '',
      pin: '',
    },
  })

  const passwordValue = watch('password') || ''
  const hasMinLength = passwordValue.length >= 8
  const hasUppercase = /[A-Z]/.test(passwordValue)
  const hasLowercase = /[a-z]/.test(passwordValue)
  const hasNumber = /[0-9]/.test(passwordValue)
  const allRequirementsMet = hasMinLength && hasUppercase && hasLowercase && hasNumber

  // Fetch invitation details
  useEffect(() => {
    if (!token) {
      setInvitationError(t('errors.invalidToken'))
      setIsLoadingInvitation(false)
      return
    }

    const fetchInvitationDetails = async () => {
      try {
        const response = await api.get(`/api/v1/invitations/${token}`)
        setInvitationDetails(response.data)
      } catch (error: any) {
        if (error.response?.status === 404) {
          setInvitationError(t('errors.notFound'))
        } else if (error.response?.status === 410) {
          setInvitationError(t('errors.alreadyUsed'))
        } else {
          setInvitationError(t('errors.loadError'))
        }
      } finally {
        setIsLoadingInvitation(false)
      }
    }

    fetchInvitationDetails()
  }, [token, t])

  // Pre-fill firstName and lastName if available from invitation
  useEffect(() => {
    if (invitationDetails && (invitationDetails.firstName || invitationDetails.lastName)) {
      reset({
        firstName: invitationDetails.firstName || '',
        lastName: invitationDetails.lastName || '',
        password: '',
        confirmPassword: '',
        pin: '',
      })
    }
  }, [invitationDetails, reset])

  // Check for existing session and compare emails (FAANG pattern)
  useEffect(() => {
    if (!invitationDetails) return

    const hasSession = isAuthenticated && !!user
    const sessionEmail = user?.email
    const invitationEmail = invitationDetails.email
    const emailMatches = sessionEmail === invitationEmail

    setSessionStatus({
      hasSession,
      sessionEmail,
      emailMatches,
    })
  }, [isAuthenticated, user, invitationDetails])

  // Accept invitation mutation
  const acceptInvitationMutation = useMutation({
    mutationFn: async (data: AcceptInvitationFormData) => {
      await api.post(`/api/v1/invitations/${token}/accept`, {
        firstName: data.firstName,
        lastName: data.lastName,
        password: data.password,
        pin: data.pin || null,
      })
      return data
    },
    onSuccess: async (formData) => {
      // Set flag to prevent showing DirectAcceptInvitation during auto-login
      setIsProcessingAutoLogin(true)

      // Note: No localStorage cleanup needed - we use URL-based state now (Stripe/GitHub pattern)

      try {
        let freshStatus = await fetchFreshAuthStatus()
        const isAuthenticatedAfterAccept = !!freshStatus?.authenticated && !!freshStatus?.user

        // Fallback: if backend accepted invitation but did not establish session, login explicitly
        if (!isAuthenticatedAfterAccept) {
          if (!invitationDetails?.email || !formData.password) {
            throw new Error('Missing email or password for invitation auto-login')
          }

          await api.post('/api/v1/dashboard/auth/login', {
            email: invitationDetails.email,
            password: formData.password,
          })

          freshStatus = await fetchFreshAuthStatus()
        }

        if (!freshStatus?.authenticated || !freshStatus?.user) {
          throw new Error('Session was not established after accepting invitation')
        }

        toast({
          title: t('success.title'),
          description: t('success.description'),
        })

        // Redirect to home (AuthContext will handle proper routing)
        setTimeout(() => {
          navigate('/', { replace: true })
        }, 1000)
      } catch (loginError) {
        console.error('Auto-login failed:', loginError)
        // Fallback: redirect to login page
        toast({
          title: t('success.title'),
          description: t('success.loginMessage'),
        })
        navigate('/login', {
          state: {
            email: invitationDetails?.email,
            message: t('success.loginMessage'),
          },
        })
      }
    },
    onError: (error: any) => {
      setIsProcessingAutoLogin(false)
      const errorMessage = error.response?.data?.message || t('errors.acceptError')
      toast({
        title: t('common:error'),
        description: errorMessage,
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (data: AcceptInvitationFormData) => {
    acceptInvitationMutation.mutate(data)
  }

  // Handle logout and continue with correct email
  // FIXED: Navigate directly to invite page after logout (not to login page)
  // This is important because new users don't have an account yet - they need
  // to see the password creation form, not the login page
  const handleLogoutAndContinue = async () => {
    // Show success message
    toast({
      title: t('emailMismatch.loggedOut'),
      description: t('emailMismatch.loggedOutDescription'),
    })

    // Clear auth state manually (same as logout() but without navigation)
    localStorage.removeItem('authToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    localStorage.removeItem('avoqado_current_venue_slug')
    queryClient.clear()

    // Call server logout in background (non-blocking)
    try {
      await api.post('/api/v1/dashboard/auth/logout')
    } catch (error) {
      console.warn('Server logout failed:', error)
    }

    // Reload the current invite page - now as logged out user
    // This will show either:
    // - Password form (new user)
    // - "Login to accept" (existing user with password)
    window.location.reload()
  }

  // Handle direct acceptance for users already logged in with matching email
  const handleDirectAccept = async () => {
    if (!invitationDetails) return

    try {
      // For logged-in users, we just need to link the invitation to their existing account
      await api.post(`/api/v1/invitations/${token}/accept`, {
        // Backend should detect existing session and just link the invitation
      })

      // Note: No localStorage cleanup needed - we use URL-based state now (Stripe/GitHub pattern)

      toast({
        title: t('directAccept.successTitle'),
        description: t('directAccept.successDescription'),
      })

      // Refresh auth status to get updated venue/role info
      await queryClient.refetchQueries({ queryKey: ['status'] })

      // Redirect to home (will go to the new venue)
      setTimeout(() => {
        navigate('/', { replace: true })
      }, 1000)
    } catch (error: any) {
      toast({
        title: t('common:error'),
        description: error.response?.data?.message || t('errors.acceptError'),
        variant: 'destructive',
      })
    }
  }

  if (isLoadingInvitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">{t('loading')}</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (invitationError || !invitationDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle>{t('invalidTitle')}</CardTitle>
            <CardDescription>{invitationError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/login')} className="w-full">
              {t('goToLogin')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Check if invitation is expired
  const isExpired = new Date(invitationDetails.expiresAt) < new Date()

  // Show loading state during auto-login process
  if (isProcessingAutoLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">{t('creatingAccount')}</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  // FAANG Pattern: Show email mismatch warning if logged in with different email
  if (sessionStatus.hasSession && !sessionStatus.emailMatches && sessionStatus.sessionEmail) {
    return (
      <EmailMismatchWarning
        sessionEmail={sessionStatus.sessionEmail}
        invitationEmail={invitationDetails.email}
        onLogout={handleLogoutAndContinue}
        onCancel={() => navigate(-1)}
      />
    )
  }

  // FAANG Pattern: Show direct accept if logged in with matching email
  if (sessionStatus.hasSession && sessionStatus.emailMatches) {
    return (
      <DirectAcceptInvitation
        invitationDetails={invitationDetails}
        onAccept={handleDirectAccept}
        isAccepting={acceptInvitationMutation.isPending}
      />
    )
  }

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <AlertCircle className="h-6 w-6 text-amber-600" />
            </div>
            <CardTitle>{t('expiredTitle')}</CardTitle>
            <CardDescription>
              {t('expiredDescription', {
                date: DateTime.fromISO(invitationDetails.expiresAt)
                  .setLocale(getIntlLocale(i18n.language))
                  .toLocaleString(DateTime.DATE_MED),
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/login')} className="w-full">
              {t('goToLogin')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // User exists in a different organization - they need to contact support
  if (invitationDetails.existsInDifferentOrg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <AlertCircle className="h-6 w-6 text-amber-600" />
            </div>
            <CardTitle>{t('existsInDifferentOrg.title', 'Cuenta ya registrada')}</CardTitle>
            <CardDescription>
              {t('existsInDifferentOrg.description', 'Este email ya está registrado en otra organización. Por favor, contacta a soporte si necesitas acceso a múltiples organizaciones.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('emailLabel')}: <strong>{invitationDetails.email}</strong>
              </AlertDescription>
            </Alert>
            <Button onClick={() => navigate('/login')} className="w-full">
              {t('goToLogin')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // User already has an account - ask for password verification to accept invitation
  // This avoids the login flow which blocks users without active venues
  if (invitationDetails.userAlreadyHasPassword && !sessionStatus.hasSession) {
    return (
      <ExistingUserPasswordVerification
        invitationDetails={invitationDetails}
        token={token!}
        onSuccess={async (password) => {
          setIsProcessingAutoLogin(true)

          let freshStatus = await fetchFreshAuthStatus()
          const isAuthenticatedAfterAccept = !!freshStatus?.authenticated && !!freshStatus?.user

          // Some backends accept invitation but don't establish session in this path.
          // If that happens, login with the verified credentials and retry auth status.
          if (!isAuthenticatedAfterAccept) {
            await api.post('/api/v1/dashboard/auth/login', {
              email: invitationDetails.email,
              password,
            })

            freshStatus = await fetchFreshAuthStatus()
          }

          if (!freshStatus?.authenticated || !freshStatus?.user) {
            throw new Error('Unable to establish session after accepting invitation')
          }

          toast({
            title: t('success.title'),
            description: t('success.description'),
          })
          setTimeout(() => {
            navigate('/', { replace: true })
          }, 1000)
        }}
        t={t}
      />
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle>{t('joinTitle')}</CardTitle>
          <CardDescription>
            {t('invitedTo')} <strong>{invitationDetails.organizationName}</strong>
            {invitationDetails.venueName && (
              <>
                {' '}
                {t('at')} <strong>{invitationDetails.venueName}</strong>
              </>
            )}{' '}
            {t('as')} <strong>{invitationDetails.roleDisplayName || invitationDetails.role}</strong>
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('emailLabel')}: <strong>{invitationDetails.email}</strong>
              </AlertDescription>
            </Alert>

            {/* Name Fields */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t('labels.firstName')} *</Label>
                  <Input
                    id="firstName"
                    placeholder={t('placeholders.firstName')}
                    autoComplete="given-name"
                    readOnly={!!(invitationDetails?.firstName)}
                    className={invitationDetails?.firstName ? 'bg-muted cursor-not-allowed' : ''}
                    {...register('firstName')}
                  />
                  {errors.firstName && <p className="text-sm text-red-600">{errors.firstName.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">{t('labels.lastName')} *</Label>
                  <Input
                    id="lastName"
                    placeholder={t('placeholders.lastName')}
                    autoComplete="family-name"
                    readOnly={!!(invitationDetails?.lastName)}
                    className={invitationDetails?.lastName ? 'bg-muted cursor-not-allowed' : ''}
                    {...register('lastName')}
                  />
                  {errors.lastName && <p className="text-sm text-red-600">{errors.lastName.message}</p>}
                </div>
              </div>
              {invitationDetails?.firstName && invitationDetails?.lastName && (
                <p className="text-xs text-muted-foreground">
                  {t('nameEditNote')}
                </p>
              )}
            </div>

            {/* Password Fields */}
            <div className="space-y-2">
              <Label htmlFor="password">{t('labels.password')} *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('placeholders.password')}
                  autoComplete="new-password"
                  className="pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
              <div className="space-y-2 text-sm">
                <p className="font-medium text-foreground">{t('passwordRequirements.title')}</p>
                <div className="space-y-1">
                  <RequirementItem met={hasMinLength} text={t('passwordRequirements.minLength')} />
                  <RequirementItem met={hasUppercase} text={t('passwordRequirements.uppercase')} />
                  <RequirementItem met={hasLowercase} text={t('passwordRequirements.lowercase')} />
                  <RequirementItem met={hasNumber} text={t('passwordRequirements.number')} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('labels.confirmPassword')} *</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder={t('placeholders.confirmPassword')}
                  className="pr-10"
                  autoComplete="new-password"
                  {...register('confirmPassword')}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-sm text-red-600">{errors.confirmPassword.message}</p>}
            </div>

            {/* PIN Field */}
            <div className="space-y-2">
              <Label htmlFor="pin">{t('labels.pin')}</Label>
              <Input id="pin" type="text" placeholder={t('placeholders.pin')} maxLength={10} {...register('pin')} />
              {errors.pin && <p className="text-sm text-red-600">{errors.pin.message}</p>}
              <p className="text-xs text-muted-foreground">{t('pinHelp')}</p>
            </div>

            <Button
              type="submit"
              disabled={!isValid || acceptInvitationMutation.isPending || !allRequirementsMet}
              className="w-full"
            >
              {acceptInvitationMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t('creatingAccount')}
                </>
              ) : (
                t('acceptButton')
              )}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            <p>
              {t('termsText')}{' '}
              <Link to="/terms" className="underline underline-offset-4 hover:text-primary">
                {t('termsLink')}
              </Link>
            </p>
            <p className="mt-2">
              {t('haveAccount')}{' '}
              <button onClick={() => navigate('/login')} className="text-blue-600 hover:text-blue-800 underline">
                {t('loginHere')}
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface RequirementItemProps {
  met: boolean
  text: string
}

const RequirementItem = ({ met, text }: RequirementItemProps) => {
  return (
    <div className="flex items-center gap-2">
      {met ? (
        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={met ? 'text-foreground' : 'text-muted-foreground'}>{text}</span>
    </div>
  )
}

// Component for existing users to verify password and accept invitation
// This avoids the login flow which blocks users without active venues
interface ExistingUserPasswordVerificationProps {
  invitationDetails: InvitationDetails
  token: string
  onSuccess: (password: string) => Promise<void>
  t: any
}

const ExistingUserPasswordVerification: React.FC<ExistingUserPasswordVerificationProps> = ({
  invitationDetails,
  token,
  onSuccess,
  t,
}) => {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await api.post(`/api/v1/invitations/${token}/accept`, {
        password,
      })
      await onSuccess(password)
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Error al aceptar la invitación'
      setError(errorMessage)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <CheckCircle className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle>{t('existingAccount.title', '¡Ya tienes cuenta!')}</CardTitle>
          <CardDescription>
            {t('existingAccount.verifyDescription', 'Ingresa tu contraseña para verificar tu identidad y unirte al nuevo venue.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
            <CheckCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription>
              {t('invitedTo', 'Has sido invitado a')} <strong>{invitationDetails.organizationName}</strong>
              {invitationDetails.venueName && (
                <>
                  {' '}{t('at', 'en')} <strong>{invitationDetails.venueName}</strong>
                </>
              )}{' '}
              {t('as', 'como')} <strong>{invitationDetails.roleDisplayName || invitationDetails.role}</strong>
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verify-password">{t('labels.password', 'Contraseña')}</Label>
              <div className="relative">
                <Input
                  id="verify-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('placeholders.enterPassword', 'Ingresa tu contraseña')}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pr-10"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={!password || isSubmitting} className="w-full">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t('verifying', 'Verificando...')}
                </>
              ) : (
                t('existingAccount.acceptButton', 'Verificar y aceptar invitación')
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
