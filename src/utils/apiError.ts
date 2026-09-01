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
