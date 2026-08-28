import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CornerSparkles } from '@/components/effects/CornerSparkles'
import { AnnouncementModal } from './AnnouncementModal'
import { dismissAnnouncement, getHomeAnnouncements } from '@/services/announcement.service'

/**
 * El banner de novedades del inicio, y la ventana que interrumpe.
 *
 * Convive con `McpAnnouncementBanner`, que NO se migró a propósito: el del MCP abre una
 * guía interactiva dentro del dashboard, y un anuncio de plataforma sólo sabe abrir
 * contenido o un enlace. Migrarlo habría degradado esa invitación.
 *
 * 🔴 Esto es SÓLO la tira del inicio. La ventana que interrumpe vive en
 * `AnnouncementGate`, montado en el layout — si viviera aquí sólo saldría cuando la
 * persona pasa por el Home, que es justo donde menos falta hace.
 */
export function AnnouncementBanner() {
  const [abierto, setAbierto] = useState(false)
  const [descartado, setDescartado] = useState(false)

  const { data } = useQuery({
    queryKey: ['announcements', 'home'],
    queryFn: getHomeAnnouncements,
    staleTime: 60_000,
  })

  const banner = descartado ? null : (data?.banner ?? null)

  return (
    <>
      {banner ? (
        <div className="novelty-border mb-4">
          <CornerSparkles>
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="shrink-0 rounded-full bg-background p-2">
                  <Sparkles className="h-5 w-5 text-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{banner.title}</p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{banner.body}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                <Button size="sm" onClick={() => setAbierto(true)}>
                  {banner.actionLabel || 'Ver más'}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    // 🔴 La X CIERRA. Antes abría el detalle: el mismo gesto que en toda
                    // la app significa "quítamelo de enfrente" hacía justo lo contrario.
                    setDescartado(true)
                    dismissAnnouncement(banner.id).catch(() => {})
                  }}
                  className="h-8 w-8 cursor-pointer"
                  aria-label="Cerrar aviso"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CornerSparkles>
        </div>
      ) : null}

      {banner ? (
        <AnnouncementModal
          announcementId={banner.id}
          precargado={banner}
          open={abierto}
          onClose={() => setAbierto(false)}
        />
      ) : null}
    </>
  )
}
