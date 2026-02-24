import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { type ProviderCostStructure, paymentProviderAPI } from '@/services/paymentProvider.service'
import { Loader2, Info } from 'lucide-react'

interface ProviderCostStructureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  costStructure?: ProviderCostStructure | null
  merchantAccountId?: string
  onSave: (data: {
    merchantAccountId: string
    effectiveFrom: string
    debitRate: number
    creditRate: number
    amexRate: number
    internationalRate: number
    fixedCostPerTransaction?: number
    monthlyFee?: number
    proposalReference?: string
    notes?: string
  }) => Promise<void>
}

export const ProviderCostStructureDialog: React.FC<ProviderCostStructureDialogProps> = ({
  open,
  onOpenChange,
  costStructure,
  merchantAccountId: initialMerchantAccountId,
  onSave,
}) => {
  const { t } = useTranslation('venuePricing')
  const [loading, setLoading] = useState(false)

  // Fetch merchant accounts for dropdown
  const { data: accounts = [] } = useQuery({
    queryKey: ['merchant-accounts-list'],
    queryFn: () => paymentProviderAPI.getAllMerchantAccounts({ active: true }),
  })

  const [formData, setFormData] = useState({
    merchantAccountId: initialMerchantAccountId || '',
    effectiveFrom: new Date().toISOString().split('T')[0],
    debitRate: 0,
    creditRate: 0,
    amexRate: 0,
    internationalRate: 0,
    fixedCostPerTransaction: 0,
    monthlyFee: 0,
    proposalReference: '',
    notes: '',
  })

  useEffect(() => {
    if (costStructure) {
      setFormData({
        merchantAccountId: costStructure.merchantAccountId,
        effectiveFrom: costStructure.effectiveFrom.split('T')[0],
        debitRate: Number(costStructure.debitRate) * 100, // Convert to percentage
        creditRate: Number(costStructure.creditRate) * 100,
        amexRate: Number(costStructure.amexRate) * 100,
        internationalRate: Number(costStructure.internationalRate) * 100,
        fixedCostPerTransaction: Number(costStructure.fixedCostPerTransaction) || 0,
        monthlyFee: Number(costStructure.monthlyFee) || 0,
        proposalReference: costStructure.proposalReference || '',
        notes: costStructure.notes || '',
      })
    } else {
      setFormData({
        merchantAccountId: initialMerchantAccountId || '',
        effectiveFrom: new Date().toISOString().split('T')[0],
        debitRate: 0,
        creditRate: 0,
        amexRate: 0,
        internationalRate: 0,
        fixedCostPerTransaction: 0,
        monthlyFee: 0,
        proposalReference: '',
        notes: '',
      })
    }
  }, [costStructure, initialMerchantAccountId, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSave({
        merchantAccountId: formData.merchantAccountId,
        effectiveFrom: new Date(formData.effectiveFrom).toISOString(),
        debitRate: formData.debitRate / 100, // Convert back to decimal
        creditRate: formData.creditRate / 100,
        amexRate: formData.amexRate / 100,
        internationalRate: formData.internationalRate / 100,
        fixedCostPerTransaction: formData.fixedCostPerTransaction,
        monthlyFee: formData.monthlyFee,
        proposalReference: formData.proposalReference || undefined,
        notes: formData.notes || undefined,
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving cost structure:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-background">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('providerCostDialog.title')}</DialogTitle>
            <DialogDescription>{t('providerCostDialog.subtitle')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Info Banner */}
            <div className="flex items-start space-x-2 text-sm bg-blue-50 dark:bg-blue-950/50 p-3 rounded-md border border-blue-200 dark:border-blue-800">
              <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="text-blue-800 dark:text-blue-200">
                <p className="font-medium">{t('providerCostDialog.title')}</p>
                <p className="text-xs mt-1">{t('providerCostDialog.description')}</p>
              </div>
            </div>

            {/* Merchant Account */}
            <div className="grid gap-2">
              <Label htmlFor="merchantAccount">
                Merchant Account <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.merchantAccountId}
                onValueChange={value => setFormData({ ...formData, merchantAccountId: value })}
                disabled={!!costStructure || !!initialMerchantAccountId}
              >
                <SelectTrigger className="bg-background border-input">
                  <SelectValue placeholder={t('providerCostDialog.selectMerchant')} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.displayName || account.alias}
                      {account.provider && ` - ${account.provider.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Effective From */}
            <div className="grid gap-2">
              <Label htmlFor="effectiveFrom">
                Effective From <span className="text-destructive">*</span>
              </Label>
              <Input
                id="effectiveFrom"
                type="date"
                value={formData.effectiveFrom}
                onChange={e => setFormData({ ...formData, effectiveFrom: e.target.value })}
                required
                className="bg-background border-input"
              />
              <p className="text-xs text-muted-foreground">{t('providerCostDialog.effectiveDateHint')}</p>
            </div>

            {/* Rate Grid */}
            <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
              <Label className="text-base font-semibold">{t('providerCostDialog.cardRates')}</Label>

              <div className="grid grid-cols-2 gap-3">
                {/* Debit Rate */}
                <div className="grid gap-2">
                  <Label htmlFor="debitRate">{t('providerCostDialog.debitRate')}</Label>
                  <Input
                    id="debitRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.debitRate}
                    onChange={e => setFormData({ ...formData, debitRate: parseFloat(e.target.value) || 0 })}
                    placeholder="2.0"
                    className="bg-background border-input"
                  />
                </div>

                {/* Credit Rate */}
                <div className="grid gap-2">
                  <Label htmlFor="creditRate">{t('providerCostDialog.creditRate')}</Label>
                  <Input
                    id="creditRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.creditRate}
                    onChange={e => setFormData({ ...formData, creditRate: parseFloat(e.target.value) || 0 })}
                    placeholder="2.3"
                    className="bg-background border-input"
                  />
                </div>

                {/* Amex Rate */}
                <div className="grid gap-2">
                  <Label htmlFor="amexRate">{t('providerCostDialog.amexRate')}</Label>
                  <Input
                    id="amexRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.amexRate}
                    onChange={e => setFormData({ ...formData, amexRate: parseFloat(e.target.value) || 0 })}
                    placeholder="3.0"
                    className="bg-background border-input"
                  />
                </div>

                {/* International Rate */}
                <div className="grid gap-2">
                  <Label htmlFor="internationalRate">{t('providerCostDialog.internationalRate')}</Label>
                  <Input
                    id="internationalRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.internationalRate}
                    onChange={e => setFormData({ ...formData, internationalRate: parseFloat(e.target.value) || 0 })}
                    placeholder="3.1"
                    className="bg-background border-input"
                  />
                </div>
              </div>
            </div>

            {/* Fixed Fees */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="fixedCostPerTransaction">{t('providerCostDialog.fixedCost')}</Label>
                <Input
                  id="fixedCostPerTransaction"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.fixedCostPerTransaction}
                  onChange={e => setFormData({ ...formData, fixedCostPerTransaction: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="bg-background border-input"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="monthlyFee">{t('providerCostDialog.monthlyFee')}</Label>
                <Input
                  id="monthlyFee"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.monthlyFee}
                  onChange={e => setFormData({ ...formData, monthlyFee: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="bg-background border-input"
                />
              </div>
            </div>

            {/* Proposal Reference */}
            <div className="grid gap-2">
              <Label htmlFor="proposalReference">{t('providerCostDialog.proposalRef')}</Label>
              <Input
                id="proposalReference"
                value={formData.proposalReference}
                onChange={e => setFormData({ ...formData, proposalReference: e.target.value })}
                placeholder={t('providerCostDialog.proposalRefPlaceholder')}
                className="bg-background border-input"
              />
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="notes">{t('providerCostDialog.notes')}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('providerCostDialog.notesPlaceholder')}
                rows={3}
                className="bg-background border-input"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {costStructure ? 'Update Cost Structure' : 'Create Cost Structure'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
