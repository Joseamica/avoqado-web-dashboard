/**
 * D15 (Codex r1 #2): el adaptador de «Métodos de pago» reconstruía la respuesta del Resumen de ventas (`dateRange`, `methods`,
 * `totals`) y tiraba `legacyUnavailable`. La pantalla guardaba 5 min unas cifras parciales sin aviso.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getMock = vi.fn()
vi.mock('@/api', () => ({ default: { get: (...args: unknown[]) => getMock(...args) } }))

import { fetchPaymentMethods } from '@/services/reports/paymentMethods.service'

const RANGO = { venueId: 'v1', startDate: '2026-10-01T06:00:00.000Z', endDate: '2026-11-01T05:59:59.999Z' }
const resumen = (extra: Record<string, unknown> = {}) => ({
  data: {
    success: true,
    data: {
      dateRange: { startDate: RANGO.startDate, endDate: RANGO.endDate },
      summary: { refunds: 0, tips: 10, platformFees: 0, totalCollected: 110, transactionCount: 1 },
      byPaymentMethodDetailed: [{ bucket: 'CASH', amount: 110, count: 1, percentage: 100, tips: 10, refunds: 0, platformFees: 0 }],
      ...extra,
    },
  },
})

describe('fetchPaymentMethods', () => {
  beforeEach(() => getMock.mockReset())

  it('🔴 conserva la marca de cobros QR incompletos', async () => {
    getMock.mockResolvedValueOnce(resumen({ legacyUnavailable: true }))

    const reporte = await fetchPaymentMethods(RANGO)

    expect(reporte.legacyUnavailable).toBe(true)
    expect(reporte.totals.collected).toBe(110) // las cifras que sí llegaron siguen
  })

  it('sin la marca, la respuesta queda como siempre', async () => {
    getMock.mockResolvedValueOnce(resumen())

    const reporte = await fetchPaymentMethods(RANGO)

    expect(reporte).not.toHaveProperty('legacyUnavailable')
    expect(reporte).toEqual({
      dateRange: { startDate: RANGO.startDate, endDate: RANGO.endDate },
      methods: [{ bucket: 'CASH', amount: 110, count: 1, percentage: 100, tips: 10, refunds: 0, platformFees: 0, subRows: [] }],
      totals: { collected: 110, transactions: 1, tips: 10, refunds: 0, platformFees: 0 },
    })
  })
})
