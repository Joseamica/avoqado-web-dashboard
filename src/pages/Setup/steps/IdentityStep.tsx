import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Shield } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { AddressAutocomplete, type PlaceDetails } from '@/components/address-autocomplete'
import type { StepProps } from '../types'

export function IdentityStep({ data, onNext }: StepProps) {
  const { t } = useTranslation('setup')
  const [legalFirstName, setLegalFirstName] = useState(data.legalFirstName || '')
  const [legalLastName, setLegalLastName] = useState(data.legalLastName || '')
  const [personalPhone, setPersonalPhone] = useState(data.personalPhone || '')
  const [birthdate, setBirthdate] = useState(data.birthdate || '')
  const [rfc, setRfc] = useState(data.rfc || '')
  const [curp, setCurp] = useState(data.curp || '')
  const [legalAddress, setLegalAddress] = useState(data.legalAddress || '')
  const [legalCity, setLegalCity] = useState(data.legalCity || '')
  const [legalState, setLegalState] = useState(data.legalState || '')
  const [legalCountry, setLegalCountry] = useState(data.legalCountry || '')
  const [legalZipCode, setLegalZipCode] = useState(data.legalZipCode || '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleAddressSelect = (place: PlaceDetails) => {
    setLegalAddress(place.address)
    setLegalCity(place.city)
    setLegalState(place.state)
    setLegalCountry(place.country)
    setLegalZipCode(place.zipCode)
  }

  const handleNext = () => {
    const newErrors: Record<string, string> = {}
    if (!legalFirstName.trim()) newErrors.legalFirstName = t('step5.legalFirstNameLabel')
    if (!legalLastName.trim()) newErrors.legalLastName = t('step5.legalLastNameLabel')
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})
    onNext({
      legalFirstName: legalFirstName.trim(),
      legalLastName: legalLastName.trim(),
      personalPhone,
      birthdate,
      rfc: rfc.toUpperCase(),
      curp: curp.toUpperCase(),
      legalAddress,
      legalCity,
      legalState,
      legalCountry,
      legalZipCode,
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t('step5.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('step5.subtitle')}</p>
      </div>

      <div className="flex flex-col gap-5">
        {/* Legal Name — two columns */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="legalFirstName">{t('step5.legalFirstNameLabel')}</Label>
            <Input
              id="legalFirstName"
              value={legalFirstName}
              onChange={(e) => setLegalFirstName(e.target.value)}
              placeholder={t('step5.legalFirstNamePlaceholder')}
              className="rounded-lg h-12 text-base"
              autoFocus
            />
            {errors.legalFirstName && (
              <p className="text-xs text-destructive">{errors.legalFirstName}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="legalLastName">{t('step5.legalLastNameLabel')}</Label>
            <Input
              id="legalLastName"
              value={legalLastName}
              onChange={(e) => setLegalLastName(e.target.value)}
              placeholder={t('step5.legalLastNamePlaceholder')}
              className="rounded-lg h-12 text-base"
            />
            {errors.legalLastName && (
              <p className="text-xs text-destructive">{errors.legalLastName}</p>
            )}
          </div>
        </div>

        {/* Phone + Birthdate — two columns */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="personalPhone">{t('step5.phoneLabel')}</Label>
            <Input
              id="personalPhone"
              type="tel"
              value={personalPhone}
              onChange={(e) => setPersonalPhone(e.target.value)}
              placeholder={t('step5.phonePlaceholder')}
              className="rounded-lg h-12 text-base"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="birthdate">{t('step5.birthdateLabel')}</Label>
            <Input
              id="birthdate"
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              placeholder={t('step5.birthdatePlaceholder')}
              className="rounded-lg h-12 text-base"
            />
          </div>
        </div>

        {/* RFC */}
        <div className="grid gap-2">
          <Label htmlFor="rfc">{t('step5.rfcLabel')}</Label>
          <Input
            id="rfc"
            value={rfc}
            onChange={(e) => setRfc(e.target.value.toUpperCase())}
            placeholder={t('step5.rfcPlaceholder')}
            maxLength={13}
            className="rounded-lg"
          />
          <p className="text-xs text-muted-foreground">{t('step5.rfcHint')}</p>
        </div>

        {/* CURP */}
        <div className="grid gap-2">
          <Label htmlFor="curp">{t('step5.curpLabel')}</Label>
          <Input
            id="curp"
            value={curp}
            onChange={(e) => setCurp(e.target.value.toUpperCase())}
            placeholder={t('step5.curpPlaceholder')}
            maxLength={18}
            className="rounded-lg"
          />
          <p className="text-xs text-muted-foreground">{t('step5.curpHint')}</p>
        </div>

        {/* Legal Address */}
        <div className="grid gap-2">
          <Label>{t('step5.legalAddressLabel')}</Label>
          <AddressAutocomplete
            value={legalAddress}
            onAddressSelect={handleAddressSelect}
            placeholder={t('step5.legalAddressPlaceholder')}
            countries={['mx']}
            className="h-12 text-base rounded-lg"
          />
        </div>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/50 p-4">
        <Shield className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{t('step5.securityNotice')}</p>
      </div>

      <Button onClick={handleNext} size="lg" className="w-full rounded-full h-12 text-base">
        {t('wizard.next')}
      </Button>
    </div>
  )
}
