/**
 * ¿El plan de pago quedó CONCEDIDO tras volver de Stripe?
 *
 * 🔴 Al regresar con `?checkout=success` la pantalla afirmaba «¡Bienvenido a Pro! Tu plan está
 * activo» sin comprobar nada. Pero que el pago se complete no garantiza que el plan se haya
 * concedido: el servidor sólo lo concede si la suscripción está vigente, y cuando no lo está deja
 * el vínculo para reintentarlo. Afirmar «está activo» mientras el negocio sigue sin acceso es la
 * peor combinación posible: pagó y la pantalla le dice que todo salió bien.
 *
 * 🔴 Y el campo que hay que mirar es `state`, NO `planTier`: `planTier` se deriva del feature
 * ('PRO'/'PREMIUM') y sigue diciendo 'PRO' aunque la fila esté INACTIVA (lo midió Codex el 19-sep:
 * `state:'canceled', planTier:'PRO', hasPlan:true`). `state` es lo que refleja el acceso real, y
 * coincide con el resolver del servidor, que niega el acceso con `!active || suspendedAt`.
 */
const SIN_ACCESO = ['none', 'canceled', 'suspended'] as const

export function planDePagoConcedido(state: string | null | undefined): boolean {
  return !!state && !(SIN_ACCESO as readonly string[]).includes(state)
}
