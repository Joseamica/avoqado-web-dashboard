import api from '@/api'

import {
  parseCommercialBillingOverview,
  parseCommercialBillingReceiptPage,
  type CommercialBillingOverview,
  type CommercialBillingReceiptPage,
} from './commercial-contract'

export async function getCommercialBillingOverview(venueId: string): Promise<CommercialBillingOverview> {
  const response = await api.get(`/api/v1/dashboard/commercial/venues/${venueId}/billing/overview`)
  return parseCommercialBillingOverview(response.data.data)
}

export async function getCommercialBillingReceipts(
  venueId: string,
  cursor: string | null,
  limit = 25,
): Promise<CommercialBillingReceiptPage> {
  const response = await api.get(`/api/v1/dashboard/commercial/venues/${venueId}/billing/receipts`, {
    params: { ...(cursor ? { cursor } : {}), limit },
  })
  return parseCommercialBillingReceiptPage(response.data.data)
}
