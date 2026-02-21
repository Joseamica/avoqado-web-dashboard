import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getOrganization, updateOrganization, type OrganizationInfo } from '@/services/organization.service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Settings, Building2, Mail, Phone, Receipt, Save, Loader2, Monitor } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useOrgTpvDefaults, useUpsertOrgTpvDefaults, useOrgTpvStats } from '@/hooks/useStoresAnalysis'
import { TpvSettingsFields } from '@/components/tpv/TpvSettingsFields'
import type { TpvSettings } from '@/services/tpv-settings.service'

const organizationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone is required'),
  taxId: z.string().nullable(),
  billingEmail: z.string().email('Invalid email').nullable().or(z.literal('')),
})

type OrganizationFormData = z.infer<typeof organizationSchema>

const OrganizationSettings: React.FC = () => {
  const { t } = useTranslation('organization')
  const { orgId } = useParams<{ orgId: string }>()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: organization, isLoading } = useQuery({
    queryKey: ['organization', orgId],
    queryFn: () => getOrganization(orgId!),
    enabled: !!orgId,
  })

  const form = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    values: organization
      ? {
          name: organization.name,
          email: organization.email,
          phone: organization.phone,
          taxId: organization.taxId,
          billingEmail: organization.billingEmail,
        }
      : undefined,
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<OrganizationInfo>) => updateOrganization(orgId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] })
      queryClient.invalidateQueries({ queryKey: ['organization', 'stats', orgId] })
      toast({
        title: t('settings.updateSuccess'),
      })
    },
    onError: () => {
      toast({
        title: t('settings.updateError'),
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (data: OrganizationFormData) => {
    updateMutation.mutate({
      name: data.name,
      email: data.email,
      phone: data.phone,
      taxId: data.taxId || null,
      billingEmail: data.billingEmail || null,
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <PageTitleWithInfo
          title={
            <>
              <Settings className="h-8 w-8 text-primary" />
              <span>{t('settings.title')}</span>
            </>
          }
          className="text-3xl font-bold text-foreground flex items-center gap-2"
          tooltip={t('info.settings', {
            defaultValue: 'Configura datos legales y facturacion de la organizacion.',
          })}
        />
        <p className="text-muted-foreground mt-1">{t('settings.subtitle')}</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* General Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {t('settings.generalInfo')}
              </CardTitle>
              <CardDescription>{t('settings.generalInfoDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('settings.name')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>{t('settings.nameDesc')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('settings.email')}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input {...field} className="pl-10" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('settings.phone')}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input {...field} className="pl-10" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Billing Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                {t('settings.billingInfo')}
              </CardTitle>
              <CardDescription>{t('settings.billingInfoDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="taxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('settings.taxId')}</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} placeholder={t('settings.taxIdPlaceholder', { defaultValue: 'RFC' })} />
                      </FormControl>
                      <FormDescription>{t('settings.taxIdDesc')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="billingEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('settings.billingEmail')}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            value={field.value || ''}
                            className="pl-10"
                            placeholder={t('settings.billingEmailPlaceholder', { defaultValue: 'facturacion@empresa.com' })}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>{t('settings.billingEmailDesc')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button type="submit" disabled={updateMutation.isPending || !form.formState.isDirty}>
              {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {t('settings.save')}
            </Button>
          </div>
        </form>
      </Form>
      {/* TPV Configuration Section */}
      <OrgTpvConfigSection />
    </div>
  )
}

// =============================================================================
// ORG TPV CONFIG SECTION
// =============================================================================

const DEFAULT_TPV_SETTINGS: TpvSettings = {
  showReviewScreen: true,
  showTipScreen: true,
  showReceiptScreen: true,
  defaultTipPercentage: null,
  tipSuggestions: [10, 15, 20],
  requirePinLogin: true,
  showVerificationScreen: false,
  requireVerificationPhoto: false,
  requireVerificationBarcode: false,
  requireClockInPhoto: false,
  requireClockOutPhoto: false,
  requireClockInToLogin: false,
  kioskModeEnabled: false,
  kioskDefaultMerchantId: null,
  showQuickPayment: true,
  showOrderManagement: true,
  showReports: true,
  showPayments: true,
  showSupport: true,
  showGoals: true,
  showMessages: true,
  showTrainings: true,
  showCryptoOption: false,
}

function OrgTpvConfigSection() {
  const { t } = useTranslation('organization')
  const { t: tTpv } = useTranslation('tpv')
  const { toast } = useToast()

  const { data: orgDefaults, isLoading } = useOrgTpvDefaults()
  const { data: stats } = useOrgTpvStats()
  const upsertMutation = useUpsertOrgTpvDefaults()

  const [localSettings, setLocalSettings] = useState<TpvSettings>(DEFAULT_TPV_SETTINGS)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (orgDefaults) {
      setLocalSettings({ ...DEFAULT_TPV_SETTINGS, ...(orgDefaults as Partial<TpvSettings>) })
      setHasChanges(false)
    } else if (!isLoading) {
      setLocalSettings(DEFAULT_TPV_SETTINGS)
      setHasChanges(false)
    }
  }, [orgDefaults, isLoading])

  const handleUpdate = (updates: Partial<TpvSettings>) => {
    setLocalSettings(prev => ({ ...prev, ...updates }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    try {
      const result = await upsertMutation.mutateAsync(localSettings as Record<string, any>)
      setHasChanges(false)
      toast({
        title: tTpv('tpvSettings.orgSaveSuccess', { defaultValue: 'Configuracion guardada' }),
        description: tTpv('tpvSettings.orgTerminalsUpdated', {
          defaultValue: '{{count}} terminales actualizadas',
          count: result.terminalsUpdated,
        }),
      })
    } catch {
      toast({
        title: tTpv('tpvSettings.updateError'),
        variant: 'destructive',
      })
    }
  }

  const totalTerminals = stats?.totalTerminals ?? 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              {t('settings.tpvConfig', { defaultValue: 'Configuracion de Terminales TPV' })}
            </CardTitle>
            <CardDescription>
              {t('settings.tpvConfigDesc', {
                defaultValue: 'Configuracion por defecto para todas las terminales de la organizacion ({{count}} terminales).',
                count: totalTerminals,
              })}
            </CardDescription>
          </div>
          <Button onClick={handleSave} disabled={!hasChanges || upsertMutation.isPending} size="sm">
            {upsertMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {tTpv('tpvSettings.saveAndApply', { defaultValue: 'Guardar y aplicar' })}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <div className="h-16 bg-muted animate-pulse rounded-xl" />
            <div className="h-16 bg-muted animate-pulse rounded-xl" />
          </div>
        ) : (
          <TpvSettingsFields settings={localSettings} onUpdate={handleUpdate} isPending={upsertMutation.isPending} mode="org" />
        )}
      </CardContent>
    </Card>
  )
}

export default OrganizationSettings
