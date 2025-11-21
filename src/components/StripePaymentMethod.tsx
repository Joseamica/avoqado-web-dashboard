import { useState, useEffect } from 'react'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingButton } from '@/components/ui/loading-button'

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '')

interface StripePaymentFormProps {
  onPaymentMethodCreated: (paymentMethodId: string) => void
  buttonText?: string
}

function StripePaymentForm({ onPaymentMethodCreated, buttonText = 'Comenzar trial gratuito' }: StripePaymentFormProps) {
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
      setError('Por favor completa la información de tu tarjeta')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      // Create payment method
      const { error: createError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      })

      if (createError) {
        setError(createError.message || 'Error creating payment method')
        setIsSubmitting(false)
        return
      }

      if (!paymentMethod) {
        setError('No payment method created')
        setIsSubmitting(false)
        return
      }

      // Pass payment method ID to parent
      onPaymentMethodCreated(paymentMethod.id)
      // Keep isSubmitting true - parent will navigate away
    } catch (err: any) {
      console.error('Error creating payment method:', err)
      setError(err.message || 'Error processing payment method')
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Tarjeta de crédito o débito</label>
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
              💳 <strong>Importante:</strong> No se realizará ningún cargo durante los 5 días de prueba. Tu tarjeta será verificada y se
              guardará para la suscripción mensual que comenzará después del período de prueba.
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

interface StripePaymentMethodProps {
  onPaymentMethodCreated: (paymentMethodId: string) => void
  buttonText?: string
}

export function StripePaymentMethod({ onPaymentMethodCreated, buttonText }: StripePaymentMethodProps) {
  return (
    <Elements stripe={stripePromise}>
      <StripePaymentForm onPaymentMethodCreated={onPaymentMethodCreated} buttonText={buttonText} />
    </Elements>
  )
}
