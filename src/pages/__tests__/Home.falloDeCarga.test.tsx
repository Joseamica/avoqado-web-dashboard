/**
 * Inicio decía «Ventas netas $0» y «Liquidación de hoy $0» con el servidor caído: al dueño le parecía que no vendió nada.
 * Cada fuente se protege por separado y los filtros siguen a la mano. Un negocio de verdad en cero se ve igual que hoy.
 */
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configure, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** La red fingida. El hook `useDashboardData` es el de verdad: pide el periodo actual y el de comparación por separado. */
const m = vi.hoisted(() => ({
  actual: (() => Promise.resolve({})) as () => Promise<unknown>,
  compara: (() => Promise.resolve({})) as () => Promise<unknown>,
  calendario: (() => Promise.resolve({ data: [] })) as () => Promise<unknown>,
  puedeLiquidacion: true,
  ANIO_COMPARA: 2020,
}))
vi.mock('@/services/dashboard.progressive.service', () => ({
  DashboardProgressiveService: class {
    getBasicMetrics(rango: { from: Date }) {
      return rango.from.getUTCFullYear() === m.ANIO_COMPARA ? m.compara() : m.actual()
    }
  },
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ activeVenue: { id: 'v1', timezone: 'America/Mexico_City' } }) }))
vi.mock('@/hooks/use-socket-events', () => ({ useSocketEvents: () => undefined }))
vi.mock('@/services/availableBalance.service', () => ({
  getSettlementCalendar: () => m.calendario(),
  TransactionCardType: {},
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x', venue: { name: 'Mi negocio' } }) }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useVenueTier: () => ({ hasFeatureAccess: () => true }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ role: 'OWNER', can: (p: string) => p !== 'settlements:read' || m.puedeLiquidacion }) }))
vi.mock('@/utils/datetime', async importOriginal => {
  const rango = (anio: number) => ({ from: new Date(Date.UTC(anio, 9, 1)), to: new Date(Date.UTC(anio, 9, 2)) })
  return {
    ...(await importOriginal<typeof import('@/utils/datetime')>()),
    useVenueDateTime: () => ({ venueTimezone: 'America/Mexico_City' }),
    getToday: () => rango(2026),
    getLast30Days: () => rango(2026),
    getLast7Days: () => rango(2026),
    getYesterday: () => rango(2020),
    getPreviousPeriod: () => rango(2020),
  }
})
vi.mock('@/utils/dashboard-comparison', () => ({ buildCompareOptions: () => [], detectRangeKind: () => 'day' }))
vi.mock('@/components/KYCStatusBanner', () => ({ KYCStatusBanner: () => null }))
vi.mock('@/components/home/McpAnnouncementBanner', () => ({ McpAnnouncementBanner: () => null }))
vi.mock('@/components/home/McpConnectCard', () => ({ McpConnectCard: () => null }))
vi.mock('@/components/announcements/AnnouncementBanner', () => ({ AnnouncementBanner: () => null }))
vi.mock('@/components/onboarding/HomeSetupChecklist', () => ({ HomeSetupChecklist: () => null }))
vi.mock('@/components/onboarding/PaymentActivationCard', () => ({ PaymentActivationCard: () => null }))
vi.mock('@/components/home/HomeDatePicker', () => ({ HomeDatePicker: () => <div data-testid="filtro-fechas" /> }))
vi.mock('@/components/home/PerformanceChart', () => ({ PerformanceChart: () => <div data-testid="grafica" /> }))
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }),
  Trans: () => null,
}))

import Home from '../Home'

vi.setConfig({ testTimeout: 30_000 })
configure({ asyncUtilTimeout: 10_000 })

let client: QueryClient
function pintar() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
const ventasNetas = () => screen.queryByText('newHome.performance.netSales')
const liquidacion = () => screen.getByText('newHome.side.todaySettlement').closest('[role="button"]') as HTMLElement

const ventas = { summary: { totalAmount: 1000, totalTips: 0, avgTipPercentage: 0, totalTransactions: 3 }, payments: [], reviews: [] }

beforeEach(() => {
  onlineManager.setOnline(true)
  m.actual = () => Promise.resolve({ payments: [], reviews: [] })
  m.compara = () => Promise.resolve({ payments: [], reviews: [] })
  m.calendario = () => Promise.resolve({ data: [] })
  m.puedeLiquidacion = true
})
afterEach(() => {
  client?.clear()
  onlineManager.setOnline(true)
})

describe('Inicio si falla la carga', () => {
  it('ventas caídas: avisa en vez de «$0», y los filtros siguen a la mano', async () => {
    m.actual = () => Promise.reject(new Error('500'))
    pintar()
    await screen.findByText('loadFailure.empty')
    expect(ventasNetas()).toBeNull()
    expect(screen.queryByText('newHome.performance.details.grossSales')).toBeNull()
    expect(screen.getByTestId('filtro-fechas')).toBeInTheDocument()
  })

  it('sin internet: lo mismo, y vuelve solo al regresar la red', async () => {
    onlineManager.setOnline(false)
    pintar()
    await screen.findAllByText('loadFailure.empty')
    expect(ventasNetas()).toBeNull()
    onlineManager.setOnline(true)
    await waitFor(() => expect(ventasNetas()).toBeInTheDocument())
  })

  it('mientras carga no dice $0', async () => {
    m.actual = () => new Promise(() => {})
    m.calendario = () => new Promise(() => {})
    pintar()
    expect(ventasNetas()).toBeNull()
    expect(liquidacion().textContent).not.toMatch(/\$0/)
  })

  it('un negocio de verdad en cero se ve igual que hoy: «$0» y sin aviso', async () => {
    pintar()
    await waitFor(() => expect(ventasNetas()).toBeInTheDocument())
    await waitFor(() => expect(liquidacion().textContent).toMatch(/\$0/))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('liquidación caída: no dice $0 y las ventas que sí llegaron siguen', async () => {
    m.calendario = () => Promise.reject(new Error('500'))
    m.actual = () => Promise.resolve(ventas)
    pintar()
    await waitFor(() => expect(ventasNetas()).toBeInTheDocument())
    await waitFor(() => expect(liquidacion().textContent).toMatch(/loadFailure\.empty/))
    expect(liquidacion().textContent).not.toMatch(/\$0/)
    expect(document.body.textContent).toMatch(/1,000/)
  })

  it('sin permiso de liquidaciones no se inventa una tarjeta en $0', async () => {
    m.puedeLiquidacion = false
    pintar()
    await waitFor(() => expect(ventasNetas()).toBeInTheDocument())
    expect(screen.queryByText('newHome.side.todaySettlement')).toBeNull()
  })

  it('comparación caída: las ventas siguen, avisa que no compara y no inventa un +100 %', async () => {
    m.actual = () => Promise.resolve(ventas)
    m.compara = () => Promise.reject(new Error('500'))
    pintar()
    await screen.findByText('newHome.performance.compareFailed')
    expect(ventasNetas()).toBeInTheDocument()
    expect(document.body.textContent).toMatch(/1,000/)
    expect(document.body.textContent).not.toMatch(/100\s?%/)
  })
})
