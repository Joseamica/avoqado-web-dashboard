import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import Logo from '@/assets/logo'
import CoverLogin from '@/assets/cover-login.png'
import { UserAuthForm } from './components/UserAuthForm'
import { ThemeToggle } from '@/components/theme-toggle'
import LanguageSwitcher from '@/components/language-switcher'
import { clearAllChatStorage } from '@/services/chatService'
import { useToast } from '@/hooks/use-toast'
import { useGoogleOneTap } from '@/hooks/useGoogleOneTap'
import { useAuth } from '@/context/AuthContext'
import { liveDemoAutoLogin, isLiveDemoEnvironment } from '@/services/liveDemo.service'
import { useNavigate } from 'react-router-dom'

const Login: React.FC = () => {
  const { t } = useTranslation('auth')
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const { loginWithOneTap } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    clearAllChatStorage()

    // 🎭 Auto-login for live demo environment
    if (isLiveDemoEnvironment()) {
      setIsRedirecting(true)
      liveDemoAutoLogin()
        .then(() => {
          // Redirect to dashboard after successful auto-login
          window.location.href = '/'
        })
        .catch((error) => {
          console.error('Live demo auto-login failed:', error)
          setIsRedirecting(false)
          toast({
            title: 'Demo Error',
            description: 'Failed to initialize demo session. Please try again.',
            variant: 'destructive',
          })
        })
      return // Exit early, don't run other login logic
    }

    // Check if user just verified their email
    const verified = searchParams.get('verified')
    if (verified === 'true') {
      toast({
        title: t('verification.successTitle'),
        description: t('verification.successDescriptionLogin'),
      })
    }

    // Check if there's a pending invitation URL after logout
    const pendingInvitationUrl = localStorage.getItem('pendingInvitationUrl')
    if (pendingInvitationUrl) {
      setIsRedirecting(true)
      // Clear the stored URL
      localStorage.removeItem('pendingInvitationUrl')
      // Redirect to the invitation page
      window.location.href = pendingInvitationUrl
    }
  }, [searchParams, toast, t, navigate])

  // Initialize Google One Tap - DISABLED: bubble was intrusive
  useGoogleOneTap({
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    onSuccess: async (credential) => {
      try {
        await loginWithOneTap(credential)
      } catch (error) {
        // Error is already handled in AuthContext
        console.error('Google One Tap login failed:', error)
      }
    },
    onError: (error) => {
      // Silently fail - One Tap is a nice-to-have feature
      console.debug('Google One Tap not available:', error)
    },
    disabled: true, // Disabled - use regular Google Sign-In button instead
  })

  // Show loading state during redirect
  if (isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('login.redirecting')}</p>
        </div>
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
          <div className="w-full max-w-xs">
            <UserAuthForm />
          </div>
        </div>
        <div className="text-center text-sm text-muted-foreground">
          {t('login.termsText')}{' '}
          <Link to="/terms" className="underline underline-offset-4 hover:text-primary">
            {t('login.terms')}
          </Link>{' '}
          {t('login.and')}{' '}
          <Link to="/privacy" className="underline underline-offset-4 hover:text-primary">
            {t('login.privacy')}
          </Link>
          .
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <img
          src={CoverLogin}
          alt={t('login.imageAlt')}
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  )
}

export default Login
