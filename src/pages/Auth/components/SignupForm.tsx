import React, { useEffect } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { SignupDto } from '@/services/auth.service'

type Inputs = SignupDto

export function SignupForm({ className, ...props }: React.ComponentProps<'form'>) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { signup, isAuthenticated, isLoading } = useAuth()

  const from = (location.state as any)?.from?.pathname || '/onboarding'

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, from])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Inputs>()

  const onSubmit: SubmitHandler<Inputs> = async formData => {
    signup(formData)
  }

  return (
    <form className={cn('flex flex-col gap-6', className)} {...props} onSubmit={handleSubmit(onSubmit)}>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">{t('auth.signup.title')}</h1>
        <p className="text-muted-foreground text-sm text-balance">{t('auth.signup.subtitle')}</p>
      </div>
      <div className="grid gap-6">
        {/* Organization Name */}
        <div className="grid gap-3">
          <Label htmlFor="organizationName">{t('auth.signup.organizationNameLabel')}</Label>
          <Input
            {...register('organizationName', { required: t('auth.signup.organizationNameRequired') })}
            id="organizationName"
            type="text"
            placeholder={t('auth.signup.organizationNamePlaceholder')}
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
            <Label htmlFor="firstName">{t('auth.signup.firstNameLabel')}</Label>
            <Input
              {...register('firstName', { required: t('auth.signup.firstNameRequired') })}
              id="firstName"
              type="text"
              placeholder={t('auth.signup.firstNamePlaceholder')}
              autoCapitalize="words"
              autoComplete="given-name"
              autoCorrect="off"
              disabled={isLoading}
              className={cn('w-full', errors.firstName && 'border-red-500')}
            />
            {errors.firstName && <span style={{ color: 'red', fontSize: '12px', paddingLeft: 5 }}>{errors.firstName.message}</span>}
          </div>

          <div className="grid gap-3">
            <Label htmlFor="lastName">{t('auth.signup.lastNameLabel')}</Label>
            <Input
              {...register('lastName', { required: t('auth.signup.lastNameRequired') })}
              id="lastName"
              type="text"
              placeholder={t('auth.signup.lastNamePlaceholder')}
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
          <Label htmlFor="email">{t('auth.signup.emailLabel')}</Label>
          <Input
            {...register('email', { required: t('auth.signup.emailRequired') })}
            id="email"
            type="email"
            placeholder={t('auth.signup.emailPlaceholder')}
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
          <Label htmlFor="password">{t('auth.signup.passwordLabel')}</Label>
          <Input
            {...register('password', {
              required: t('auth.signup.passwordRequired'),
              minLength: {
                value: 8,
                message: t('auth.signup.passwordMinLength'),
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
          <p className="text-muted-foreground text-xs">{t('auth.signup.passwordHint')}</p>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Icons.spinner className="mr-2 w-4 h-4 animate-spin" />}
          {t('auth.signup.createAccountButton')}
        </Button>
      </div>
      <div className="text-center text-sm">
        {t('auth.signup.alreadyHaveAccount')}{' '}
        <a href="/login" className="underline underline-offset-4">
          {t('auth.signup.signInLink')}
        </a>
      </div>
    </form>
  )
}
