import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Unplug } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAccess } from '@/hooks/use-access'
import { useToast } from '@/hooks/use-toast'
import { disconnectChannel, getRappiConnectUrl } from '@/services/delivery.service'
import type { DeliveryChannelLink } from '@/types/delivery'
import { providerLabel } from '../providerLabels'

const errorDe = (err: any): { code?: string; message?: string; details?: { pedidosEnCurso?: number } } => err?.response?.data ?? {}
const nombreDe = (c: DeliveryChannelLink) => c.externalAccountId || c.externalLocationId

/**
 * Abre el enlace de Rappi (conectar o reconectar) en otra pestaña. Al volver, la lista se refresca sola (useDeliveryStatus).
 * 🔴 La pestaña se abre DURANTE el toque y se navega al llegar el enlace: si se abriera después de esperar al servidor, el
 * navegador puede bloquearla (el permiso del toque caduca mientras se espera la red). Y el enlace queda visible por si aun
 * así no se abrió.
 */
function useAbrirRappi(venueId: string) {
  const { t } = useTranslation('delivery')
  const { toast } = useToast()
  const ventana = useRef<Window | null>(null)
  // 🔴 El candado del toque: `isPending` llega un instante tarde y dos toques seguidos alcanzaban a pedir dos enlaces
  // (full-testing 25-oct). La referencia se pone en el mismo toque.
  const enVuelo = useRef(false)
  const [enlace, setEnlace] = useState<string | null>(null)
  const pedir = useMutation({
    mutationFn: () => getRappiConnectUrl(venueId),
    onSettled: () => {
      enVuelo.current = false
    },
    onSuccess: ({ url }) => {
      const w = ventana.current
      if (w && !w.closed) w.location.href = url
      setEnlace(url)
    },
    onError: (err: any) => {
      ventana.current?.close()
      toast({ title: t('rappi.connectError'), description: errorDe(err).message ?? err?.message ?? '', variant: 'destructive' })
    },
  })
  const abrir = () => {
    if (enVuelo.current) return
    enVuelo.current = true
    const w = window.open('about:blank', '_blank')
    if (w) w.opener = null
    ventana.current = w
    setEnlace(null)
    pedir.mutate()
  }
  return { abrir, abriendo: pedir.isPending, enlace }
}

/** Por si el navegador bloqueó la pestaña: el mismo enlace, a la vista. */
function EnlaceDeRespaldo({ enlace }: { enlace: string | null }) {
  const { t } = useTranslation('delivery')
  if (!enlace) return null
  return (
    <a href={enlace} target="_blank" rel="noopener noreferrer" className="block text-xs text-primary underline">
      {t('rappi.openLinkFallback')}
    </a>
  )
}

/**
 * Lo que se puede hacer con UNA tienda de Rappi: desconectar (ACTIVE/PAUSED), reconectar (DISABLED) o esperar (PENDING).
 * Vive en el renglón de la sección y en la tarjeta del panel vivo, así Rappi nunca sale dos veces.
 */
export function RappiStoreActions({ venueId, channel }: { venueId: string; channel: DeliveryChannelLink }) {
  const { t } = useTranslation('delivery')
  const { can } = useAccess()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const abrir = useAbrirRappi(venueId)
  const [confirmar, setConfirmar] = useState(false)
  const [confirmarForzado, setConfirmarForzado] = useState(false)
  // El aviso del último intento, en el renglón, atado a la conexión con la que se intentó. `forzable` = Rappi no aceptó o no
  // confirmó: se ofrece la salida D2, y SÓLO para esa misma conexión (si mientras tanto se reconectó, el aviso ya no vale).
  const [aviso, setAviso] = useState<{ texto: string; forzable: boolean; conexionId: string } | null>(null)
  const avisoVigente = aviso && aviso.conexionId === channel.conexionId ? aviso : null
  // 🔴 Mismo candado del toque que al conectar: dos toques seguidos a «Desconectar» mandaban dos avisos a Rappi
  // (full-testing 25-oct; el servidor sólo escribía uno, pero Rappi recibía dos).
  const enVuelo = useRef(false)

  const desconectar = useMutation({
    mutationFn: ({ forzar, conexionId }: { forzar: boolean; conexionId: string }) =>
      disconnectChannel(venueId, channel.id, conexionId, { forzar }),
    onSuccess: () => {
      setAviso(null)
      queryClient.invalidateQueries({ queryKey: ['deliveryChannels', venueId] })
      toast({ title: t('rappi.disconnectSuccess') })
    },
    onSettled: () => {
      enVuelo.current = false
    },
    onError: (err: any, { conexionId }) => {
      const e = errorDe(err)
      const forzable = e.code === 'RAPPI_NO_ACEPTO' || e.code === 'RAPPI_SIN_CONFIRMAR'
      const texto =
        e.code === 'RAPPI_PEDIDOS_EN_CURSO'
          ? t('rappi.ordersInProgress', { count: e.details?.pedidosEnCurso ?? 1 })
          : e.code === 'RAPPI_NO_ACEPTO'
            ? t('rappi.errorNotAccepted')
            : e.code === 'RAPPI_SIN_CONFIRMAR'
              ? t('rappi.errorUnconfirmed')
              : e.code === 'RAPPI_CAMBIO_LA_CONEXION'
                ? t('rappi.errorConnectionChanged')
                : e.code === 'RAPPI_OPERACION_EN_CURSO'
                  ? t('rappi.errorStillConnecting')
                  : (e.message ?? t('rappi.errorGeneric'))
      setAviso({ texto, forzable, conexionId })
      if (e.code === 'RAPPI_CAMBIO_LA_CONEXION' || e.code === 'RAPPI_PEDIDOS_EN_CURSO') {
        queryClient.invalidateQueries({ queryKey: ['deliveryChannels', venueId] })
      }
    },
  })

  const enviar = (v: { forzar: boolean; conexionId: string }) => {
    if (enVuelo.current) return
    enVuelo.current = true
    desconectar.mutate(v)
  }

  if (!can('delivery-channels:manage')) return null

  if (channel.status === 'PENDING') {
    return <p className="text-xs text-muted-foreground">{t('rappi.pendingHint')}</p>
  }

  if (channel.status === 'DISABLED') {
    return (
      <div className="space-y-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full cursor-pointer"
          data-tour="delivery-rappi-reconnect-btn"
          disabled={abrir.abriendo}
          onClick={abrir.abrir}
        >
          {abrir.abriendo && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          {t('rappi.reconnect')}
        </Button>
        <EnlaceDeRespaldo enlace={abrir.enlace} />
      </div>
    )
  }

  const enCurso = channel.pedidosEnCurso ?? 0
  const ocupado = desconectar.isPending
  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full cursor-pointer gap-1.5 text-xs"
        data-tour="delivery-rappi-disconnect-btn"
        disabled={enCurso > 0 || ocupado || !channel.conexionId}
        onClick={() => setConfirmar(true)}
      >
        {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
        {t('rappi.disconnect')}
      </Button>
      {enCurso > 0 && <p className="text-xs text-muted-foreground">{t('rappi.ordersInProgress', { count: enCurso })}</p>}
      {avisoVigente && (
        <div className="space-y-2 rounded-lg border border-input p-2 text-xs" role="alert">
          <p>{avisoVigente.texto}</p>
          {avisoVigente.forzable && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 w-full cursor-pointer text-xs text-destructive"
              disabled={ocupado}
              onClick={() => setConfirmarForzado(true)}
            >
              {t('rappi.forceAction')}
            </Button>
          )}
        </div>
      )}

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('rappi.confirmTitle', { store: nombreDe(channel) })}</AlertDialogTitle>
            <AlertDialogDescription>{t('rappi.confirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('rappi.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={ocupado}
              onClick={() => {
                setAviso(null)
                enviar({ forzar: false, conexionId: channel.conexionId ?? '' })
              }}
            >
              {t('rappi.disconnect')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmarForzado} onOpenChange={setConfirmarForzado}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('rappi.forceTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('rappi.forceDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('rappi.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={ocupado || !avisoVigente}
              onClick={() => avisoVigente && enviar({ forzar: true, conexionId: avisoVigente.conexionId })}
            >
              {t('rappi.forceAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

const STATUS_KEY: Record<DeliveryChannelLink['status'], string> = {
  ACTIVE: 'rappi.statusActive',
  PAUSED: 'rappi.statusPaused',
  PENDING: 'rappi.statusPending',
  DISABLED: 'rappi.statusDisabled',
}

/**
 * Rappi fase 3: el dueño conecta, reconecta y desconecta sus tiendas de Rappi sin nadie de por medio. `showRows`: en el
 * panel vivo las tiendas ya tienen su tarjeta (con `RappiStoreActions` adentro), así que aquí sólo va el botón de conectar.
 */
export function RappiConnectionSection({
  venueId,
  rappiChannels,
  showRows = true,
}: {
  venueId: string
  rappiChannels: DeliveryChannelLink[]
  showRows?: boolean
}) {
  const { t } = useTranslation('delivery')
  const { can } = useAccess()
  const canManage = can('delivery-channels:manage')
  const abrir = useAbrirRappi(venueId)
  const hayTiendas = rappiChannels.length > 0

  return (
    <Card className="mx-auto mb-6 max-w-2xl" data-tour="delivery-rappi-section">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{providerLabel('RAPPI')}</p>
            <p className="text-sm text-muted-foreground">{hayTiendas ? t('rappi.subtitleConnected') : t('rappi.subtitleEmpty')}</p>
          </div>
          {canManage ? (
            <Button
              type="button"
              className="cursor-pointer"
              data-tour="delivery-rappi-connect-btn"
              disabled={abrir.abriendo}
              onClick={abrir.abrir}
            >
              {abrir.abriendo && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {hayTiendas ? t('rappi.connectAnother') : t('rappi.connect')}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">{t('rappi.needsAdmin')}</p>
          )}
        </div>
        <EnlaceDeRespaldo enlace={abrir.enlace} />

        {showRows && hayTiendas && (
          <ul className="divide-y divide-border rounded-xl border border-input">
            {rappiChannels.map(c => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">{nombreDe(c)}</span>
                  <Badge variant={c.status === 'ACTIVE' ? 'default' : 'outline'}>{t(STATUS_KEY[c.status])}</Badge>
                </div>
                <div className="w-full sm:w-56">
                  <RappiStoreActions venueId={venueId} channel={c} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
