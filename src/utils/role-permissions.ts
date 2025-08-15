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
    SUPERADMIN: 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-200',
    OWNER: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200',
    ADMIN: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200',
    MANAGER: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200',
    WAITER: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200',
    CASHIER: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-200',
    KITCHEN: 'bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-200',
    HOST: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200',
    VIEWER: 'bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-200',
  }

  // Use generic color for hidden superadmin
  if (role === StaffRole.SUPERADMIN && !canViewSuperadminInfo(userRole)) {
    return 'bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-200'
  }

  return colors[role] || colors.VIEWER
}