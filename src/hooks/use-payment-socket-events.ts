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
  const { onPaymentInitiated, onPaymentProcessing, onPaymentCompleted, onPaymentFailed } = callbacks

  useEffect(() => {
    if (!venueId || !socket) return

    console.log('🔌 [Payment Socket] Joining venue room:', venueId)

    // Join venue-specific room
    joinVenueRoom(venueId)

    // Payment initiated
    if (onPaymentInitiated) {
      console.log('📥 [Payment Socket] Registering payment_initiated listener')
      socket.on('payment_initiated', onPaymentInitiated)
    }

    // Payment processing
    if (onPaymentProcessing) {
      console.log('📥 [Payment Socket] Registering payment_processing listener')
      socket.on('payment_processing', onPaymentProcessing)
    }

    // Payment completed
    if (onPaymentCompleted) {
      console.log('📥 [Payment Socket] Registering payment_completed listener')
      socket.on('payment_completed', onPaymentCompleted)
    }

    // Payment failed
    if (onPaymentFailed) {
      console.log('📥 [Payment Socket] Registering payment_failed listener')
      socket.on('payment_failed', onPaymentFailed)
    }

    // Clean up event listeners when component unmounts
    return () => {
      console.log('🔌 [Payment Socket] Cleaning up listeners and leaving room:', venueId)
      if (onPaymentInitiated) socket.off('payment_initiated', onPaymentInitiated)
      if (onPaymentProcessing) socket.off('payment_processing', onPaymentProcessing)
      if (onPaymentCompleted) socket.off('payment_completed', onPaymentCompleted)
      if (onPaymentFailed) socket.off('payment_failed', onPaymentFailed)

      leaveVenueRoom(venueId)
    }
    // ✅ FIX: Extract callbacks outside, don't include them in dependencies
  }, [venueId, socket, joinVenueRoom, leaveVenueRoom, onPaymentInitiated, onPaymentProcessing, onPaymentCompleted, onPaymentFailed])
}
