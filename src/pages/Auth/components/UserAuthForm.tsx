import React, { useEffect, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { LoginDto } from '@/services/auth.service'

// Usando la interfaz LoginDto del servicio de autenticación
type Inputs = LoginDto

export function UserAuthForm({ className, ...props }: React.ComponentProps<'form'>) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { login, loginWithGoogle, isAuthenticated, isLoading } = useAuth()
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const from = (location.state as any)?.from?.pathname || '/'

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
    // No need for try/catch here since login is handled by React Query mutation
    // which has its own error handling in the AuthContext
    login(formData)
  }

  const handleGoogleLogin = async () => {
    try {
      setIsGoogleLoading(true)
      await loginWithGoogle()
    } catch {
      setIsGoogleLoading(false)
      // Error is handled in the context
    }
  }

  return (
    <form className={cn('flex flex-col gap-6', className)} {...props} onSubmit={handleSubmit(onSubmit)}>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">{t('auth.login.title')}</h1>
        <p className="text-muted-foreground text-sm text-balance">{t('auth.login.subtitle')}</p>
      </div>
      <div className="grid gap-6">
        <div className="grid gap-3">
          <Label htmlFor="email">{t('auth.login.emailLabel')}</Label>
          <Input
            {...register('email', { required: t('auth.login.emailRequired') })}
            id="email"
            type="email"
            placeholder={t('auth.login.emailPlaceholder')}
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect="off"
            disabled={isLoading}
            className={cn('w-full', errors.email && 'border-red-500')}
          />
          {errors.email && <span style={{ color: 'red', fontSize: '12px', paddingLeft: 5 }}>{errors.email.message}</span>}
        </div>
        <div className="grid gap-3">
          <div className="flex items-center">
            <Label htmlFor="password">{t('auth.login.passwordLabel')}</Label>
            <a href="#" className="ml-auto text-sm underline-offset-4 hover:underline">
              {t('auth.login.forgotPassword')}
            </a>
          </div>
          <Input
            {...register('password', { required: t('auth.login.passwordRequired') })}
            id="password"
            type="password"
            autoComplete="current-password"
            disabled={isLoading}
            className={cn('w-full', errors.password && 'border-red-500')}
          />
          {errors.password && <span style={{ color: 'red', fontSize: '12px', paddingLeft: 5 }}>{errors.password.message}</span>}
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Icons.spinner className="mr-2 w-4 h-4 animate-spin" />}
          {t('auth.login.signInButton')}
        </Button>
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-background px-4 text-muted-foreground">{t('auth.login.orContinueWith')}</span>
          </div>
        </div>
        <Button variant="outline" className="w-full" type="button" disabled={isLoading || isGoogleLoading} onClick={handleGoogleLogin}>
          {isGoogleLoading ? (
            <Icons.spinner className="mr-2 w-4 h-4 animate-spin" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="mr-2 w-4 h-4">
              <path
                d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                fill="currentColor"
              />
            </svg>
          )}
          {t('auth.login.continueWithGoogle')}
        </Button>
      </div>
      <div className="text-center text-sm">
        {t('auth.login.noAccount')}{' '}
        <a href="#" className="underline underline-offset-4">
          {t('auth.login.signUp')}
        </a>
      </div>
      {/* Auth errors are surfaced via toasts in AuthContext */}
    </form>
  )
}
