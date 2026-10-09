import type { ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { salesWhatsAppLink } from '@/config/plan-catalog'
import { useToast } from '@/hooks/use-toast'
import { claveDelCuadre, useInvalidateShopify, useInvalidateShopifyResumen, useShopifyProximoIntento } from '@/hooks/use-shopify'
import { disconnectShopify, reauthorizeShopify, resyncShopify } from '@/services/shopify.service'
import { conexionDetenida, esErrorPermanente, SHOPIFY_AVISOS, type ShopifyConnection, type ShopifyOverview } from '@/types/shopify'
import { useVenueDateTime } from '@/utils/datetime'
import { type Navegar, useShopifyFallo } from './shopify.helpers'

/**
 * El resumen de la conexión (ACTIVA · PAUSADA · REVOCADA) con sus acciones. Todo botón se VE aunque falte `settings:manage`
 * (deshabilitado; la página dice por qué y a quién pedirlo). Una conexión DETENIDA (Z2: revocada o con un error permanente)
 * muestra su llamada a la acción y no pinta los cambios en camino ni el retraso como avance.
 */
export function ShopifyStatusCard({
  venueId,
  overview,
  connection,
  canManage,
  navegar,
}: {
  venueId: string
  overview: ShopifyOverview
  connection: ShopifyConnection
  canManage: boolean
  navegar: Navegar
}) {
  const { t } = useTranslation('shopify')
  const { toast } = useToast()
  const { formatDateTime } = useVenueDateTime()
  const invalidate = useInvalidateShopify()
  const invalidarResumen = useInvalidateShopifyResumen()
  const fallo = useShopifyFallo(venueId)
  const proximoIntento = useShopifyProximoIntento(connection)
  const planActive = overview.planActive
  const detenida = conexionDetenida(connection)
  // Reconectar (REVOCADA) y volver a dar permiso (FALTA_PERMISO) son el mismo viaje a Shopify con la tienda ligada.
  const reautorizar = useMutation({ mutationFn: () => reauthorizeShopify(venueId), onSuccess: d => navegar(d.url), onError: fallo })
  // N6: el cuadre lo hace el worker DESPUÉS. Se pide sólo el resumen, que se sondea mientras `cuadre.pendiente`; al
  // terminar, la página refresca las listas.
  const cuadrar = useMutation({
    mutationFn: () => resyncShopify(venueId),
    onSuccess: () => {
      toast({ title: t('status.resyncDone') })
      return invalidarResumen(venueId)
    },
    onError: fallo,
  })
  const desconectar = useMutation({
    mutationFn: () => disconnectShopify(venueId),
    onSuccess: () => {
      toast({ title: t('status.disconnected') })
      return invalidate(venueId)
    },
    onError: fallo,
  })
  const c = connection.conteos
  // Z3/L7: «en curso» sólo si de verdad corre; pausada o sin acceso, el pedido espera («se cuadrará al reanudar»).
  const claveCuadre = claveDelCuadre(overview)
  const contacto = (
    <Button asChild variant="link" size="sm" className="h-auto p-0">
      <a href={salesWhatsAppLink(t('piloto.whatsappMessage'))} target="_blank" rel="noreferrer">
        {t('piloto.contact')}
      </a>
    </Button>
  )
  const fila = (label: string, valor: ReactNode) => (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{valor}</span>
    </div>
  )

  return (
    <section className="space-y-3 rounded-xl border border-input p-4" data-tour="shopify-status">
      <p className="font-medium text-foreground">{t(`estado.${connection.estado}`)}</p>
      {connection.estado === 'PAUSADA' && (
        <Alert>
          {/* N2: nunca «contrata Premium»: en la Fase 1 el acceso es el del piloto. */}
          <AlertDescription>
            <p>{planActive ? t('status.pausedOther') : t('status.paused')}</p>
            {!planActive && <p className="mt-1">{t('status.pausedContact')}</p>}
            {!planActive && contacto}
          </AlertDescription>
        </Alert>
      )}
      {connection.estado === 'REVOCADA' && (
        <Alert variant="destructive">
          <AlertDescription>{t('status.revoked')}</AlertDescription>
          <Button
            size="sm"
            className="col-start-2 mt-2 justify-self-start"
            onClick={() => reautorizar.mutate()}
            disabled={!canManage || reautorizar.isPending}
            data-tour="shopify-reconnect"
          >
            {t('status.reconnect')}
          </Button>
          {!canManage && <p className="col-start-2 mt-1 text-sm">{t('status.reconnectAskAdmin')}</p>}
        </Alert>
      )}
      {/* Ya activa también puede quedar una marca permanente (B: FALTA_PERMISO en cualquier ruta, incluido resolver): se
          dice con su salida. */}
      {detenida && connection.estado !== 'REVOCADA' && esErrorPermanente(connection.importacion.error) && (
        <Alert variant="destructive">
          <AlertDescription>{t(`connect.importErrors.${connection.importacion.error}`)}</AlertDescription>
          {connection.importacion.error === 'FALTA_PERMISO' && (
            <>
              <Button
                size="sm"
                className="col-start-2 mt-2 justify-self-start"
                onClick={() => reautorizar.mutate()}
                disabled={!canManage || reautorizar.isPending}
              >
                {t('avisos.reauthorize')}
              </Button>
              {!canManage && <p className="col-start-2 mt-1 text-sm">{t('status.reconnectAskAdmin')}</p>}
            </>
          )}
        </Alert>
      )}
      {fila(t('status.store'), connection.shopDomain)}
      {fila(t('status.location'), connection.locationName)}
      {fila(t('status.matched'), c.emparejados)}
      {/* Z2: detenida, lo que está en camino no avanza: no se pinta como progreso. */}
      {!detenida && fila(t('status.pending'), c.pendientes)}
      {c.atorados > 0 && fila(t('status.stuck'), c.atorados)}
      {c.inciertos > 0 && fila(t('status.uncertain'), c.inciertos)}
      {!detenida &&
        connection.retrasoMin != null &&
        connection.retrasoMin > 0 &&
        fila(t('status.delay'), t('status.delayMinutes', { n: connection.retrasoMin }))}
      {fila(
        t('status.lastReconcile'),
        claveCuadre ? t(claveCuadre) : connection.cuadre.ultimo ? formatDateTime(connection.cuadre.ultimo) : t('status.never'),
      )}
      {proximoIntento && <p className="text-xs text-muted-foreground">{proximoIntento}</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        {connection.estado === 'ACTIVA' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => cuadrar.mutate()}
            // R2-4/Z2: sin plan, o detenida, el worker no cuadra esta sucursal: «Cuadre en curso…» se quedaría para siempre.
            disabled={!canManage || cuadrar.isPending || connection.cuadre.pendiente || !planActive || detenida}
            data-tour="shopify-resync"
          >
            {t('status.resync')}
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={!canManage || desconectar.isPending} data-tour="shopify-disconnect">
              {t('status.disconnect')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('status.disconnectTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('status.disconnectBody')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={() => desconectar.mutate()}>{t('status.disconnectConfirm')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {connection.estado === 'ACTIVA' && connection.importacion.error === 'FALTA_PERMISO' && (
        <p className="text-xs text-muted-foreground">{t('status.resyncBlocked')}</p>
      )}
      {/* Cada aviso de la campanita liga aquí: la página dice qué significa y qué hacer (plan A, A5). */}
      <details className="rounded-lg border border-input p-3 text-sm" data-tour="shopify-avisos">
        <summary className="cursor-pointer font-medium text-foreground">{t('avisos.title')}</summary>
        <p className="mt-2 text-muted-foreground">{t('avisos.intro')}</p>
        <ul className="mt-2 space-y-2">
          {SHOPIFY_AVISOS.map(a => (
            <li key={a}>
              <p className="font-medium text-foreground">{t(`avisos.items.${a}.title`)}</p>
              <p className="text-muted-foreground">{t(`avisos.items.${a}.body`)}</p>
              {a === 'FALTA_PERMISO' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1"
                  onClick={() => reautorizar.mutate()}
                  disabled={!canManage || reautorizar.isPending}
                >
                  {t('avisos.reauthorize')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
