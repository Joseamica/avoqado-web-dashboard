import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTranslation } from 'react-i18next'
import { paymentProviderAPI, type VenuePaymentConfig } from '@/services/paymentProvider.service'

interface VenuePaymentConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: VenuePaymentConfig | null
  venueId: string
  onSave: (data: {
    primaryAccountId: string
    secondaryAccountId?: string
    tertiaryAccountId?: string
    preferredProcessor?: string
  }) => Promise<void>
}

export const VenuePaymentConfigDialog: React.FC<VenuePaymentConfigDialogProps> = ({
  open,
  onOpenChange,
  config,
  venueId: _venueId,
  onSave,
}) => {
  const { t } = useTranslation('payment')
  const [primaryAccountId, setPrimaryAccountId] = useState('')
  const [secondaryAccountId, setSecondaryAccountId] = useState('')
  const [tertiaryAccountId, setTertiaryAccountId] = useState('')
  const [preferredProcessor, setPreferredProcessor] = useState('AUTO')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch merchant accounts for selection
  const { data: accounts = [] } = useQuery({
    queryKey: ['merchant-accounts-list'],
    queryFn: () => paymentProviderAPI.getMerchantAccountsList({ active: true }),
  })

  // Populate form when config is provided
  useEffect(() => {
    if (config) {
      setPrimaryAccountId(config.primaryAccountId || '')
      setSecondaryAccountId(config.secondaryAccountId || 'none')
      setTertiaryAccountId(config.tertiaryAccountId || 'none')
      setPreferredProcessor(config.preferredProcessor || 'AUTO')
    } else {
      setPrimaryAccountId('')
      setSecondaryAccountId('none')
      setTertiaryAccountId('none')
      setPreferredProcessor('AUTO')
    }
  }, [config])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!primaryAccountId) return

    setIsSubmitting(true)
    try {
      await onSave({
        primaryAccountId,
        secondaryAccountId: secondaryAccountId !== 'none' ? secondaryAccountId : undefined,
        tertiaryAccountId: tertiaryAccountId !== 'none' ? tertiaryAccountId : undefined,
        preferredProcessor,
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving config:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {config ? t('venuePaymentConfig.editConfig') : t('venuePaymentConfig.createConfig')}
          </DialogTitle>
          <DialogDescription>
            {t('venuePaymentConfig.configDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* Primary Account */}
            <div className="space-y-2">
              <Label htmlFor="primaryAccount">
                {t('venuePaymentConfig.primaryAccount')} <span className="text-destructive">*</span>
              </Label>
              <Select value={primaryAccountId} onValueChange={setPrimaryAccountId}>
                <SelectTrigger id="primaryAccount">
                  <SelectValue placeholder={t('venuePaymentConfig.selectAccount')} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.displayName || account.alias}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {t('venuePaymentConfig.primaryAccountDesc')}
              </p>
            </div>

            {/* Secondary Account */}
            <div className="space-y-2">
              <Label htmlFor="secondaryAccount">
                {t('venuePaymentConfig.secondaryAccount')} ({t('common.optional')})
              </Label>
              <Select value={secondaryAccountId} onValueChange={setSecondaryAccountId}>
                <SelectTrigger id="secondaryAccount">
                  <SelectValue placeholder={t('venuePaymentConfig.selectAccount')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('common.none')}</SelectItem>
                  {accounts
                    .filter(a => a.id !== primaryAccountId)
                    .map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.displayName || account.alias}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {t('venuePaymentConfig.secondaryAccountDesc')}
              </p>
            </div>

            {/* Tertiary Account */}
            <div className="space-y-2">
              <Label htmlFor="tertiaryAccount">
                {t('venuePaymentConfig.tertiaryAccount')} ({t('common.optional')})
              </Label>
              <Select value={tertiaryAccountId} onValueChange={setTertiaryAccountId}>
                <SelectTrigger id="tertiaryAccount">
                  <SelectValue placeholder={t('venuePaymentConfig.selectAccount')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('common.none')}</SelectItem>
                  {accounts
                    .filter(a =>
                      a.id !== primaryAccountId &&
                      (secondaryAccountId === 'none' || a.id !== secondaryAccountId)
                    )
                    .map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.displayName || account.alias}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {t('venuePaymentConfig.tertiaryAccountDesc')}
              </p>
            </div>

            {/* Preferred Processor */}
            <div className="space-y-2">
              <Label htmlFor="preferredProcessor">
                {t('venuePaymentConfig.preferredProcessor')}
              </Label>
              <Select value={preferredProcessor} onValueChange={setPreferredProcessor}>
                <SelectTrigger id="preferredProcessor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUTO">{t('venuePaymentConfig.processorAuto')}</SelectItem>
                  <SelectItem value="LEGACY">{t('venuePaymentConfig.processorLegacy')}</SelectItem>
                  <SelectItem value="MENTA">{t('venuePaymentConfig.processorMenta')}</SelectItem>
                  <SelectItem value="CLIP">{t('venuePaymentConfig.processorClip')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!primaryAccountId || isSubmitting}>
              {isSubmitting ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
