// src/pages/Delivery/DeliveryPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { DeliveryState } from '@/hooks/use-delivery-status'
import type { DeliveryActivationRequest, DeliveryChannelLink } from '@/types/delivery'

// ---------------------------------------------------------------------------
// useDeliveryStatus mock — controls which of the 4 states DeliveryPage sees per test.
// ---------------------------------------------------------------------------
const mockUseDeliveryStatus = vi.fn()
vi.mock('@/hooks/use-delivery-status', () => ({
  useDeliveryStatus: () => mockUseDeliveryStatus(),
}))

vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'venue-1', fullBasePath: '/venues/test' }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

// FeatureGate is unit-tested on its own (FeatureGate.test.tsx). Here we only need to prove
// DeliveryPage wraps ALL of its content in it with the right feature code — LOCKED is FeatureGate's
// job (blur + paywall card), not a branch DeliveryPage itself special-cases.
vi.mock('@/components/billing/FeatureGate', () => ({
  FeatureGate: ({ feature, children }: { feature: string; children: ReactNode }) => (
    <div data-testid="feature-gate" data-feature={feature}>
      {children}
    </div>
  ),
}))

// Sub-components are presentational (less test coverage per task-6 brief) — stubbed here so this
// file stays a pure orchestration test: "does DeliveryPage pick the right one for the state".
vi.mock('./components/DeliveryTeaser', () => ({
  DeliveryTeaser: ({ venueId }: { venueId: string }) => <div data-testid="delivery-teaser">teaser-{venueId}</div>,
}))
vi.mock('./components/DeliveryPending', () => ({
  DeliveryPending: ({ request }: { request: DeliveryActivationRequest }) => (
    <div data-testid="delivery-pending">pending-{request.id}</div>
  ),
}))
vi.mock('./components/DeliveryLivePanel', () => ({
  DeliveryLivePanel: ({ venueId, channels }: { venueId: string; channels: DeliveryChannelLink[] }) => (
    <div data-testid="delivery-live">
      live-{venueId}-{channels.length}
    </div>
  ),
}))

import DeliveryPage from './DeliveryPage'

function mockStatus(
  overrides: Partial<{
    state: DeliveryState
    channels: DeliveryChannelLink[]
    activationRequest: DeliveryActivationRequest | null
    isLoading: boolean
  }> = {},
) {
  mockUseDeliveryStatus.mockReturnValue({
    state: 'TEASER',
    channels: [],
    activationRequest: null,
    isLoading: false,
    ...overrides,
  })
}

function pendingRequest(overrides: Partial<DeliveryActivationRequest> = {}): DeliveryActivationRequest {
  return {
    id: 'req-1',
    venueId: 'venue-1',
    status: 'PENDING',
    requestedChannels: ['UBER_EATS'],
    note: null,
    createdAt: '2026-07-18T00:00:00.000Z',
    ...overrides,
  }
}

function activeChannel(overrides: Partial<DeliveryChannelLink> = {}): DeliveryChannelLink {
  return {
    id: 'link-1',
    venueId: 'venue-1',
    provider: 'UBER_EATS',
    status: 'ACTIVE',
    orderAcceptanceMode: 'AUTO',
    autoSyncMenu: true,
    lastMenuSyncAt: null,
    externalLocationId: 'ext-1',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DeliveryPage', () => {
  it('siempre envuelve el contenido en <FeatureGate feature="DELIVERY_CHANNELS"> — LOCKED lo intercepta ahí, no en un branch de la página', () => {
    mockStatus({ state: 'LOCKED' })
    render(<DeliveryPage />)

    const gate = screen.getByTestId('feature-gate')
    expect(gate).toHaveAttribute('data-feature', 'DELIVERY_CHANNELS')
  })

  it('isLoading=true → muestra spinner, ningún sub-componente de estado', () => {
    mockStatus({ isLoading: true })
    render(<DeliveryPage />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByTestId('delivery-teaser')).not.toBeInTheDocument()
    expect(screen.queryByTestId('delivery-pending')).not.toBeInTheDocument()
    expect(screen.queryByTestId('delivery-live')).not.toBeInTheDocument()
  })

  it('TEASER → renderiza DeliveryTeaser con el venueId actual', () => {
    mockStatus({ state: 'TEASER' })
    render(<DeliveryPage />)

    expect(screen.getByTestId('delivery-teaser')).toHaveTextContent('teaser-venue-1')
  })

  it('PENDING con activationRequest → renderiza DeliveryPending con la solicitud', () => {
    mockStatus({ state: 'PENDING', activationRequest: pendingRequest() })
    render(<DeliveryPage />)

    expect(screen.getByTestId('delivery-pending')).toHaveTextContent('pending-req-1')
    expect(screen.queryByTestId('delivery-teaser')).not.toBeInTheDocument()
  })

  it('LIVE → renderiza DeliveryLivePanel con venueId y los canales', () => {
    mockStatus({ state: 'LIVE', channels: [activeChannel()], activationRequest: pendingRequest() })
    render(<DeliveryPage />)

    expect(screen.getByTestId('delivery-live')).toHaveTextContent('live-venue-1-1')
    expect(screen.queryByTestId('delivery-pending')).not.toBeInTheDocument()
  })

  it('LOCKED (sin isLoading) cae al branch TEASER por defecto — queda como "sample content" tras el blur de FeatureGate', () => {
    mockStatus({ state: 'LOCKED' })
    render(<DeliveryPage />)

    expect(screen.getByTestId('delivery-teaser')).toBeInTheDocument()
  })

  it('PENDING pero activationRequest null (estado inconsistente defensivo) → no revienta, cae a TEASER en vez de pasar null a DeliveryPending', () => {
    mockStatus({ state: 'PENDING', activationRequest: null })
    render(<DeliveryPage />)

    expect(screen.getByTestId('delivery-teaser')).toBeInTheDocument()
    expect(screen.queryByTestId('delivery-pending')).not.toBeInTheDocument()
  })
})
