const ZONA_DEFAULT = 'America/Mexico_City'

/** «Hoy» como YYYY-MM-DD en la zona del negocio (no la fecha UTC del navegador, que se adelanta de noche en CDMX). */
export function hoyEnSede(zona: string, ahora: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora)
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_DEFAULT, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora)
  }
}
