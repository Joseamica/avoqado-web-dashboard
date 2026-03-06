/**
 * Notification Preferences — Collapsible categories + channel pills per type.
 * Master channel toggles at top with confirmation dialog.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, Bell, Check, ChevronDown, CreditCard, Loader2, Mail, Settings, Shield, ShoppingBag, Star, Users } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Switch } from '@/components/ui/switch'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { getAllNotificationTypes, notificationCategories } from '@/lib/notifications/categories'
import { cn } from '@/lib/utils'
import * as notificationService from '@/services/notification.service'
import { NotificationChannel, NotificationPreference, NotificationPriority, NotificationType } from '@/services/notification.service'
import { canShowNotifications, requestNotificationPermission } from '@/utils/notification.utils'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  BarChart3,
  Bell,
  CreditCard,
  Settings,
  Shield,
  ShoppingBag,
  Star,
  Users,
}

const channelConfig = [
  { channel: NotificationChannel.IN_APP, icon: Bell, label: 'IN_APP' },
  { channel: NotificationChannel.EMAIL, icon: Mail, label: 'EMAIL' },
]

const allNotificationTypes = getAllNotificationTypes()
const notificationTypeMetadataMap = new Map(allNotificationTypes.map(td => [td.type, td]))

export default function NotificationPreferences5() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { t } = useTranslation('notifications')
  const { venueId } = useCurrentVenue()

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default',
  )
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    channel: NotificationChannel
    channelLabel: string
    action: 'enable' | 'disable'
  }>({ open: false, channel: NotificationChannel.IN_APP, channelLabel: '', action: 'disable' })
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set())
  const inFlightCount = useRef(0)

  const { data: preferences = [], isLoading } = useQuery({
    queryKey: ['notification-preferences', venueId],
    queryFn: () => notificationService.getPreferences(venueId),
  })

  function addPending(key: string): void {
    setPendingKeys(prev => new Set(prev).add(key))
  }

  function removePending(key: string): void {
    setPendingKeys(prev => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  const preferenceMap = useMemo(() => {
    const map = new Map<NotificationType, NotificationPreference>()
    for (const p of preferences) map.set(p.type, p)
    return map
  }, [preferences])

  const getPreference = useCallback(
    (type: NotificationType): NotificationPreference => {
      const existing = preferenceMap.get(type)
      if (existing) return existing
      const metadata = notificationTypeMetadataMap.get(type)
      return {
        type,
        enabled: metadata?.defaultEnabled ?? true,
        channels: metadata?.defaultChannels ?? [NotificationChannel.IN_APP],
        priority: metadata?.defaultPriority ?? NotificationPriority.NORMAL,
      } as NotificationPreference
    },
    [preferenceMap],
  )

  const channelUsageCount = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const ch of channelConfig) counts[ch.channel] = 0
    for (const td of allNotificationTypes) {
      const pref = getPreference(td.type)
      if (!pref.enabled) continue
      for (const ch of channelConfig) {
        if (pref.channels?.includes(ch.channel)) counts[ch.channel]++
      }
    }
    return counts
  }, [getPreference])

  const applyOptimisticUpdate = useCallback(
    (type: NotificationType, updates: Partial<NotificationPreference>) => {
      queryClient.setQueryData<NotificationPreference[]>(['notification-preferences', venueId], old => {
        if (!old) return old
        const idx = old.findIndex(p => p.type === type)
        if (idx >= 0) {
          const updated = [...old]
          updated[idx] = { ...updated[idx], ...updates }
          return updated
        }
        return [...old, { ...getPreference(type), ...updates } as NotificationPreference]
      })
    },
    [queryClient, venueId, getPreference],
  )

  const updatePreference = useCallback(
    async (pendingKey: string, payload: Parameters<typeof notificationService.updatePreferences>[0]) => {
      addPending(pendingKey)
      inFlightCount.current++
      try {
        await notificationService.updatePreferences(payload, venueId)
      } catch (error: any) {
        toast({ title: t('error'), description: error.message || t('failedToUpdate'), variant: 'destructive' })
      } finally {
        inFlightCount.current--
        removePending(pendingKey)
        if (inFlightCount.current === 0) {
          queryClient.invalidateQueries({ queryKey: ['notification-preferences', venueId] })
        }
      }
    },
    [queryClient, venueId, toast, t],
  )

  async function handleToggle(type: NotificationType, enabled: boolean): Promise<void> {
    applyOptimisticUpdate(type, { enabled })
    await updatePreference(`toggle-${type}`, { type, enabled })
  }

  async function handleToggleChannel(type: NotificationType, channel: NotificationChannel): Promise<void> {
    const currentChannels = getPreference(type).channels || []
    const newChannels = currentChannels.includes(channel) ? currentChannels.filter(c => c !== channel) : [...currentChannels, channel]
    applyOptimisticUpdate(type, { channels: newChannels })
    await updatePreference(`channel-${type}-${channel}`, { type, channels: newChannels })
  }

  function handleMasterChannelToggle(channel: NotificationChannel, label: string): void {
    const isActive = (channelUsageCount[channel] || 0) > 0
    setConfirmDialog({ open: true, channel, channelLabel: label, action: isActive ? 'disable' : 'enable' })
  }

  async function executeMasterChannelToggle(): Promise<void> {
    const { channel, action } = confirmDialog
    setConfirmDialog(prev => ({ ...prev, open: false }))

    const changes: { type: NotificationType; channels: NotificationChannel[] }[] = []
    for (const td of allNotificationTypes) {
      const pref = getPreference(td.type)
      if (!pref.enabled) continue
      const curr = pref.channels || []
      let next: NotificationChannel[]
      if (action === 'disable') {
        next = curr.filter(c => c !== channel)
      } else {
        next = curr.includes(channel) ? curr : [...curr, channel]
      }
      if (next.length !== curr.length) changes.push({ type: td.type, channels: next })
    }

    for (const c of changes) applyOptimisticUpdate(c.type, { channels: c.channels })
    await Promise.all(changes.map(c => updatePreference(`master-${channel}`, { type: c.type, channels: c.channels })))
    toast({ title: t('saved'), description: t('preferencesSaved') })
  }

  function toggleCategory(id: string): void {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-3 animate-pulse">
        <div className="h-24 bg-muted rounded-xl" />
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-16 bg-muted rounded-xl" />
        ))}
      </div>
    )
  }

  const isDisabling = confirmDialog.action === 'disable'
  const channelInterpolation = { channel: confirmDialog.channelLabel }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t('preferences')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('preferencesSubtitle')}</p>
      </div>

      {/* Master channel toggles */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground mb-1">{t('channels')}</h2>
        <p className="text-xs text-muted-foreground mb-3">{t('channelsDescription')}</p>
        <div className="grid grid-cols-2 gap-2">
          {channelConfig.map(ch => {
            const count = channelUsageCount[ch.channel] || 0
            const isActive = count > 0
            return (
              <div
                key={ch.channel}
                className={cn(
                  'relative rounded-xl border bg-card p-3.5 transition-colors',
                  isActive ? 'border-input' : 'border-input/60 opacity-60',
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div
                    className={cn(
                      'flex items-center justify-center h-8 w-8 rounded-lg shrink-0',
                      isActive ? 'bg-foreground/10' : 'bg-muted',
                    )}
                  >
                    <ch.icon className={cn('h-4 w-4', isActive ? 'text-foreground' : 'text-muted-foreground')} />
                  </div>
                  <Switch checked={isActive} onCheckedChange={() => handleMasterChannelToggle(ch.channel, t(`channelNames.${ch.label}`))} />
                </div>
                <span className="text-sm font-medium text-foreground block">{t(`channelNames.${ch.label}`)}</span>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                  {isActive ? t('notificationCount', { count }) : t('disabled')}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Browser notification banner */}
      {browserPermission !== 'granted' && (
        <div className="flex items-center justify-between rounded-xl border border-input bg-card px-4 py-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted shrink-0">
              <Bell className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{t('enableBrowser')}</p>
              <p className="text-xs text-muted-foreground">{t('enableBrowserDesc')}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const perm = await requestNotificationPermission()
              setBrowserPermission(perm)
            }}
          >
            {t('enable')}
          </Button>
        </div>
      )}

      {/* Category cards */}
      <div className="space-y-2">
        {notificationCategories.map(category => {
          const Icon = iconMap[category.icon] || Bell
          const isExpanded = expandedCategories.has(category.id)
          const enabledCount = category.types.filter(td => getPreference(td.type).enabled).length

          return (
            <div key={category.id} className="rounded-xl border border-input bg-card overflow-hidden">
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <span className="text-sm font-medium text-foreground">{t(`categories.${category.id}`)}</span>
                  <p className="text-xs text-muted-foreground truncate">{t(`categoryDescriptions.${category.id}`)}</p>
                </div>
                <Badge variant="secondary" className="text-xs tabular-nums shrink-0">
                  {enabledCount}/{category.types.length}
                </Badge>
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform shrink-0', isExpanded && 'rotate-180')} />
              </button>

              {isExpanded && (
                <div className="border-t border-input/60">
                  {category.types.map((typeData, i) => {
                    const pref = getPreference(typeData.type)
                    return (
                      <div
                        key={typeData.type}
                        className={cn('px-4 py-3 pl-16', i < category.types.length - 1 && 'border-b border-input/40')}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-foreground">{t(`types.${typeData.type}`)}</span>
                            <p className="text-xs text-muted-foreground mt-0.5">{t(`typeDescriptions.${typeData.type}`)}</p>
                          </div>
                          <Switch
                            checked={pref.enabled}
                            onCheckedChange={enabled => handleToggle(typeData.type, enabled)}
                            disabled={pendingKeys.has(`toggle-${typeData.type}`)}
                          />
                        </div>

                        {pref.enabled && (
                          <div className="flex items-center gap-1.5 mt-2">
                            {channelConfig.map(({ channel, icon: ChannelIcon, label }) => {
                              const isActive = pref.channels?.includes(channel) || false
                              const isPending = pendingKeys.has(`channel-${typeData.type}-${channel}`)
                              return (
                                <button
                                  key={channel}
                                  onClick={() => handleToggleChannel(typeData.type, channel)}
                                  disabled={isPending}
                                  className={cn(
                                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer',
                                    isActive
                                      ? 'bg-foreground/10 text-foreground'
                                      : 'bg-muted/50 text-muted-foreground/50 hover:text-muted-foreground',
                                    isPending && 'opacity-70',
                                  )}
                                >
                                  {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChannelIcon className="h-3 w-3" />}
                                  {t(`channelNames.${label}`)}
                                  {isActive && !isPending && <Check className="h-3 w-3" />}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Test notification */}
      <div className="rounded-xl border border-input bg-card px-4 py-3 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{t('testTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('testDesc')}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (canShowNotifications()) {
                new Notification(t('testTitle'), { body: t('testBody'), icon: '/favicon.ico' })
              } else {
                toast({ title: t('testTitle'), description: t('testBody') })
              }
            }}
          >
            {t('sendTest')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={open => setConfirmDialog(prev => ({ ...prev, open }))}
        title={t(isDisabling ? 'confirmDisableChannel' : 'confirmEnableChannel', channelInterpolation)}
        description={t(isDisabling ? 'confirmDisableChannelDesc' : 'confirmEnableChannelDesc', channelInterpolation)}
        confirmText={t(isDisabling ? 'disable' : 'enable')}
        cancelText={t('cancel')}
        variant={isDisabling ? 'destructive' : 'default'}
        onConfirm={executeMasterChannelToggle}
      />
    </div>
  )
}
