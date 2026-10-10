/**
 * Los tipos de producto alineados con Square (enero 2026, `ProductType` del server): los que ofrece el asistente de alta
 * (`ProductWizardDialog`) y la ficha de edición (`pages/Menu/Products/productId.tsx`). UNA sola lista y UNOS solos
 * nombres para los dos: la ficha no conocía `REGULAR` y obligaba a elegir un tipo viejo para poder guardar (W1, 10-oct).
 */
import type { ProductType } from '@/services/inventory.service'

/** En el orden en que se ofrecen. */
export const PRODUCT_TYPES_CANONICAL: ProductType[] = [
  'REGULAR',
  'FOOD_AND_BEV',
  'APPOINTMENTS_SERVICE',
  'CLASS',
  'EVENT',
  'DIGITAL',
  'DONATION',
  'OTHER',
]

export const PRODUCT_TYPE_LABELS: Record<ProductType, { en: string; es: string }> = {
  REGULAR: { en: 'Regular Item', es: 'Artículo Regular' },
  FOOD_AND_BEV: { en: 'Food & Beverage', es: 'Bebidas y alimentos preparados' },
  APPOINTMENTS_SERVICE: { en: 'Appointment/Service', es: 'Servicio con cita' },
  CLASS: { en: 'Class / Workshop', es: 'Clase / Taller' },
  EVENT: { en: 'Event', es: 'Evento' },
  DIGITAL: { en: 'Digital Good', es: 'Producto Digital' },
  DONATION: { en: 'Donation', es: 'Donación' },
  OTHER: { en: 'Other', es: 'Otro' },
}

/**
 * Los tipos viejos (`@deprecated` en el server: FOOD/BEVERAGE/ALCOHOL → FOOD_AND_BEV, RETAIL → REGULAR). Hay productos que
 * todavía los tienen: la ficha los muestra con su nombre de siempre (`products.create.types.*` de `menu`) y los conserva
 * si nadie toca el tipo, pero ya no los ofrece.
 */
export const LEGACY_PRODUCT_TYPES = ['FOOD', 'BEVERAGE', 'ALCOHOL', 'RETAIL', 'SERVICE'] as const

export const isCanonicalProductType = (type: string): type is ProductType => (PRODUCT_TYPES_CANONICAL as string[]).includes(type)
export const isLegacyProductType = (type: string): boolean => (LEGACY_PRODUCT_TYPES as readonly string[]).includes(type)

/** El nombre de un tipo canónico en el idioma de la interfaz (español salvo que el idioma sea otro). */
export const productTypeLabel = (type: ProductType, language: string): string =>
  language.startsWith('es') ? PRODUCT_TYPE_LABELS[type].es : PRODUCT_TYPE_LABELS[type].en
