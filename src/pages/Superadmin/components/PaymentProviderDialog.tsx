import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { type PaymentProvider } from '@/services/paymentProvider.service'
import { Loader2 } from 'lucide-react'

interface PaymentProviderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider?: PaymentProvider | null
  onSave: (data: Partial<PaymentProvider>) => Promise<void>
}

const PROVIDER_TYPES = [
  { value: 'PAYMENT_PROCESSOR', label: 'Payment Processor' },
  { value: 'GATEWAY', label: 'Gateway' },
  { value: 'WALLET', label: 'Digital Wallet' },
  { value: 'BANK_DIRECT', label: 'Bank Direct' },
  { value: 'AGGREGATOR', label: 'Aggregator' },
]

const COUNTRIES = [
  { value: 'MX', label: 'Mexico' },
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'BR', label: 'Brazil' },
  { value: 'AR', label: 'Argentina' },
  { value: 'CL', label: 'Chile' },
  { value: 'CO', label: 'Colombia' },
  { value: 'PE', label: 'Peru' },
]

export const PaymentProviderDialog: React.FC<PaymentProviderDialogProps> = ({
  open,
  onOpenChange,
  provider,
  onSave,
}) => {
  const { t: _t } = useTranslation('superadmin')
  const { t } = useTranslation('venuePricing')
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'PAYMENT_PROCESSOR' as PaymentProvider['type'],
    countryCode: [] as string[],
    active: true,
  })

  useEffect(() => {
    if (provider) {
      setFormData({
        code: provider.code,
        name: provider.name,
        type: provider.type,
        countryCode: provider.countryCode || [],
        active: provider.active,
      })
    } else {
      setFormData({
        code: '',
        name: '',
        type: 'PAYMENT_PROCESSOR',
        countryCode: [],
        active: true,
      })
    }
  }, [provider, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSave(formData)
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving provider:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleCountry = (country: string) => {
    setFormData(prev => ({
      ...prev,
      countryCode: prev.countryCode.includes(country)
        ? prev.countryCode.filter(c => c !== country)
        : [...prev.countryCode, country],
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px] bg-background">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {provider ? 'Edit Payment Provider' : 'Add Payment Provider'}
            </DialogTitle>
            <DialogDescription>
              {provider
                ? 'Update payment provider information'
                : 'Add a new payment provider to the system'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Code */}
            <div className="grid gap-2">
              <Label htmlFor="code">
                Provider Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="code"
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder={t('providerDialog.codePlaceholder')}
                required
                disabled={!!provider} // Can't change code after creation
                className="bg-background border-input"
              />
            </div>

            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">
                Provider Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('providerDialog.namePlaceholder')}
                required
                className="bg-background border-input"
              />
            </div>

            {/* Type */}
            <div className="grid gap-2">
              <Label htmlFor="type">
                Provider Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.type}
                onValueChange={(value: PaymentProvider['type']) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger className="bg-background border-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Countries */}
            <div className="grid gap-2">
              <Label>{t('providerDialog.supportedCountries')}</Label>
              <div className="grid grid-cols-2 gap-2 p-3 border border-border rounded-md bg-muted/50">
                {COUNTRIES.map(country => (
                  <div key={country.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`country-${country.value}`}
                      checked={formData.countryCode.includes(country.value)}
                      onCheckedChange={() => toggleCountry(country.value)}
                    />
                    <label
                      htmlFor={`country-${country.value}`}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {country.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Active */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="active"
                checked={formData.active}
                onCheckedChange={(checked: boolean) => setFormData({ ...formData, active: checked })}
              />
              <label
                htmlFor="active"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                Active
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {provider ? 'Update Provider' : 'Create Provider'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
