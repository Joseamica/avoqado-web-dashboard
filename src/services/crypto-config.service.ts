import api from '@/api'

export type CryptoConfigStatus = 'PENDING_SETUP' | 'ACTIVE' | 'INACTIVE'

export interface CryptoConfig {
  id: string
  venueId: string
  b4bitDeviceId: string
  b4bitDeviceName: string
  hasSecretKey: boolean
  b4bitSecretKeyMasked: string | null
  status: CryptoConfigStatus
  webhookUrl: string
  b4bitDashboardUrl: string
  createdAt: string
  updatedAt: string
}

export interface B4BitDevice {
  deviceId: string
  name: string
}

export const cryptoConfigService = {
  async getConfig(venueId: string): Promise<CryptoConfig | null> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/crypto/config`)
    return response.data.data
  },

  async listDevices(): Promise<B4BitDevice[]> {
    const response = await api.get('/api/v1/dashboard/crypto/devices')
    return response.data.data
  },

  async enableCrypto(venueId: string): Promise<CryptoConfig> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/crypto/enable`)
    return response.data.data
  },

  async completeCryptoSetup(venueId: string, deviceId: string, secretKey: string): Promise<CryptoConfig> {
    const response = await api.put(`/api/v1/dashboard/venues/${venueId}/crypto/setup`, { deviceId, secretKey })
    return response.data.data
  },

  async disableCrypto(venueId: string): Promise<CryptoConfig> {
    const response = await api.put(`/api/v1/dashboard/venues/${venueId}/crypto/disable`)
    return response.data.data
  },
}

export default cryptoConfigService
