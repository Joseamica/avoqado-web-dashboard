import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, Plus, Mail } from 'lucide-react'
import { OnboardingStepProps } from '../OnboardingWizard'

export interface TeamInvite {
  email: string
  role: string
}

export interface TeamInvitesStepData {
  invites: TeamInvite[]
}

interface TeamInvitesStepProps extends OnboardingStepProps {
  onSave: (data: TeamInvitesStepData) => void
  initialValue?: TeamInvitesStepData
}

const ROLES = ['ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'HOST', 'VIEWER'] as const

export function TeamInvitesStep({ onNext, onPrevious, onSkip, isFirstStep, onSave, initialValue }: TeamInvitesStepProps) {
  const { t } = useTranslation('onboarding')
  const { t: tCommon } = useTranslation('common')

  const [invites, setInvites] = useState<TeamInvite[]>(initialValue?.invites || [])
  const [newInvite, setNewInvite] = useState({ email: '', role: '' })
  const [emailError, setEmailError] = useState('')

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleAddInvite = () => {
    setEmailError('')

    // Validate email
    if (!newInvite.email.trim()) {
      setEmailError(t('teamInvites.validation.emailRequired'))
      return
    }

    if (!validateEmail(newInvite.email)) {
      setEmailError(t('teamInvites.validation.emailInvalid'))
      return
    }

    if (!newInvite.role) {
      return
    }

    // Check for duplicates
    if (invites.some(invite => invite.email.toLowerCase() === newInvite.email.toLowerCase())) {
      setEmailError(t('teamInvites.validation.emailDuplicate'))
      return
    }

    setInvites(prev => [...prev, { email: newInvite.email, role: newInvite.role }])
    setNewInvite({ email: '', role: '' })
  }

  const handleRemoveInvite = (index: number) => {
    setInvites(prev => prev.filter((_, i) => i !== index))
  }

  const handleContinue = () => {
    onSave({ invites })
    onNext()
  }

  const handleSkip = () => {
    onSave({ invites: [] })
    if (onSkip) {
      onSkip()
    } else {
      onNext()
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">{t('teamInvites.title')}</h2>
        <p className="mt-2 text-muted-foreground">{t('teamInvites.subtitle')}</p>
      </div>

      {/* Team Invites Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">{t('teamInvites.description')}</p>
          </div>

          {/* Add Invite Form */}
          <div className="mb-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Label htmlFor="inviteEmail">{t('teamInvites.form.email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="inviteEmail"
                    type="email"
                    placeholder={t('teamInvites.form.emailPlaceholder')}
                    value={newInvite.email}
                    onChange={e => {
                      setNewInvite({ ...newInvite, email: e.target.value })
                      setEmailError('')
                    }}
                    className={`pl-9 ${emailError ? 'border-destructive' : ''}`}
                  />
                </div>
                {emailError && <p className="mt-1 text-xs text-destructive">{emailError}</p>}
              </div>
              <div>
                <Label htmlFor="inviteRole">{t('teamInvites.form.role')}</Label>
                <Select value={newInvite.role} onValueChange={value => setNewInvite({ ...newInvite, role: value })}>
                  <SelectTrigger id="inviteRole">
                    <SelectValue placeholder={t('teamInvites.form.rolePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(role => (
                      <SelectItem key={role} value={role}>
                        {t(`teamInvites.roles.${role}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="button" onClick={handleAddInvite} disabled={!newInvite.email || !newInvite.role} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              {t('teamInvites.form.add')}
            </Button>
          </div>

          {/* Invites List */}
          {invites.length > 0 ? (
            <div className="space-y-2">
              {invites.map((invite, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{invite.email}</p>
                    <p className="text-sm text-muted-foreground">{t(`teamInvites.roles.${invite.role}`)}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveInvite(index)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">{t('teamInvites.form.empty')}</p>
          )}
        </CardContent>
      </Card>

      {/* Skip Info */}
      <Card className="border-muted bg-muted/30">
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">{t('teamInvites.actions.skip')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('teamInvites.actions.skipDescription')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4">
        {!isFirstStep && (
          <Button type="button" variant="outline" onClick={onPrevious}>
            {tCommon('previous')}
          </Button>
        )}
        <div className={`flex gap-2 ${isFirstStep ? 'ml-auto' : ''}`}>
          <Button type="button" variant="outline" onClick={handleSkip}>
            {tCommon('skip')}
          </Button>
          <Button type="button" onClick={handleContinue}>
            {tCommon('continue')}
          </Button>
        </div>
      </div>
    </div>
  )
}
