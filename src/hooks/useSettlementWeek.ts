import { useQuery } from '@tanstack/react-query'
import { getSettlementWeek, type SettlementWeek } from '@/services/availableBalance.service'

/**
 * Loads the Monday–Sunday settlement week (by settlement date) for a venue.
 * Keyed by (venueId, weekStart) so paging weeks caches each one.
 */
export function useSettlementWeek(venueId: string, weekStart: string) {
  return useQuery<SettlementWeek>({
    queryKey: ['settlementWeek', venueId, weekStart],
    queryFn: async () => (await getSettlementWeek(venueId, weekStart)).data,
    enabled: !!venueId && !!weekStart,
    staleTime: 1000 * 60 * 5,
  })
}
