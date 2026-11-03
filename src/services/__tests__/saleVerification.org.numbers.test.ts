import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listOrgSaleVerifications, setOrgSaleVerificationNumbers, getLinkingNumberStatus } from '@/services/saleVerification.org.service'

const mockGet = vi.fn()
const mockPatch = vi.fn()
vi.mock('@/api', () => ({
  default: { get: (...a: unknown[]) => mockGet(...a), patch: (...a: unknown[]) => mockPatch(...a) },
}))

beforeEach(() => {
  mockGet.mockReset()
  mockPatch.mockReset()
})

describe('números de vinculación (servicio de ventas de la organización)', () => {
  it('manda numberAlert=duplicate en la lista', async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: [], pagination: {} } })
    await listOrgSaleVerifications('org1', { numberAlert: 'duplicate' })
    expect(mockGet).toHaveBeenCalledWith('/api/v1/dashboard/organizations/org1/sale-verifications?numberAlert=duplicate')
  })

  it('PATCH /numbers con el cuerpo exacto y devuelve data', async () => {
    mockPatch.mockResolvedValue({ data: { data: { id: 'sv1' } } })
    const body = { linkingNumber: '5512345678', portedNumber: '5598765432', allowNineDigits: true, reason: 'typo' }
    const res = await setOrgSaleVerificationNumbers('org1', 'sv1', body)
    expect(mockPatch).toHaveBeenCalledWith('/api/v1/dashboard/organizations/org1/sale-verifications/sv1/numbers', body)
    expect(res).toEqual({ id: 'sv1' })
  })

  it('getLinkingNumberStatus lee enabled', async () => {
    mockGet.mockResolvedValue({ data: { success: true, enabled: true } })
    expect(await getLinkingNumberStatus('org1')).toBe(true)
    expect(mockGet).toHaveBeenCalledWith('/api/v1/dashboard/organizations/org1/sale-verifications/linking-number-status')
  })
})
