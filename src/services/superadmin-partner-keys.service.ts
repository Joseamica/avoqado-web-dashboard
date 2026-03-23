import api from '@/api'

export interface PartnerAPIKey {
  id: string
  name: string
  organizationId: string
  organization: { name: string }
  sandboxMode: boolean
  active: boolean
  lastUsedAt: string | null
  createdAt: string
}

export interface CreatePartnerKeyData {
  organizationId: string
  name: string
  sandboxMode: boolean
}

export interface CreatePartnerKeyResponse {
  success: boolean
  data: {
    id: string
    name: string
    secretKey: string
    sandboxMode: boolean
    message: string
  }
}

export async function getPartnerKeys(): Promise<PartnerAPIKey[]> {
  const res = await api.get('/api/v1/superadmin/partner-keys')
  return res.data.data
}

export async function createPartnerKey(data: CreatePartnerKeyData): Promise<CreatePartnerKeyResponse> {
  const res = await api.post('/api/v1/superadmin/partner-keys', data)
  return res.data
}

export async function deactivatePartnerKey(id: string): Promise<void> {
  await api.delete(`/api/v1/superadmin/partner-keys/${id}`)
}
