import { formatDateInTimeZone } from '@/utils/datetime'

/**
 * «Vigente desde» de la tarjeta de tarifa y de costo: la fecha escrita o, vacía, HOY en México (hz:nube0000:naeba3d5). Antes
 * mandaba la fecha UTC: de 18:00 a 23:59 en México ya era mañana, la tarjeta enseñaba «vigente desde mañana» y volver a guardar
 * con esa fecha chocaba con la versión recién creada. El servidor lee 'YYYY-MM-DD' como medianoche UTC, así que hoy en México
 * siempre rige al instante. El panel no trae la zona del negocio: México centro (como el resto del panel de cobros).
 */
export function fechaDeVigenciaOHoy(fecha: string): string {
  return fecha || formatDateInTimeZone(new Date(), 'America/Mexico_City', 'iso')
}
