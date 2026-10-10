/**
 * Los tipos de producto alineados con Square (enero 2026, `ProductType` del server) y sus nombres: la MISMA fuente para el
 * asistente de alta (`ProductWizardDialog`, que muestra el tipo elegido con estos nombres) y la ficha de edición
 * (`pages/Menu/Products/productId.tsx`). La ficha no conocía `REGULAR` y obligaba a elegir un tipo viejo para guardar (W1).
 *
 * Qué se OFRECE no es lo mismo en los dos: el alta elige el tipo en `ProductTypeSelectorModal`, que pide la lista al server
 * (filtrada por la industria del negocio) y quita servicio con cita y clase, porque esos se crean y se manejan en
 * «Servicios». La ficha ofrece la lista fija de abajo sin esos dos (`PRODUCT_TYPES_EN_LA_FICHA`); un producto que YA es
 * servicio o clase los sigue viendo como su tipo guardado.
 */
import type { ProductType } from '@/services/inventory.service'

/** Los canónicos, en el orden en que se muestran. */
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

/** Los que maneja la pestaña «Servicios» (el alta tampoco los ofrece como artículo). */
export const SERVICE_PRODUCT_TYPES: ProductType[] = ['APPOINTMENTS_SERVICE', 'CLASS']

/** Lo que la ficha ofrece a cualquier producto: los canónicos sin servicio con cita ni clase. */
export const PRODUCT_TYPES_EN_LA_FICHA: ProductType[] = PRODUCT_TYPES_CANONICAL.filter(t => !SERVICE_PRODUCT_TYPES.includes(t))

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
