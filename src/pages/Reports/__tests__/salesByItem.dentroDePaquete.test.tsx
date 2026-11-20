/**
 * «Ventas por artículo» — columnas «Dentro de paquete» y «Total» (founder «B», 20-nov-2026, Flautas Coyoacán).
 * Salen sólo por producto y cuando el periodo trae extras ligados; las columnas de siempre no cambian sus números.
 */
import i18n from '@/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SalesByItemResponse } from '@/services/reports/salesByItem.service'

const m = vi.hoisted(() => ({
  respuesta: null as unknown,
  pendiente: null as Promise<unknown> | null,
  client: null as unknown as import('@tanstack/react-query').QueryClient,
}))

vi.mock('@/services/reports/salesByItem.service', () => ({
  fetchSalesByItem: () => m.pendiente ?? Promise.resolve(m.respuesta),
  salesByItemKeys: { all: ['salesByItem'], report: (f: unknown) => ['salesByItem', 'report', f] },
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ activeVenue: { timezone: 'America/Mexico_City' } }) }))
vi.mock('@/components/billing/FeatureGate', () => ({
  FeatureGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/date-range-picker', () => ({ DateRangePicker: () => null }))
vi.mock('../components/SalesByItemChart', () => ({ SalesByItemChart: () => null }))

import SalesByItem from '../SalesByItem'

const renglon = (over: Partial<SalesByItemResponse['items'][number]> = {}) => ({
  productId: 'p-paquete',
  productName: 'Paquete 3 flautas',
  productSku: null,
  categoryName: 'Paquetes',
  unit: 'c/u',
  itemsSold: 5,
  unitsSold: 5,
  grossSales: 500,
  discounts: 0,
  netSales: 500,
  ...over,
})

function respuesta(items: SalesByItemResponse['items'], totals: SalesByItemResponse['totals']): SalesByItemResponse {
  return {
    dateRange: { startDate: '2026-11-14T06:00:00.000Z', endDate: '2026-11-21T05:59:59.999Z' },
    reportType: 'summary',
    items,
    totals,
  }
}

function montar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  m.client = client
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SalesByItem />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Ventas por artículo — «Dentro de paquete»', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('es')
  })
  beforeEach(() => {
    m.pendiente = null
    try {
      localStorage.clear() // «Mostrar por» guardado de otra prueba no debe colarse
    } catch {
      /* sin almacenamiento */
    }
  })

  it('con extras ligados: las dos columnas, sus números y el pie, sin tocar «Unidades vendidas»', async () => {
    m.respuesta = respuesta(
      [
        renglon({ unitsInsidePackages: 0, totalUnits: 5 }),
        renglon({
          productId: 'p-papa',
          productName: 'Flauta de papa',
          categoryName: 'Flautas',
          itemsSold: 4,
          unitsSold: 6,
          grossSales: 180,
          netSales: 180,
          unitsInsidePackages: 15,
          totalUnits: 21,
        }),
      ],
      { itemsSold: 9, unitsSold: 11, grossSales: 680, discounts: 0, netSales: 680, unitsInsidePackages: 15, totalUnits: 26 },
    )
    montar()

    const papa = (await screen.findByText('Flauta de papa')).closest('tr')!
    expect(screen.getByRole('button', { name: /Dentro de paquete/ })).toBeInTheDocument()
    expect(within(papa).getByTestId('dentro-de-paquete')).toHaveTextContent('15')
    expect(within(papa).getByTestId('total-de-unidades')).toHaveTextContent('21')
    // «Unidades vendidas» sigue siendo sólo lo suelto.
    expect(within(papa).getByText('6')).toBeInTheDocument()
    // Codex r1 #13: «Dentro de paquete» se ve también en pantallas angostas (explica un renglón con $0).
    expect(within(papa).getByTestId('dentro-de-paquete').className).not.toMatch(/\bhidden\b/)
    expect(within(papa).getByTestId('total-de-unidades').className).not.toMatch(/\bhidden\b/)
    // El renglón del paquete: 0 dentro de paquete se pinta como «—».
    const paquete = screen.getByText('Paquete 3 flautas').closest('tr')!
    expect(within(paquete).getByTestId('dentro-de-paquete')).toHaveTextContent('—')
    // La ayuda dice que no suma dinero y que la liga es la actual.
    const ayuda = screen.getByRole('button', { name: /No suman dinero/ })
    expect(ayuda).toHaveAccessibleName(expect.stringMatching(/liga actual del extra/))
    // El pie trae los dos totales.
    const pie = screen.getAllByText('Total').map(n => n.closest('tr')).find(tr => tr?.parentElement?.tagName === 'TFOOT')!
    expect(within(pie).getByText('26')).toBeInTheDocument()
    expect(within(pie).getByText('15')).toBeInTheDocument()
  })

  it('Codex r2 #8: mientras se recarga (p. ej. tras cambiar una liga) no se puede exportar la copia vieja', async () => {
    m.respuesta = respuesta([renglon({ unitsInsidePackages: 4, totalUnits: 9 })], {
      itemsSold: 5,
      unitsSold: 5,
      grossSales: 500,
      discounts: 0,
      netSales: 500,
      unitsInsidePackages: 4,
      totalUnits: 9,
    })
    montar()
    await screen.findByText('Paquete 3 flautas')
    const exportar = screen.getByRole('button', { name: 'Exportar CSV' })
    expect(exportar).toBeEnabled()

    let soltar!: (v: unknown) => void
    m.pendiente = new Promise(r => (soltar = r))
    await act(async () => {
      void m.client.invalidateQueries({ queryKey: ['salesByItem'] })
    })
    await waitFor(() => expect(exportar).toBeDisabled())
    m.pendiente = null
    await act(async () => soltar(m.respuesta))
    await waitFor(() => expect(exportar).toBeEnabled())
  })

  it('sin extras ligados en el periodo no aparecen (no se llena de ceros el reporte de siempre)', async () => {
    m.respuesta = respuesta([renglon({ unitsInsidePackages: 0, totalUnits: 5 })], {
      itemsSold: 5,
      unitsSold: 5,
      grossSales: 500,
      discounts: 0,
      netSales: 500,
      unitsInsidePackages: 0,
      totalUnits: 5,
    })
    montar()

    await screen.findByText('Paquete 3 flautas')
    expect(screen.queryByRole('button', { name: /Dentro de paquete/ })).not.toBeInTheDocument()
    expect(screen.queryByTestId('dentro-de-paquete')).not.toBeInTheDocument()
  })

  it('un server viejo (sin los campos) se ve como siempre', async () => {
    m.respuesta = respuesta([renglon()], { itemsSold: 5, unitsSold: 5, grossSales: 500, discounts: 0, netSales: 500 })
    montar()

    await screen.findByText('Paquete 3 flautas')
    expect(screen.queryByTestId('total-de-unidades')).not.toBeInTheDocument()
  })
})
