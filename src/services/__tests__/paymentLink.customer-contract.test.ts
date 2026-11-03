import { beforeEach, describe, expect, it, vi } from 'vitest'
import paymentLinkService from '@/services/paymentLink.service'
import customerService from '@/services/customer.service'

const post = vi.hoisted(() => vi.fn())
vi.mock('@/api', () => ({ default: { post } }))
beforeEach(() => {
  post.mockResolvedValue({ data: { success: true, data: { id: 'link-a' } } })
})

describe('customer link transport', () => {
  it('sends customerId in the body and Idempotency-Key only in the header', async () => {
    const body = { title: 'Service', amountType: 'FIXED' as const, amount: 100, customerId: 'customer-a' }
    await paymentLinkService.createPaymentLink('venue-a', body, 'logical-attempt')
    expect(post).toHaveBeenCalledWith('/api/v1/dashboard/venues/venue-a/payment-links', body, {
      headers: { 'Idempotency-Key': 'logical-attempt' },
    })
  })
  it('preserves the anonymous legacy caller without requiring an idempotency key', async () => {
    const body = { title: 'Service', amountType: 'OPEN' as const }
    await paymentLinkService.createPaymentLink('venue-a', body)
    expect(post).toHaveBeenCalledWith('/api/v1/dashboard/venues/venue-a/payment-links', body, {})
  })
  it('returns the actual customer envelope, including consent warning', async () => {
    const envelope = { message: 'Created', customer: { id: 'customer-a' }, warning: 'CONSENT_NOT_CAPTURED' }
    post.mockResolvedValue({ data: envelope })
    expect(await customerService.createCustomer('venue-a', { email: 'alice@example.test' })).toEqual(envelope)
  })
})
