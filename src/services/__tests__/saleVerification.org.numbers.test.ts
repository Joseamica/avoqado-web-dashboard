import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  listOrgSaleVerifications,
  setOrgSaleVerificationNumbers,
  getLinkingNumberStatus,
  useOrgLinkingNumberEnabled,
} from '@/services/saleVerification.org.service'

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

  it('getLinkingNumberStatus lanza si la respuesta no trae un booleano (no es «apagado»)', async () => {
    mockGet.mockResolvedValue({ data: { success: true } })
    await expect(getLinkingNumberStatus('org1')).rejects.toThrow()
    mockGet.mockResolvedValue({ data: { success: true, enabled: 'true' } })
    await expect(getLinkingNumberStatus('org1')).rejects.toThrow()
  })
})

describe('useOrgLinkingNumberEnabled', () => {
  const wrapper = () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children)
  }

  it('undefined mientras carga; true/false sólo de una respuesta real', async () => {
    let resolve!: (v: unknown) => void
    mockGet.mockReturnValue(new Promise(r => (resolve = r)))
    const { result } = renderHook(() => useOrgLinkingNumberEnabled('org1'), { wrapper: wrapper() })
    expect(result.current.enabled).toBeUndefined()
    expect(result.current.isError).toBe(false)
    resolve({ data: { success: true, enabled: false } })
    await waitFor(() => expect(result.current.enabled).toBe(false))

    mockGet.mockResolvedValue({ data: { success: true, enabled: true } })
    const on = renderHook(() => useOrgLinkingNumberEnabled('org1'), { wrapper: wrapper() })
    await waitFor(() => expect(on.result.current.enabled).toBe(true))
  })

  it('con error, o con una respuesta sin booleano, queda undefined e isError', async () => {
    mockGet.mockRejectedValue(new Error('Network Error'))
    const caida = renderHook(() => useOrgLinkingNumberEnabled('org1'), { wrapper: wrapper() })
    await waitFor(() => expect(caida.result.current.isError).toBe(true))
    expect(caida.result.current.enabled).toBeUndefined()

    mockGet.mockResolvedValue({ data: { success: true } })
    const rara = renderHook(() => useOrgLinkingNumberEnabled('org1'), { wrapper: wrapper() })
    await waitFor(() => expect(rara.result.current.isError).toBe(true))
    expect(rara.result.current.enabled).toBeUndefined()
  })
})
