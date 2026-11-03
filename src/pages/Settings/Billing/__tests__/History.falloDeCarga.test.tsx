/** El historial de facturación junta dos consultas en una tabla: si falta una, la lista está incompleta y hay que decirlo (Codex r0). */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configure, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const t = (k: string) => k
  return { facturas: vi.fn(), tokens: vi.fn(), i18n: { t, i18n: { language: 'es' } } }
})
vi.mock('react-i18next', () => ({ useTranslation: () => mocks.i18n }))
vi.mock('@/api', () => ({ default: { post: vi.fn(), get: vi.fn() } }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', venue: { name: 'IQ' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/hooks/use-token-budget', () => ({ formatTokenCount: (n: number) => String(n) }))
vi.mock('@/services/features.service', () => ({ getVenueInvoices: (...a: unknown[]) => mocks.facturas(...a), downloadInvoice: vi.fn() }))
vi.mock('@/services/chatService', () => ({ getTokenHistory: (...a: unknown[]) => mocks.tokens(...a) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: () => 'hoy', formatDateTime: () => 'hoy' }) }))

import History from '../History'

vi.setConfig({ testTimeout: 30_000 })
configure({ asyncUtilTimeout: 10_000 })

const factura = { id: 'i1', number: '001', description: 'Plan Pro', created: 1_790_000_000, amount_due: 99900, currency: 'mxn', status: 'paid' }
const sinTokens = { purchases: { records: [] } }

let client: QueryClient
function montar() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <History />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.facturas.mockResolvedValue([factura])
  mocks.tokens.mockResolvedValue(sinTokens)
})
afterEach(() => client?.clear())

describe('Historial de facturación si falla la carga', () => {
  it('si fallan las facturas no dice «no hay facturas»', async () => {
    mocks.facturas.mockRejectedValue({ response: { status: 500 } })
    montar()

    expect(await screen.findByRole('alert')).toHaveTextContent('loadFailure.empty')
    expect(screen.queryByText('billingHistory.noInvoices')).not.toBeInTheDocument()
  })

  it('si sólo fallan los tokens enseña las facturas y avisa que la lista está incompleta', async () => {
    mocks.tokens.mockRejectedValue({ response: { status: 500 } })
    montar()

    expect(await screen.findByRole('alert')).toHaveTextContent('loadFailure.partial')
    expect(screen.getByText('Plan Pro')).toBeInTheDocument()
  })

  it('un rol sin permiso de tokens ve sus facturas, sin aviso', async () => {
    mocks.tokens.mockRejectedValue({ response: { status: 403 } })
    montar()

    expect(await screen.findByText('Plan Pro')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('con facturas en 403 y tokens en 500, sí deja reintentar los tokens (Codex r3)', async () => {
    mocks.facturas.mockRejectedValue({ response: { status: 403 } })
    mocks.tokens.mockRejectedValue({ response: { status: 500 } })
    montar()

    expect(await screen.findByRole('button', { name: 'retry' })).toBeInTheDocument()
  })

  it('sin movimientos sigue diciendo que no hay, sin aviso', async () => {
    mocks.facturas.mockResolvedValue([])
    montar()

    expect(await screen.findByText('billingHistory.noInvoices')).toBeInTheDocument()
    expect(screen.queryAllByRole('alert').filter(a => a.textContent?.includes('loadFailure'))).toHaveLength(0)
  })
})
