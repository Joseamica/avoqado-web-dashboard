/**
 * Predefined Tailwind class strings for category badges.
 * Uses the same pattern as MOVEMENT_TYPE_CONFIG in StockControl.tsx.
 *
 * Categories are assigned a color deterministically by hashing their name,
 * so the same category always gets the same color across the dashboard.
 */

export const CATEGORY_COLOR_PALETTE = [
  'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'bg-green-500/10 text-green-600 border-green-500/20',
  'bg-purple-500/10 text-purple-600 border-purple-500/20',
  'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'bg-pink-500/10 text-pink-600 border-pink-500/20',
] as const

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function getCategoryBadgeClass(name: string): string {
  if (!name) return CATEGORY_COLOR_PALETTE[0]
  return CATEGORY_COLOR_PALETTE[hashString(name) % CATEGORY_COLOR_PALETTE.length]
}

/**
 * Status badge config — same shape and pattern as MOVEMENT_TYPE_CONFIG in StockControl.tsx
 */
export const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  AVAILABLE: { label: 'Disponible', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  SOLD: { label: 'Vendido', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  RETURNED: { label: 'Devuelto', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  DAMAGED: { label: 'Dañado', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
}
