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
  | { type: 'image'; url: string; alt: string; caption?: string }
  | { type: 'gallery'; images: Array<{ url: string; alt: string; caption?: string }> }
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

export async function getAnnouncement(id: string): Promise<Announcement> {
  const { data } = await api.get(`/api/v1/dashboard/announcements/${id}`)
  return data.data
}

/** Registra que abrió el anuncio. No bloquea la UI si falla. */
export async function recordAnnouncementOpen(id: string): Promise<void> {
  await api.post(`/api/v1/dashboard/announcements/${id}/open`, {})
}

/** Registra que tocó el botón del anuncio. */
export async function recordAnnouncementCta(id: string): Promise<void> {
  await api.post(`/api/v1/dashboard/announcements/${id}/cta`, {})
}
