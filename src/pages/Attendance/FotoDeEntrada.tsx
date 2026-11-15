import { CameraOff, UserCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * La foto de entrada de una checada («Foto de Entrada (Anti-fraude)» en Ajustes).
 *
 * - Con foto: miniatura redonda; al tocarla se abre en grande.
 * - Sin foto y con el interruptor prendido: un ícono de cámara tachada (y la tarjeta dice «Sin foto»): el aparato no pudo
 *   tomarla (sin cámara, como la PC, o sin permiso) y el dueño lo tiene que ver.
 * - Sin foto y apagado: el ícono de siempre.
 *
 * La URL viene firmada por 10 minutos: si ya venció cuando se pinta, `onVencida` pide la lista otra vez.
 */
export function FotoDeEntrada({
  url,
  pedida,
  nombre,
  hora,
  onVencida,
}: {
  url: string | null | undefined
  pedida: boolean
  nombre: string
  hora: string
  onVencida?: () => void
}) {
  const { t } = useTranslation('attendance')
  const [abierta, setAbierta] = useState(false)
  const [rota, setRota] = useState(false)

  if (url && !rota) {
    return (
      <>
        <button
          type="button"
          onClick={() => setAbierta(true)}
          className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t('photo.open', { name: nombre })}
        >
          <img
            src={url}
            alt={t('photoAlt', { name: nombre })}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => {
              setRota(true)
              onVencida?.()
            }}
          />
        </button>
        <Dialog open={abierta} onOpenChange={setAbierta}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{nombre}</DialogTitle>
              <DialogDescription>{t('photo.caption', { time: hora })}</DialogDescription>
            </DialogHeader>
            <img src={url} alt={t('photoAlt', { name: nombre })} className="w-full rounded-lg object-contain" />
          </DialogContent>
        </Dialog>
      </>
    )
  }

  if (pedida) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted" title={t('photo.missing')}>
        <CameraOff className="h-5 w-5 text-muted-foreground" aria-label={t('photo.missing')} />
      </div>
    )
  }

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
      <UserCheck className="h-5 w-5 text-muted-foreground" />
    </div>
  )
}
