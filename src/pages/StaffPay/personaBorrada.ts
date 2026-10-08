/** Lo que el server pone en lugar del nombre de una persona que ya no existe (`fuentesVenta.ts` `PERSONA_DADA_DE_BAJA`). */
export const PERSONA_DADA_DE_BAJA = 'Persona dada de baja'

type T = (k: string) => string

/**
 * El nombre de una persona tal como se enseña: vacío, null o el literal del server se dicen con `period.formerStaff`
 * (así también se traduce en inglés); un nombre real, tal cual (spec §6.1: un recibo de alguien borrado abre igual).
 */
export function nombreVisible(t: T, nombre?: string | null): string {
  const n = (nombre ?? '').trim()
  return !n || n === PERSONA_DADA_DE_BAJA ? t('period.formerStaff') : n
}
