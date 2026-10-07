/**
 * IVA por producto, bloque B4b (respuesta 14; fallo 7 de la ronda 6; Codex r5 R5-8; T7-I1): los dos errores del estado de resultados
 * que el servidor explica con un código (`app.ts` manda `{ message, code }`). Repetirlos solo no sirve —cada intento puede tardar hasta
 * 90 s, el máximo del servidor—, así que no se reintentan; el botón «Reintentar» lo aprieta una persona. Tampoco se reintenta el corte
 * del proxy (504 o 524 de Cloudflare, que corta a los 100 s): ese error no trae nuestro código, pero repetir la consulta pesada tampoco
 * la arregla.
 */
export const CODIGOS_DEL_REPORTE = ['REPORT_TOO_LARGE', 'REPORT_TIMEOUT'] as const
export type CodigoDelReporte = (typeof CODIGOS_DEL_REPORTE)[number]
type RespuestaDeError = { response?: { data?: { code?: unknown; message?: unknown } } } | null | undefined

/** El código del servidor si es uno de los dos; si no, null. */
export function codigoDelReporte(error: unknown): CodigoDelReporte | null {
  const code = (error as RespuestaDeError)?.response?.data?.code
  return CODIGOS_DEL_REPORTE.find(c => c === code) ?? null
}

/** El mensaje que mandó el servidor para esos dos códigos; para cualquier otro error, undefined (el genérico de la pantalla). */
export function mensajeDelReporte(error: unknown): string | undefined {
  if (codigoDelReporte(error) === null) return undefined
  const message = (error as RespuestaDeError)?.response?.data?.message
  return typeof message === 'string' && message.trim() !== '' ? message : undefined
}

/** Estados HTTP con los que el proxy corta una consulta que tardó demasiado (504 puerta de enlace, 524 de Cloudflare). */
const ESTADOS_DE_CORTE_DEL_PROXY = [504, 524]

/** True si el error trae uno de esos estados HTTP (`error.response.status`). */
function esCorteDelProxy(error: unknown): boolean {
  const status = (error as { response?: { status?: unknown } } | null | undefined)?.response?.status
  return typeof status === 'number' && ESTADOS_DE_CORTE_DEL_PROXY.includes(status)
}

/** El `retry` de react-query: hasta `veces` reintentos para lo demás, ninguno para esos dos códigos ni para el corte del proxy (504, 524). */
export const reintentarReporte = (veces: number) => (fallas: number, error: unknown) =>
  codigoDelReporte(error) === null && !esCorteDelProxy(error) && fallas < veces
