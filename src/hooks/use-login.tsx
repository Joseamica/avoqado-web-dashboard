// src/hooks/useAuth.js
import api from '@/api'
import { useQuery } from '@tanstack/react-query'

export const useLogin = () => {
  const {
    data,
    isLoading,
    error: statusError,
    isError,
    isSuccess,
  } = useQuery({
    queryKey: ['status'],
    queryFn: async () => {
      const response = await api.get(`/v1/auth/status`)
      if (!response) {
        throw new Error('Failed to fetch auth status')
      }
      return response.data
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
  return {
    data,
    isLoading,
    error: statusError,
    isError,
    isSuccess,
  }
}
