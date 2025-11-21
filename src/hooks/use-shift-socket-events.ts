import { useEffect } from 'react'
import { useSocket } from '@/context/SocketContext'

/**
 * Shift Socket Event Types
 * Matches server-side events from avoqado-server/src/communication/sockets/types/index.ts
 */
export interface ShiftSocketEvent {
  shiftId: string
  staffId: string
  staffName: string
  status: 'OPEN' | 'CLOSED'
  startTime: string
  endTime?: string
  startingCash?: number
  endingCash?: number
  totalSales?: number
  totalTips?: number
  totalOrders?: number
  totalCashPayments?: number
  totalCardPayments?: number
  totalVoucherPayments?: number
  totalOtherPayments?: number
  totalProductsSold?: number
  venueId: string
  timestamp: string
  correlationId: string
  metadata?: Record<string, any>
}

/**
 * Callbacks for shift socket events
 */
export interface ShiftSocketEventCallbacks {
  onShiftOpened?: (event: ShiftSocketEvent) => void
  onShiftClosed?: (event: ShiftSocketEvent) => void
  onShiftUpdated?: (event: ShiftSocketEvent) => void
}

/**
 * Custom hook for shift real-time socket events
 *
 * Sets up listeners for all shift-related Socket.IO events from the server.
 * Automatically joins venue room and cleans up on unmount.
 *
 * @param venueId - The venue ID to subscribe to
 * @param callbacks - Optional callbacks for specific shift events
 *
 * @example
 * ```tsx
 * useShiftSocketEvents(venueId, {
 *   onShiftOpened: (event) => {
 *     console.log('Shift opened:', event.shiftId)
 *     toast.success(`Shift opened by ${event.staffName}`)
 *     queryClient.invalidateQueries({ queryKey: ['shifts', venueId] })
 *   },
 *   onShiftClosed: (event) => {
 *     console.log('Shift closed:', event.shiftId)
 *     toast.success(`Shift closed - Total sales: $${event.totalSales}`)
 *     queryClient.invalidateQueries({ queryKey: ['shifts', venueId] })
 *   }
 * })
 * ```
 */
export function useShiftSocketEvents(venueId: string | undefined, callbacks: ShiftSocketEventCallbacks = {}) {
  const { socket, joinVenueRoom, leaveVenueRoom } = useSocket()

  useEffect(() => {
    if (!venueId || !socket) return

    // Join venue-specific room
    joinVenueRoom(venueId)

    // Set up event listeners
    const { onShiftOpened, onShiftClosed, onShiftUpdated } = callbacks

    // Shift opened
    if (onShiftOpened) {
      socket.on('shift_opened', onShiftOpened)
    }

    // Shift closed
    if (onShiftClosed) {
      socket.on('shift_closed', onShiftClosed)
    }

    // Shift updated
    if (onShiftUpdated) {
      socket.on('shift_updated', onShiftUpdated)
    }

    // Clean up event listeners when component unmounts
    return () => {
      if (onShiftOpened) socket.off('shift_opened', onShiftOpened)
      if (onShiftClosed) socket.off('shift_closed', onShiftClosed)
      if (onShiftUpdated) socket.off('shift_updated', onShiftUpdated)

      leaveVenueRoom(venueId)
    }
  }, [venueId, socket, joinVenueRoom, leaveVenueRoom, callbacks])
}
