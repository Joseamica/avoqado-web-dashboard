import { useMemo } from 'react'
import {
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
  Home,
  BarChart3,
  Banknote,
  UtensilsCrossed,
  ClipboardList,
  Wallet,
  Clock,
  Package,
  MessageSquare,
  UsersRound,
  MapPin,
  CalendarCheck,
  Cog,
  Store,
  UserPlus,
  Tags,
  Ticket,
  Receipt,
  Smartphone,
  Shield,
  Bell,
  Box,
  Flag,
  Lock,
  Zap,
  Coins,
  Target,
  Warehouse,
  Bitcoin,
  FileText,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { PERMISSION_CATEGORIES } from '@/lib/permissions/roleHierarchy'
import type { SuperCategory } from '@/lib/permissions/permissionGroups'

// Icon mapping for individual permission categories
const CATEGORY_ICON_MAP: Record<string, React.ReactNode> = {
  HOME: <Home className="w-4 h-4" />,
  ANALYTICS: <BarChart3 className="w-4 h-4" />,
  SETTLEMENTS: <Banknote className="w-4 h-4" />,
  REPORTS: <FileText className="w-4 h-4" />,
  MENU: <UtensilsCrossed className="w-4 h-4" />,
  ORDERS: <ClipboardList className="w-4 h-4" />,
  PAYMENTS: <Wallet className="w-4 h-4" />,
  PRODUCTS: <Package className="w-4 h-4" />,
  SHIFTS: <Clock className="w-4 h-4" />,
  TPV: <Monitor className="w-4 h-4" />,
  INVENTORY: <Package className="w-4 h-4" />,
  REVIEWS: <MessageSquare className="w-4 h-4" />,
  TEAMS: <UsersRound className="w-4 h-4" />,
  TABLES: <MapPin className="w-4 h-4" />,
  RESERVATIONS: <CalendarCheck className="w-4 h-4" />,
  SETTINGS: <Cog className="w-4 h-4" />,
  VENUES: <Store className="w-4 h-4" />,
  BILLING: <Receipt className="w-4 h-4" />,
  ROLE_CONFIG: <Shield className="w-4 h-4" />,
  FEATURES: <Flag className="w-4 h-4" />,
  NOTIFICATIONS: <Bell className="w-4 h-4" />,
  CUSTOMERS: <UserPlus className="w-4 h-4" />,
  CUSTOMER_GROUPS: <Users className="w-4 h-4" />,
  LOYALTY: <Heart className="w-4 h-4" />,
  DISCOUNTS: <Tags className="w-4 h-4" />,
  COUPONS: <Ticket className="w-4 h-4" />,
  TPV_SETTINGS: <Settings className="w-4 h-4" />,
  TPV_TERMINAL: <Smartphone className="w-4 h-4" />,
  TPV_ORDERS: <ClipboardList className="w-4 h-4" />,
  TPV_PAYMENTS: <CreditCard className="w-4 h-4" />,
  TPV_SHIFTS: <Clock className="w-4 h-4" />,
  TPV_TABLES: <Grid3x3 className="w-4 h-4" />,
  TPV_FLOOR_ELEMENTS: <MapPin className="w-4 h-4" />,
  TPV_CUSTOMERS: <UserPlus className="w-4 h-4" />,
  TPV_TIME_ENTRIES: <Clock className="w-4 h-4" />,
  TPV_REPORTS: <BarChart3 className="w-4 h-4" />,
  TPV_PRODUCTS: <Box className="w-4 h-4" />,
  TPV_FACTORY_RESET: <Lock className="w-4 h-4" />,
  TPV_DEVICES: <Smartphone className="w-4 h-4" />,
  TPV_KIOSK: <Monitor className="w-4 h-4" />,
  TPV_MESSAGES: <MessageSquare className="w-4 h-4" />,
  SERIALIZED_INVENTORY: <Warehouse className="w-4 h-4" />,
  VENUE_CRYPTO: <Bitcoin className="w-4 h-4" />,
  COMMISSIONS: <Coins className="w-4 h-4" />,
  GOALS: <Target className="w-4 h-4" />,
  INVENTORY_ORG: <Warehouse className="w-4 h-4" />,
}

// Super-category icon map
const SUPER_ICON_MAP: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="w-3.5 h-3.5" />,
  ShoppingCart: <ShoppingCart className="w-3.5 h-3.5" />,
  Settings: <Settings className="w-3.5 h-3.5" />,
  Star: <Star className="w-3.5 h-3.5" />,
  Building: <Building className="w-3.5 h-3.5" />,
  Heart: <Heart className="w-3.5 h-3.5" />,
  Monitor: <Monitor className="w-3.5 h-3.5" />,
  CreditCard: <CreditCard className="w-3.5 h-3.5" />,
  Grid3x3: <Grid3x3 className="w-3.5 h-3.5" />,
  Users: <Users className="w-3.5 h-3.5" />,
}

type CategoryStatus = 'active' | 'partial' | 'off'

interface PermissionCategoryNavProps {
  superCategories: SuperCategory[]
  selectedCategoryKey: string | null
  onSelectCategory: (categoryKey: string) => void
  getCategoryStatus: (categoryKey: keyof typeof PERMISSION_CATEGORIES) => {
    enabled: number
    total: number
    status: CategoryStatus
  }
  className?: string
}

function StatusBadge({ status }: { status: CategoryStatus }) {
  if (status === 'active') {
    return (
      <Badge
        variant="default"
        className="text-[10px] px-1.5 py-0 h-[18px] bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20 hover:bg-green-500/15"
      >
        ON
      </Badge>
    )
  }
  if (status === 'partial') {
    return (
      <Badge
        variant="outline"
        className="text-[10px] px-1.5 py-0 h-[18px] border-yellow-500/30 text-yellow-600 dark:text-yellow-400"
      >
        Partial
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="text-[10px] px-1.5 py-0 h-[18px] text-muted-foreground/60 border-border/50"
    >
      OFF
    </Badge>
  )
}

export function PermissionCategoryNav({
  superCategories,
  selectedCategoryKey,
  onSelectCategory,
  getCategoryStatus,
  className,
}: PermissionCategoryNavProps) {
  const { t } = useTranslation('settings')

  // Build flat list of items grouped by super-category
  const navItems = useMemo(() => {
    return superCategories.map(superCat => ({
      superCategory: superCat,
      categories: superCat.categoryKeys.map(key => {
        const category = PERMISSION_CATEGORIES[key]
        const status = getCategoryStatus(key)
        return {
          key,
          label: category.label,
          icon: CATEGORY_ICON_MAP[key] || <Zap className="w-4 h-4" />,
          ...status,
        }
      }),
    }))
  }, [superCategories, getCategoryStatus])

  return (
    <div className={cn('flex flex-col', className)}>
      <ScrollArea className="flex-1">
        <nav className="space-y-1 p-1">
          {navItems.map(({ superCategory, categories }) => (
            <div key={superCategory.id} className="mb-3">
              {/* Super-category header */}
              <div className="flex items-center gap-1.5 px-2 py-1.5 mb-0.5">
                <span className="text-muted-foreground/70">
                  {SUPER_ICON_MAP[superCategory.icon] || <Settings className="w-3.5 h-3.5" />}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 truncate">
                  {t(superCategory.titleKey, superCategory.id)}
                </span>
              </div>

              {/* Category items */}
              <div className="space-y-0.5">
                {categories.map(cat => {
                  const isSelected = selectedCategoryKey === cat.key
                  return (
                    <button
                      key={cat.key}
                      onClick={() => onSelectCategory(cat.key)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer',
                        'hover:bg-accent/50',
                        isSelected && 'bg-accent text-accent-foreground shadow-sm'
                      )}
                    >
                      <span className={cn(
                        'flex-shrink-0 text-muted-foreground',
                        isSelected && 'text-foreground'
                      )}>
                        {cat.icon}
                      </span>
                      <span className={cn(
                        'flex-1 text-sm truncate',
                        isSelected ? 'font-medium' : 'text-muted-foreground'
                      )}>
                        {t(`rolePermissions.categories.${cat.key.toLowerCase()}`, cat.label)}
                      </span>
                      <StatusBadge status={cat.status} />
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </div>
  )
}

export default PermissionCategoryNav
