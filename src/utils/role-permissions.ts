import { StaffRole } from '@/types'

/**
 * Check if the current user should see superadmin information
 * Only SUPERADMIN users should see superadmin-related UI elements
 */
export const canViewSuperadminInfo = (userRole?: StaffRole): boolean => {
  return userRole === StaffRole.SUPERADMIN
}

/**
 * Filter out superadmin entries from team lists for non-superadmin users
 */
export const filterSuperadminFromTeam = (teamMembers: any[], userRole?: StaffRole) => {
  if (canViewSuperadminInfo(userRole)) {
    return teamMembers
  }
  return teamMembers.filter(member => member.role !== StaffRole.SUPERADMIN)
}

/**
 * Get role display names, hiding superadmin for non-superadmin users
 */
export const getRoleDisplayName = (role: StaffRole, userRole?: StaffRole) => {
  const names = {
    SUPERADMIN: 'Super Admin',
    OWNER: 'Propietario',
    ADMIN: 'Administrador',
    MANAGER: 'Gerente',
    WAITER: 'Mesero',
    CASHIER: 'Cajero',
    KITCHEN: 'Cocina',
    HOST: 'Anfitrión',
    VIEWER: 'Visualizador',
  }

  // Hide superadmin role from non-superadmin users
  if (role === StaffRole.SUPERADMIN && !canViewSuperadminInfo(userRole)) {
    return 'Sistema' // Generic name for hidden superadmin
  }

  return names[role] || role
}

/**
 * Get role badge colors, hiding superadmin for non-superadmin users
 */
export const getRoleBadgeColor = (role: StaffRole, userRole?: StaffRole) => {
  const colors = {
    SUPERADMIN: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border border-transparent',
    OWNER: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-transparent',
    ADMIN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-transparent',
    MANAGER: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-transparent',
    WAITER: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border border-transparent',
    CASHIER: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border border-transparent',
    KITCHEN: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400 border border-transparent',
    HOST: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 border border-transparent',
    VIEWER: 'bg-muted text-muted-foreground border border-transparent',
  }

  // Use generic color for hidden superadmin
  if (role === StaffRole.SUPERADMIN && !canViewSuperadminInfo(userRole)) {
    return 'bg-muted text-muted-foreground border border-transparent'
  }

  return colors[role] || colors.VIEWER
}
