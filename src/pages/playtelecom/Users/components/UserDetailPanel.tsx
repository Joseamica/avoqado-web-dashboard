/**
 * UserDetailPanel - Main editing panel for user management
 * Combines role selection, scope configuration, permissions, and audit log
 */

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  User,
  Mail,
  Phone,
  Calendar,
  Save,
  Ban,
  UserCheck,
  RotateCcw,
  KeyRound,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { RoleSelectionCards, type UserRole } from './RoleSelectionCards'
import { ScopeConfiguration, type Zone, type StoreOption } from './ScopeConfiguration'
import { PermissionMatrix } from './PermissionMatrix'
import { AuditLogTerminal, type AuditLogEntry } from './AuditLogTerminal'

export interface UserDetail {
  id: string
  name: string
  email: string
  phone?: string
  role: UserRole
  status: 'active' | 'inactive' | 'blocked'
  avatarUrl?: string
  createdAt: string
  selectedZone: string | null
  selectedStores: string[]
  permissions: string[]
  auditLog: AuditLogEntry[]
}

interface UserDetailPanelProps {
  user: UserDetail | null
  zones: Zone[]
  stores: StoreOption[]
  onSave: (updates: Partial<UserDetail>) => void
  onStatusChange: (status: 'active' | 'inactive' | 'blocked') => void
  onResetPassword?: () => void
  isSaving?: boolean
  className?: string
}

export const UserDetailPanel: React.FC<UserDetailPanelProps> = ({
  user,
  zones,
  stores,
  onSave,
  onStatusChange,
  onResetPassword,
  isSaving = false,
  className,
}) => {
  const { t } = useTranslation(['playtelecom', 'common'])

  // Local state for editing
  const [selectedRole, setSelectedRole] = useState<UserRole>(user?.role || 'PROMOTOR')
  const [selectedZone, setSelectedZone] = useState<string | null>(user?.selectedZone || null)
  const [selectedStores, setSelectedStores] = useState<string[]>(user?.selectedStores || [])
  const [permissions, setPermissions] = useState<string[]>(user?.permissions || [])
  const [hasChanges, setHasChanges] = useState(false)

  // Update local state when user changes
  React.useEffect(() => {
    if (user) {
      setSelectedRole(user.role)
      setSelectedZone(user.selectedZone)
      setSelectedStores(user.selectedStores)
      setPermissions(user.permissions)
      setHasChanges(false)
    }
  }, [user?.id])

  // Track changes
  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role)
    setHasChanges(true)
  }

  const handleZoneChange = (zoneId: string | null) => {
    setSelectedZone(zoneId)
    setHasChanges(true)
  }

  const handleStoresChange = (storeIds: string[]) => {
    setSelectedStores(storeIds)
    setHasChanges(true)
  }

  const handlePermissionToggle = (permissionId: string, enabled: boolean) => {
    setPermissions(prev =>
      enabled
        ? [...prev, permissionId]
        : prev.filter(id => id !== permissionId)
    )
    setHasChanges(true)
  }

  // Save changes
  const handleSave = () => {
    onSave({
      role: selectedRole,
      selectedZone,
      selectedStores,
      permissions,
    })
    setHasChanges(false)
  }

  // Reset changes
  const handleReset = () => {
    if (user) {
      setSelectedRole(user.role)
      setSelectedZone(user.selectedZone)
      setSelectedStores(user.selectedStores)
      setPermissions(user.permissions)
      setHasChanges(false)
    }
  }

  if (!user) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="text-center">
          <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="text-lg font-medium text-muted-foreground">
            {t('playtelecom:users.selectUserPrompt', { defaultValue: 'Selecciona un usuario' })}
          </h3>
          <p className="text-sm text-muted-foreground/70 mt-1">
            {t('playtelecom:users.selectUserHint', {
              defaultValue: 'Selecciona un usuario de la lista para ver y editar sus permisos',
            })}
          </p>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className={cn('h-full', className)}>
      <div className="p-6 space-y-6">
        {/* User Header */}
        <GlassCard className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="relative">
                <div className={cn(
                  'w-16 h-16 rounded-full flex items-center justify-center',
                  'bg-gradient-to-br from-primary/20 to-primary/5'
                )}>
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-8 h-8 text-primary" />
                  )}
                </div>
                {/* Status dot */}
                <span className={cn(
                  'absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-background',
                  user.status === 'active' && 'bg-green-500',
                  user.status === 'inactive' && 'bg-gray-400',
                  user.status === 'blocked' && 'bg-red-500'
                )} />
              </div>

              {/* Info */}
              <div>
                <h2 className="text-xl font-semibold">{user.name}</h2>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    {user.email}
                  </span>
                  {user.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" />
                      {user.phone}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {user.createdAt}
                  </span>
                </div>
              </div>
            </div>

            {/* Status Badge */}
            <Badge
              variant={user.status === 'active' ? 'default' : user.status === 'blocked' ? 'destructive' : 'secondary'}
              className="shrink-0"
            >
              {user.status === 'active' && <UserCheck className="w-3 h-3 mr-1" />}
              {user.status === 'blocked' && <Ban className="w-3 h-3 mr-1" />}
              {t(`playtelecom:users.status.${user.status}`, { defaultValue: user.status })}
            </Badge>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
            {onResetPassword && (
              <Button
                variant="outline"
                size="sm"
                onClick={onResetPassword}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-500/10"
              >
                <KeyRound className="w-3.5 h-3.5 mr-1" />
                {t('playtelecom:users.resetPassword', { defaultValue: 'Reset Password' })}
              </Button>
            )}
            {user.status === 'active' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStatusChange('inactive')}
                className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-500/10"
              >
                <Ban className="w-3.5 h-3.5 mr-1" />
                {t('playtelecom:users.deactivate', { defaultValue: 'Desactivar' })}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStatusChange('active')}
                className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-500/10"
              >
                <UserCheck className="w-3.5 h-3.5 mr-1" />
                {t('playtelecom:users.activate', { defaultValue: 'Activar' })}
              </Button>
            )}
            {user.status !== 'blocked' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStatusChange('blocked')}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                <Ban className="w-3.5 h-3.5 mr-1" />
                {t('playtelecom:users.block', { defaultValue: 'Bloquear' })}
              </Button>
            )}
          </div>
        </GlassCard>

        {/* Role Selection */}
        <RoleSelectionCards
          selectedRole={selectedRole}
          onSelectRole={handleRoleChange}
          disabled={user.status === 'blocked'}
        />

        {/* Scope Configuration */}
        <ScopeConfiguration
          zones={zones}
          stores={stores}
          selectedZone={selectedZone}
          selectedStores={selectedStores}
          onZoneChange={handleZoneChange}
          onStoresChange={handleStoresChange}
          disabled={user.status === 'blocked'}
        />

        {/* Permission Matrix */}
        <PermissionMatrix
          enabledPermissions={permissions}
          onTogglePermission={handlePermissionToggle}
          disabled={user.status === 'blocked'}
        />

        {/* Audit Log */}
        <AuditLogTerminal entries={user.auditLog} maxHeight={180} />

        {/* Save Bar */}
        {hasChanges && (
          <div className="sticky bottom-0 py-4 bg-gradient-to-t from-background via-background to-transparent">
            <GlassCard className="p-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t('playtelecom:users.unsavedChanges', { defaultValue: 'Tienes cambios sin guardar' })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={isSaving}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  {t('common:reset', { defaultValue: 'Restablecer' })}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  <Save className="w-3.5 h-3.5 mr-1" />
                  {isSaving
                    ? t('common:saving', { defaultValue: 'Guardando...' })
                    : t('common:saveChanges', { defaultValue: 'Guardar Cambios' })}
                </Button>
              </div>
            </GlassCard>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

export default UserDetailPanel
