/**
 * F6 · Codex código r1 (P2-2): la lista de Facturas enlaza cada nota pendiente a `/payments/<id del REFUND>`. Abierto con el id de una
 * devolución, el drawer no tiene «devoluciones de este pago» (se buscan por `originalPaymentId`) y el panel fiscal sólo vivía en esas
 * tarjetas: el enlace no enseñaba ni el motivo ni los botones. Con un pago REFUND, el drawer monta el panel REAL de ese reembolso.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import es from '@/locales/es/cfdi.json'

const traducir = (key: string, opts?: Record<string, unknown>) => {
  const raw = key.split('.').reduce<any>((o, k) => o?.[k], es as any)
  if (typeof raw !== 'string') return (opts?.defaultValue as string) ?? key
  return raw.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(opts?.[k] ?? ''))
}
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: traducir, i18n: { language: 'es' } }) }))

const MOTIVO = 'Primero tiene que salir la nota de crédito de los artículos devueltos de esta venta.'
const m = vi.hoisted(() => ({ pagos: {} as Record<string, any>, consultadas: [] as string[] }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', venue: { name: 'Testarudo' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/use-cfdi', () => ({
  useRefundCreditNote: (refundId: string) => {
    m.consultadas.push(refundId)
    return {
      data: {
        creditNote: null,
        recoveryOnly: false,
        eligibility: { eligible: false, reason: 'ESPERA_NOTA_DE_ARTICULOS', message: MOTIVO },
        preview: null,
        automatica: { estado: 'REQUIERE_INTERVENCION' },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      esperaDelXmlAgotada: false,
      volverAConsultar: vi.fn(),
    }
  },
  useEmitRefundCreditNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('../IssueRefundSheet', () => ({ IssueRefundSheet: () => null }))
vi.mock('../CustomerSheets', () => ({ AddCustomerSheet: () => null, CustomerFormSheet: () => null }))
vi.mock('@/api', () => ({
  default: {
    get: async (url: string) => {
      const [, id, resto] = url.match(/\/payments\/([^/]+)(\/\w+)?$/) ?? []
      if (!m.pagos[id]) throw new Error(`GET inesperado: ${url}`)
      if (resto === '/refunds') return { data: { success: true, data: [] } } // de una devolución no cuelga ninguna otra
      if (resto === '/receipts') return { data: [] }
      return { data: m.pagos[id] }
    },
    post: async () => ({ data: {} }),
    put: async () => ({ data: {} }),
  },
}))

import { PaymentDrawerContent } from '../PaymentDrawerContent'

const abrir = (paymentId: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PaymentDrawerContent paymentId={paymentId} onClose={() => {}} venueTimezone="America/Mexico_City" />
    </QueryClientProvider>,
  )
const pago = (id: string, type: string, amount: string) => ({
  id,
  type,
  amount,
  tipAmount: '0',
  method: 'CREDIT_CARD',
  source: 'POS',
  createdAt: '2026-10-09T18:00:00Z',
  order: { id: 'o1', items: [] },
})

beforeEach(() => {
  m.pagos = { r1: pago('r1', 'REFUND', '-50.00'), p1: pago('p1', 'REGULAR', '116.00') }
  m.consultadas = []
})

describe('PaymentDrawerContent — el enlace de un pendiente abre la devolución con su nota', () => {
  it('🔴 abierto con el id de una devolución (REFUND): el panel de ESA nota, con su motivo, el aviso y «Volver a consultar» — una sola vez', async () => {
    abrir('r1')
    expect(await screen.findByText(MOTIVO)).toBeInTheDocument()
    expect(screen.getAllByText(MOTIVO)).toHaveLength(1)
    expect(screen.getByText(es.creditNote.automatica.requiere)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: es.creditNote.retryXml })).toBeInTheDocument()
    expect(new Set(m.consultadas)).toEqual(new Set(['r1']))
  })
  it('control — un cobro normal sin devoluciones no monta ningún panel de nota', async () => {
    abrir('p1')
    expect(await screen.findByText('Testarudo')).toBeInTheDocument()
    expect(screen.queryByText(MOTIVO)).not.toBeInTheDocument()
    expect(m.consultadas).toEqual([])
  })
})
