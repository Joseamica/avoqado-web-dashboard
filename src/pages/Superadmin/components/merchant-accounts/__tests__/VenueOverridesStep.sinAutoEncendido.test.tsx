/**
 * D18 (Codex r4–r10): abrir el Wizard de Pagos desde una sucursal ya no enciende sola su tarifa personalizada. Encenderla
 * sola hacía que «Guardar» creara una tarifa de sucursal que nadie escribió. La persona la enciende con su switch.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/superadmin-organizations.service', () => ({
  getOrganizationById: async () => ({ id: 'org-1', venues: [{ id: 'v-a', name: 'Sucursal A', slug: 'a' }] }),
}))

import { VenueOverridesStep } from '../wizard-steps/VenueOverridesStep'

describe('VenueOverridesStep · abierto desde una sucursal', () => {
  it('lista la sucursal pero no la enciende sola', async () => {
    const dispatch = vi.fn()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <VenueOverridesStep
          state={{ venueOverrides: {}, pricing: {}, settlement: {} } as any}
          dispatch={dispatch}
          context={{ organizationId: 'org-1', orgName: 'Org', initialVenueId: 'v-a', initialVenueName: 'Sucursal A' }}
        />
      </QueryClientProvider>,
    )
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'INIT_VENUE_OVERRIDES' })))
    expect(dispatch.mock.calls.map(([a]) => a.type)).not.toContain('TOGGLE_VENUE_OVERRIDE')
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
  })
})
