/**
 * Cómo se ve una acción de la bitácora: su color (por tono) y su icono (por familia).
 *
 * Lo usan la bitácora del NEGOCIO y la de la ORGANIZACIÓN. Antes la de organización tenía su propio mapa fijo de
 * ~24 acciones y todo lo demás salía gris (hz:8024bc1c:D32): una sola fuente para que las dos digan lo mismo.
 */
import type { ElementType } from 'react'
import {
  Ban,
  Banknote,
  Boxes,
  CalendarClock,
  CircleCheck,
  FileText,
  LogIn,
  Pencil,
  Plus,
  Printer,
  Shield,
  ShoppingCart,
  Smartphone,
  Store,
  Tag,
  Trash2,
  User,
} from 'lucide-react'
import type { ActionTone } from './formatActivity'

/** Colores por tono. Cada uno lleva su variante dark explícita. `chip` es el fondo del icono en la tabla de organización. */
export const TONE_STYLES: Record<ActionTone, { icon: string; dot: string; chip: string }> = {
  destructive: { icon: 'text-red-600 dark:text-red-400', dot: 'bg-red-500', chip: 'bg-red-100 dark:bg-red-900/30' },
  attention: { icon: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500', chip: 'bg-amber-100 dark:bg-amber-900/30' },
  positive: { icon: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500', chip: 'bg-emerald-100 dark:bg-emerald-900/30' },
  neutral: { icon: 'text-muted-foreground', dot: 'bg-muted-foreground/40', chip: 'bg-muted' },
}

/**
 * Icono por FAMILIA de acción, no por código exacto.
 * El servidor emite más de 500 códigos: un mapa uno a uno se queda atrás y la
 * acción nueva sale sin icono. Se evalúa en orden — gana la primera que casa.
 */
const ICON_RULES: Array<[RegExp, ElementType]> = [
  [/PERMISSION|ROLE|KYC|OVERRIDE/, Shield],
  [/LOGIN|LOGOUT|SESSION|INVIT|PIN_/, LogIn],
  [/PAYMENT|REFUND|CASH|SETTLEMENT|COMMISSION|PAYOUT|MERCHANT|CFDI|LEDGER|JOURNAL|EXPENSE|PAYROLL|CREDIT|RATE_|REVENUE|FINANCIAL|TOKENS/, Banknote],
  [/STOCK|INVENTORY|RAW_MATERIAL|RECIPE|BATCH|TRANSFER|SERIALIZED|SIM_/, Boxes],
  [/PURCHASE_ORDER|SUPPLIER|PURCHASE_INVOICE/, ShoppingCart],
  [/MENU|PRODUCT|MODIFIER|CATEGORY|CATALOG|PROMOTION|DISCOUNT|COUPON|UPSELL/, Tag],
  [/TERMINAL|TPV|DEVICE|DISPLAY_MODE|SCALE/, Smartphone],
  [/PRINT/, Printer],
  [/STAFF|TEAM|EMPLOYEE|USER_|CUSTOMER|WAITLIST/, User],
  [/SHIFT|SCHEDULE|OVERTIME|TIME_ENTRY|ATTENDANCE|RESERVATION|CLASS_SESSION/, CalendarClock],
  [/VENUE|ORGANIZATION|ORG_|SETTINGS|CONFIG|FEATURE|PLAN_|ZONE|TABLE|FLOOR/, Store],
  [/DENIED|REJECTED|FAILED|BLOCKED|LOCKED/, Ban],
  [/DELETED|REMOVED|CANCELLED|VOIDED/, Trash2],
  [/CREATED|ADDED|ISSUED|GENERATED/, Plus],
  [/APPROVED|CONFIRMED|COMPLETED|RESOLVED/, CircleCheck],
  [/UPDATED|CHANGED|_SET$|REORDERED|EDIT/, Pencil],
]

export function iconFor(action: string): ElementType {
  // Lo negado manda sobre el sustantivo: PERMISSION_DENIED debe leerse como un
  // bloqueo, no como "algo de permisos".
  if (/DENIED|REJECTED|FAILED|LOCKED|INSUFFICIENT/.test(action)) return Ban
  for (const [re, Icon] of ICON_RULES) if (re.test(action)) return Icon
  return FileText
}
