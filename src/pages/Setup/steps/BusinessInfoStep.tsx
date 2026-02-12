import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { AddressAutocomplete, type PlaceDetails } from '@/components/address-autocomplete'
import type { StepProps } from '../types'

export function BusinessInfoStep({ data, onNext }: StepProps) {
  const { t } = useTranslation('setup')
  const [businessName, setBusinessName] = useState(data.businessName || '')
  const [address, setAddress] = useState(data.address || '')
  const [city, setCity] = useState(data.city || '')
  const [state, setState] = useState(data.state || '')
  const [country, setCountry] = useState(data.country || 'MX')
  const [zipCode, setZipCode] = useState(data.zipCode || '')
  const [latitude, setLatitude] = useState(data.latitude || 0)
  const [longitude, setLongitude] = useState(data.longitude || 0)
  const [noPhysicalAddress, setNoPhysicalAddress] = useState(data.noPhysicalAddress || false)
  const [error, setError] = useState('')

  const handleAddressSelect = (place: PlaceDetails) => {
    setAddress(place.address)
    setCity(place.city)
    setState(place.state)
    setCountry(place.country)
    setZipCode(place.zipCode)
    setLatitude(place.latitude)
    setLongitude(place.longitude)
  }

  const [addressError, setAddressError] = useState('')

  const handleNext = () => {
    const nameErr = !businessName.trim() ? t('step2.businessNameRequired') : ''
    const addrErr = !noPhysicalAddress && !address.trim() ? t('step2.addressRequired') : ''
    setError(nameErr)
    setAddressError(addrErr)
    if (nameErr || addrErr) return
    onNext({
      businessName: businessName.trim(),
      address,
      city,
      state,
      country,
      zipCode,
      latitude,
      longitude,
      noPhysicalAddress,
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t('step2.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('step2.subtitle')}</p>
      </div>

      <div className="flex flex-col gap-5">
        {/* Business Name */}
        <div className="grid gap-2">
          <Label htmlFor="businessName">{t('step2.businessNameLabel')}</Label>
          <Input
            id="businessName"
            value={businessName}
            onChange={(e) => {
              setBusinessName(e.target.value)
              if (error) setError('')
            }}
            placeholder={t('step2.businessNamePlaceholder')}
            className="rounded-lg h-12 text-base"
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        {/* Address */}
        {!noPhysicalAddress && (
          <div className="grid gap-2">
            <Label>{t('step2.addressLabel')}</Label>
            <AddressAutocomplete
              value={address}
              onAddressSelect={(place) => {
                handleAddressSelect(place)
                if (addressError) setAddressError('')
              }}
              placeholder={t('step2.addressPlaceholder')}
              countries={['mx']}
              className="h-12 text-base rounded-lg"
            />
            {addressError && <p className="text-xs text-destructive">{addressError}</p>}
          </div>
        )}

        {/* No physical address checkbox */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="noPhysicalAddress"
            checked={noPhysicalAddress}
            onCheckedChange={(checked) => setNoPhysicalAddress(checked === true)}
          />
          <Label htmlFor="noPhysicalAddress" className="text-sm font-normal cursor-pointer">
            {t('step2.noPhysicalAddress')}
          </Label>
        </div>
      </div>

      <Button onClick={handleNext} size="lg" className="w-full rounded-full h-12 text-base">
        {t('wizard.next')}
      </Button>
    </div>
  )
}
