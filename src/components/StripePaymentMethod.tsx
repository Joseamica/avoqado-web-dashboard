import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingButton } from '@/components/ui/loading-button'
import { Loader2 } from 'lucide-react'
import api from '@/api'

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '')

interface StripePaymentFormProps {
  venueId?: string
  clientSecret?: string
  onPaymentMethodCreated: (paymentMethodId: string) => void
  buttonText?: string
}

function StripePaymentForm({ venueId, clientSecret, onPaymentMethodCreated, buttonText = 'Comenzar trial gratuito' }: StripePaymentFormProps) {
  const { t } = useTranslation('payment')
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

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) {
      console.error('Card element not found')
      return
    }

    // Validate card is complete before submitting
    if (!cardComplete) {
      setError(t('stripe.completeCardInfo', 'Por favor completa la información de tu tarjeta'))
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      // If we have a clientSecret (SetupIntent), use confirmCardSetup for real validation
      // This validates the card can actually be charged (catches declined cards)
      if (clientSecret) {
        const { error: setupError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
          payment_method: {
            card: cardElement,
          },
        })

        if (setupError) {
          // Show user-friendly error messages for common decline codes
          const errorMessage = getStripeErrorMessage(setupError.code, setupError.message, t)
          setError(errorMessage)
          setIsSubmitting(false)
          return
        }

        if (!setupIntent || !setupIntent.payment_method) {
          setError(t('stripe.noPaymentMethod', 'No se pudo validar el método de pago'))
          setIsSubmitting(false)
          return
        }

        // Pass the validated payment method ID to parent
        const paymentMethodId = typeof setupIntent.payment_method === 'string'
          ? setupIntent.payment_method
          : setupIntent.payment_method.id
        onPaymentMethodCreated(paymentMethodId)
      } else {
        // Fallback: just create payment method (no real validation)
        const { error: createError, paymentMethod } = await stripe.createPaymentMethod({
          type: 'card',
          card: cardElement,
        })

        if (createError) {
          setError(createError.message || t('stripe.errorCreating', 'Error al crear método de pago'))
          setIsSubmitting(false)
          return
        }

        if (!paymentMethod) {
          setError(t('stripe.noPaymentMethod', 'No se creó el método de pago'))
          setIsSubmitting(false)
          return
        }

        onPaymentMethodCreated(paymentMethod.id)
      }
      // Keep isSubmitting true - parent will navigate away
    } catch (err: any) {
      console.error('Error processing payment method:', err)
      setError(err.message || t('stripe.errorProcessing', 'Error procesando el método de pago'))
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">{t('stripe.cardLabel')}</label>
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
            <p className="text-xs text-muted-foreground">
              {t('stripe.importantNote')}
            </p>
          </div>

          <LoadingButton type="submit" className="w-full" disabled={!isReady || !cardComplete || isSubmitting} isLoading={isSubmitting}>
            {buttonText}
          </LoadingButton>
        </CardContent>
      </Card>
    </form>
  )
}

/**
 * Get user-friendly error messages for Stripe error codes
 */
function getStripeErrorMessage(code: string | undefined, defaultMessage: string | undefined, t: any): string {
  const errorMessages: Record<string, string> = {
    'card_declined': t('stripe.errors.cardDeclined', 'Tu tarjeta fue rechazada. Intenta con otra tarjeta.'),
    'insufficient_funds': t('stripe.errors.insufficientFunds', 'Fondos insuficientes. Intenta con otra tarjeta.'),
    'expired_card': t('stripe.errors.expiredCard', 'Tu tarjeta ha expirado. Intenta con otra tarjeta.'),
    'incorrect_cvc': t('stripe.errors.incorrectCvc', 'El código de seguridad (CVC) es incorrecto.'),
    'incorrect_number': t('stripe.errors.incorrectNumber', 'El número de tarjeta es incorrecto.'),
    'processing_error': t('stripe.errors.processingError', 'Error al procesar la tarjeta. Intenta de nuevo.'),
    'invalid_expiry_year': t('stripe.errors.invalidExpiry', 'La fecha de expiración es inválida.'),
    'invalid_expiry_month': t('stripe.errors.invalidExpiry', 'La fecha de expiración es inválida.'),
  }

  return errorMessages[code || ''] || defaultMessage || t('stripe.errors.generic', 'Error al validar la tarjeta. Intenta con otra.')
}

interface StripePaymentMethodProps {
  venueId?: string
  useOnboardingIntent?: boolean
  onPaymentMethodCreated: (paymentMethodId: string) => void
  buttonText?: string
}

/**
 * Stripe payment method component with SetupIntent validation
 *
 * - When `venueId` is provided: uses venue SetupIntent for real card validation
 * - When `useOnboardingIntent` is true: uses onboarding SetupIntent (no customer yet)
 * - When neither: falls back to createPaymentMethod (format validation only)
 *
 * (catches declined cards BEFORE user completes the flow)
 */
export function StripePaymentMethod({ venueId, useOnboardingIntent, onPaymentMethodCreated, buttonText }: StripePaymentMethodProps) {
  const { t } = useTranslation('payment')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [isLoadingIntent, setIsLoadingIntent] = useState(false)
  const [intentError, setIntentError] = useState<string | null>(null)

  // Fetch SetupIntent when venueId or useOnboardingIntent is provided
  useEffect(() => {
    if (!venueId && !useOnboardingIntent) return

    const fetchSetupIntent = async () => {
      setIsLoadingIntent(true)
      setIntentError(null)
      try {
        let response
        if (useOnboardingIntent) {
          // Onboarding: create SetupIntent without customer
          response = await api.post('/api/v1/onboarding/setup-intent')
        } else {
          // Venue: create SetupIntent with customer
          response = await api.post(`/api/v1/dashboard/venues/${venueId}/setup-intent`)
        }
        setClientSecret(response.data.data.clientSecret)
      } catch (err: any) {
        console.error('Failed to create SetupIntent:', err)
        // Don't block - fall back to createPaymentMethod
        setIntentError(t('stripe.setupIntentError', 'No se pudo preparar la validación de tarjeta'))
      } finally {
        setIsLoadingIntent(false)
      }
    }

    fetchSetupIntent()
  }, [venueId, useOnboardingIntent, t])

  // Show loading while fetching SetupIntent
  if (isLoadingIntent) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">{t('stripe.preparingForm', 'Preparando formulario...')}</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <Elements stripe={stripePromise}>
      <StripePaymentForm
        venueId={venueId}
        clientSecret={clientSecret || undefined}
        onPaymentMethodCreated={onPaymentMethodCreated}
        buttonText={buttonText}
      />
    </Elements>
  )
}
