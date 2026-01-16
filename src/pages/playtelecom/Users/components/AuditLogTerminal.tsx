/**
 * AuditLogTerminal - Terminal-style activity feed for user actions
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
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
  logout: { icon: LogOut, color: 'text-gray-400' },
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

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <Terminal className="w-4 h-4 text-muted-foreground" />
        <h4 className="text-sm font-medium">
          {t('playtelecom:users.activityLog', { defaultValue: 'Registro de Actividad' })}
        </h4>
      </div>

      <GlassCard className="overflow-hidden">
        {/* Terminal Header */}
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border/50">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-xs text-muted-foreground font-mono ml-2">
            audit.log
          </span>
        </div>

        {/* Log Entries */}
        <ScrollArea style={{ height: maxHeight }}>
          <div className="bg-gray-950 dark:bg-gray-950 p-3 font-mono text-xs">
            {entries.length === 0 ? (
              <div className="text-gray-500 text-center py-4">
                <Terminal className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p>{t('playtelecom:users.noActivity', { defaultValue: 'Sin actividad registrada' })}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {entries.map(entry => {
                  const config = ACTION_CONFIG[entry.action] || ACTION_CONFIG.warning
                  const Icon = config.icon

                  return (
                    <div
                      key={entry.id}
                      className="flex items-start gap-2 py-1 hover:bg-white/5 px-1 rounded transition-colors"
                    >
                      {/* Timestamp */}
                      <span className="text-gray-500 shrink-0 select-none">
                        [{formatTimestamp(entry.timestamp)}]
                      </span>

                      {/* Icon */}
                      <Icon className={cn('w-3.5 h-3.5 shrink-0 mt-0.5', config.color)} />

                      {/* Message */}
                      <div className="flex-1 min-w-0">
                        <span className={cn('text-gray-200', config.color)}>
                          {entry.message}
                        </span>
                        {entry.details && (
                          <span className="text-gray-500 ml-1">
                            — {entry.details}
                          </span>
                        )}
                        {entry.ip && (
                          <span className="text-gray-600 ml-1">
                            (IP: {entry.ip})
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Cursor blink animation */}
                <div className="flex items-center gap-1 text-gray-500 pt-1">
                  <span className="select-none">$</span>
                  <span className="w-2 h-4 bg-green-500 animate-pulse" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </GlassCard>
    </div>
  )
}

// Format timestamp for terminal display
function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleString('es-MX', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoString
  }
}

export default AuditLogTerminal
