/**
 * Credit Offer Banner
 *
 * A discrete invitation banner shown to venues that have a pending credit offer.
 * Following the Square Capital model: venues see the offer amount and terms,
 * but NEVER their internal credit scores.
 *
 * This banner appears in the AvailableBalance page when a venue has been
 * pre-qualified for a merchant cash advance.
 */

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  getPendingCreditOffer,
  expressInterestInOffer,
  declineCreditOffer,
  type CreditOffer,
} from '@/services/creditOffer.service'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { useToast } from '@/hooks/use-toast'
import {
  Sparkles,
  X,
  ArrowRight,
  Clock,
  Percent,
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CreditOfferBannerProps {
  venueId: string
}

export function CreditOfferBanner({ venueId }: CreditOfferBannerProps) {
  const { t } = useTranslation('creditOffer')
  const { formatDate } = useVenueDateTime()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Query for pending credit offer
  const { data, isLoading } = useQuery({
    queryKey: ['credit-offer', venueId],
    queryFn: () => getPendingCreditOffer(venueId),
    enabled: !!venueId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Express interest mutation
  const interestMutation = useMutation({
    mutationFn: (offerId: string) => expressInterestInOffer(venueId, offerId),
    onSuccess: () => {
      toast({
        title: t('interest.success'),
        description: t('interest.successDescription'),
      })
      setShowDetailsDialog(false)
      queryClient.invalidateQueries({ queryKey: ['credit-offer', venueId] })
    },
    onError: () => {
      toast({
        title: t('interest.error'),
        description: t('interest.errorDescription'),
        variant: 'destructive',
      })
    },
  })

  // Decline mutation
  const declineMutation = useMutation({
    mutationFn: (offerId: string) => declineCreditOffer(venueId, offerId),
    onSuccess: () => {
      toast({
        title: t('decline.success'),
        description: t('decline.successDescription'),
      })
      setDismissed(true)
      queryClient.invalidateQueries({ queryKey: ['credit-offer', venueId] })
    },
  })

  // Don't render if no offer, dismissed, or loading
  if (isLoading || !data?.hasOffer || !data.offer || dismissed) {
    return null
  }

  const offer = data.offer

  return (
    <>
      {/* Compact Banner */}
      <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Icon and message */}
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900">
                <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-medium text-emerald-900 dark:text-emerald-100">
                  {t('banner.title')}
                </p>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  {t('banner.subtitle', { amount: Currency(offer.offerAmount) })}
                </p>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => declineMutation.mutate(offer.id)}
                disabled={declineMutation.isPending}
                className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 hover:bg-emerald-100 dark:hover:bg-emerald-900"
              >
                {declineMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                <span className="sr-only">{t('banner.dismiss')}</span>
              </Button>
              <Button
                size="sm"
                onClick={() => setShowDetailsDialog(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-primary-foreground"
              >
                {t('banner.learnMore')}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900">
                <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <DialogTitle>{t('dialog.title')}</DialogTitle>
                <DialogDescription>{t('dialog.description')}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Offer Amount */}
            <div className="text-center py-6 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-xl">
              <p className="text-sm text-muted-foreground mb-1">{t('dialog.offerAmount')}</p>
              <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
                {Currency(offer.offerAmount)}
              </p>
              <Badge variant="secondary" className="mt-2">
                {t('dialog.preQualified')}
              </Badge>
            </div>

            {/* Terms Grid */}
            <div className="grid grid-cols-2 gap-4">
              <TermCard
                icon={<Percent className="h-4 w-4" />}
                label={t('dialog.repaymentPercent')}
                value={`${(offer.repaymentPercent * 100).toFixed(0)}%`}
                description={t('dialog.repaymentPercentDesc')}
              />
              <TermCard
                icon={<Calendar className="h-4 w-4" />}
                label={t('dialog.estimatedTerm')}
                value={`~${offer.estimatedTermDays} ${t('dialog.days')}`}
                description={t('dialog.estimatedTermDesc')}
              />
            </div>

            {/* Total Repayment */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">{t('dialog.totalRepayment')}</p>
                  <p className="text-sm text-muted-foreground">{t('dialog.factorRate', { rate: offer.factorRate.toFixed(2) })}</p>
                </div>
                <p className="text-xl font-semibold">{Currency(offer.totalRepayment)}</p>
              </div>
            </div>

            {/* Expiration Notice */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{t('dialog.expiresOn', { date: formatDate(offer.expiresAt) })}</span>
            </div>

            {/* How it works */}
            <div className="space-y-2">
              <p className="font-medium text-sm">{t('dialog.howItWorks')}</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>{t('dialog.step1')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>{t('dialog.step2')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>{t('dialog.step3')}</span>
                </li>
              </ul>
            </div>

            {/* Disclaimer */}
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-sm text-amber-800 dark:text-amber-200">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{t('dialog.disclaimer')}</span>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDetailsDialog(false)}
              className="w-full sm:w-auto"
            >
              {t('dialog.maybeLater')}
            </Button>
            <Button
              onClick={() => interestMutation.mutate(offer.id)}
              disabled={interestMutation.isPending}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
            >
              {interestMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t('dialog.interested')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Helper component for term cards
function TermCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode
  label: string
  value: string
  description: string
}) {
  return (
    <div className="p-3 border rounded-lg">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  )
}
