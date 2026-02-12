import axios from 'axios'

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

export const getUnauthorizedLoginRedirectUrl = (location: Pick<Location, 'pathname' | 'search' | 'hash'>): string | null => {
  const isLoginRoute = location.pathname.startsWith('/login')
  const isGoogleCallbackRoute = location.pathname.startsWith('/auth/google/callback')

  if (isLoginRoute || isGoogleCallbackRoute) {
    return null
  }

  const returnTo = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)
  return `/login?returnTo=${returnTo}`
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

      // Retry once for network errors
      if (!config._retry) {
        config._retry = true
        await new Promise(resolve => setTimeout(resolve, 1000))
        return api.request(config)
      }
    }

    // Handle 401 - redirect to login preserving deep-link context
    if (error.response?.status === 401) {
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
