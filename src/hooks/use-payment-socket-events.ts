import { useEffect } from 'react'
import { useSocket } from '@/context/SocketContext'

/**
 * Payment Socket Event Types
 * Matches server-side events from avoqado-server/src/communication/sockets/types/index.ts
 */
export interface PaymentSocketEvent {
  paymentId: string
  orderId: string
  orderNumber?: string
  venueId: string
  amount: number
  tipAmount?: number
  method: string
  status: string
  timestamp: string
  tableId?: string | null
  metadata?: {
    cardBrand?: string
    last4?: string
    [key: string]: any
  }
}

export interface PaymentFailedEvent extends PaymentSocketEvent {
  errorMessage?: string
}

/**
 * Callbacks for payment socket events
 */
export interface PaymentSocketEventCallbacks {
  onPaymentInitiated?: (event: PaymentSocketEvent) => void
  onPaymentProcessing?: (event: PaymentSocketEvent) => void
  onPaymentCompleted?: (event: PaymentSocketEvent) => void
  onPaymentFailed?: (event: PaymentFailedEvent) => void
}

/**
 * Custom hook for payment real-time socket events
 *
 * Sets up listeners for all payment-related Socket.IO events from the server.
 * Automatically joins venue room and cleans up on unmount.
 *
 * @param venueId - The venue ID to subscribe to
 * @param callbacks - Optional callbacks for specific payment events
 *
 * @example
 * ```tsx
 * usePaymentSocketEvents(venueId, {
 *   onPaymentProcessing: (event) => {
 *     console.log('Payment processing:', event.paymentId)
 *     // Show loading indicator
 *   },
 *   onPaymentCompleted: (event) => {
 *     toast.success('Payment completed!')
 *     refetchPayments()
 *   },
 *   onPaymentFailed: (event) => {
 *     toast.error(`Payment failed: ${event.errorMessage}`)
 *   }
 * })
 * ```
 */
export function usePaymentSocketEvents(venueId: string | undefined, callbacks: PaymentSocketEventCallbacks = {}) {
  const { socket, joinVenueRoom, leaveVenueRoom } = useSocket()

  useEffect(() => {
    if (!venueId || !socket) return

    // Join venue-specific room
    joinVenueRoom(venueId)

    // Set up event listeners
    const { onPaymentInitiated, onPaymentProcessing, onPaymentCompleted, onPaymentFailed } = callbacks

    // Payment initiated
    if (onPaymentInitiated) {
      socket.on('payment_initiated', onPaymentInitiated)
    }

    // Payment processing
    if (onPaymentProcessing) {
      socket.on('payment_processing', onPaymentProcessing)
    }

    // Payment completed
    if (onPaymentCompleted) {
      socket.on('payment_completed', onPaymentCompleted)
    }

    // Payment failed
    if (onPaymentFailed) {
      socket.on('payment_failed', onPaymentFailed)
    }

    // Clean up event listeners when component unmounts
    return () => {
      if (onPaymentInitiated) socket.off('payment_initiated', onPaymentInitiated)
      if (onPaymentProcessing) socket.off('payment_processing', onPaymentProcessing)
      if (onPaymentCompleted) socket.off('payment_completed', onPaymentCompleted)
      if (onPaymentFailed) socket.off('payment_failed', onPaymentFailed)

      leaveVenueRoom(venueId)
    }
  }, [venueId, socket, joinVenueRoom, leaveVenueRoom, callbacks])
}
