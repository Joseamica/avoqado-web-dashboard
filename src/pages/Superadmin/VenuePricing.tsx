import React, { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { paymentProviderAPI, type VenuePricingStructure } from '@/services/paymentProvider.service'
import { useTranslation } from 'react-i18next'
import { VenuePricingStructureDialog } from './components/VenuePricingStructureDialog'
import { VenuePricingWizard } from './VenuePricing/VenuePricingWizard'
import { useToast } from '@/hooks/use-toast'

const VenuePricing: React.FC = () => {
  const { t } = useTranslation('superadmin')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedPricingStructure, setSelectedPricingStructure] = useState<VenuePricingStructure | null>(null)
  const [selectedAccountType, setSelectedAccountType] = useState<'PRIMARY' | 'SECONDARY' | 'TERTIARY' | null>(null)
  const [dialogKey, setDialogKey] = useState(0)

  // Create mutation
  const createMutation = useMutation({
    mutationFn: paymentProviderAPI.createVenuePricingStructure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-pricing-structures'] })
      queryClient.invalidateQueries({ queryKey: ['venue-payment-config'] })
      toast({ title: 'Success', description: 'Pricing structure created successfully' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create pricing structure', variant: 'destructive' })
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      paymentProviderAPI.updateVenuePricingStructure(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-pricing-structures'] })
      toast({ title: 'Success', description: 'Pricing structure updated successfully' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update pricing structure', variant: 'destructive' })
    },
  })

  const handleDialogSave = async (data: any) => {
    if (selectedPricingStructure) {
      await updateMutation.mutateAsync({ id: selectedPricingStructure.id, data })
    } else {
      await createMutation.mutateAsync(data)
    }
  }

  const handleInlineSave = async (accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY', data: any) => {
    // Get pricing structures for current venue
    const structures = await queryClient.fetchQuery({
      queryKey: ['venue-pricing-structures'],
      queryFn: () => paymentProviderAPI.getVenuePricingStructures(),
    })

    // Find existing structure for this account type and venue
    const existingStructure = structures.find(
      (s: VenuePricingStructure) => s.accountType === accountType && s.venueId === data.venueId
    )

    if (existingStructure) {
      await updateMutation.mutateAsync({ id: existingStructure.id, data })
    } else {
      await createMutation.mutateAsync(data)
    }
  }

  const handleAdd = (accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY') => {
    setSelectedPricingStructure(null)
    setSelectedAccountType(accountType)
    setDialogKey(prev => prev + 1)
    setDialogOpen(true)
  }

  // Calculate profit margin (simplified for wizard)
  const calculateMargin = (structure: VenuePricingStructure, rateType: string) => {
    // This is a placeholder - the wizard will handle complex margin calculations
    return {
      marginPercent: 1.4,
      status: 'good',
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Venue Payment & Pricing Configuration</h1>
          <p className="text-muted-foreground">Configure merchant accounts and set pricing rates for your venues</p>
        </div>
      </div>

      {/* Wizard */}
      <VenuePricingWizard
        onAdd={handleAdd}
        onSave={handleInlineSave}
        calculateMargin={calculateMargin}
      />

      {/* Pricing Dialog */}
      <VenuePricingStructureDialog
        key={dialogKey}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pricingStructure={selectedPricingStructure}
        initialAccountType={selectedAccountType || undefined}
        onSave={handleDialogSave}
      />
    </div>
  )
}

export default VenuePricing
