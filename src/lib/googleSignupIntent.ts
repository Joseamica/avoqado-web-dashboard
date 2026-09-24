/**
 * El «intento de alta con Google»: lo que `/signup` sabe ANTES de mandar a la persona a Google y
 * que el callback necesita al volver — la versión legal que aceptó, la campaña del anuncio y los UTM.
 *
 * 🔴 Por qué existe: el viaje a Google es una REDIRECCIÓN; al volver, `/auth/google/callback` sólo
 * trae el `code`. Antes el callback mandaba sólo eso, así que quien llegaba de un anuncio y elegía
 * Google perdía la campaña (pagaba precio de lista) y el clic pagado quedaba sin atribuir. Y el
 * servidor distingue «crear mi negocio» de «entrar» precisamente por este sobre: sin él, un correo
 * desconocido recibe el 403 de siempre.
 *
 * Reglas, las mismas que `acquisition.ts`:
 *  - **Nunca rompe nada.** Un `sessionStorage` bloqueado o un JSON corrupto = no hay intento.
 *  - **Se consume UNA vez** (`tomar…` lo borra): un intento viejo no puede convertir en alta un
 *    inicio de sesión posterior desde `/login`.
 *  - **Caduca** en 30 min: lo que tarda de sobra ir a Google y volver.
 */

export const GOOGLE_SIGNUP_INTENT_KEY = 'avq_google_signup_v1'
export const GOOGLE_SIGNUP_INTENT_TTL_MS = 30 * 60 * 1000

export interface GoogleSignupIntent {
  legalVersion: string
  launchCampaignCode?: string
  utm?: Record<string, string>
}

interface Guardado extends GoogleSignupIntent {
  savedAt: number
}

function almacen(): Storage | null {
  try {
    return typeof window !== 'undefined' ? (window.sessionStorage ?? null) : null
  } catch {
    return null
  }
}

export function guardarIntentoDeAltaGoogle(intento: GoogleSignupIntent, ahora: number = Date.now()): void {
  const s = almacen()
  if (!s) return
  try {
    const valor: Guardado = { ...intento, savedAt: ahora }
    s.setItem(GOOGLE_SIGNUP_INTENT_KEY, JSON.stringify(valor))
  } catch {
    /* sin almacenamiento el alta con Google sigue; sólo se pierde la atribución */
  }
}

/** Lee y BORRA el intento. Devuelve `null` si no hay, si caducó o si está corrupto. */
export function tomarIntentoDeAltaGoogle(ahora: number = Date.now()): GoogleSignupIntent | null {
  const s = almacen()
  if (!s) return null
  let crudo: string | null = null
  try {
    crudo = s.getItem(GOOGLE_SIGNUP_INTENT_KEY)
    s.removeItem(GOOGLE_SIGNUP_INTENT_KEY)
  } catch {
    return null
  }
  if (!crudo) return null
  try {
    const g = JSON.parse(crudo) as Partial<Guardado>
    if (typeof g.legalVersion !== 'string' || !g.legalVersion) return null
    if (typeof g.savedAt !== 'number' || ahora - g.savedAt > GOOGLE_SIGNUP_INTENT_TTL_MS || g.savedAt > ahora) return null
    const utm = g.utm && typeof g.utm === 'object' && Object.keys(g.utm).length > 0 ? g.utm : undefined
    return {
      legalVersion: g.legalVersion,
      ...(typeof g.launchCampaignCode === 'string' && g.launchCampaignCode ? { launchCampaignCode: g.launchCampaignCode } : {}),
      ...(utm ? { utm } : {}),
    }
  } catch {
    return null
  }
}

/**
 * 🔴 El `code` que Google devuelve es de UN solo uso, y la pantalla de regreso puede ejecutarse más de
 * una vez: StrictMode repite el efecto y el enrutador la REMONTA mientras carga la sesión (medido en
 * navegador real el 24-sep: 4 llamadas con el mismo code; la primera llevaba el alta y las demás no, y con
 * un code real la segunda falla y pinta el error encima del alta buena). Un candado dentro del componente
 * no basta —cada montaje trae el suyo—, así que vive aquí, por code, a nivel de módulo.
 *
 * Devuelve `true` sólo la PRIMERA vez que se pide canjear ese code en esta pestaña.
 */
const canjesDeEstaPestana = new Set<string>()

export function tomarTurnoParaCanjear(llave: string): boolean {
  if (canjesDeEstaPestana.has(llave)) return false
  canjesDeEstaPestana.add(llave)
  return true
}

/** Sólo para pruebas: cada prueba arranca con una pestaña «nueva». */
export function reiniciarCanjesParaPruebas(): void {
  canjesDeEstaPestana.clear()
}
