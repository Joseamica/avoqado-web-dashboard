import i18n from '@/i18n'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ---------------------------------------------------------------------------
// `useCurrentVenue` normally reads AuthContext — mocked directly so this test
// doesn't need to stand up the whole auth provider tree just to get a venueId.
// ---------------------------------------------------------------------------
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({
    venue: { id: 'venue_1', slug: 'demo-venue', timezone: 'America/Mexico_City' },
    venueId: 'venue_1',
    venueSlug: 'demo-venue',
    isLoading: false,
    hasVenueAccess: true,
    isWhiteLabelMode: false,
    venueBasePath: '/venues',
    fullBasePath: '/venues/demo-venue',
  }),
}))

// `useVenueDateTime` also reads AuthContext for the venue timezone — mocked to a
// deterministic formatter so date columns don't depend on the host's Intl locale.
vi.mock('@/utils/datetime', async importOriginal => {
  const actual = await importOriginal<typeof import('@/utils/datetime')>()
  return {
    ...actual,
    useVenueDateTime: () => ({
      formatDateTime: (date: string | Date | null | undefined) => (date ? new Date(date).toISOString() : '—'),
      formatTime: () => '',
      formatDate: (date: string | Date | null | undefined) => (date ? new Date(date).toISOString() : '—'),
      formatDateISO: () => '',
      venueTimezone: 'America/Mexico_City',
      venueTimezoneShort: 'CST',
    }),
  }
})

const mockGetAreaTicketOverview = vi.fn()
const mockGetExternalSettlements = vi.fn()
const mockGetExternalIncidents = vi.fn()

vi.mock('@/services/areaTickets.service', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/areaTickets.service')>()
  return {
    ...actual,
    getAreaTicketOverview: (...args: unknown[]) => mockGetAreaTicketOverview(...args),
    getExternalSettlements: (...args: unknown[]) => mockGetExternalSettlements(...args),
    getExternalIncidents: (...args: unknown[]) => mockGetExternalIncidents(...args),
  }
})

import ExternalSettlements from '../ExternalSettlements'

const AREA = { id: 'area_1', name: 'Cremería' }

function renderPage(initialEntry = '/venues/demo-venue/settings/area-tickets/external-settlements') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <ExternalSettlements />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const OVERVIEW = {
  entitlements: { areaTickets: true, scaleIntegration: false, variableWeightBarcode: false },
  effective: { areaTickets: true, scales: false, variableWeightBarcode: false },
  settings: {},
  scaleSettings: {},
  areas: [AREA],
  terminals: [],
  scaleProfiles: [],
  operations: { tickets: {}, checkouts: {}, paymentReconciliationCount: 0 },
}

describe('ExternalSettlements', () => {
  // The platform's default audience is Mexican Spanish — pin the language explicitly
  // instead of depending on the test environment's (English) locale detection, so
  // this test verifies the copy real users see, matching the brief's own examples.
  beforeAll(async () => {
    await i18n.changeLanguage('es')
  })

  beforeEach(() => {
    mockGetAreaTicketOverview.mockReset()
    mockGetExternalSettlements.mockReset()
    mockGetExternalIncidents.mockReset()
    mockGetAreaTicketOverview.mockResolvedValue(OVERVIEW)
    mockGetExternalIncidents.mockResolvedValue({ items: [], nextCursor: null })
  })

  it('muestra el importe como "Importe de referencia", nunca como "Total pagado"', async () => {
    mockGetExternalSettlements.mockResolvedValue({
      items: [
        {
          id: 'settlement_1',
          status: 'PENDING',
          handoffState: 'HANDED_OFF',
          confirmationMode: 'MANUAL',
          referenceAmount: '150.00',
          externalAmount: null,
          variance: null,
          externalReference: null,
          notes: null,
          createdAt: '2026-08-01T12:00:00.000Z',
          confirmedAt: null,
          confirmedBy: null,
          terminal: null,
          areaTicket: { id: 'ticket_1', code: 'CRE-000123', issuedAt: '2026-08-01T12:00:00.000Z' },
          area: AREA,
        },
      ],
      nextCursor: null,
    })

    renderPage()

    expect(await screen.findByText(/importe de referencia/i)).toBeInTheDocument()
    expect(screen.queryByText(/pagado/i)).not.toBeInTheDocument()
  })

  it('muestra la variación con signo cuando hay discrepancia', async () => {
    mockGetExternalSettlements.mockResolvedValue({
      items: [
        {
          id: 'settlement_2',
          status: 'DISCREPANCY',
          handoffState: 'HANDED_OFF',
          confirmationMode: 'MANUAL',
          referenceAmount: '150.00',
          externalAmount: '175.50',
          variance: '25.50',
          externalReference: null,
          notes: null,
          createdAt: '2026-08-01T12:00:00.000Z',
          confirmedAt: '2026-08-01T13:00:00.000Z',
          confirmedBy: 'Ana Pérez',
          terminal: null,
          areaTicket: { id: 'ticket_2', code: 'CRE-000124', issuedAt: '2026-08-01T12:00:00.000Z' },
          area: AREA,
        },
        {
          id: 'settlement_3',
          status: 'DISCREPANCY',
          handoffState: 'HANDED_OFF',
          confirmationMode: 'MANUAL',
          referenceAmount: '150.00',
          externalAmount: '120.00',
          variance: '-30.00',
          externalReference: null,
          notes: null,
          createdAt: '2026-08-01T12:00:00.000Z',
          confirmedAt: '2026-08-01T13:00:00.000Z',
          confirmedBy: 'Ana Pérez',
          terminal: null,
          areaTicket: { id: 'ticket_3', code: 'CRE-000125', issuedAt: '2026-08-01T12:00:00.000Z' },
          area: AREA,
        },
      ],
      nextCursor: null,
    })

    renderPage()

    // Positive variance gets an explicit "+" — negative already carries its own "-".
    expect(await screen.findByText('+25.50')).toBeInTheDocument()
    expect(await screen.findByText('-30.00')).toBeInTheDocument()
  })

  it('el estado vacío dice qué significa, no solo "sin datos"', async () => {
    mockGetExternalSettlements.mockResolvedValue({ items: [], nextCursor: null })

    renderPage()

    expect(await screen.findByText(/aquí aparecerán los vales de la ruta externa/i)).toBeInTheDocument()
    expect(screen.queryByText(/^sin datos$/i)).not.toBeInTheDocument()
  })

  // ── Regression / additional coverage ──

  it('deja claro que el importe es de referencia y no una venta de Avoqado', async () => {
    mockGetExternalSettlements.mockResolvedValue({ items: [], nextCursor: null })

    renderPage()

    await screen.findByText(/importe de referencia/i)
    expect(screen.getByText(/no son ventas de avoqado/i)).toBeInTheDocument()
  })

  it('persiste la pestaña activa en el hash de la URL', async () => {
    mockGetExternalSettlements.mockResolvedValue({ items: [], nextCursor: null })

    renderPage('/venues/demo-venue/settings/area-tickets/external-settlements#incidents')

    // The incidents-only disclaimer proves the incidents tab rendered from the hash,
    // not the default "settlements" tab.
    expect(await screen.findByText(/ninguna acción de esta pantalla confirma ni resuelve/i)).toBeInTheDocument()
  })

  it('las incidencias muestran su propio estado vacío explicativo', async () => {
    mockGetExternalSettlements.mockResolvedValue({ items: [], nextCursor: null })

    renderPage('/venues/demo-venue/settings/area-tickets/external-settlements#incidents')

    expect(await screen.findByText(/aquí aparecerían los problemas que el sistema detecta solo/i)).toBeInTheDocument()
  })
})
