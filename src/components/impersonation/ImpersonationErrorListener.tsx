/**
 * ImpersonationErrorListener
 *
 * Subscribes to impersonation error events emitted by the axios interceptor
 * and turns them into user-facing toasts + state cleanup. Mounted once in
 * the dashboard tree so every impersonation-related 401/403 from any API call
 * is surfaced consistently.
 */
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  IMPERSONATION_ERROR_CODES,
  subscribeToImpersonationErrors,
} from '@/lib/impersonation-errors'
import { impersonationStatusQueryKey } from '@/hooks/use-impersonation'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'

export function ImpersonationErrorListener() {
  const { t } = useTranslation(['impersonation'])
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { activeVenue } = useAuth()

  // Debounce identical events that fire in rapid succession (e.g., page with
  // many parallel queries all receiving the same 403). Keyed by error code.
  const lastEmittedRef = useRef<Record<string, number>>({})

  useEffect(() => {
    const unsubscribe = subscribeToImpersonationErrors(event => {
      const now = Date.now()
      const last = lastEmittedRef.current[event.code] ?? 0
      if (now - last < 1500) return
      lastEmittedRef.current[event.code] = now

      switch (event.code) {
        case IMPERSONATION_ERROR_CODES.READ_ONLY:
          toast({
            title: t('impersonation:toast.readOnlyBlocked'),
            variant: 'destructive',
          })
          break

        case IMPERSONATION_ERROR_CODES.BLOCKED_ROUTE:
          toast({
            title: t('impersonation:toast.blockedRoute'),
            variant: 'destructive',
          })
          // If the user is currently on /superadmin, route them back to the
          // venue home (they can't see superadmin while impersonating).
          if (activeVenue?.slug && window.location.pathname.includes('/superadmin')) {
            const basePath = window.location.pathname.startsWith('/wl/')
              ? `/wl/venues/${activeVenue.slug}`
              : `/venues/${activeVenue.slug}`
            navigate(basePath)
          }
          break

        case IMPERSONATION_ERROR_CODES.EXPIRED: {
          toast({
            title: t('impersonation:toast.expired'),
            variant: 'destructive',
          })
          // Session is gone on the backend — refresh local state so banner
          // and access queries repaint as non-impersonating.
          queryClient.invalidateQueries({ queryKey: impersonationStatusQueryKey })
          queryClient.invalidateQueries({ queryKey: ['user-access'] })
          break
        }

        case IMPERSONATION_ERROR_CODES.TARGET_INVALID: {
          toast({
            title: t('impersonation:toast.targetInvalid'),
            variant: 'destructive',
          })
          queryClient.invalidateQueries({ queryKey: impersonationStatusQueryKey })
          queryClient.invalidateQueries({ queryKey: ['user-access'] })
          if (activeVenue?.slug) {
            const basePath = window.location.pathname.startsWith('/wl/')
              ? `/wl/venues/${activeVenue.slug}`
              : `/venues/${activeVenue.slug}`
            navigate(basePath)
          }
          break
        }
      }
    })

    return unsubscribe
  }, [t, toast, queryClient, navigate, activeVenue?.slug])

  return null
}
