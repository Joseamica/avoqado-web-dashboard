import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OnboardingStepProps } from '../OnboardingWizard'
import { NavigationButtons } from '../components/NavigationButtons'
import { AlertCircle } from 'lucide-react'

export interface PaymentInfoData {
  clabe: string
  bankName?: string
  accountHolder: string
}

interface PaymentInfoStepProps extends OnboardingStepProps {
  onSave: (data: PaymentInfoData) => void
  initialValue?: PaymentInfoData
  isLoading?: boolean
}

export function PaymentInfoStep({ onNext, onPrevious, isFirstStep, onSave, initialValue, isLoading }: PaymentInfoStepProps) {
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
  const [accountHolderError, setAccountHolderError] = useState('')

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

  const handleAccountHolderChange = (value: string) => {
    setFormData({ ...formData, accountHolder: value })
    setAccountHolderError('')
  }

  const handleContinue = () => {
    setClabeError('')
    setAccountHolderError('')

    let hasError = false

    // Validate CLABE
    if (!formData.clabe.trim()) {
      setClabeError(t('payment.validation.clabeRequired'))
      hasError = true
    } else if (!/^\d+$/.test(formData.clabe)) {
      setClabeError(t('payment.validation.clabeNumeric'))
      hasError = true
    } else if (formData.clabe.length !== 18) {
      setClabeError(t('payment.validation.clabeInvalid'))
      hasError = true
    }

    // Validate Account Holder
    if (!formData.accountHolder.trim()) {
      setAccountHolderError(t('payment.validation.accountHolderRequired'))
      hasError = true
    }

    if (hasError) return

    onSave(formData)
    onNext()
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
              <Label htmlFor="clabe">
                {t('payment.form.clabe')} <span className="text-destructive">*</span>
              </Label>
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

            {/* Account Holder (Required) */}
            <div>
              <Label htmlFor="accountHolder">
                {t('payment.form.accountHolder')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="accountHolder"
                type="text"
                placeholder={t('payment.form.accountHolderPlaceholder')}
                value={formData.accountHolder}
                onChange={e => handleAccountHolderChange(e.target.value)}
                className={accountHolderError ? 'border-destructive' : ''}
              />
              {accountHolderError && <p className="mt-1 text-xs text-destructive">{accountHolderError}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Required Notice */}
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">{t('payment.requiredNotice')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fixed Navigation buttons */}
      <NavigationButtons
        onPrevious={onPrevious}
        onContinue={handleContinue}
        isFirstStep={isFirstStep}
        isLoading={isLoading}
      />
    </div>
  )
}
