import { useState, useEffect } from 'react'
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
 */
export function OfflineBanner() {
  const { t } = useTranslation()
  const [status, setStatus] = useState(getConnectionStatus)

  useEffect(() => {
    // Subscribe to connection changes
    const unsubscribe = subscribeToConnection(() => {
      setStatus(getConnectionStatus())
    })
    return () => { unsubscribe() }
  }, [])

  // Don't show if connected
  if (status.isConnected) return null

  const isOffline = !status.isOnline

  return (
    <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          {isOffline ? (
            <WifiOff className="h-4 w-4 text-destructive" />
          ) : (
            <ServerCrash className="h-4 w-4 text-destructive" />
          )}
          <span className="text-destructive font-medium">
            {isOffline
              ? t('errors.offline')
              : t('errors.serverUnavailable')
            }
          </span>
          <span className="text-destructive/80 hidden sm:inline">
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
          className="text-destructive hover:text-destructive hover:bg-destructive/20"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          {t('errors.retry')}
        </Button>
      </div>
    </div>
  )
}
