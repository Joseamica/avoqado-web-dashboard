/**
 * Lectura PÚBLICA de una oferta de lanzamiento — `GET /api/v1/public/launch-offers/:slug` (§3.3).
 *
 * Sin token: es el mismo endpoint que consulta la landing. El dashboard lo usa para dos cosas:
 * traducir el `?oferta=<slug>` de un anuncio al CÓDIGO que viaja al alta, y enseñar la ficha.
 *
 * 🔴 Nunca inventa una oferta: si el servidor no la entrega, devuelve null y el alta sigue SIN
 * campaña. Un anuncio caducado no puede bloquear un registro.
 */
// 🔴 `publicApi` (withCredentials: false), NUNCA el cliente `api` por defecto.
// Medido el 18-sep en el navegador: el router público responde `Access-Control-Allow-Origin: *`
// y el navegador RECHAZA `*` cuando la petición lleva credenciales. Con `api` la llamada muere
// en CORS, el `catch` de abajo la convierte en `null`, y el alta sigue SIN oferta y SIN
// atribución — en silencio. curl da 200 y las pruebas del servidor pasan: sólo se ve en un
// navegador real. Misma trampa ya documentada en `pages/Payment/AutofacturaPanel.tsx`.
import { publicApi } from '@/api'
import type { LaunchOfferState } from '@/pages/Setup/launchOffer.types'

export const LANDING_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const LAUNCH_CAMPAIGN_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,31}$/

export const launchOfferService = {
  /** La ficha pública por slug. `null` si no existe, está en borrador, o la red falla. */
  async getBySlug(slug: string): Promise<LaunchOfferState | null> {
    const limpio = slug.trim().toLowerCase()
    if (!LANDING_SLUG_RE.test(limpio) || limpio.length > 60) return null
    try {
      const response = await publicApi.get(`/api/v1/public/launch-offers/${encodeURIComponent(limpio)}`)
      return (response.data?.data ?? null) as LaunchOfferState | null
    } catch {
      return null
    }
  },
}

/**
 * Traduce lo que venga en `?oferta=` al CÓDIGO de campaña que espera el alta.
 *
 * El parámetro puede traer las dos formas: el código (`POS22`, §3.5) o el slug de la página de
 * oferta (`pos-22`, que es lo que ponen los CTA de la landing). Se resuelve el slug contra la API
 * pública; si no resuelve pero el valor tiene forma de código, se manda tal cual y el servidor
 * decide. Un valor basura devuelve `null` y el alta sigue sin campaña.
 */
export async function resolveLaunchCampaignCode(raw: string | null | undefined): Promise<string | null> {
  const valor = raw?.trim()
  if (!valor) return null

  const comoCodigo = valor.toUpperCase()
  const comoSlug = valor.toLowerCase()

  if (LANDING_SLUG_RE.test(comoSlug) && comoSlug.length <= 60) {
    const offer = await launchOfferService.getBySlug(comoSlug)
    if (offer?.code) return offer.code
  }

  return LAUNCH_CAMPAIGN_CODE_RE.test(comoCodigo) ? comoCodigo : null
}
