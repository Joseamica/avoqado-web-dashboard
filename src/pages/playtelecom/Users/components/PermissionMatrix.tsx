/**
 * PermissionMatrix - Toggle grid for user permissions by category
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Lock,
  Eye,
  Pencil,
  Trash,
  ShoppingCart,
  Package,
  Users,
  Settings,
  BarChart3,
  CreditCard,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PermissionCategory {
  id: string
  labelKey: string
  icon: React.ElementType
  permissions: {
    id: string
    labelKey: string
    description?: string
  }[]
}

/** Spanish labels for permission categories */
const CATEGORY_LABELS: Record<string, string> = {
  sales: 'Ventas',
  inventory: 'Inventario',
  team: 'Equipo',
  reports: 'Reportes',
  payments: 'Pagos',
  settings: 'Configuraci\u00f3n',
}

/** Spanish labels for permission actions */
const ACTION_LABELS: Record<string, string> = {
  view: 'Ver',
  create: 'Crear',
  edit: 'Editar',
  cancel: 'Cancelar',
  transfer: 'Transferir',
  manage: 'Gestionar',
  approve: 'Aprobar',
  export: 'Exportar',
  refund: 'Reembolsar',
}

const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: 'sales',
    labelKey: 'sales',
    icon: ShoppingCart,
    permissions: [
      { id: 'sales:view', labelKey: 'view' },
      { id: 'sales:create', labelKey: 'create' },
      { id: 'sales:cancel', labelKey: 'cancel' },
    ],
  },
  {
    id: 'inventory',
    labelKey: 'inventory',
    icon: Package,
    permissions: [
      { id: 'inventory:view', labelKey: 'view' },
      { id: 'inventory:edit', labelKey: 'edit' },
      { id: 'inventory:transfer', labelKey: 'transfer' },
    ],
  },
  {
    id: 'team',
    labelKey: 'team',
    icon: Users,
    permissions: [
      { id: 'team:view', labelKey: 'view' },
      { id: 'team:manage', labelKey: 'manage' },
      { id: 'team:approve', labelKey: 'approve' },
    ],
  },
  {
    id: 'reports',
    labelKey: 'reports',
    icon: BarChart3,
    permissions: [
      { id: 'reports:view', labelKey: 'view' },
      { id: 'reports:export', labelKey: 'export' },
    ],
  },
  {
    id: 'payments',
    labelKey: 'payments',
    icon: CreditCard,
    permissions: [
      { id: 'payments:view', labelKey: 'view' },
      { id: 'payments:approve', labelKey: 'approve' },
      { id: 'payments:refund', labelKey: 'refund' },
    ],
  },
  {
    id: 'settings',
    labelKey: 'settings',
    icon: Settings,
    permissions: [
      { id: 'settings:view', labelKey: 'view' },
      { id: 'settings:edit', labelKey: 'edit' },
    ],
  },
]

const ACTION_ICONS: Record<string, React.ElementType> = {
  view: Eye,
  create: Pencil,
  edit: Pencil,
  cancel: Trash,
  transfer: Package,
  manage: Users,
  approve: Lock,
  export: BarChart3,
  refund: CreditCard,
}

interface PermissionMatrixProps {
  enabledPermissions: string[]
  onTogglePermission: (permissionId: string, enabled: boolean) => void
  disabled?: boolean
  className?: string
}

export const PermissionMatrix: React.FC<PermissionMatrixProps> = ({
  enabledPermissions,
  onTogglePermission,
  disabled = false,
  className,
}) => {
  const { t } = useTranslation(['playtelecom', 'common'])

  // Count enabled permissions
  const enabledCount = enabledPermissions.length
  const totalCount = PERMISSION_CATEGORIES.reduce(
    (acc, cat) => acc + cat.permissions.length,
    0
  )

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-muted-foreground" />
        <h4 className="text-sm font-medium">
          {t('playtelecom:users.permissions', { defaultValue: 'Permisos' })}
        </h4>
        <Badge variant="secondary" className="ml-auto">
          {enabledCount}/{totalCount}
        </Badge>
      </div>

      <GlassCard className="p-4 space-y-4">
        {PERMISSION_CATEGORIES.map(category => {
          const CategoryIcon = category.icon
          const categoryEnabled = category.permissions.filter(
            p => enabledPermissions.includes(p.id)
          ).length

          return (
            <div key={category.id} className="space-y-2">
              {/* Category Header */}
              <div className="flex items-center gap-2 pb-1 border-b border-border/30">
                <div className="p-1.5 rounded-lg bg-muted/50">
                  <CategoryIcon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium">
                  {t(`playtelecom:users.permissionCategories.${category.labelKey}`, {
                    defaultValue: CATEGORY_LABELS[category.labelKey] || category.labelKey,
                  })}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {categoryEnabled}/{category.permissions.length}
                </span>
              </div>

              {/* Permissions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {category.permissions.map(permission => {
                  const isEnabled = enabledPermissions.includes(permission.id)
                  const ActionIcon = ACTION_ICONS[permission.labelKey] || Eye

                  return (
                    <div
                      key={permission.id}
                      className={cn(
                        'flex items-center justify-between p-2 rounded-lg',
                        'border border-border/30 transition-colors',
                        isEnabled ? 'bg-primary/5 border-primary/20' : 'bg-muted/20',
                        disabled && 'opacity-50'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <ActionIcon className={cn(
                          'w-3.5 h-3.5',
                          isEnabled ? 'text-primary' : 'text-muted-foreground'
                        )} />
                        <span className="text-sm">
                          {t(`playtelecom:users.permissionActions.${permission.labelKey}`, {
                            defaultValue: ACTION_LABELS[permission.labelKey] || permission.labelKey,
                          })}
                        </span>
                      </div>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={checked => onTogglePermission(permission.id, checked)}
                        disabled={disabled}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </GlassCard>
    </div>
  )
}

export default PermissionMatrix
