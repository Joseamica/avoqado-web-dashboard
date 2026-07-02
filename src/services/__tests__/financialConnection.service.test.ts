import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

import api from '@/api'
import { financialConnectionAPI } from '@/services/financialConnection.service'

const mocked = api as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('financialConnectionAPI', () => {
  it('listProviders: GET al catálogo y desenvuelve data', async () => {
    mocked.get.mockResolvedValue({ data: { success: true, data: [{ id: 'p1', code: 'EXTERNAL_BANK', name: 'Banco', active: true }] } })
    const r = await financialConnectionAPI.listProviders()
    expect(mocked.get).toHaveBeenCalledWith('/api/v1/dashboard/financial-providers')
    expect(r[0].code).toBe('EXTERNAL_BANK')
  })

  it('listConnections: GET venue-scoped y desenvuelve data', async () => {
    mocked.get.mockResolvedValue({ data: { success: true, data: [{ id: 'c1', status: 'CONNECTED', provider: { code: 'X', name: 'Banco' }, accounts: [] }] } })
    const r = await financialConnectionAPI.listConnections('v1')
    expect(mocked.get).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/financial-connections')
    expect(r[0].status).toBe('CONNECTED')
  })

  it('createConnection: POST credenciales, devuelve el paso (2FA)', async () => {
    mocked.post.mockResolvedValue({ data: { success: true, data: { connectionId: 'c9', status: 'PENDING_TWO_FACTOR_AUTH' } } })
    const r = await financialConnectionAPI.createConnection('v1', { providerId: 'p1', email: 'a@b.co', password: 'x' })
    expect(mocked.post).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/financial-connections', {
      providerId: 'p1',
      email: 'a@b.co',
      password: 'x',
    })
    expect(r.status).toBe('PENDING_TWO_FACTOR_AUTH')
  })

  it('validateTwoFactor / validateDevice / selectAccount: POST al endpoint correcto', async () => {
    mocked.post.mockResolvedValue({ data: { success: true, data: { connectionId: 'c9', status: 'CONNECTED' } } })
    await financialConnectionAPI.validateTwoFactor('v1', 'c9', '123456')
    expect(mocked.post).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/financial-connections/c9/validate-2fa', { code: '123456' })
    await financialConnectionAPI.validateDevice('v1', 'c9', '654321')
    expect(mocked.post).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/financial-connections/c9/validate-device', { code: '654321' })
    await financialConnectionAPI.selectAccount('v1', 'c9', 'neg-1')
    expect(mocked.post).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/financial-connections/c9/select-account', { externalId: 'neg-1' })
  })

  it('getBalance: GET saldo de una cuenta; un amount null se preserva null (nunca 0)', async () => {
    mocked.get.mockResolvedValue({ data: { success: true, data: { amount: null, currency: 'MXN', syncedAt: null, state: 'ERROR' } } })
    const r = await financialConnectionAPI.getBalance('v1', 'fa1')
    expect(mocked.get).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/financial-accounts/fa1/balance')
    expect(r.amount).toBeNull()
    expect(r.state).toBe('ERROR')
  })

  it('disconnect: DELETE a la conexión', async () => {
    mocked.delete.mockResolvedValue({ data: { success: true } })
    await financialConnectionAPI.disconnect('v1', 'c9')
    expect(mocked.delete).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/financial-connections/c9')
  })
})
