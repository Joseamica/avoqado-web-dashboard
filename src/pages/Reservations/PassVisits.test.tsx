import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/test', venue: { timezone: 'America/Mexico_City' } }),
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/components/billing/FeatureGate', () => ({
  FeatureGate: ({ feature, children }: { feature: string; children: ReactNode }) => (
    <div data-testid="feature-gate" data-feature={feature}>
      {children}
    </div>
  ),
}))
const passesAccess = vi.hoisted(() => ({
  current: { hasFeature: true, tierLoading: false, resolved: true, unresolved: false, enabled: true },
}))
// Proveedores con conexión (status ≠ null): sólo ellos se ofrecen en el filtro (H6: Wellhub no se presenta como activo).
const connected = vi.hoisted(() => ({ providers: ['TOTALPASS', 'WELLHUB'] as string[] }))
vi.mock('@/hooks/use-passes', () => ({
  usePassesAccess: () => passesAccess.current,
  usePassIntegrationsOverview: () => ({
    data: {
      planActive: true,
      connections: ['TOTALPASS', 'WELLHUB'].map(provider => ({
        provider,
        status: connected.providers.includes(provider) ? 'ACTIVE' : null,
      })),
      classProducts: { items: [], total: 0 },
    },
  }),
}))
const listProps = vi.hoisted(() => ({ last: null as null | Record<string, unknown> }))
vi.mock('./components/passes/PassVisitsList', () => ({
  PassVisitsList: (props: Record<string, unknown>) => {
    listProps.last = props
    return <div data-testid="visits-list">{String(props.tab)}</div>
  },
}))

vi.mock('./components/passes/PassVisitsSummary', () => ({
  PassVisitsSummary: ({ venueId }: { venueId: string }) => <div data-testid="visits-summary">{venueId}</div>,
}))

import PassVisits from './PassVisits'

/** Muestra el hash de la URL: la pestaña elegida tiene que quedar ahí (sobrevive a recargar y se puede compartir). */
function HashProbe() {
  return <div data-testid="hash">{useLocation().hash}</div>
}

function renderPage(hash = '') {
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[`/venues/test/reservations/passes${hash}`]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <PassVisits />
        <HashProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  passesAccess.current = { hasFeature: true, tierLoading: false, resolved: true, unresolved: false, enabled: true }
  listProps.last = null
  connected.providers = ['TOTALPASS', 'WELLHUB']
})

describe('PassVisits (Pantalla B)', () => {
  it('vive dentro de <FeatureGate feature="AGGREGATOR_PASSES"> y arranca en Pendientes', () => {
    renderPage()
    expect(screen.getByTestId('feature-gate')).toHaveAttribute('data-feature', 'AGGREGATOR_PASSES')
    expect(screen.getByTestId('visits-list')).toHaveTextContent('pending')
    expect(listProps.last).toMatchObject({ venueId: 'v1', provider: null, dateRange: { from: null, to: null } })
  })

  // Tarea 9: el reporte del mes va ARRIBA de los filtros y de la lista.
  it('monta el reporte del mes de la sucursal arriba de los filtros', () => {
    renderPage()
    const summary = screen.getByTestId('visits-summary')
    expect(summary).toHaveTextContent('v1')
    expect(summary.compareDocumentPosition(screen.getByRole('button', { name: 'visits.filters.date' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(summary.compareDocumentPosition(screen.getByTestId('visits-list')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // Pestañas píldora en hash.
  it('lee la pestaña del hash y cambiarla escribe el hash', async () => {
    const user = userEvent.setup()
    renderPage('#expired')
    expect(screen.getByTestId('visits-list')).toHaveTextContent('expired')
    await user.click(screen.getByRole('tab', { name: 'visits.tabs.rejected' }))
    expect(screen.getByTestId('visits-list')).toHaveTextContent('rejected')
    expect(screen.getByTestId('hash')).toHaveTextContent('#rejected')
    expect(screen.getByRole('tab', { name: 'visits.tabs.rejected' })).toHaveClass(/rounded-full/)
  })

  it('un hash inválido cae a Pendientes', () => {
    renderPage('#lo-que-sea')
    expect(screen.getByTestId('visits-list')).toHaveTextContent('pending')
  })

  // P1-2: la consulta del plan falló: se dice y se pide recargar; la lista (y sus peticiones) no se monta.
  it('si el plan no pudo comprobarse ⇒ aviso «recarga la página» y la lista no se monta', () => {
    passesAccess.current = { hasFeature: true, tierLoading: false, resolved: false, unresolved: true, enabled: false }
    renderPage()
    expect(screen.getByText('errors.planUnresolved')).toBeInTheDocument()
    expect(screen.queryByTestId('visits-list')).not.toBeInTheDocument()
    expect(screen.queryByTestId('visits-summary')).not.toBeInTheDocument()
  })

  // H7: lo elegido en los filtros llega a la lista (y de ahí a la consulta: PassVisitsList.test).
  it('el proveedor y los días elegidos llegan a la lista (AAAA-MM-DD, tal cual)', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'visits.filters.provider' }))
    await user.click(await screen.findByRole('button', { name: 'providers.WELLHUB' }))
    expect(listProps.last).toMatchObject({ provider: 'WELLHUB' })

    await user.click(screen.getByRole('button', { name: 'visits.filters.date' }))
    fireEvent.change(await screen.findByLabelText('visits.filters.dateFrom'), { target: { value: '2030-01-10' } })
    fireEvent.change(screen.getByLabelText('visits.filters.dateTo'), { target: { value: '2030-01-12' } })
    await user.click(screen.getByRole('button', { name: 'visits.filters.apply' }))
    expect(listProps.last).toMatchObject({ provider: 'WELLHUB', dateRange: { from: '2030-01-10', to: '2030-01-12' } })
  })

  // H6: con un solo proveedor conectado (hoy, TotalPass) no se ofrece un filtro de proveedor con Wellhub como si funcionara.
  it('con sólo TotalPass conectado no hay filtro de proveedor', () => {
    connected.providers = ['TOTALPASS']
    renderPage()
    expect(screen.queryByRole('button', { name: 'visits.filters.provider' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'visits.filters.date' })).toBeInTheDocument()
  })
})
