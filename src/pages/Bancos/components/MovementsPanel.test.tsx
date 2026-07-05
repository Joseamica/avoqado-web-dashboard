import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { MovementsPanel } from './MovementsPanel'
import type { FinancialAccountSummary } from '@/services/financialConnection.service'

// i18n: echo key — convención del repo (ver BankConnectWizard.test.tsx / BancosSpei.test.tsx).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@/services/financialConnection.service', () => ({
  financialConnectionAPI: {
    getMovementStats: vi.fn(async () => ({
      accountName: 'Cuenta',
      clabe: null,
      speiIn: { amount: 100, fee: 0, count: 1 },
      speiOut: { amount: 50, fee: 0, count: 1 },
      internalTransfers: { amount: 0, fee: 0, count: 0 },
      dispersions: { amount: 0, fee: 0, count: 0 },
    })),
    getMovements: vi.fn(async () => ({
      total: 2,
      movements: [
        {
          id: 'm1',
          type: 'SPEI IN',
          typeId: 1,
          operationType: 'Abono',
          concept: 'Pago',
          date: '2026-07-01T10:00:00Z',
          amount: 100,
          status: 'Exitosa',
          statusId: 3,
          beneficiary: null,
          originator: 'ACME',
          reference: 'r1',
        },
        {
          id: 'm2',
          type: 'SPEI OUT',
          typeId: 2,
          operationType: 'Cargo',
          concept: 'Renta',
          date: '2026-07-02T10:00:00Z',
          amount: 50,
          status: 'Aprobado',
          statusId: 4,
          beneficiary: 'Juan',
          originator: null,
          reference: 'r2',
        },
      ],
    })),
  },
}))

const account: FinancialAccountSummary = {
  id: 'acc-1',
  externalId: 'ext-1',
  label: 'Cuenta CLABE',
  clabe: '032180000118359719',
  currency: 'MXN',
  lastBalance: 1000,
  lastSyncedAt: null,
  balanceState: 'OK',
  merchantAccounts: [],
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MovementsPanel venueId="v1" account={account} />
    </QueryClientProvider>,
  )
}

describe('MovementsPanel (DataTable + filtros Tipo/Estatus)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // vi.clearAllMocks() se lleva la implementación del mock global de ResizeObserver
    // (src/test/setup.ts) — sin reponerla, abrir el Popover del FilterPill truena.
    // Debe ser una `class` real (no vi.fn().mockImplementation(arrow)): floating-ui la
    // invoca con `new`, y una arrow function nunca es constructible.
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  })

  it('renderiza los movimientos del proveedor en la tabla, contraparte según dirección', async () => {
    renderPanel()
    await waitFor(() => expect(screen.getByText('ACME')).toBeInTheDocument()) // incoming -> originator
    expect(screen.getByText('Juan')).toBeInTheDocument() // outgoing -> beneficiary
  })

  it('filtro Tipo: seleccionar una opción vuelve a pedir movimientos con el id numérico correcto', async () => {
    const { financialConnectionAPI } = await import('@/services/financialConnection.service')
    renderPanel()
    await waitFor(() => expect(screen.getByText('ACME')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'movements.filters.type' }))
    fireEvent.click(await screen.findByRole('button', { name: 'SPEI IN' }))

    await waitFor(() =>
      expect(financialConnectionAPI.getMovements).toHaveBeenCalledWith('v1', 'acc-1', expect.objectContaining({ type: 1 })),
    )
  })

  it('clic en una fila abre el detalle del movimiento', async () => {
    renderPanel()
    await waitFor(() => expect(screen.getByText('ACME')).toBeInTheDocument())

    fireEvent.click(screen.getByText('ACME'))

    expect(await screen.findByText('movements.detail.folio')).toBeInTheDocument()
    expect(screen.getByText('m1')).toBeInTheDocument()
  })
})
