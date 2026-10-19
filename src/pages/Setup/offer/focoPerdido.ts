/**
 * ¿Se perdió el foco? Cayó al `<body>` (el reto 3D Secure de Stripe se cerró, o el elemento enfocado se desmontó) o
 * se quedó en un botón APAGADO (pagar, mientras se cobra), que no responde al teclado.
 *
 * 🔴 Sólo entonces se mueve el foco: a quien está tecleando su tarjeta (el iframe de Stripe) o cualquier otro campo
 * nunca se le quita.
 */
export function focoPerdido(): boolean {
  const activo = document.activeElement
  return !activo || activo === document.body || activo.matches(':disabled')
}
