/**
 * D1 (12-nov): la llave de un envío que el servidor deduplica (`idempotencyKey`), para un reembolso o un pago manual del panel.
 *
 * - MISMO contenido ⇒ MISMA llave: si el primer envío quedó en duda (sin respuesta o 5xx) y la persona lo vuelve a mandar —o
 *   `src/api.ts` lo repite solo tras un corte de red—, el servidor reconoce la repetición y devuelve lo ya registrado.
 * - Contenido DISTINTO ⇒ llave nueva: con la vieja el servidor contestaría 409 IDEMPOTENCY_KEY_REUSED.
 * - Tras un éxito confirmado, quien la usa la olvida (`null`): la siguiente operación, aunque sea idéntica (otro reembolso de
 *   $50 del mismo pago), es OTRA operación y estrena llave.
 *
 * Mismo patrón que el folio de la merma (`keyForSubmission` en `@/lib/inventoryWaste`).
 */
export interface LlaveDeEnvio {
  huella: string
  llave: string
}

/** UUID v4: 36 caracteres de hex y guiones, dentro de lo que acepta el servidor (`^[A-Za-z0-9_-]{8,64}$`). */
export const llaveNueva = (): string => crypto.randomUUID()

export function llaveParaEnvio(actual: LlaveDeEnvio | null, huella: string, nueva: () => string = llaveNueva): LlaveDeEnvio {
  return actual !== null && actual.huella === huella ? actual : { huella, llave: nueva() }
}
