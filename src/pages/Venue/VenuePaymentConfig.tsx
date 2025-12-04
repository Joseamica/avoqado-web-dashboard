import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CreditCard, Settings, Loader2, Trash2, Plus, ChevronDown, ChevronUp } from 'lucide-react'
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
  const { t } = useTranslation(['payment', 'common'])
  const { toast } = useToast()
  const { slug } = useParams<{ slug: string }>()
  const { getVenueBySlug } = useAuth()
  const queryClient = useQueryClient()
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false)
  const [selectedPricing, setSelectedPricing] = useState<VenuePricingStructure | null>(null)
  const [selectedAccountType, setSelectedAccountType] = useState<'PRIMARY' | 'SECONDARY' | 'TERTIARY'>('PRIMARY')

  const [advancedOpen, setAdvancedOpen] = useState(false)

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
      toast({ title: t('common:success'), description: t('venuePaymentConfig.createSuccess') })
      setConfigDialogOpen(false)
    },
    onError: () => {
      toast({ title: t('common:error'), description: t('venuePaymentConfig.createError'), variant: 'destructive' })
    },
  })

  // Update payment config mutation
  const updateConfigMutation = useMutation({
    mutationFn: (data: any) => paymentProviderAPI.updateVenuePaymentConfigByVenueId(venue!.id, paymentConfig!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-payment-config', venue?.id] })
      toast({ title: t('common:success'), description: t('venuePaymentConfig.updateSuccess') })
      setConfigDialogOpen(false)
    },
    onError: () => {
      toast({ title: t('common:error'), description: t('venuePaymentConfig.updateError'), variant: 'destructive' })
    },
  })

  // Delete payment config mutation
  const deleteConfigMutation = useMutation({
    mutationFn: () => paymentProviderAPI.deleteVenuePaymentConfigByVenueId(venue!.id, paymentConfig!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-payment-config', venue?.id] })
      queryClient.invalidateQueries({ queryKey: ['venue-cost-structures', venue?.id] })
      queryClient.invalidateQueries({ queryKey: ['venue-pricing-structures', venue?.id] })
      toast({ title: t('common:success'), description: t('venuePaymentConfig.deleteSuccess') })
    },
    onError: () => {
      toast({ title: t('common:error'), description: t('venuePaymentConfig.deleteError'), variant: 'destructive' })
    },
  })

  // Create pricing structure mutation
  const createPricingMutation = useMutation({
    mutationFn: (data: any) => paymentProviderAPI.createVenuePricingStructure(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-pricing-structures', venue?.id] })
      toast({ title: t('common:success'), description: t('venuePaymentConfig.createSuccess') })
      setPricingDialogOpen(false)
    },
    onError: () => {
      toast({ title: t('common:error'), description: t('venuePaymentConfig.createError'), variant: 'destructive' })
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
        {paymentConfig && (
          <Button onClick={() => setConfigDialogOpen(true)} variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            {t('venuePaymentConfig.configure')}
          </Button>
        )}
      </div>

      {/* Empty State / No Configuration */}
      {!paymentConfig && (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-6 border-2 border-dashed rounded-xl bg-muted/20">
          <div className="p-4 rounded-full bg-primary/10">
            <CreditCard className="w-12 h-12 text-primary" />
          </div>
          <div className="max-w-md space-y-2">
            <h2 className="text-2xl font-semibold">{t('venuePaymentConfig.noConfigTitle', 'Connect Payments')}</h2>
            <p className="text-muted-foreground">
              {t('venuePaymentConfig.noConfigDesc', 'Connect a merchant account to start accepting payments for this venue.')}
            </p>
          </div>
          <Button size="lg" onClick={() => setConfigDialogOpen(true)} className="gap-2">
            <Plus className="w-5 h-5" />
            {t('venuePaymentConfig.create', 'Connect Merchant Account')}
          </Button>
        </div>
      )}

      {/* Primary Configuration Display */}
      {paymentConfig && (
        <div className="space-y-6">
          {/* Primary Account Status Card */}
          <Card className="border-l-4 border-l-primary shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  {t('venuePaymentConfig.paymentStatus', 'Payment Status')}
                </CardTitle>
                <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                  {t('common:active', 'Active')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t('venuePaymentConfig.connectedAccount', 'Connected Merchant Account')}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-semibold">{paymentConfig.primaryAccount?.displayName}</span>
                    <Badge variant="outline">{paymentConfig.primaryAccount?.provider?.name}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">ID: {paymentConfig.primaryAccount?.externalMerchantId}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setConfigDialogOpen(true)}>
                  {t('common:edit', 'Change')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Advanced Settings Toggle */}
          <div className="flex items-center justify-between pt-4 border-t">
            <h3 className="text-lg font-medium">{t('venuePaymentConfig.advancedSettings', 'Advanced Settings')}</h3>
            <Button variant="ghost" size="sm" onClick={() => setAdvancedOpen(!advancedOpen)} className="gap-2">
              {advancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {advancedOpen ? t('common:hide', 'Hide') : t('common:show', 'Show')}
            </Button>
          </div>

          {/* Advanced Content */}
          {advancedOpen && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
              {/* Secondary & Tertiary Accounts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Secondary Account */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium flex items-center justify-between">
                      <span>{t('venuePaymentConfig.secondaryAccount')}</span>
                      <Badge variant="secondary" className="text-xs">
                        {t('common:secondary')}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {paymentConfig.secondaryAccount ? (
                      <div className="space-y-2">
                        <div className="font-medium">{paymentConfig.secondaryAccount.displayName}</div>
                        <div className="text-xs text-muted-foreground">
                          {paymentConfig.secondaryAccount.provider?.name} • {paymentConfig.secondaryAccount.externalMerchantId}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground italic">{t('venuePaymentConfig.notConfigured')}</div>
                    )}
                  </CardContent>
                </Card>

                {/* Tertiary Account */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium flex items-center justify-between">
                      <span>{t('venuePaymentConfig.tertiaryAccount')}</span>
                      <Badge variant="outline" className="text-xs">
                        {t('common:tertiary')}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {paymentConfig.tertiaryAccount ? (
                      <div className="space-y-2">
                        <div className="font-medium">{paymentConfig.tertiaryAccount.displayName}</div>
                        <div className="text-xs text-muted-foreground">
                          {paymentConfig.tertiaryAccount.provider?.name} • {paymentConfig.tertiaryAccount.externalMerchantId}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground italic">{t('venuePaymentConfig.notConfigured')}</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Provider Cost Structures */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  {t('venuePaymentConfig.costs', 'Provider Costs')}
                </h4>
                <CostStructuresDisplay costStructures={costStructures} isLoading={costsLoading} />
              </div>

              {/* Venue Pricing Structures */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  {t('venuePaymentConfig.pricing', 'Venue Pricing')}
                </h4>
                <PricingStructuresDisplay
                  pricingStructures={pricingStructures}
                  isLoading={pricingLoading}
                  onEdit={handleEditPricing}
                  onCreate={handleCreatePricing}
                  showActions={true}
                />
              </div>

              {/* Profit Calculator */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  {t('venuePaymentConfig.calculator', 'Profit Calculator')}
                </h4>
                <ProfitCalculator venuePricing={primaryPricing} costStructure={primaryCost} />
              </div>

              {/* Danger Zone */}
              <div className="pt-6 border-t">
                <div className="flex items-center justify-between p-4 border border-destructive/20 bg-destructive/5 rounded-lg">
                  <div>
                    <h4 className="font-medium text-destructive">{t('venuePaymentConfig.deleteConfig', 'Delete Configuration')}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t('venuePaymentConfig.deleteWarning', 'This will remove all payment settings for this venue.')}
                    </p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={handleDeleteConfig} disabled={deleteConfigMutation.isPending}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deleteConfigMutation.isPending ? t('common:deleting') : t('common:delete')}
                  </Button>
                </div>
              </div>
            </div>
          )}
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
