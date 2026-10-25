import type { PaymentLinkDiscountInput, PaymentLinkDiscountView } from '@/services/paymentLink.service'

export type DiscountFormValue =
  | { mode: 'NONE' }
  | { mode: 'MANUAL'; type: 'PERCENTAGE' | 'FIXED_AMOUNT'; value: string; name: string }
  | { mode: 'CATALOG'; discountId: string }

/** Precarga el formulario con el descuento que ya tiene la liga. */
export function discountFromLink(d: PaymentLinkDiscountView | null | undefined): DiscountFormValue {
  if (!d) return { mode: 'NONE' }
  if (d.origen === 'CATALOGO' && d.discountId) return { mode: 'CATALOG', discountId: d.discountId }
  return { mode: 'MANUAL', type: d.type, value: String(d.value), name: d.name }
}

/**
 * Lo que se manda al servidor. Sin tocar → ni la llave (una liga con descuento vencido sigue aceptando
 * cambios de precio/título); quitar → `discount: null`.
 */
export function discountPayload(v: DiscountFormValue, touched: boolean): { discount?: PaymentLinkDiscountInput | null } {
  if (!touched) return {}
  if (v.mode === 'NONE') return { discount: null }
  if (v.mode === 'CATALOG') return { discount: { mode: 'CATALOG', discountId: v.discountId } }
  const name = v.name.trim()
  return { discount: { mode: 'MANUAL', type: v.type, value: Number(v.value), ...(name ? { name } : {}) } }
}

/** Qué le falta al descuento para poder guardarse (clave i18n bajo `discount.`), o null si está bien. */
export function discountError(v: DiscountFormValue): 'errorPick' | 'errorValue' | null {
  if (v.mode === 'CATALOG') return v.discountId ? null : 'errorPick'
  if (v.mode === 'MANUAL') return Number(v.value) > 0 ? null : 'errorValue'
  return null
}
