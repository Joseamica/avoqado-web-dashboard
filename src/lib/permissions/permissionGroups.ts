import { StaffRole } from '@/types'
import { PERMISSION_CATEGORIES, DEFAULT_PERMISSIONS } from './defaultPermissions'
import { SUPER_CATEGORY_KEYS } from './generated/permissionCatalog.generated'
import { includesNormalized } from '@/lib/utils'

/**
 * Permission Groups - Super-category definitions for the redesigned RolePermissions UI
 *
 * This file defines:
 * 1. Super-categories that group related permission categories
 * 2. Dashboard vs TPV permission split
 * 3. Role template metadata for the template selector
 *
 * Design inspiration: Stripe Dashboard, Square Advanced Access, Linear
 */

// ============================================================================
// TYPES
// ============================================================================

export type AccentColor = 'green' | 'blue' | 'purple' | 'orange'

export interface SuperCategory {
  id: string
  titleKey: string // i18n key
  descriptionKey: string // i18n key
  icon: string // Lucide icon name
  accentColor: AccentColor
  categoryKeys: readonly (keyof typeof PERMISSION_CATEGORIES)[]
}

export interface RoleTemplate {
  role: StaffRole
  icon: string // Lucide icon name
  descriptionKey: string // i18n key
  color: string
  permissionCount: number
}

// ============================================================================
// DASHBOARD SUPER-CATEGORIES (21 categories -> 6 super-categories)
// ============================================================================

export const DASHBOARD_SUPER_CATEGORIES: SuperCategory[] = [
  {
    id: 'core-operations',
    titleKey: 'rolePermissions.superCategories.coreOperations',
    descriptionKey: 'rolePermissions.superCategories.coreOperationsDesc',
    icon: 'LayoutDashboard',
    accentColor: 'blue',
    categoryKeys: SUPER_CATEGORY_KEYS['core-operations'],
  },
  {
    id: 'sales-orders',
    titleKey: 'rolePermissions.superCategories.salesOrders',
    descriptionKey: 'rolePermissions.superCategories.salesOrdersDesc',
    icon: 'ShoppingCart',
    accentColor: 'green',
    categoryKeys: SUPER_CATEGORY_KEYS['sales-orders'],
  },
  {
    id: 'operations',
    titleKey: 'rolePermissions.superCategories.operations',
    descriptionKey: 'rolePermissions.superCategories.operationsDesc',
    icon: 'Settings',
    accentColor: 'purple',
    categoryKeys: SUPER_CATEGORY_KEYS['operations'],
  },
  {
    id: 'customer-experience',
    titleKey: 'rolePermissions.superCategories.customerExperience',
    descriptionKey: 'rolePermissions.superCategories.customerExperienceDesc',
    icon: 'Star',
    accentColor: 'orange',
    categoryKeys: SUPER_CATEGORY_KEYS['customer-experience'],
  },
  {
    id: 'team-settings',
    titleKey: 'rolePermissions.superCategories.teamSettings',
    descriptionKey: 'rolePermissions.superCategories.teamSettingsDesc',
    icon: 'Building',
    accentColor: 'blue',
    categoryKeys: SUPER_CATEGORY_KEYS['team-settings'],
  },
  {
    id: 'marketing-loyalty',
    titleKey: 'rolePermissions.superCategories.marketingLoyalty',
    descriptionKey: 'rolePermissions.superCategories.marketingLoyaltyDesc',
    icon: 'Heart',
    accentColor: 'purple',
    categoryKeys: SUPER_CATEGORY_KEYS['marketing-loyalty'],
  },
]

// ============================================================================
// TPV SUPER-CATEGORIES (11 categories -> 4 super-categories)
// ============================================================================

export const TPV_SUPER_CATEGORIES: SuperCategory[] = [
  {
    id: 'terminal-operations',
    titleKey: 'rolePermissions.superCategories.terminalOperations',
    descriptionKey: 'rolePermissions.superCategories.terminalOperationsDesc',
    icon: 'Monitor',
    accentColor: 'blue',
    categoryKeys: SUPER_CATEGORY_KEYS['terminal-operations'],
  },
  {
    id: 'tpv-orders-payments',
    titleKey: 'rolePermissions.superCategories.tpvOrdersPayments',
    descriptionKey: 'rolePermissions.superCategories.tpvOrdersPaymentsDesc',
    icon: 'CreditCard',
    accentColor: 'green',
    categoryKeys: SUPER_CATEGORY_KEYS['tpv-orders-payments'],
  },
  {
    id: 'floor-management',
    titleKey: 'rolePermissions.superCategories.floorManagement',
    descriptionKey: 'rolePermissions.superCategories.floorManagementDesc',
    icon: 'Grid3x3',
    accentColor: 'purple',
    categoryKeys: SUPER_CATEGORY_KEYS['floor-management'],
  },
  {
    id: 'staff-customers',
    titleKey: 'rolePermissions.superCategories.staffCustomers',
    descriptionKey: 'rolePermissions.superCategories.staffCustomersDesc',
    icon: 'Users',
    accentColor: 'orange',
    categoryKeys: SUPER_CATEGORY_KEYS['staff-customers'],
  },
]

// ============================================================================
// ROLE TEMPLATES
// ============================================================================

/**
 * Get the number of permissions for a role (handles wildcard)
 */
function getPermissionCount(role: StaffRole): number {
  const perms = DEFAULT_PERMISSIONS[role]
  if (perms.includes('*:*')) {
    // Count all available permissions
    return Object.values(PERMISSION_CATEGORIES).reduce((sum, cat) => sum + cat.permissions.length, 0)
  }
  return perms.length
}

/**
 * Role template metadata for the template selector
 * Only includes roles that can be used as templates (not SUPERADMIN)
 */
export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    role: StaffRole.ADMIN,
    icon: 'ShieldCheck',
    descriptionKey: 'rolePermissions.templates.adminDesc',
    color: 'indigo',
    permissionCount: getPermissionCount(StaffRole.ADMIN),
  },
  {
    role: StaffRole.OWNER,
    icon: 'Crown',
    descriptionKey: 'rolePermissions.templates.ownerDesc',
    color: 'amber',
    permissionCount: getPermissionCount(StaffRole.OWNER),
  },
  {
    role: StaffRole.MANAGER,
    icon: 'Briefcase',
    descriptionKey: 'rolePermissions.templates.managerDesc',
    color: 'blue',
    permissionCount: getPermissionCount(StaffRole.MANAGER),
  },
  {
    role: StaffRole.CASHIER,
    icon: 'Wallet',
    descriptionKey: 'rolePermissions.templates.cashierDesc',
    color: 'green',
    permissionCount: getPermissionCount(StaffRole.CASHIER),
  },
  {
    role: StaffRole.WAITER,
    icon: 'UtensilsCrossed',
    descriptionKey: 'rolePermissions.templates.waiterDesc',
    color: 'orange',
    permissionCount: getPermissionCount(StaffRole.WAITER),
  },
  {
    role: StaffRole.KITCHEN,
    icon: 'ChefHat',
    descriptionKey: 'rolePermissions.templates.kitchenDesc',
    color: 'red',
    permissionCount: getPermissionCount(StaffRole.KITCHEN),
  },
  {
    role: StaffRole.HOST,
    icon: 'UserCircle',
    descriptionKey: 'rolePermissions.templates.hostDesc',
    color: 'teal',
    permissionCount: getPermissionCount(StaffRole.HOST),
  },
  {
    role: StaffRole.VIEWER,
    icon: 'Eye',
    descriptionKey: 'rolePermissions.templates.viewerDesc',
    color: 'gray',
    permissionCount: getPermissionCount(StaffRole.VIEWER),
  },
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get categories for a super-category
 */
export function getCategoriesForSuperCategory(superCategory: SuperCategory) {
  return superCategory.categoryKeys.map(key => ({
    key,
    ...PERMISSION_CATEGORIES[key],
  }))
}

/**
 * Get all permissions for a super-category
 */
export function getPermissionsForSuperCategory(superCategory: SuperCategory): string[] {
  return superCategory.categoryKeys.flatMap(key => PERMISSION_CATEGORIES[key].permissions)
}

/**
 * Get all dashboard permissions
 */
export function getAllDashboardPermissions(): string[] {
  return DASHBOARD_SUPER_CATEGORIES.flatMap(getPermissionsForSuperCategory)
}

/**
 * Get all TPV permissions
 */
export function getAllTpvPermissions(): string[] {
  return TPV_SUPER_CATEGORIES.flatMap(getPermissionsForSuperCategory)
}

/**
 * Detect which template (if any) matches the current permissions
 * Returns the role if exact match, 'custom' if modified, or null if no base detected
 */
export function detectMatchingTemplate(
  currentPermissions: string[],
  targetRole: StaffRole
): StaffRole | 'custom' | null {
  const currentSet = new Set(currentPermissions)

  // Check if it's a wildcard match
  if (currentSet.has('*:*')) {
    // Check if the target role's default is also wildcard
    if (DEFAULT_PERMISSIONS[targetRole].includes('*:*')) {
      return targetRole
    }
    // Otherwise it's custom (upgraded to wildcard)
    return 'custom'
  }

  // Get all permissions for comparison
  const allPermissions = Object.values(PERMISSION_CATEGORIES).flatMap(cat => cat.permissions)

  // Check against each role template
  for (const template of ROLE_TEMPLATES) {
    const templatePerms = DEFAULT_PERMISSIONS[template.role]

    // Handle wildcard templates
    if (templatePerms.includes('*:*')) {
      // Check if current has all permissions
      const hasAll = allPermissions.every(p => currentSet.has(p))
      if (hasAll && currentSet.size === allPermissions.length) {
        return template.role
      }
      continue
    }

    // Exact match check
    if (templatePerms.length === currentPermissions.length) {
      const templateSet = new Set(templatePerms)
      const isExactMatch = currentPermissions.every(p => templateSet.has(p))
      if (isExactMatch) {
        return template.role
      }
    }
  }

  // No exact match found
  return 'custom'
}

/**
 * Get relevant templates for a target role
 * Shows templates that make sense given the role hierarchy
 */
export function getRelevantTemplates(targetRole: StaffRole): RoleTemplate[] {
  // For roles with wildcard (*:*), show all templates
  if (DEFAULT_PERMISSIONS[targetRole].includes('*:*')) {
    return ROLE_TEMPLATES
  }

  // For other roles, show templates with same or fewer permissions
  const targetCount = getPermissionCount(targetRole)

  return ROLE_TEMPLATES.filter(template => {
    // Always include the same role
    if (template.role === targetRole) return true
    // Include templates with fewer or equal permissions
    return template.permissionCount <= targetCount * 1.5 // Allow some flexibility
  })
}

/**
 * Check if a permission belongs to Dashboard or TPV
 */
export function getPermissionPlatform(permission: string): 'dashboard' | 'tpv' | 'both' {
  const dashboardPerms = new Set(getAllDashboardPermissions())
  const tpvPerms = new Set(getAllTpvPermissions())

  const inDashboard = dashboardPerms.has(permission)
  const inTpv = tpvPerms.has(permission)

  if (inDashboard && inTpv) return 'both'
  if (inTpv) return 'tpv'
  return 'dashboard'
}

/**
 * Filter permissions by search term
 */
export function filterPermissionsBySearch(
  superCategories: SuperCategory[],
  searchTerm: string
): SuperCategory[] {
  if (!searchTerm.trim()) return superCategories

  return superCategories
    .map(superCat => ({
      ...superCat,
      categoryKeys: superCat.categoryKeys.filter(key => {
        const category = PERMISSION_CATEGORIES[key]
        // Check if any permission in this category matches
        return category.permissions.some(p => includesNormalized(p ?? '', searchTerm))
      }),
    }))
    .filter(superCat => superCat.categoryKeys.length > 0) as SuperCategory[]
}
