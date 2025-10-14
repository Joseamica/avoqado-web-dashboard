import { ReactNode } from 'react'
import { usePermissions } from '@/hooks/usePermissions'

interface PermissionGateProps {
  /**
   * Single permission to check
   * @example permission="tpv:create"
   */
  permission?: string

  /**
   * Multiple permissions to check
   * @example permissions={['tpv:create', 'tpv:update']}
   */
  permissions?: string[]

  /**
   * Logic for multiple permissions
   * - true: Require ALL permissions (AND logic)
   * - false: Require ANY permission (OR logic) - default
   */
  requireAll?: boolean

  /**
   * Content to show if user has permission
   */
  children: ReactNode

  /**
   * Content to show if user does NOT have permission
   * @default null (render nothing)
   */
  fallback?: ReactNode
}

/**
 * Conditionally render children based on permissions
 *
 * This component is used to show/hide UI elements based on user permissions.
 * It does NOT provide security - the backend must always validate permissions.
 *
 * @example Single permission
 * <PermissionGate permission="tpv:create">
 *   <Button>Create Terminal</Button>
 * </PermissionGate>
 *
 * @example Multiple permissions (OR logic - show if has ANY)
 * <PermissionGate permissions={['tpv:update', 'tpv:delete']}>
 *   <ActionMenu />
 * </PermissionGate>
 *
 * @example Multiple permissions (AND logic - show if has ALL)
 * <PermissionGate permissions={['tpv:read', 'tpv:create']} requireAll>
 *   <AdvancedEditor />
 * </PermissionGate>
 *
 * @example With fallback
 * <PermissionGate
 *   permission="analytics:export"
 *   fallback={<Button disabled>Export (Upgrade Required)</Button>}
 * >
 *   <Button>Export Data</Button>
 * </PermissionGate>
 */
export function PermissionGate({
  permission,
  permissions,
  requireAll = false,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { can, canAny, canAll } = usePermissions()

  // Single permission check
  if (permission) {
    return can(permission) ? <>{children}</> : <>{fallback}</>
  }

  // Multiple permissions check
  if (permissions && permissions.length > 0) {
    const hasPermission = requireAll ? canAll(permissions) : canAny(permissions)
    return hasPermission ? <>{children}</> : <>{fallback}</>
  }

  // No permission specified = show children by default
  // This allows using the component without breaking when no permission is set
  return <>{children}</>
}
