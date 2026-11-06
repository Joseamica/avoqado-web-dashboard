import { VenueType } from '@/types'

/** Giros cuyas reservas pueden ser de una mesa. */
export const VENUE_TYPES_WITH_TABLES = new Set<string>([
  VenueType.RESTAURANT,
  VenueType.BAR,
  VenueType.CAFE,
  VenueType.BAKERY,
  VenueType.FAST_FOOD,
  VenueType.CATERING,
  VenueType.FOOD_TRUCK,
  VenueType.CLOUD_KITCHEN,
  VenueType.HOTEL,
  VenueType.HOSTEL,
  VenueType.RESORT,
])

/**
 * D27/D29: 2 personas es la costumbre de una MESA (negocio con mesas y sin servicio elegido); una cita, una clase o un
 * evento es de 1. La usan «Crear cita» del panel y la página pública de reservas.
 */
export function suggestedPartySize(venueType: string | null | undefined, hasService: boolean): number {
  return venueType && VENUE_TYPES_WITH_TABLES.has(venueType) && !hasService ? 2 : 1
}
