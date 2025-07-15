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
