/**
 * Boleto de entrada del alta con código (landing → /auth/entrar#boleto=...).
 *
 * Es una credencial de 5 min y un solo uso: no puede llegar a PostHog (que captura la URL),
 * ni al Referer, ni a logs. Se guarda y se borra de la URL ANTES de initPostHog().
 * Dependency-free, como demo-tour-capture.
 */
export const BOLETO_STORAGE_KEY = 'avq_boleto_alta'
const RUTA = '/auth/entrar'

// Respaldo si el sessionStorage está bloqueado (navegación privada, políticas).
let enMemoria: string | null = null

export function capturarBoletoDeAlta(): void {
  if (window.location.pathname !== RUTA) return
  const boleto = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('boleto')
  if (!boleto) return
  enMemoria = boleto
  try {
    sessionStorage.setItem(BOLETO_STORAGE_KEY, boleto)
  } catch {
    /* queda en memoria */
  }
  window.history.replaceState(null, '', RUTA)
}

/** Lo lee y lo borra: un boleto se canjea una sola vez. */
export function tomarBoletoDeAlta(): string | null {
  let boleto = enMemoria
  enMemoria = null
  try {
    boleto = sessionStorage.getItem(BOLETO_STORAGE_KEY) ?? boleto
    sessionStorage.removeItem(BOLETO_STORAGE_KEY)
  } catch {
    /* ya quedó lo de memoria */
  }
  return boleto
}
