import { useQuery } from '@tanstack/react-query'
import { getPrintStations } from '@/services/printStations.service'

/**
 * Fetch the venue's print stations (kitchen/service ticket routing).
 * Used by <PrintStationField> to populate the "prints at" selector on
 * product and category forms. Returns an empty list — never an error toast —
 * when the venue has none configured, so the field can render nothing.
 */
export function usePrintStations(venueId?: string | null) {
  return useQuery({
    queryKey: ['printStations', venueId],
    queryFn: () => getPrintStations(venueId!),
    enabled: !!venueId,
  })
}
