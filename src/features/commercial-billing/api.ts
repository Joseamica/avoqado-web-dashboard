import api from '@/api'

import {
  parseCommercialBillingOverview,
  parseCommercialBillingReceiptPage,
  parseCommercialConfiguratorPreview,
  type CommercialBillingOverview,
  type CommercialBillingReceiptPage,
  type CommercialConfiguratorPreview,
  type CommercialConfiguratorSelection,
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

export async function previewCommercialConfigurator(
  venueId: string,
  selection: CommercialConfiguratorSelection,
  signal?: AbortSignal,
): Promise<CommercialConfiguratorPreview> {
  const response = await api.post(
    `/api/v1/dashboard/commercial/venues/${venueId}/billing/configurator/preview`,
    { selection },
    { signal },
  )
  return parseCommercialConfiguratorPreview(response.data.data)
}
