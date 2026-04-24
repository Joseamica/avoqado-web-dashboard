import api from '@/api'

// These must match the Prisma enums exactly (backend validates via z.nativeEnum).
// See avoqado-server/prisma/schema.prisma — `enum PaymentMethod` and `enum PaymentSource`.
export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'DIGITAL_WALLET' | 'BANK_TRANSFER' | 'CRYPTOCURRENCY' | 'OTHER'
export type PaymentSource = 'TPV' | 'DASHBOARD_TEST' | 'QR' | 'WEB' | 'APP' | 'PHONE' | 'POS' | 'SDK' | 'OTHER'

export interface CreateManualPaymentInput {
  /**
   * Optional. When omitted, the backend creates a shadow order (type
   * MANUAL_ENTRY) so the payment has something to attach to — used for
   * bookkeeping entries that never passed through Avoqado.
   */
  orderId?: string
  amount: string
  tipAmount?: string
  method: PaymentMethod
  source: PaymentSource
  externalSource?: string
  reason?: string
  /** Waiter id to whom tip / commission should be attributed. */
  waiterId?: string
  /** IVA / tax amount (only used when creating a shadow order). */
  taxAmount?: string
  /** Discount applied (only used when creating a shadow order). */
  discountAmount?: string
}

export interface ManualPaymentResult {
  id: string
  orderId: string
  amount: string
  source: PaymentSource
  externalSource: string | null
  status: string
  createdAt: string
}

export const manualPaymentService = {
  create: async (venueId: string, input: CreateManualPaymentInput): Promise<ManualPaymentResult> => {
    const res = await api.post<{ success: boolean; data: ManualPaymentResult }>(
      `/api/v1/dashboard/venues/${venueId}/payments/manual`,
      input,
    )
    return res.data.data
  },

  getExternalSources: async (venueId: string, limit = 10): Promise<string[]> => {
    const res = await api.get<{ success: boolean; data: string[] }>(
      `/api/v1/dashboard/venues/${venueId}/payments/external-sources`,
      {
        params: { limit },
      },
    )
    return res.data.data ?? []
  },

  getWaiters: async (venueId: string): Promise<WaiterOption[]> => {
    const res = await api.get<{ success: boolean; data: WaiterOption[] }>(
      `/api/v1/dashboard/venues/${venueId}/payments/waiters`,
    )
    return res.data.data ?? []
  },
}

export interface WaiterOption {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
}
