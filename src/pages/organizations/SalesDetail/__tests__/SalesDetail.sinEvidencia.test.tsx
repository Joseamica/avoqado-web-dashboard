/**
 * Renglones sin evidencia en la pantalla "Ventas" de organización (Asana 1218158516825558).
 *
 * Bug reportado por PlayTelecom: aparecen ventas sin SIM ID ni promotor, y al
 * rechazarlas sale "Sale verification not found". Son cobros COMPLETED cuya
 * `SaleVerification` nunca se creó; el renglón viaja con el id del PAGO, así que
 * Aprobar, Revisar, Rechazar y Editar devuelven 404 los cuatro.
 *
 * 🔴 Es una REGRESIÓN, no un caso imprevisto: la pantalla legacy ya lo bloqueaba con
 * `verification.status === 'PENDING' && verification.hasVerification`
 * (`src/pages/playtelecom/Sales/SalesReport.tsx`). Al reescribirla como pantalla de
 * organización se estrenó `OrgSaleRow` SIN `hasVerification`, así que la guarda quedó
 * en `row.status === 'PENDING'` — y el status del huérfano es precisamente el
 * 'PENDING' que el backend fabrica con `v?.status ?? 'PENDING'`. La condición que
 * debía apagar los botones es la que los enciende.
 *
 * Estas pruebas fallan con la guarda vieja (pintan los tres botones sobre un renglón
 * huérfano) y pasan con la nueva.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { OrgSaleRow } from '@/services/saleVerification.org.service'

const listMock = vi.fn()
const summaryMock = vi.fn()

vi.mock('@/services/saleVerification.org.service', async orig => ({
  ...(await orig<typeof import('@/services/saleVerification.org.service')>()),
  listOrgSaleVerifications: (...args: unknown[]) => listMock(...args),
  getOrgSalesSummary: (...args: unknown[]) => summaryMock(...args),
}))

vi.mock('@/hooks/use-current-organization', () => ({
  useCurrentOrganization: () => ({
    orgId: 'org-pt',
    orgSlug: 'playtelecom',
    isLoading: false,
    organization: { id: 'org-pt', name: 'PlayTelecom' },
  }),
}))

// OWNER: el rol con MÁS permisos. Si ni siquiera él ve los botones sobre un huérfano,
// nadie los ve — y de paso ejercita el candado de "Editar", que sólo OWNER/SUPERADMIN
// alcanzan.
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'OWNER' }, activeVenue: null }),
}))

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

import SalesDetail from '../SalesDetail'

const VENUE = { id: 'v1', name: 'BAE MEZQUITAL', city: 'San Luis Potosí', slug: 'bae-mezquital' }

/** El renglón exacto de la captura: sin SIM, sin promotor, sin foto, $0.00. */
const huerfano = {
  id: 'cmtm7gpje075fi12a834qzlbf', // ← id del PAGO, no de una verificación
  paymentId: 'cmtm7gpje075fi12a834qzlbf',
  hasVerification: false,
  status: 'PENDING',
  isPortabilidad: false,
  saleType: 'LINEA_NUEVA',
  photos: [],
  serialNumbers: [],
  reviewedById: null,
  reviewedAt: null,
  reviewNotes: null,
  rejectionReasons: [],
  createdAt: '2026-09-04T00:18:00.000Z',
  updatedAt: '2026-09-04T00:18:00.000Z',
  venue: VENUE,
  staff: null,
  reviewedBy: null,
  payment: { id: 'cmtm7gpje075fi12a834qzlbf', amount: 0, method: 'OTHER', paymentForm: 'OTHER', status: 'COMPLETED', createdAt: '2026-09-04T00:18:00.000Z' },
  category: null,
  registeredFromVenue: null,
  terminal: null,
} as unknown as OrgSaleRow

/** Una venta normal pendiente de revisión: MISMO status, y sí debe traer botones. */
const normal = {
  ...huerfano,
  id: 'sv-normal',
  paymentId: 'pay-normal',
  hasVerification: true,
  serialNumbers: ['8952140064247085252F'],
  staff: { id: 's1', firstName: 'Josefina', lastName: 'Alvarado', email: null, photoUrl: null },
} as unknown as OrgSaleRow

function renderCon(rows: OrgSaleRow[]) {
  listMock.mockResolvedValue({
    data: rows,
    pagination: { pageSize: 25, pageNumber: 1, totalCount: rows.length, totalPages: 1 },
  })
  summaryMock.mockResolvedValue({ total: rows.length, pending: rows.length, completed: 0, failed: 0, inReview: 0 })

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SalesDetail />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Ventas de organización: renglón sin evidencia (Asana 1218158516825558)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // `mockReset: true` (vitest.config.ts) vacía la implementación de los `vi.fn()`
    // del setup global antes de CADA prueba — incluida la de `window.matchMedia`, que
    // `use-mobile` invoca al montar la pantalla. Se repone con una función real, por
    // el mismo motivo por el que el setup define `ResizeObserver` como clase.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => false,
      }),
    })
  })

  it('no ofrece Aprobar, Revisar, Rechazar ni Editar sobre un cobro sin verificación', async () => {
    renderCon([huerfano])

    await waitFor(() => expect(screen.getByText('Sin evidencia')).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: /Aprobar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Revisar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Rechazar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Editar/i })).not.toBeInTheDocument()
  })

  it('explica qué pasó y con qué dato reportarlo, en vez de esconder el renglón', async () => {
    renderCon([huerfano])

    const marca = await screen.findByText('Sin evidencia')
    expect(marca.closest('span')?.getAttribute('title')).toContain('cmtm7gpje075fi12a834qzlbf')
    expect(marca.closest('span')?.getAttribute('title')).toMatch(/no se puede aprobar ni rechazar/i)
  })

  // ── REGRESIÓN: la venta normal no se toca ──

  it('sigue ofreciendo las tres acciones sobre una venta pendiente con verificación', async () => {
    renderCon([normal])

    await waitFor(() => expect(screen.getAllByRole('button', { name: /Aprobar/i }).length).toBeGreaterThan(0))

    expect(screen.getAllByRole('button', { name: /Revisar/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /Rechazar/i }).length).toBeGreaterThan(0)
    expect(screen.queryByText('Sin evidencia')).not.toBeInTheDocument()
  })

  /**
   * El caso que hace inservible cualquier guarda basada en `status`: los dos renglones
   * conviven en la MISMA tabla con el MISMO 'PENDING'. Uno debe traer acciones y el
   * otro no.
   */
  it('separa los dos renglones aunque compartan el status PENDING', async () => {
    renderCon([huerfano, normal])

    await waitFor(() => expect(screen.getByText('Sin evidencia')).toBeInTheDocument())

    const filaHuerfana = screen.getByText('Sin evidencia').closest('tr')!
    expect(within(filaHuerfana).queryByRole('button', { name: /Aprobar/i })).not.toBeInTheDocument()

    const filaNormal = screen.getByText('8952140064247085252F').closest('tr')!
    expect(within(filaNormal).getByRole('button', { name: /Aprobar/i })).toBeInTheDocument()
  })
})
