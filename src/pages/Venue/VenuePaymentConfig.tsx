import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CreditCard, Settings, AlertCircle, Loader2, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/context/AuthContext'
import { paymentProviderAPI } from '@/services/paymentProvider.service'
import { VenuePaymentConfigDialog } from './components/VenuePaymentConfigDialog'
import { CostStructuresDisplay } from './components/CostStructuresDisplay'
import { PricingStructuresDisplay } from './components/PricingStructuresDisplay'
import { VenuePricingDialog } from './components/VenuePricingDialog'
import { ProfitCalculator } from './components/ProfitCalculator'
import { useToast } from '@/hooks/use-toast'
import type { VenuePricingStructure } from '@/services/paymentProvider.service'

const VenuePaymentConfig: React.FC = () => {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { slug } = useParams<{ slug: string }>()
  const { getVenueBySlug } = useAuth()
  const queryClient = useQueryClient()
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false)
  const [selectedPricing, setSelectedPricing] = useState<VenuePricingStructure | null>(null)
  const [selectedAccountType, setSelectedAccountType] = useState<'PRIMARY' | 'SECONDARY' | 'TERTIARY'>('PRIMARY')

  // Get venue by slug from AuthContext
  const venue = getVenueBySlug(slug!)

  // Fetch payment config for this venue
  const { data: paymentConfig, isLoading: configLoading } = useQuery({
    queryKey: ['venue-payment-config', venue?.id],
    queryFn: () => paymentProviderAPI.getVenuePaymentConfigByVenueId(venue!.id),
    enabled: !!venue?.id,
  })

  // Fetch cost structures (provider costs)
  const { data: costStructures = [], isLoading: costsLoading } = useQuery({
    queryKey: ['venue-cost-structures', venue?.id],
    queryFn: () => paymentProviderAPI.getVenueCostStructuresByVenueId(venue!.id),
    enabled: !!venue?.id && !!paymentConfig,
  })

  // Fetch pricing structures (what we charge venues)
  const { data: pricingStructures = [], isLoading: pricingLoading } = useQuery({
    queryKey: ['venue-pricing-structures', venue?.id],
    queryFn: () => paymentProviderAPI.getVenuePricingStructuresByVenueId(venue!.id),
    enabled: !!venue?.id && !!paymentConfig,
  })

  // Create payment config mutation
  const createConfigMutation = useMutation({
    mutationFn: (data: any) => paymentProviderAPI.createVenuePaymentConfigByVenueId(venue!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-payment-config', venue?.id] })
      toast({ title: t('common.success'), description: t('venuePaymentConfig.createSuccess') })
    },
    onError: () => {
      toast({ title: t('common.error'), description: t('venuePaymentConfig.createError'), variant: 'destructive' })
    },
  })

  // Update payment config mutation
  const updateConfigMutation = useMutation({
    mutationFn: (data: any) =>
      paymentProviderAPI.updateVenuePaymentConfigByVenueId(venue!.id, paymentConfig!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-payment-config', venue?.id] })
      toast({ title: t('common.success'), description: t('venuePaymentConfig.updateSuccess') })
    },
    onError: () => {
      toast({ title: t('common.error'), description: t('venuePaymentConfig.updateError'), variant: 'destructive' })
    },
  })

  // Delete payment config mutation
  const deleteConfigMutation = useMutation({
    mutationFn: () => paymentProviderAPI.deleteVenuePaymentConfigByVenueId(venue!.id, paymentConfig!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-payment-config', venue?.id] })
      queryClient.invalidateQueries({ queryKey: ['venue-cost-structures', venue?.id] })
      queryClient.invalidateQueries({ queryKey: ['venue-pricing-structures', venue?.id] })
      toast({ title: t('common.success'), description: t('venuePaymentConfig.deleteSuccess') })
    },
    onError: () => {
      toast({ title: t('common.error'), description: t('venuePaymentConfig.deleteError'), variant: 'destructive' })
    },
  })

  // Create pricing structure mutation
  const createPricingMutation = useMutation({
    mutationFn: (data: any) => paymentProviderAPI.createVenuePricingStructure(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-pricing-structures', venue?.id] })
      toast({ title: t('common.success'), description: t('venuePaymentConfig.createSuccess') })
      setPricingDialogOpen(false)
    },
    onError: () => {
      toast({ title: t('common.error'), description: t('venuePaymentConfig.createError'), variant: 'destructive' })
    },
  })

  const handleSaveConfig = async (data: any) => {
    if (paymentConfig) {
      await updateConfigMutation.mutateAsync(data)
    } else {
      await createConfigMutation.mutateAsync(data)
    }
  }

  const handleDeleteConfig = async () => {
    if (confirm(t('venuePaymentConfig.confirmDelete'))) {
      await deleteConfigMutation.mutateAsync()
    }
  }

  const handleEditPricing = (pricing: VenuePricingStructure) => {
    setSelectedPricing(pricing)
    setSelectedAccountType(pricing.accountType)
    setPricingDialogOpen(true)
  }

  const handleCreatePricing = (accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY') => {
    setSelectedPricing(null)
    setSelectedAccountType(accountType)
    setPricingDialogOpen(true)
  }

  const handleSavePricing = async (data: any) => {
    await createPricingMutation.mutateAsync(data)
  }

  // Get PRIMARY pricing and cost for calculator
  const primaryPricing = pricingStructures.find(p => p.accountType === 'PRIMARY' && p.active)
  const primaryCost = costStructures.find(c => c.accountType === 'PRIMARY')

  if (configLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('venuePaymentConfig.title')}</h1>
          <p className="text-muted-foreground">{t('venuePaymentConfig.subtitle')}</p>
        </div>
        <Button onClick={() => setConfigDialogOpen(true)}>
          <Settings className="w-4 h-4 mr-2" />
          {paymentConfig ? t('venuePaymentConfig.configure') : t('venuePaymentConfig.create')}
        </Button>
      </div>

      {/* No Configuration Alert */}
      {!paymentConfig && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('venuePaymentConfig.noConfig')}
          </AlertDescription>
        </Alert>
      )}

      {/* Merchant Accounts */}
      {paymentConfig && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Primary Account */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{t('venuePaymentConfig.primaryAccount')}</span>
                <Badge variant="default">{t('common.primary')}</Badge>
              </CardTitle>
              <CardDescription>{t('venuePaymentConfig.primaryAccountDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {paymentConfig.primaryAccount ? (
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium">{paymentConfig.primaryAccount.displayName}</div>
                      <div className="text-sm text-muted-foreground">
                        {paymentConfig.primaryAccount.provider?.name}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('venuePaymentConfig.merchantId')}: {paymentConfig.primaryAccount.externalMerchantId}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">{t('venuePaymentConfig.notConfigured')}</div>
              )}
            </CardContent>
          </Card>

          {/* Secondary Account */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{t('venuePaymentConfig.secondaryAccount')}</span>
                <Badge variant="secondary">{t('common.secondary')}</Badge>
              </CardTitle>
              <CardDescription>{t('venuePaymentConfig.secondaryAccountDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {paymentConfig.secondaryAccount ? (
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium">{paymentConfig.secondaryAccount.displayName}</div>
                      <div className="text-sm text-muted-foreground">
                        {paymentConfig.secondaryAccount.provider?.name}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('venuePaymentConfig.merchantId')}: {paymentConfig.secondaryAccount.externalMerchantId}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">{t('venuePaymentConfig.optional')}</div>
              )}
            </CardContent>
          </Card>

          {/* Tertiary Account */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{t('venuePaymentConfig.tertiaryAccount')}</span>
                <Badge variant="outline">{t('common.tertiary')}</Badge>
              </CardTitle>
              <CardDescription>{t('venuePaymentConfig.tertiaryAccountDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {paymentConfig.tertiaryAccount ? (
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium">{paymentConfig.tertiaryAccount.displayName}</div>
                      <div className="text-sm text-muted-foreground">
                        {paymentConfig.tertiaryAccount.provider?.name}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('venuePaymentConfig.merchantId')}: {paymentConfig.tertiaryAccount.externalMerchantId}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">{t('venuePaymentConfig.optional')}</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Provider Cost Structures */}
      {paymentConfig && (
        <CostStructuresDisplay costStructures={costStructures} isLoading={costsLoading} />
      )}

      {/* Venue Pricing Structures */}
      {paymentConfig && (
        <PricingStructuresDisplay
          pricingStructures={pricingStructures}
          isLoading={pricingLoading}
          onEdit={handleEditPricing}
          onCreate={handleCreatePricing}
          showActions={true}
        />
      )}

      {/* Profit Calculator */}
      {paymentConfig && (
        <ProfitCalculator venuePricing={primaryPricing} costStructure={primaryCost} />
      )}

      {/* Delete Action */}
      {paymentConfig && (
        <div className="flex justify-end">
          <Button variant="destructive" onClick={handleDeleteConfig} disabled={deleteConfigMutation.isPending}>
            <Trash2 className="w-4 h-4 mr-2" />
            {deleteConfigMutation.isPending ? t('common.deleting') : t('common.delete')}
          </Button>
        </div>
      )}

      {/* Configuration Dialog */}
      <VenuePaymentConfigDialog
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        config={paymentConfig || null}
        venueId={venue!.id}
        onSave={handleSaveConfig}
      />

      {/* Pricing Dialog */}
      <VenuePricingDialog
        open={pricingDialogOpen}
        onOpenChange={setPricingDialogOpen}
        pricing={selectedPricing}
        accountType={selectedAccountType}
        venueId={venue!.id}
        onSave={handleSavePricing}
      />
    </div>
  )
}

export default VenuePaymentConfig
