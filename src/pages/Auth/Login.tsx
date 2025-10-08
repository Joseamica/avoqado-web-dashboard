import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import Logo from '@/assets/logo'
import CoverLogin from '@/assets/cover-login.png'
import { UserAuthForm } from './components/UserAuthForm'
import { ThemeToggle } from '@/components/theme-toggle'
import LanguageSwitcher from '@/components/language-switcher'

const Login: React.FC = () => {
  const { t } = useTranslation()

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
          <div className="w-full max-w-xs">
            <UserAuthForm />
          </div>
        </div>
        <div className="text-center text-sm text-muted-foreground">
          {t('auth.login.termsText')}{' '}
          <Link to="/terms" className="underline underline-offset-4 hover:text-primary">
            {t('auth.login.terms')}
          </Link>{' '}
          {t('auth.login.and')}{' '}
          <Link to="/privacy" className="underline underline-offset-4 hover:text-primary">
            {t('auth.login.privacy')}
          </Link>
          .
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <img
          src={CoverLogin}
          alt={t('auth.login.imageAlt')}
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  )
}

export default Login
