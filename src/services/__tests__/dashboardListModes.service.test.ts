import { beforeEach, describe, expect, it, vi } from 'vitest'

const getMock = vi.fn()

vi.mock('@/api', () => ({
  default: { get: (...args: unknown[]) => getMock(...args) },
}))

import { getOrders } from '@/services/order.service'
import { getPayments } from '@/services/payment.service'

describe('dashboard list services opt into bounded pagination', () => {
  beforeEach(() => {
    getMock.mockReset()
    getMock.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
  })

  it('payments sends paginated-v1 with the requested page', async () => {
    await getPayments('venue-1', 3, 100, { methods: ['CASH'] })

    expect(getMock).toHaveBeenCalledWith('/api/v1/dashboard/venues/venue-1/payments', {
      params: { page: 3, pageSize: 100, responseMode: 'paginated-v1', methods: 'CASH' },
    })
  })

  it('orders sends paginated-v1 with the requested page', async () => {
    await getOrders('venue-1', { pageIndex: 1, pageSize: 100 }, { statuses: ['COMPLETED'] })

    expect(getMock).toHaveBeenCalledWith('/api/v1/dashboard/venues/venue-1/orders', {
      params: { page: 2, pageSize: 100, responseMode: 'paginated-v1', statuses: 'COMPLETED' },
    })
  })
})
