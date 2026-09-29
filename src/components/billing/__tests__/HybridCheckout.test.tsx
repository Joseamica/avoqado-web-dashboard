import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, it, vi } from 'vitest'
import { hybridBilling } from '@/services/hybridBilling.service'
import { HybridCheckout } from '../HybridCheckout'
import { readHybridAttempt, saveHybridAttempt } from '@/lib/hybridIntent'
vi.mock('@/services/hybridBilling.service', () => ({
  hybridBilling: Object.fromEntries(
    ['offers', 'offer', 'current', 'purchase', 'quote', 'accept', 'resume', 'cancel', 'replacements'].map(k => [k, vi.fn()]),
  ),
}))
vi.mock('@/api', () => ({
  getConnectionStatus: () => ({ isOnline: true, isServerReachable: true }),
  subscribeToConnection: () => () => {},
}))
vi.mock('../FeatureCatalogBrowser', () => ({ FeatureCatalogBrowser: () => <p>Full catalog</p> }))
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
const terms = {
  currency: 'MXN',
  interval: 'MONTHLY',
  price: 379.5,
  taxIncluded: true,
  promotionCycles: 2,
  renewal: { kind: 'REPRICE', price: 499 },
} as const
const offer = {
  id: 'pub',
  name: 'Invoicing',
  slug: 'invoicing',
  definition: { schemaVersion: 1, kind: 'FEATURES', featureCodes: ['CFDI'], terms },
  includedFeatureCodes: ['CFDI'],
  purchaseAvailable: true,
  placesRemaining: 5,
  endsAt: '2030-01-01',
} as const
const purchase = {
  id: 'purchase',
  status: 'QUOTED',
  quoteHash: 'hash',
  quoteExpiresAt: '2030-01-01',
  paymentExpiresAt: null,
  lastIssue: null,
  quote: {
    schemaVersion: 1,
    lines: [{ publicationId: 'pub', name: 'Invoicing', kind: 'FEATURES', featureCodes: ['CFDI'], terms }],
    total: '379.50',
    dueNow: '379.50',
    credit: '0.00',
    existingBalance: '0.00',
    creditBalanceAfter: '0.00',
    replaces: [],
    droppedFeatureCodes: [],
    featureCodes: ['CFDI'],
  },
}
beforeEach(() => {
  const values = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
      removeItem: (k: string) => values.delete(k),
    },
  })
  vi.mocked(hybridBilling.offers).mockResolvedValue({ items: [offer], total: 1, page: 1, pageSize: 6 } as any)
  vi.mocked(hybridBilling.current).mockResolvedValue(null)
  vi.mocked(hybridBilling.replacements).mockResolvedValue({ items: [], total: 0, standaloneFeatureCodes: ['CHATBOT'] })
  vi.mocked(hybridBilling.quote).mockResolvedValue(purchase as any)
  vi.mocked(hybridBilling.purchase).mockResolvedValue(purchase as any)
  vi.mocked(hybridBilling.accept).mockImplementation(async (_v, id, body) => {
    expect(readHybridAttempt('venue')).toEqual({ id, clientKey: body.clientKey })
    vi.mocked(hybridBilling.purchase).mockResolvedValue({ ...purchase, status: 'PAYMENT_PENDING' } as any)
    return { purchaseId: id, status: 'PAYMENT_PENDING', paymentUrl: 'https://invoice.stripe.com/i/test' }
  })
})
function mount(onCompleted = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <HybridCheckout venueId="venue" onCompleted={onCompleted} />
    </QueryClientProvider>,
  )
}
it('reviews server prices and renewal, persists before acceptance, and waits for paid access', async () => {
  const user = userEvent.setup()
  const done = vi.fn()
  mount(done)
  await user.click(await screen.findByRole('button', { name: 'Add offer' }))
  await user.click(screen.getByRole('button', { name: 'Review quote' }))
  expect(await screen.findByText('Confirm your purchase')).toBeInTheDocument()
  expect(screen.getAllByText(/499.00/).length).toBeGreaterThan(0)
  const accept = screen.getByRole('button', { name: 'Accept terms and continue to payment' })
  expect(accept).toBeDisabled()
  await user.click(screen.getByRole('checkbox', { name: /I accept today/ }))
  await user.click(accept)
  expect(await screen.findByRole('link', { name: 'Open secure payment' })).toHaveAttribute('href', 'https://invoice.stripe.com/i/test')
  expect(done).not.toHaveBeenCalled()
  expect(hybridBilling.accept).toHaveBeenCalledTimes(1)
})
it.each(['PAYMENT_PENDING', 'PAID', 'DELIVERING', 'REQUIRES_REVIEW'])(
  'recovers %s from the server after browser storage is lost',
  async status => {
    vi.mocked(hybridBilling.current).mockResolvedValue({ ...purchase, status } as any)
    vi.mocked(hybridBilling.purchase).mockResolvedValue({ ...purchase, status } as any)
    mount()
    expect(await screen.findByText('Your purchase is in progress')).toBeInTheDocument()
    expect(hybridBilling.accept).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Review quote' })).not.toBeInTheDocument()
  },
)
it('never treats a return from the hosted invoice as activation', async () => {
  const done = vi.fn()
  vi.mocked(hybridBilling.current).mockResolvedValue({ ...purchase, status: 'PAYMENT_PENDING' } as any)
  vi.mocked(hybridBilling.purchase).mockResolvedValue({ ...purchase, status: 'PAYMENT_PENDING' } as any)
  vi.mocked(hybridBilling.resume).mockResolvedValue({ purchaseId: 'purchase', status: 'ACTIVATION_PENDING' })
  mount(done)
  await userEvent.click(await screen.findByRole('button', { name: 'Check again' }))
  await waitFor(() => expect(hybridBilling.resume).toHaveBeenCalled())
  expect(done).not.toHaveBeenCalled()
})
it('restores the selected publication after reload using current server terms', async () => {
  vi.mocked(hybridBilling.offer).mockResolvedValue(offer as any)
  const first = mount()
  await userEvent.click(await screen.findByRole('button', { name: 'Add offer' }))
  first.unmount()
  mount()
  expect(await screen.findByRole('button', { name: 'Remove offer' })).toBeInTheDocument()
  expect(hybridBilling.offer).toHaveBeenCalledWith('invoicing', expect.any(AbortSignal))
})
it('forgets the stored attempt once the caller finishes a completed purchase', async () => {
  const done = vi.fn()
  saveHybridAttempt('venue', { id: 'purchase', clientKey: 'key' })
  vi.mocked(hybridBilling.purchase).mockResolvedValue({ ...purchase, status: 'COMPLETED' } as any)
  mount(done)
  await userEvent.click(await screen.findByRole('button', { name: 'Continue' }))
  await waitFor(() => expect(done).toHaveBeenCalledWith('purchase'))
  await waitFor(() => expect(readHybridAttempt('venue')).toBeNull())
})
