import { DateTime } from 'luxon'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getIntlLocale } from '@/utils/i18n-locale'

/**
 * Vigencia de los esquemas y excepciones de comisión (ft-graves, D-D2). La base guarda instantes UTC; el DÍA que el dueño
 * ve y elige es siempre el de la zona del negocio. Leer el día UTC (`split('T')[0]`) o guardar la medianoche del navegador
 * (`new Date(d + 'T00:00:00')`) corría la vigencia al día siguiente después de las 18:00 en México.
 */

const ZONA_DEFAULT = 'America/Mexico_City'

const zonaValida = (zona: string | null | undefined): string =>
  zona && DateTime.now().setZone(zona).isValid ? zona : ZONA_DEFAULT

/** La zona del negocio que se está viendo (la misma sede cuyo `venueId` recibe lo que se guarda). */
export function useZonaDeLaSede(): string {
  const { venue } = useCurrentVenue()
  return zonaValida(venue?.timezone)
}

/** «Hoy» como YYYY-MM-DD en la zona del negocio. */
export function hoyEnLaSede(zona: string): string {
  return DateTime.now().setZone(zonaValida(zona)).toISODate() as string
}

/** El día (YYYY-MM-DD) en la zona del negocio de un instante guardado. Sin instante, o inválido: null. */
export function diaEnLaSede(instante: string | null | undefined, zona: string): string | null {
  if (!instante) return null
  const dt = DateTime.fromISO(instante, { zone: 'utc' })
  return dt.isValid ? dt.setZone(zonaValida(zona)).toISODate() : null
}

const delDia = (dia: string, zona: string) => DateTime.fromISO(dia, { zone: zonaValida(zona) })

/** «Vigente desde» ese día: el instante UTC en que empieza el día en la zona del negocio. */
export function inicioDelDiaEnLaSede(dia: string, zona: string): string {
  return delDia(dia, zona).startOf('day').toUTC().toISO() as string
}

/** «Vigente hasta» ese día, incluido: su último instante en la zona del negocio (el servidor compara con `>=`). */
export function finDelDiaEnLaSede(dia: string, zona: string): string {
  return delDia(dia, zona).endOf('day').toUTC().toISO() as string
}

/** Un instante guardado, escrito como día del negocio: «8 oct 2026» o, en largo, «8 de octubre de 2026». */
export function fechaEnLaSede(instante: string | null | undefined, zona: string, idioma: string, largo?: 'largo'): string {
  if (!instante) return '-'
  const dt = DateTime.fromISO(instante, { zone: 'utc' })
  if (!dt.isValid) return '-'
  return dt
    .setZone(zonaValida(zona))
    .setLocale(getIntlLocale(idioma))
    .toLocaleString(largo ? DateTime.DATE_FULL : DateTime.DATE_MED)
}
