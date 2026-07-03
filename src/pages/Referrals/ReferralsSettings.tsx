import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Users, Trophy, Gift, Sparkles, TrendingUp, PauseCircle, Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { GlassCard } from '@/components/ui/glass-card'
import { PermissionGate } from '@/components/PermissionGate'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useAccess } from '@/hooks/use-access'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { FeatureGate } from '@/components/billing/FeatureGate'
import referralsService from '@/services/referrals.service'
import { getIntlLocale } from '@/utils/i18n-locale'
import { cn } from '@/lib/utils'
import HallOfFame from './components/HallOfFame'
import RecentReferralsTable from './components/RecentReferralsTable'
import TierRewardSummary from './components/TierRewardSummary'
import TierRewardEditor from './components/TierRewardEditor'
import type { TierRewardInput } from '@/types/referrals'

// ─── Defaults (Mindform PDF reference values) ────────────────────────────────
const DEFAULT_ACTIVATION = {
  newCustomerDiscountPercent: 10,
  tier1ReferralsRequired: 7,
  tier1RewardPercent: 15,
  tier2ReferralsRequired: 12,
  tier2RewardPercent: 20,
  tier3ReferralsRequired: 20,
  tier3RewardPercent: 25,
  rewardCouponExpiryDays: 90,
}

// ─── Schema ──────────────────────────────────────────────────────────────────
const schema = z.object({
  newCustomerDiscountPercent: z.number().min(0).max(100),
  tier1ReferralsRequired: z.number().int().min(1),
  tier1RewardPercent: z.number().min(0).max(100),
  tier2ReferralsRequired: z.number().int().min(1),
  tier2RewardPercent: z.number().min(0).max(100),
  tier3ReferralsRequired: z.number().int().min(1),
  tier3RewardPercent: z.number().min(0).max(100),
  rewardCouponExpiryDays: z.number().int().min(1),
})

type FormData = z.infer<typeof schema>

// ─── Tier Row Component ──────────────────────────────────────────────────────
function TierRow({
  level,
  referralsField,
  rewardField,
  register,
  errors,
  t,
}: {
  level: 1 | 2 | 3
  referralsField: 'tier1ReferralsRequired' | 'tier2ReferralsRequired' | 'tier3ReferralsRequired'
  rewardField: 'tier1RewardPercent' | 'tier2RewardPercent' | 'tier3RewardPercent'
  register: ReturnType<typeof useForm<FormData>>['register']
  errors: ReturnType<typeof useForm<FormData>>['formState']['errors']
  t: (key: string) => string
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[80px_1fr_1fr] gap-3 items-end">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">{t('activate.tierLevel')}</Label>
        <div className="h-9 px-3 inline-flex items-center rounded-md border border-input bg-muted/30 text-sm font-semibold">
          {level}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium" htmlFor={`tier${level}Required`}>
          {t('activate.tierReferralsRequired')}
        </Label>
        <Input
          id={`tier${level}Required`}
          type="number"
          min={1}
          step={1}
          className="h-9"
          data-tour={`referrals-tier${level}-required`}
          {...register(referralsField, { valueAsNumber: true })}
        />
        {errors[referralsField] && (
          <p className="text-xs text-destructive">{errors[referralsField]?.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium" htmlFor={`tier${level}Reward`}>
          {t('activate.tierRewardPercent')}
        </Label>
        <div className="relative">
          <Input
            id={`tier${level}Reward`}
            type="number"
            min={0}
            max={100}
            step={1}
            className="h-9 pr-8"
            data-tour={`referrals-tier${level}-reward`}
            {...register(rewardField, { valueAsNumber: true })}
          />
          <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-xs text-muted-foreground">
            %
          </span>
        </div>
        {errors[rewardField] && <p className="text-xs text-destructive">{errors[rewardField]?.message}</p>}
      </div>
    </div>
  )
}

// ─── Metric Cell ─────────────────────────────────────────────────────────────
function MetricCell({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  accent: string
}) {
  return (
    <div className="rounded-xl border border-input bg-card p-4">
      <div className="flex items-start gap-3">
        <div className={cn('p-2 rounded-lg bg-linear-to-br shrink-0', accent)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
          <p className="text-lg font-bold mt-0.5 truncate">{value}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ReferralsSettings() {
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { t, i18n } = useTranslation('referrals')
  const { t: tCommon } = useTranslation()
  const { can } = useAccess()

  const [pauseOpen, setPauseOpen] = useState(false)
  const [pauseReason, setPauseReason] = useState('')
  const [editingTier, setEditingTier] = useState<1 | 2 | 3 | null>(null)

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['referrals-config', venueId],
    queryFn: () => referralsService.getConfig(venueId!),
    enabled: !!venueId,
  })

  const isActive = config?.active === true

  const { data: summary } = useQuery({
    queryKey: ['referrals-summary', venueId],
    queryFn: () => referralsService.getSummary(venueId!),
    enabled: !!venueId && isActive,
  })

  // ── Form ─────────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULT_ACTIVATION,
  })

  // ── Mutations ────────────────────────────────────────────────────────────
  const activateMutation = useMutation({
    mutationFn: (data: FormData) => {
      // Send explicit per-tier rewards (spec D4) so new venues land with
      // tierRewards populated from the start, not just the legacy flat percent
      // fields (which the backend's activate schema silently strips anyway).
      const tiers: TierRewardInput[] = [
        { tierLevel: 1, rewardType: 'PERCENT_COUPON', recurrence: 'ONE_TIME', rewardPercent: data.tier1RewardPercent },
        { tierLevel: 2, rewardType: 'PERCENT_COUPON', recurrence: 'ONE_TIME', rewardPercent: data.tier2RewardPercent },
        { tierLevel: 3, rewardType: 'PERCENT_COUPON', recurrence: 'ONE_TIME', rewardPercent: data.tier3RewardPercent },
      ]
      return referralsService.activate(venueId!, {
        newCustomerDiscountPercent: data.newCustomerDiscountPercent,
        tier1ReferralsRequired: data.tier1ReferralsRequired,
        tier2ReferralsRequired: data.tier2ReferralsRequired,
        tier3ReferralsRequired: data.tier3ReferralsRequired,
        rewardCouponExpiryDays: data.rewardCouponExpiryDays,
        tiers,
      })
    },
    onSuccess: () => {
      toast({ title: t('activate.success') })
      queryClient.invalidateQueries({ queryKey: ['referrals-config', venueId] })
      queryClient.invalidateQueries({ queryKey: ['referrals-summary', venueId] })
    },
    onError: (error: any) => {
      toast({
        title: tCommon('common.error'),
        description: error.response?.data?.message || t('activate.error'),
        variant: 'destructive',
      })
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (reason: string) => referralsService.deactivate(venueId!, reason),
    onSuccess: () => {
      toast({ title: t('active.paused') })
      setPauseOpen(false)
      setPauseReason('')
      queryClient.invalidateQueries({ queryKey: ['referrals-config', venueId] })
    },
    onError: (error: any) => {
      toast({
        title: tCommon('common.error'),
        description: error.response?.data?.message,
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (data: FormData) => activateMutation.mutate(data)

  // Reset pause reason on close
  useEffect(() => {
    if (!pauseOpen) setPauseReason('')
  }, [pauseOpen])

  // Format date in venue locale (best effort — using i18n locale)
  const formattedActivatedAt = (() => {
    if (!config?.activatedAt) return ''
    try {
      return new Intl.DateTimeFormat(getIntlLocale(i18n.language), {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(new Date(config.activatedAt))
    } catch {
      return config.activatedAt
    }
  })()

  // ── Loading state ────────────────────────────────────────────────────────
  if (configLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-2">
          <div className="h-7 bg-muted rounded-lg w-48" />
          <div className="h-4 bg-muted rounded w-72" />
        </div>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8 space-y-4">
            <div className="h-52 bg-muted/50 rounded-2xl" />
            <div className="h-64 bg-muted/50 rounded-2xl" />
          </div>
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="h-44 bg-muted/50 rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  // ── ACTIVE STATE ─────────────────────────────────────────────────────────
  if (isActive) {
    const conversionPct = summary ? Math.round((summary.conversionRate ?? 0) * 100) : 0
    const hasTierRewards = (config?.tierRewards?.length ?? 0) > 0
    const topReferrerName = summary?.topReferrer
      ? [summary.topReferrer.firstName, summary.topReferrer.lastName].filter(Boolean).join(' ').trim() || '—'
      : '—'

    // Thresholds per level — used both for display and to bound the "Editar
    // nivel" editor's ordering validation (tier1 < tier2 < tier3).
    const tierThresholds: Record<1 | 2 | 3, number | undefined> = {
      1: config?.tier1ReferralsRequired,
      2: config?.tier2ReferralsRequired,
      3: config?.tier3ReferralsRequired,
    }
    const tierLegacyPercents: Record<1 | 2 | 3, number | undefined> = {
      1: config?.tier1RewardPercent,
      2: config?.tier2RewardPercent,
      3: config?.tier3RewardPercent,
    }

    return (
      <FeatureGate feature="REFERRAL_PROGRAM">
      <div className="p-6">
        <div className="mb-6">
          <PageTitleWithInfo title={t('title')} className="text-2xl font-bold" />
          <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* LEFT: status + config readout */}
          <div className="col-span-12 lg:col-span-8 space-y-4">
            {/* Status banner */}
            <GlassCard className="p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-linear-to-br from-green-500/20 to-green-500/5">
                    <Sparkles className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">
                      {t('active.banner', { date: formattedActivatedAt })}
                    </h3>
                    <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
                  </div>
                </div>
                <PermissionGate permission="referral:configure">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPauseOpen(true)}
                    data-tour="referrals-pause-btn"
                  >
                    <PauseCircle className="h-4 w-4 mr-2" />
                    {t('active.pauseButton')}
                  </Button>
                </PermissionGate>
              </div>
            </GlassCard>

            {/* Current tier config (read-only for MVP) */}
            <GlassCard className="p-5">
              <div className="flex items-start gap-3 mb-5">
                <div className="p-2 rounded-xl bg-linear-to-br from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{t('activate.tiers')}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('activate.description')}</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* New customer discount */}
                <div className="rounded-xl border border-input bg-muted/30 p-3 flex items-center justify-between">
                  <p className="text-sm">{t('activate.newCustomerDiscount')}</p>
                  <span className="text-sm font-semibold">{config?.newCustomerDiscountPercent ?? 0}%</span>
                </div>

                {/* Tier rows */}
                <div className="rounded-xl border border-input divide-y divide-input">
                  {hasTierRewards ? (
                    // New: natural-language read-only summary (spec D4). Only used once the
                    // backend returns `tierRewards` — legacy venues keep the table below untouched.
                    ([1, 2, 3] as const).map(level => (
                      <div key={level} className="flex items-center gap-2 pr-2">
                        <div className="flex-1 min-w-0">
                          <TierRewardSummary
                            venueId={venueId!}
                            tierLevel={level}
                            referralsRequired={tierThresholds[level]}
                            legacyRewardPercent={tierLegacyPercents[level]}
                            tierRewards={config?.tierRewards ?? []}
                          />
                        </div>
                        <PermissionGate permission="referral:configure">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0"
                            onClick={() => setEditingTier(level)}
                            data-tour={`referrals-tier${level}-edit-btn`}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1.5" />
                            {t('activate.editTier')}
                          </Button>
                        </PermissionGate>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                        <span>{t('activate.tierLevel')}</span>
                        <span>{t('activate.tierReferralsRequired')}</span>
                        <span className="text-right">{t('activate.tierRewardPercent')}</span>
                        <span />
                      </div>
                      {([1, 2, 3] as const).map(level => (
                        <div key={level} className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 px-3 py-2.5 text-sm items-center">
                          <span className="font-semibold">{level}</span>
                          <span>{tierThresholds[level] ?? '—'}</span>
                          <span className="text-right font-medium">{tierLegacyPercents[level] ?? '—'}%</span>
                          <PermissionGate permission="referral:configure">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingTier(level)}
                              data-tour={`referrals-tier${level}-edit-btn`}
                            >
                              <Pencil className="h-3.5 w-3.5 mr-1.5" />
                              {t('activate.editTier')}
                            </Button>
                          </PermissionGate>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* Coupon expiry */}
                <div className="rounded-xl border border-input bg-muted/30 p-3 flex items-center justify-between">
                  <p className="text-sm">{t('activate.tierExpiry')}</p>
                  <span className="text-sm font-semibold">{config?.rewardCouponExpiryDays ?? 0}</span>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* RIGHT: summary metrics */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold text-sm">{t('active.summaryHeading')}</h3>
              </div>
              <div className="space-y-3">
                <MetricCell
                  icon={Users}
                  label={t('active.metrics.referralsThisMonth')}
                  value={summary?.referralsThisMonth ?? 0}
                  accent="from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400"
                />
                <MetricCell
                  icon={TrendingUp}
                  label={t('active.metrics.conversionRate')}
                  value={`${conversionPct}%`}
                  accent="from-green-500/20 to-green-500/5 text-green-600 dark:text-green-400"
                />
                <MetricCell
                  icon={Gift}
                  label={t('active.metrics.couponsEmitted')}
                  value={summary?.couponsEmittedThisMonth ?? 0}
                  accent="from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400"
                />
                <MetricCell
                  icon={Trophy}
                  label={t('active.metrics.topReferrer')}
                  value={topReferrerName}
                  accent="from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400"
                />
              </div>
            </GlassCard>
          </div>
        </div>

        {/* Hall of Fame + Recent referrals table (full-width below metrics) */}
        <div className="mt-6 space-y-6">
          <HallOfFame venueId={venueId!} />
          <RecentReferralsTable venueId={venueId!} />
        </div>

        {/* Pause confirmation */}
        <AlertDialog open={pauseOpen} onOpenChange={setPauseOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('active.pauseConfirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('active.pauseConfirmDescription')}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="pauseReason" className="text-sm">
                {t('active.pauseReasonLabel')}
              </Label>
              <Textarea
                id="pauseReason"
                value={pauseReason}
                onChange={e => setPauseReason(e.target.value)}
                rows={3}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{tCommon('common.cancel', { defaultValue: 'Cancelar' })}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deactivateMutation.mutate(pauseReason.trim() || 'No reason provided')}
                disabled={deactivateMutation.isPending}
              >
                {t('active.pauseSubmit')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Per-tier reward editor (spec D4 "Editar nivel") */}
        {editingTier !== null && (
          <TierRewardEditor
            venueId={venueId!}
            tierLevel={editingTier}
            initialReferralsRequired={tierThresholds[editingTier]}
            initialRewards={(config?.tierRewards ?? []).filter(r => r.tierLevel === editingTier && r.active)}
            legacyRewardPercent={tierLegacyPercents[editingTier]}
            minReferralsRequired={editingTier > 1 ? tierThresholds[(editingTier - 1) as 1 | 2] : undefined}
            maxReferralsRequired={editingTier < 3 ? tierThresholds[(editingTier + 1) as 2 | 3] : undefined}
            onClose={() => setEditingTier(null)}
          />
        )}
      </div>
      </FeatureGate>
    )
  }

  // ── ACTIVATION STATE (active = false) ────────────────────────────────────
  const canConfigure = can('referral:configure')

  return (
    <FeatureGate feature="REFERRAL_PROGRAM">
    <div className="p-6">
      <div className="mb-6">
        <PageTitleWithInfo title={t('title')} className="text-2xl font-bold" />
        <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8 space-y-4">
            <GlassCard className="p-5">
              <div className="flex items-start gap-3 mb-5">
                <div className="p-2 rounded-xl bg-linear-to-br from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm">{t('activate.header')}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('activate.description')}</p>
                </div>
              </div>

              {/* New customer discount */}
              <div className="space-y-1.5 mb-5">
                <Label className="text-sm font-medium" htmlFor="newCustomerDiscountPercent">
                  {t('activate.newCustomerDiscount')}
                </Label>
                <div className="relative max-w-[200px]">
                  <Input
                    id="newCustomerDiscountPercent"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    className="h-9 pr-8"
                    data-tour="referrals-new-customer-discount"
                    {...register('newCustomerDiscountPercent', { valueAsNumber: true })}
                  />
                  <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-xs text-muted-foreground">
                    %
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {t('activate.newCustomerDiscountHint')}
                </p>
                {errors.newCustomerDiscountPercent && (
                  <p className="text-xs text-destructive">{errors.newCustomerDiscountPercent.message}</p>
                )}
              </div>
            </GlassCard>

            {/* Tiers */}
            <GlassCard className="p-5">
              <div className="flex items-start gap-3 mb-5">
                <div className="p-2 rounded-xl bg-linear-to-br from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400">
                  <Trophy className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm">{t('activate.tiers')}</h3>
                </div>
              </div>

              <div className="space-y-4">
                <TierRow
                  level={1}
                  referralsField="tier1ReferralsRequired"
                  rewardField="tier1RewardPercent"
                  register={register}
                  errors={errors}
                  t={t}
                />
                <div className="border-t border-input" />
                <TierRow
                  level={2}
                  referralsField="tier2ReferralsRequired"
                  rewardField="tier2RewardPercent"
                  register={register}
                  errors={errors}
                  t={t}
                />
                <div className="border-t border-input" />
                <TierRow
                  level={3}
                  referralsField="tier3ReferralsRequired"
                  rewardField="tier3RewardPercent"
                  register={register}
                  errors={errors}
                  t={t}
                />
              </div>
            </GlassCard>

            {/* Expiry */}
            <GlassCard className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 rounded-xl bg-linear-to-br from-orange-500/20 to-orange-500/5 text-orange-600 dark:text-orange-400">
                  <Gift className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm">{t('activate.tierExpiry')}</h3>
                </div>
              </div>
              <div className="space-y-1.5 max-w-[200px]">
                <Label className="text-sm font-medium" htmlFor="rewardCouponExpiryDays">
                  {t('activate.tierExpiry')}
                </Label>
                <Input
                  id="rewardCouponExpiryDays"
                  type="number"
                  min={1}
                  step={1}
                  className="h-9"
                  data-tour="referrals-expiry-days"
                  {...register('rewardCouponExpiryDays', { valueAsNumber: true })}
                />
                {errors.rewardCouponExpiryDays && (
                  <p className="text-xs text-destructive">{errors.rewardCouponExpiryDays.message}</p>
                )}
              </div>
            </GlassCard>
          </div>

          {/* RIGHT: submit + permission notice */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <GlassCard className="p-5 sticky top-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold text-sm">{t('activate.header')}</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{t('activate.description')}</p>

              {canConfigure ? (
                <PermissionGate permission="referral:configure">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={activateMutation.isPending}
                    data-tour="referrals-activate-btn"
                  >
                    {activateMutation.isPending ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                        {t('activate.submitting')}
                      </>
                    ) : (
                      t('activate.submit')
                    )}
                  </Button>
                </PermissionGate>
              ) : (
                <p className="text-xs text-muted-foreground italic border border-input rounded-md p-3 bg-muted/30">
                  {t('permissions.noConfigureAccess')}
                </p>
              )}
            </GlassCard>
          </div>
        </div>
      </form>
    </div>
    </FeatureGate>
  )
}
