import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Calendar, CreditCard, AlertCircle, RefreshCw } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { useVenueDateTime } from '@/utils/datetime'
import { getVenuePlan, cancelVenuePlan, reactivateVenuePlan, getBillingPortalUrl, type PlanState } from '@/services/features.service'

const BADGE_VARIANT: Record<PlanState['state'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  trial: 'secondary',
  canceling: 'outline',
  past_due: 'destructive',
  suspended: 'destructive',
  canceled: 'destructive',
  none: 'outline',
}

export function CurrentPlanCard({ venueId }: { venueId: string }) {
  const { t, i18n } = useTranslation('billing')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatDate } = useVenueDateTime()
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  const { data: plan, isLoading } = useQuery<PlanState>({
    queryKey: ['venuePlan', venueId],
    queryFn: () => getVenuePlan(venueId),
    enabled: !!venueId,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['venuePlan', venueId] })
    queryClient.invalidateQueries({ queryKey: ['venueFeatures', venueId] })
  }

  const cancelMutation = useMutation({
    mutationFn: () => cancelVenuePlan(venueId),
    onSuccess: () => {
      invalidate()
      toast({ title: t('currentPlan.toast.cancelSuccess'), variant: 'default' })
      setShowCancelDialog(false)
    },
    onError: () => toast({ title: t('currentPlan.toast.error'), variant: 'destructive' }),
  })

  const reactivateMutation = useMutation({
    mutationFn: () => reactivateVenuePlan(venueId),
    onSuccess: () => {
      invalidate()
      toast({ title: t('currentPlan.toast.reactivateSuccess'), variant: 'default' })
    },
    onError: () => toast({ title: t('currentPlan.toast.error'), variant: 'destructive' }),
  })

  const portalMutation = useMutation({
    mutationFn: () => getBillingPortalUrl(venueId),
    onSuccess: ({ url }) => {
      if (url) window.location.href = url
    },
    onError: () => toast({ title: t('currentPlan.toast.error'), variant: 'destructive' }),
  })

  if (isLoading) return null
  if (!plan || plan.state === 'none' || !plan.hasPlan) return null

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat(i18n.language, { style: 'currency', currency: plan.price?.currency || 'MXN' }).format(amount)

  const intervalSuffix = plan.interval === 'year' ? t('currentPlan.perYear') : t('currentPlan.perMonth')

  // Date line per state.
  const dateLine = (() => {
    if (plan.state === 'trial' && plan.trialEndsAt) {
      return { icon: <Calendar className="h-3.5 w-3.5" />, text: t('currentPlan.trialEndsOn', { date: formatDate(plan.trialEndsAt) }) }
    }
    if (plan.state === 'canceling' && plan.currentPeriodEnd) {
      return { icon: <AlertCircle className="h-3.5 w-3.5" />, text: t('currentPlan.endsOn', { date: formatDate(plan.currentPeriodEnd) }) }
    }
    if (plan.currentPeriodEnd) {
      return { icon: <Calendar className="h-3.5 w-3.5" />, text: t('currentPlan.renewsOn', { date: formatDate(plan.currentPeriodEnd) }) }
    }
    return null
  })()

  return (
    <>
      <Card className="border-2 border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{t('currentPlan.title')}</CardTitle>
              <CardDescription>{plan.planName}</CardDescription>
            </div>
            <Badge variant={BADGE_VARIANT[plan.state]}>{t(`currentPlan.status.${plan.state}`)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Price (gross, IVA-inclusive) */}
          {plan.price && (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{formatMoney(plan.price.gross)}</span>
              <span className="text-sm text-muted-foreground">{intervalSuffix}</span>
              <span className="text-xs text-muted-foreground">· {t('currentPlan.ivaIncluded')}</span>
            </div>
          )}

          {/* Date line */}
          {dateLine && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              {dateLine.icon}
              {dateLine.text}
            </div>
          )}

          {/* Payment method summary */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CreditCard className="h-3.5 w-3.5" />
            {plan.paymentMethod
              ? t('currentPlan.paymentMethod', { brand: plan.paymentMethod.brand, last4: plan.paymentMethod.last4 })
              : t('currentPlan.noPaymentMethod')}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            {plan.cancelAtPeriodEnd ? (
              <Button size="sm" onClick={() => reactivateMutation.mutate()} disabled={reactivateMutation.isPending}>
                <RefreshCw className="h-4 w-4 mr-1.5" />
                {t('currentPlan.actions.reactivate')}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCancelDialog(true)}
                disabled={cancelMutation.isPending || plan.state === 'canceled'}
              >
                {t('currentPlan.actions.cancel')}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => portalMutation.mutate()} disabled={portalMutation.isPending}>
              <CreditCard className="h-4 w-4 mr-1.5" />
              {t('currentPlan.actions.updatePayment')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cancel confirmation — copy reflects real currentPeriodEnd (end of period, NOT immediate) */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('currentPlan.cancelDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {plan.currentPeriodEnd
                ? t('currentPlan.cancelDialog.description', { date: formatDate(plan.currentPeriodEnd) })
                : t('currentPlan.cancelDialog.descriptionNoDate')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('currentPlan.cancelDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelMutation.mutate()}
            >
              {t('currentPlan.cancelDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default CurrentPlanCard
