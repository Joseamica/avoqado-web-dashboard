import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface InvitationDetails {
  id: string
  email: string
  role: string
  roleDisplayName?: string | null // Custom role name from venue settings (if configured)
  organizationName: string
  venueName: string
  inviterName: string
}

interface DirectAcceptInvitationProps {
  invitationDetails: InvitationDetails
  onAccept: (pin?: string) => void
  isAccepting?: boolean
  /**
   * The inviter demanded a PIN for TPV access. The identity is already proven by the session, so
   * this screen collects the PIN and nothing else — asking someone who signed in with Google to
   * also invent a password would be asking for a credential they never wanted.
   */
  requirePin?: boolean
}

const PIN_PATTERN = /^\d{4,10}$/

export function DirectAcceptInvitation({
  invitationDetails,
  onAccept,
  isAccepting = false,
  requirePin = false,
}: DirectAcceptInvitationProps) {
  const { t } = useTranslation(['inviteAccept', 'common'])
  const [pin, setPin] = useState('')

  const pinValid = !requirePin || PIN_PATTERN.test(pin)
  const showPinError = requirePin && pin.length > 0 && !PIN_PATTERN.test(pin)

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/50">
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle>{t('directAccept.title')}</CardTitle>
          <CardDescription>
            {t('invitedTo')} <strong>{invitationDetails.organizationName}</strong>
            {invitationDetails.venueName && (
              <>
                {' '}
                {t('at')} <strong>{invitationDetails.venueName}</strong>
              </>
            )}{' '}
            {t('as')} <strong>{invitationDetails.roleDisplayName || invitationDetails.role}</strong>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              {t('directAccept.alreadyLoggedIn')} <strong>{invitationDetails.email}</strong>
            </AlertDescription>
          </Alert>

          <div className="bg-muted rounded-lg p-4">
            <p className="text-sm text-muted-foreground">
              {t('directAccept.description')}
            </p>
          </div>

          {requirePin && (
            <div className="space-y-2">
              <Label htmlFor="direct-accept-pin">{t('labels.pinRequired')}</Label>
              <Input
                id="direct-accept-pin"
                inputMode="numeric"
                autoComplete="off"
                maxLength={10}
                placeholder={t('placeholders.pin')}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              />
              {showPinError && <p className="text-sm text-red-600">{t('validation.pinFormat')}</p>}
            </div>
          )}

          <Button
            onClick={() => onAccept(requirePin ? pin : undefined)}
            className="w-full"
            size="lg"
            disabled={isAccepting || !pinValid}
          >
            {isAccepting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('directAccept.accepting')}
              </>
            ) : (
              t('directAccept.acceptButton', 'Accept invitation')
            )}
          </Button>

          <div className="text-center text-xs text-muted-foreground">
            {t('directAccept.note')}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
