/**
 * El texto que ve el cliente cuando su banco rechaza el cargo.
 *
 * 🔴 NUNCA el `message` crudo de Stripe: viene en INGLÉS y la pantalla está en español. Medido
 * en vivo el 18-sep — «Your card was declined.» en medio de un resumen todo en español.
 *
 * Stripe recomienda dar al cliente un siguiente paso concreto (corregir, otra tarjeta, hablar
 * con su banco), así que los rechazos que ÉL puede resolver llevan texto propio. Los que huelen
 * a fraude (`lost_card`, `stolen_card`, `fraudulent`, `pickup_card`) usan el genérico a
 * propósito: Stripe pide explícitamente no darle pistas a quien prueba una tarjeta ajena.
 *
 * Devuelve la clave i18n Y su texto en español: ese texto es el respaldo si la clave faltara en
 * algún idioma, para que el fallback nunca sea un mensaje equivocado (ni el inglés de Stripe).
 * Un código que Stripe invente mañana cae al genérico en español.
 */
export interface TextoDeRechazo {
  readonly clave: string
  readonly porDefecto: string
}

const GENERICO: TextoDeRechazo = {
  clave: 'offer.declined',
  porDefecto: 'Tu banco rechazó el cargo. Prueba con otra tarjeta.',
}

const POR_DECLINE: Readonly<Record<string, TextoDeRechazo>> = {
  insufficient_funds: {
    clave: 'offer.declineInsufficientFunds',
    porDefecto: 'Tu tarjeta no tiene fondos suficientes. Prueba con otra.',
  },
  expired_card: { clave: 'offer.declineExpiredCard', porDefecto: 'Tu tarjeta está vencida. Prueba con otra.' },
  incorrect_cvc: {
    clave: 'offer.declineIncorrectCvc',
    porDefecto: 'El código de seguridad no coincide. Revísalo o usa otra tarjeta.',
  },
  invalid_cvc: {
    clave: 'offer.declineIncorrectCvc',
    porDefecto: 'El código de seguridad no coincide. Revísalo o usa otra tarjeta.',
  },
  card_velocity_exceeded: {
    clave: 'offer.declineVelocity',
    porDefecto: 'Tu banco bloqueó el cargo por demasiados intentos seguidos. Espera un poco o usa otra tarjeta.',
  },
  processing_error: {
    clave: 'offer.declineProcessing',
    porDefecto: 'Hubo un problema al procesar tu tarjeta. Intenta de nuevo o usa otra.',
  },
}

export function textoDeRechazo(declineCode?: string | null): TextoDeRechazo {
  if (!declineCode) return GENERICO
  return POR_DECLINE[declineCode] ?? GENERICO
}

/** Solo la clave i18n. `offer.declined` es el genérico y el destino de lo desconocido. */
export function claveDeRechazo(declineCode?: string | null): string {
  return textoDeRechazo(declineCode).clave
}
