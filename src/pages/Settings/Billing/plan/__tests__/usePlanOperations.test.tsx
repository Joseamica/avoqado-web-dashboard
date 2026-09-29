// src/pages/Settings/Billing/plan/__tests__/usePlanOperations.test.tsx
import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPlanCheckoutSession, downgradeVenueToFree, getBillingPortalUrl } from '@/services/features.service'
import { hybridBilling } from '@/services/hybridBilling.service'
import { saveHybridAttempt } from '@/lib/hybridIntent'
import { serverCode, serverMessage, usePlanOperations } from '../usePlanOperations'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
const toast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/lib/hybridIntent', () => ({ saveHybridAttempt: vi.fn() }))
vi.mock('@/services/features.service', () => ({
  createPlanCheckoutSession: vi.fn(),
  downgradeVenueToFree: vi.fn(),
  getDowngradePreview: vi.fn(),
  reactivateVenuePlan: vi.fn(),
  getBillingPortalUrl: vi.fn(),
  applyRetentionOffer: vi.fn(),
}))
vi.mock('@/services/hybridBilling.service', () => ({ hybridBilling: { quote: vi.fn(), cancelContract: vi.fn() } }))

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{children}</QueryClientProvider>
)
const body = { lines: [{ publicationId: 'pub_1', selectedFeatureCodes: [] }], replaceSubscriptionIds: [], dropFeatureCodes: [] }

beforeEach(() => {
  toast.mockReset()
})

describe('usePlanOperations', () => {
  it('saves the attempt BEFORE opening the checkout, so a lost answer never charges twice', async () => {
    const order: string[] = []
    vi.mocked(hybridBilling.quote).mockResolvedValue({ id: 'quote_1' } as never)
    vi.mocked(saveHybridAttempt).mockImplementation(() => void order.push('saved'))
    const open = vi.fn(() => void order.push('open'))
    const { result } = renderHook(() => usePlanOperations('venue', open), { wrapper })
    await act(() => result.current.hybridQuote.mutateAsync(body))
    expect(order).toEqual(['saved', 'open'])
    expect(saveHybridAttempt).toHaveBeenCalledWith('venue', { id: 'quote_1', clientKey: expect.any(String) })
  })

  it('the downgrade carries the reason; a refusal toasts the server message', async () => {
    vi.mocked(downgradeVenueToFree).mockResolvedValue({} as never)
    const { result } = renderHook(() => usePlanOperations('venue', vi.fn()), { wrapper })
    await act(() => result.current.downgrade.mutateAsync({ keep: ['sv-owner'], input: { reason: 'UNUSED' } }))
    expect(downgradeVenueToFree).toHaveBeenCalledWith('venue', ['sv-owner'], { reason: 'UNUSED' })
    vi.mocked(downgradeVenueToFree).mockRejectedValue({ response: { data: { message: 'El propietario debe conservar su acceso.' } } })
    await act(() => result.current.downgrade.mutateAsync({ keep: [], input: {} }).catch(() => undefined))
    expect(toast).toHaveBeenLastCalledWith({ title: 'El propietario debe conservar su acceso.', variant: 'destructive' })
  })

  it('the contract cancellation carries the reason and the observed revision', async () => {
    vi.mocked(hybridBilling.cancelContract).mockResolvedValue({} as never)
    const { result } = renderHook(() => usePlanOperations('venue', vi.fn()), { wrapper })
    await act(() => result.current.cancelContract.mutateAsync({ contractId: 'hc_1', revision: 3, input: { reason: 'TEMPORARY' } }))
    expect(hybridBilling.cancelContract).toHaveBeenCalledWith('venue', 'hc_1', 3, { reason: 'TEMPORARY' })
  })

  it('the classic checkout fails when the server returns no url, instead of navigating to "undefined"', async () => {
    vi.mocked(createPlanCheckoutSession).mockResolvedValue(undefined as never)
    const { result } = renderHook(() => usePlanOperations('venue', vi.fn()), { wrapper })
    let failure: unknown
    await act(() => result.current.classicCheckout.mutateAsync({ tier: 'PRO', interval: 'monthly' }).catch(value => void (failure = value)))
    expect(createPlanCheckoutSession).toHaveBeenCalledWith('venue', 'PRO', 'monthly')
    expect(failure).toBeInstanceOf(Error)
  })

  it('reads the code and the message of a server refusal', () => {
    expect(serverCode({ response: { data: { code: 'PLAN_ABSORBE_SUELTA' } } })).toBe('PLAN_ABSORBE_SUELTA')
    expect(serverMessage({}, 'respaldo')).toBe('respaldo')
  })

  it("a server failure (5xx) shows our message, never the server's internal one in English", () => {
    const failure = (status: number, message: string) => ({ response: { status, data: { message } } })
    expect(serverMessage(failure(500, 'Feature PLAN_PRO not found or inactive'), 'respaldo')).toBe('respaldo')
    expect(serverMessage(failure(409, 'La oferta cambió o terminó.'), 'respaldo')).toBe('La oferta cambió o terminó.')
  })

  it('a billing portal that answers without a link says so instead of doing nothing', async () => {
    vi.mocked(getBillingPortalUrl).mockResolvedValue({ url: '' } as never)
    const { result } = renderHook(() => usePlanOperations('venue', vi.fn()), { wrapper })
    await act(() => result.current.portal.mutateAsync().catch(() => undefined))
    expect(toast).toHaveBeenLastCalledWith({ title: 'currentPlan.toast.error', variant: 'destructive' })
  })
})
