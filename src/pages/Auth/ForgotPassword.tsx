import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react'
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
import { requestPasswordReset } from '@/services/auth.service'

interface ForgotPasswordFormData {
  email: string
}

const ForgotPassword: React.FC = () => {
  const { t } = useTranslation('auth')
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')

  // Create schema using translations
  const forgotPasswordSchema = z.object({
    email: z.string({ required_error: t('forgotPassword.emailRequired') }).email(t('forgotPassword.emailRequired')),
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsSubmitting(true)

    try {
      await requestPasswordReset(data.email)
      setSubmittedEmail(data.email)
      setEmailSent(true)

      toast({
        title: t('toast.password_reset_sent'),
        description: t('toast.password_reset_sent_desc'),
      })
    } catch (error: any) {
      console.error('Password reset error:', error)
      toast({
        variant: 'destructive',
        title: t('toast.password_reset_error_title'),
        description: error?.response?.data?.message || t('toast.password_reset_error_desc'),
      })
    } finally {
      setIsSubmitting(false)
    }
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
            {!emailSent ? (
              <Card className="border-border">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-2xl font-bold text-foreground">{t('forgotPassword.title')}</CardTitle>
                  <CardDescription className="text-muted-foreground">{t('forgotPassword.subtitle')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-foreground">
                        {t('forgotPassword.emailLabel')}
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder={t('forgotPassword.emailPlaceholder')}
                        className="bg-background text-foreground border-input"
                        {...register('email')}
                        disabled={isSubmitting}
                      />
                      {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                    </div>

                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('forgotPassword.sending')}
                        </>
                      ) : (
                        <>
                          <Mail className="mr-2 h-4 w-4" />
                          {t('forgotPassword.sendLinkButton')}
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
                  <CardTitle className="text-2xl font-bold text-foreground">{t('forgotPassword.successTitle')}</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {t('forgotPassword.successDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert className="border-primary/20 bg-primary/5">
                    <Mail className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-sm text-muted-foreground">
                      {submittedEmail}
                    </AlertDescription>
                  </Alert>

                  <p className="text-sm text-muted-foreground text-center">{t('forgotPassword.checkSpamNote')}</p>

                  <div className="text-center pt-4">
                    <Link to="/login" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                      <ArrowLeft className="h-3 w-3" />
                      {t('forgotPassword.backToLogin')}
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        <div className="text-center text-sm text-muted-foreground">
          {t('forgotPassword.brandTitle')} · {t('forgotPassword.brandSubtitle')}
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <img
          src={CoverLogin}
          alt={t('forgotPassword.imageAlt')}
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  )
}

export default ForgotPassword
