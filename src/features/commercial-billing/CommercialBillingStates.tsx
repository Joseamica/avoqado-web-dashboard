import { AlertCircle, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function CommercialBillingSkeleton() {
  return (
    <div className="space-y-5 px-4 py-6 sm:px-8" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="rounded-xl border border-border p-5 space-y-4">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  )
}

export function CommercialBillingUnavailable({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation('billing')
  return (
    <div className="px-4 py-6 sm:px-8">
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>{t('commercialBilling.unavailable.title')}</AlertTitle>
        <AlertDescription>
          <p>{t('commercialBilling.unavailable.description')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 cursor-pointer gap-2"
            data-tour="commercial-billing-retry"
            onClick={onRetry}
          >
            <RefreshCw className="size-4" />
            {t('commercialBilling.actions.retry')}
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  )
}

export function CommercialBillingIncompatible({ supportCode }: { supportCode: string }) {
  const { t } = useTranslation('billing')
  return (
    <div className="px-4 py-6 sm:px-8">
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>{t('commercialBilling.incompatible.title')}</AlertTitle>
        <AlertDescription>
          <p>{t('commercialBilling.incompatible.description')}</p>
          <code className="mt-2 rounded bg-muted px-2 py-1 text-xs text-foreground">{supportCode}</code>
        </AlertDescription>
      </Alert>
    </div>
  )
}
