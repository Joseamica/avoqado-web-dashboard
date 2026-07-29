import { CreditCard, HelpCircle, LucideIcon, Monitor, Smartphone, Store, Tablet } from 'lucide-react'

/**
 * Clase de aparato — espeja el enum `DeviceFormFactor` del backend
 * (`avoqado-server/prisma/schema.prisma`) por nombre EXACTO.
 *
 * Igual que los permisos y los códigos de tier: un nombre desalineado falla en silencio
 * (el filtro no encuentra nada y el ícono cae a "desconocido" sin avisar). Si agregas un
 * valor allá, agrégalo aquí en el mismo trabajo.
 */
export const DEVICE_FORM_FACTORS = ['PHONE', 'TABLET', 'HANDHELD_POS', 'COUNTERTOP_POS', 'DESKTOP', 'UNKNOWN'] as const

export type DeviceFormFactorKey = (typeof DEVICE_FORM_FACTORS)[number]

const ICONS: Record<DeviceFormFactorKey, LucideIcon> = {
  PHONE: Smartphone,
  TABLET: Tablet,
  HANDHELD_POS: CreditCard, // terminal de cobro de mano (PAX, NexGo)
  COUNTERTOP_POS: Store, // POS de mostrador (Sunmi D3, T2)
  DESKTOP: Monitor,
  UNKNOWN: HelpCircle,
}

/**
 * Normaliza lo que venga del API a una clase conocida.
 *
 * Las terminales dadas de alta antes del device registry tienen `formFactor` en null, y
 * las que nunca reportaron salud quedaron en UNKNOWN tras el backfill. Para el dueño las
 * dos cosas son lo mismo — "no sabemos qué es" — así que ambas caen en UNKNOWN.
 */
export function normalizeFormFactor(value: string | null | undefined): DeviceFormFactorKey {
  if (!value) return 'UNKNOWN'
  return (DEVICE_FORM_FACTORS as readonly string[]).includes(value) ? (value as DeviceFormFactorKey) : 'UNKNOWN'
}

export function getDeviceKindIcon(key: DeviceFormFactorKey): LucideIcon {
  return ICONS[key]
}
