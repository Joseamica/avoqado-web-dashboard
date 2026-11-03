import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import type { SaleVerification } from '@/services/saleVerification.service'

/**
 * Aprobar o rechazar una venta pide `sale-verifications:approve`; `review` sólo deja verla
 * (Parte A del SERVIDOR: el supervisor de PlayTelecom ve la venta pero ya no la decide).
 */
const h = vi.hoisted(() => ({ perms: new Set<string>() }))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ activeVenue: { id: 'v-pt', timezone: 'America/Mexico_City', currency: 'MXN' } }),
}))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => h.perms.has(p) }) }))

const venta: SaleVerification = {
  id: 'sv-1',
  venueId: 'v-pt',
  paymentId: 'pay-123456789',
  staffId: 'st-1',
  photos: [],
  scannedProducts: [],
  status: 'PENDING',
  inventoryDeducted: false,
  deviceId: null,
  notes: null,
  createdAt: '2026-11-02T18:00:00.000Z',
  updatedAt: '2026-11-02T18:00:00.000Z',
  hasVerification: true,
  reviewedById: null,
  reviewedAt: null,
  reviewNotes: null,
  rejectionReasons: [],
  reviewedBy: null,
  staff: { id: 'st-1', firstName: 'Josefina', lastName: 'Alvarado' } as SaleVerification['staff'],
  payment: { id: 'pay-123456789', amount: 150 } as SaleVerification['payment'],
}

vi.mock('@/services/saleVerification.service', async orig => ({
  ...(await orig<typeof import('@/services/saleVerification.service')>()),
  listSaleVerifications: async () => ({
    success: true,
    data: [venta],
    pagination: { pageSize: 10, pageNumber: 1, totalCount: 1, totalPages: 1 },
  }),
  getSaleVerificationsSummary: async () => ({
    totalRevenue: 150,
    totalCount: 1,
    conciliatedCount: 0,
    pendingCount: 1,
    completedCount: 0,
    failedCount: 0,
    avgAmount: 150,
  }),
  getDailySalesData: async () => [],
  getStaffWithVerifications: async () => [],
}))

import { SalesReport } from '../SalesReport'

function renderReport() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <SalesReport />
    </QueryClientProvider>,
  )
}

beforeAll(async () => {
  await i18n.changeLanguage('es')
})

beforeEach(() => {
  h.perms = new Set()
})

describe('SalesReport — aprobar pide sale-verifications:approve', () => {
  it('con review y sin approve la venta se ve, pero sin botones de aprobar ni rechazar', async () => {
    h.perms = new Set(['sale-verifications:review'])
    renderReport()

    expect(await screen.findByText('Josefina Alvarado')).toBeInTheDocument()
    expect(screen.queryByTestId('btn-approve-sv-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('btn-reject-sv-1')).not.toBeInTheDocument()
  })

  it('con approve salen los botones de aprobar y rechazar', async () => {
    h.perms = new Set(['sale-verifications:review', 'sale-verifications:approve'])
    renderReport()

    expect(await screen.findByTestId('btn-approve-sv-1')).toBeInTheDocument()
    expect(screen.getByTestId('btn-reject-sv-1')).toBeInTheDocument()
  })
})
