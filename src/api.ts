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

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://api.avoqado.io',
  withCredentials: true,
})

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
      const currentPath = window.location.pathname
      const isLoginRoute = currentPath.startsWith('/login')
      const isGoogleCallbackRoute = currentPath.startsWith('/auth/google/callback')

      if (!isLoginRoute && !isGoogleCallbackRoute) {
        const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}${window.location.hash}`)
        window.location.href = `/login?returnTo=${returnTo}`
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
