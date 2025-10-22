import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OnboardingStepProps } from '../OnboardingWizard'

export interface PaymentInfoData {
  clabe: string
  bankName?: string
  accountHolder?: string
}

interface PaymentInfoStepProps extends OnboardingStepProps {
  onSave: (data: PaymentInfoData) => void
  initialValue?: PaymentInfoData
}

export function PaymentInfoStep({ onNext, onPrevious, onSkip, isFirstStep, onSave, initialValue }: PaymentInfoStepProps) {
  const { t } = useTranslation('onboarding')
  const { t: tCommon } = useTranslation('common')

  const [formData, setFormData] = useState<PaymentInfoData>(
    initialValue || {
      clabe: '',
      bankName: '',
      accountHolder: '',
    },
  )

  const [clabeError, setClabeError] = useState('')

  const validateClabe = (clabe: string): boolean => {
    if (!clabe) return false
    if (clabe.length !== 18) return false
    if (!/^\d+$/.test(clabe)) return false
    return true
  }

  const handleClabeChange = (value: string) => {
    setFormData({ ...formData, clabe: value })
    setClabeError('')
  }

  const handleContinue = () => {
    setClabeError('')

    if (!formData.clabe.trim()) {
      setClabeError(t('payment.validation.clabeRequired'))
      return
    }

    if (!/^\d+$/.test(formData.clabe)) {
      setClabeError(t('payment.validation.clabeNumeric'))
      return
    }

    if (formData.clabe.length !== 18) {
      setClabeError(t('payment.validation.clabeInvalid'))
      return
    }

    onSave(formData)
    onNext()
  }

  const handleSkip = () => {
    onSave({ clabe: '' })
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
        <h2 className="text-2xl font-bold text-foreground">{t('payment.title')}</h2>
        <p className="mt-2 text-muted-foreground">{t('payment.subtitle')}</p>
      </div>

      {/* Payment Info Card */}
      <Card>
        <CardContent className="pt-6">
          <p className="mb-6 text-sm text-muted-foreground">{t('payment.description')}</p>

          <div className="space-y-4">
            {/* CLABE */}
            <div>
              <Label htmlFor="clabe">{t('payment.form.clabe')}</Label>
              <Input
                id="clabe"
                type="text"
                maxLength={18}
                placeholder={t('payment.form.clabePlaceholder')}
                value={formData.clabe}
                onChange={e => handleClabeChange(e.target.value)}
                className={clabeError ? 'border-destructive' : ''}
              />
              {!clabeError && <p className="mt-1 text-xs text-muted-foreground">{t('payment.form.clabeHelp')}</p>}
              {clabeError && <p className="mt-1 text-xs text-destructive">{clabeError}</p>}
            </div>

            {/* Bank Name (Optional) */}
            <div>
              <Label htmlFor="bankName">{t('payment.form.bankName')}</Label>
              <Input
                id="bankName"
                type="text"
                placeholder={t('payment.form.bankNamePlaceholder')}
                value={formData.bankName}
                onChange={e => setFormData({ ...formData, bankName: e.target.value })}
              />
            </div>

            {/* Account Holder (Optional) */}
            <div>
              <Label htmlFor="accountHolder">{t('payment.form.accountHolder')}</Label>
              <Input
                id="accountHolder"
                type="text"
                placeholder={t('payment.form.accountHolderPlaceholder')}
                value={formData.accountHolder}
                onChange={e => setFormData({ ...formData, accountHolder: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Skip Info */}
      <Card className="border-muted bg-muted/30">
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">{t('payment.actions.skip')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('payment.actions.skipDescription')}</p>
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
