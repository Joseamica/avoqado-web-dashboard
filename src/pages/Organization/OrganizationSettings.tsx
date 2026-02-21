import React, { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getOrganization, updateOrganization, type OrganizationInfo } from '@/services/organization.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { GlassCard } from '@/components/ui/glass-card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Settings, Building2, Mail, Phone, Receipt, Save, Loader2, Monitor, Info } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-8">
      {/* Header */}
      <div>
        <PageTitleWithInfo
          title={
            <>
              <Settings className="h-7 w-7 text-primary" />
              <span>{t('settings.title')}</span>
            </>
          }
          className="text-2xl font-semibold text-foreground flex items-center gap-2"
          tooltip={t('info.settings', {
            defaultValue: 'Configura datos legales y facturacion de la organizacion.',
          })}
        />
        <p className="text-sm text-muted-foreground mt-1">{t('settings.subtitle')}</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* General Information */}
          <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium text-sm">{t('settings.generalInfo')}</h3>
                <p className="text-xs text-muted-foreground">{t('settings.generalInfoDesc')}</p>
              </div>
            </div>

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">{t('settings.name')}</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-10" />
                    </FormControl>
                    <FormDescription className="text-xs">{t('settings.nameDesc')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator className="opacity-50" />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground">{t('settings.email')}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input {...field} className="pl-10 h-10" />
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
                      <FormLabel className="text-xs font-medium text-muted-foreground">{t('settings.phone')}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input {...field} className="pl-10 h-10" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </GlassCard>

          {/* Billing Information */}
          <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
                <Receipt className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-medium text-sm">{t('settings.billingInfo')}</h3>
                <p className="text-xs text-muted-foreground">{t('settings.billingInfoDesc')}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="taxId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">{t('settings.taxId')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ''}
                        placeholder={t('settings.taxIdPlaceholder', { defaultValue: 'RFC' })}
                        className="h-10"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">{t('settings.taxIdDesc')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="billingEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">{t('settings.billingEmail')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          value={field.value || ''}
                          className="pl-10 h-10"
                          placeholder={t('settings.billingEmailPlaceholder', { defaultValue: 'facturacion@empresa.com' })}
                        />
                      </div>
                    </FormControl>
                    <FormDescription className="text-xs">{t('settings.billingEmailDesc')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </GlassCard>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button type="submit" disabled={updateMutation.isPending || !form.formState.isDirty} size="sm">
              {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {t('settings.save')}
            </Button>
          </div>
        </form>
      </Form>

      {/* TPV Configuration Section */}
      <OrgTpvConfigSection orgId={orgId!} />
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

function OrgTpvConfigSection({ orgId }: { orgId: string }) {
  const { t } = useTranslation('organization')
  const { t: tTpv } = useTranslation('tpv')
  const { toast } = useToast()
  const { user, activeVenue } = useAuth()

  // Org settings page has no venue in URL — find any venue from this org to proxy API calls
  const venueId = useMemo(() => {
    // Prefer activeVenue if it belongs to this org
    if (activeVenue?.organizationId === orgId) return activeVenue.id
    // Otherwise find any venue from user's venues that belongs to this org
    return user?.venues?.find(v => v.organizationId === orgId)?.id ?? null
  }, [activeVenue, orgId, user?.venues])

  const { data: orgDefaults, isLoading } = useOrgTpvDefaults({ venueId })
  const { data: stats } = useOrgTpvStats({ venueId })
  const upsertMutation = useUpsertOrgTpvDefaults({ venueId })

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
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5">
            <Monitor className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="font-medium text-sm">
              {t('settings.tpvConfig', { defaultValue: 'Configuracion de Terminales TPV' })}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('settings.tpvConfigDesc', {
                defaultValue: 'Configuracion por defecto para todas las terminales de la organizacion.',
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {totalTerminals > 0 && (
            <Badge variant="secondary" className="text-xs font-normal">
              {totalTerminals} {totalTerminals === 1 ? 'terminal' : 'terminales'}
            </Badge>
          )}
          <Button onClick={handleSave} disabled={!hasChanges || upsertMutation.isPending} size="sm">
            {upsertMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {tTpv('tpvSettings.saveAndApply', { defaultValue: 'Guardar y aplicar' })}
          </Button>
        </div>
      </div>

      {/* Info banner */}
      {totalTerminals > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/20 px-3 py-2.5">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            {t('settings.tpvConfigBanner', {
              defaultValue:
                'Los cambios se aplicaran a todas las {{count}} terminales de la organizacion al presionar "Guardar y aplicar".',
              count: totalTerminals,
            })}
          </p>
        </div>
      )}

      {/* Venue breakdown */}
      {stats && stats.venues.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {stats.venues.map(venue => (
            <span key={venue.id} className="text-xs text-muted-foreground bg-muted/60 px-2 py-1 rounded-md">
              {venue.name}: {venue.terminalCount}
            </span>
          ))}
        </div>
      )}

      {/* Settings fields */}
      {isLoading ? (
        <div className="space-y-3">
          <div className="h-14 bg-muted/40 animate-pulse rounded-2xl" />
          <div className="h-14 bg-muted/40 animate-pulse rounded-2xl" />
          <div className="h-14 bg-muted/40 animate-pulse rounded-2xl" />
        </div>
      ) : (
        <TpvSettingsFields settings={localSettings} onUpdate={handleUpdate} isPending={upsertMutation.isPending} mode="org" />
      )}
    </div>
  )
}

export default OrganizationSettings
