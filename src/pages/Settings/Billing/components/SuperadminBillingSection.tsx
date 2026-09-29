// Superadmin-only billing tools, moved unchanged out of Subscriptions.tsx (spec §4.6). The parent renders it only for
// SUPERADMIN, so the moved JSX no longer checks the role itself.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Gift, Power, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { getVenueFeatures, type PlanState, type VenueFeatureStatus } from '@/services/features.service'
import { useVenueDateTime } from '@/utils/datetime'
import { SuperadminFeatureControl } from './SuperadminFeatureControl'
import { SuperadminFeatureDialogs } from './SuperadminFeatureDialogs'
import { SuperadminPlanControl } from './SuperadminPlanControl'

export function SuperadminBillingSection({
  venueId,
  venueName,
  planState,
}: {
  venueId: string
  venueName?: string
  planState: PlanState | undefined
}) {
  const { t, i18n } = useTranslation('billing')
  const { formatDate } = useVenueDateTime()
  const { data: featuresStatus } = useQuery<VenueFeatureStatus>({
    queryKey: ['venueFeatures', venueId],
    queryFn: () => getVenueFeatures(venueId),
    enabled: !!venueId,
  })

  // Superadmin state
  const [showGrantTrialDialog, setShowGrantTrialDialog] = useState(false)
  const [showEnableFeatureDialog, setShowEnableFeatureDialog] = useState(false)
  const [disablingFeatureCode, setDisablingFeatureCode] = useState<string | null>(null)

  // Currency formatter — used by the superadmin feature panel (price badges + select labels).
  const formatCurrency = (amount: number, currency: string = 'MXN') => {
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency,
    }).format(amount / 100)
  }

  return (
    <>
      <SuperadminFeatureControl>
        <div className="pt-2">
          {/* Base-plan admin: tier/grandfathered state, comp plans, plan trials */}
          <SuperadminPlanControl venueId={venueId} venueName={venueName} planState={planState} />

          <Separator className="my-6 bg-amber-400/20" />

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/* Grant Trial */}
            <button
              onClick={() => setShowGrantTrialDialog(true)}
              className="group flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-amber-400/30 hover:border-amber-400/60 bg-gradient-to-br from-amber-500/5 to-pink-500/5 hover:from-amber-500/10 hover:to-pink-500/10 transition-all duration-200 cursor-pointer"
            >
              <div className="p-2 rounded-lg bg-gradient-to-r from-amber-400 to-pink-500 group-hover:shadow-md transition-shadow">
                <Gift className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">
                  {t('superadmin.actions.grantTrial', { defaultValue: 'Grant Trial' })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('superadmin.actions.grantTrialDesc', { defaultValue: 'Give free trial period' })}
                </p>
              </div>
            </button>

            {/* Enable Feature */}
            <button
              onClick={() => setShowEnableFeatureDialog(true)}
              className="group flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-amber-400/30 hover:border-amber-400/60 bg-gradient-to-br from-amber-500/5 to-pink-500/5 hover:from-amber-500/10 hover:to-pink-500/10 transition-all duration-200 cursor-pointer"
            >
              <div className="p-2 rounded-lg bg-gradient-to-r from-amber-400 to-pink-500 group-hover:shadow-md transition-shadow">
                <Zap className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">
                  {t('superadmin.actions.enableFeature', { defaultValue: 'Enable Feature' })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('superadmin.actions.enableFeatureDesc', { defaultValue: 'Activate without payment' })}
                </p>
              </div>
            </button>

            {/* Quick Stats */}
            <div className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-muted/30">
              <div className="p-2 rounded-lg bg-muted">
                <Power className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">
                  {featuresStatus?.activeFeatures.length || 0} {t('superadmin.stats.activeFeatures', { defaultValue: 'Active' })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {featuresStatus?.availableFeatures.length || 0} {t('superadmin.stats.available', { defaultValue: 'available to add' })}
                </p>
              </div>
            </div>
          </div>

          {/* Active Features with Superadmin Controls */}
          {featuresStatus?.activeFeatures && featuresStatus.activeFeatures.length > 0 && (
            <>
              <Separator className="my-4 bg-amber-400/20" />
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {t('superadmin.activeFeatures.title', { defaultValue: 'Active Features Control' })}
                </h4>
                <div className="grid gap-2">
                  {featuresStatus.activeFeatures.map(feature => (
                    <div
                      key={feature.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50 hover:border-amber-400/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={feature.active}
                            onCheckedChange={checked => {
                              if (!checked) {
                                setDisablingFeatureCode(feature.feature.code)
                              }
                            }}
                            className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-amber-400 data-[state=checked]:to-pink-500"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{feature.feature.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {feature.endDate
                              ? t('superadmin.activeFeatures.trialUntil', {
                                  defaultValue: 'Trial until {{date}}',
                                  date: formatDate(feature.endDate),
                                })
                              : t('superadmin.activeFeatures.fullyActive', { defaultValue: 'Fully active' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {formatCurrency(Number(feature.monthlyPrice) * 100, 'MXN')}/mo
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Disclaimer */}
          <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-400/30">
            <p className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {t('superadmin.disclaimer', {
                defaultValue:
                  'Changes made here only affect this venue. For platform-wide feature management, use the Superadmin dashboard.',
              })}
            </p>
          </div>
        </div>
      </SuperadminFeatureControl>

      <SuperadminFeatureDialogs
        venueId={venueId}
        venueName={venueName}
        featuresStatus={featuresStatus}
        formatCurrency={formatCurrency}
        showGrantTrialDialog={showGrantTrialDialog}
        setShowGrantTrialDialog={setShowGrantTrialDialog}
        showEnableFeatureDialog={showEnableFeatureDialog}
        setShowEnableFeatureDialog={setShowEnableFeatureDialog}
        disablingFeatureCode={disablingFeatureCode}
        setDisablingFeatureCode={setDisablingFeatureCode}
      />
    </>
  )
}
