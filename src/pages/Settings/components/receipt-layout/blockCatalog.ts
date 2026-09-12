import {
  Coins,
  CreditCard,
  FileText,
  Hash,
  Image,
  Info,
  MapPin,
  MessageSquare,
  Minus,
  Package,
  Phone,
  QrCode,
  Receipt,
  Sparkles,
  Store,
  Ticket,
  User,
  WholeWord,
  type LucideIcon,
} from 'lucide-react'

/**
 * El catálogo de bloques (spec § 5.1), espejo del `discriminatedUnion` del servidor
 * (`avoqado-server/src/services/shared/receiptLayout/schema.ts`). El conjunto de OBLIGATORIOS
 * está CERRADO y nunca crece: son los siete que el servidor rechaza quitar.
 *
 * ✅ Los iconos se comprobaron uno por uno contra `lucide-react` 0.456. `Spell` NO existe en esa
 * versión —un import inexistente tumba el build entero—, así que `amountInWords` usa `WholeWord`.
 */

export type LockClass = 'legal' | 'operativo' | 'plataforma'

/** Las opciones que el bloque acepta. Espejo EXACTO del Zod del servidor. */
export type BlockOption =
  | 'align'
  | 'emphasis'
  | 'size'
  | 'lines'
  | 'caption'
  | 'style'
  | 'showOrderType'
  | 'showModifiers'
  | 'showNotes'
  | 'showSubtotal'
  | 'showTax'
  | 'showDiscount'
  | 'showTip'
  | 'showChange'
  | 'showCardLastFour'
  | 'showTransactionId'
  | 'showAppVersion'

export interface BlockMeta {
  labelKey: string
  descriptionKey: string
  icon: LucideIcon
  /** Sin `lock` el bloque se puede quitar. Con `lock`, sólo se puede MOVER. */
  lock?: LockClass
  /** Cuántas veces cabe. El servidor rechaza con RECEIPT_LAYOUT_TOO_MANY_BLOCKS al pasarse. */
  max: number
  options: BlockOption[]
}

export const BLOCK_CATALOG: Record<string, BlockMeta> = {
  logo: { labelKey: 'blocks.logo.label', descriptionKey: 'blocks.logo.desc', icon: Image, max: 1, options: ['size', 'align'] },
  businessName: {
    labelKey: 'blocks.businessName.label',
    descriptionKey: 'blocks.businessName.desc',
    icon: Store,
    max: 1,
    options: ['align', 'emphasis'],
  },
  fiscal: { labelKey: 'blocks.fiscal.label', descriptionKey: 'blocks.fiscal.desc', icon: FileText, lock: 'legal', max: 1, options: ['align'] },
  address: { labelKey: 'blocks.address.label', descriptionKey: 'blocks.address.desc', icon: MapPin, max: 1, options: ['align'] },
  phone: { labelKey: 'blocks.phone.label', descriptionKey: 'blocks.phone.desc', icon: Phone, max: 1, options: ['align'] },
  text: {
    labelKey: 'blocks.text.label',
    descriptionKey: 'blocks.text.desc',
    icon: MessageSquare,
    max: 8,
    options: ['lines', 'align', 'emphasis'],
  },
  orderInfo: {
    labelKey: 'blocks.orderInfo.label',
    descriptionKey: 'blocks.orderInfo.desc',
    icon: Receipt,
    lock: 'legal',
    max: 1,
    options: ['showOrderType'],
  },
  staff: { labelKey: 'blocks.staff.label', descriptionKey: 'blocks.staff.desc', icon: User, max: 1, options: [] },
  items: {
    labelKey: 'blocks.items.label',
    descriptionKey: 'blocks.items.desc',
    icon: Package,
    lock: 'legal',
    max: 1,
    options: ['showModifiers', 'showNotes'],
  },
  totals: {
    labelKey: 'blocks.totals.label',
    descriptionKey: 'blocks.totals.desc',
    icon: Coins,
    lock: 'legal',
    max: 1,
    options: ['showSubtotal', 'showTax', 'showDiscount', 'showTip'],
  },
  payment: {
    labelKey: 'blocks.payment.label',
    descriptionKey: 'blocks.payment.desc',
    icon: CreditCard,
    lock: 'operativo',
    max: 1,
    options: ['showChange', 'showCardLastFour'],
  },
  amountInWords: {
    labelKey: 'blocks.amountInWords.label',
    descriptionKey: 'blocks.amountInWords.desc',
    icon: WholeWord,
    max: 1,
    options: [],
  },
  areaDelivery: {
    labelKey: 'blocks.areaDelivery.label',
    descriptionKey: 'blocks.areaDelivery.desc',
    icon: Ticket,
    lock: 'operativo',
    max: 1,
    options: [],
  },
  qr: { labelKey: 'blocks.qr.label', descriptionKey: 'blocks.qr.desc', icon: QrCode, max: 1, options: ['caption'] },
  fiscalNotice: { labelKey: 'blocks.fiscalNotice.label', descriptionKey: 'blocks.fiscalNotice.desc', icon: Info, max: 1, options: [] },
  reference: {
    labelKey: 'blocks.reference.label',
    descriptionKey: 'blocks.reference.desc',
    icon: Hash,
    max: 1,
    options: ['showTransactionId', 'showAppVersion'],
  },
  separator: { labelKey: 'blocks.separator.label', descriptionKey: 'blocks.separator.desc', icon: Minus, max: 10, options: ['style'] },
  signature: {
    labelKey: 'blocks.signature.label',
    descriptionKey: 'blocks.signature.desc',
    icon: Sparkles,
    lock: 'plataforma',
    max: 1,
    options: [],
  },
}

export const BLOCK_TYPES = Object.keys(BLOCK_CATALOG)

/** Los siete que se pueden MOVER pero no quitar. Conjunto cerrado (spec § 5.1). */
export const MANDATORY_TYPES = Object.entries(BLOCK_CATALOG)
  .filter(([, meta]) => meta.lock)
  .map(([type]) => type)

/**
 * 🔴 Un tooltip por CLASE, no uno solo para todos. Decir «lo exige la ley» de `areaDelivery`
 * (operativo) o de `signature` (de plataforma) sería falso — y es el P3-2 de la auditoría de
 * Codex al spec. Mentirle al dueño sobre por qué no puede quitar algo se nota.
 */
export const LOCK_TOOLTIP_KEY: Record<LockClass, string> = {
  legal: 'locks.legal',
  operativo: 'locks.operativo',
  plataforma: 'locks.plataforma',
}

/** La letra del candado. El estado NUNCA se comunica sólo con color (WCAG + `.impeccable.md`). */
export const LOCK_BADGE: Record<LockClass, string> = { legal: 'L', operativo: 'O', plataforma: 'P' }

/** Los valores por default del servidor, para cuando se agrega un bloque nuevo. */
export const BLOCK_DEFAULTS: Record<string, Record<string, unknown>> = {
  logo: { size: 'M', align: 'center' },
  businessName: { align: 'center', emphasis: 'double' },
  fiscal: { align: 'center' },
  address: { align: 'center' },
  phone: { align: 'center' },
  text: { lines: [''], align: 'center', emphasis: 'normal' },
  orderInfo: { showOrderType: true },
  staff: {},
  items: { showModifiers: true, showNotes: true },
  totals: { showSubtotal: true, showTax: true, showDiscount: true, showTip: true },
  payment: { showChange: true, showCardLastFour: true },
  amountInWords: {},
  areaDelivery: {},
  qr: { caption: 'Escanea para tu recibo y factura' },
  fiscalNotice: {},
  reference: { showTransactionId: true, showAppVersion: false },
  separator: { style: 'line' },
  signature: {},
}

export function blockMeta(type: string): BlockMeta | undefined {
  return BLOCK_CATALOG[type]
}

export function isLocked(type: string): boolean {
  return Boolean(BLOCK_CATALOG[type]?.lock)
}
