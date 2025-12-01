// Types for AI Chat References System
// Allows users to select data rows and add them as context for AI queries

import type { Payment, Order, Product } from '../types'
import type { RawMaterial } from '../services/inventory.service'

// Supported reference entity types (extensible)
export type ChatReferenceType = 'payment' | 'order' | 'product' | 'rawMaterial' | 'shift' | 'customer'

// Shift type (simplified for reference purposes)
export interface ShiftReference {
  id: string
  staffId: string
  staffName: string
  startTime: string
  endTime?: string | null
  status: 'ACTIVE' | 'CLOSED'
  totalSales?: number
  totalTips?: number
  totalOrders?: number
}

// Base interface for any chat reference
export interface ChatReference<T = unknown> {
  id: string
  type: ChatReferenceType
  label: string // Short display label: "Pago $150.00 - 14:30"
  summary: string // Detailed summary for AI context
  data: T // Full entity data
  addedAt: Date
}

// Type-specific references
export type PaymentChatReference = ChatReference<Payment>
export type OrderChatReference = ChatReference<Order>
export type ProductChatReference = ChatReference<Product>
export type RawMaterialChatReference = ChatReference<RawMaterial>
export type ShiftChatReference = ChatReference<ShiftReference>

// Context type for the ChatReferences provider
export interface ChatReferencesContextType {
  references: ChatReference[]
  addReference: (ref: ChatReference) => void
  removeReference: (id: string) => void
  clearReferences: () => void
  hasReference: (id: string) => boolean
  getContextPrompt: () => string // Generates structured context for AI
  referenceCount: number
}

// Maximum references allowed (to avoid token overflow)
export const MAX_CHAT_REFERENCES = 10

// Storage key pattern for localStorage persistence
export const getChatReferencesStorageKey = (venueSlug: string, userId?: string): string => {
  let key = `avoqado_chat_refs_${venueSlug}`
  if (userId) {
    key = `${key}_${userId}`
  }
  return key
}
