import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { PassConnectionView, PassIntegrationsOverview, PassProvider } from '@/types/passes'

type TierMock = { hasFeatureAccess: (feature: string) => boolean; isLoading: boolean; isResolved: boolean }
const tier = vi.hoisted(() => ({ current: { hasFeatureAccess: () => true, isLoading: false, isResolved: true } as TierMock }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useVenueTier: () => tier.current }))
const access = vi.hoisted(() => ({ allowed: ['reservations:read', 'reservations:manage-passes'] }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => access.allowed.includes(p) }) }))
// Mutable: H6 cambia de sucursal sin desmontar la página.
const venue = vi.hoisted(() => ({ id: 'v1' }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: venue.id, fullBasePath: '/venues/test', venue: { timezone: 'America/Mexico_City' } }),
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
import { passesKeys } from '@/hooks/use-passes'

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
  // Una función (no un elemento fijo): `rerender` con elementos nuevos vuelve a pintar la página tras cambiar de sucursal.
  const tree = () => (
    <QueryClientProvider client={client}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PassIntegrations />
      </MemoryRouter>
    </QueryClientProvider>
  )
  const view = render(tree())
  return { ...view, client, tree }
}

beforeEach(() => {
  tier.current = { hasFeatureAccess: () => true, isLoading: false, isResolved: true }
  venue.id = 'v1'
  access.allowed = ['reservations:read', 'reservations:manage-passes']
  svc.getPassIntegrationsOverview.mockResolvedValue(OVERVIEW)
  svc.getPassCapacity.mockResolvedValue({ defaultMaxSpots: null, weekly: [], suggestions: [] })
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
    // Tarea 7: con el plan, la sección de lugares para pases va debajo de las tarjetas.
    expect(await screen.findByText('capacity.title')).toBeInTheDocument()
    expect(svc.getPassCapacity).toHaveBeenCalledWith('v1')
    // H8: TotalPass sin conectar ⇒ las reglas esperan a la conexión, y se dice
    expect(screen.getByText('capacity.notConnected')).toBeInTheDocument()
  })

  // H9: el plan en caché dice que sí, pero el server ya no publica (planActive:false) con TotalPass vivo: la pausa manda y
  // la sección no se pinta ni pide /capacity (que contestaría 403). Con el plan en false esto pasaría aunque faltara la guarda.
  it('con el plan en caché pero planActive:false y TotalPass ACTIVE ⇒ sin sección de lugares ni /capacity', async () => {
    svc.getPassIntegrationsOverview.mockResolvedValue({
      ...OVERVIEW,
      planActive: false,
      connections: [{ ...OVERVIEW.connections[0], status: 'ACTIVE', externalPlaceName: 'Estudio Prueba' }, OVERVIEW.connections[1]],
    })
    renderPage()
    expect(await screen.findByText('totalpass.planPaused')).toBeInTheDocument()
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(screen.queryByText('capacity.title')).not.toBeInTheDocument()
    expect(svc.getPassCapacity).not.toHaveBeenCalled()
  })

  // H6: el borrador del tope general no cruza de sucursal. Con la vista general de la otra ya en caché la página no se
  // desmonta, y sin `key={venueId}` el 7 tecleado reaparecería «sucio» sobre el mismo tope (3) de la otra sucursal.
  it('cambiar de sucursal con un tope tecleado ⇒ el campo muestra el tope de la nueva sucursal', async () => {
    const user = userEvent.setup()
    svc.getPassCapacity.mockResolvedValue({ defaultMaxSpots: 3, weekly: [], suggestions: [] })
    const { client, rerender, tree } = renderPage()
    const input = await screen.findByLabelText('capacity.default.label')
    await waitFor(() => expect(input).toHaveValue(3))
    await user.clear(input)
    await user.type(input, '7')
    client.setQueryData(passesKeys.overview('v2'), OVERVIEW)
    venue.id = 'v2'
    rerender(tree())
    await waitFor(() => expect(svc.getPassCapacity).toHaveBeenCalledWith('v2'))
    await waitFor(() => expect(screen.getByLabelText('capacity.default.label')).toHaveValue(3))
    expect(screen.getByRole('button', { name: 'capacity.default.save' })).toBeDisabled()
  })

  // Revisión final, Important 1: la tarjeta de TotalPass también lleva `key={venueId}`. Sin eso la llave tecleada (un secreto)
  // y su error pasaban a la otra sucursal, y un Conectar ligaba la sucursal de TotalPass de A al negocio B.
  it('cambiar de sucursal con una llave tecleada ⇒ el campo llega vacío y sin error', async () => {
    const user = userEvent.setup()
    svc.connectTotalPass.mockRejectedValue({ response: { status: 400, data: { message: 'TotalPass no reconoce esa llave.' } } })
    const { client, rerender, tree } = renderPage()
    await user.type(await screen.findByLabelText('totalpass.keyLabel'), 'llave-de-la-sucursal-a')
    await user.click(screen.getByRole('button', { name: 'totalpass.connect' }))
    expect(await screen.findByText('TotalPass no reconoce esa llave.')).toBeInTheDocument()
    client.setQueryData(passesKeys.overview('v2'), OVERVIEW)
    venue.id = 'v2'
    rerender(tree())
    await waitFor(() => expect(screen.getByLabelText('totalpass.keyLabel')).toHaveValue(''))
    expect(screen.queryByText('TotalPass no reconoce esa llave.')).not.toBeInTheDocument()
  })

  // Revisión final, Minor 5: el server sólo aplica las reglas de lugares con la conexión ACTIVE (`passCapacity.service.ts`).
  // Un conectar a medias o una llave rechazada todavía no las aplica: la línea se dice.
  it.each([
    ['PENDING', 'HTTP_503: TotalPass HTTP 503'],
    ['REVOKED', 'El proveedor rechazó las llaves (401): hay que volver a conectar.'],
  ] as const)('con plan y TotalPass %s ⇒ «se aplican en cuanto conectes»', async (status, lastError) => {
    svc.getPassIntegrationsOverview.mockResolvedValue({
      ...OVERVIEW,
      connections: [{ ...OVERVIEW.connections[0], status, lastError, externalPlaceName: 'Estudio Prueba' }, OVERVIEW.connections[1]],
    })
    renderPage()
    expect(await screen.findByText('capacity.title')).toBeInTheDocument()
    expect(screen.getByText('capacity.notConnected')).toBeInTheDocument()
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

  // Revisión final, Minor 4: la vista general no se refresca sola; sin «Reintentar» el dueño se quedaba en el error hasta F5.
  it('si la primera carga falla ⇒ «Reintentar» la vuelve a pedir y aparece la tarjeta', async () => {
    const down = { response: { status: 503, data: { message: 'TotalPass no respondió.' } } }
    // La carga y su único reintento (retry: 1 del hook) fallan; el clic ya encuentra al servidor arriba.
    svc.getPassIntegrationsOverview.mockRejectedValueOnce(down).mockRejectedValueOnce(down).mockResolvedValue(OVERVIEW)
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'common:retry' }, { timeout: 5_000 }))
    expect(await screen.findByLabelText('totalpass.keyLabel')).toBeInTheDocument()
    expect(screen.queryByText('page.loadError')).not.toBeInTheDocument()
  }, 10_000)

  // Un conectar que falla por red recarga la vista general (H1) y esa recarga también falla: con datos ya cargados la tarjeta se
  // queda (con la llave tecleada y su mensaje); el aviso de carga es sólo para cuando nunca llegaron datos.
  it('si la recarga de la vista general falla con datos ya cargados ⇒ la tarjeta se queda con la llave tecleada', async () => {
    const user = userEvent.setup()
    const { client } = renderPage()
    const input = await screen.findByLabelText('totalpass.keyLabel')
    await user.type(input, 'llave-tecleada-0000')
    svc.getPassIntegrationsOverview.mockRejectedValue({ message: 'Network Error' })
    // La recarga termina en error (con su reintento) y el aviso a React sale en el siguiente tick del notifyManager.
    await act(async () => {
      await client.refetchQueries()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(client.getQueryState(passesKeys.overview('v1'))?.status).toBe('error')
    expect(screen.queryByText('page.loadError')).not.toBeInTheDocument()
    expect(screen.getByLabelText('totalpass.keyLabel')).toHaveValue('llave-tecleada-0000')
  }, 10_000)

  // P1-2: la consulta del plan falló: no se adivina (fail-open) ni se pide nada; se dice y se pide recargar.
  it('si el plan no pudo comprobarse ⇒ aviso «recarga la página» y NO se consulta la API', async () => {
    tier.current = { hasFeatureAccess: () => true, isLoading: false, isResolved: false }
    renderPage()
    expect(await screen.findByText('errors.planUnresolved')).toBeInTheDocument()
    expect(svc.getPassIntegrationsOverview).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  // R62 (pausa suave): sin plan y con TotalPass vivo la página NO se esconde tras el paywall.
  it('sin plan con TotalPass ACTIVE ⇒ sin paywall: aviso de pausa y Desconectar; sin modo, llave, clases ni lugares', async () => {
    tier.current = { hasFeatureAccess: () => false, isLoading: false, isResolved: true }
    svc.getPassIntegrationsOverview.mockResolvedValue({
      ...OVERVIEW,
      planActive: false,
      connections: [{ ...OVERVIEW.connections[0], status: 'ACTIVE', externalPlaceName: 'Estudio Prueba' }, OVERVIEW.connections[1]],
    })
    renderPage()
    expect(await screen.findByText('totalpass.planPaused')).toBeInTheDocument()
    expect(screen.queryByTestId('feature-gate')).not.toBeInTheDocument()
    expect(screen.getByText('Estudio Prueba')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'totalpass.disconnect' })).toBeEnabled()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('totalpass.keyLabel')).not.toBeInTheDocument()
    expect(screen.queryByText('products.title')).not.toBeInTheDocument() // clases ligadas (Tarea 6)
    expect(screen.queryByText('capacity.title')).not.toBeInTheDocument() // lugares para pases (Tarea 7)
    expect(svc.getPassCapacity).not.toHaveBeenCalled()
  })

  // R62: una REVOKED ya limpia no tiene nada vivo ⇒ como siempre, el paywall con el teaser.
  it('sin plan con TotalPass REVOKED y sin lastError ⇒ FeatureGate con el teaser, sin aviso de pausa', async () => {
    tier.current = { hasFeatureAccess: () => false, isLoading: false, isResolved: true }
    svc.getPassIntegrationsOverview.mockResolvedValue({
      ...OVERVIEW,
      planActive: false,
      connections: [
        { ...OVERVIEW.connections[0], status: 'REVOKED', externalPlaceName: 'Estudio Prueba', lastError: null },
        OVERVIEW.connections[1],
      ],
    })
    renderPage()
    expect(await screen.findByText('teaser.title')).toBeInTheDocument()
    expect(screen.getByTestId('feature-gate')).toHaveAttribute('data-feature', 'AGGREGATOR_PASSES')
    expect(screen.queryByText('totalpass.planPaused')).not.toBeInTheDocument()
  })

  // R62: con plan nada cambia: dentro del FeatureGate, con el modo y sin aviso de pausa.
  it('con plan y TotalPass ACTIVE ⇒ como hoy: dentro del FeatureGate, con el modo y sin aviso de pausa', async () => {
    svc.getPassIntegrationsOverview.mockResolvedValue({
      ...OVERVIEW,
      connections: [{ ...OVERVIEW.connections[0], status: 'ACTIVE', externalPlaceName: 'Estudio Prueba' }, OVERVIEW.connections[1]],
    })
    renderPage()
    expect(await screen.findByText('totalpass.mode.autoHint')).toBeInTheDocument()
    expect(screen.getByTestId('feature-gate')).toBeInTheDocument()
    expect(screen.queryByText('totalpass.planPaused')).not.toBeInTheDocument()
    // H8: conectada ⇒ sin la línea de «se aplican en cuanto conectes»
    expect(await screen.findByText('capacity.title')).toBeInTheDocument()
    expect(screen.queryByText('capacity.notConnected')).not.toBeInTheDocument()
  })

  // Tarea 6: la tarjeta conectada recibe las clases del negocio de la vista general y las ofrece para ligar.
  it('con plan y TotalPass ACTIVE ⇒ las clases del negocio aparecen para ligarlas a un plan', async () => {
    svc.getPassIntegrationsOverview.mockResolvedValue({
      ...OVERVIEW,
      connections: [
        {
          ...OVERVIEW.connections[0],
          status: 'ACTIVE',
          externalPlaceName: 'Estudio Prueba',
          plans: [{ id: '305', name: 'Gold', code: null }],
        },
        OVERVIEW.connections[1],
      ],
    })
    renderPage()
    expect(await screen.findByText('products.title')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Yoga' })).toHaveTextContent('products.none')
  })
})
