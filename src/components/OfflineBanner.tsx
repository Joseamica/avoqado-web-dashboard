import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { WifiOff, ServerCrash, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getConnectionStatus, subscribeToConnection } from '@/api'

/**
 * Simple offline/server-down banner (Slack/Figma pattern)
 * Shows at top of page when:
 * - Browser is offline (no internet)
 * - Server is unreachable (API calls failing)
 * Auto-hides when connection is restored
 * Sets --offline-banner-height CSS variable for layout adjustment
 */
export function OfflineBanner() {
  const { t } = useTranslation()
  const [status, setStatus] = useState(getConnectionStatus)
  const bannerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Subscribe to connection changes
    const unsubscribe = subscribeToConnection(() => {
      setStatus(getConnectionStatus())
    })
    return () => { unsubscribe() }
  }, [])

  useEffect(() => {
    const updateHeight = () => {
      const height = bannerRef.current?.offsetHeight || 0
      document.documentElement.style.setProperty('--offline-banner-height', `${height}px`)
    }

    if (!status.isConnected) {
      // Wait for render
      requestAnimationFrame(() => {
        updateHeight()
      })
      
      const observer = new ResizeObserver(updateHeight)
      if (bannerRef.current) {
        observer.observe(bannerRef.current)
      }
      window.addEventListener('resize', updateHeight)

      return () => {
        observer.disconnect()
        window.removeEventListener('resize', updateHeight)
        document.documentElement.style.removeProperty('--offline-banner-height')
      }
    } else {
      document.documentElement.style.removeProperty('--offline-banner-height')
    }
  }, [status.isConnected])

  // Don't show if connected
  if (status.isConnected) return null

  const isOffline = !status.isOnline

  return (
    <div 
      ref={bannerRef}
      className="bg-destructive text-destructive-foreground border-b border-destructive/20 px-4 py-2 fixed top-0 left-0 right-0 z-[100]"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          {isOffline ? (
            <WifiOff className="h-4 w-4 text-destructive-foreground" />
          ) : (
            <ServerCrash className="h-4 w-4 text-destructive-foreground" />
          )}
          <span className="font-medium">
            {isOffline
              ? t('errors.offline')
              : t('errors.serverUnavailable')
            }
          </span>
          <span className="opacity-90 hidden sm:inline">
            {isOffline
              ? t('errors.offlineDescription')
              : t('errors.serverUnavailableDescription')
            }
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.location.reload()}
          className="text-destructive-foreground hover:text-destructive-foreground hover:bg-destructive-foreground/10"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          {t('errors.retry')}
        </Button>
      </div>
    </div>
  )
}
