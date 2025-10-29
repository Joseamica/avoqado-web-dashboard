import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SignupForm } from './components/SignupForm'
import { EmailVerificationForm } from './components/EmailVerificationForm'
import { ThemeToggle } from '@/components/theme-toggle'
import LanguageSwitcher from '@/components/language-switcher'

export default function Signup() {
  const { t } = useTranslation('auth')
  const [showVerification, setShowVerification] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  const handleSignupSuccess = (email: string) => {
    setUserEmail(email)
    setShowVerification(true)
  }

  return (
    <div className="flex min-h-screen">
      {/* Left Side - Form */}
      <div className="flex w-full flex-col items-center justify-center px-4 py-12 lg:w-1/2">
        <div className="absolute top-4 right-4 flex gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md">
          {!showVerification ? (
            <SignupForm onSignupSuccess={handleSignupSuccess} />
          ) : (
            <EmailVerificationForm email={userEmail} />
          )}
        </div>
      </div>

      {/* Right Side - Image/Brand */}
      <div className="bg-muted hidden lg:flex lg:w-1/2 lg:items-center lg:justify-center">
        <div className="max-w-md text-center">
          <h2 className="text-foreground mb-4 text-3xl font-bold">{t('signup.welcomeTitle')}</h2>
          <p className="text-muted-foreground text-lg">{t('signup.welcomeSubtitle')}</p>
        </div>
      </div>
    </div>
  )
}
