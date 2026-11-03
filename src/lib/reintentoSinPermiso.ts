/**
 * `retry` para TanStack Query que NO reintenta un «no tienes permiso» (401/403).
 *
 * Reintentar un 403 no lo arregla: sólo multiplica peticiones y líneas `warn` en el servidor. El /full-testing del
 * 26-sep midió al Home de un rol sin permiso pidiendo `settlement-calendar` y `role-config` una y otra vez. Cualquier
 * otro fallo conserva los 3 reintentos por defecto de TanStack Query.
 */
export function reintentarSalvoSinPermiso(failureCount: number, error: unknown): boolean {
  if (esSinPermiso(error)) return false
  return failureCount < 3
}

export function esSinPermiso(error: unknown): boolean {
  const status = (error as { response?: { status?: number } } | null)?.response?.status
  return status === 401 || status === 403
}
