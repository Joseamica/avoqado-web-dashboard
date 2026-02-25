/**
 * AuditLogTerminal - Clean activity feed for user actions
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { GlassCard } from '@/components/ui/glass-card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Terminal,
  LogIn,
  LogOut,
  Settings,
  Lock,
  Key,
  Store,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AuditLogEntry {
  id: string
  timestamp: string
  action: 'login' | 'logout' | 'permission_change' | 'role_change' | 'store_assignment' | 'password_reset' | 'warning'
  message: string
  details?: string
  ip?: string
}

const ACTION_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  login: { icon: LogIn, color: 'text-green-500' },
  logout: { icon: LogOut, color: 'text-muted-foreground' },
  permission_change: { icon: Lock, color: 'text-blue-500' },
  role_change: { icon: Key, color: 'text-purple-500' },
  store_assignment: { icon: Store, color: 'text-orange-500' },
  password_reset: { icon: Settings, color: 'text-yellow-500' },
  warning: { icon: AlertTriangle, color: 'text-red-500' },
}

interface AuditLogTerminalProps {
  entries: AuditLogEntry[]
  maxHeight?: number
  className?: string
}

export const AuditLogTerminal: React.FC<AuditLogTerminalProps> = ({
  entries,
  maxHeight = 200,
  className,
}) => {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { activeVenue } = useAuth()
  const venueTimezone = activeVenue?.timezone || 'America/Mexico_City'

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <Terminal className="w-4 h-4 text-muted-foreground" />
        <h4 className="text-sm font-medium">
          {t('playtelecom:users.activityLog', { defaultValue: 'Registro de Actividad' })}
        </h4>
      </div>

      <GlassCard className="overflow-hidden p-0">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Terminal className="w-5 h-5 mb-2 opacity-40" />
            <p className="text-xs">
              {t('playtelecom:users.noActivity', { defaultValue: 'Sin actividad registrada' })}
            </p>
          </div>
        ) : (
          <ScrollArea style={{ maxHeight }}>
            <div className="divide-y divide-border/50">
              {entries.map(entry => {
                const config = ACTION_CONFIG[entry.action] || ACTION_CONFIG.warning
                const Icon = config.icon

                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    {/* Icon */}
                    <div className={cn('mt-0.5 shrink-0', config.color)}>
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Message + details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-snug">
                        {entry.message}
                      </p>
                      {entry.details && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {entry.details}
                        </p>
                      )}
                    </div>

                    {/* Timestamp */}
                    <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                      {formatTimestamp(entry.timestamp, venueTimezone)}
                    </span>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </GlassCard>
    </div>
  )
}

// Format timestamp for terminal display
function formatTimestamp(isoString: string, timeZone = 'America/Mexico_City'): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleString('es-MX', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    })
  } catch {
    return isoString
  }
}

export default AuditLogTerminal
