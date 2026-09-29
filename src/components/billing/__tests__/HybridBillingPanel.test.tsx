import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'
import { HybridBillingPanel } from '../HybridBillingPanel'
import { hybridBilling } from '@/services/hybridBilling.service'
vi.mock('@/services/hybridBilling.service', () => ({ hybridBilling: { contracts: vi.fn(), cancelContract: vi.fn(), selection: vi.fn() } }))
vi.mock('../HybridCheckout', async () => ({ ...(await vi.importActual('../HybridCheckout')), HybridCheckout: () => <p>Checkout</p> }))
vi.mock('react-i18next', async () => {
  const { default: d } = await import('@/locales/en/billing.json')
  return {
    useTranslation: () => ({
      i18n: { language: 'en' },
      t: (k: string, p: Record<string, unknown> = {}) =>
        String(k.split('.').reduce((v: any, s) => v?.[s], d) ?? k).replace(/\{\{(\w+)\}\}/g, (_, s) => String(p[s])),
    }),
  }
})
it('cancels only after showing the paid boundary and sends the observed revision', async () => {
  vi.mocked(hybridBilling.contracts).mockResolvedValue({
    items: [
      {
        id: 'c',
        name: 'Flexible',
        revision: 7,
        kind: 'FEATURES',
        paymentIssue: 'HYBRID_TRANSFER_REVERSED',
        definition: { kind: 'FEATURES', terms: { price: 469.9, currency: 'MXN', taxInclusive: true, renewal: { kind: 'SAME' } } },
        featureCodes: ['CFDI'],
        paidThrough: '2030-01-10T00:00:00Z',
        cancelAt: null,
        endedAt: null,
        pendingEffectiveAt: null,
      },
    ],
    total: 1,
    page: 1,
    pageSize: 10,
  } as any)
  vi.mocked(hybridBilling.cancelContract).mockResolvedValue({} as any)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <HybridBillingPanel venueId="venue" canRead canManage timezone="America/Mexico_City" />
    </QueryClientProvider>,
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Cancel renewal' }))
  expect(screen.getByText(/stops renewing on/)).toBeInTheDocument()
  expect(screen.getByText(/Cancelling does not resolve the funding review/)).toBeInTheDocument()
  expect(screen.getByText(/A refund or dispute affected/)).toBeInTheDocument()
  expect(hybridBilling.cancelContract).not.toHaveBeenCalled()
  await userEvent.click(screen.getByText("It's too expensive"))
  await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel the renewal' }))
  await waitFor(() => expect(hybridBilling.cancelContract).toHaveBeenCalledWith('venue', 'c', 7, { reason: 'TOO_EXPENSIVE' }))
})

it('shows cancellation instead of promising another renewal', async () => {
  vi.mocked(hybridBilling.contracts).mockResolvedValue({
    items: [
      {
        id: 'cancelled',
        name: 'Cancelled package',
        revision: 2,
        kind: 'FEATURES',
        definition: { kind: 'FEATURES', terms: { price: 319.5, renewal: { kind: 'SAME' } } },
        featureCodes: ['CFDI'],
        paidThrough: '2030-01-10T00:00:00Z',
        cancelAt: '2030-01-10T00:00:00Z',
        endedAt: null,
      },
    ],
    total: 1,
    page: 1,
    pageSize: 10,
  } as any)
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <HybridBillingPanel venueId="cancelled-venue" canRead canManage timezone="America/Mexico_City" />
    </QueryClientProvider>,
  )
  expect(await screen.findByText(/Renewal cancelled/)).toBeInTheDocument()
  expect(screen.queryByText('Renews monthly at the same price until you cancel.')).not.toBeInTheDocument()
})
