import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Pencil, Plus, AlertCircle, Check, X } from 'lucide-react'
import { type VenuePricingStructure } from '@/services/paymentProvider.service'
import { useVenueDateTime } from '@/utils/datetime'

interface PricingTabsViewProps {
  venueId: string
  venueName: string
  primaryStructure?: VenuePricingStructure | null
  secondaryStructure?: VenuePricingStructure | null
  tertiaryStructure?: VenuePricingStructure | null
  primaryMerchantConfigured: boolean
  secondaryMerchantConfigured: boolean
  tertiaryMerchantConfigured: boolean
  onAdd: (accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY') => void
  onSave: (accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY', data: any) => Promise<void>
  calculateMargin?: (structure: VenuePricingStructure, rateType: string) => any
}

export const PricingTabsView: React.FC<PricingTabsViewProps> = ({
  venueId,
  venueName,
  primaryStructure,
  secondaryStructure,
  tertiaryStructure,
  primaryMerchantConfigured,
  secondaryMerchantConfigured,
  tertiaryMerchantConfigured,
  onAdd,
  onSave,
  calculateMargin,
}) => {
  const { t } = useTranslation('venuePricing')
  const { formatDate } = useVenueDateTime()
  const [activeTab, setActiveTab] = useState('primary')
  const [editingAccountType, setEditingAccountType] = useState<'PRIMARY' | 'SECONDARY' | 'TERTIARY' | null>(null)
  const [formData, setFormData] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)

  const formatRate = (rate: number) => `${(Number(rate) * 100).toFixed(2)}%`
  const parseRate = (rateString: string) => {
    const num = parseFloat(rateString)
    return isNaN(num) ? 0 : num / 100
  }

  const handleEdit = (structure: VenuePricingStructure, accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY') => {
    setEditingAccountType(accountType)
    setFormData({
      debitRate: (Number(structure.debitRate) * 100).toFixed(2),
      creditRate: (Number(structure.creditRate) * 100).toFixed(2),
      amexRate: (Number(structure.amexRate) * 100).toFixed(2),
      internationalRate: (Number(structure.internationalRate) * 100).toFixed(2),
      fixedFeePerTransaction: structure.fixedFeePerTransaction ? Number(structure.fixedFeePerTransaction).toFixed(2) : '',
      monthlyServiceFee: structure.monthlyServiceFee ? Number(structure.monthlyServiceFee).toFixed(2) : '',
      contractReference: structure.contractReference || '',
      effectiveFrom: structure.effectiveFrom.split('T')[0],
      active: structure.active,
    })
  }

  const handleCancel = () => {
    setEditingAccountType(null)
    setFormData(null)
  }

  const handleSave = async () => {
    if (!formData) return

    setIsSaving(true)
    try {
      const data = {
        venueId,
        accountType: editingAccountType,
        debitRate: parseRate(formData.debitRate),
        creditRate: parseRate(formData.creditRate),
        amexRate: parseRate(formData.amexRate),
        internationalRate: parseRate(formData.internationalRate),
        fixedFeePerTransaction: formData.fixedFeePerTransaction ? parseFloat(formData.fixedFeePerTransaction) : null,
        monthlyServiceFee: formData.monthlyServiceFee ? parseFloat(formData.monthlyServiceFee) : null,
        contractReference: formData.contractReference || null,
        effectiveFrom: formData.effectiveFrom,
        active: formData.active,
      }

      await onSave(editingAccountType!, data)
      setEditingAccountType(null)
      setFormData(null)
    } catch (error) {
      console.error('Failed to save pricing:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const renderRateCard = (
    structure: VenuePricingStructure | null | undefined,
    accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY',
    merchantConfigured: boolean
  ) => {
    if (!structure) {
      return (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No {accountType} Pricing Configured</h3>
            {merchantConfigured ? (
              <>
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Set rates for {accountType.toLowerCase()} account to start charging {venueName}
                </p>
                <Button onClick={() => onAdd(accountType)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add {accountType} Pricing
                </Button>
              </>
            ) : (
              <p className="text-sm text-orange-600 dark:text-orange-400 text-center">
                Configure {accountType} merchant account first in Step 2
              </p>
            )}
          </CardContent>
        </Card>
      )
    }

    const isEditing = editingAccountType === accountType

    return (
      <div className="space-y-6">
        {/* Status Badge and Actions */}
        <div className="flex items-center justify-between">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Switch
                checked={formData?.active ?? structure.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
              <Label className="text-sm">
                {formData?.active ? 'Active' : 'Inactive'}
              </Label>
            </div>
          ) : (
            <Badge className={structure.active ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200' : 'bg-muted text-muted-foreground'}>
              {structure.active ? 'Active' : 'Inactive'}
            </Badge>
          )}

          {isEditing ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                <Check className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => handleEdit(structure, accountType)}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit Rates
            </Button>
          )}
        </div>

        {/* Rate Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Debit Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('tabs.debitCard')}</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      value={formData?.debitRate || ''}
                      onChange={(e) => setFormData({ ...formData, debitRate: e.target.value })}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatRate(structure.debitRate)}
                  </div>
                  {calculateMargin && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Margin: +{calculateMargin(structure, 'debit')?.marginPercent.toFixed(2)}%
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Credit Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('tabs.creditCard')}</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      value={formData?.creditRate || ''}
                      onChange={(e) => setFormData({ ...formData, creditRate: e.target.value })}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatRate(structure.creditRate)}
                  </div>
                  {calculateMargin && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Margin: +{calculateMargin(structure, 'credit')?.marginPercent.toFixed(2)}%
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Amex */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('tabs.amex')}</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      value={formData?.amexRate || ''}
                      onChange={(e) => setFormData({ ...formData, amexRate: e.target.value })}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatRate(structure.amexRate)}
                  </div>
                  {calculateMargin && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Margin: +{calculateMargin(structure, 'amex')?.marginPercent.toFixed(2)}%
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* International */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('tabs.international')}</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      value={formData?.internationalRate || ''}
                      onChange={(e) => setFormData({ ...formData, internationalRate: e.target.value })}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatRate(structure.internationalRate)}
                  </div>
                  {calculateMargin && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Margin: +{calculateMargin(structure, 'international')?.marginPercent.toFixed(2)}%
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Additional Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('additionalInfo.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="effectiveFrom">{t('additionalInfo.effectiveFrom')}</Label>
                    <Input
                      id="effectiveFrom"
                      type="date"
                      value={formData?.effectiveFrom || ''}
                      onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fixedFee">{t('additionalInfo.fixedFee')}</Label>
                    <Input
                      id="fixedFee"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData?.fixedFeePerTransaction || ''}
                      onChange={(e) => setFormData({ ...formData, fixedFeePerTransaction: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthlyFee">{t('additionalInfo.monthlyFee')}</Label>
                    <Input
                      id="monthlyFee"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData?.monthlyServiceFee || ''}
                      onChange={(e) => setFormData({ ...formData, monthlyServiceFee: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contractRef">{t('additionalInfo.contractReference')}</Label>
                    <Input
                      id="contractRef"
                      type="text"
                      placeholder={t('additionalInfo.optional')}
                      value={formData?.contractReference || ''}
                      onChange={(e) => setFormData({ ...formData, contractReference: e.target.value })}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('summary.effectiveFrom')}</span>
                  <span className="font-medium">{formatDate(structure.effectiveFrom)}</span>
                </div>
                {structure.fixedFeePerTransaction && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('summary.fixedFee')}</span>
                    <span className="font-medium">${Number(structure.fixedFeePerTransaction).toFixed(2)}</span>
                  </div>
                )}
                {structure.monthlyServiceFee && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('summary.monthlyFee')}</span>
                    <span className="font-medium">${Number(structure.monthlyServiceFee).toFixed(2)}</span>
                  </div>
                )}
                {structure.contractReference && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('summary.contractReference')}</span>
                    <span className="font-medium">{structure.contractReference}</span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="primary">
          PRIMARY
          {primaryStructure && (
            <Badge variant="outline" className="ml-2 h-5">
              {primaryStructure.active ? '✓' : '○'}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="secondary">
          SECONDARY
          {secondaryStructure && (
            <Badge variant="outline" className="ml-2 h-5">
              {secondaryStructure.active ? '✓' : '○'}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="tertiary">
          TERTIARY
          {tertiaryStructure && (
            <Badge variant="outline" className="ml-2 h-5">
              {tertiaryStructure.active ? '✓' : '○'}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="primary" className="mt-6">
        {renderRateCard(primaryStructure, 'PRIMARY', primaryMerchantConfigured)}
      </TabsContent>

      <TabsContent value="secondary" className="mt-6">
        {renderRateCard(secondaryStructure, 'SECONDARY', secondaryMerchantConfigured)}
      </TabsContent>

      <TabsContent value="tertiary" className="mt-6">
        {renderRateCard(tertiaryStructure, 'TERTIARY', tertiaryMerchantConfigured)}
      </TabsContent>
    </Tabs>
  )
}
