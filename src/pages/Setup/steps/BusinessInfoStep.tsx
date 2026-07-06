import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { AddressAutocomplete, type PlaceDetails } from '@/components/address-autocomplete'
import { PhoneInput } from '@/components/phone-input'
import { useAuth } from '@/context/AuthContext'
import type { StepProps } from '../types'

// Lightweight email format check. The full validation lives on the backend
// (`Venue.email` accepts NULL but rejects malformed strings via prisma). We
// just stop the wizard from advancing with obvious typos.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function BusinessInfoStep({ data, onNext }: StepProps) {
  const { t } = useTranslation('setup')
  const { user } = useAuth()
  const [businessName, setBusinessName] = useState(data.businessName || '')
  // Phone is stored as E.164 (`+526648442154`) end-to-end so the backend has
  // a canonical format. PhoneInput handles the country + local split internally.
  const [phone, setPhone] = useState(data.phone || '')
  // Pre-fill with the signup email so the operator doesn't have to retype it;
  // they can still override before submitting. Without this default the field
  // was previously never collected at all (V2 wizard skipped it) and venues
  // landed with `Venue.email = NULL`.
  const [email, setEmail] = useState(data.email || user?.email || '')
  const [address, setAddress] = useState(data.address || '')
  const [city, setCity] = useState(data.city || '')
  const [state, setState] = useState(data.state || '')
  const [country, setCountry] = useState(data.country || 'MX')
  const [zipCode, setZipCode] = useState(data.zipCode || '')
  const [latitude, setLatitude] = useState(data.latitude || 0)
  const [longitude, setLongitude] = useState(data.longitude || 0)
  const [noPhysicalAddress, setNoPhysicalAddress] = useState(data.noPhysicalAddress || false)
  const [error, setError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [emailError, setEmailError] = useState('')

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
    // Require at least 8 digits total (country dial code + local number) to
    // avoid empty submissions or accidental short numbers.
    const digitCount = phone.replace(/\D/g, '').length
    const phoneErr = digitCount < 8 ? t('step2.phoneRequired') : ''
    const addrErr = !noPhysicalAddress && !address.trim() ? t('step2.addressRequired') : ''
    const trimmedEmail = email.trim()
    // Email is OPTIONAL: if left empty the backend falls back to the signup
    // email (Staff.email). We only validate format when the user actually
    // typed something — otherwise empty is a valid value.
    const emailErr = trimmedEmail && !EMAIL_RE.test(trimmedEmail)
      ? t('step2.emailInvalid', { defaultValue: 'Correo inválido' })
      : ''
    setError(nameErr)
    setPhoneError(phoneErr)
    setAddressError(addrErr)
    setEmailError(emailErr)
    if (nameErr || phoneErr || addrErr || emailErr) return
    onNext({
      businessName: businessName.trim(),
      phone,
      email: trimmedEmail,
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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{t('step2.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('step2.subtitle')}</p>
      </div>

      <div className="flex flex-col gap-5">
        {/* Business Name */}
        <div className="grid gap-2">
          <Label htmlFor="businessName">{t('step2.businessNameLabel')}</Label>
          <Input
            id="businessName"
            value={businessName}
            onChange={e => {
              setBusinessName(e.target.value)
              if (error) setError('')
            }}
            placeholder={t('step2.businessNamePlaceholder')}
            className="rounded-lg h-12 text-base"
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        {/* Phone — stored as E.164 (`+<dial><digits>`) so the backend has a
            canonical format. Defaults to MX dial code per Avoqado's primary market. */}
        <div className="grid gap-2">
          <Label htmlFor="phone">{t('step2.phoneLabel')}</Label>
          <PhoneInput
            id="phone"
            value={phone}
            onChange={next => {
              setPhone(next)
              if (phoneError) setPhoneError('')
            }}
            placeholder={t('step2.phonePlaceholder')}
            invalid={Boolean(phoneError)}
            className="rounded-lg"
          />
          {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
        </div>

        {/* Business contact email — OPTIONAL. Pre-filled with the signup email
            but the operator can clear it (backend falls back to Staff.email) or
            replace it with a shared business mailbox. Persisted as `Venue.email`
            on completion. */}
        <div className="grid gap-2">
          <Label htmlFor="businessEmail">
            {t('step2.emailLabel', { defaultValue: 'Correo del negocio' })}
            <span className="ml-2 text-xs font-normal text-muted-foreground">{t('common:optional', { defaultValue: '(opcional)' })}</span>
          </Label>
          <Input
            id="businessEmail"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={e => {
              setEmail(e.target.value)
              if (emailError) setEmailError('')
            }}
            placeholder={t('step2.emailPlaceholder', { defaultValue: 'hola@tunegocio.com' })}
            className="rounded-lg h-12 text-base"
          />
          <p className="text-xs text-muted-foreground">
            {t('step2.emailHint', {
              defaultValue: 'Pre-llenado con el correo con el que te registraste. Cámbialo si prefieres recibir las notificaciones en otro buzón.',
            })}
          </p>
          {emailError && <p className="text-xs text-destructive">{emailError}</p>}
        </div>

        {/* Address */}
        {!noPhysicalAddress && (
          <div className="grid gap-2">
            <Label>{t('step2.addressLabel')}</Label>
            <AddressAutocomplete
              value={address}
              onAddressSelect={place => {
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
            onCheckedChange={checked => setNoPhysicalAddress(checked === true)}
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
