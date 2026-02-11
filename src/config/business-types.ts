/**
 * Business Type Categories
 *
 * Maps VenueType enum values to categories for the setup wizard.
 * Values MUST match the VenueType Prisma enum exactly.
 * i18n keys reference src/locales/{lang}/setup.json
 */

export interface BusinessTypeItem {
  value: string
  labelKey: string
}

export interface BusinessTypeCategory {
  category: string
  labelKey: string
  types: BusinessTypeItem[]
}

export const BUSINESS_TYPE_CATEGORIES: BusinessTypeCategory[] = [
  {
    category: 'FOOD_SERVICE',
    labelKey: 'setup:businessType.categories.foodService',
    types: [
      { value: 'RESTAURANT', labelKey: 'setup:businessType.types.restaurant' },
      { value: 'FAST_FOOD', labelKey: 'setup:businessType.types.fastFood' },
      { value: 'BAR', labelKey: 'setup:businessType.types.bar' },
      { value: 'CAFE', labelKey: 'setup:businessType.types.cafe' },
      { value: 'BAKERY', labelKey: 'setup:businessType.types.bakery' },
      { value: 'FOOD_TRUCK', labelKey: 'setup:businessType.types.foodTruck' },
      { value: 'CATERING', labelKey: 'setup:businessType.types.catering' },
      { value: 'CLOUD_KITCHEN', labelKey: 'setup:businessType.types.cloudKitchen' },
    ],
  },
  {
    category: 'RETAIL',
    labelKey: 'setup:businessType.categories.retail',
    types: [
      { value: 'RETAIL_STORE', labelKey: 'setup:businessType.types.retailStore' },
      { value: 'CONVENIENCE_STORE', labelKey: 'setup:businessType.types.convenienceStore' },
      { value: 'CLOTHING', labelKey: 'setup:businessType.types.clothing' },
      { value: 'ELECTRONICS', labelKey: 'setup:businessType.types.electronics' },
      { value: 'PHARMACY', labelKey: 'setup:businessType.types.pharmacy' },
      { value: 'TELECOMUNICACIONES', labelKey: 'setup:businessType.types.telecom' },
    ],
  },
  {
    category: 'SERVICES',
    labelKey: 'setup:businessType.categories.services',
    types: [
      { value: 'SALON', labelKey: 'setup:businessType.types.salon' },
      { value: 'SPA', labelKey: 'setup:businessType.types.spa' },
      { value: 'FITNESS', labelKey: 'setup:businessType.types.fitness' },
      { value: 'CLINIC', labelKey: 'setup:businessType.types.clinic' },
      { value: 'VETERINARY', labelKey: 'setup:businessType.types.veterinary' },
      { value: 'AUTO_SERVICE', labelKey: 'setup:businessType.types.autoService' },
      { value: 'LAUNDRY', labelKey: 'setup:businessType.types.laundry' },
      { value: 'REPAIR_SHOP', labelKey: 'setup:businessType.types.repairShop' },
    ],
  },
  {
    category: 'HOSPITALITY',
    labelKey: 'setup:businessType.categories.hospitality',
    types: [
      { value: 'HOTEL', labelKey: 'setup:businessType.types.hotel' },
      { value: 'HOSTEL', labelKey: 'setup:businessType.types.hostel' },
      { value: 'RESORT', labelKey: 'setup:businessType.types.resort' },
    ],
  },
  {
    category: 'ENTERTAINMENT',
    labelKey: 'setup:businessType.categories.entertainment',
    types: [
      { value: 'CINEMA', labelKey: 'setup:businessType.types.cinema' },
      { value: 'NIGHTCLUB', labelKey: 'setup:businessType.types.nightclub' },
      { value: 'EVENT_VENUE', labelKey: 'setup:businessType.types.eventVenue' },
      { value: 'ARCADE', labelKey: 'setup:businessType.types.arcade' },
      { value: 'BOWLING', labelKey: 'setup:businessType.types.bowling' },
    ],
  },
  {
    category: 'OTHER',
    labelKey: 'setup:businessType.categories.other',
    types: [
      { value: 'OTHER', labelKey: 'setup:businessType.types.other' },
    ],
  },
]

/** Flat list of all business types for search */
export const ALL_BUSINESS_TYPES = BUSINESS_TYPE_CATEGORIES.flatMap(cat =>
  cat.types.map(type => ({
    ...type,
    category: cat.category,
    categoryLabelKey: cat.labelKey,
  })),
)
