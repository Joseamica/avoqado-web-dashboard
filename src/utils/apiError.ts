/**
 * Extrae el mensaje legible de un error de axios para mostrarlo en un toast.
 *
 * Los controladores del server responden el motivo en DOS llaves distintas según
 * el módulo — `{ message }` o `{ error }` (los de CFDI usan `error`). Leer sólo
 * una deja al usuario con el genérico de axios («Request failed with status
 * code 409») mientras el diagnóstico real se tira: pasó en producción el
 * 2026-09-01 con la subida del CSD.
 */
export function apiErrorDescription(err: any): string {
  return err?.response?.data?.message ?? err?.response?.data?.error ?? err?.message ?? ''
}

/**
 * El texto que mandó NUESTRO servidor (`error` o `message` del cuerpo JSON, string no vacío), o `undefined`. A diferencia de
 * `apiErrorDescription`, NUNCA cae al `message` de axios («Request failed with status code 524»): eso es jerga en inglés y la pantalla
 * debe poner su propio texto (C1 · T13, ronda 1 I4 y ronda 2). Un cuerpo que no es objeto (HTML de un 502/524) da `undefined`.
 */
export function textoDelServidor(err: unknown): string | undefined {
  const data = (err as { response?: { data?: unknown } } | null | undefined)?.response?.data as
    { error?: unknown; message?: unknown } | undefined
  if (!data || typeof data !== 'object') return undefined
  for (const v of [data.error, data.message]) if (typeof v === 'string' && v.trim() !== '') return v
  return undefined
}
