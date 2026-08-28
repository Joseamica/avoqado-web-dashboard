import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AnnouncementModal } from './AnnouncementModal'
import { dismissAnnouncement, getHomeAnnouncements } from '@/services/announcement.service'

/**
 * El aviso que interrumpe, en DOS niveles:
 *
 *  1. Un diálogo chico y centrado, que sólo dice de qué se trata. Interrumpe una vez.
 *  2. Si le interesa y toca "Ver más", ahí sí se abre el contenido completo con fotos y
 *     ficha técnica en pantalla completa.
 *
 * 🔴 Es a propósito que el primer nivel NO sea la pantalla completa: quien está cobrando
 * o revisando un reporte no quiere que le tapen todo para leer una novedad. El diálogo
 * chico respeta lo que estaba haciendo; la pantalla completa se la gana el que sí quiso
 * entrar. Decisión del founder, 2026-08-27.
 *
 * 🔴 Va montado en el LAYOUT, no en el Home: una versión anterior vivía dentro de
 * `Home.tsx` y sólo aparecía si la persona pasaba por el inicio.
 */
export function AnnouncementGate() {
  const [cerrado, setCerrado] = useState(false)
  const [verCompleto, setVerCompleto] = useState(false)

  const { data } = useQuery({
    queryKey: ['announcements', 'home'],
    queryFn: getHomeAnnouncements,
    staleTime: 60_000,
  })

  const ventana = data?.modal ?? null
  if (!ventana || cerrado) return null

  // Cerrar (en cualquiera de los dos niveles) apaga la ventana para siempre. Se guarda en
  // el servidor con su propia marca — NO con `isRead`, que la campana enciende sola.
  const cerrar = () => {
    setCerrado(true)
    setVerCompleto(false)
    dismissAnnouncement(ventana.id).catch(() => {})
  }

  if (verCompleto) {
    return (
      <AnnouncementModal announcementId={ventana.id} precargado={ventana} open onClose={cerrar} />
    )
  }

  return (
    <Dialog open onOpenChange={abierto => !abierto && cerrar()}>
      <DialogContent className="sm:max-w-md">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0 rounded-full bg-muted p-2">
            <Sparkles className="h-5 w-5 text-foreground" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-left text-base">{ventana.title}</DialogTitle>
            <DialogDescription className="mt-1.5 text-left">{ventana.body}</DialogDescription>
          </div>
        </div>

        <DialogFooter className="mt-2 gap-2 sm:justify-end">
          <Button variant="ghost" onClick={cerrar}>
            Ahora no
          </Button>
          <Button onClick={() => setVerCompleto(true)}>
            {ventana.actionLabel || 'Ver más'}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
