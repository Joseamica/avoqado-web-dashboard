import { useContext, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ChatReferencesContext } from '@/context/ChatReferencesContext'
import type {
  PaymentChatReference,
  OrderChatReference,
  ProductChatReference,
  RawMaterialChatReference,
  ShiftChatReference,
  ShiftReference,
} from '@/types/chat-references'
import type { Payment, Order, Product } from '@/types'
import type { RawMaterial } from '@/services/inventory.service'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'

/**
 * Hook to access and manage chat AI references
 * Includes type-specific helpers for adding common entities
 */
export function useChatReferences() {
  const context = useContext(ChatReferencesContext)
  const { t } = useTranslation()
  const { formatTime, formatDate } = useVenueDateTime()

  if (!context) {
    throw new Error('useChatReferences must be used within a ChatReferencesProvider')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENT HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  const addPayment = useCallback(
    (payment: Payment) => {
      const timeStr = formatTime(payment.createdAt)
      const dateStr = formatDate(payment.createdAt)

      const amount = Number(payment.amount) || 0
      const tipAmount = Number(payment.tipAmount) || 0
      const total = amount + tipAmount

      const label = `${Currency(total)} - ${timeStr}`

      const waiterName = payment.processedBy
        ? `${payment.processedBy.firstName} ${payment.processedBy.lastName}`
        : t('chat.references.unknown', { defaultValue: 'Desconocido' })

      const methodLabel =
        payment.method === 'CASH'
          ? t('payment:methods.cash', { defaultValue: 'Efectivo' })
          : payment.method === 'CREDIT_CARD'
            ? t('payment:methods.credit_card', { defaultValue: 'Tarjeta de Crédito' })
            : t('payment:methods.card', { defaultValue: 'Tarjeta' })

      const tipPercent = amount > 0 ? ((tipAmount / amount) * 100).toFixed(1) : '0'

      let cardInfo = ''
      if (payment.cardBrand || payment.last4) {
        cardInfo = `\n   - Tarjeta: ${payment.cardBrand || ''} ****${payment.last4 || ''}`
      }

      const summary = `PAGO #${payment.id.slice(-8)}
   - Fecha: ${dateStr}, ${timeStr}
   - Monto: ${Currency(amount)}
   - Propina: ${Currency(tipAmount)} (${tipPercent}%)
   - Método: ${methodLabel}${cardInfo}
   - Mesero: ${waiterName}
   - Total: ${Currency(total)}`

      const reference: PaymentChatReference = {
        id: payment.id,
        type: 'payment',
        label,
        summary,
        data: payment,
        addedAt: new Date(),
      }

      context.addReference(reference)
    },
    [context, t, formatTime, formatDate],
  )

  const togglePayment = useCallback(
    (payment: Payment) => {
      if (context.hasReference(payment.id)) {
        context.removeReference(payment.id)
      } else {
        addPayment(payment)
      }
    },
    [context, addPayment],
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // ORDER HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  const addOrder = useCallback(
    (order: Order) => {
      const timeStr = formatTime(order.createdAt)
      const dateStr = formatDate(order.createdAt)

      const total = Number(order.total) || 0
      const itemCount = order.items?.length || 0

      const label = `Orden ${Currency(total)} - ${timeStr}`

      const waiterName = order.servedBy
        ? `${order.servedBy.firstName} ${order.servedBy.lastName}`
        : t('chat.references.unknown', { defaultValue: 'Desconocido' })

      const statusLabel = order.status || 'UNKNOWN'

      // Build items list
      let itemsList = ''
      if (order.items && order.items.length > 0) {
        const items = order.items.slice(0, 5).map(item => `     • ${item.quantity}x ${item.product?.name || 'Producto'} - ${Currency(Number(item.total) || 0)}`)
        itemsList = `\n   - Productos:\n${items.join('\n')}`
        if (order.items.length > 5) {
          itemsList += `\n     ... y ${order.items.length - 5} productos más`
        }
      }

      const summary = `ORDEN #${order.orderNumber || order.id.slice(-8)}
   - Fecha: ${dateStr}, ${timeStr}
   - Estado: ${statusLabel}
   - Mesero: ${waiterName}
   - Items: ${itemCount} productos${itemsList}
   - Subtotal: ${Currency(Number(order.subtotal) || 0)}
   - Propina: ${Currency(Number(order.tipAmount) || 0)}
   - Total: ${Currency(total)}`

      const reference: OrderChatReference = {
        id: order.id,
        type: 'order',
        label,
        summary,
        data: order,
        addedAt: new Date(),
      }

      context.addReference(reference)
    },
    [context, t, formatTime, formatDate],
  )

  const toggleOrder = useCallback(
    (order: Order) => {
      if (context.hasReference(order.id)) {
        context.removeReference(order.id)
      } else {
        addOrder(order)
      }
    },
    [context, addOrder],
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // SHIFT HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  const addShift = useCallback(
    (shift: ShiftReference) => {
      const timeStr = formatTime(shift.startTime)
      const dateStr = formatDate(shift.startTime)

      const statusLabel = shift.status === 'ACTIVE' ? t('shifts.status.active', { defaultValue: 'Activo' }) : t('shifts.status.closed', { defaultValue: 'Cerrado' })
      const label = `${shift.staffName} - ${dateStr}`

      let endInfo = ''
      if (shift.endTime) {
        endInfo = `\n   - Fin: ${formatTime(shift.endTime)}`
      }

      const summary = `TURNO de ${shift.staffName}
   - Fecha: ${dateStr}
   - Inicio: ${timeStr}${endInfo}
   - Estado: ${statusLabel}
   - Ventas totales: ${Currency(shift.totalSales || 0)}
   - Propinas: ${Currency(shift.totalTips || 0)}
   - Órdenes: ${shift.totalOrders || 0}`

      const reference: ShiftChatReference = {
        id: shift.id,
        type: 'shift',
        label,
        summary,
        data: shift,
        addedAt: new Date(),
      }

      context.addReference(reference)
    },
    [context, t, formatTime, formatDate],
  )

  const toggleShift = useCallback(
    (shift: ShiftReference) => {
      if (context.hasReference(shift.id)) {
        context.removeReference(shift.id)
      } else {
        addShift(shift)
      }
    },
    [context, addShift],
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCT HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  const addProduct = useCallback(
    (product: Product) => {
      const price = Number(product.price) || 0
      const label = `${product.name} - ${Currency(price)}`

      const categoryName = product.category?.name || 'Sin categoría'
      const available = product.active ? 'Disponible' : 'No disponible'

      let inventoryInfo = ''
      if (product.inventoryMethod) {
        inventoryInfo = `\n   - Tipo inventario: ${product.inventoryMethod}`
        if (product.inventory?.currentStock !== undefined && product.inventory?.currentStock !== null) {
          inventoryInfo += `\n   - Stock actual: ${product.inventory.currentStock}`
        }
      }

      const summary = `PRODUCTO: ${product.name}
   - Precio: ${Currency(price)}
   - Categoría: ${categoryName}
   - Disponibilidad: ${available}${inventoryInfo}
   - Descripción: ${product.description || 'Sin descripción'}`

      const reference: ProductChatReference = {
        id: product.id,
        type: 'product',
        label,
        summary,
        data: product,
        addedAt: new Date(),
      }

      context.addReference(reference)
    },
    [context],
  )

  const toggleProduct = useCallback(
    (product: Product) => {
      if (context.hasReference(product.id)) {
        context.removeReference(product.id)
      } else {
        addProduct(product)
      }
    },
    [context, addProduct],
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // RAW MATERIAL (INVENTORY) HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  const addRawMaterial = useCallback(
    (material: RawMaterial) => {
      const costPerUnit = Number(material.costPerUnit) || 0
      const currentStock = Number(material.currentStock) || 0
      const label = `${material.name} - ${currentStock} ${material.unit}`

      const isLowStock = material.minimumStock && currentStock <= material.minimumStock

      const summary = `INGREDIENTE: ${material.name}
   - Categoría: ${material.category || 'Sin categoría'}
   - Stock actual: ${currentStock} ${material.unit}
   - Stock mínimo: ${material.minimumStock || 0} ${material.unit}
   - Costo por unidad: ${Currency(costPerUnit)}/${material.unit}
   - Estado: ${material.active ? 'Activo' : 'Inactivo'}${isLowStock ? '\n   - ⚠️ STOCK BAJO' : ''}`

      const reference: RawMaterialChatReference = {
        id: material.id,
        type: 'rawMaterial',
        label,
        summary,
        data: material,
        addedAt: new Date(),
      }

      context.addReference(reference)
    },
    [context],
  )

  const toggleRawMaterial = useCallback(
    (material: RawMaterial) => {
      if (context.hasReference(material.id)) {
        context.removeReference(material.id)
      } else {
        addRawMaterial(material)
      }
    },
    [context, addRawMaterial],
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // RETURN
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    // Base context methods
    references: context.references,
    addReference: context.addReference,
    removeReference: context.removeReference,
    clearReferences: context.clearReferences,
    hasReference: context.hasReference,
    getContextPrompt: context.getContextPrompt,
    referenceCount: context.referenceCount,

    // Payment helpers
    addPayment,
    togglePayment,

    // Order helpers
    addOrder,
    toggleOrder,

    // Shift helpers
    addShift,
    toggleShift,

    // Product helpers
    addProduct,
    toggleProduct,

    // Raw Material (Inventory) helpers
    addRawMaterial,
    toggleRawMaterial,
  }
}

// Re-export types for convenience
export type { ChatReference } from '@/types/chat-references'
