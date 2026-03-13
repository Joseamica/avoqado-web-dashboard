/**
 * Dashboard Engine — Data Availability
 *
 * Maps each BusinessCategory to the DataModules the current backend
 * can realistically provide. Hardcoded for now — future enhancement
 * could read from venue.features[] and venue.venueModules[].
 */

import type { BusinessCategory } from '@/types'
import type { DataModule } from './types'

const DATA_AVAILABILITY: Record<BusinessCategory, DataModule[]> = {
  FOOD_SERVICE: [
    'payments',
    'reviews',
    'tips',
    'orders',
    'staff_performance',
    'table_performance',
    'kitchen_performance',
    'reservations',
  ],
  RETAIL: ['payments', 'reviews', 'orders', 'staff_performance'],
  SERVICES: ['payments', 'reviews', 'tips', 'orders', 'staff_performance', 'reservations'],
  HOSPITALITY: ['payments', 'reviews', 'tips', 'orders', 'staff_performance', 'reservations'],
  ENTERTAINMENT: ['payments', 'reviews', 'tips', 'orders', 'staff_performance'],
  OTHER: ['payments', 'reviews', 'orders'],
}

export function getDataAvailability(category: BusinessCategory): Set<DataModule> {
  return new Set(DATA_AVAILABILITY[category] || DATA_AVAILABILITY.OTHER)
}
