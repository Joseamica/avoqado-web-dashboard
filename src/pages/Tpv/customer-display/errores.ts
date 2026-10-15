import { textoDelServidor } from '@/utils/apiError'

type RespuestaDeError = {
  response?: { status?: number; data?: { code?: unknown; details?: unknown } }
  /** `src/api.ts` marca `_retry: true` en la petición que REPITE sola tras un error de red. */
  config?: { _retry?: unknown }
}
const respuesta = (error: unknown) => (error as RespuestaDeError | null | undefined)?.response
const fueReintentoAutomatico = (error: unknown) => (error as RespuestaDeError | null | undefined)?.config?._retry === true

export type ClaseDeConflicto = 'conflicto' | 'ocupado'

/**
 * Los 409 de la pantalla del cliente. `CUSTOMER_DISPLAY_BUSY` («otro cambio se cruzó») se reintenta con el MISMO token;
 * cualquier otro 409 es que alguien más guardó: hay que recargar. 🔴 La clase sólo decide QUÉ BOTÓN se ofrece; el texto
 * siempre es el del server (`mensajeDelServidor`).
 *
 * 🔴 ORDEN obligatorio en quien maneja un error de escritura (editor B3, copia B4): primero `resultadoIncierto`, DESPUÉS
 * esta función. Un 409 de un reintento automático también es un 409, pero no prueba que «alguien más» guardó: el token
 * pudo cambiar por nuestro PRIMER intento, cuya respuesta se perdió. Ése se reconcilia como incierto, nunca se anuncia
 * como conflicto ajeno.
 */
export function claseDeConflicto(error: unknown): ClaseDeConflicto | null {
  const r = respuesta(error)
  if (r?.status !== 409) return null
  return r.data?.code === 'CUSTOMER_DISPLAY_BUSY' ? 'ocupado' : 'conflicto'
}

export function destinosEnConflicto(error: unknown): string[] {
  const details = respuesta(error)?.data?.details as { conflicts?: unknown } | undefined
  return Array.isArray(details?.conflicts) ? details.conflicts.filter((id): id is string => typeof id === 'string') : []
}

export function conflictoDelOrigen(error: unknown): boolean {
  return (respuesta(error)?.data?.details as { source?: unknown } | undefined)?.source === true
}

/** El texto que mandó el server, tal cual; si no mandó texto legible, el respaldo de la pantalla. Nunca el de axios. */
export function mensajeDelServidor(error: unknown, respaldo: string): string {
  return textoDelServidor(error) ?? respaldo
}

/**
 * Los rechazos que PRUEBAN que no se escribió nada: validación (400), sesión (401), permiso (403), no existe (404),
 * conflicto de CAS u ocupado (409), regla de negocio (422) y límite de peticiones (429). El server decide todos ANTES de
 * escribir.
 */
const RECHAZOS_CONFIRMADOS: ReadonlySet<number> = new Set([400, 401, 403, 404, 409, 422, 429])

/**
 * Los rechazos que dejan de probarlo cuando la petición fue el REINTENTO automático de `src/api.ts` (`config._retry`, tras un
 * error de red): el primer intento pudo llegar y guardar. Un 409 sale porque NUESTRA escritura cambió el token; un 429,
 * porque el primero contó para el límite. Los demás (400/401/403/404/422) se decidirían igual sobre el mismo cuerpo.
 */
const DEPENDEN_DEL_PRIMER_INTENTO: ReadonlySet<number> = new Set([409, 429])

/**
 * ¿El server pudo haber aplicado el cambio sin que lo sepamos? (Codex F1 r1 #4 y #9; r2). Todo lo que no sea un rechazo
 * confirmado es INCIERTO: sin respuesta (red, tiempo agotado), un 500 genérico (el manejador de errores de `app.ts` responde
 * 500 sin acreditar que se deshizo algo: el COMMIT pudo confirmar y perderse su respuesta), las puertas de enlace
 * (502/503/504/524) y cualquier otro estado. Lo incierto ni se deshace en pantalla ni se da por bueno: se vuelve a leer.
 *
 * 🔴 También es incierto un 409 o un 429 de un REINTENTO automático (B2, ronda de arreglo 1): ver
 * `DEPENDEN_DEL_PRIMER_INTENTO`. Por eso se pregunta ANTES que `claseDeConflicto`: si es incierto, se relee el server y no
 * se ofrece «recargar porque alguien más guardó».
 */
export function resultadoIncierto(error: unknown): boolean {
  const status = respuesta(error)?.status
  if (status === undefined || !RECHAZOS_CONFIRMADOS.has(status)) return true
  return fueReintentoAutomatico(error) && DEPENDEN_DEL_PRIMER_INTENTO.has(status)
}
