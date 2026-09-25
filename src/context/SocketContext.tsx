import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  joinVenueRoom: (venueId: string) => void
  leaveVenueRoom: (venueId: string) => void
}

// Recuperación tras una desconexión hecha por el servidor (ver SocketProvider).
const ESPERAS_DE_RECUPERACION_MS = [1_000, 3_000, 10_000, 30_000]
const VENTANA_ANTI_BUCLE_MS = 120_000
const MAX_RECREACIONES_EN_VENTANA = 6

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
  // Recuperación en curso: en qué intento va y cuándo se hicieron las recreaciones recientes (tope anti-bucle).
  const recuperando = useRef(false)
  const intento = useRef(0)
  const recreaciones = useRef<number[]>([])
  const pendiente = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
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
    // 🔴 Cuando la desconexión la hace el SERVIDOR (p. ej. al cambiar la propia contraseña se cierran las
    // sesiones, la actual incluida, y la página recibe cookies nuevas), socket.io NO reconecta solo y el panel
    // se quedaba sin tiempo real. Se RECREA el socket (una instancia nueva hace que las pantallas vuelvan a
    // unirse a sus salas) con esperas crecientes: si las cookies nuevas aún no llegan, el servidor rechaza y se
    // intenta después. Si la sesión de verdad ya no sirve, se deja de intentar (ahí el HTTP manda al login).
    const programarRecreacion = () => {
      const ahora = Date.now()
      recreaciones.current = recreaciones.current.filter(t => ahora - t < VENTANA_ANTI_BUCLE_MS)
      if (intento.current >= ESPERAS_DE_RECUPERACION_MS.length || recreaciones.current.length >= MAX_RECREACIONES_EN_VENTANA) {
        recuperando.current = false
        return
      }
      const espera = ESPERAS_DE_RECUPERACION_MS[intento.current]
      intento.current += 1
      pendiente.current = setTimeout(() => {
        recreaciones.current.push(Date.now())
        setGeneracion(g => g + 1)
      }, espera)
    }

    socketInstance.on('connect', () => {
      setIsConnected(true)
      recuperando.current = false
      intento.current = 0
    })

    socketInstance.on('disconnect', (reason: string) => {
      setIsConnected(false)
      if (reason === 'io server disconnect' && !recuperando.current) {
        recuperando.current = true
        intento.current = 0
        programarRecreacion()
      }
    })

    socketInstance.on('connect_error', error => {
      console.error('Socket connection error:', error)
      setIsConnected(false)
      if (recuperando.current) programarRecreacion()
    })

    setSocket(socketInstance)

    // Clean up on unmount
    return () => {
      if (pendiente.current) clearTimeout(pendiente.current)
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
