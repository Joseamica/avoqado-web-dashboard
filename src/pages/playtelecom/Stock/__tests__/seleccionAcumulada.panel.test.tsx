/**
 * La prueba que afirma lo que el supervisor vive, no cómo está cableado por dentro.
 *
 * `seleccionAsignable.test.ts` fija la regla; ésta fija el PANEL: marcar una SIM, teclear otra
 * terminación (el servidor devuelve otra página) y marcar la segunda tiene que dejar el botón en
 * «Asignar a Promotor (2)». Antes del arreglo se quedaba en (1) — y con una sola búsqueda que no
 * devolviera nada marcado, el botón desaparecía.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { OrgStockOverviewItem } from '@/services/stockDashboard.service'

const paginaActual = vi.hoisted(() => ({ items: [] as OrgStockOverviewItem[] }))

vi.mock('../hooks/useOrgStockCustody', () => ({
  useOrgStockCustody: () => ({
    data: {
      pages: [
        {
          items: paginaActual.items,
          summary: { total: 2, almacen: 2, pendientes: 0, aceptados: 0, rechazados: 0, vendidos: 0, estancados: 0 },
          promoterRanking: [],
          pagination: { page: 1, pageSize: 50, total: paginaActual.items.length, totalPages: 1 },
        },
      ],
    },
    isLoading: false,
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  }),
}))

// Los diálogos abren Radix y traen su propio react-query; aquí sólo importa el contador.
vi.mock('../../Organization/StockControl/components/SimTimelineDrawer', () => ({ SimTimelineDrawer: () => null }))
vi.mock('../../Organization/StockControl/components/CollectSimDialog', () => ({ CollectSimDialog: () => null }))
vi.mock('../../Organization/StockControl/components/AssignToPromoterDialog', () => ({ AssignToPromoterDialog: () => null }))

import { VenueSimCustodyPanel } from '../components/VenueSimCustodyPanel'

const sim = (serialNumber: string): OrgStockOverviewItem =>
  ({
    id: `id-${serialNumber}`,
    serialNumber,
    status: 'AVAILABLE',
    categoryId: 'cat',
    categoryName: 'Bait',
    createdAt: '2026-09-01T10:00:00.000Z',
    soldAt: null,
    registeredFromVenueId: null,
    registeredFromVenueName: null,
    sellingVenueId: null,
    sellingVenueName: null,
    currentVenueId: null,
    currentVenueName: null,
    createdById: null,
    createdByName: null,
    custodyState: 'SUPERVISOR_HELD',
  }) as OrgStockOverviewItem

const PRIMERA = '8952140061111111111'
const SEGUNDA = '8952140062222222222'

const marcar = async (user: ReturnType<typeof userEvent.setup>, serialNumber: string) =>
  user.click(screen.getByLabelText(`Seleccionar ${serialNumber}`))

const botonAsignar = () => screen.queryByRole('button', { name: /Asignar a Promotor/i })

describe('VenueSimCustodyPanel — la selección sobrevive a cambiar de búsqueda', () => {
  beforeEach(() => {
    paginaActual.items = [sim(PRIMERA)]
  })

  it('🔴 marcar en dos búsquedas distintas deja el botón en (2)', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<VenueSimCustodyPanel orgId="org" venueId="venue" />)

    await marcar(user, PRIMERA)
    expect(botonAsignar()).toHaveTextContent('(1)')

    // El supervisor teclea la siguiente terminación: el servidor manda OTRA página, sin la primera.
    paginaActual.items = [sim(SEGUNDA)]
    rerender(<VenueSimCustodyPanel orgId="org" venueId="venue" />)
    expect(screen.queryByLabelText(`Seleccionar ${PRIMERA}`)).not.toBeInTheDocument()

    await marcar(user, SEGUNDA)

    // Antes del arreglo esto decía (1): la primera se caía al salir de la lista visible.
    expect(botonAsignar()).toHaveTextContent('(2)')
  })

  it('🔴 el botón no desaparece cuando la búsqueda no devuelve nada marcado', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<VenueSimCustodyPanel orgId="org" venueId="venue" />)

    await marcar(user, PRIMERA)
    paginaActual.items = []
    rerender(<VenueSimCustodyPanel orgId="org" venueId="venue" />)

    expect(botonAsignar()).toHaveTextContent('(1)')
  })

  it('las fichas dejan ver lo marcado aunque ya no esté en la tabla', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<VenueSimCustodyPanel orgId="org" venueId="venue" />)

    await marcar(user, PRIMERA)
    paginaActual.items = [sim(SEGUNDA)]
    rerender(<VenueSimCustodyPanel orgId="org" venueId="venue" />)

    const fichas = screen.getByText(/seleccionado/).parentElement as HTMLElement
    expect(within(fichas).getByText(`···${PRIMERA.slice(-6)}`)).toBeInTheDocument()
  })

  it('quitar una ficha la saca de la cuenta', async () => {
    const user = userEvent.setup()
    render(<VenueSimCustodyPanel orgId="org" venueId="venue" />)

    await marcar(user, PRIMERA)
    await user.click(screen.getByLabelText(`Quitar ${PRIMERA}`))

    expect(botonAsignar()).toBeNull()
  })
})
