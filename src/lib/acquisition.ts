/**
 * Atribución de adquisición: el código de oferta y los UTMs que viajan del anuncio al alta (§3.5).
 *
 * 🔴 Dos reglas que no se negocian:
 *  1. **Esto NUNCA puede romper un registro.** Un parámetro mal formado, un `sessionStorage`
 *     bloqueado (modo privado) o un JSON corrupto se descartan en silencio: se pierde la
 *     atribución, jamás el lead.
 *  2. **El código NO cambia ningún precio en pantalla.** `?oferta=` atribuye; la ficha de la
 *     oferta la entrega el SERVIDOR (§3.3). Esa separación es la decisión D2 del spec.
 *
 * Vive en `sessionStorage` con caducidad de 24 h porque el alta cruza la verificación de correo:
 * la persona llega por el anuncio, se va a su bandeja y vuelve.
 */

/** La MISMA lista permitida del servidor (`public.routes.ts`). Lo que no esté aquí se descarta. */
export const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'gclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'msclkid',
] as const

export type UtmKey = (typeof UTM_KEYS)[number]

export const ACQUISITION_STORAGE_KEY = 'avq_acq_v1'
export const ACQUISITION_TTL_MS = 24 * 60 * 60 * 1000

/** Tope por valor. El servidor corta a 200: mandar más solo engorda la petición. */
const MAX_UTM_LEN = 200

export interface Atribucion {
  /** Lo que venía en `?oferta=`: puede ser el código (`POS22`) o el slug (`pos-22`). */
  offerParam: string | null
  utm: Partial<Record<UtmKey, string>>
  savedAt: string
}

function almacen(): Storage | null {
  try {
    return window.sessionStorage ?? null
  } catch {
    return null
  }
}

function limpiarUtms(params: URLSearchParams): Partial<Record<UtmKey, string>> {
  const limpio: Partial<Record<UtmKey, string>> = {}
  for (const k of UTM_KEYS) {
    const v = params.get(k)
    if (typeof v === 'string' && v.trim()) limpio[k] = v.trim().slice(0, MAX_UTM_LEN)
  }
  return limpio
}

/**
 * Lee la URL y guarda la atribución si trae algo. Devuelve lo capturado, o `null` si la visita no
 * traía nada — en ese caso **no se borra** lo que ya estaba: el usuario pudo llegar por el anuncio
 * y volver por una URL limpia desde su correo.
 */
export function capturarAtribucion(search: string = typeof window !== 'undefined' ? window.location.search : ''): Atribucion | null {
  const params = new URLSearchParams(search)
  const offerParam = params.get('oferta')?.trim() || null
  const utm = limpiarUtms(params)

  if (!offerParam && Object.keys(utm).length === 0) return null

  const atribucion: Atribucion = { offerParam, utm, savedAt: new Date().toISOString() }
  try {
    almacen()?.setItem(ACQUISITION_STORAGE_KEY, JSON.stringify(atribucion))
  } catch {
    /* modo privado / cookies bloqueadas: se pierde la atribución, no el alta */
  }
  return atribucion
}

/** La atribución guardada, si sigue vigente. Cualquier problema se lee como «no hay». */
export function leerAtribucion(): Atribucion | null {
  try {
    const crudo = almacen()?.getItem(ACQUISITION_STORAGE_KEY)
    if (!crudo) return null
    const parsed = JSON.parse(crudo) as Partial<Atribucion>
    const savedAt = typeof parsed?.savedAt === 'string' ? Date.parse(parsed.savedAt) : NaN
    if (!Number.isFinite(savedAt)) return null
    if (Date.now() - savedAt > ACQUISITION_TTL_MS) return null
    return {
      offerParam: typeof parsed.offerParam === 'string' ? parsed.offerParam : null,
      utm: (parsed.utm ?? {}) as Partial<Record<UtmKey, string>>,
      savedAt: parsed.savedAt as string,
    }
  } catch {
    return null
  }
}

export function limpiarAtribucion(): void {
  try {
    almacen()?.removeItem(ACQUISITION_STORAGE_KEY)
  } catch {
    /* ídem */
  }
}
