/**
 * Socios comerciales de Avoqado: enlaces de referido que el dashboard abre en
 * una pestaña nueva. No son integraciones que se "conecten" — el socio hace su
 * propio alta. La atribución viaja en la URL (`/onboarding/Avoqado`), así que
 * cualquier cambio aquí cambia a quién le cuentan la referencia.
 */
export const HAYCASH_ONBOARDING_URL = 'https://haycash.com.mx/onboarding/Avoqado'

/** Abre un socio en pestaña nueva sin darle acceso a `window.opener`. */
export function openPartner(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}
