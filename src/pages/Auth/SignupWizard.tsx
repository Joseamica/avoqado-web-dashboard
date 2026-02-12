/**
 * SignupWizard — Step 1 of the Square-style onboarding
 *
 * Collects only email + password. firstName, lastName, organizationName
 * are collected later in the setup wizard.
 */

import { useForm, type SubmitHandler } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { SetupWizardLayout } from '@/components/layouts/SetupWizardLayout'
import { useAuth } from '@/context/AuthContext'
import { authService } from '@/services/auth.service'
import { cn } from '@/lib/utils'

interface SignupFormInputs {
  email: string
  password: string
}

export default function SignupWizard() {
  const { t } = useTranslation('setup')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { signup, isLoading } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormInputs>()

  const onSubmit: SubmitHandler<SignupFormInputs> = async (formData) => {
    try {
      // V2 signup: only email + password, empty names/org (backend defaults)
      await signup({
        email: formData.email,
        password: formData.password,
        firstName: '',
        lastName: '',
        organizationName: '',
        wizardVersion: 2,
      })

      // DEV: Skip email verification with bypass code
      const skipVerification =
        import.meta.env.DEV && import.meta.env.VITE_SKIP_EMAIL_VERIFICATION === 'true'

      if (skipVerification) {
        await authService.verifyEmail({
          email: formData.email,
          verificationCode: '000000',
        })
        await queryClient.refetchQueries({ queryKey: ['status'], type: 'active' })
        navigate('/setup', { replace: true })
        return
      }

      // Navigate to email verification page
      navigate(`/auth/verify-email?email=${encodeURIComponent(formData.email)}`, {
        state: {
          fromSignup: true,
          email: formData.email,
          timestamp: Date.now(),
          wizardVersion: 2,
        },
      })
    } catch {
      // Error handled by AuthContext toast
    }
  }

  return (
    <SetupWizardLayout hideFinishLater>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8">
        {/* Title */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t('step1.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('step1.subtitle')}</p>
        </div>

        {/* Form fields */}
        <div className="flex flex-col gap-5">
          {/* Email */}
          <div className="grid gap-2">
            <Label htmlFor="email">{t('step1.emailLabel')}</Label>
            <Input
              {...register('email', { required: t('step1.emailRequired') })}
              id="email"
              type="email"
              placeholder={t('step1.emailPlaceholder')}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              disabled={isLoading}
              className={cn('rounded-lg h-12 text-base', errors.email && 'border-destructive')}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="grid gap-2">
            <Label htmlFor="password">{t('step1.passwordLabel')}</Label>
            <Input
              {...register('password', {
                required: t('step1.passwordRequired'),
                minLength: {
                  value: 8,
                  message: t('step1.passwordMinLength'),
                },
              })}
              id="password"
              type="password"
              placeholder={t('step1.passwordPlaceholder')}
              autoComplete="new-password"
              disabled={isLoading}
              className={cn('rounded-lg h-12 text-base', errors.password && 'border-destructive')}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
            <p className="text-xs text-muted-foreground">{t('step1.passwordHint')}</p>
          </div>
        </div>

        {/* Submit */}
        <Button type="submit" className="w-full rounded-full h-12 text-base" size="lg" disabled={isLoading}>
          {isLoading && <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />}
          {t('step1.createAccount')}
        </Button>

        {/* Sign-in link */}
        <p className="text-center text-sm text-muted-foreground">
          {t('step1.alreadyHaveAccount')}{' '}
          <a href="/login" className="font-medium text-foreground underline underline-offset-4">
            {t('step1.signIn')}
          </a>
        </p>
      </form>
    </SetupWizardLayout>
  )
}
