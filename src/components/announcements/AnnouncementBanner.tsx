import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CornerSparkles } from '@/components/effects/CornerSparkles'
import { AnnouncementModal } from './AnnouncementModal'
import { getHomeAnnouncements } from '@/services/announcement.service'

/**
 * El banner de novedades del inicio, y la ventana que interrumpe.
 *
 * Reemplaza a `McpAnnouncementBanner`, que era el mismo aviso escrito a mano en React:
 * para cambiarlo había que editar código y desplegar, el "no me lo enseñes" vivía en el
 * `localStorage` de cada navegador, y no había forma de saber cuántos lo vieron.
 *
 * Los dos salen de UNA sola llamada (`/announcements/home`), así que no pueden
 * desincronizarse. La ventana sólo aparece mientras su aviso siga sin leer: al cerrarla
 * queda leído, deja de interrumpir y el anuncio se queda en la campana.
 */
export function AnnouncementBanner() {
  const [abiertoId, setAbiertoId] = useState<string | null>(null)
  const [ventanaCerrada, setVentanaCerrada] = useState(false)

  const { data } = useQuery({
    queryKey: ['announcements', 'home'],
    queryFn: getHomeAnnouncements,
    staleTime: 60_000,
  })

  const banner = data?.banner ?? null
  const ventana = data?.modal ?? null
  const abierto = abiertoId ?? (!ventanaCerrada && ventana ? ventana.id : null)
  const precargado = abierto === ventana?.id ? ventana : abierto === banner?.id ? banner : null

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
                <Button size="sm" onClick={() => setAbiertoId(banner.id)}>
                  {banner.actionLabel || 'Ver más'}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setAbiertoId(banner.id)}
                  className="h-8 w-8 cursor-pointer"
                  aria-label="Abrir anuncio"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CornerSparkles>
        </div>
      ) : null}

      <AnnouncementModal
        announcementId={abierto}
        precargado={precargado}
        open={Boolean(abierto)}
        onClose={() => {
          setAbiertoId(null)
          setVentanaCerrada(true)
        }}
      />
    </>
  )
}
