import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  joinVenueRoom: (venueId: string) => void
  leaveVenueRoom: (venueId: string) => void
  /**
   * D662 v5 (Codex p2v5-r1 #8): avisa cada vez que el SERVIDOR confirma la suscripción a [venueId] (al pedirla y en cada reconexión).
   * Una pantalla relee AHÍ: un aviso que llegue después ya le toca. Devuelve con qué dejar de escuchar.
   */
  alConfirmarSucursal: (venueId: string, cb: () => void) => () => void
}

// Recuperación tras una desconexión hecha por el servidor (ver SocketProvider).
const ESPERAS_DE_RECUPERACION_MS = [1_000, 3_000, 10_000, 30_000]
const VENTANA_ANTI_BUCLE_MS = 120_000
const MAX_RECREACIONES_EN_VENTANA = 6
// D662 v5: reintentos de una suscripción a otra sucursal que el SERVIDOR no pudo verificar.
const ESPERAS_DE_REINTENTO_DE_SUCURSAL_MS = [2_000, 5_000, 15_000, 30_000, 60_000]

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  joinVenueRoom: () => {},
  leaveVenueRoom: () => {},
  alConfirmarSucursal: () => () => {},
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
  // D662 v5: cuántas pantallas piden cada sucursal (varias piden la misma: sólo la última la suelta), el socket vivo y quién espera la
  // confirmación. El SERVIDOR no recuerda las suscripciones de un socket nuevo: al conectar se vuelven a pedir todas.
  const suscripciones = useRef(new Map<string, number>())
  const confirmaciones = useRef(new Map<string, Set<() => void>>())
  const socketVivo = useRef<Socket | null>(null)
  // Estables (sólo usan refs): las pantallas los ponen en las dependencias de sus efectos y no deben salir y entrar en cada render.
  const pedirSucursal = useCallback((s: Socket, venueId: string, intento = 0) => {
    s.emit('joinVenueRoom', { venueId }, (r?: { success?: boolean; error?: string }) => {
      if (socketVivo.current !== s || !suscripciones.current.has(venueId)) return
      if (r?.success) {
        for (const cb of Array.from(confirmaciones.current.get(venueId) ?? [])) cb()
        return
      }
      // Codex p2v5-r2 #4: si el SERVIDOR no pudo verificar el permiso (la base falló un momento), se vuelve a pedir con esperas
      // crecientes mientras alguien siga mirando esa sucursal. Un «sin acceso» no se reintenta.
      if (r?.error === 'No se pudo verificar el acceso') {
        const espera = ESPERAS_DE_REINTENTO_DE_SUCURSAL_MS[Math.min(intento, ESPERAS_DE_REINTENTO_DE_SUCURSAL_MS.length - 1)]
        setTimeout(() => {
          if (socketVivo.current === s && s.connected && suscripciones.current.has(venueId)) pedirSucursal(s, venueId, intento + 1)
        }, espera)
      }
    })
  }, [])

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
      // Un solo temporizador a la vez (Codex ronda 5): varios errores seguidos no dejan huérfanos.
      if (pendiente.current) clearTimeout(pendiente.current)
      pendiente.current = setTimeout(() => {
        pendiente.current = undefined
        recreaciones.current.push(Date.now())
        setGeneracion(g => g + 1)
      }, espera)
    }

    socketVivo.current = socketInstance
    socketInstance.on('connect', () => {
      setIsConnected(true)
      // D662 v5: un socket nuevo (o reconectado) no está en ninguna sucursal extra: se vuelven a pedir todas las que alguien usa.
      for (const venueId of Array.from(suscripciones.current.keys())) pedirSucursal(socketInstance, venueId)
      recuperando.current = false
      intento.current = 0
      // Conectó: ninguna recreación pendiente debe tumbar este socket sano.
      if (pendiente.current) {
        clearTimeout(pendiente.current)
        pendiente.current = undefined
      }
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
      // Sólo si socket.io YA no reintenta (el servidor rechazó, `active === false`); un error de red lo
      // reintenta él solo y competir con eso tumbaría el socket sano (Codex ronda 5).
      if (recuperando.current && !socketInstance.active) programarRecreacion()
    })

    setSocket(socketInstance)

    // Clean up on unmount
    return () => {
      if (pendiente.current) clearTimeout(pendiente.current)
      if (socketVivo.current === socketInstance) socketVivo.current = null
      socketInstance.disconnect()
    }
  }, [socketUrl, isAuthenticated, isLoading, generacion, pedirSucursal])

  // Join a venue-specific room. D662 v5: con cuenta (varias pantallas piden la misma) y sólo con el socket conectado: si no lo está, la
  // pide el `connect` (nada se encola para mandarse a un socket que el SERVIDOR todavía no conoce).
  const joinVenueRoom = useCallback(
    (venueId: string) => {
      if (!venueId) return
      const n = (suscripciones.current.get(venueId) ?? 0) + 1
      suscripciones.current.set(venueId, n)
      const s = socketVivo.current
      if (n === 1 && s?.connected) pedirSucursal(s, venueId)
    },
    [pedirSucursal],
  )

  // Leave a venue-specific room (sólo cuando ya nadie la usa).
  const leaveVenueRoom = useCallback((venueId: string) => {
    const n = suscripciones.current.get(venueId)
    if (!venueId || !n) return
    if (n > 1) {
      suscripciones.current.set(venueId, n - 1)
      return
    }
    suscripciones.current.delete(venueId)
    const s = socketVivo.current
    if (s?.connected) s.emit('leaveVenueRoom', { venueId })
  }, [])

  const alConfirmarSucursal = useCallback((venueId: string, cb: () => void) => {
    let set = confirmaciones.current.get(venueId)
    if (!set) confirmaciones.current.set(venueId, (set = new Set()))
    set.add(cb)
    return () => {
      set!.delete(cb)
      if (set!.size === 0) confirmaciones.current.delete(venueId)
    }
  }, [])

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        joinVenueRoom,
        leaveVenueRoom,
        alConfirmarSucursal,
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}
