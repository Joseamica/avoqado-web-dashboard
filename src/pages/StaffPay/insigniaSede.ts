import type { EstadoSedeDto } from '@/types/staffPay'

/**
 * El color de la insignia del estado de una sede, igual en «Sedes» y en el cierre: verde activa, ámbar sin activar, ROJO
 * activa sin plan (bloquea el cierre), gris sin plan (diseño r3.7(1), r4.7).
 */
export const INSIGNIA_SEDE: Record<EstadoSedeDto, string> = {
  ACTIVA: 'border-green-600/40 text-green-700 dark:text-green-400',
  SIN_ACTIVAR: 'border-amber-500/50 text-amber-700 dark:text-amber-400',
  ACTIVA_SIN_PLAN: 'border-destructive text-destructive',
  SIN_PLAN: 'border-input text-muted-foreground',
}
