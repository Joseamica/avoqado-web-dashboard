// src/pages/Delivery/components/DeliveryTeaser.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

// useAccess mock — controls `can('delivery-channels:request')` per test.
const mockCan = vi.fn((_perm: string) => true)
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: mockCan }) }))

// Stub the dialog so this test stays focused on the CTA gating (no QueryClient/service needed).
vi.mock('./RequestActivationDialog', () => ({
  RequestActivationDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="request-dialog" /> : null),
}))

import { DeliveryTeaser } from './DeliveryTeaser'

beforeEach(() => {
  vi.clearAllMocks()
  mockCan.mockReturnValue(true)
})

describe('DeliveryTeaser', () => {
  it('con delivery-channels:request → muestra el botón "Solicitar activación", sin hint; abre el dialog al click', () => {
    mockCan.mockReturnValue(true)
    render(<DeliveryTeaser venueId="venue-1" />)

    const cta = screen.getByText('teaser.cta')
    expect(cta).toBeInTheDocument()
    expect(screen.queryByText('teaser.needsAdmin')).not.toBeInTheDocument()

    fireEvent.click(cta)
    expect(screen.getByTestId('request-dialog')).toBeInTheDocument()
  })

  it('sin delivery-channels:request (MANAGER) → sin botón, muestra el hint, pero conserva el copy de venta', () => {
    mockCan.mockImplementation((perm: string) => perm !== 'delivery-channels:request')
    render(<DeliveryTeaser venueId="venue-1" />)

    expect(screen.queryByText('teaser.cta')).not.toBeInTheDocument()
    expect(screen.getByText('teaser.needsAdmin')).toBeInTheDocument()
    // El copy de venta sigue visible (la página no deja de ser descubrible para el MANAGER).
    expect(screen.getByText('teaser.title')).toBeInTheDocument()
    expect(screen.getByText('teaser.description')).toBeInTheDocument()
    // Y sin botón, el dialog nunca se monta.
    expect(screen.queryByTestId('request-dialog')).not.toBeInTheDocument()
  })
})
