import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { PassConnectionView, PassIntegrationsOverview, PassProvider } from '@/types/passes'

type TierMock = { hasFeatureAccess: (feature: string) => boolean; isLoading: boolean; isResolved: boolean }
const tier = vi.hoisted(() => ({ current: { hasFeatureAccess: () => true, isLoading: false, isResolved: true } as TierMock }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useVenueTier: () => tier.current }))
const access = vi.hoisted(() => ({ allowed: ['reservations:read', 'reservations:manage-passes'] }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => access.allowed.includes(p) }) }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/test', venue: { timezone: 'America/Mexico_City' } }),
}))
// Todas las funciones del servicio, aunque esta prueba sólo use dos: las tarjetas de las Tareas 5-7 importan las
// demás y un export ausente en un mock de vitest truena al usarse ("No "X" export is defined on the mock").
const svc = vi.hoisted(() => ({
  getPassIntegrationsOverview: vi.fn(),
  connectTotalPass: vi.fn(),
  setPassConfirmMode: vi.fn(),
  setPassProductLinks: vi.fn(),
  disconnectPassProvider: vi.fn(),
  getPassCapacity: vi.fn(),
  setDefaultPassCap: vi.fn(),
  upsertWeeklyPassCap: vi.fn(),
  deletePassCapRule: vi.fn(),
  setSessionPassCap: vi.fn(),
  listPassVisits: vi.fn(),
  getPassVisitsSummary: vi.fn(),
  confirmPassVisit: vi.fn(),
  rejectPassVisit: vi.fn(),
}))
vi.mock('@/services/passes.service', () => svc)
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
// FeatureGate tiene su propia prueba; aquí sólo importa que TODA la página viva dentro con el código correcto.
vi.mock('@/components/billing/FeatureGate', () => ({
  FeatureGate: ({ feature, children }: { feature: string; children: ReactNode }) => (
    <div data-testid="feature-gate" data-feature={feature}>
      {children}
    </div>
  ),
}))

import PassIntegrations from './PassIntegrations'

const connection = (provider: PassProvider, available: boolean): PassConnectionView => ({
  provider,
  available,
  status: null,
  externalPlaceName: null,
  confirmMode: 'AUTO',
  lastError: null,
  plans: [],
  productLinks: [],
  updatedAt: null,
})

const OVERVIEW: PassIntegrationsOverview = {
  planActive: true,
  connections: [connection('TOTALPASS', true), connection('WELLHUB', false)],
  classProducts: { items: [{ id: 'p1', name: 'Yoga' }], total: 1 },
}

// MemoryRouter: desde la Tarea 5 la tarjeta en pausa por el plan navega a Suscripciones (useNavigate).
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PassIntegrations />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  tier.current = { hasFeatureAccess: () => true, isLoading: false, isResolved: true }
  access.allowed = ['reservations:read', 'reservations:manage-passes']
  svc.getPassIntegrationsOverview.mockResolvedValue(OVERVIEW)
})

describe('PassIntegrations (Pantalla A)', () => {
  // Sin plan la vista general SÍ se pide (R62: para saber si hay algo vivo que explicar); nada más.
  // Sin conexión no hay nada que explicar: el paywall con el teaser, como siempre.
  it('sin el plan y sin conexión ⇒ todo dentro de <FeatureGate feature="AGGREGATOR_PASSES"> con el teaser; sólo se pide la vista general', async () => {
    tier.current = { hasFeatureAccess: () => false, isLoading: false, isResolved: true }
    svc.getPassIntegrationsOverview.mockResolvedValue({ ...OVERVIEW, planActive: false })
    renderPage()
    expect(screen.getByTestId('feature-gate')).toHaveAttribute('data-feature', 'AGGREGATOR_PASSES')
    expect(await screen.findByText('teaser.title')).toBeInTheDocument()
    expect(svc.getPassIntegrationsOverview).toHaveBeenCalledWith('v1')
    expect(svc.getPassCapacity).not.toHaveBeenCalled()
    expect(svc.listPassVisits).not.toHaveBeenCalled()
    expect(screen.queryByText('wellhub.title')).not.toBeInTheDocument()
  })

  it('con el plan ⇒ carga la vista general y Wellhub aparece deshabilitado con «Próximamente»', async () => {
    renderPage()
    expect(await screen.findByText('wellhub.title')).toBeInTheDocument()
    expect(screen.getByText('common:comingSoon')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'wellhub.connect' })).toBeDisabled()
    expect(screen.queryByText('page.readOnly')).not.toBeInTheDocument()
  })

  // «Apagado se ve y se explica»: sin permiso de configurar se ve todo, con el aviso de a quién pedírselo.
  it('sin reservations:manage-passes ⇒ aviso de sólo lectura', async () => {
    access.allowed = ['reservations:read']
    renderPage()
    expect(await screen.findByText('page.readOnly')).toBeInTheDocument()
  })

  // El mensaje del server, tal cual.
  it('si la API falla ⇒ Alert con el mensaje del servidor', async () => {
    svc.getPassIntegrationsOverview.mockRejectedValue({
      response: { status: 503, data: { message: 'TotalPass no respondió. Intenta de nuevo en unos minutos.' } },
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('TotalPass no respondió. Intenta de nuevo en unos minutos.')).toBeInTheDocument(), {
      timeout: 5_000,
    })
  })

  // P1-2: la consulta del plan falló: no se adivina (fail-open) ni se pide nada; se dice y se pide recargar.
  it('si el plan no pudo comprobarse ⇒ aviso «recarga la página» y NO se consulta la API', async () => {
    tier.current = { hasFeatureAccess: () => true, isLoading: false, isResolved: false }
    renderPage()
    expect(await screen.findByText('errors.planUnresolved')).toBeInTheDocument()
    expect(svc.getPassIntegrationsOverview).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
