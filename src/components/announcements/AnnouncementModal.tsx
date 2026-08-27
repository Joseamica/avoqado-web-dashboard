import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { AnnouncementBlocks } from './AnnouncementBlocks'
import { getAnnouncement, recordAnnouncementCta, recordAnnouncementOpen } from '@/services/announcement.service'
import type { Announcement } from '@/services/announcement.service'

/**
 * El anuncio abierto, con su contenido ampliado (fotos, ficha técnica…).
 *
 * Sirve para las DOS cosas, y por eso es un solo componente:
 *  - el detalle que se abre al tocar el aviso en la campana
 *  - la ventana que interrumpe una vez (`showAsModal`)
 *
 * `FullScreenModal` y no `Dialog`: lo exige `.claude/rules/ui-patterns.md` para toda
 * vista de detalle. Y NO hay ruta propia — una versión anterior navegaba a
 * `/announcements/<id>`, que sólo existe en el superadmin, y daba 404.
 */
export function AnnouncementModal({
  announcementId,
  precargado,
  open,
  onClose,
}: {
  announcementId: string | null
  /** Si el inicio ya lo trajo, se pinta sin esperar una segunda llamada. */
  precargado?: Announcement | null
  open: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ['announcement', announcementId],
    queryFn: () => getAnnouncement(announcementId as string),
    enabled: open && Boolean(announcementId) && !precargado,
    staleTime: 5 * 60_000,
  })

  const anuncio = precargado ?? data

  // Registrar la apertura no puede tumbar la vista: si falla, el usuario igual lo lee.
  useEffect(() => {
    if (!open || !announcementId) return
    recordAnnouncementOpen(announcementId).catch(() => {})
  }, [open, announcementId])

  const handleClose = () => {
    // Al cerrar, el aviso queda leído: así la ventana deja de interrumpir y el anuncio
    // se queda en la campana, que es justo lo que se pidió.
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
    queryClient.invalidateQueries({ queryKey: ['announcements', 'home'] })
    onClose()
  }

  if (!anuncio) return null

  return (
    <FullScreenModal
      open={open}
      onClose={handleClose}
      title={anuncio.title}
      subtitle="Novedades de Avoqado"
      actions={
        anuncio.actionLabel && anuncio.actionUrl ? (
          <Button
            onClick={() => {
              recordAnnouncementCta(anuncio.id).catch(() => {})
              window.open(anuncio.actionUrl as string, '_blank', 'noopener,noreferrer')
            }}
          >
            {anuncio.actionLabel}
          </Button>
        ) : (
          <Button onClick={handleClose}>Entendido</Button>
        )
      }
    >
      <div className="mx-auto max-w-2xl space-y-6 py-2">
        <p className="text-base leading-relaxed text-foreground">{anuncio.body}</p>

        {anuncio.imageUrl ? (
          <img
            src={anuncio.imageUrl}
            alt=""
            loading="lazy"
            className="w-full rounded-lg border border-border object-cover"
          />
        ) : null}

        <AnnouncementBlocks blocks={anuncio.contentBlocks} />
      </div>
    </FullScreenModal>
  )
}
