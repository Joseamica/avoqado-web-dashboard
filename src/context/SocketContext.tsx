import React, { createContext, useContext, useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  joinVenueRoom: (venueId: string) => void
  leaveVenueRoom: (venueId: string) => void
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  joinVenueRoom: () => {},
  leaveVenueRoom: () => {},
})

export const useSocket = () => useContext(SocketContext)

interface SocketProviderProps {
  children: React.ReactNode
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  // Determine the appropriate backend URL
  const socketUrl = import.meta.env.VITE_API_URL || 'https://api.avoqado.io'

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io(socketUrl, {
      transports: ['websocket'],
      withCredentials: true,
      autoConnect: true,
    })

    // Set up event listeners
    socketInstance.on('connect', () => {
      console.log('Socket connected')
      setIsConnected(true)
    })

    socketInstance.on('disconnect', () => {
      console.log('Socket disconnected')
      setIsConnected(false)
    })

    socketInstance.on('connect_error', error => {
      console.error('Socket connection error:', error)
      setIsConnected(false)
    })

    setSocket(socketInstance)

    // Clean up on unmount
    return () => {
      socketInstance.disconnect()
    }
  }, [socketUrl])

  // Join a venue-specific room
  const joinVenueRoom = (venueId: string) => {
    if (socket && venueId) {
      console.log(`Joining venue room: venue_${venueId}`)
      socket.emit('joinVenueRoom', { venueId })
    }
  }

  // Leave a venue-specific room
  const leaveVenueRoom = (venueId: string) => {
    if (socket && venueId) {
      console.log(`Leaving venue room: venue_${venueId}`)
      socket.emit('leaveVenueRoom', { venueId })
    }
  }

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        joinVenueRoom,
        leaveVenueRoom,
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}
