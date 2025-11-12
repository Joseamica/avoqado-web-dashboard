import { useEffect } from 'react'
import { useSocket } from '@/context/SocketContext'

/**
 * Menu Socket Event Types
 * Matches server-side events from avoqado-server/src/communication/sockets/types/index.ts
 */
export interface MenuUpdatedEvent {
  updateType: 'FULL_REFRESH' | 'PARTIAL_UPDATE'
  categoryIds?: string[]
  productIds?: string[]
  reason: 'PRICE_CHANGE' | 'AVAILABILITY_CHANGE' | 'ITEM_ADDED' | 'ITEM_REMOVED' | 'CATEGORY_UPDATED'
  updatedBy?: string
  venueId: string
  timestamp: string
  metadata?: Record<string, any>
}

export interface MenuItemEvent {
  itemId: string
  itemName: string
  sku?: string
  categoryId?: string
  categoryName?: string
  price?: number
  available?: boolean
  imageUrl?: string | null
  description?: string | null
  modifierGroupIds?: string[]
  venueId: string
  timestamp: string
  metadata?: Record<string, any>
}

export interface ProductPriceChangedEvent {
  productId: string
  productName: string
  sku: string
  oldPrice: number
  newPrice: number
  priceChange: number
  priceChangePercent: number
  categoryId: string
  categoryName: string
  updatedBy?: string
  venueId: string
  timestamp: string
  metadata?: Record<string, any>
}

export interface MenuItemAvailabilityChangedEvent {
  itemId: string
  itemName: string
  available: boolean
  previousAvailability: boolean
  reason?: 'OUT_OF_STOCK' | 'MANUAL' | 'TIME_BASED' | 'INVENTORY_DEPLETION'
  affectedOrders?: string[]
  venueId: string
  timestamp: string
  metadata?: Record<string, any>
}

export interface MenuCategoryEvent {
  categoryId: string
  categoryName: string
  action: 'CREATED' | 'UPDATED' | 'DELETED' | 'ENABLED' | 'DISABLED' | 'REORDERED'
  displayOrder?: number
  active?: boolean
  parentId?: string | null
  affectedItemCount?: number
  venueId: string
  timestamp: string
  metadata?: Record<string, any>
}

/**
 * Callbacks for menu socket events
 */
export interface MenuSocketEventCallbacks {
  onMenuUpdated?: (event: MenuUpdatedEvent) => void
  onMenuItemCreated?: (event: MenuItemEvent) => void
  onMenuItemUpdated?: (event: MenuItemEvent) => void
  onMenuItemDeleted?: (event: MenuItemEvent) => void
  onPriceChanged?: (event: ProductPriceChangedEvent) => void
  onAvailabilityChanged?: (event: MenuItemAvailabilityChangedEvent) => void
  onCategoryUpdated?: (event: MenuCategoryEvent) => void
  onCategoryDeleted?: (event: MenuCategoryEvent) => void
}

/**
 * Custom hook for menu real-time socket events
 *
 * Sets up listeners for all menu-related Socket.IO events from the server.
 * Automatically joins venue room and cleans up on unmount.
 *
 * @param venueId - The venue ID to subscribe to
 * @param callbacks - Optional callbacks for specific menu events
 *
 * @example
 * ```tsx
 * useMenuSocketEvents(venueId, {
 *   onMenuItemCreated: (event) => {
 *     console.log('New menu item:', event.itemName)
 *     refetchMenuItems()
 *   },
 *   onPriceChanged: (event) => {
 *     toast.success(`${event.productName} price updated: ${event.oldPrice} → ${event.newPrice}`)
 *   }
 * })
 * ```
 */
export function useMenuSocketEvents(venueId: string | undefined, callbacks: MenuSocketEventCallbacks = {}) {
  const { socket, joinVenueRoom, leaveVenueRoom } = useSocket()

  useEffect(() => {
    if (!venueId || !socket) return

    // Join venue-specific room
    joinVenueRoom(venueId)

    // Set up event listeners
    const {
      onMenuUpdated,
      onMenuItemCreated,
      onMenuItemUpdated,
      onMenuItemDeleted,
      onPriceChanged,
      onAvailabilityChanged,
      onCategoryUpdated,
      onCategoryDeleted,
    } = callbacks

    // Menu updated (general refresh signal)
    if (onMenuUpdated) {
      socket.on('menu_updated', onMenuUpdated)
    }

    // Menu item created
    if (onMenuItemCreated) {
      socket.on('menu_item_created', onMenuItemCreated)
    }

    // Menu item updated
    if (onMenuItemUpdated) {
      socket.on('menu_item_updated', onMenuItemUpdated)
    }

    // Menu item deleted
    if (onMenuItemDeleted) {
      socket.on('menu_item_deleted', onMenuItemDeleted)
    }

    // Product price changed
    if (onPriceChanged) {
      socket.on('product_price_changed', onPriceChanged)
    }

    // Menu item availability changed
    if (onAvailabilityChanged) {
      socket.on('menu_item_availability_changed', onAvailabilityChanged)
    }

    // Menu category updated
    if (onCategoryUpdated) {
      socket.on('menu_category_updated', onCategoryUpdated)
    }

    // Menu category deleted
    if (onCategoryDeleted) {
      socket.on('menu_category_deleted', onCategoryDeleted)
    }

    // Clean up event listeners when component unmounts
    return () => {
      if (onMenuUpdated) socket.off('menu_updated', onMenuUpdated)
      if (onMenuItemCreated) socket.off('menu_item_created', onMenuItemCreated)
      if (onMenuItemUpdated) socket.off('menu_item_updated', onMenuItemUpdated)
      if (onMenuItemDeleted) socket.off('menu_item_deleted', onMenuItemDeleted)
      if (onPriceChanged) socket.off('product_price_changed', onPriceChanged)
      if (onAvailabilityChanged) socket.off('menu_item_availability_changed', onAvailabilityChanged)
      if (onCategoryUpdated) socket.off('menu_category_updated', onCategoryUpdated)
      if (onCategoryDeleted) socket.off('menu_category_deleted', onCategoryDeleted)

      leaveVenueRoom(venueId)
    }
  }, [venueId, socket, joinVenueRoom, leaveVenueRoom, callbacks])
}
