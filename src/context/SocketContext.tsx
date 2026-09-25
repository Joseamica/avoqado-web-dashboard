import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'

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

// eslint-disable-next-line react-refresh/only-export-components
export const useSocket = () => useContext(SocketContext)

interface SocketProviderProps {
  children: React.ReactNode
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  // Sube cada vez que hay que recrear el socket tras una desconexión hecha por el servidor (ver abajo).
  const [generacion, setGeneracion] = useState(0)
  const ultimaRecreacion = useRef(0)
  const { isAuthenticated, isLoading } = useAuth()

  const resolveSocketUrl = (): string => {
    const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()

    if (configuredApiUrl) {
      if (import.meta.env.DEV && typeof window !== 'undefined') {
        const usesLocalApi = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configuredApiUrl)
        const isRemoteHost = !['localhost', '127.0.0.1'].includes(window.location.hostname)

        if (usesLocalApi && isRemoteHost) {
          return window.location.origin
        }
      }

      return configuredApiUrl
    }

    if (import.meta.env.DEV && typeof window !== 'undefined') {
      return window.location.origin
    }

    return 'https://api.avoqado.io'
  }

  // Determine the appropriate backend URL
  const socketUrl = resolveSocketUrl()

  useEffect(() => {
    // Only connect if authenticated and not loading
    if (!isAuthenticated || isLoading) {
      // If not authenticated, make sure socket is disconnected
      if (socket) {
        socket.disconnect()
        setSocket(null)
        setIsConnected(false)
      }
      return
    }

    // SECURITY: Socket.IO authenticates via HTTP-only cookies (withCredentials: true)
    // We no longer read tokens from localStorage (XSS vulnerability)
    // The backend validates the session cookie on socket connection

    // Initialize socket connection
    const socketInstance = io(socketUrl, {
      transports: ['websocket'],
      withCredentials: true, // Sends HTTP-only cookies for authentication
      autoConnect: true,
    })

    // Set up event listeners
    socketInstance.on('connect', () => {
      setIsConnected(true)
    })

    // Recrear, no reconectar: una instancia NUEVA hace que las pantallas vuelvan a unirse a sus salas.
    let recreacion: ReturnType<typeof setTimeout> | undefined

    socketInstance.on('disconnect', (reason: string) => {
      setIsConnected(false)
      // 🔴 Cuando la desconexión la hace el SERVIDOR (p. ej. al cambiar la propia contraseña se cierran las
      // sesiones, la actual incluida, y la página ya trae cookies nuevas), socket.io NO reconecta solo y el
      // panel se quedaba sin tiempo real. Se recrea con las cookies vigentes; como mucho una vez cada 10 s,
      // para no entrar en bucle si la sesión de verdad ya no sirve (ahí el HTTP manda al login).
      if (reason === 'io server disconnect' && Date.now() - ultimaRecreacion.current > 10_000) {
        ultimaRecreacion.current = Date.now()
        recreacion = setTimeout(() => setGeneracion(g => g + 1), 1000)
      }
    })

    socketInstance.on('connect_error', error => {
      console.error('Socket connection error:', error)
      setIsConnected(false)
    })

    setSocket(socketInstance)

    // Clean up on unmount
    return () => {
      if (recreacion) clearTimeout(recreacion)
      socketInstance.disconnect()
    }
  }, [socketUrl, isAuthenticated, isLoading, generacion])

  // Join a venue-specific room
  const joinVenueRoom = (venueId: string) => {
    if (socket && venueId) {
      socket.emit('joinVenueRoom', { venueId })
    }
  }

  // Leave a venue-specific room
  const leaveVenueRoom = (venueId: string) => {
    if (socket && venueId) {
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
