import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Product } from '@/types'

interface InventoryBadgeProps {
  product: Product
  onClick?: () => void
  className?: string
  size?: 'default' | 'sm' | 'lg'
}

/**
 * Inventory Badge Component - Toast POS Style
 *
 * Displays available quantity for products with inventory tracking.
 * Works for both QUANTITY (simple count) and RECIPE (calculated from ingredients).
 *
 * Color coding:
 * - Red: Out of stock (0)
 * - Orange: Low stock (1-5)
 * - Green: Normal stock (>5)
 * - Hidden: No tracking enabled
 *
 * @example
 * ```tsx
 * <InventoryBadge
 *   product={product}
 *   onClick={() => setSelectedProduct(product)}
 * />
 * ```
 */
export function InventoryBadge({ product, onClick, className, size = 'default' }: InventoryBadgeProps) {
  // Don't show badge if inventory tracking is disabled
  if (!product.trackInventory) {
    return null
  }

  // For products with inventory tracking, treat null/undefined as 0
  // This happens when RECIPE products don't have ingredients configured yet
  const quantity = product.availableQuantity ?? 0
  const isClickable = !!onClick

  // Determine threshold based on inventory method and product config
  // QUANTITY: fallback to minimumStock or 10
  // RECIPE: fallback to 5 portions
  const defaultThreshold = product.inventoryMethod === 'RECIPE' ? 5 : (Number(product.inventory?.minimumStock ?? 10))
  const threshold = product.lowStockThreshold ?? defaultThreshold

  // Determine badge styling based on stock level
  const getStyles = () => {
    if (quantity === 0) {
      // Red - Out of stock
      return {
        variant: 'destructive' as const,
        className: '',
      }
    }
    if (quantity <= threshold) {
      // Orange - Low stock (configurable threshold)
      return {
        variant: 'secondary' as const,
        className: 'bg-orange-500 text-primary-foreground hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700',
      }
    }
    // Green - Normal stock
    return {
      variant: 'secondary' as const,
      className: 'bg-green-500 text-primary-foreground hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700',
    }
  }

  const { variant, className: statusClassName } = getStyles()

  // Size classes
  const sizeClasses = {
    sm: 'h-5 text-xs px-1.5',
    default: 'h-6 text-sm px-2',
    lg: 'h-7 text-base px-3',
  }

  return (
    <Badge
      variant={variant}
      className={cn(
        'font-bold tabular-nums border-transparent shadow-sm',
        sizeClasses[size],
        statusClassName,
        isClickable && 'cursor-pointer hover:opacity-80 transition-opacity',
        className,
      )}
      onClick={onClick}
    >
      {quantity}
    </Badge>
  )
}
