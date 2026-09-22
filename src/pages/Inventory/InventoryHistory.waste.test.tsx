import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import es from '@/locales/es/inventory.json'
import type { GlobalInventoryMovement } from '@/services/inventory.service'
import InventoryHistory from './InventoryHistory'

/**
 * Historial global con mermas de la fase 1 del servidor:
 *  - una merma con folio muestra el costo del LOTE (−$8.00) y su motivo por código;
 *  - con costo desconocido dice «Sin valorar» (antes: «-», y el filtro inventaba costo actual);
 *  - el «sin existencia» del folio sale en su primer renglón;
 *  - una merma VIEJA (sin folio) se ve como siempre.
 */
const t = (key: string | string[], opts?: Record<string, unknown>) => {
  if (typeof key !== 'string') return String(key)
  const raw = key.split('.').reduce<any>((o, k) => o?.[k], es)
  if (typeof raw !== 'string') return (opts?.defaultValue as string | undefined) ?? key
  return raw.replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts?.[k] ?? ''))
}
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', venue: { name: 'Café' } }) }))
vi.mock('@/hooks/use-unit-translation', () => ({ useUnitTranslation: () => ({ formatUnitWithQuantity: () => '' }) }))
vi.mock('@/hooks/useHistoryReviewTour', () => ({ useHistoryReviewTour: () => ({ start: () => {} }) }))
vi.mock('@/components/onboarding/TourDiscoveryBanner', () => ({ TourDiscoveryBanner: () => null }))
vi.mock('@/hooks/useDebounce', () => ({ useDebounce: (v: unknown) => v }))
const getGlobalMovements = vi.fn()
vi.mock('@/services/inventory.service', async importOriginal => {
  const mod = await importOriginal<typeof import('@/services/inventory.service')>()
  return { ...mod, inventoryHistoryApi: { getGlobalMovements: (...a: unknown[]) => getGlobalMovements(...a) } }
})

const base = {
  sku: 'SKU',
  category: 'INGREDIENT' as const,
  unit: 'KILOGRAM',
  cost: 100,
  unitCost: null,
  supplier: null,
  reference: null,
  createdBy: null,
  createdAt: '2026-09-21T18:00:00.000Z',
}
const filas = [
  { ...base, id: 'm1', itemName: 'Aguacate', type: 'SPOILAGE', quantity: -3, previousStock: 3, newStock: 0, reason: 'Caducó: caja', totalCost: -8, wasteReportId: 'r1', wasteReasonCode: 'EXPIRED', wasteUnrecorded: 2 },
  { ...base, id: 'm2', itemName: 'Coca', category: 'PRODUCT', type: 'LOSS', quantity: -1, previousStock: 5, newStock: 4, reason: 'Se cayó / derramó', totalCost: null, wasteReportId: 'r2', wasteReasonCode: 'DROPPED', wasteUnrecorded: null },
  { ...base, id: 'm3', itemName: 'Harina', type: 'SPOILAGE', quantity: -3, previousStock: 10, newStock: 7, reason: 'Expired', totalCost: -15, wasteReportId: null, wasteReasonCode: null, wasteUnrecorded: null },
] as unknown as GlobalInventoryMovement[]

function renderPage() {
  getGlobalMovements.mockResolvedValue({ data: { data: filas, meta: { total: 3, page: 1, limit: 50 } } })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <InventoryHistory />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
const fila = async (nombre: string) => within((await screen.findByText(nombre)).closest('tr') as HTMLElement)

describe('InventoryHistory — mermas con folio', () => {
  it('muestra el costo del lote, el motivo por código y el «sin existencia»', async () => {
    renderPage()
    const r = await fila('Aguacate')
    expect(r.getByText(/−\$8\.00/)).toBeInTheDocument()
    expect(r.getByText(/caducó/)).toBeInTheDocument()
    expect(r.getByText('+2 sin existencia')).toBeInTheDocument()
  })

  it('sin costo conocido dice «Sin valorar», nunca $0', async () => {
    renderPage()
    const r = await fila('Coca')
    expect(r.getByText('Sin valorar')).toBeInTheDocument()
    expect(r.queryByText(/\$0\.00/)).toBeNull()
  })

  it('una merma vieja (sin folio) se ve como siempre: sin costo y sin «Sin valorar»', async () => {
    renderPage()
    const r = await fila('Harina')
    expect(r.queryByText('Sin valorar')).toBeNull()
    expect(r.queryByText(/\$15\.00/)).toBeNull()
  })
})
