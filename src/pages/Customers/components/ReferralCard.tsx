import { useMemo, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Gift,
  MessageCircle,
  Star,
  Sparkles,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GlassCard } from '@/components/ui/glass-card'
import { Progress } from '@/components/ui/progress'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PermissionGate } from '@/components/PermissionGate'
import { useToast } from '@/hooks/use-toast'
import referralsService from '@/services/referrals.service'
import { getProduct } from '@/services/menu.service'
import { useVenueDateTime } from '@/utils/datetime'
import { getIntlLocale } from '@/utils/i18n-locale'
import { cn } from '@/lib/utils'
import type { ReferralTier, ReferralRewardGrantView } from '@/types/referrals'

// TODO: tier thresholds (7 / 12 / 20) are hardcoded to the Mindform defaults.
// Ideally these come from the ReferralProgramConfig fetched at page level
// and passed through props. Centralize when the parent page wires config.
const TIER_THRESHOLDS = {
  TIER_1: 7,
  TIER_2: 12,
  TIER_3: 20,
} as const

const TIER_BADGE_STYLES: Record<ReferralTier, { stars: string; color: string }> = {
  TIER_1: { stars: '⭐', color: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200' },
  TIER_2: { stars: '⭐⭐', color: 'bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200' },
  TIER_3: { stars: '⭐⭐⭐', color: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200' },
}

interface ReferralCardProps {
  customer: {
    id: string
    firstName: string | null
    lastName: string | null
    referralCode?: string | null
    referralCount?: number
    referralTier?: ReferralTier | null
    tierUnlockedAt?: string | null
    referredByCustomer?: {
      id: string
      firstName: string | null
      lastName: string | null
    } | null
  }
  venueId: string
  /** The venue's user-friendly name (or slug) used in the WhatsApp share message. */
  venueName: string
}

interface NextTierInfo {
  /** Display label for the level the customer is progressing toward (1/2/3) */
  level: 1 | 2 | 3
  threshold: number
  /** Returns true when this customer has reached the maximum tier. */
  reached: boolean
}

function getNextTierInfo(count: number): NextTierInfo {
  if (count < TIER_THRESHOLDS.TIER_1) return { level: 1, threshold: TIER_THRESHOLDS.TIER_1, reached: false }
  if (count < TIER_THRESHOLDS.TIER_2) return { level: 2, threshold: TIER_THRESHOLDS.TIER_2, reached: false }
  if (count < TIER_THRESHOLDS.TIER_3) return { level: 3, threshold: TIER_THRESHOLDS.TIER_3, reached: false }
  return { level: 3, threshold: TIER_THRESHOLDS.TIER_3, reached: true }
}

// ─── Reward grant badges (rewards[] per referral — Task 4) ─────────────────

type TFunction = (key: string, options?: Record<string, unknown>) => string

function formatPercentValue(value: string | number | null | undefined): string {
  if (value == null) return '0'
  const n = Number(value)
  return Number.isFinite(n) ? n.toString() : String(value)
}

/** One badge per `ReferralRewardGrantView`, styled by `status` (spec: ISSUED
 * normal, REDEEMED check+muted, REVOKED strikethrough+muted, MANUAL_PENDING
 * amber, MANUAL_FULFILLED check). `fulfilledDate`, when present, is ONLY
 * known for grants fulfilled in THIS session (the list endpoint doesn't
 * return `fulfilledAt` — see `fulfilledDates` state below) — "date if
 * available" degrades gracefully to no date otherwise. */
function RewardBadge({
  reward,
  t,
  fulfilledDate,
  formatDate,
}: {
  reward: ReferralRewardGrantView
  t: TFunction
  fulfilledDate?: string
  formatDate: (date: string) => string
}) {
  const label = (() => {
    switch (reward.rewardType) {
      case 'PERCENT_COUPON':
        return reward.couponCode
          ? t('card.rewardBadgeCouponWithCode', {
              percent: formatPercentValue(reward.rewardPercent),
              code: reward.couponCode,
            })
          : t('card.rewardBadgeCoupon', { percent: formatPercentValue(reward.rewardPercent) })
      case 'PERMANENT_DISCOUNT':
        return t('card.rewardBadgePermanent', { percent: formatPercentValue(reward.rewardPercent) })
      case 'FREE_PRODUCT':
        return t('card.rewardBadgeProduct', { quantity: reward.rewardQuantity })
      default:
        return ''
    }
  })()

  const showCheck = reward.status === 'REDEEMED' || reward.status === 'MANUAL_FULFILLED'
  const dateSuffix =
    reward.status === 'MANUAL_FULFILLED' && fulfilledDate
      ? ` · ${formatDate(fulfilledDate)}`
      : ''

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[11px] font-normal gap-1',
        reward.status === 'REDEEMED' && 'text-muted-foreground',
        reward.status === 'REVOKED' && 'text-muted-foreground line-through opacity-70',
        reward.status === 'MANUAL_PENDING' &&
          'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800',
        reward.status === 'MANUAL_FULFILLED' &&
          'text-green-700 dark:text-green-300 border-green-300 dark:border-green-800',
      )}
      data-testid={`referral-card-reward-badge-${reward.id}`}
    >
      {showCheck && <Check className="h-3 w-3" aria-hidden="true" />}
      {label}
      {dateSuffix}
    </Badge>
  )
}

/** Product ids for `FREE_PRODUCT` grants pending manual fulfillment — resolved
 * to display names so staff know exactly what to hand over. Same query-key
 * shape as `TierRewardSummary`'s `useProductNames` so the cache is shared. */
function usePendingProductNames(venueId: string, productIds: string[]): Record<string, string> {
  const uniqueIds = Array.from(new Set(productIds.filter(Boolean)))

  const results = useQueries({
    queries: uniqueIds.map(id => ({
      queryKey: ['product-name', venueId, id],
      queryFn: () => getProduct(venueId, id),
      enabled: !!venueId && !!id,
      staleTime: 5 * 60 * 1000,
    })),
  })

  const map: Record<string, string> = {}
  uniqueIds.forEach((id, idx) => {
    const name = results[idx]?.data?.name
    if (name) map[id] = name
  })
  return map
}

interface PendingCourtesy {
  grantId: string
  referredCustomerName: string
  rewardProductId: string | null
  rewardQuantity: number
}

export function ReferralCard({ customer, venueId, venueName }: ReferralCardProps) {
  const { t, i18n } = useTranslation('referrals')
  const { t: tCommon } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatDate } = useVenueDateTime()

  const [showReferralsList, setShowReferralsList] = useState(false)
  const [confirmingGrantId, setConfirmingGrantId] = useState<string | null>(null)
  // Grants fulfilled DURING this session — the list endpoint never returns
  // `fulfilledAt`, so this is the only source for "check + date" on a
  // freshly-fulfilled MANUAL_FULFILLED badge (spec: "date if available").
  const [fulfilledDates, setFulfilledDates] = useState<Record<string, string>>({})

  const referralCount = customer.referralCount ?? 0
  const hasCode = !!customer.referralCode
  const tier = customer.referralTier ?? null
  const tierBadge = tier ? TIER_BADGE_STYLES[tier] : null
  const nextTier = getNextTierInfo(referralCount)
  const progressPct = nextTier.reached
    ? 100
    : Math.min(100, Math.round((referralCount / nextTier.threshold) * 100))

  // ─── Customer referrals list ────────────────────────────────────
  // Fetched whenever the customer has a code (not gated by `showReferralsList`
  // anymore) — the "Cortesía pendiente" block below must be visible without
  // the owner having to expand the collapsible history first.
  const { data: referralsList, isLoading: referralsLoading } = useQuery({
    queryKey: ['customer-referrals', venueId, customer.id],
    queryFn: () => referralsService.getCustomerReferrals(venueId, customer.id),
    enabled: hasCode,
  })

  // ─── Pending courtesies (FREE_PRODUCT grants awaiting manual handoff) ───
  const pendingCourtesies: PendingCourtesy[] = useMemo(() => {
    if (!referralsList) return []
    const items: PendingCourtesy[] = []
    referralsList.forEach(ref => {
      ref.rewards?.forEach(reward => {
        if (reward.rewardType === 'FREE_PRODUCT' && reward.status === 'MANUAL_PENDING') {
          const name =
            [ref.referredCustomer.firstName, ref.referredCustomer.lastName].filter(Boolean).join(' ').trim() ||
            t('hallOfFame.unknown')
          items.push({
            grantId: reward.id,
            referredCustomerName: name,
            rewardProductId: reward.rewardProductId,
            rewardQuantity: reward.rewardQuantity,
          })
        }
      })
    })
    return items
  }, [referralsList, t])

  const pendingProductIds = pendingCourtesies
    .filter(item => item.rewardProductId)
    .map(item => item.rewardProductId as string)
  const pendingProductNames = usePendingProductNames(venueId, pendingProductIds)

  // ─── Fulfill a pending courtesy (Task 4) ─────────────────────────
  const fulfillMutation = useMutation({
    mutationFn: (grantId: string) => referralsService.fulfillGrant(venueId, grantId),
    onSuccess: grant => {
      toast({ title: t('card.fulfillSuccess') })
      if (grant.fulfilledAt) {
        setFulfilledDates(prev => ({ ...prev, [grant.id]: grant.fulfilledAt as string }))
      }
      queryClient.invalidateQueries({ queryKey: ['customer-referrals', venueId, customer.id] })
    },
    onError: (error: unknown) => {
      const responseData =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { error?: string; message?: string } } }).response?.data
          : undefined
      const description =
        responseData?.error === 'GRANT_NO_PENDIENTE'
          ? t('card.fulfillErrorAlreadyHandled')
          : responseData?.message || responseData?.error
      toast({
        title: t('card.fulfillError'),
        description,
        variant: 'destructive',
      })
    },
  })

  // ─── Activate code mutation (State C) ────────────────────────────
  const activateMutation = useMutation({
    mutationFn: () => referralsService.generateCustomerCode(venueId, customer.id),
    onSuccess: () => {
      toast({ title: t('card.activateSuccess') })
      queryClient.invalidateQueries({ queryKey: ['customer', venueId, customer.id] })
    },
    onError: (error: unknown) => {
      const description =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined
      toast({
        title: t('card.activateError'),
        description,
        variant: 'destructive',
      })
    },
  })

  // ─── Copy code ────────────────────────────────────────────────────
  const handleCopy = async () => {
    if (!customer.referralCode) return
    try {
      await navigator.clipboard.writeText(customer.referralCode)
      toast({ title: t('card.copied') })
    } catch {
      // Silent — toast won't show. Acceptable for the rare clipboard failure case.
    }
  }

  // ─── WhatsApp share ───────────────────────────────────────────────
  const whatsappHref = (() => {
    if (!customer.referralCode) return '#'
    const message = t('card.whatsappMessage', {
      venue: venueName,
      code: customer.referralCode,
    })
    return `https://wa.me/?text=${encodeURIComponent(message)}`
  })()

  // ─── Tier B header date ───────────────────────────────────────────
  const tierUnlockedLabel = (() => {
    if (!customer.tierUnlockedAt) return ''
    try {
      return new Intl.DateTimeFormat(getIntlLocale(i18n.language), {
        day: '2-digit',
        month: 'short',
      }).format(new Date(customer.tierUnlockedAt))
    } catch {
      return customer.tierUnlockedAt
    }
  })()

  const referredByName = customer.referredByCustomer
    ? [customer.referredByCustomer.firstName, customer.referredByCustomer.lastName]
        .filter(Boolean)
        .join(' ')
        .trim() || t('hallOfFame.unknown')
    : null

  // ─── State C — no code yet ────────────────────────────────────────
  if (!hasCode) {
    return (
      <GlassCard className="border-input p-5" data-testid="referral-card">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-linear-to-br from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400">
            <Gift className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold">{t('card.title')}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{t('card.stateC_noCode')}</p>
        <PermissionGate permission="referral:configure">
          <Button
            variant="outline"
            size="sm"
            onClick={() => activateMutation.mutate()}
            disabled={activateMutation.isPending}
            data-testid="referral-card-activate-btn"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {t('card.stateC_activate')}
          </Button>
        </PermissionGate>
      </GlassCard>
    )
  }

  // ─── State A/B — has code ─────────────────────────────────────────
  return (
    <GlassCard className="border-input p-5" data-testid="referral-card">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-linear-to-br from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400">
          <Gift className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold">{t('card.title')}</h3>
      </div>

      {/* State B header: tier badge + unlock date */}
      {tier && tierBadge && (
        <div className="flex items-center gap-2 mb-3">
          <Badge className={tierBadge.color} aria-label={`Tier ${tier}`}>
            <span aria-hidden="true">{tierBadge.stars}</span>
            <span className="ml-1">{t('card.stateB_tierLabel', {
              level: tier === 'TIER_1' ? 1 : tier === 'TIER_2' ? 2 : 3,
              date: tierUnlockedLabel,
            })}</span>
          </Badge>
        </div>
      )}

      {/* Code row + actions */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <code
          className="font-mono text-sm bg-muted px-2 py-1 rounded"
          data-testid="referral-card-code"
        >
          {customer.referralCode}
        </code>
        <PermissionGate permission="referral:read">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            data-testid="referral-card-copy-btn"
            className="cursor-pointer"
          >
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            {t('card.copyButton')}
          </Button>
        </PermissionGate>
        <PermissionGate permission="referral:read">
          <Button
            variant="outline"
            size="sm"
            asChild
            data-testid="referral-card-whatsapp-btn"
            className="cursor-pointer"
          >
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
              {t('card.whatsappButton')}
            </a>
          </Button>
        </PermissionGate>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        {nextTier.reached ? (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Star className="h-3 w-3" />
            {t('card.tier3Reached')}
          </p>
        ) : (
          <>
            <Progress
              value={progressPct}
              aria-label={t('card.stateA_progress', {
                count: referralCount,
                required: nextTier.threshold,
                level: nextTier.level,
              })}
              data-testid="referral-card-progress"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              {t('card.stateA_progress', {
                count: referralCount,
                required: nextTier.threshold,
                level: nextTier.level,
              })}
            </p>
          </>
        )}
      </div>

      {/* Cortesía pendiente — FREE_PRODUCT grants awaiting manual handoff */}
      {pendingCourtesies.length > 0 && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
            <h4 className="text-xs font-semibold text-amber-800 dark:text-amber-200">
              {t('card.pendingCourtesyTitle')}
            </h4>
          </div>
          <ul className="space-y-1.5" data-testid="referral-card-pending-courtesies">
            {pendingCourtesies.map(item => {
              const productName =
                (item.rewardProductId && pendingProductNames[item.rewardProductId]) ||
                t('activate.rewardProductFallback')
              const isFulfillingThis = fulfillMutation.isPending && fulfillMutation.variables === item.grantId
              return (
                <li
                  key={item.grantId}
                  className="flex items-center justify-between gap-2 text-xs"
                  data-testid={`referral-card-pending-item-${item.grantId}`}
                >
                  <span className="truncate">
                    {t('card.pendingCourtesyItem', {
                      quantity: item.rewardQuantity,
                      product: productName,
                      name: item.referredCustomerName,
                    })}
                  </span>
                  <PermissionGate permission="referral:fulfill-courtesy">
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 h-7 text-xs cursor-pointer"
                      onClick={() => setConfirmingGrantId(item.grantId)}
                      disabled={isFulfillingThis}
                      data-testid={`referral-card-fulfill-btn-${item.grantId}`}
                    >
                      {t('card.fulfillButton')}
                    </Button>
                  </PermissionGate>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Referred by */}
      {referredByName && (
        <p className="text-xs text-muted-foreground mb-2">
          {t('card.referredBy', { name: referredByName })}
        </p>
      )}

      {/* Has referred N — collapsible list */}
      {referralCount > 0 && (
        <div className="border-t border-input pt-3 mt-3">
          <button
            type="button"
            onClick={() => setShowReferralsList(prev => !prev)}
            className="flex items-center justify-between w-full text-xs text-foreground hover:text-foreground/80 cursor-pointer"
            data-testid="referral-card-toggle-list"
          >
            <span>{t('card.referredCount', { count: referralCount })}</span>
            <span className="flex items-center gap-1">
              {showReferralsList ? t('card.hideReferralsList') : t('card.viewReferralsList')}
              {showReferralsList ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </span>
          </button>

          {showReferralsList && (
            <div className="mt-3 space-y-1.5">
              {referralsLoading && (
                <p className="text-xs text-muted-foreground">{t('card.loadingReferrals')}</p>
              )}
              {!referralsLoading && referralsList && referralsList.length === 0 && (
                <p className="text-xs text-muted-foreground italic">{t('card.noReferralsYet')}</p>
              )}
              {!referralsLoading && referralsList && referralsList.length > 0 && (
                <ul className="space-y-1.5" data-testid="referral-card-referrals-list">
                  {referralsList.map(ref => {
                    const refName = [
                      ref.referredCustomer.firstName,
                      ref.referredCustomer.lastName,
                    ]
                      .filter(Boolean)
                      .join(' ')
                      .trim() || t('hallOfFame.unknown')
                    return (
                      <li
                        key={ref.id}
                        className="flex flex-col gap-1.5 text-xs px-2 py-1.5 rounded-md bg-muted/40"
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">{refName}</span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            <span className="text-muted-foreground">{formatDate(ref.createdAt)}</span>
                            <Badge
                              variant="outline"
                              className={
                                ref.status === 'QUALIFIED'
                                  ? 'text-green-700 dark:text-green-300'
                                  : ref.status === 'VOID'
                                    ? 'text-red-700 dark:text-red-300'
                                    : 'text-amber-700 dark:text-amber-300'
                              }
                            >
                              {t(
                                ref.status === 'QUALIFIED'
                                  ? 'table.statusQualified'
                                  : ref.status === 'VOID'
                                    ? 'table.statusVoid'
                                    : 'table.statusPending',
                              )}
                            </Badge>
                          </span>
                        </div>
                        {/* Reward grants — only rendered when the backend sends `rewards[]`
                            (Task 1 optional field). Absent/empty → identical to the
                            legacy render above (backward compat). */}
                        {ref.rewards && ref.rewards.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {ref.rewards.map(reward => (
                              <RewardBadge
                                key={reward.id}
                                reward={reward}
                                t={t}
                                fulfilledDate={fulfilledDates[reward.id]}
                                formatDate={formatDate}
                              />
                            ))}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Fulfill-courtesy confirmation */}
      <ConfirmDialog
        open={confirmingGrantId !== null}
        onOpenChange={open => {
          if (!open) setConfirmingGrantId(null)
        }}
        title={t('card.fulfillConfirmTitle')}
        description={t('card.fulfillConfirmDescription')}
        confirmText={t('card.fulfillButton')}
        cancelText={tCommon('common.cancel', { defaultValue: 'Cancelar' })}
        onConfirm={() => {
          if (confirmingGrantId) fulfillMutation.mutate(confirmingGrantId)
        }}
      />
    </GlassCard>
  )
}

export default ReferralCard
