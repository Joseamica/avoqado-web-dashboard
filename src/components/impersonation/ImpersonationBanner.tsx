/**
 * ImpersonationBanner
 *
 * Sticky banner shown at the top of the app when a SUPERADMIN is inside an
 * impersonation session. Combines:
 *   - An inconfusable striped amber→pink gradient (visually distinct from the
 *     regular SuperadminBanner which is a flat gradient)
 *   - Real-time countdown to session expiry
 *   - Extend / Exit buttons
 *   - Warning color shifts at 3 min and 30 sec remaining
 *   - Progress bar reflecting elapsed time
 *
 * Spec: docs/superpowers/specs/2026-04-20-superadmin-impersonation-design.md §5.4
 */
import { useEffect, useRef } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { Theater, LogOut, RefreshCcw, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useImpersonation, formatImpersonationCountdown } from '@/hooks/use-impersonation'
import { useToast } from '@/hooks/use-toast'
import { useQuery } from '@tanstack/react-query'
import api from '@/api'

interface ImpersonatedUserSummary {
  id: string
  firstName: string
  lastName: string
  role: string
}

/**
 * Small query to show the impersonated user's friendly name in the banner.
 * Hits the eligible-targets list cache when possible.
 */
function useImpersonatedUserName(impersonatedUserId: string | null) {
  return useQuery({
    queryKey: ['impersonation', 'user-name', impersonatedUserId],
    enabled: !!impersonatedUserId,
    queryFn: async (): Promise<ImpersonatedUserSummary | null> => {
      if (!impersonatedUserId) return null
      try {
        const res = await api.get<{ users: ImpersonatedUserSummary[] }>(
          '/api/v1/dashboard/impersonation/eligible-targets',
        )
        return res.data.users.find(u => u.id === impersonatedUserId) ?? null
      } catch {
        return null
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function ImpersonationBanner() {
  const { t } = useTranslation(['impersonation'])
  const { toast } = useToast()
  const {
    isImpersonating,
    mode,
    impersonatedUserId,
    impersonatedRole,
    extensionsUsed,
    maxExtensions,
    reason,
    timeRemainingMs,
    isInWarningZone,
    isInCriticalZone,
    isExpiredLocally,
    isExtending,
    isStopping,
    extendImpersonation,
    stopImpersonation,
    expiresAt,
  } = useImpersonation()

  const userQuery = useImpersonatedUserName(impersonatedUserId)

  // Warning toast at ~3 min mark (fire once per session).
  const warnedRef = useRef<string | null>(null)
  const criticalRef = useRef<string | null>(null)
  useEffect(() => {
    if (!isImpersonating || !expiresAt) return
    const sessionKey = `${expiresAt}`
    if (isInWarningZone && warnedRef.current !== sessionKey) {
      warnedRef.current = sessionKey
      toast({
        title: t('impersonation:toast.expiredSoon', { minutes: 3 }),
        variant: 'default',
      })
    }
    if (isInCriticalZone && criticalRef.current !== sessionKey) {
      criticalRef.current = sessionKey
      toast({
        title: t('impersonation:toast.expiredCritical'),
        variant: 'destructive',
      })
    }
  }, [isImpersonating, expiresAt, isInWarningZone, isInCriticalZone, t, toast])

  // Auto-exit when expired locally. Backend also enforces this.
  const autoExitedRef = useRef(false)
  useEffect(() => {
    if (!isImpersonating) {
      autoExitedRef.current = false
      return
    }
    if (isExpiredLocally && !autoExitedRef.current) {
      autoExitedRef.current = true
      stopImpersonation()
        .then(() => {
          toast({ title: t('impersonation:toast.expired'), variant: 'destructive' })
        })
        .catch(() => {
          /* backend will reject next request anyway; silent */
        })
    }
  }, [isImpersonating, isExpiredLocally, stopImpersonation, t, toast])

  if (!isImpersonating) return null

  // Visual progression: initial assumed 15 min; progress is (1 - remaining/initial) clamped to [0..1].
  // For a better fit, we use the expiresAt and a synthetic "session start" anchored at first render
  // actually we just show remaining as a bar width (0% when expired, 100% when full).
  // Initial session duration (15 min) + extensions used ⇒ upper bound for the bar.
  const totalSessionSeconds = 15 * 60 * (1 + extensionsUsed)
  const remainingSeconds = timeRemainingMs != null ? Math.max(0, Math.floor(timeRemainingMs / 1000)) : 0
  const progressPercent = Math.min(100, Math.max(0, (remainingSeconds / totalSessionSeconds) * 100))

  const canExtend = extensionsUsed < maxExtensions && !isExtending && !isStopping

  const userName = userQuery.data ? `${userQuery.data.firstName} ${userQuery.data.lastName}` : '...'

  // Color state — drives both the bar and the text accent.
  const state: 'normal' | 'warning' | 'critical' = isInCriticalZone ? 'critical' : isInWarningZone ? 'warning' : 'normal'

  const bgClass =
    state === 'critical'
      ? 'bg-gradient-to-r from-red-500 to-rose-600'
      : state === 'warning'
        ? 'bg-gradient-to-r from-amber-500 to-orange-500'
        : 'bg-gradient-to-r from-amber-400 to-pink-500'

  const stripeClass =
    'before:absolute before:inset-0 before:pointer-events-none before:bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.08)_0_8px,transparent_8px_16px)] before:animate-[shimmer_2s_linear_infinite]'

  return (
    <div
      role="status"
      aria-live="polite"
      // STICKY: the banner must remain visible during scroll. It is the primary
      // cue that the user is currently seeing the dashboard through someone
      // else's eyes — if it scrolls off-screen, the superadmin can easily
      // forget and act with stale context. z-40 sits below Radix portals (z-50)
      // but above normal content.
      className={`sticky top-0 z-40 shrink-0 overflow-hidden text-primary-foreground ${bgClass} ${stripeClass}`}
    >
      {/* Local keyframes for diagonal stripe animation */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 0 0; }
          100% { background-position: 32px 0; }
        }
      `}</style>

      <div className="relative flex flex-col gap-1 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {state === 'critical' ? (
            <ShieldAlert className="h-4 w-4 shrink-0 animate-pulse" />
          ) : (
            <Theater className="h-4 w-4 shrink-0" />
          )}
          <div className="min-w-0 text-sm leading-tight">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {mode === 'user' ? (
                <Trans
                  i18nKey="impersonation:banner.viewingAsUser"
                  values={{ name: userName, role: impersonatedRole ?? '' }}
                  components={{ strong: <strong className="font-semibold" /> }}
                />
              ) : (
                <Trans
                  i18nKey="impersonation:banner.viewingAsRole"
                  values={{ role: impersonatedRole ?? '' }}
                  components={{ strong: <strong className="font-semibold" /> }}
                />
              )}
              <span className="inline-flex items-center rounded-full bg-foreground/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                {t('impersonation:banner.readOnly')}
              </span>
              <span className="text-xs opacity-90">·</span>
              <span className="text-xs tabular-nums">
                {t('impersonation:banner.expiresIn', { countdown: formatImpersonationCountdown(timeRemainingMs) })}
              </span>
            </div>
            {reason ? (
              <div className="truncate text-xs opacity-90">
                <span className="font-medium">{t('impersonation:banner.reasonLabel')}</span> {reason}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={!canExtend}
            onClick={() => {
              extendImpersonation()
                .then(() => toast({ title: t('impersonation:toast.extended') }))
                .catch((err: any) => {
                  const msg = err?.response?.data?.message ?? t('impersonation:toast.extendFailed')
                  toast({ title: msg, variant: 'destructive' })
                })
            }}
            className="h-7 gap-1.5 text-primary-foreground hover:bg-primary-foreground/20 cursor-pointer disabled:opacity-50"
            title={
              extensionsUsed >= maxExtensions
                ? t('impersonation:banner.extendTooltipMax', { max: maxExtensions }) ?? undefined
                : undefined
            }
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            <span className="text-xs">
              {isExtending ? t('impersonation:banner.extending') : t('impersonation:banner.extend')}
            </span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={isStopping}
            onClick={() => {
              stopImpersonation()
                .then(() => toast({ title: t('impersonation:toast.stopped') }))
                .catch((err: any) => {
                  const msg = err?.response?.data?.message ?? t('impersonation:toast.stopFailed')
                  toast({ title: msg, variant: 'destructive' })
                })
            }}
            className="h-7 gap-1.5 bg-foreground/10 text-primary-foreground hover:bg-foreground/25 cursor-pointer disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="text-xs">
              {isStopping ? t('impersonation:banner.exiting') : t('impersonation:banner.exit')}
            </span>
          </Button>
        </div>
      </div>

      {/* Progress bar — shrinks as time remaining decreases */}
      <div
        className="h-1 w-full bg-foreground/20"
        role="progressbar"
        aria-label={t('impersonation:banner.progressLabel') ?? 'Time remaining'}
        aria-valuenow={Math.round(progressPercent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-primary-foreground/90 transition-[width] duration-1000 ease-linear"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  )
}
