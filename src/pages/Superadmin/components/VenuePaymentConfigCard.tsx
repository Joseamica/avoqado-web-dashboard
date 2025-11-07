import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CreditCard, Plus, Save, AlertCircle, CheckCircle, Wallet } from 'lucide-react'
import {
  paymentProviderAPI,
  type VenuePaymentConfig,
  type MerchantAccount,
} from '@/services/paymentProvider.service'
import { useToast } from '@/hooks/use-toast'

interface VenuePaymentConfigCardProps {
  venueId: string | null
  venueName?: string
  onConfigChange?: () => void
}

export const VenuePaymentConfigCard: React.FC<VenuePaymentConfigCardProps> = ({
  venueId,
  venueName,
  onConfigChange,
}) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)

  const [formData, setFormData] = useState({
    primaryAccountId: '',
    secondaryAccountId: '',
    tertiaryAccountId: '',
    preferredProcessor: 'AUTO',
  })

  // Fetch all merchant accounts
  const { data: merchantAccounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['merchant-accounts-all'],
    queryFn: () => paymentProviderAPI.getAllMerchantAccounts(),
  })

  // Fetch existing config for selected venue
  const { data: existingConfig, isLoading: loadingConfig, refetch: refetchConfig } = useQuery({
    queryKey: ['venue-payment-config', venueId],
    queryFn: () => (venueId ? paymentProviderAPI.getVenuePaymentConfig(venueId) : null),
    enabled: !!venueId,
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: paymentProviderAPI.createVenuePaymentConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-payment-config'] })
      queryClient.invalidateQueries({ queryKey: ['venue-pricing-structures'] })
      toast({ title: 'Success', description: 'Payment configuration created successfully' })
      setIsEditing(false)
      refetchConfig()
      onConfigChange?.()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to create payment configuration'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ venueId, data }: { venueId: string; data: any }) =>
      paymentProviderAPI.updateVenuePaymentConfig(venueId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-payment-config'] })
      queryClient.invalidateQueries({ queryKey: ['venue-pricing-structures'] })
      toast({ title: 'Success', description: 'Payment configuration updated successfully' })
      setIsEditing(false)
      refetchConfig()
      onConfigChange?.()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to update payment configuration'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    },
  })

  // Populate form when config is loaded
  useEffect(() => {
    if (existingConfig) {
      setFormData({
        primaryAccountId: existingConfig.primaryAccountId,
        secondaryAccountId: existingConfig.secondaryAccountId || '',
        tertiaryAccountId: existingConfig.tertiaryAccountId || '',
        preferredProcessor: existingConfig.preferredProcessor || 'AUTO',
      })
    } else {
      setFormData({
        primaryAccountId: '',
        secondaryAccountId: '',
        tertiaryAccountId: '',
        preferredProcessor: 'AUTO',
      })
    }
  }, [existingConfig])

  const handleSave = async () => {
    if (!venueId) {
      toast({ title: 'Error', description: 'Please select a venue first', variant: 'destructive' })
      return
    }

    if (!formData.primaryAccountId) {
      toast({ title: 'Error', description: 'PRIMARY merchant account is required', variant: 'destructive' })
      return
    }

    const data = {
      venueId,
      primaryAccountId: formData.primaryAccountId,
      secondaryAccountId: formData.secondaryAccountId || undefined,
      tertiaryAccountId: formData.tertiaryAccountId || undefined,
      preferredProcessor: formData.preferredProcessor,
    }

    if (existingConfig) {
      await updateMutation.mutateAsync({ venueId, data })
    } else {
      await createMutation.mutateAsync(data)
    }
  }

  const getMerchantName = (merchantId: string) => {
    const merchant = merchantAccounts.find((m: MerchantAccount) => m.id === merchantId)
    if (!merchant) return 'Unknown'

    const serialInfo = merchant.blumonSerialNumber ? ` (${merchant.blumonSerialNumber})` : ''
    return `${merchant.displayName}${serialInfo}`
  }

  // Filter out already selected accounts from dropdowns
  const getAvailableAccounts = (excludeType?: 'primary' | 'secondary' | 'tertiary') => {
    const excludeIds = []
    if (excludeType !== 'primary' && formData.primaryAccountId) excludeIds.push(formData.primaryAccountId)
    if (excludeType !== 'secondary' && formData.secondaryAccountId) excludeIds.push(formData.secondaryAccountId)
    if (excludeType !== 'tertiary' && formData.tertiaryAccountId) excludeIds.push(formData.tertiaryAccountId)

    return merchantAccounts.filter((m: MerchantAccount) => !excludeIds.includes(m.id))
  }

  if (!venueId) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payment Configuration
          </CardTitle>
          <CardDescription>Select a venue to configure payment accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              Please select a venue from the dropdown above to manage its payment configuration.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  if (loadingConfig || loadingAccounts) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payment Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const hasConfig = !!existingConfig
  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <Card className={hasConfig ? '' : 'border-dashed border-amber-500/50 bg-amber-50/10'}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Payment Configuration
              {hasConfig && (
                <Badge variant="outline" className="ml-2">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Configured
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {hasConfig
                ? `Merchant accounts for ${venueName || 'this venue'}`
                : 'Assign PRIMARY/SECONDARY/TERTIARY merchant accounts'}
            </CardDescription>
          </div>
          {hasConfig && !isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasConfig && !isEditing && (
          <Alert className="border-amber-500/50 bg-amber-50/10">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>Configuration Required:</strong> You must assign at least a PRIMARY merchant account before
              setting pricing structures. This links the venue to specific payment processors.
            </AlertDescription>
          </Alert>
        )}

        {(!hasConfig || isEditing) && (
          <div className="space-y-4">
            {/* PRIMARY Account */}
            <div className="space-y-2">
              <Label htmlFor="primary-account" className="flex items-center gap-2">
                <Badge variant="default" className="bg-blue-600">PRIMARY</Badge>
                <span>Merchant Account (Required)</span>
              </Label>
              <Select
                value={formData.primaryAccountId}
                onValueChange={(value) => setFormData({ ...formData, primaryAccountId: value })}
              >
                <SelectTrigger id="primary-account">
                  <SelectValue placeholder="Select PRIMARY merchant account" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableAccounts('primary').map((account: MerchantAccount) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4" />
                        <span>{account.displayName}</span>
                        {account.blumonSerialNumber && (
                          <span className="text-xs text-muted-foreground">({account.blumonSerialNumber})</span>
                        )}
                        <Badge variant="secondary" className="text-xs">{account.provider.name}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Main account for standard transactions. Most payments will use this account.
              </p>
            </div>

            {/* SECONDARY Account */}
            <div className="space-y-2">
              <Label htmlFor="secondary-account" className="flex items-center gap-2">
                <Badge variant="secondary">SECONDARY</Badge>
                <span>Merchant Account (Optional)</span>
              </Label>
              <Select
                value={formData.secondaryAccountId}
                onValueChange={(value) => setFormData({ ...formData, secondaryAccountId: value })}
              >
                <SelectTrigger id="secondary-account">
                  <SelectValue placeholder="Select SECONDARY merchant account (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {getAvailableAccounts('secondary').map((account: MerchantAccount) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4" />
                        <span>{account.displayName}</span>
                        {account.blumonSerialNumber && (
                          <span className="text-xs text-muted-foreground">({account.blumonSerialNumber})</span>
                        )}
                        <Badge variant="secondary" className="text-xs">{account.provider.name}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                For routing based on card BIN, amount thresholds, or special conditions.
              </p>
            </div>

            {/* TERTIARY Account */}
            <div className="space-y-2">
              <Label htmlFor="tertiary-account" className="flex items-center gap-2">
                <Badge variant="outline">TERTIARY</Badge>
                <span>Merchant Account (Optional)</span>
              </Label>
              <Select
                value={formData.tertiaryAccountId}
                onValueChange={(value) => setFormData({ ...formData, tertiaryAccountId: value })}
              >
                <SelectTrigger id="tertiary-account">
                  <SelectValue placeholder="Select TERTIARY merchant account (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {getAvailableAccounts('tertiary').map((account: MerchantAccount) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4" />
                        <span>{account.displayName}</span>
                        {account.blumonSerialNumber && (
                          <span className="text-xs text-muted-foreground">({account.blumonSerialNumber})</span>
                        )}
                        <Badge variant="secondary" className="text-xs">{account.provider.name}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                For failover or specialized payment scenarios.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-4">
              <Button onClick={handleSave} disabled={isLoading || !formData.primaryAccountId}>
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {hasConfig ? 'Update Configuration' : 'Create Configuration'}
                  </>
                )}
              </Button>
              {isEditing && (
                <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isLoading}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}

        {hasConfig && !isEditing && (
          <div className="space-y-3">
            {/* PRIMARY Account Display */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20">
              <div className="flex items-center gap-3">
                <Badge variant="default" className="bg-blue-600">PRIMARY</Badge>
                <div>
                  <div className="font-medium">{getMerchantName(existingConfig.primaryAccountId)}</div>
                  <div className="text-xs text-muted-foreground">{existingConfig.primaryAccount.provider.name}</div>
                </div>
              </div>
              <CheckCircle className="w-5 h-5 text-blue-600" />
            </div>

            {/* SECONDARY Account Display */}
            {existingConfig.secondaryAccountId && (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-secondary/50">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">SECONDARY</Badge>
                  <div>
                    <div className="font-medium">{getMerchantName(existingConfig.secondaryAccountId)}</div>
                    <div className="text-xs text-muted-foreground">
                      {existingConfig.secondaryAccount?.provider.name}
                    </div>
                  </div>
                </div>
                <CheckCircle className="w-5 h-5 text-secondary-foreground" />
              </div>
            )}

            {/* TERTIARY Account Display */}
            {existingConfig.tertiaryAccountId && (
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">TERTIARY</Badge>
                  <div>
                    <div className="font-medium">{getMerchantName(existingConfig.tertiaryAccountId)}</div>
                    <div className="text-xs text-muted-foreground">
                      {existingConfig.tertiaryAccount?.provider.name}
                    </div>
                  </div>
                </div>
                <CheckCircle className="w-5 h-5 text-muted-foreground" />
              </div>
            )}

            {/* Info Message */}
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                <strong>Tip:</strong> Set pricing structures for each account type below. PRIMARY rates will apply
                to transactions using the PRIMARY merchant account.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
