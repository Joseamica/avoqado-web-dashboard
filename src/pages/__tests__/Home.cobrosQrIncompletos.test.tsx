/**
 * D15 (16-nov-2026): Inicio mostraba como completo un total al que le faltaban cobros del sistema anterior de QR (Mindform).
 * El servidor ahora marca `legacyUnavailable`; Inicio avisa si la marca viene en el periodo ACTUAL o en el de COMPARACIÓN
 * (Codex r1 #5: con el anterior a medias, el «+40 %» es engañoso aunque las ventas de hoy estén completas).
 *
 * Mismo arnés que Home.falloDeCarga.test.tsx: el hook `useDashboardData` es el de verdad; sólo se finge la red.
 */
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  navegaciones: 0,
  navegar: () => {
    m.navegaciones++
  },
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
vi.mock('@/components/home/PerformanceChart', () => ({
  PerformanceChart: ({ ocultarComparacion }: { ocultarComparacion?: boolean }) => <div data-testid="grafica" data-sin-comparacion={String(!!ocultarComparacion)} />,
}))
vi.mock('react-router-dom', async importOriginal => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => m.navegar,
}))
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
const AVISO = 'loadFailure.legacyQr'

const ventas = { summary: { totalAmount: 1000, totalTips: 0, avgTipPercentage: 0, totalTransactions: 3 }, payments: [], reviews: [] }
const incompletas = { ...ventas, legacyUnavailable: true }

beforeEach(() => {
  onlineManager.setOnline(true)
  m.actual = () => Promise.resolve(ventas)
  m.compara = () => Promise.resolve(ventas)
  m.calendario = () => Promise.resolve({ data: [] })
  m.puedeLiquidacion = true
})
afterEach(() => {
  client?.clear()
  onlineManager.setOnline(true)
})

describe('Inicio con cobros QR incompletos', () => {
  it('🔴 el periodo actual viene marcado: avisa, y las ventas que sí llegaron siguen a la vista', async () => {
    m.actual = () => Promise.resolve(incompletas)
    pintar()
    await screen.findByText(AVISO)
    expect(ventasNetas()).toBeInTheDocument()
    expect(document.body.textContent).toMatch(/1,000/)
  })

  it('🔴 sólo el periodo de COMPARACIÓN viene marcado: también avisa', async () => {
    m.compara = () => Promise.resolve(incompletas)
    pintar()
    await screen.findByText(AVISO)
    expect(ventasNetas()).toBeInTheDocument()
  })

  it('con los dos periodos sanos no hay aviso', async () => {
    pintar()
    await waitFor(() => expect(ventasNetas()).toBeInTheDocument())
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(screen.queryByText(AVISO)).toBeNull()
  })

  it('«Reintentar» vuelve a leer los dos periodos y, si ya llegan completos, el aviso se va', async () => {
    let puenteSano = false
    const releidos = { actual: 0, compara: 0 }
    m.actual = () => {
      if (puenteSano) releidos.actual++
      return Promise.resolve(puenteSano ? ventas : incompletas)
    }
    m.compara = () => {
      if (puenteSano) releidos.compara++
      return Promise.resolve(ventas)
    }
    pintar()
    const aviso = await screen.findByText(AVISO)

    puenteSano = true
    fireEvent.click(aviso.closest('[role="alert"]')!.querySelector('button')!)

    await waitFor(() => expect(screen.queryByText(AVISO)).toBeNull())
    expect(releidos.actual).toBeGreaterThan(0)
    expect(releidos.compara).toBeGreaterThan(0)
  })
})
