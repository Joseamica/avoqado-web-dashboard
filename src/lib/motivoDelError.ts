const texto = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined)

/** Motivo legible de un error de la API: message del servidor, luego error (controladores viejos), respaldo y err.message. */
export function motivoDelError(err: unknown, respaldo?: string): string {
  const e = err as { response?: { data?: unknown }; message?: unknown } | null | undefined
  const data = e?.response?.data as { message?: unknown; error?: unknown } | null | undefined
  const deData = data && typeof data === 'object' ? texto(data.message) ?? texto(data.error) : undefined
  return deData ?? texto(respaldo) ?? texto(e?.message) ?? 'Ocurrió un error inesperado'
}
