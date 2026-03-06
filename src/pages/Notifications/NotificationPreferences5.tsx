/**
 * Notification Preferences — Collapsible categories + channel pills per type
 * Master channel toggles at top with confirmation dialog.
 */
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { notificationCategories } from '@/lib/notifications/categories'
import { NotificationChannel, NotificationPriority, NotificationType } from '@/services/notification.service'
import * as notificationService from '@/services/notification.service'
import { canShowNotifications, requestNotificationPermission } from '@/utils/notification.utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BarChart3,
  Bell,
  Check,
  ChevronDown,
  CreditCard,
  Loader2,
  Mail,
  Shield,
  ShoppingBag,
  MessageSquare,
  // Smartphone,
  Star,
  Settings,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrentVenue } from '@/hooks/use-current-venue'

type NotificationPreference = {
  type: NotificationType
  enabled: boolean
  channels: NotificationChannel[]
  priority: NotificationPriority
  [key: string]: any
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ShoppingBag,
  CreditCard,
  Star,
  Users,
  Settings,
  Shield,
  Bell,
  BarChart3,
}

const channelConfig = [
  { channel: NotificationChannel.IN_APP, icon: Bell, label: 'IN_APP' },
  { channel: NotificationChannel.EMAIL, icon: Mail, label: 'EMAIL' },
  // { channel: NotificationChannel.PUSH, icon: Smartphone, label: 'PUSH' },
  { channel: NotificationChannel.SMS, icon: MessageSquare, label: 'SMS' },
]

const allNotificationTypes = notificationCategories.flatMap(c => c.types)

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

  const addPending = (key: string) => setPendingKeys(prev => new Set(prev).add(key))
  const removePending = (key: string) =>
    setPendingKeys(prev => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })

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
        // No existing record — create an optimistic one
        const category = notificationCategories.find(cat => cat.types.some(t => t.type === type))
        const metadata = category?.types.find(t => t.type === type)
        return [
          ...old,
          {
            type,
            enabled: metadata?.defaultEnabled ?? true,
            channels: metadata?.defaultChannels ?? [NotificationChannel.IN_APP],
            priority: metadata?.defaultPriority ?? NotificationPriority.NORMAL,
            ...updates,
          },
        ]
      })
    },
    [queryClient, venueId],
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
        // Only refetch when ALL mutations have settled
        if (inFlightCount.current === 0) {
          queryClient.invalidateQueries({ queryKey: ['notification-preferences', venueId] })
        }
      }
    },
    [queryClient, venueId, toast, t],
  )

  const getPreferenceForType = (type: NotificationType) => {
    const preference = preferences.find(p => p.type === type)
    if (preference) return preference
    const category = notificationCategories.find(cat => cat.types.some(t => t.type === type))
    const metadata = category?.types.find(t => t.type === type)
    return {
      type,
      enabled: metadata?.defaultEnabled ?? true,
      channels: metadata?.defaultChannels ?? [NotificationChannel.IN_APP],
      priority: metadata?.defaultPriority ?? NotificationPriority.NORMAL,
    }
  }

  // Check if a channel is active on ANY notification type
  const isChannelGloballyActive = (channel: NotificationChannel) => {
    return allNotificationTypes.some(td => {
      const pref = getPreferenceForType(td.type)
      return pref.enabled && pref.channels?.includes(channel)
    })
  }

  // Count how many types use this channel
  const channelUsageCount = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const ch of channelConfig) {
      counts[ch.channel] = allNotificationTypes.filter(td => {
        const pref = getPreferenceForType(td.type)
        return pref.enabled && pref.channels?.includes(ch.channel)
      }).length
    }
    return counts
  }, [preferences])

  const handleMasterChannelToggle = (channel: NotificationChannel, label: string) => {
    const isActive = isChannelGloballyActive(channel)
    setConfirmDialog({
      open: true,
      channel,
      channelLabel: label,
      action: isActive ? 'disable' : 'enable',
    })
  }

  const executeMasterChannelToggle = async () => {
    const { channel, action } = confirmDialog
    setConfirmDialog(prev => ({ ...prev, open: false }))

    // 1. Pre-compute all changes from current state
    const changes: { type: NotificationType; channels: NotificationChannel[] }[] = []
    for (const typeData of allNotificationTypes) {
      const pref = getPreferenceForType(typeData.type)
      if (!pref.enabled) continue

      const currentChannels = pref.channels || []
      let newChannels: NotificationChannel[]

      if (action === 'disable') {
        newChannels = currentChannels.filter(c => c !== channel)
        if (newChannels.length === 0) continue
      } else {
        if (currentChannels.includes(channel)) continue
        newChannels = [...currentChannels, channel]
      }

      if (newChannels.length !== currentChannels.length) {
        changes.push({ type: typeData.type, channels: newChannels })
      }
    }

    // 2. Apply ALL optimistic updates at once
    for (const change of changes) {
      applyOptimisticUpdate(change.type, { channels: change.channels })
    }

    // 3. Fire all API calls (in-flight counter handles deferred invalidation)
    await Promise.all(
      changes.map(change =>
        updatePreference(`master-${channel}`, { type: change.type, channels: change.channels }),
      ),
    )

    toast({ title: t('saved'), description: t('preferencesSaved') })
  }

  const handleToggle = async (type: NotificationType, enabled: boolean) => {
    const key = `toggle-${type}`
    applyOptimisticUpdate(type, { enabled })
    await updatePreference(key, { type, enabled })
  }

  const handleToggleChannel = async (type: NotificationType, channel: NotificationChannel) => {
    const currentPref = getPreferenceForType(type)
    const currentChannels = currentPref.channels || []
    let newChannels: NotificationChannel[]
    if (currentChannels.includes(channel)) {
      newChannels = currentChannels.filter(c => c !== channel)
      if (newChannels.length === 0) return
    } else {
      newChannels = [...currentChannels, channel]
    }
    const key = `channel-${type}-${channel}`
    applyOptimisticUpdate(type, { channels: newChannels })
    await updatePreference(key, { type, channels: newChannels })
  }

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
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

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t('preferences')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('preferencesSubtitle')}</p>
      </div>

      {/* Master channel toggles */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground mb-1">{t('channels')}</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Desactiva un canal para dejar de recibir notificaciones por esa vía.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {channelConfig.map(ch => {
            const isActive = isChannelGloballyActive(ch.channel)
            const count = channelUsageCount[ch.channel] || 0
            return (
              <div
                key={ch.channel}
                className={cn(
                  'relative rounded-xl border bg-card p-3.5 transition-colors',
                  isActive ? 'border-border/50' : 'border-border/30 opacity-60',
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
                  <Switch
                    checked={isActive}
                    onCheckedChange={() => handleMasterChannelToggle(ch.channel, t(`channelNames.${ch.label}`))}
                  />
                </div>
                <span className="text-sm font-medium text-foreground block">{t(`channelNames.${ch.label}`)}</span>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                  {isActive
                    ? `${count} ${count === 1 ? 'notificación' : 'notificaciones'}`
                    : 'Desactivado'}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Browser notification banner */}
      {browserPermission !== 'granted' && (
        <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card px-4 py-3 mb-4">
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
          const enabledCount = category.types.filter(td => getPreferenceForType(td.type).enabled).length
          const totalCount = category.types.length

          return (
            <div key={category.id} className="rounded-xl border border-border/50 bg-card overflow-hidden">
              {/* Category header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <span className="text-sm font-medium text-foreground">{t(`categories.${category.id}`)}</span>
                  <p className="text-xs text-muted-foreground truncate">
                    {t(`categoryDescriptions.${category.id}`)}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs tabular-nums shrink-0">
                  {enabledCount}/{totalCount}
                </Badge>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-muted-foreground transition-transform shrink-0',
                    isExpanded && 'rotate-180',
                  )}
                />
              </button>

              {/* Expanded types with channel pills */}
              {isExpanded && (
                <div className="border-t border-border/30">
                  {category.types.map((typeData, i) => {
                    const pref = getPreferenceForType(typeData.type)
                    const isEnabled = pref.enabled

                    return (
                      <div
                        key={typeData.type}
                        className={cn(
                          'px-4 py-3 pl-16',
                          i < category.types.length - 1 && 'border-b border-border/20',
                        )}
                      >
                        {/* Row: name + toggle */}
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">
                                {t(`types.${typeData.type}`)}
                              </span>
                              {!typeData.canDisable && (
                                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                  {t('required')}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {t(`typeDescriptions.${typeData.type}`)}
                            </p>
                          </div>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={enabled => handleToggle(typeData.type, enabled)}
                            disabled={!typeData.canDisable || pendingKeys.has(`toggle-${typeData.type}`)}
                          />
                        </div>

                        {/* Channel pills — only when enabled */}
                        {isEnabled && (
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
                                  {isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <ChannelIcon className="h-3 w-3" />
                                  )}
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
      <div className="rounded-xl border border-border/50 bg-card px-4 py-3 mt-6">
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
                new Notification(t('testTitle'), {
                  body: t('testBody'),
                  icon: '/favicon.ico',
                })
              } else {
                toast({ title: t('testTitle'), description: t('testBody') })
              }
            }}
          >
            {t('sendTest')}
          </Button>
        </div>
      </div>

      {/* Confirmation dialog for master channel toggle */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={open => setConfirmDialog(prev => ({ ...prev, open }))}
        title={
          confirmDialog.action === 'disable'
            ? `¿Desactivar ${confirmDialog.channelLabel}?`
            : `¿Activar ${confirmDialog.channelLabel}?`
        }
        description={
          confirmDialog.action === 'disable'
            ? `Dejarás de recibir todas las notificaciones por ${confirmDialog.channelLabel}. Puedes volver a activarlo en cualquier momento.`
            : `Activarás ${confirmDialog.channelLabel} para todas las notificaciones habilitadas.`
        }
        confirmText={confirmDialog.action === 'disable' ? 'Desactivar' : 'Activar'}
        cancelText="Cancelar"
        variant={confirmDialog.action === 'disable' ? 'destructive' : 'default'}
        onConfirm={executeMasterChannelToggle}
      />
    </div>
  )
}
