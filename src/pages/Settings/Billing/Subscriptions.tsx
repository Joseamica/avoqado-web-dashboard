// src/pages/Settings/Billing/Subscriptions.tsx
//
// "Plan y facturación → Plan" (spec 2026-09-27): one view. The plan row, all functions by area with "Tu selección",
// the contracts (whose panel also hosts the hybrid checkout) and the superadmin tools. Which server operation each
// choice opens is decided by plan/planActions.ts; this file only composes and orchestrates the dialogs.
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useSocket } from '@/context/SocketContext'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useVenueDateTime } from '@/utils/datetime'
import { getVenuePlan, type CancellationInput, type DowngradePreview } from '@/services/features.service'
import { hybridBilling, type HybridQuoteBody } from '@/services/hybridBilling.service'
import { StaffRole } from '@/types'
import { type TierId } from '@/config/plan-catalog'
import { CancelPlanDialog } from '@/components/billing/CancelPlanDialog'
import { DowngradeReconcileDialog } from '@/components/billing/DowngradeReconcileDialog'
import { HybridBillingPanel } from '@/components/billing/HybridBillingPanel'
import { PlanUpgradeDialog } from '@/components/billing/PlanUpgradeDialog'
import { planDePagoConcedido } from './planConcedido'
import { SuperadminBillingSection } from './components/SuperadminBillingSection'
import { FeatureGrid } from './plan/FeatureGrid'
import { PlanRow } from './plan/PlanRow'
import { SelectionSummary } from './plan/SelectionSummary'
import { serverCode, serverMessage, usePlanOperations } from './plan/usePlanOperations'
import {
  MAX_OFFERS,
  canDropWithFeatures,
  currentTarget,
  gridMode,
  isMarkable,
  originOf,
  summarizeSelection,
  type PlanOperation,
  type PlanTarget,
} from './plan/planActions'

type HybridDropOperation = Extract<PlanOperation, { kind: 'HYBRID_DROP' }>
/** Re-reads of the plan after Stripe's return (waits before each, ~10 s in all) before the toast says "pending". */
const CHECKOUT_REREADS_MS = [0, 1500, 3000, 5000]

export default function Subscriptions() {
  const { t } = useTranslation('billing')
  const { venueId, venue } = useCurrentVenue()
  const { can } = useAccess()
  const { staffInfo } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { socket } = useSocket()
  const { formatDate } = useVenueDateTime()
  const canRead = can('billing:subscriptions:read')
  const canManage = can('billing:subscriptions:manage')
  const isSuperadmin = staffInfo?.role === StaffRole.SUPERADMIN

  const plan = useQuery({ queryKey: ['venuePlan', venueId], queryFn: () => getVenuePlan(venueId), enabled: !!venueId && canRead })
  const grid = useQuery({
    queryKey: ['featureGrid', venueId],
    queryFn: () => hybridBilling.featureGrid(venueId),
    enabled: !!venueId && canRead,
    retry: false,
  })
  const replacements = useQuery({
    queryKey: ['hybrid-replacements', venueId],
    queryFn: () => hybridBilling.replacements(venueId),
    enabled: !!venueId && canRead,
    staleTime: 60000,
    retry: false,
  })

  const origin = originOf(plan.data)
  const grandfathered = plan.data?.grandfathered ?? false
  const current = currentTarget(origin)
  const [picked, setPicked] = useState<PlanTarget | null>(null)
  const target = picked ?? current
  const [marked, setMarked] = useState<string[]>([])
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly')
  const [classicRejected, setClassicRejected] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  // HYBRID keeps the operation that was reviewed: the grid stays live while the preview loads.
  const [reconcile, setReconcile] = useState<
    | { preview: DowngradePreview; purpose: 'CANCEL'; input: CancellationInput }
    | { preview: DowngradePreview; purpose: 'HYBRID'; op: HybridDropOperation }
    | null
  >(null)
  const [assistedTier, setAssistedTier] = useState<TierId | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ops = usePlanOperations(venueId, () => setCheckoutOpen(true))

  const selection = { origin, grandfathered, target, marked, grid: grid.data, replacements: replacements.data, classicRejected }
  const model = summarizeSelection({ ...selection, interval: billingInterval })
  const mode = gridMode(target, current, canDropWithFeatures(origin, replacements.data))
  const seatRule = origin.kind === 'CLASSIC' ? 'CHOOSE' : 'AUTOMATIC'

  // Stripe return (?checkout=success|cancel): the payment is acknowledged first; the plan only after a fresh read.
  const [searchParams, setSearchParams] = useSearchParams()
  const checkoutHandledRef = useRef(false)
  useEffect(() => {
    if (checkoutHandledRef.current) return
    const checkoutParam = searchParams.get('checkout')
    if (!checkoutParam) return
    checkoutHandledRef.current = true
    if (checkoutParam === 'success') {
      toast({ title: t('plan.checkoutReceived') })
      // Stripe sends the owner back a few seconds before its webhook grants the plan: re-read a few times before
      // saying "pending", or the toast contradicts a row that shows the plan a moment later.
      void (async () => {
        let granted = false
        for (const wait of CHECKOUT_REREADS_MS) {
          if (wait) await new Promise(resolve => setTimeout(resolve, wait))
          await Promise.all([
            queryClient.refetchQueries({ queryKey: ['venuePlan', venueId] }),
            queryClient.refetchQueries({ queryKey: ['featureGrid', venueId] }),
          ])
          granted = planDePagoConcedido(queryClient.getQueryData<{ state?: string }>(['venuePlan', venueId])?.state)
          if (granted) break
        }
        toast({ title: granted ? t('plan.checkoutSuccess') : t('plan.checkoutPending') })
      })()
    } else if (checkoutParam === 'cancel') {
      toast({ title: t('plan.checkoutCanceled') })
    }
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        next.delete('checkout')
        return next
      },
      { replace: true },
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time subscription changes refresh the plan and the grid.
  useEffect(() => {
    if (!socket || !venueId) return
    const refresh = () => {
      for (const key of ['venuePlan', 'featureGrid', 'venueFeatures', 'venueInvoices'])
        void queryClient.invalidateQueries({ queryKey: [key, venueId] })
    }
    socket.on('subscription.activated', refresh)
    socket.on('subscription.deactivated', refresh)
    return () => {
      socket.off('subscription.activated', refresh)
      socket.off('subscription.deactivated', refresh)
    }
  }, [socket, venueId, queryClient])

  const reset = () => {
    setPicked(null)
    setMarked([])
    setClassicRejected(false)
    setError(null)
  }
  const pick = (tier: PlanTarget) => {
    setPicked(tier === current ? null : tier)
    // A plan change starts the selection over: marks from another mode would sit in the summary with no checkbox.
    if (tier !== target) setMarked([])
    setClassicRejected(false)
    setError(null)
  }
  const toggle = (code: string) => {
    setMarked(prev => (prev.includes(code) ? prev.filter(item => item !== code) : prev.length >= MAX_OFFERS ? prev : [...prev, code]))
    setError(null)
  }
  // "Cambio asistido" always asks about a paid plan: going to Gratis is about the plan being left.
  const assistedFor = (tier: PlanTarget): PlanTarget => (tier === 'FREE' ? current : tier)
  const assistTier = assistedFor(target)
  const fail = (value: unknown) => setError(serverMessage(value, t('hybrid.error')))
  // The server refused "drop keeping functions": the spec's fallback is the plain drop at period end (§4.1).
  const fallbackDrop = () => {
    setMarked([])
    setError(null)
    setCancelOpen(true)
  }
  const quote = (body: HybridQuoteBody) => ops.hybridQuote.mutate(body, { onSuccess: reset, onError: fail })

  const review = async () => {
    const op = model.operation
    setError(null)
    if (op.kind === 'ASSISTED') {
      const tier = assistedFor(op.tier)
      if (tier !== 'FREE') setAssistedTier(tier)
      return
    }
    if (op.kind === 'CLASSIC_CHECKOUT')
      return ops.classicCheckout.mutate(
        { tier: op.tier, interval: billingInterval },
        { onError: value => (serverCode(value) === 'PLAN_ABSORBE_SUELTA' ? setClassicRejected(true) : fail(value)) },
      )
    if (op.kind === 'FEATURES') return quote({ lines: op.lines, replaceSubscriptionIds: [], dropFeatureCodes: [] })
    if (op.kind === 'HYBRID_REPLACE')
      return quote({ lines: op.lines, replaceSubscriptionIds: op.replaceSubscriptionIds, dropFeatureCodes: op.dropFeatureCodes })
    if (op.kind === 'HYBRID_DROP') {
      const preview = await ops.preview.mutateAsync().catch(value => void fail(value))
      if (!preview) return
      if (preview.required) return setReconcile({ preview, purpose: 'HYBRID', op })
      return quote({ lines: op.lines, replaceSubscriptionIds: op.replaceSubscriptionIds, dropFeatureCodes: op.dropFeatureCodes })
    }
    if (op.kind === 'DOWNGRADE_CLASSIC' || op.kind === 'CANCEL_CONTRACT') setCancelOpen(true)
  }

  const confirmCancel = async (input: CancellationInput) => {
    if (origin.kind === 'CONTRACT' && origin.contractId && origin.contractRevision != null)
      return ops.cancelContract.mutate(
        { contractId: origin.contractId, revision: origin.contractRevision, input },
        {
          onSuccess: () => {
            setCancelOpen(false)
            reset()
          },
        },
      )
    const preview = await ops.preview
      .mutateAsync()
      .catch(value => void toast({ title: serverMessage(value, t('plan.downgrade.errorToast')), variant: 'destructive' }))
    if (!preview) return
    if (preview.required) {
      setCancelOpen(false)
      return setReconcile({ preview, purpose: 'CANCEL', input })
    }
    ops.downgrade.mutate(
      { keep: [], input },
      {
        onSuccess: () => {
          setCancelOpen(false)
          reset()
        },
      },
    )
  }

  const confirmKeep = (keep: string[]) => {
    if (!reconcile) return
    if (reconcile.purpose === 'CANCEL')
      return ops.downgrade.mutate(
        { keep, input: reconcile.input },
        {
          onSuccess: () => {
            setReconcile(null)
            reset()
          },
        },
      )
    const { op } = reconcile
    setReconcile(null)
    quote({
      lines: op.lines,
      replaceSubscriptionIds: op.replaceSubscriptionIds,
      dropFeatureCodes: op.dropFeatureCodes,
      ...(keep.length ? { keepStaffVenueIds: keep } : {}),
    })
  }

  const tierName = origin.tier ? t(`plan.tiers.${origin.tier.toLowerCase()}.name`) : ''
  const until = origin.currentPeriodEnd ? formatDate(origin.currentPeriodEnd) : null
  // Every write in flight blocks every write control: quote and downgrade carry no idempotency key.
  const busy = Object.values(ops).some(op => op.isPending)

  if (plan.isLoading || grid.isLoading)
    return (
      <div className="p-8">
        <p>{t('loading')}</p>
      </div>
    )

  return (
    <>
      <div className="space-y-6 p-4 pb-28 sm:p-8 sm:pb-28 xl:pb-8" data-tour="plan-page">
        {plan.isError ? (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {t('plan.page.planError')}
          </p>
        ) : (
          <>
            <PlanRow
              origin={origin}
              planState={plan.data}
              grandfathered={grandfathered}
              grid={grid.data}
              replacements={replacements.data}
              classicRejected={classicRejected}
              current={current}
              selected={target}
              onSelect={pick}
              interval={billingInterval}
              onIntervalChange={setBillingInterval}
              canManage={canManage}
              busy={busy}
              onCancel={() => setCancelOpen(true)}
              onReactivate={() => ops.reactivate.mutate()}
              onUpdatePayment={() => ops.portal.mutate()}
            />
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              {grid.data ? (
                <FeatureGrid
                  entries={grid.data.entries}
                  purchasesEnabled={grid.data.purchasesEnabled}
                  mode={mode}
                  marked={marked}
                  isMarkable={entry => isMarkable(entry, mode)}
                  onToggle={toggle}
                  onPickTier={pick}
                  canManage={canManage && !grandfathered}
                  target={target}
                />
              ) : (
                grid.isError && (
                  <p
                    role="alert"
                    className="self-start rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                  >
                    {t('plan.page.gridError')}
                  </p>
                )
              )}
              {/* Outside the grid guard: the classic checkout and the drop need no grid (spec §4.1 falls back to ASSISTED). */}
              <SelectionSummary
                model={model}
                seatRule={seatRule}
                canManage={canManage}
                busy={busy}
                error={error}
                onReview={() => void review()}
                onPickTier={pick}
                onAssisted={assistTier !== 'FREE' ? () => setAssistedTier(assistTier) : undefined}
                onFallbackDrop={model.operation.kind === 'HYBRID_DROP' ? fallbackDrop : undefined}
              />
            </div>
          </>
        )}
        <HybridBillingPanel
          key={venueId}
          venueId={venueId}
          checkoutOpen={checkoutOpen}
          onCheckoutOpenChange={setCheckoutOpen}
          canRead={canRead}
          canManage={canManage}
          timezone={venue?.timezone ?? 'America/Mexico_City'}
        />
        {isSuperadmin && <SuperadminBillingSection venueId={venueId} venueName={venue?.name} planState={plan.data} />}
      </div>

      <PlanUpgradeDialog tier={assistedTier} title={t('plan.selection.assisted')} onClose={() => setAssistedTier(null)} />
      <CancelPlanDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        target={{
          kind: 'PLAN',
          tierName,
          until,
          classic: origin.kind === 'CLASSIC',
          retentionOfferEligible: plan.data?.retentionOfferEligible ?? false,
          pauseOfferEligible: plan.data?.pauseOfferEligible ?? false,
        }}
        seatNotice={seatRule}
        pending={ops.preview.isPending || ops.downgrade.isPending || ops.cancelContract.isPending}
        onConfirm={input => void confirmCancel(input)}
        onAcceptOffer={offer => ops.offer.mutate(offer, { onSuccess: () => setCancelOpen(false) })}
        offerPending={ops.offer.isPending}
      />
      {reconcile && (
        <DowngradeReconcileDialog
          open
          onClose={() => setReconcile(null)}
          preview={reconcile.preview}
          currentPeriodEnd={reconcile.purpose === 'CANCEL' ? origin.currentPeriodEnd : null}
          onConfirm={confirmKeep}
          pending={ops.downgrade.isPending || ops.hybridQuote.isPending}
          confirmLabel={reconcile.purpose === 'HYBRID' ? t('plan.downgrade.payCta') : undefined}
          onSkip={reconcile.purpose === 'HYBRID' ? () => confirmKeep([]) : undefined}
        />
      )}
    </>
  )
}
