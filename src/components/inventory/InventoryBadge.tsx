import { cn } from '@/lib/utils'
import type { Product } from '@/types'

interface InventoryBadgeProps {
  product: Product
  onClick?: () => void
  className?: string
  size?: 'default' | 'sm' | 'lg'
}

/**
 * Inventory Badge Component - Minimal Style
 *
 * Displays available quantity for products with inventory tracking.
 * Works for both QUANTITY (simple count) and RECIPE (calculated from ingredients).
 *
 * Color coding (subtle):
 * - Red text: Out of stock (0)
 * - Amber text: Low stock
 * - Muted text: Normal stock
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
    return <span className="text-muted-foreground">—</span>
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

  // Determine styling based on stock level - subtle colors
  const getStyles = () => {
    if (quantity === 0) {
      // Out of stock - subtle red
      return 'text-red-600 dark:text-red-400'
    }
    if (quantity <= threshold) {
      // Low stock - subtle amber
      return 'text-amber-600 dark:text-amber-400'
    }
    // Normal stock - default muted text
    return 'text-foreground'
  }

  // Size classes
  const sizeClasses = {
    sm: 'text-xs',
    default: 'text-sm',
    lg: 'text-base',
  }

  return (
    <span
      className={cn(
        'font-medium tabular-nums',
        sizeClasses[size],
        getStyles(),
        isClickable && 'cursor-pointer hover:underline transition-all',
        className,
      )}
      onClick={onClick}
    >
      {quantity}
    </span>
  )
}
