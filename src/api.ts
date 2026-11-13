import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { emitImpersonationError, extractImpersonationErrorCode } from './lib/impersonation-errors'

// Connection status tracking
let isOnline = navigator.onLine
let isServerReachable = true
const listeners: Set<() => void> = new Set()

const notifyListeners = () => listeners.forEach(fn => fn())

window.addEventListener('online', () => {
  isOnline = true
  notifyListeners()
})
window.addEventListener('offline', () => {
  isOnline = false
  notifyListeners()
})

const resolveApiBaseUrl = (): string => {
  const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()

  if (configuredApiUrl) {
    // If app is opened from a public tunnel on another device, localhost API is unreachable.
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      const usesLocalApi = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configuredApiUrl)
      const isRemoteHost = !['localhost', '127.0.0.1'].includes(window.location.hostname)

      if (usesLocalApi && isRemoteHost) {
        console.warn(
          `[API] VITE_API_URL=${configuredApiUrl} is not reachable from ${window.location.hostname}. Falling back to same-origin.`,
        )
        return window.location.origin
      }
    }

    return configuredApiUrl
  }

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    // Default dev behavior: use same-origin and let Vite proxy /api to backend.
    return window.location.origin
  }

  return 'https://api.avoqado.io'
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true,
})

export const publicApi = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: false,
})

export const getUnauthorizedLoginRedirectUrl = (location: Pick<Location, 'pathname' | 'search' | 'hash'>): string | null => {
  const isLoginRoute = location.pathname.startsWith('/login')
  const isGoogleCallbackRoute = location.pathname.startsWith('/auth/google/callback')

  if (isLoginRoute || isGoogleCallbackRoute) {
    return null
  }

  const returnTo = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)
  return `/login?returnTo=${returnTo}`
}

declare module 'axios' {
  interface AxiosRequestConfig {
    /**
     * D6: esta escritura SIN llave se puede repetir sola tras un corte de red porque el servidor la aguanta repetida
     * (p. ej. liberar algo que ya está libre contesta «ya estaba» sin hacer nada). Úsala sólo si lo comprobaste en el
     * servidor: sin ella, una escritura sin llave falla una vez y la pantalla dice que no se sabe si se guardó.
     */
    repetible?: boolean
  }
}

/** Los métodos que sólo leen: repetirlos no cambia nada en el servidor. */
const METODOS_QUE_SOLO_LEEN = new Set(['get', 'head', 'options'])
/**
 * Campos del cuerpo con los que el servidor reconoce una repetición: la llave de la operación (`idempotencyKey`,
 * `operationKey`) devuelve lo ya hecho, y el token de edición (`expectedEditToken`) contesta 409 si el primer intento ya
 * guardó. 🔴 Sólo cuentan si el endpoint los respeta: mandar una llave que el servidor ignora (o que su esquema tira) hace
 * insegura la repetición.
 */
const CAMPOS_QUE_RECONOCEN_LA_REPETICION = ['idempotencyKey', 'operationKey', 'expectedEditToken'] as const

const esTextoConAlgo = (valor: unknown) => typeof valor === 'string' && valor.trim().length > 0

/** El cuerpo ya viene serializado (JSON en texto) cuando el error llega aquí; FormData y demás no llevan llave. */
function cuerpoComoObjeto(data: unknown): Record<string, unknown> | null {
  if (typeof data === 'string') {
    try {
      const parsed: unknown = JSON.parse(data)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
    } catch {
      return null
    }
  }
  if (data && typeof data === 'object' && Object.getPrototypeOf(data) === Object.prototype) return data as Record<string, unknown>
  return null
}

/**
 * D6 (12-nov): ¿esta petición se puede repetir sola tras un error de red? Un error de red no dice si la petición llegó: a veces
 * se pierde sólo la RESPUESTA y el servidor ya registró el reembolso o el pago. Repetir una escritura sin llave lo registraría
 * dos veces, así que sólo se repiten las lecturas y las escrituras que el servidor reconoce. Las demás fallan una vez y la
 * pantalla dice que no se sabe si se guardó.
 */
export function sePuedeRepetirSola(config: InternalAxiosRequestConfig | undefined): boolean {
  if (!config) return false
  if (METODOS_QUE_SOLO_LEEN.has((config.method ?? 'get').toLowerCase())) return true
  if (config.repetible === true) return true
  if (esTextoConAlgo(AxiosHeaders.from(config.headers).get('Idempotency-Key'))) return true
  const cuerpo = cuerpoComoObjeto(config.data)
  return !!cuerpo && CAMPOS_QUE_RECONOCEN_LA_REPETICION.some(campo => esTextoConAlgo(cuerpo[campo]))
}

// Track API call success/failure to detect server availability
api.interceptors.response.use(
  response => {
    // Server responded - mark as reachable
    if (!isServerReachable) {
      isServerReachable = true
      notifyListeners()
    }
    return response
  },
  async error => {
    const config = error.config

    // Network error = server unreachable (not 4xx/5xx which means server IS reachable)
    const isNetworkError = !error.response && (
      error.message === 'Network Error' ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNREFUSED'
    )

    if (isNetworkError) {
      // Mark server as unreachable
      if (isServerReachable) {
        isServerReachable = false
        notifyListeners()
      }

      // Retry once for network errors — sólo lo que se puede repetir sin duplicar (D6, ver `sePuedeRepetirSola`)
      if (config && !config._retry && sePuedeRepetirSola(config)) {
        config._retry = true
        await new Promise(resolve => setTimeout(resolve, 1000))
        return api.request(config)
      }
    }

    // Handle impersonation-specific errors BEFORE the 401-login redirect.
    // When the server rejects a request because of impersonation rules
    // (read-only, blocked route, target invalid, or expired session), we
    // stay on the current page, let React components show a toast / clean up
    // state, and — crucially for EXPIRED — we do NOT redirect to /login
    // because the user is still authenticated as SUPERADMIN.
    const status = error.response?.status
    if (status === 401 || status === 403) {
      const impersonationCode = extractImpersonationErrorCode(error)
      if (impersonationCode) {
        emitImpersonationError({
          code: impersonationCode,
          message: error.response?.data?.message,
          url: error.config?.url,
        })
        return Promise.reject(error)
      }
    }

    // Handle 401 - redirect to login preserving deep-link context
    if (status === 401) {
      const loginRedirectUrl = getUnauthorizedLoginRedirectUrl(window.location)
      if (loginRedirectUrl) {
        window.location.href = loginRedirectUrl
      }
    }

    return Promise.reject(error)
  }
)

export default api

// Connection status exports for OfflineBanner
export const getConnectionStatus = () => ({
  isOnline,
  isServerReachable,
  isConnected: isOnline && isServerReachable,
})

export const subscribeToConnection = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
