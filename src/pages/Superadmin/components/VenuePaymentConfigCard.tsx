import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CreditCard, Save, AlertCircle, CheckCircle, Wallet, Building2 } from 'lucide-react'
import {
  paymentProviderAPI,
  type MerchantAccount,
} from '@/services/paymentProvider.service'
import { useToast } from '@/hooks/use-toast'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

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
  const { t } = useTranslation('superadmin')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('primary')

  const [formData, setFormData] = useState({
    primaryAccountId: '',
    secondaryAccountId: '',
    tertiaryAccountId: '',
    preferredProcessor: 'AUTO',
  })

  // Fetch all merchant accounts
  const { data: merchantAccounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['merchant-accounts-all'],
    queryFn: async () => {
      const accounts = await paymentProviderAPI.getAllMerchantAccounts()
      return accounts
    },
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
      toast({ title: t('common.success'), description: t('paymentConfiguration.messages.success.created') })
      setIsEditing(false)
      refetchConfig()
      onConfigChange?.()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || t('paymentConfiguration.messages.error.create')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ venueId, data }: { venueId: string; data: any }) =>
      paymentProviderAPI.updateVenuePaymentConfig(venueId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-payment-config'] })
      queryClient.invalidateQueries({ queryKey: ['venue-pricing-structures'] })
      toast({ title: t('common.success'), description: t('paymentConfiguration.messages.success.updated') })
      setIsEditing(false)
      refetchConfig()
      onConfigChange?.()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || t('paymentConfiguration.messages.error.update')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
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
      toast({
        title: t('common.error'),
        description: t('paymentConfiguration.messages.error.selectVenue'),
        variant: 'destructive',
      })
      return
    }

    if (!formData.primaryAccountId) {
      toast({
        title: t('common.error'),
        description: t('paymentConfiguration.messages.error.primaryRequired'),
        variant: 'destructive',
      })
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

  // Filter out already selected accounts from selection
  const getAvailableAccounts = (accountType: 'primary' | 'secondary' | 'tertiary') => {
    const excludeIds = []
    if (accountType !== 'primary' && formData.primaryAccountId) excludeIds.push(formData.primaryAccountId)
    if (accountType !== 'secondary' && formData.secondaryAccountId)
      excludeIds.push(formData.secondaryAccountId)
    if (accountType !== 'tertiary' && formData.tertiaryAccountId) excludeIds.push(formData.tertiaryAccountId)

    return merchantAccounts.filter((m: MerchantAccount) => !excludeIds.includes(m.id))
  }

  const renderMerchantAccountCard = (account: MerchantAccount) => (
    <div className="flex items-start gap-3 w-full">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
        <Building2 className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{account.displayName}</div>
        <div className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
          <Badge variant="outline" className="text-xs">
            {account.provider.name}
          </Badge>
          {account.blumonSerialNumber && (
            <span className="text-xs text-muted-foreground">S/N: {account.blumonSerialNumber}</span>
          )}
        </div>
      </div>
    </div>
  )

  const renderAccountTypeSelector = (
    accountType: 'primary' | 'secondary' | 'tertiary',
    currentValue: string,
    onChange: (value: string) => void
  ) => {
    const availableAccounts = getAvailableAccounts(accountType)
    const isOptional = accountType !== 'primary'
    const translationKey = `paymentConfiguration.accountTypes.${accountType}`

    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">{t(`${translationKey}.description`)}</p>
        </div>

        <RadioGroup value={currentValue || '__none__'} onValueChange={onChange} className="gap-3">
          {isOptional && (
            <div className="relative">
              <RadioGroupItem value="__none__" id={`${accountType}-none`} className="peer sr-only" />
              <label
                htmlFor={`${accountType}-none`}
                className={cn(
                  'flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all',
                  'hover:bg-accent/50 hover:border-primary/50',
                  'peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-accent'
                )}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted shrink-0">
                  <Wallet className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">{t(`${translationKey}.none`)}</div>
                  <div className="text-sm text-muted-foreground">{t(`${translationKey}.optional`)}</div>
                </div>
              </label>
            </div>
          )}

          {availableAccounts.length === 0 && !isOptional && (
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{t('paymentConfiguration.alerts.selectVenue')}</AlertDescription>
            </Alert>
          )}

          {availableAccounts.map((account: MerchantAccount) => (
            <div key={account.id} className="relative">
              <RadioGroupItem value={account.id} id={`${accountType}-${account.id}`} className="peer sr-only" />
              <label
                htmlFor={`${accountType}-${account.id}`}
                className={cn(
                  'flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all',
                  'hover:bg-accent/50 hover:border-primary/50',
                  'peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-accent'
                )}
              >
                {renderMerchantAccountCard(account)}
              </label>
            </div>
          ))}
        </RadioGroup>
      </div>
    )
  }

  if (!venueId) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            {t('paymentConfiguration.title')}
          </CardTitle>
          <CardDescription>{t('paymentConfiguration.description.selectVenue')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{t('paymentConfiguration.alerts.selectVenue')}</AlertDescription>
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
            {t('paymentConfiguration.title')}
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
    <Card className={hasConfig ? '' : 'border-dashed border-orange-200 dark:border-orange-800 bg-orange-50/10 dark:bg-orange-950/20'}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              {t('paymentConfiguration.title')}
              {hasConfig && (
                <Badge variant="outline" className="ml-2">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {t('paymentConfiguration.configured')}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {hasConfig
                ? t('paymentConfiguration.description.withConfig', { venueName: venueName || 'this venue' })
                : t('paymentConfiguration.description.withoutConfig')}
            </CardDescription>
          </div>
          {hasConfig && !isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              {t('paymentConfiguration.actions.edit')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasConfig && !isEditing && (
          <Alert className="border-orange-200 dark:border-orange-800 bg-orange-50/10 dark:bg-orange-950/20">
            <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              {t('paymentConfiguration.alerts.configurationRequired')}
            </AlertDescription>
          </Alert>
        )}

        {(!hasConfig || isEditing) && (
          <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="primary" className="gap-2">
                  <Badge
                    variant={activeTab === 'primary' ? 'default' : 'outline'}
                    className="h-5"
                  >
                    {t('paymentConfiguration.accountTypes.primary.label')}
                  </Badge>
                  {formData.primaryAccountId && <CheckCircle className="w-3 h-3" />}
                </TabsTrigger>
                <TabsTrigger value="secondary" className="gap-2">
                  <Badge variant={activeTab === 'secondary' ? 'secondary' : 'outline'} className="h-5">
                    {t('paymentConfiguration.accountTypes.secondary.label')}
                  </Badge>
                  {formData.secondaryAccountId && <CheckCircle className="w-3 h-3" />}
                </TabsTrigger>
                <TabsTrigger value="tertiary" className="gap-2">
                  <Badge variant="outline" className="h-5">
                    {t('paymentConfiguration.accountTypes.tertiary.label')}
                  </Badge>
                  {formData.tertiaryAccountId && <CheckCircle className="w-3 h-3" />}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="primary" className="mt-6">
                {renderAccountTypeSelector('primary', formData.primaryAccountId, (value) =>
                  setFormData({ ...formData, primaryAccountId: value === '__none__' ? '' : value })
                )}
              </TabsContent>

              <TabsContent value="secondary" className="mt-6">
                {renderAccountTypeSelector('secondary', formData.secondaryAccountId, (value) =>
                  setFormData({ ...formData, secondaryAccountId: value === '__none__' ? '' : value })
                )}
              </TabsContent>

              <TabsContent value="tertiary" className="mt-6">
                {renderAccountTypeSelector('tertiary', formData.tertiaryAccountId, (value) =>
                  setFormData({ ...formData, tertiaryAccountId: value === '__none__' ? '' : value })
                )}
              </TabsContent>
            </Tabs>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-4">
              <Button onClick={handleSave} disabled={isLoading || !formData.primaryAccountId}>
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    {t('paymentConfiguration.actions.saving')}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {hasConfig
                      ? t('paymentConfiguration.actions.update')
                      : t('paymentConfiguration.actions.create')}
                  </>
                )}
              </Button>
              {isEditing && (
                <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isLoading}>
                  {t('paymentConfiguration.actions.cancel')}
                </Button>
              )}
            </div>
          </div>
        )}

        {hasConfig && !isEditing && (
          <div className="space-y-3">
            {/* PRIMARY Account Display */}
            <div className="flex items-center justify-between p-4 rounded-lg border bg-primary/10">
              <div className="flex items-center gap-3">
                <Badge variant="default">
                  {t('paymentConfiguration.accountTypes.primary.label')}
                </Badge>
                <div>
                  <div className="font-medium">{getMerchantName(existingConfig.primaryAccountId)}</div>
                  <div className="text-xs text-muted-foreground">{existingConfig.primaryAccount.provider.name}</div>
                </div>
              </div>
              <CheckCircle className="w-5 h-5 text-primary" />
            </div>

            {/* SECONDARY Account Display */}
            {existingConfig.secondaryAccountId && (
              <div className="flex items-center justify-between p-4 rounded-lg border bg-secondary/50">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{t('paymentConfiguration.accountTypes.secondary.label')}</Badge>
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
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{t('paymentConfiguration.accountTypes.tertiary.label')}</Badge>
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
              <AlertDescription>{t('paymentConfiguration.alerts.tip')}</AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
