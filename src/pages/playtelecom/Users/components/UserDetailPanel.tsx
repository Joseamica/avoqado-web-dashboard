/**
 * UserDetailPanel - Main editing panel for user management
 * Combines role selection, scope configuration (venues), and audit log
 *
 * Note: Permissions are per-ROLE not per-user in the backend.
 * The PermissionMatrix is shown read-only to indicate which permissions the role grants.
 */

import React, { useState, useImperativeHandle, forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { User, Mail, Phone, Calendar, Save, Ban, UserCheck, RotateCcw, KeyRound, ShieldAlert } from 'lucide-react'
import { type StaffRole } from '@/types'
import { cn } from '@/lib/utils'
import { useRoleConfig } from '@/hooks/use-role-config'
import { RoleSelectionCards } from './RoleSelectionCards'
import { ScopeConfiguration, type Zone, type StoreOption } from './ScopeConfiguration'
import { AuditLogTerminal, type AuditLogEntry } from './AuditLogTerminal'

export interface UserDetail {
  id: string
  name: string
  email: string
  phone?: string
  role: string
  status: 'active' | 'inactive'
  avatarUrl?: string
  createdAt?: string
  selectedZone: string | null
  selectedStores: string[]
  permissions: string[]
  auditLog: AuditLogEntry[]
}

/** Ref handle exposed to parent for controlling save/reset from modal header */
export interface UserDetailPanelRef {
  save: () => void
  reset: () => void
}

/** Spanish status labels */
const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
}

interface UserDetailPanelProps {
  user: UserDetail | null
  zones: Zone[]
  stores: StoreOption[]
  onSave: (updates: Partial<UserDetail>) => void
  onStatusChange: (status: 'active' | 'inactive') => void
  onResetPassword?: () => void
  isSaving?: boolean
  /** Whether the current user can edit this user (role hierarchy check) */
  canEdit?: boolean
  /** Roles the current user is allowed to assign */
  assignableRoles?: StaffRole[]
  className?: string
  /** When true, renders without outer container/scroll — for use inside FullScreenModal */
  embedded?: boolean
  /** Called when the dirty state changes (for parent to show/hide save buttons) */
  onHasChangesChange?: (hasChanges: boolean) => void
}

export const UserDetailPanel = forwardRef<UserDetailPanelRef, UserDetailPanelProps>(({
  user,
  zones,
  stores,
  onSave,
  onStatusChange,
  onResetPassword,
  isSaving = false,
  canEdit = true,
  assignableRoles,
  className,
  embedded = false,
  onHasChangesChange,
}, ref) => {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { getDisplayName } = useRoleConfig()

  const [selectedRole, setSelectedRole] = useState<string>(user?.role || 'VIEWER')
  const [selectedZone, setSelectedZone] = useState<string | null>(user?.selectedZone || null)
  const [selectedStores, setSelectedStores] = useState<string[]>(user?.selectedStores || [])
  const [hasChanges, setHasChanges] = useState(false)

  const updateHasChanges = (value: boolean) => {
    setHasChanges(value)
    onHasChangesChange?.(value)
  }

  React.useEffect(() => {
    if (user) {
      setSelectedRole(user.role)
      setSelectedZone(user.selectedZone)
      setSelectedStores(user.selectedStores)
      updateHasChanges(false)
    }
  }, [user?.id])

  const handleRoleChange = (role: string) => {
    setSelectedRole(role)
    updateHasChanges(true)
  }

  const handleZoneChange = (zoneId: string | null) => {
    setSelectedZone(zoneId)
    updateHasChanges(true)
  }

  const handleStoresChange = (storeIds: string[]) => {
    setSelectedStores(storeIds)
    updateHasChanges(true)
  }

  const handleSave = () => {
    onSave({ role: selectedRole, selectedZone, selectedStores })
    updateHasChanges(false)
  }

  const handleReset = () => {
    if (user) {
      setSelectedRole(user.role)
      setSelectedZone(user.selectedZone)
      setSelectedStores(user.selectedStores)
      updateHasChanges(false)
    }
  }

  // Expose save/reset to parent via ref (for modal header actions)
  useImperativeHandle(ref, () => ({
    save: handleSave,
    reset: handleReset,
  }), [handleSave, handleReset])

  if (!user) {
    if (embedded) return null
    return (
      <div
        className={cn(
          'flex items-center justify-center h-full rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm',
          className,
        )}
      >
        <div className="text-center">
          <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center">
            <User className="w-5 h-5 text-muted-foreground/30" />
          </div>
          <h3 className="text-sm font-medium text-muted-foreground">
            {t('playtelecom:users.selectUserPrompt', { defaultValue: 'Selecciona un usuario' })}
          </h3>
          <p className="text-xs text-muted-foreground/50 mt-1 max-w-[220px] mx-auto">
            {t('playtelecom:users.selectUserHint', {
              defaultValue: 'Selecciona un usuario de la lista para ver y editar sus permisos',
            })}
          </p>
        </div>
      </div>
    )
  }

  const content = (
    <div className={cn(embedded ? 'space-y-4' : 'p-5 space-y-4')}>
      {/* User Header */}
      <GlassCard className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 text-sm font-semibold text-primary">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span>{user.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <span
                className={cn(
                  'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card',
                  user.status === 'active' ? 'bg-green-500' : 'bg-muted-foreground/40',
                )}
              />
            </div>

            {/* Info */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold truncate">{user.name}</h2>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {getDisplayName(user.role)}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </span>
                {user.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 shrink-0" />
                    {user.phone}
                  </span>
                )}
                {user.createdAt && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 shrink-0" />
                    {user.createdAt}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <Badge
            variant={user.status === 'active' ? 'default' : 'secondary'}
            className="shrink-0 text-xs"
          >
            {user.status === 'active' ? <UserCheck className="w-3 h-3 mr-1" /> : <Ban className="w-3 h-3 mr-1" />}
            {t(`playtelecom:users.status.${user.status}`, { defaultValue: STATUS_LABELS[user.status] || user.status })}
          </Badge>
        </div>

        {/* Quick Actions */}
        {canEdit && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
            {onResetPassword && (
              <Button
                variant="outline"
                size="sm"
                onClick={onResetPassword}
                className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-500/10 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer"
              >
                <KeyRound className="w-3 h-3 mr-1" />
                {t('playtelecom:users.resetPassword', { defaultValue: 'Restablecer Contrase\u00f1a' })}
              </Button>
            )}
            {user.status === 'active' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStatusChange('inactive')}
                className="h-7 text-xs text-yellow-600 hover:text-yellow-700 hover:bg-yellow-500/10 dark:text-yellow-400 dark:hover:text-yellow-300 cursor-pointer"
              >
                <Ban className="w-3 h-3 mr-1" />
                {t('playtelecom:users.deactivate', { defaultValue: 'Desactivar' })}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStatusChange('active')}
                className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-500/10 dark:text-green-400 dark:hover:text-green-300 cursor-pointer"
              >
                <UserCheck className="w-3 h-3 mr-1" />
                {t('playtelecom:users.activate', { defaultValue: 'Activar' })}
              </Button>
            )}
          </div>
        )}
      </GlassCard>

      {/* No-edit banner */}
      {!canEdit && (
        <GlassCard className="p-3 flex items-center gap-3 border-yellow-500/30 bg-yellow-500/5">
          <ShieldAlert className="w-4 h-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
          <p className="text-xs text-yellow-700 dark:text-yellow-300">
            {t('playtelecom:users.cannotEditHigherRole', {
              defaultValue: 'No puedes modificar a este usuario porque tiene un rol igual o superior al tuyo',
            })}
          </p>
        </GlassCard>
      )}

      {/* Role Selection */}
      <RoleSelectionCards
        selectedRole={selectedRole}
        onSelectRole={handleRoleChange}
        disabled={!canEdit}
        allowedRoles={assignableRoles}
      />

      {/* Scope Configuration - Venues assigned to user */}
      <ScopeConfiguration
        zones={zones}
        stores={stores}
        selectedZone={selectedZone}
        selectedStores={selectedStores}
        onZoneChange={handleZoneChange}
        onStoresChange={handleStoresChange}
        disabled={!canEdit}
      />

      {/* Audit Log */}
      <AuditLogTerminal entries={user.auditLog} maxHeight={embedded ? 240 : 180} />

      {/* Save Bar — only shown when NOT embedded (embedded uses modal header actions) */}
      {!embedded && hasChanges && canEdit && (
        <div className="sticky bottom-0 py-3 bg-linear-to-t from-card via-card/95 to-transparent">
          <GlassCard className="p-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {t('playtelecom:users.unsavedChanges', { defaultValue: 'Tienes cambios sin guardar' })}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleReset} disabled={isSaving} className="h-7 text-xs cursor-pointer">
                <RotateCcw className="w-3 h-3 mr-1" />
                {t('common:reset', { defaultValue: 'Restablecer' })}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-7 text-xs cursor-pointer">
                <Save className="w-3 h-3 mr-1" />
                {isSaving
                  ? t('common:saving', { defaultValue: 'Guardando...' })
                  : t('common:saveChanges', { defaultValue: 'Guardar Cambios' })}
              </Button>
            </div>
          </GlassCard>
        </div>
      )}

      <div className="h-2" />
    </div>
  )

  if (embedded) return content

  return (
    <div className={cn('h-full rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden', className)}>
      <ScrollArea className="h-full">
        {content}
      </ScrollArea>
    </div>
  )
})

UserDetailPanel.displayName = 'UserDetailPanel'

export default UserDetailPanel
