import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TerminalOrderDetail from '../TerminalOrderDetail'

const acceso = vi.hoisted(() => ({ permisos: [] as string[] }))

vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({
    can: (p: string) => acceso.permisos.includes(p),
    canAny: () => false,
    canAll: () => false,
  }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'venue-1' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: () => '' }) }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? key),
  }),
}))
vi.mock('@/services/tpvOrder.service', () => ({
  tpvOrderService: {
    getById: async () => ({
      id: 'o1',
      venueId: 'venue-1',
      orderNumber: 'TO-1',
      paymentMethod: 'SPEI',
      paymentStatus: 'AWAITING_PROOF',
      fulfillmentStatus: 'PENDING',
      speiRecipient: { beneficiary: 'Avoqado', bank: 'BBVA', clabe: '012', amountCents: 100, concept: 'TO-1' },
      items: [],
      terminals: [],
    }),
    uploadProof: vi.fn(),
  },
}))

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/orders/o1']}>
        <Routes>
          <Route path="/orders/:id" element={<TerminalOrderDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('comprobante SPEI del pedido de terminal', () => {
  beforeEach(() => {
    acceso.permisos = []
  })

  it('sin tpv:create no muestra la zona de subida y sí el aviso', async () => {
    pintar()
    expect(await screen.findByText(/lo sube quien puede comprar terminales/i)).toBeTruthy()
    expect(screen.queryByText('Arrastra el comprobante aquí')).toBeNull()
  })

  it('con tpv:create muestra la zona de subida y no el aviso', async () => {
    acceso.permisos = ['tpv:create']
    pintar()
    expect(await screen.findByText('Arrastra el comprobante aquí')).toBeTruthy()
    expect(screen.queryByText(/lo sube quien puede comprar terminales/i)).toBeNull()
  })
})
