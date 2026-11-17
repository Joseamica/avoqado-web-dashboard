import { CameraOff, UserCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
  // La URL firmada vence a los 10 min: al llegar la nueva (onVencida pidió la lista otra vez) se vuelve a intentar
  // (Codex r2 #4: sin esto la foto se quedaba en «Sin foto» hasta salir de la pantalla).
  useEffect(() => setRota(false), [url])
  // Una foto que de verdad no existe fallaría con cada URL nueva: se pide la lista otra vez a lo más dos veces SEGUIDAS.
  // Cada vez que la foto carga bien, la cuenta vuelve a cero (Codex r3 #2: si no, al tercer vencimiento ya no se renovaba).
  const reintentos = useRef(0)
  const vencida = () => {
    if (reintentos.current >= 2) return
    reintentos.current += 1
    onVencida?.()
  }

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
            onLoad={() => (reintentos.current = 0)}
            onError={() => {
              setRota(true)
              vencida()
            }}
          />
        </button>
        <Dialog open={abierta} onOpenChange={setAbierta}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{nombre}</DialogTitle>
              <DialogDescription>{t('photo.caption', { time: hora })}</DialogDescription>
            </DialogHeader>
            <img
              src={url}
              alt={t('photoAlt', { name: nombre })}
              className="w-full rounded-lg object-contain"
              onLoad={() => (reintentos.current = 0)}
              onError={() => vencida()}
            />
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
