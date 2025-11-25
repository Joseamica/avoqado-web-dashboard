import React, { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2, ArrowLeft, Lock, CheckCircle2, XCircle, Check, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import Logo from '@/assets/logo'
import CoverLogin from '@/assets/cover-login.png'
import { ThemeToggle } from '@/components/theme-toggle'
import LanguageSwitcher from '@/components/language-switcher'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { validateResetToken, resetPassword } from '@/services/auth.service'

interface ResetPasswordFormData {
  newPassword: string
  confirmPassword: string
}

const ResetPassword: React.FC = () => {
  const { t } = useTranslation('auth')
  const { toast } = useToast()
  const navigate = useNavigate()
  const { token } = useParams<{ token: string }>()
  const tokenValue = token || ''

  const [isValidatingToken, setIsValidatingToken] = useState(true)
  const [isTokenValid, setIsTokenValid] = useState(false)
  const [maskedEmail, setMaskedEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const [password, setPassword] = useState('')

  // Password requirements validation
  const hasMinLength = password.length >= 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)
  const allRequirementsMet = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial

  // Create schema using translations
  const resetPasswordSchema = z
    .object({
      newPassword: z
        .string({ required_error: t('resetPassword.newPasswordRequired') })
        .min(8, t('resetPassword.passwordMinLength'))
        .regex(/[A-Z]/, t('resetPassword.requirementUppercase'))
        .regex(/[a-z]/, t('resetPassword.requirementLowercase'))
        .regex(/[0-9]/, t('resetPassword.requirementNumber'))
        .regex(/[^A-Za-z0-9]/, t('resetPassword.requirementSpecial')),
      confirmPassword: z.string({ required_error: t('resetPassword.confirmPasswordRequired') }),
    })
    .refine(data => data.newPassword === data.confirmPassword, {
      message: t('resetPassword.passwordsDoNotMatch'),
      path: ['confirmPassword'],
    })

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  })

  // Watch password field for real-time validation
  const watchPassword = watch('newPassword')
  useEffect(() => {
    setPassword(watchPassword || '')
  }, [watchPassword])

  // Validate token on component mount
  useEffect(() => {
    const validateToken = async () => {
      if (!tokenValue) {
        setIsValidatingToken(false)
        setIsTokenValid(false)
        toast({
          variant: 'destructive',
          title: t('resetPassword.invalidTokenTitle'),
          description: t('resetPassword.invalidTokenDescription'),
        })
        return
      }

      try {
        const response = await validateResetToken(tokenValue)
        if (response.valid) {
          setIsTokenValid(true)
          setMaskedEmail(response.email || '')
        } else {
          setIsTokenValid(false)
          toast({
            variant: 'destructive',
            title: t('resetPassword.invalidTokenTitle'),
            description: t('resetPassword.expiredTokenDescription'),
          })
        }
      } catch (error: any) {
        console.error('Token validation error:', error)
        setIsTokenValid(false)
        toast({
          variant: 'destructive',
          title: t('resetPassword.errorTitle'),
          description: error?.response?.data?.message || t('resetPassword.errorDescription'),
        })
      } finally {
        setIsValidatingToken(false)
      }
    }

    validateToken()
  }, [tokenValue, toast, t])

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!tokenValue) return

    setIsSubmitting(true)

    try {
      await resetPassword(tokenValue, data.newPassword)
      setResetSuccess(true)

      toast({
        title: t('toast.password_reset_success'),
        description: t('toast.password_reset_success_desc'),
      })

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (error: any) {
      console.error('Password reset error:', error)
      toast({
        variant: 'destructive',
        title: t('toast.password_reset_failed_title'),
        description: error?.response?.data?.message || t('toast.password_reset_failed_desc'),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Loading state while validating token
  if (isValidatingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('forgotPassword.sending')}</p>
        </div>
      </div>
    )
  }

  // Invalid token state
  if (!isTokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">{t('resetPassword.invalidTokenTitle')}</CardTitle>
            <CardDescription className="text-muted-foreground">
              {t('resetPassword.invalidTokenDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link to="/auth/forgot-password" className="text-sm text-primary hover:underline">
              {t('forgotPassword.title')}
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2 bg-background text-foreground">
      <div className="flex flex-col gap-4 p-6 md:p-10 relative bg-background text-foreground">
        <div className="absolute top-4 right-4 md:top-8 md:right-8 z-10 flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <Logo className="size-4" />
            </div>
            Avoqado
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md">
            {!resetSuccess ? (
              <Card className="border-border">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-2xl font-bold text-foreground">{t('resetPassword.title')}</CardTitle>
                  <CardDescription className="text-muted-foreground">{t('resetPassword.subtitle')}</CardDescription>
                  {maskedEmail && (
                    <Alert className="border-primary/20 bg-primary/5 mt-2">
                      <Lock className="h-4 w-4 text-primary" />
                      <AlertDescription className="text-sm text-muted-foreground">{maskedEmail}</AlertDescription>
                    </Alert>
                  )}
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword" className="text-foreground">
                        {t('resetPassword.newPasswordLabel')}
                      </Label>
                      <Input
                        id="newPassword"
                        type="password"
                        placeholder={t('resetPassword.newPasswordPlaceholder')}
                        className="bg-background text-foreground border-input"
                        {...register('newPassword')}
                        disabled={isSubmitting}
                      />
                      {errors.newPassword && <p className="text-sm text-destructive">{errors.newPassword.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-foreground">
                        {t('resetPassword.confirmPasswordLabel')}
                      </Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder={t('resetPassword.confirmPasswordPlaceholder')}
                        className="bg-background text-foreground border-input"
                        {...register('confirmPassword')}
                        disabled={isSubmitting}
                      />
                      {errors.confirmPassword && (
                        <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                      )}
                    </div>

                    {/* Password Requirements */}
                    <div className="space-y-2 text-sm">
                      <p className="font-medium text-foreground">{t('resetPassword.passwordRequirements')}</p>
                      <div className="space-y-1">
                        <RequirementItem met={hasMinLength} text={t('resetPassword.requirementMinLength')} />
                        <RequirementItem met={hasUppercase} text={t('resetPassword.requirementUppercase')} />
                        <RequirementItem met={hasLowercase} text={t('resetPassword.requirementLowercase')} />
                        <RequirementItem met={hasNumber} text={t('resetPassword.requirementNumber')} />
                        <RequirementItem met={hasSpecial} text={t('resetPassword.requirementSpecial')} />
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={isSubmitting || !allRequirementsMet}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('resetPassword.resetting')}
                        </>
                      ) : (
                        <>
                          <Lock className="mr-2 h-4 w-4" />
                          {t('resetPassword.resetButton')}
                        </>
                      )}
                    </Button>

                    <div className="text-center">
                      <Link
                        to="/login"
                        className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <ArrowLeft className="h-3 w-3" />
                        {t('forgotPassword.backToLogin')}
                      </Link>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border">
                <CardHeader className="space-y-1 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-2xl font-bold text-foreground">{t('resetPassword.successTitle')}</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {t('resetPassword.successDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                  <p className="text-sm text-muted-foreground">{t('forgotPassword.backToLogin')}...</p>
                  <Button asChild className="w-full">
                    <Link to="/login">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      {t('resetPassword.goToLogin')}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        <div className="text-center text-sm text-muted-foreground">
          {t('resetPassword.brandTitle')} · {t('resetPassword.brandSubtitle')}
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <img
          src={CoverLogin}
          alt={t('resetPassword.imageAlt')}
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  )
}

// Helper component for password requirements
interface RequirementItemProps {
  met: boolean
  text: string
}

const RequirementItem: React.FC<RequirementItemProps> = ({ met, text }) => {
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

export default ResetPassword
