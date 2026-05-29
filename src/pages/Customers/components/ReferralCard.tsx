import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
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
import { PermissionGate } from '@/components/PermissionGate'
import { useToast } from '@/hooks/use-toast'
import referralsService from '@/services/referrals.service'
import { useVenueDateTime } from '@/utils/datetime'
import { getIntlLocale } from '@/utils/i18n-locale'
import type { ReferralTier } from '@/types/referrals'

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

export function ReferralCard({ customer, venueId, venueName }: ReferralCardProps) {
  const { t, i18n } = useTranslation('referrals')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatDate } = useVenueDateTime()

  const [showReferralsList, setShowReferralsList] = useState(false)

  const referralCount = customer.referralCount ?? 0
  const hasCode = !!customer.referralCode
  const tier = customer.referralTier ?? null
  const tierBadge = tier ? TIER_BADGE_STYLES[tier] : null
  const nextTier = getNextTierInfo(referralCount)
  const progressPct = nextTier.reached
    ? 100
    : Math.min(100, Math.round((referralCount / nextTier.threshold) * 100))

  // ─── Customer referrals list (lazy on first expand) ────────────
  const { data: referralsList, isLoading: referralsLoading } = useQuery({
    queryKey: ['customer-referrals', venueId, customer.id],
    queryFn: () => referralsService.getCustomerReferrals(venueId, customer.id),
    enabled: showReferralsList && hasCode,
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
                        className="flex items-center justify-between text-xs px-2 py-1.5 rounded-md bg-muted/40"
                      >
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
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </GlassCard>
  )
}

export default ReferralCard
