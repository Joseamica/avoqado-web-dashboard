import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  type VenuePricingStructure,
  paymentProviderAPI,
} from '@/services/paymentProvider.service'
import { Loader2, Info, TrendingUp } from 'lucide-react'
import api from '@/api'

interface VenuePricingStructureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pricingStructure?: VenuePricingStructure | null
  venueId?: string
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
    contractReference?: string
    notes?: string
  }) => Promise<void>
}

export const VenuePricingStructureDialog: React.FC<VenuePricingStructureDialogProps> = ({
  open,
  onOpenChange,
  pricingStructure,
  venueId: initialVenueId,
  onSave,
}) => {
  const { t: _t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [providerCost, setProviderCost] = useState<any>(null)

  // Fetch venues for dropdown
  const { data: venues = [] } = useQuery({
    queryKey: ['venues-list'],
    queryFn: async () => {
      const response = await api.get('/api/v1/dashboard/superadmin/venues')
      return response.data.data
    },
  })

  const [formData, setFormData] = useState({
    venueId: initialVenueId || '',
    accountType: 'PRIMARY' as 'PRIMARY' | 'SECONDARY' | 'TERTIARY',
    effectiveFrom: new Date().toISOString().split('T')[0],
    debitRate: 0,
    creditRate: 0,
    amexRate: 0,
    internationalRate: 0,
    fixedFeePerTransaction: 0,
    monthlyServiceFee: 0,
    contractReference: '',
    notes: '',
  })

  // Fetch provider cost for margin calculation
  useEffect(() => {
    if (formData.venueId) {
      // Fetch the venue's merchant account and get active cost structure
      paymentProviderAPI.getVenuePaymentConfigs({ venueId: formData.venueId })
        .then(configs => {
          if (configs.length > 0) {
            return paymentProviderAPI.getActiveCostStructure(configs[0].primaryAccountId)
          }
        })
        .then(cost => {
          if (cost) {
            setProviderCost(cost)
          }
        })
        .catch(console.error)
    }
  }, [formData.venueId])

  useEffect(() => {
    if (pricingStructure) {
      setFormData({
        venueId: pricingStructure.venueId,
        accountType: pricingStructure.accountType,
        effectiveFrom: pricingStructure.effectiveFrom.split('T')[0],
        debitRate: Number(pricingStructure.debitRate) * 100,
        creditRate: Number(pricingStructure.creditRate) * 100,
        amexRate: Number(pricingStructure.amexRate) * 100,
        internationalRate: Number(pricingStructure.internationalRate) * 100,
        fixedFeePerTransaction: Number(pricingStructure.fixedFeePerTransaction) || 0,
        monthlyServiceFee: Number(pricingStructure.monthlyServiceFee) || 0,
        contractReference: pricingStructure.contractReference || '',
        notes: pricingStructure.notes || '',
      })
    } else {
      setFormData({
        venueId: initialVenueId || '',
        accountType: 'PRIMARY',
        effectiveFrom: new Date().toISOString().split('T')[0],
        debitRate: 0,
        creditRate: 0,
        amexRate: 0,
        internationalRate: 0,
        fixedFeePerTransaction: 0,
        monthlyServiceFee: 0,
        contractReference: '',
        notes: '',
      })
    }
  }, [pricingStructure, initialVenueId, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSave({
        venueId: formData.venueId,
        accountType: formData.accountType,
        effectiveFrom: new Date(formData.effectiveFrom).toISOString(),
        debitRate: formData.debitRate / 100,
        creditRate: formData.creditRate / 100,
        amexRate: formData.amexRate / 100,
        internationalRate: formData.internationalRate / 100,
        fixedFeePerTransaction: formData.fixedFeePerTransaction || undefined,
        monthlyServiceFee: formData.monthlyServiceFee || undefined,
        contractReference: formData.contractReference || undefined,
        notes: formData.notes || undefined,
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving pricing structure:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate margins
  const calculateMargin = (venueRate: number, cardType: 'debit' | 'credit' | 'amex' | 'international') => {
    if (!providerCost) return null
    const providerRate = Number(providerCost[`${cardType}Rate`]) * 100
    const margin = venueRate - providerRate
    return { margin, providerRate }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-background">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {pricingStructure ? 'Edit Venue Pricing Structure' : 'Add Venue Pricing Structure'}
            </DialogTitle>
            <DialogDescription>
              Set the rates that you charge the venue (your client)
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Info Banner */}
            <div className="flex items-start space-x-2 text-sm bg-green-50 dark:bg-green-950/50 p-3 rounded-md border border-green-200 dark:border-green-800">
              <TrendingUp className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600 dark:text-green-400" />
              <div className="text-green-800 dark:text-green-200">
                <p className="font-medium">Venue Pricing Structure</p>
                <p className="text-xs mt-1">These are the rates YOU charge the venue. The difference between venue rates and provider costs is your profit margin.</p>
              </div>
            </div>

            {/* Venue */}
            <div className="grid gap-2">
              <Label htmlFor="venue">
                Venue <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.venueId}
                onValueChange={value => setFormData({ ...formData, venueId: value })}
                disabled={!!pricingStructure || !!initialVenueId}
              >
                <SelectTrigger className="bg-background border-input">
                  <SelectValue placeholder="Select venue..." />
                </SelectTrigger>
                <SelectContent>
                  {venues.map((venue: any) => (
                    <SelectItem key={venue.id} value={venue.id}>
                      {venue.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Account Type */}
            <div className="grid gap-2">
              <Label htmlFor="accountType">
                Account Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.accountType}
                onValueChange={(value: any) => setFormData({ ...formData, accountType: value })}
              >
                <SelectTrigger className="bg-background border-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIMARY">Primary Account</SelectItem>
                  <SelectItem value="SECONDARY">Secondary Account</SelectItem>
                  <SelectItem value="TERTIARY">Tertiary Account</SelectItem>
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
            </div>

            {/* Rate Grid */}
            <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
              <Label className="text-base font-semibold">Card Processing Rates (%)</Label>

              <div className="grid grid-cols-2 gap-3">
                {/* Debit Rate */}
                <div className="grid gap-2">
                  <Label htmlFor="debitRate">Debit Card Rate (%)</Label>
                  <Input
                    id="debitRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.debitRate}
                    onChange={e => setFormData({ ...formData, debitRate: parseFloat(e.target.value) || 0 })}
                    placeholder="2.2"
                    className="bg-background border-input"
                  />
                  {providerCost && formData.debitRate > 0 && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Margin: +{calculateMargin(formData.debitRate, 'debit')?.margin.toFixed(2)}%
                      (Cost: {calculateMargin(formData.debitRate, 'debit')?.providerRate.toFixed(2)}%)
                    </p>
                  )}
                </div>

                {/* Credit Rate */}
                <div className="grid gap-2">
                  <Label htmlFor="creditRate">Credit Card Rate (%)</Label>
                  <Input
                    id="creditRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.creditRate}
                    onChange={e => setFormData({ ...formData, creditRate: parseFloat(e.target.value) || 0 })}
                    placeholder="2.5"
                    className="bg-background border-input"
                  />
                  {providerCost && formData.creditRate > 0 && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Margin: +{calculateMargin(formData.creditRate, 'credit')?.margin.toFixed(2)}%
                      (Cost: {calculateMargin(formData.creditRate, 'credit')?.providerRate.toFixed(2)}%)
                    </p>
                  )}
                </div>

                {/* Amex Rate */}
                <div className="grid gap-2">
                  <Label htmlFor="amexRate">Amex Rate (%)</Label>
                  <Input
                    id="amexRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.amexRate}
                    onChange={e => setFormData({ ...formData, amexRate: parseFloat(e.target.value) || 0 })}
                    placeholder="3.2"
                    className="bg-background border-input"
                  />
                  {providerCost && formData.amexRate > 0 && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Margin: +{calculateMargin(formData.amexRate, 'amex')?.margin.toFixed(2)}%
                      (Cost: {calculateMargin(formData.amexRate, 'amex')?.providerRate.toFixed(2)}%)
                    </p>
                  )}
                </div>

                {/* International Rate */}
                <div className="grid gap-2">
                  <Label htmlFor="internationalRate">International Rate (%)</Label>
                  <Input
                    id="internationalRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.internationalRate}
                    onChange={e => setFormData({ ...formData, internationalRate: parseFloat(e.target.value) || 0 })}
                    placeholder="3.3"
                    className="bg-background border-input"
                  />
                  {providerCost && formData.internationalRate > 0 && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Margin: +{calculateMargin(formData.internationalRate, 'international')?.margin.toFixed(2)}%
                      (Cost: {calculateMargin(formData.internationalRate, 'international')?.providerRate.toFixed(2)}%)
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Fixed Fees */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="fixedFeePerTransaction">Fixed Fee per Transaction ($)</Label>
                <Input
                  id="fixedFeePerTransaction"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.fixedFeePerTransaction}
                  onChange={e => setFormData({ ...formData, fixedFeePerTransaction: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="bg-background border-input"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="monthlyServiceFee">Monthly Service Fee ($)</Label>
                <Input
                  id="monthlyServiceFee"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.monthlyServiceFee}
                  onChange={e => setFormData({ ...formData, monthlyServiceFee: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="bg-background border-input"
                />
              </div>
            </div>

            {/* Contract Reference */}
            <div className="grid gap-2">
              <Label htmlFor="contractReference">Contract Reference</Label>
              <Input
                id="contractReference"
                value={formData.contractReference}
                onChange={e => setFormData({ ...formData, contractReference: e.target.value })}
                placeholder="CONTRACT-2025-001"
                className="bg-background border-input"
              />
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this pricing structure..."
                rows={3}
                className="bg-background border-input"
              />
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
              {pricingStructure ? 'Update Pricing Structure' : 'Create Pricing Structure'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
