/**
 * Un cobro que NO terminó en un 200, contado como EXCEPCIÓN.
 *
 * 🔴 Por qué existe: `PlanStep` frena el alta solo si `activateBeforeContinue` **lanza**
 * (`steps/PlanStep.tsx`, el `await` antes de `onNext`). Mientras el camino estándar resolvía
 * siempre —porque `cobrar` captura todo—, una tarjeta rechazada avanzaba el asistente y guardaba
 * `plan.payNow = true` sin que existiera un cargo. Medido: 402 → `onFreePlan` llamado igual, y sin
 * cotización del servidor ni siquiera se llamaba a `activate-plan`.
 *
 * Lleva el texto que ve la persona en un campo PROPIO, no en `message`: `PlanCardForm` no puede
 * pintar el `message` de cualquier `Error` que caiga por ahí (un `TypeError` acabaría en pantalla).
 * Este campo solo lo pone quien sabe que el texto es para leerse.
 */
export class FalloDeCobro extends Error {
  readonly mensajeParaElUsuario: string

  constructor(mensajeParaElUsuario: string) {
    super(mensajeParaElUsuario)
    this.name = 'FalloDeCobro'
    this.mensajeParaElUsuario = mensajeParaElUsuario
  }
}

/** El texto legible de un fallo, si quien lo lanzó declaró uno. Cualquier otro error ⇒ `undefined`. */
export function mensajeDeFalloDeCobro(fallo: unknown): string | undefined {
  const texto = (fallo as { mensajeParaElUsuario?: unknown } | null | undefined)?.mensajeParaElUsuario
  return typeof texto === 'string' && texto.trim() ? texto : undefined
}
