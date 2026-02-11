import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { ALL_ENTITY_OPTIONS } from '@/config/entity-types'
import type { StepProps } from '../types'

export function EntityTypeStep({ data, onNext }: StepProps) {
  const { t } = useTranslation('setup')
  const [entityType, setEntityType] = useState(data.entityType || '')
  const [commercialName, setCommercialName] = useState(
    data.commercialName || data.businessName || '',
  )
  const [phone, setPhone] = useState(data.phone || '')

  const [phoneError, setPhoneError] = useState('')

  const handleNext = () => {
    if (!phone.trim()) {
      setPhoneError(t('step4.phoneRequired'))
      return
    }
    setPhoneError('')
    const selectedOption = ALL_ENTITY_OPTIONS.find((opt) => opt.value === entityType)
    onNext({
      entityType,
      entitySubType: selectedOption?.parentValue,
      commercialName,
      phone,
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t('step4.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('step4.subtitle')}</p>
      </div>

      <div className="flex flex-col gap-5">
        {/* Entity Type */}
        <div className="grid gap-2">
          <Label>{t('step4.entityTypeLabel')}</Label>
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger className="rounded-lg h-12 text-base">
              <SelectValue placeholder={t('step4.entityTypePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {ALL_ENTITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Commercial Name */}
        <div className="grid gap-2">
          <Label htmlFor="commercialName">{t('step4.commercialNameLabel')}</Label>
          <Input
            id="commercialName"
            value={commercialName}
            onChange={(e) => setCommercialName(e.target.value)}
            placeholder={t('step4.commercialNamePlaceholder')}
            className="rounded-lg h-12 text-base"
          />
          <p className="text-xs text-muted-foreground">{t('step4.commercialNameHint')}</p>
        </div>

        {/* Phone */}
        <div className="grid gap-2">
          <Label htmlFor="phone">{t('step4.phoneLabel')}</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              if (phoneError) setPhoneError('')
            }}
            placeholder={t('step4.phonePlaceholder')}
            className="rounded-lg h-12 text-base"
          />
          {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
        </div>
      </div>

      <Button onClick={handleNext} size="lg" className="w-full rounded-full h-12 text-base">
        {t('wizard.next')}
      </Button>
    </div>
  )
}
