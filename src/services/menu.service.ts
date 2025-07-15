import api from '@/api'

export const getMenus = async () => {
  const response = await api.get('/api/v1/dashboard/menus')
  return response.data
}
