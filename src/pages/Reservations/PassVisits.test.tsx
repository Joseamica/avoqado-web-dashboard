import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
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
vi.mock('@/hooks/use-passes', () => ({ usePassesAccess: () => passesAccess.current }))
const listProps = vi.hoisted(() => ({ last: null as null | Record<string, unknown> }))
vi.mock('./components/passes/PassVisitsList', () => ({
  PassVisitsList: (props: Record<string, unknown>) => {
    listProps.last = props
    return <div data-testid="visits-list">{String(props.tab)}</div>
  },
}))

import PassVisits from './PassVisits'

function renderPage(hash = '') {
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[`/venues/test/reservations/passes${hash}`]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <PassVisits />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  passesAccess.current = { hasFeature: true, tierLoading: false, resolved: true, unresolved: false, enabled: true }
  listProps.last = null
})

describe('PassVisits (Pantalla B)', () => {
  it('vive dentro de <FeatureGate feature="AGGREGATOR_PASSES"> y arranca en Pendientes', () => {
    renderPage()
    expect(screen.getByTestId('feature-gate')).toHaveAttribute('data-feature', 'AGGREGATOR_PASSES')
    expect(screen.getByTestId('visits-list')).toHaveTextContent('pending')
    expect(listProps.last).toMatchObject({ venueId: 'v1', provider: null, dateRange: { from: null, to: null } })
  })

  // Pestañas píldora en hash.
  it('lee la pestaña del hash y cambiarla escribe el hash', async () => {
    const user = userEvent.setup()
    renderPage('#expired')
    expect(screen.getByTestId('visits-list')).toHaveTextContent('expired')
    await user.click(screen.getByRole('tab', { name: 'visits.tabs.rejected' }))
    expect(screen.getByTestId('visits-list')).toHaveTextContent('rejected')
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
  })
})
