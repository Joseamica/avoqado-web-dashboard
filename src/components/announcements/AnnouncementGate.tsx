import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AnnouncementModal } from './AnnouncementModal'
import { useAuth } from '@/context/AuthContext'
import {
  cerrarAnuncio,
  cerradoLocalmente,
  getHomeAnnouncements,
  quitarDeLaCache,
  reintentarCierresPendientes,
} from '@/services/announcement.service'

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
  const { pathname } = useLocation()
  const queryClient = useQueryClient()
  const staffId = useAuth().user?.id
  const [cerrados, setCerrados] = useState<string[]>([])
  const [verCompleto, setVerCompleto] = useState<string | null>(null)

  const { data } = useQuery({
    queryKey: ['announcements', 'home'],
    queryFn: getHomeAnnouncements,
    staleTime: 60_000,
  })

  // El layout persiste al navegar: cambiar de pantalla no vuelve a montar esta consulta.
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ['announcements', 'home'], exact: true }, { cancelRefetch: false })
  }, [pathname, queryClient])

  // Los cierres que no llegaron al servidor se reintentan al montar y al volver la red.
  useEffect(() => {
    if (!staffId) return
    const reintentar = () =>
      void reintentarCierresPendientes(staffId).then(ids => ids.forEach(id => quitarDeLaCache(queryClient, id)))
    reintentar()
    window.addEventListener('online', reintentar)
    return () => window.removeEventListener('online', reintentar)
  }, [staffId, queryClient])

  const ventana = data?.modal ?? null
  // La marca local manda sobre la caché de la consulta (puede traer un anuncio ya cerrado).
  if (!ventana || cerrados.includes(ventana.id) || cerradoLocalmente(staffId, ventana.id)) return null

  // Cerrar (en cualquiera de los dos niveles) apaga la ventana para siempre. Se guarda en
  // el servidor con su propia marca — NO con `isRead`, que la campana enciende sola.
  const cerrar = () => {
    setCerrados(previous => [...previous, ventana.id])
    setVerCompleto(null)
    if (staffId) {
      cerrarAnuncio(staffId, ventana.id)
        .then(() => quitarDeLaCache(queryClient, ventana.id))
        .catch(() => {})
    }
  }

  if (verCompleto === ventana.id) {
    return (
      <AnnouncementModal announcementId={ventana.id} precargado={ventana} open onClose={cerrar} />
    )
  }

  return (
    <Dialog open onOpenChange={abierto => !abierto && cerrar()}>
      <DialogContent className="sm:max-w-md" hasTitle>
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
          <Button onClick={() => setVerCompleto(ventana.id)}>
            {ventana.actionLabel || 'Ver más'}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
