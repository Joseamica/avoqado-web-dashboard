import React, { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { AlertCircle, Building2, CheckCircle2 } from 'lucide-react'
import { StepIndicator } from './StepIndicator'
import { PricingTabsView } from './PricingTabsView'
import { PricingMetricsCard } from './PricingMetricsCard'
import { VenuePaymentConfigCard } from '../components/VenuePaymentConfigCard'
import {
  paymentProviderAPI,
  type VenuePricingStructure,
  type ProviderCostStructure,
} from '@/services/paymentProvider.service'
import api from '@/api'

interface VenuePricingWizardProps {
  onAdd: (accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY') => void
  onSave: (accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY', data: any) => Promise<void>
}

type RateType = 'debit' | 'credit' | 'amex' | 'international'

interface CostStructureWithAccountType extends ProviderCostStructure {
  accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
}

export const VenuePricingWizard: React.FC<VenuePricingWizardProps> = ({
  onAdd,
  onSave,
}) => {
  const { t } = useTranslation('venuePricing')
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null)

  // Fetch venues
  const { data: venues = [] } = useQuery({
    queryKey: ['venues-list'],
    queryFn: async () => {
      const response = await api.get('/api/v1/dashboard/superadmin/venues')
      return response.data.data
    },
  })

  // Fetch venue payment config
  const { data: venueConfig } = useQuery({
    queryKey: ['venue-payment-config', selectedVenueId],
    queryFn: () => selectedVenueId ? paymentProviderAPI.getVenuePaymentConfig(selectedVenueId) : null,
    enabled: !!selectedVenueId,
  })

  // Fetch pricing structures for selected venue
  const { data: pricingStructures = [] } = useQuery({
    queryKey: ['venue-pricing-structures', selectedVenueId],
    queryFn: () =>
      paymentProviderAPI.getVenuePricingStructures(
        selectedVenueId ? { venueId: selectedVenueId } : undefined
      ),
    enabled: !!selectedVenueId,
  })

  // Fetch cost structures (provider rates) for selected venue
  const { data: costStructures = [] } = useQuery({
    queryKey: ['venue-cost-structures', selectedVenueId],
    queryFn: () => selectedVenueId ? paymentProviderAPI.getVenueCostStructuresByVenueId(selectedVenueId) : [],
    enabled: !!selectedVenueId,
  })

  // Calculate real margin: venue rate - provider rate
  // Note: Rates are stored as decimals (0.025 = 2.5%), so we multiply by 100 for display
  const calculateMargin = useCallback(
    (venuePricing: VenuePricingStructure, rateType: RateType) => {
      // Find the matching cost structure for this account type
      const costStructure = costStructures.find(
        (cs) => cs.accountType === venuePricing.accountType && cs.active
      )

      if (!costStructure) {
        return { marginPercent: 0, status: 'unknown' as const }
      }

      // Get the rate fields based on card type
      const rateFieldMap: Record<RateType, 'debitRate' | 'creditRate' | 'amexRate' | 'internationalRate'> = {
        debit: 'debitRate',
        credit: 'creditRate',
        amex: 'amexRate',
        international: 'internationalRate',
      }
      const rateField = rateFieldMap[rateType]

      // Calculate margin: what we charge venue - what provider charges us
      // Rates are stored as decimals (0.025 = 2.5%), so multiply by 100 for percentage
      const venueRate = Number(venuePricing[rateField]) || 0
      const providerRate = Number(costStructure[rateField]) || 0
      const marginPercent = (venueRate - providerRate) * 100

      // Determine status based on margin (now in percentage terms)
      let status: 'critical' | 'low' | 'good' | 'excellent'
      if (marginPercent < 0) {
        status = 'critical'
      } else if (marginPercent < 0.5) {
        status = 'low'
      } else if (marginPercent < 1.5) {
        status = 'good'
      } else {
        status = 'excellent'
      }

      return { marginPercent, status }
    },
    [costStructures]
  )

  // Calculate current step
  const currentStep = useMemo(() => {
    if (!selectedVenueId) return 1
    if (!venueConfig || !venueConfig.primaryAccountId) return 2
    return 3
  }, [selectedVenueId, venueConfig])

  // Get pricing structures by account type
  const primaryStructure = pricingStructures.find(ps => ps.accountType === 'PRIMARY')
  const secondaryStructure = pricingStructures.find(ps => ps.accountType === 'SECONDARY')
  const tertiaryStructure = pricingStructures.find(ps => ps.accountType === 'TERTIARY')

  // Calculate metrics
  const metrics = useMemo(() => {
    const margins = pricingStructures
      .map(ps => {
        const debit = calculateMargin(ps, 'debit')
        const credit = calculateMargin(ps, 'credit')
        return ((debit.marginPercent || 0) + (credit.marginPercent || 0)) / 2
      })
      .filter(m => !isNaN(m))

    return {
      totalStructures: pricingStructures.length,
      activeStructures: pricingStructures.filter(ps => ps.active).length,
      averageMargin: margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : 0,
      lowestMargin: margins.length > 0 ? Math.min(...margins) : 0,
      highestMargin: margins.length > 0 ? Math.max(...margins) : 0,
      negativeMargins: margins.filter(m => m < 0).length,
    }
  }, [pricingStructures, calculateMargin])

  const selectedVenue = venues.find((v: any) => v.id === selectedVenueId)

  const steps = [
    {
      number: 1,
      title: 'Select Venue',
      description: 'Choose venue to configure',
      status: (currentStep > 1 ? 'completed' : currentStep === 1 ? 'current' : 'upcoming') as 'completed' | 'current' | 'upcoming',
    },
    {
      number: 2,
      title: 'Configure Merchants',
      description: 'Assign payment processors',
      status: (currentStep > 2 ? 'completed' : currentStep === 2 ? 'current' : 'upcoming') as 'completed' | 'current' | 'upcoming',
    },
    {
      number: 3,
      title: 'Set Pricing',
      description: 'Configure rates',
      status: (currentStep >= 3 ? 'current' : 'upcoming') as 'completed' | 'current' | 'upcoming',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Step Indicator */}
      <StepIndicator steps={steps} />

      {/* Step 1: Venue Selection */}
      {currentStep >= 1 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              {currentStep > 1 && <CheckCircle2 className="h-5 w-5 text-primary" />}
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Step 1: Select Venue
                </CardTitle>
                <CardDescription>
                  Choose the venue you want to configure pricing for
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="venue-select">{t('wizard.venue')}</Label>
              <Select value={selectedVenueId || ''} onValueChange={setSelectedVenueId}>
                <SelectTrigger id="venue-select" className="w-full">
                  <SelectValue placeholder={t('wizard.selectVenue')} />
                </SelectTrigger>
                <SelectContent>
                  {venues.map((venue: any) => (
                    <SelectItem key={venue.id} value={venue.id}>
                      {venue.name} ({venue.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedVenueId && (
                <p className="text-sm text-muted-foreground flex items-center gap-2 mt-2">
                  <AlertCircle className="h-4 w-4" />
                  Select a venue to continue to the next step
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Merchant Configuration */}
      {currentStep >= 2 && selectedVenueId && (
        <div className="space-y-4">
          {currentStep === 2 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Configure at least the PRIMARY merchant account to proceed to pricing configuration
              </AlertDescription>
            </Alert>
          )}
          <VenuePaymentConfigCard
            venueId={selectedVenueId}
            venueName={selectedVenue?.name}
            onConfigChange={() => {
              // Refetch will happen automatically via React Query
            }}
          />
        </div>
      )}

      {/* Step 3: Pricing Configuration */}
      {currentStep >= 3 && selectedVenueId && venueConfig && (
        <div className="space-y-6">
          {/* Metrics */}
          {pricingStructures.length > 0 && (
            <PricingMetricsCard metrics={metrics} />
          )}

          {/* Tabbed Pricing View */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {currentStep > 3 && <CheckCircle2 className="h-5 w-5 text-primary" />}
                Step 3: Configure Pricing Rates
              </CardTitle>
              <CardDescription>
                Set rates for PRIMARY, SECONDARY, and TERTIARY merchant accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PricingTabsView
                venueId={selectedVenueId}
                venueName={selectedVenue?.name || ''}
                primaryStructure={primaryStructure}
                secondaryStructure={secondaryStructure}
                tertiaryStructure={tertiaryStructure}
                primaryMerchantConfigured={!!venueConfig.primaryAccountId}
                secondaryMerchantConfigured={!!venueConfig.secondaryAccountId}
                tertiaryMerchantConfigured={!!venueConfig.tertiaryAccountId}
                onAdd={onAdd}
                onSave={onSave}
                calculateMargin={calculateMargin}
              />
            </CardContent>
          </Card>

          {/* Completion Message */}
          {primaryStructure && (
            <Alert className="border-green-500/50 bg-green-50/10">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <strong>{t('wizard.configComplete')}</strong> {selectedVenue?.name} is ready to process payments.
                {secondaryStructure && tertiaryStructure && (
                  <span> {t('wizard.allConfigured')}</span>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  )
}
