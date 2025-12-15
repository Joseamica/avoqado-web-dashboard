import { useQuery } from '@tanstack/react-query'
import { productInventoryApi, type InventoryMovement } from '@/services/inventory.service'

interface UseRecentMovementsOptions {
  venueId: string
  productId: string | null
  enabled?: boolean
  limit?: number
}

export function useRecentMovements({ venueId, productId, enabled = true, limit = 5 }: UseRecentMovementsOptions) {
  const { data: movementsData = [], isLoading } = useQuery({
    queryKey: ['productInventoryMovements', venueId, productId],
    queryFn: async () => {
      if (!productId) return []
      const response = await productInventoryApi.getMovements(venueId, productId)
      // Handle both array and object responses
      const data = response.data
      if (Array.isArray(data)) {
        return data
      }
      // If response.data is wrapped in a data property
      if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as any).data)) {
        return (data as any).data
      }
      // Fallback to empty array
      return []
    },
    enabled: enabled && !!productId,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
  })

  // Ensure movements is an array before slicing
  const movements = Array.isArray(movementsData) ? movementsData : []

  // Limit to last N movements
  const recentMovements = movements.slice(0, limit) as InventoryMovement[]
  const hasRecentMovements = recentMovements.length > 0

  return {
    movements: recentMovements,
    isLoading,
    hasRecentMovements,
  }
}
