/** Si no se pudo leer el periodo anterior, el archivo no declara «ventas anteriores $0 y +100 %» (Codex r2). */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDashboardExport } from '../useDashboardExport'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (v: string) => v }) }))
vi.mock('@/services/dashboard.progressive.service', () => ({
  DashboardProgressiveService: class {
    getAllBasicMetricDetails() {
      return Promise.resolve([])
    }
  },
}))

let archivo = ''
class BlobFalso {
  constructor(partes: string[]) {
    archivo = partes.join('')
  }
}
beforeEach(() => {
  archivo = ''
  vi.stubGlobal('Blob', BlobFalso)
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x' })
})

const base = {
  venueId: 'v1',
  selectedRange: { from: new Date('2026-11-01'), to: new Date('2026-11-02') },
  basicData: {},
  filteredPayments: [],
  filteredReviews: [],
  paymentMethodsData: [],
  totalAmount: 250,
  fiveStarReviews: 0,
  tipStats: { totalTips: 0, avgTipPercentage: 0 },
  compareType: 'day',
  comparisonLabel: 'ayer',
  compareAmount: 0,
  compareFiveStarReviews: 0,
  compareTipStats: { totalTips: 0, avgTipPercentage: 0 },
  amountChangePercentage: 100,
  reviewsChangePercentage: 0,
  tipsChangePercentage: 0,
  tipAvgChangePercentage: 0,
}

async function exportar(props: Record<string, unknown>) {
  const { result } = renderHook(() => useDashboardExport(props as never))
  await act(() => result.current.exportToJSON())
  return JSON.parse(archivo)
}

describe('exportar con la comparación', () => {
  it('caída: el archivo no trae comparación', async () => {
    expect((await exportar({ ...base, comparacionCaida: true })).comparison).toBeNull()
  })
  it('sana: sigue igual', async () => {
    expect((await exportar({ ...base, comparacionCaida: false })).comparison.percentageChanges.sales).toBe(100)
  })
})
