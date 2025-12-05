import React from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'

import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { authService, SignupDto } from '@/services/auth.service'

type Inputs = SignupDto

export function SignupForm({ className, ...props }: React.ComponentProps<'form'>) {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { signup, isLoading } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Inputs>()

  const onSubmit: SubmitHandler<Inputs> = async formData => {
    try {
      // Wait for signup to complete successfully
      await signup(formData)

      // DEV: Skip email verification with bypass code
      const skipVerification =
        import.meta.env.DEV && import.meta.env.VITE_SKIP_EMAIL_VERIFICATION === 'true'

      if (skipVerification) {
        // Auto-verify with bypass code and go directly to onboarding
        await authService.verifyEmail({
          email: formData.email,
          verificationCode: '000000',
        })
        // Refetch auth status to update context (same pattern as EmailVerificationForm)
        await queryClient.refetchQueries({ queryKey: ['status'], type: 'active' })
        navigate('/onboarding', { replace: true })
        return
      }

      // Navigate to dedicated verification page (FAANG UX pattern)
      // IMPORTANT: Pass state to indicate user comes from signup flow
      // This prevents race condition with email-status check
      // Pattern used by Stripe, GitHub, Google for post-signup flows
      navigate(`/auth/verify-email?email=${encodeURIComponent(formData.email)}`, {
        state: {
          fromSignup: true,
          email: formData.email,
          timestamp: Date.now(),
        },
      })
    } catch {
      // Error already handled by AuthContext's onError (shows toast)
      // Keep user on signup form to retry
    }
  }

  return (
    <form className={cn('flex flex-col gap-6', className)} {...props} onSubmit={handleSubmit(onSubmit)}>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">{t('signup.title')}</h1>
        <p className="text-muted-foreground text-sm text-balance">{t('signup.subtitle')}</p>
      </div>
      <div className="grid gap-6">
        {/* Organization Name */}
        <div className="grid gap-3">
          <Label htmlFor="organizationName">{t('signup.organizationNameLabel')}</Label>
          <Input
            {...register('organizationName', { required: t('signup.organizationNameRequired') })}
            id="organizationName"
            type="text"
            placeholder={t('signup.organizationNamePlaceholder')}
            autoCapitalize="words"
            autoComplete="organization"
            autoCorrect="off"
            disabled={isLoading}
            className={cn('w-full', errors.organizationName && 'border-red-500')}
          />
          {errors.organizationName && (
            <span style={{ color: 'red', fontSize: '12px', paddingLeft: 5 }}>{errors.organizationName.message}</span>
          )}
        </div>

        {/* First Name & Last Name */}
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-3">
            <Label htmlFor="firstName">{t('signup.firstNameLabel')}</Label>
            <Input
              {...register('firstName', { required: t('signup.firstNameRequired') })}
              id="firstName"
              type="text"
              placeholder={t('signup.firstNamePlaceholder')}
              autoCapitalize="words"
              autoComplete="given-name"
              autoCorrect="off"
              disabled={isLoading}
              className={cn('w-full', errors.firstName && 'border-red-500')}
            />
            {errors.firstName && <span style={{ color: 'red', fontSize: '12px', paddingLeft: 5 }}>{errors.firstName.message}</span>}
          </div>

          <div className="grid gap-3">
            <Label htmlFor="lastName">{t('signup.lastNameLabel')}</Label>
            <Input
              {...register('lastName', { required: t('signup.lastNameRequired') })}
              id="lastName"
              type="text"
              placeholder={t('signup.lastNamePlaceholder')}
              autoCapitalize="words"
              autoComplete="family-name"
              autoCorrect="off"
              disabled={isLoading}
              className={cn('w-full', errors.lastName && 'border-red-500')}
            />
            {errors.lastName && <span style={{ color: 'red', fontSize: '12px', paddingLeft: 5 }}>{errors.lastName.message}</span>}
          </div>
        </div>

        {/* Email */}
        <div className="grid gap-3">
          <Label htmlFor="email">{t('signup.emailLabel')}</Label>
          <Input
            {...register('email', { required: t('signup.emailRequired') })}
            id="email"
            type="email"
            placeholder={t('signup.emailPlaceholder')}
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect="off"
            disabled={isLoading}
            className={cn('w-full', errors.email && 'border-red-500')}
          />
          {errors.email && <span style={{ color: 'red', fontSize: '12px', paddingLeft: 5 }}>{errors.email.message}</span>}
        </div>

        {/* Password */}
        <div className="grid gap-3">
          <Label htmlFor="password">{t('signup.passwordLabel')}</Label>
          <Input
            {...register('password', {
              required: t('signup.passwordRequired'),
              minLength: {
                value: 8,
                message: t('signup.passwordMinLength'),
              },
            })}
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            disabled={isLoading}
            className={cn('w-full', errors.password && 'border-red-500')}
          />
          {errors.password && <span style={{ color: 'red', fontSize: '12px', paddingLeft: 5 }}>{errors.password.message}</span>}
          <p className="text-muted-foreground text-xs">{t('signup.passwordHint')}</p>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Icons.spinner className="mr-2 w-4 h-4 animate-spin" />}
          {t('signup.createAccountButton')}
        </Button>
      </div>
      <div className="text-center text-sm">
        {t('signup.alreadyHaveAccount')}{' '}
        <a href="/login" className="underline underline-offset-4">
          {t('signup.signInLink')}
        </a>
      </div>
    </form>
  )
}
