import { useEffect } from 'react'
import { useSocket } from '@/context/SocketContext'

/**
 * A custom hook that sets up socket event listeners for real-time updates
 *
 * @param venueId - The venue ID to subscribe to
 * @param onPosUpdate - Callback function for payment updates
 * @param onShiftUpdate - Optional callback function for shift updates
 */
export function useSocketEvents(venueId: string | undefined, onPosUpdate: (data: any) => void, onShiftUpdate?: (data: any) => void) {
  const { socket, joinVenueRoom, leaveVenueRoom } = useSocket()

  useEffect(() => {
    if (!venueId || !socket) return

    // Join venue-specific room
    joinVenueRoom(venueId)

    // Listen for payment updates
    socket.on('updateDashboard', onPosUpdate)

    // Listen for shift updates if callback is provided
    if (onShiftUpdate) {
      socket.on('shiftUpdate', onShiftUpdate)
    }

    // Clean up event listeners when component unmounts
    return () => {
      socket.off('updateDashboard', onPosUpdate)
      if (onShiftUpdate) {
        socket.off('shiftUpdate', onShiftUpdate)
      }
      leaveVenueRoom(venueId)
    }
  }, [venueId, socket, joinVenueRoom, leaveVenueRoom, onPosUpdate, onShiftUpdate])
}
