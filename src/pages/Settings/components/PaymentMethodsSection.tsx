import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { CreditCard, AlertCircle, Trash2, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/hooks/use-toast'
import { AddPaymentMethodDialog } from '@/components/AddPaymentMethodDialog'
import api from '@/api'
import getIcon from '@/utils/getIcon'

interface PaymentMethod {
  id: string
  card: {
    brand: string
    last4: string
    exp_month: number
    exp_year: number
  }
  isDefault: boolean
}

interface PaymentMethodsSectionProps {
  venueId: string
  defaultPaymentMethodLast4?: string // From featuresStatus
  openAddDialog?: boolean // External control for opening add dialog
  onOpenAddDialogChange?: (open: boolean) => void // Callback when dialog state changes
}

export function PaymentMethodsSection({
  venueId,
  defaultPaymentMethodLast4,
  openAddDialog,
  onOpenAddDialogChange
}: PaymentMethodsSectionProps) {
  const { t } = useTranslation('billing')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [internalShowAddDialog, setInternalShowAddDialog] = useState(false)
  const [deletingPaymentMethodId, setDeletingPaymentMethodId] = useState<string | null>(null)
  const [removingPaymentMethodId, setRemovingPaymentMethodId] = useState<string | null>(null)

  // Use external control if provided, otherwise use internal state
  const showAddPaymentDialog = openAddDialog !== undefined ? openAddDialog : internalShowAddDialog
  const setShowAddPaymentDialog = (open: boolean) => {
    if (onOpenAddDialogChange) {
      onOpenAddDialogChange(open)
    } else {
      setInternalShowAddDialog(open)
    }
  }

  // Fetch payment methods
  const { data: paymentMethods, isLoading: loadingPaymentMethods } = useQuery<PaymentMethod[]>({
    queryKey: ['paymentMethods', venueId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payment-methods`)
      return response.data.data
    },
    enabled: !!venueId,
  })

  // Remove payment method mutation
  const removePaymentMethodMutation = useMutation({
    mutationFn: (paymentMethodId: string) => api.delete(`/api/v1/dashboard/venues/${venueId}/payment-methods/${paymentMethodId}`),
    onSuccess: () => {
      toast({
        title: t('paymentMethods.toasts.removeSuccess'),
        variant: 'default',
      })
      queryClient.invalidateQueries({ queryKey: ['paymentMethods', venueId] })
      queryClient.invalidateQueries({ queryKey: ['venueFeatures', venueId] })
      setDeletingPaymentMethodId(null)
      setRemovingPaymentMethodId(null)
    },
    onError: (error: any) => {
      toast({
        title: t('paymentMethods.toasts.removeError'),
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      })
      setRemovingPaymentMethodId(null)
    },
  })

  // Set default payment method mutation
  const setDefaultPaymentMethodMutation = useMutation({
    mutationFn: (paymentMethodId: string) =>
      api.put(`/api/v1/dashboard/venues/${venueId}/payment-methods/set-default`, { paymentMethodId }),
    onSuccess: () => {
      toast({
        title: t('paymentMethods.toasts.setDefaultSuccess'),
        variant: 'default',
      })
      queryClient.invalidateQueries({ queryKey: ['paymentMethods', venueId] })
      queryClient.invalidateQueries({ queryKey: ['venueFeatures', venueId] })
    },
    onError: (error: any) => {
      toast({
        title: t('paymentMethods.toasts.setDefaultError'),
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      })
    },
  })

  // Handle payment method success
  const handlePaymentMethodSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['paymentMethods', venueId] })
    queryClient.invalidateQueries({ queryKey: ['venueFeatures', venueId] })
  }

  // Get card brand display name
  const getCardBrand = (brand: string) => {
    const brandMap: Record<string, string> = {
      visa: 'Visa',
      mastercard: 'Mastercard',
      amex: 'American Express',
      discover: 'Discover',
      diners: 'Diners Club',
      jcb: 'JCB',
      unionpay: 'UnionPay',
    }
    return brandMap[brand.toLowerCase()] || brand.charAt(0).toUpperCase() + brand.slice(1)
  }

  // Handle delete confirmation
  const handleDeleteConfirm = () => {
    if (deletingPaymentMethodId) {
      setRemovingPaymentMethodId(deletingPaymentMethodId)
      removePaymentMethodMutation.mutate(deletingPaymentMethodId)
    }
  }

  return (
    <>
      <Card data-payment-methods-section>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              <CardTitle>{t('paymentMethods.title')}</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowAddPaymentDialog(true)}>
              <CreditCard className="h-4 w-4 mr-2" />
              {t('paymentMethods.addButton')}
            </Button>
          </div>
          <CardDescription>{t('paymentMethods.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPaymentMethods ? (
            <p className="text-muted-foreground">{t('loading')}</p>
          ) : !paymentMethods?.length ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">{t('paymentMethods.noPaymentMethods')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('paymentMethods.addFirst')}</p>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {paymentMethods.map(method => {
                const isDefault = defaultPaymentMethodLast4 === method.card.last4 || method.isDefault
                const isRemoving = removingPaymentMethodId === method.id

                return (
                  <Card key={method.id} className={isDefault ? 'border-primary' : ''}>
                    <CardContent className="p-4 space-y-3">
                      {/* Card brand */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {getIcon(method.card.brand)}
                          <div>
                            <p className="text-sm font-medium">{getCardBrand(method.card.brand)}</p>
                            <p className="text-xs text-muted-foreground">{t('paymentMethods.cardEnding', { last4: method.card.last4 })}</p>
                          </div>
                        </div>
                        {isDefault && (
                          <span className="text-[10px] font-medium text-primary border border-primary/30 rounded px-1.5 py-0.5">
                            {t('paymentMethods.defaultBadge')}
                          </span>
                        )}
                      </div>

                      {/* Expiration */}
                      <p className="text-xs text-muted-foreground">
                        {t('paymentMethods.expiresOn', {
                          month: String(method.card.exp_month).padStart(2, '0'),
                          year: method.card.exp_year,
                        })}
                      </p>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {!isDefault && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => setDefaultPaymentMethodMutation.mutate(method.id)}
                            disabled={setDefaultPaymentMethodMutation.isPending}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            {t('paymentMethods.setDefaultButton')}
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          className={isDefault ? 'flex-1' : 'w-9 px-0'}
                          onClick={() => setDeletingPaymentMethodId(method.id)}
                          disabled={isRemoving}
                        >
                          {isRemoving ? (
                            <span className="text-xs">{t('paymentMethods.removing')}</span>
                          ) : (
                            <>
                              <Trash2 className="h-3 w-3" />
                              {isDefault && <span className="ml-1 text-xs">{t('paymentMethods.removeButton')}</span>}
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deletingPaymentMethodId} onOpenChange={() => setDeletingPaymentMethodId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('paymentMethods.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('paymentMethods.deleteDialog.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('paymentMethods.deleteDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Payment Method Dialog */}
      <AddPaymentMethodDialog
        open={showAddPaymentDialog}
        onOpenChange={setShowAddPaymentDialog}
        onSuccess={handlePaymentMethodSuccess}
        venueId={venueId}
      />
    </>
  )
}
