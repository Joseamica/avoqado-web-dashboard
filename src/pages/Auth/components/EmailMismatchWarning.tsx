import { useTranslation } from 'react-i18next'
import { AlertCircle, LogOut, X, User, Mail, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface EmailMismatchWarningProps {
  sessionEmail: string
  invitationEmail: string
  onLogout: () => void
  onCancel: () => void
}

export function EmailMismatchWarning({
  sessionEmail,
  invitationEmail,
  onLogout,
  onCancel,
}: EmailMismatchWarningProps) {
  const { t } = useTranslation(['inviteAccept', 'common'])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50">
            <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle>{t('emailMismatch.title')}</CardTitle>
          <CardDescription>{t('emailMismatch.subtitle')}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Explanation text */}
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('emailMismatch.explanation')}
            </p>
          </div>

          {/* Email comparison - minimalist design */}
          <div className="space-y-3">
            {/* Current Session - subtle design */}
            <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">
                    {t('emailMismatch.currentSession')}
                  </p>
                  <p className="text-sm font-medium text-foreground break-all">
                    {sessionEmail}
                  </p>
                </div>
              </div>
            </div>

            {/* Divider with X icon - more visible */}
            <div className="flex items-center justify-center py-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/15 border-2 border-destructive/30">
                <X className="w-5 h-5 text-destructive font-bold" strokeWidth={3} />
              </div>
            </div>

            {/* Invitation Email - subtle design */}
            <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">
                    {t('emailMismatch.invitationFor')}
                  </p>
                  <p className="text-sm font-medium text-foreground break-all">
                    {invitationEmail}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Help text - subtle alert */}
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-800/30 p-3">
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              {t('emailMismatch.helpText')}
            </p>
          </div>

          <div className="space-y-2">
            <Button onClick={onLogout} className="w-full" size="lg">
              <LogOut className="mr-2 h-4 w-4" />
              {t('emailMismatch.logoutAndContinue')}
            </Button>
            <Button onClick={onCancel} variant="outline" className="w-full" size="lg">
              {t('common:cancel')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
