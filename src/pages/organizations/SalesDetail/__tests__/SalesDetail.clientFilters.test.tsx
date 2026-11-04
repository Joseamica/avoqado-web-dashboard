/**
 * «Ventas — Detalle»: el Excel trae el MISMO conjunto que la pantalla. Los filtros que sólo se aplican en el
 * navegador (status con 2+, tipo de venta, forma de pago con 2+, tienda con 2+) también recortan lo exportado.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { OrgSaleRow } from '@/services/saleVerification.org.service'

const listMock = vi.fn()
const summaryMock = vi.fn()
const flagMock = vi.fn()
const toastMock = vi.fn()
const excelMock = vi.fn()

vi.mock('@/services/saleVerification.org.service', async orig => ({
  ...(await orig<typeof import('@/services/saleVerification.org.service')>()),
  listOrgSaleVerifications: (...a: unknown[]) => listMock(...a),
  getOrgSalesSummary: (...a: unknown[]) => summaryMock(...a),
  useOrgLinkingNumberEnabled: (...a: unknown[]) => flagMock(...a),
}))

vi.mock('@/utils/export', () => ({
  exportToExcel: (...a: unknown[]) => excelMock(...a),
  exportToCSV: () => {},
  generateFilename: () => 'ventas',
}))

vi.mock('@/hooks/use-current-organization', () => ({
  useCurrentOrganization: () => ({
    orgId: 'org-pt',
    orgSlug: 'playtelecom',
    isLoading: false,
    organization: { id: 'org-pt', name: 'PlayTelecom' },
  }),
}))
vi.mock('@/hooks/use-org-staff-by-role', () => ({ useOrgPromoters: () => ({ data: [] }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'OWNER' }, activeVenue: null }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: (...a: unknown[]) => toastMock(...a) }) }))

import SalesDetail from '../SalesDetail'

const VENUE = { id: 'v1', name: 'BAE MEZQUITAL', city: 'San Luis Potosí', slug: 'bae-mezquital' }

function venta(over: Partial<OrgSaleRow> & { id: string; serial: string }): OrgSaleRow {
  const { serial, ...rest } = over
  return {
    paymentId: `pay-${over.id}`,
    hasVerification: true,
    status: 'PENDING',
    isPortabilidad: false,
    saleType: 'LINEA_NUEVA',
    photos: ['https://fotos/vinculacion.jpg'],
    serialNumbers: [serial],
    reviewedById: null,
    reviewedAt: null,
    reviewNotes: null,
    rejectionReasons: [],
    createdAt: '2026-10-20T18:00:00.000Z',
    updatedAt: '2026-10-20T18:00:00.000Z',
    venue: VENUE,
    staff: { id: 's1', firstName: 'Josefina', lastName: 'Alvarado', email: null, photoUrl: null },
    reviewedBy: null,
    payment: {
      id: `pay-${over.id}`,
      amount: 100,
      method: 'CASH',
      paymentForm: 'CASH',
      status: 'COMPLETED',
      createdAt: '2026-10-20T18:00:00.000Z',
    },
    category: null,
    registeredFromVenue: null,
    terminal: null,
    linkingNumber: null,
    portedNumber: null,
    linkingNumberSource: null,
    portedNumberSource: null,
    linkingNumberSetAt: null,
    portedNumberSetAt: null,
    isExternalSale: false,
    numberAlerts: [],
    ...rest,
  } as OrgSaleRow
}


const FLAG_ON = { enabled: true, isError: false, refetch: () => {} }

const pendiente = venta({ id: 'sv-p', serial: 'ICCID-PEND', status: 'PENDING' })
const porRevisar = venta({ id: 'sv-f', serial: 'ICCID-FAIL', status: 'FAILED', saleType: 'PORTABILIDAD', isPortabilidad: true })
const rechazada = venta({ id: 'sv-r', serial: 'ICCID-RECH', status: 'REJECTED' })

function renderCon(rows: OrgSaleRow[]) {
  listMock.mockResolvedValue({ data: rows, pagination: { pageSize: 25, pageNumber: 1, totalCount: rows.length, totalPages: 1 } })
  summaryMock.mockResolvedValue({ totalCount: rows.length, completedCount: 0, pendingCount: rows.length, failedCount: 0, rejectedCount: 0 })
  flagMock.mockReturnValue(FLAG_ON)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SalesDetail />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function aplicarFiltro(pill: RegExp, opciones: string[]) {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: pill }))
  for (const o of opciones) await user.click(await screen.findByRole('checkbox', { name: o }))
  await user.click(screen.getByRole('button', { name: 'Aplicar' }))
}

async function exportarExcel() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: /Exportar/ }))
  await user.click(await screen.findByRole('menuitem', { name: /Excel/ }))
}

const idsExportados = () => (excelMock.mock.calls[0][0] as Record<string, unknown>[]).map(r => r['ID SIM'])

beforeEach(() => {
  excelMock.mockReset()
  toastMock.mockReset()
})

describe('Ventas — Detalle: el Excel respeta los filtros del navegador', () => {
  it('con dos status elegidos no exporta el tercero', async () => {
    renderCon([pendiente, porRevisar, rechazada])
    await screen.findByText('ICCID-RECH')
    await aplicarFiltro(/^Status/, ['En revisión por administración', 'Revisar por promotor'])
    await waitFor(() => expect(screen.queryByText('ICCID-RECH')).not.toBeInTheDocument())

    await exportarExcel()
    await waitFor(() => expect(excelMock).toHaveBeenCalled())
    expect(idsExportados()).toEqual(['ICCID-PEND', 'ICCID-FAIL'])
  })

  it('con un tipo de venta elegido no exporta los otros', async () => {
    renderCon([pendiente, porRevisar, rechazada])
    await screen.findByText('ICCID-RECH')
    await aplicarFiltro(/^Tipo de venta/, ['Portabilidad'])
    await waitFor(() => expect(screen.queryByText('ICCID-RECH')).not.toBeInTheDocument())

    await exportarExcel()
    await waitFor(() => expect(excelMock).toHaveBeenCalled())
    expect(idsExportados()).toEqual(['ICCID-FAIL'])
  })

  it('si el filtro del navegador deja el conjunto vacío, avisa «Sin datos para exportar»', async () => {
    renderCon([pendiente, rechazada])
    await screen.findByText('ICCID-RECH')
    await aplicarFiltro(/^Tipo de venta/, ['Portabilidad'])
    await waitFor(() => expect(screen.queryByText('ICCID-RECH')).not.toBeInTheDocument())

    await exportarExcel()
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sin datos para exportar' })))
    expect(excelMock).not.toHaveBeenCalled()
  })
})

describe('applyClientSaleFilters', () => {
  it('sin selección deja todo; un solo status no filtra (lo hace el servidor); un tipo de venta sí', async () => {
    const { applyClientSaleFilters } = await import('../clientFilters')
    const todos = [pendiente, porRevisar, rechazada]
    const vacio = { status: [], saleType: [], paymentForm: [], venue: [] }
    expect(applyClientSaleFilters(todos, vacio)).toHaveLength(3)
    expect(applyClientSaleFilters(todos, { ...vacio, status: ['PENDING'] })).toHaveLength(3)
    expect(applyClientSaleFilters(todos, { ...vacio, status: ['PENDING', 'FAILED'] })).toHaveLength(2)
    expect(applyClientSaleFilters(todos, { ...vacio, saleType: ['PORTABILIDAD'] })).toEqual([porRevisar])
  })
})
