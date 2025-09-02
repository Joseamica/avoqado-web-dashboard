import api from '@/api'

export const getTpvs = async (venueId: string, pagination: { pageIndex: number; pageSize: number }) => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/tpvs`, {
    params: {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
    },
  })
  return response.data
}

export const sendTpvCommand = async (terminalId: string, command: string, payload?: any) => {
  const response = await api.post(`/api/v1/dashboard/tpv/${terminalId}/command`, {
    command,
    payload,
  })
  return response.data
}
