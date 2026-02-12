import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Shield } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getBankFromClabe, isValidClabeFormat } from '@/config/mexican-banks'
import type { StepProps } from '../types'

export function BankAccountStep({ data, onNext }: StepProps) {
  const { t } = useTranslation('setup')
  const [clabe, setClabe] = useState(data.clabe || '')
  const [bankName, setBankName] = useState(data.bankName || '')
  const [accountHolder, setAccountHolder] = useState(data.accountHolder || '')
  const [accountType, setAccountType] = useState(data.accountType || '')
  const [clabeError, setClabeError] = useState('')
  const [accountHolderError, setAccountHolderError] = useState('')
  const [accountTypeError, setAccountTypeError] = useState('')

  // Auto-detect bank from CLABE
  useEffect(() => {
    if (clabe.length >= 3) {
      const detectedBank = getBankFromClabe(clabe)
      if (detectedBank) {
        setBankName(detectedBank)
      }
    }
  }, [clabe])

  const handleClabeChange = (value: string) => {
    // Only allow digits
    const digits = value.replace(/\D/g, '').slice(0, 18)
    setClabe(digits)
    if (clabeError) setClabeError('')
  }

  const handleNext = () => {
    const clabeErr = !isValidClabeFormat(clabe) ? t('step7.invalidClabe') : ''
    const holderErr = !accountHolder.trim() ? t('step7.accountHolderRequired') : ''
    const typeErr = !accountType ? t('step7.accountTypeRequired') : ''
    setClabeError(clabeErr)
    setAccountHolderError(holderErr)
    setAccountTypeError(typeErr)
    if (clabeErr || holderErr || typeErr) return
    onNext({
      clabe,
      bankName,
      accountHolder: accountHolder.trim(),
      accountType,
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t('step7.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('step7.subtitle')}</p>
      </div>

      <div className="flex flex-col gap-5">
        {/* CLABE */}
        <div className="grid gap-2">
          <Label htmlFor="clabe">{t('step7.clabeLabel')}</Label>
          <Input
            id="clabe"
            value={clabe}
            onChange={(e) => handleClabeChange(e.target.value)}
            placeholder={t('step7.clabePlaceholder')}
            maxLength={18}
            inputMode="numeric"
            className="rounded-lg h-12 text-base"
            autoFocus
          />
          {clabeError && <p className="text-xs text-destructive">{clabeError}</p>}
          <p className="text-xs text-muted-foreground">{t('step7.clabeHint')}</p>
        </div>

        {/* Bank Name (auto-detected) */}
        <div className="grid gap-2">
          <Label htmlFor="bankName">{t('step7.bankNameLabel')}</Label>
          <Input
            id="bankName"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder={t('step7.bankNamePlaceholder')}
            className="rounded-lg h-12 text-base"
          />
        </div>

        {/* Account Holder */}
        <div className="grid gap-2">
          <Label htmlFor="accountHolder">{t('step7.accountHolderLabel')}</Label>
          <Input
            id="accountHolder"
            value={accountHolder}
            onChange={(e) => {
              setAccountHolder(e.target.value)
              if (accountHolderError) setAccountHolderError('')
            }}
            placeholder={t('step7.accountHolderPlaceholder')}
            className="rounded-lg h-12 text-base"
          />
          {accountHolderError && <p className="text-xs text-destructive">{accountHolderError}</p>}
        </div>

        {/* Account Type */}
        <div className="grid gap-2">
          <Label>{t('step7.accountTypeLabel')}</Label>
          <Select value={accountType} onValueChange={(v) => {
            setAccountType(v)
            if (accountTypeError) setAccountTypeError('')
          }}>
            <SelectTrigger className="rounded-lg h-12 text-base">
              <SelectValue placeholder={t('step7.accountTypePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="checking">{t('step7.accountTypeChecking')}</SelectItem>
              <SelectItem value="savings">{t('step7.accountTypeSavings')}</SelectItem>
            </SelectContent>
          </Select>
          {accountTypeError && <p className="text-xs text-destructive">{accountTypeError}</p>}
        </div>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/50 p-4">
        <Shield className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{t('step7.securityNotice')}</p>
      </div>

      <Button onClick={handleNext} size="lg" className="w-full rounded-full h-12 text-base">
        {t('wizard.complete')}
      </Button>
    </div>
  )
}
