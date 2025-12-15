import { useState, useEffect } from 'react'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingButton } from '@/components/ui/loading-button'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/hooks/use-toast'
import api from '@/api'
import { useAuth } from '@/context/AuthContext'

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '')

interface AddPaymentMethodFormProps {
  venueId: string
  onSuccess: () => void
  onCancel: () => void
}

function AddPaymentMethodForm({ venueId, onSuccess, onCancel }: AddPaymentMethodFormProps) {
  const { t } = useTranslation('billing')
  const { toast } = useToast()
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [cardComplete, setCardComplete] = useState(false)

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark')
      setIsDarkMode(isDark)
    }

    checkDarkMode()

    // Watch for theme changes
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!stripe || !elements) return

    setIsReady(true)

    // Listen to CardElement changes for validation
    const cardElement = elements.getElement(CardElement)
    if (!cardElement) return

    const handleChange = (event: any) => {
      if (event.error) {
        setError(event.error.message)
        setCardComplete(false)
      } else {
        setError(null)
        setCardComplete(event.complete)
      }
    }

    cardElement.on('change', handleChange)

    // Cleanup: remove listener when component unmounts
    return () => {
      cardElement.off('change', handleChange)
    }
  }, [stripe, elements])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      console.error('Stripe not loaded')
      return
    }

    if (!venueId) {
      setError(t('paymentMethods.errors.noVenue'))
      return
    }

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) {
      console.error('Card element not found')
      return
    }

    // Validate card is complete before submitting
    if (!cardComplete) {
      setError(t('paymentMethods.errors.incompleteCard'))
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      // 1. Get SetupIntent client secret from backend
      const setupIntentResponse = await api.post(`/api/v1/dashboard/venues/${venueId}/setup-intent`)
      const { clientSecret } = setupIntentResponse.data.data

      if (!clientSecret) {
        throw new Error('No client secret received')
      }

      // 2. Confirm the SetupIntent with Stripe
      const { error: confirmError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      })

      if (confirmError) {
        setError(confirmError.message || t('paymentMethods.errors.confirmFailed'))
        setIsSubmitting(false)
        return
      }

      if (!setupIntent || setupIntent.status !== 'succeeded') {
        setError(t('paymentMethods.errors.setupFailed'))
        setIsSubmitting(false)
        return
      }

      // 3. Success! Payment method is now attached to customer
      toast({
        title: t('paymentMethods.toasts.addSuccess'),
        variant: 'default',
      })

      // Wait 2 seconds for webhook to process duplicate detection
      // This prevents the UI from showing duplicates briefly
      await new Promise(resolve => setTimeout(resolve, 2000))

      onSuccess()
    } catch (err: any) {
      console.error('Error adding payment method:', err)
      setError(err.response?.data?.message || err.message || t('paymentMethods.errors.addFailed'))
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">{t('paymentMethods.form.cardLabel')}</label>
        <div className="rounded-md border border-input bg-background p-3">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: isDarkMode ? '#fafafa' : '#09090b',
                  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                  '::placeholder': {
                    color: isDarkMode ? '#a1a1aa' : '#71717a',
                  },
                },
                invalid: {
                  color: '#ef4444',
                  iconColor: '#ef4444',
                },
                complete: {
                  color: isDarkMode ? '#fafafa' : '#09090b',
                },
              },
            }}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="rounded-md border border-muted bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">{t('paymentMethods.form.securityNotice')}</p>
      </div>

      <div className="flex justify-end gap-2">
        <LoadingButton type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {t('common:cancel')}
        </LoadingButton>
        <LoadingButton type="submit" disabled={!isReady || !cardComplete || isSubmitting} isLoading={isSubmitting}>
          {t('paymentMethods.form.submitButton')}
        </LoadingButton>
      </div>
    </form>
  )
}

interface AddPaymentMethodDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  venueId?: string
}

export function AddPaymentMethodDialog({ open, onOpenChange, onSuccess, venueId }: AddPaymentMethodDialogProps) {
  const { t } = useTranslation('billing')
  const { activeVenue } = useAuth()

  // Use venueId prop or fall back to activeVenue
  const activeVenueId = venueId || activeVenue?.id

  const handleSuccess = () => {
    onSuccess()
    onOpenChange(false)
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  // Don't render if no venue is available
  if (!activeVenueId) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('paymentMethods.dialog.title')}</DialogTitle>
          <DialogDescription>{t('paymentMethods.dialog.description')}</DialogDescription>
        </DialogHeader>
        <Elements stripe={stripePromise}>
          <AddPaymentMethodForm venueId={activeVenueId} onSuccess={handleSuccess} onCancel={handleCancel} />
        </Elements>
      </DialogContent>
    </Dialog>
  )
}
