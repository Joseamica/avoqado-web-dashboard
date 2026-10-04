import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { EditClassSessionDialog } from '../components/EditClassSessionDialog'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k, i18n: { language: 'es' } }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ venueTimezone: 'America/Mexico_City' }) }))
vi.mock('../components/PagoDeClaseCard', () => ({ PagoDeClaseCard: () => <div>tarjeta de pago</div> }))
vi.mock('@/services/team.service', () => ({ teamService: { getTeamMembers: async () => ({ data: [] }) } }))
vi.mock('@/services/classSession.service', () => ({
  default: {
    getClassSession: async () => ({
      id: 's1',
      startsAt: '2026-09-28T14:00:00.000Z',
      endsAt: '2026-09-28T15:00:00.000Z',
      capacity: 12,
      enrolled: 8,
      status: 'SCHEDULED',
      assignedStaffId: null,
      internalNotes: '',
      product: { name: 'Yoga', duration: 60 },
      reservations: Array.from({ length: 8 }, (_, i) => ({ id: `r${i}`, guestName: `Cliente ${i}`, partySize: 1 })),
    }),
  },
}))

describe('EditClassSessionDialog', () => {
  it('el cuerpo se desplaza y el pie («Guardar») queda fuera de él, siempre a la vista (QA bloque B, defecto 1)', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <EditClassSessionDialog open onOpenChange={vi.fn()} sessionId="s1" />
      </QueryClientProvider>,
    )
    const cuerpo = await screen.findByTestId('class-session-body')
    expect(cuerpo).toHaveClass('overflow-y-auto', 'min-h-0', 'flex-1')
    // El diálogo no pasa de la pantalla.
    expect(screen.getByRole('dialog').className).toMatch(/max-h-\[90dvh\]/)
    // La tarjeta de pago y los asistentes van DENTRO del cuerpo; «Guardar» y «Cancelar», fuera.
    expect(cuerpo).toContainElement(screen.getByText('tarjeta de pago'))
    expect(cuerpo).toContainElement(screen.getByText('Cliente 7'))
    expect(cuerpo).not.toContainElement(screen.getByRole('button', { name: 'actions.save' }))
  })
})
