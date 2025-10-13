import React, { useState, useEffect } from 'react'
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
import { Input } from '@/components/ui/input'
import { useTranslation } from 'react-i18next'
import { VenuePricingStructure } from '@/services/paymentProvider.service'

interface VenuePricingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pricing: VenuePricingStructure | null
  accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  venueId: string
  onSave: (data: {
    venueId: string
    accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
    effectiveFrom: string
    debitRate: number
    creditRate: number
    amexRate: number
    internationalRate: number
    fixedFeePerTransaction?: number
    monthlyServiceFee?: number
    notes?: string
  }) => Promise<void>
}

export const VenuePricingDialog: React.FC<VenuePricingDialogProps> = ({
  open,
  onOpenChange,
  pricing,
  accountType,
  venueId,
  onSave,
}) => {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state (percentages as actual numbers, not decimals)
  const [debitRate, setDebitRate] = useState('')
  const [creditRate, setCreditRate] = useState('')
  const [amexRate, setAmexRate] = useState('')
  const [internationalRate, setInternationalRate] = useState('')
  const [fixedFee, setFixedFee] = useState('')
  const [monthlyServiceFee, setMonthlyServiceFee] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [notes, setNotes] = useState('')

  // Populate form when pricing is provided
  useEffect(() => {
    if (pricing) {
      setDebitRate((pricing.debitRate * 100).toFixed(2))
      setCreditRate((pricing.creditRate * 100).toFixed(2))
      setAmexRate((pricing.amexRate * 100).toFixed(2))
      setInternationalRate((pricing.internationalRate * 100).toFixed(2))
      setFixedFee(pricing.fixedFeePerTransaction ? pricing.fixedFeePerTransaction.toString() : '')
      setMonthlyServiceFee(pricing.monthlyServiceFee ? pricing.monthlyServiceFee.toString() : '')
      setEffectiveFrom(pricing.effectiveFrom ? new Date(pricing.effectiveFrom).toISOString().split('T')[0] : '')
      setNotes(pricing.notes || '')
    } else {
      // Reset to empty for create mode
      setDebitRate('')
      setCreditRate('')
      setAmexRate('')
      setInternationalRate('')
      setFixedFee('')
      setMonthlyServiceFee('')
      // Default to today's date for new pricing
      setEffectiveFrom(new Date().toISOString().split('T')[0])
      setNotes('')
    }
  }, [pricing, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    if (!debitRate || !creditRate || !amexRate || !internationalRate || !effectiveFrom) {
      return
    }

    setIsSubmitting(true)
    try {
      await onSave({
        venueId,
        accountType,
        effectiveFrom,
        debitRate: parseFloat(debitRate) / 100, // Convert percentage to decimal
        creditRate: parseFloat(creditRate) / 100,
        amexRate: parseFloat(amexRate) / 100,
        internationalRate: parseFloat(internationalRate) / 100,
        fixedFeePerTransaction: fixedFee ? parseFloat(fixedFee) : undefined,
        monthlyServiceFee: monthlyServiceFee ? parseFloat(monthlyServiceFee) : undefined,
        notes: notes || undefined,
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving venue pricing:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {pricing ? t('venuePaymentConfig.editPricing') : t('venuePaymentConfig.createPricing')} -{' '}
            {t(`common.${accountType.toLowerCase()}`)}
          </DialogTitle>
          <DialogDescription>
            {t('venuePaymentConfig.pricingDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* Percentage Rates */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">{t('venuePaymentConfig.percentageRates')}</h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Debit Rate */}
                <div className="space-y-2">
                  <Label htmlFor="debitRate">
                    {t('venuePaymentConfig.debitRate')} <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="debitRate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={debitRate}
                      onChange={(e) => setDebitRate(e.target.value)}
                      placeholder="1.80"
                      required
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                </div>

                {/* Credit Rate */}
                <div className="space-y-2">
                  <Label htmlFor="creditRate">
                    {t('venuePaymentConfig.creditRate')} <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="creditRate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={creditRate}
                      onChange={(e) => setCreditRate(e.target.value)}
                      placeholder="2.10"
                      required
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                </div>

                {/* Amex Rate */}
                <div className="space-y-2">
                  <Label htmlFor="amexRate">
                    {t('venuePaymentConfig.amexRate')} <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="amexRate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={amexRate}
                      onChange={(e) => setAmexRate(e.target.value)}
                      placeholder="2.50"
                      required
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                </div>

                {/* International Rate */}
                <div className="space-y-2">
                  <Label htmlFor="internationalRate">
                    {t('venuePaymentConfig.internationalRate')} <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="internationalRate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={internationalRate}
                      onChange={(e) => setInternationalRate(e.target.value)}
                      placeholder="3.00"
                      required
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Fixed Fees */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">{t('venuePaymentConfig.fixedFees')}</h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Fixed Fee Per Transaction */}
                <div className="space-y-2">
                  <Label htmlFor="fixedFee">
                    {t('venuePaymentConfig.fixedFeePerTransaction')}
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input
                      id="fixedFee"
                      type="number"
                      step="0.01"
                      min="0"
                      value={fixedFee}
                      onChange={(e) => setFixedFee(e.target.value)}
                      placeholder="0.50"
                      className="pl-8"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('venuePaymentConfig.fixedFeeHelp')}
                  </p>
                </div>

                {/* Monthly Service Fee */}
                <div className="space-y-2">
                  <Label htmlFor="monthlyServiceFee">
                    {t('venuePaymentConfig.monthlyServiceFee')}
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input
                      id="monthlyServiceFee"
                      type="number"
                      step="0.01"
                      min="0"
                      value={monthlyServiceFee}
                      onChange={(e) => setMonthlyServiceFee(e.target.value)}
                      placeholder="0.00"
                      className="pl-8"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Effective Date */}
            <div className="space-y-2">
              <Label htmlFor="effectiveFrom">
                {t('venuePaymentConfig.effectiveFrom')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="effectiveFrom"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                {t('venuePaymentConfig.effectiveFromHelp')}
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">
                {t('venuePaymentConfig.notes')}
              </Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('venuePaymentConfig.notesPlaceholder')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={!debitRate || !creditRate || !amexRate || !internationalRate || !effectiveFrom || isSubmitting}
            >
              {isSubmitting ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
