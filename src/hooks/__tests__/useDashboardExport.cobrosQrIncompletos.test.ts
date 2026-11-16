/**
 * D15 (Codex r1 #4 y #5): el archivo de Inicio dice cuándo le pueden faltar cobros del sistema anterior de QR.
 *
 * Dos caminos, y ninguno depende del otro:
 *  - las tarjetas cargaron sanas y el puente falla DESPUÉS, mientras se descarga el detalle (la marca llega con sus páginas);
 *  - la marca ya venía con las tarjetas, del periodo actual o del de comparación (`cobrosQrIncompletos`).
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDashboardExport } from '../useDashboardExport'

const detalle = vi.hoisted(() => ({ pagosMarcados: false }))

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (v: string) => v }) }))
vi.mock('@/services/dashboard.progressive.service', () => ({
  DashboardProgressiveService: class {
    getAllBasicMetricDetails(kind: string) {
      const filas = kind === 'payments' ? [{ id: 'p1', amount: 100, method: 'CASH', createdAt: '2026-11-01T18:00:00.000Z' }] : []
      return Promise.resolve(kind === 'payments' && detalle.pagosMarcados ? Object.assign(filas, { legacyUnavailable: true }) : filas)
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
  detalle.pagosMarcados = false
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
  comparacionLista: true,
  comparisonLabel: 'ayer',
  compareAmount: 0,
  compareFiveStarReviews: 0,
  compareTipStats: { totalTips: 0, avgTipPercentage: 0 },
  amountChangePercentage: 100,
  reviewsChangePercentage: 0,
  tipsChangePercentage: 0,
  tipAvgChangePercentage: 0,
}

async function exportar(formato: 'json' | 'csv', props: Record<string, unknown> = {}) {
  const { result } = renderHook(() => useDashboardExport({ ...base, ...props } as never))
  await act(() => (formato === 'json' ? result.current.exportToJSON() : result.current.exportToCSV()))
  return archivo
}

const AVISO = 'common:loadFailure.legacyQr'

describe('exportar Inicio con cobros QR incompletos', () => {
  it('🔴 tarjetas sanas y una página del detalle marcada: el JSON lo dice', async () => {
    detalle.pagosMarcados = true
    const json = JSON.parse(await exportar('json'))
    expect(json.metadata.legacyUnavailable).toBe(true)
    expect(json.metadata.warning).toBe(AVISO)
    expect(json.payments).toHaveLength(1) // lo que sí llegó se exporta igual
  })

  it('🔴 tarjetas sanas y una página del detalle marcada: el CSV empieza con la advertencia', async () => {
    detalle.pagosMarcados = true
    const csv = await exportar('csv')
    expect(csv.split('\n')[0]).toBe(`# ${AVISO}`)
    expect(csv).toContain('"p1"')
  })

  it('🔴 la marca venía con las tarjetas (periodo actual o de comparación): los dos archivos lo dicen', async () => {
    expect(JSON.parse(await exportar('json', { cobrosQrIncompletos: true })).metadata.legacyUnavailable).toBe(true)
    expect((await exportar('csv', { cobrosQrIncompletos: true })).split('\n')[0]).toBe(`# ${AVISO}`)
  })

  it('con todo sano ningún archivo menciona el aviso', async () => {
    const json = JSON.parse(await exportar('json'))
    expect(json.metadata).not.toHaveProperty('legacyUnavailable')
    expect(json.metadata).not.toHaveProperty('warning')
    expect(await exportar('csv')).not.toContain(AVISO)
  })
})
