import type { StoreState } from '@/types/onlineOrdering'

export type PauseLabel = { key: string; params?: Record<string, string> }

/**
 * Qué pausa tiene la tienda: la MISMA regla en Configuración y en la Bandeja. `null` si no está pausada (o el servidor dio un
 * motivo que no conocemos: la UI dice «Pausada»). El servidor decide el orden: la pausa a mano gana a «muchos pedidos».
 */
export function pauseLabel(store: StoreState | null | undefined, formatTime: (iso: string) => string): PauseLabel | null {
  if (store?.status !== 'PAUSED') return null
  if (store.reason === 'TOO_BUSY') return { key: 'settings.status.pausedBusy' }
  if (store.manualPause) return { key: 'settings.status.pausedManual' }
  if (store.pausedUntil) return { key: 'settings.status.pausedUntil', params: { time: formatTime(store.pausedUntil) } }
  return null
}
