import { useMemo } from 'react'
import {
  ChevronRight,
  LayoutDashboard,
  ShoppingCart,
  Settings,
  Star,
  Building,
  Heart,
  Monitor,
  CreditCard,
  Grid3x3,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PERMISSION_CATEGORIES, CRITICAL_PERMISSIONS } from '@/lib/permissions/roleHierarchy'
import type { SuperCategory, AccentColor } from '@/lib/permissions/permissionGroups'
import PermissionToggle from './PermissionToggle'

// Icon mapping for super-categories
const ICON_MAP: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="w-4 h-4" />,
  ShoppingCart: <ShoppingCart className="w-4 h-4" />,
  Settings: <Settings className="w-4 h-4" />,
  Star: <Star className="w-4 h-4" />,
  Building: <Building className="w-4 h-4" />,
  Heart: <Heart className="w-4 h-4" />,
  Monitor: <Monitor className="w-4 h-4" />,
  CreditCard: <CreditCard className="w-4 h-4" />,
  Grid3x3: <Grid3x3 className="w-4 h-4" />,
  Users: <Users className="w-4 h-4" />,
}

// Accent color mappings
const ACCENT_COLORS: Record<AccentColor, string> = {
  green: 'from-green-500/20 to-green-500/5 text-green-600 dark:text-green-400',
  blue: 'from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400',
  purple: 'from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400',
  orange: 'from-orange-500/20 to-orange-500/5 text-orange-600 dark:text-orange-400',
}

interface PermissionSuperCategoryProps {
  superCategory: SuperCategory
  selectedPermissions: Set<string>
  defaultPermissions: string[]
  onChange: (permission: string, enabled: boolean) => void
  searchTerm?: string
  isExpanded: boolean
  onToggleExpand: () => void
  disabled?: boolean
  isOwnRole?: boolean
}

/**
 * GlassCard - Glassmorphism wrapper component
 * Matches VenuePaymentConfig.tsx design system
 */
const GlassCard: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className }) => (
  <div
    className={cn(
      'relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm',
      'shadow-sm transition-all duration-300',
      className
    )}
  >
    {children}
  </div>
)

/**
 * PermissionCategoryGroup - Sub-category with individual permission toggles
 */
interface PermissionCategoryGroupProps {
  categoryKey: string
  category: (typeof PERMISSION_CATEGORIES)[keyof typeof PERMISSION_CATEGORIES]
  selectedPermissions: Set<string>
  defaultPermissions: string[]
  onChange: (permission: string, enabled: boolean) => void
  disabled?: boolean
  isOwnRole?: boolean
  searchTerm?: string
}

function PermissionCategoryGroup({
  categoryKey,
  category,
  selectedPermissions,
  defaultPermissions,
  onChange,
  disabled = false,
  isOwnRole = false,
  searchTerm = '',
}: PermissionCategoryGroupProps) {
  const { t } = useTranslation('settings')

  // Filter permissions by search term
  const filteredPermissions = useMemo(() => {
    if (!searchTerm) return category.permissions
    return category.permissions.filter(p => p.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [category.permissions, searchTerm])

  // Check selection state for this category
  const { allSelected, noneSelected } = useMemo(() => {
    const selected = category.permissions.filter(p => selectedPermissions.has(p))
    return {
      allSelected: selected.length === category.permissions.length,
      noneSelected: selected.length === 0,
    }
  }, [category.permissions, selectedPermissions])

  // Toggle all permissions in this category
  const toggleAll = () => {
    if (disabled) return

    category.permissions.forEach(permission => {
      // Skip critical permissions when deselecting
      if (!allSelected) {
        // Selecting all
        if (!selectedPermissions.has(permission)) {
          onChange(permission, true)
        }
      } else {
        // Deselecting all - skip critical permissions for own role
        if (isOwnRole && CRITICAL_PERMISSIONS.includes(permission)) {
          return
        }
        if (selectedPermissions.has(permission)) {
          onChange(permission, false)
        }
      }
    })
  }

  if (filteredPermissions.length === 0) {
    return null
  }

  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
          {t(`rolePermissions.categories.${categoryKey.toLowerCase()}`, category.label)}
        </h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleAll}
          disabled={disabled}
          className="h-6 sm:h-7 px-1.5 sm:px-2 text-[10px] sm:text-xs text-muted-foreground hover:text-foreground flex-shrink-0"
        >
          {allSelected
            ? t('rolePermissions.deselectAll', 'Deselect All')
            : t('rolePermissions.selectAll', 'Select All')}
        </Button>
      </div>

      <div className="grid gap-1.5 sm:gap-2 sm:grid-cols-2">
        {filteredPermissions.map(permission => (
          <PermissionToggle
            key={permission}
            permission={permission}
            isEnabled={selectedPermissions.has(permission)}
            isDefault={defaultPermissions.includes(permission) || defaultPermissions.includes('*:*')}
            isCritical={isOwnRole && CRITICAL_PERMISSIONS.includes(permission)}
            onChange={enabled => onChange(permission, enabled)}
            disabled={disabled}
            highlighted={!!searchTerm && permission.toLowerCase().includes(searchTerm.toLowerCase())}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * PermissionSuperCategory - Collapsible super-category with GlassCard design
 *
 * Features:
 * - Glassmorphism card wrapper
 * - Collapsible with smooth animation
 * - Permission count badge
 * - Modified indicator
 * - Auto-expand on search match
 * - Grouped sub-categories inside
 *
 * Design: Inspired by VenuePaymentConfig.tsx patterns
 */
export function PermissionSuperCategory({
  superCategory,
  selectedPermissions,
  defaultPermissions,
  onChange,
  searchTerm = '',
  isExpanded,
  onToggleExpand,
  disabled = false,
  isOwnRole = false,
}: PermissionSuperCategoryProps) {
  const { t } = useTranslation('settings')

  // Get categories for this super-category
  const categories = useMemo(
    () =>
      superCategory.categoryKeys.map(key => ({
        key,
        ...PERMISSION_CATEGORIES[key],
      })),
    [superCategory.categoryKeys]
  )

  // Calculate enabled/total counts and modifications
  const { enabledCount, totalCount, hasModifications } = useMemo(() => {
    const allPerms = categories.flatMap(c => c.permissions)
    const enabled = allPerms.filter(p => selectedPermissions.has(p))
    const modified = allPerms.some(p => {
      const inDefault = defaultPermissions.includes(p) || defaultPermissions.includes('*:*')
      const inSelected = selectedPermissions.has(p)
      return inDefault !== inSelected
    })
    return {
      enabledCount: enabled.length,
      totalCount: allPerms.length,
      hasModifications: modified,
    }
  }, [categories, selectedPermissions, defaultPermissions])

  // Filter categories based on search
  const filteredCategories = useMemo(() => {
    if (!searchTerm) return categories
    return categories.filter(cat => cat.permissions.some(p => p.toLowerCase().includes(searchTerm.toLowerCase())))
  }, [categories, searchTerm])

  // Auto-expand if search matches
  const shouldAutoExpand = searchTerm && filteredCategories.length > 0

  // Don't render if no categories match search
  if (searchTerm && filteredCategories.length === 0) {
    return null
  }

  const icon = ICON_MAP[superCategory.icon] || <Settings className="w-4 h-4" />
  const accentColorClass = ACCENT_COLORS[superCategory.accentColor]

  return (
    <Collapsible open={isExpanded || shouldAutoExpand} onOpenChange={onToggleExpand}>
      <GlassCard className="mb-3 sm:mb-4 overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="p-3 sm:p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-2xl gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className={cn('p-1.5 sm:p-2 rounded-xl bg-gradient-to-br flex-shrink-0', accentColorClass)}>{icon}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <h3 className="font-medium text-xs sm:text-sm truncate">{t(superCategory.titleKey, superCategory.id)}</h3>
                  {hasModifications && (
                    <Badge variant="outline" className="text-[10px] sm:text-xs px-1 sm:px-1.5 py-0 h-4 sm:h-5 flex-shrink-0">
                      {t('rolePermissions.modified', 'Modified')}
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{t(superCategory.descriptionKey, '')}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
              {/* Permission count badge */}
              <Badge
                variant={enabledCount === totalCount ? 'default' : 'outline'}
                className={cn('text-[10px] sm:text-xs', enabledCount === totalCount && 'bg-green-500 hover:bg-green-600 text-white')}
              >
                {enabledCount}/{totalCount}
              </Badge>
              <ChevronRight
                className={cn(
                  'w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground transition-transform duration-200',
                  (isExpanded || shouldAutoExpand) && 'rotate-90'
                )}
              />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-4 sm:space-y-6">
            <div className="h-px bg-border/50" />

            {filteredCategories.map(category => (
              <PermissionCategoryGroup
                key={category.key}
                categoryKey={category.key}
                category={category}
                selectedPermissions={selectedPermissions}
                defaultPermissions={defaultPermissions}
                onChange={onChange}
                disabled={disabled}
                isOwnRole={isOwnRole}
                searchTerm={searchTerm}
              />
            ))}
          </div>
        </CollapsibleContent>
      </GlassCard>
    </Collapsible>
  )
}

export default PermissionSuperCategory
