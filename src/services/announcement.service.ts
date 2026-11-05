import type { QueryClient } from '@tanstack/react-query'
import api from '@/api'

/**
 * Anuncios de plataforma — lo que Avoqado le manda a este negocio.
 *
 * 🔴 El detalle NO vive en una ruta propia: se abre en un `FullScreenModal` desde el
 * buzón, como manda `.claude/rules/ui-patterns.md`. Una versión anterior mandaba a
 * `/announcements/<id>` y daba 404, porque esa ruta sólo existe en el superadmin.
 */

export type AnnouncementPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

/**
 * Los bloques del contenido ampliado.
 *
 * 🔴 Un tipo que este cliente no conozca se IGNORA en silencio — nunca rompe la pantalla.
 * Es lo que permite agregar bloques nuevos en el servidor sin desplegar el dashboard.
 */
export type ContentBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'image'; url: string; alt: string; caption?: string; width?: number; height?: number }
  | { type: 'gallery'; images: Array<{ url: string; alt: string; caption?: string; width?: number; height?: number }> }
  | { type: 'specs'; rows: Array<{ label: string; value: string }> }
  | { type: 'callout'; tone: 'info' | 'warning' | 'success'; text: string }
  | { type: 'button'; label: string; url: string }
  | { type: 'video'; provider: 'youtube' | 'vimeo'; videoId: string; thumbnailUrl?: string }
  | { type: 'divider' }
  | { type: string; [k: string]: unknown }

export interface Announcement {
  id: string
  title: string
  body: string
  imageUrl?: string | null
  priority: AnnouncementPriority
  actionLabel?: string | null
  actionUrl?: string | null
  contentBlocks?: ContentBlock[] | null
  showAsBanner: boolean
  showAsModal: boolean
  publishedAt?: string | null
}

export interface HomeAnnouncements {
  banner: Announcement | null
  modal: Announcement | null
}

export async function getHomeAnnouncements(): Promise<HomeAnnouncements> {
  const { data } = await api.get('/api/v1/dashboard/announcements/home')
  return data?.data ?? { banner: null, modal: null }
}

/**
 * 🔴 El anuncio viene ENVUELTO: `data.announcement`, no `data`. Leerlo un nivel arriba
 * devolvía `{ announcement: {...} }`, un objeto que pasa el `if (!anuncio)` del modal y
 * pinta el encabezado vacío. Aquí se disimulaba porque el banner pasa el anuncio ya
 * cargado (`precargado`); abierto desde la campana sí fallaba. Mismo defecto en las dos
 * apps, donde dejaba la pantalla girando.
 */
export async function getAnnouncement(id: string): Promise<Announcement> {
  const { data } = await api.get(`/api/v1/dashboard/announcements/${id}`)
  return data.data.announcement
}

/** Registra que abrió el anuncio. No bloquea la UI si falla. */
export async function recordAnnouncementOpen(id: string): Promise<void> {
  await api.post(`/api/v1/dashboard/announcements/${id}/open`, {})
}

/**
 * Cierra la ventana que interrumpe: a partir de aquí el anuncio vive sólo en la campana.
 *
 * 🔴 Es una marca propia y no `isRead`, porque la campana marca todo como leído nada más
 * abrirla — asomarse al buzón apagaba una ventana que la persona nunca vio.
 */
export async function dismissAnnouncement(id: string, staffId?: string): Promise<void> {
  // Con `staffId` el servidor rechaza (409) un cierre hecho por otra persona de la sesión.
  await api.post(`/api/v1/dashboard/announcements/${id}/dismiss`, staffId ? { staffId } : {})
}

// ── Cierre que sobrevive a la red caída ───────────────────────────────────────
// 🔴 El cierre se guarda en el navegador ANTES de llamar al servidor, por persona. Si la
// red falla, la ventana no vuelve a salir; al volver la red se reenvía. La marca se
// CONSERVA al sincronizar (tope: las últimas 100).

export interface CierreLocal {
  id: string
  sincronizado: boolean
}

const TOPE_CIERRES = 100
const claveCierres = (staffId: string) => `avoqado:anuncios-cerrados:${staffId}`

export function leerCierres(staffId: string | undefined): CierreLocal[] {
  if (!staffId) return []
  try {
    const lista = JSON.parse(localStorage.getItem(claveCierres(staffId)) ?? '[]')
    return Array.isArray(lista)
      ? lista.filter((c): c is CierreLocal => typeof c?.id === 'string' && typeof c?.sincronizado === 'boolean')
      : []
  } catch {
    return []
  }
}

function guardarCierres(staffId: string, lista: CierreLocal[]) {
  try {
    localStorage.setItem(claveCierres(staffId), JSON.stringify(lista.slice(-TOPE_CIERRES)))
  } catch {
    /* sin almacenamiento: sigue sin marca local, como antes */
  }
}

function marcar(staffId: string, id: string, sincronizado: boolean) {
  guardarCierres(staffId, [...leerCierres(staffId).filter(c => c.id !== id), { id, sincronizado }])
}

export const cerradoLocalmente = (staffId: string | undefined, id: string) => leerCierres(staffId).some(c => c.id === id)

/** 🔴 La caché del inicio es POR PERSONA: un 200 tardío de Ana sólo toca la entrada de Ana. */
export const claveHome = (staffId: string | undefined) => ['announcements', 'home', staffId] as const

/** Quita el anuncio de la caché de la consulta del inicio de ESA persona. */
export function quitarDeLaCache(queryClient: QueryClient, id: string, staffId: string) {
  queryClient.setQueryData<HomeAnnouncements>(claveHome(staffId), previo =>
    previo && {
      banner: previo.banner?.id === id ? null : previo.banner,
      modal: previo.modal?.id === id ? null : previo.modal,
    },
  )
}

/**
 * El ÚNICO escritor del cierre (la ventana y la X del banner pasan por aquí):
 * guarda local → POST con `{ staffId }` → marca sincronizado. Si el POST falla (sin red,
 * 409), la marca queda pendiente y el error sube a quien llamó.
 */
export async function cerrarAnuncio(staffId: string, id: string): Promise<void> {
  marcar(staffId, id, false)
  await dismissAnnouncement(id, staffId)
  marcar(staffId, id, true)
}

/** Reenvía, uno por uno, los cierres pendientes de ESTA persona. Devuelve los que subieron. */
export async function reintentarCierresPendientes(staffId: string): Promise<string[]> {
  const enviados: string[] = []
  for (const { id } of leerCierres(staffId).filter(c => !c.sincronizado)) {
    try {
      await dismissAnnouncement(id, staffId)
      marcar(staffId, id, true)
      enviados.push(id)
    } catch {
      /* sigue pendiente */
    }
  }
  return enviados
}

/** Registra que tocó el botón del anuncio. */
export async function recordAnnouncementCta(id: string): Promise<void> {
  await api.post(`/api/v1/dashboard/announcements/${id}/cta`, {})
}
