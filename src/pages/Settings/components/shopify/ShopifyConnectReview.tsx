import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Loader2 } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { salesWhatsAppLink } from '@/config/plan-catalog'
import { useInvalidateShopify, useShopifyConnectReview } from '@/hooks/use-shopify'
import { applyShopifyConnect, disconnectShopify, reauthorizeShopify } from '@/services/shopify.service'
import { CONNECT_REVIEW_FILTROS, type ConnectReviewFiltro, type ShopifyConnection } from '@/types/shopify'
import { ListaPaginada } from './ShopifyListStates'
import { dedupe, type Navegar, useShopifyFallo } from './shopify.helpers'

/** «Cancelar la conexión» = desconectar, sin candado de plan: siempre se puede salir. Sin `settings:manage` se ve deshabilitado. */
function CancelarConexion({ venueId, canManage }: { venueId: string; canManage: boolean }) {
  const { t } = useTranslation('shopify')
  const fallo = useShopifyFallo(venueId)
  const invalidate = useInvalidateShopify()
  const cancelar = useMutation({
    mutationFn: () => disconnectShopify(venueId),
    onSuccess: () => invalidate(venueId),
    onError: fallo,
  })
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={!canManage || cancelar.isPending} data-tour="shopify-cancel-connect">
          {t('preview.cancel')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('preview.cancelTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('preview.cancelBody')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={() => cancelar.mutate()}>{t('preview.cancelConfirm')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** IMPORTANDO y APLICANDO sin error permanente: el resumen se pide cada 5 s, así que esto avanza solo. */
export function ShopifyProgreso({ connection }: { connection: ShopifyConnection }) {
  const { t } = useTranslation('shopify')
  const a = connection.aplicacion
  const aplicando = connection.estado === 'APLICANDO'
  return (
    <section role="status" className="space-y-3 rounded-xl border border-input p-4" data-tour="shopify-progress">
      <p className="flex items-center gap-2 font-medium text-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        {aplicando ? t('preview.applyRequested') : t('connect.importing')}
      </p>
      {aplicando ? (
        a && (
          <>
            <Progress value={a.total ? Math.round((a.hechas / a.total) * 100) : 0} />
            <p className="text-sm text-muted-foreground">{t('preview.applying', { hechas: a.hechas, total: a.total })}</p>
          </>
        )
      ) : (
        <p className="text-sm text-muted-foreground">{t('connect.importedCount', { n: connection.importacion.variantes })}</p>
      )}
      {/* Z6: un error que el worker reintenta (no es de los 3 que detienen) no detiene el avance: sólo se dice, genérico. */}
      {connection.importacion.error && (
        <Alert>
          <AlertDescription>{t('connect.importErrors.generic')}</AlertDescription>
        </Alert>
      )}
    </section>
  )
}

/**
 * Importación, vista previa o aplicación DETENIDA por un error permanente (Codex N7, Z2): no hay avance que esperar ni sondeo
 * (`intervaloDelResumen`). Se ofrece lo que la arregla: volver a dar permiso (FALTA_PERMISO), escribirnos (catálogo muy
 * grande o catálogo maestro: el texto dice a quién pedir que lo libere) o cancelar la conexión. Sin `settings:manage` los
 * botones se ven deshabilitados y se dice a quién pedírselo.
 */
export function ShopifyImportDetenida({
  venueId,
  connection,
  canManage,
  navegar,
}: {
  venueId: string
  connection: ShopifyConnection
  canManage: boolean
  navegar: Navegar
}) {
  const { t } = useTranslation('shopify')
  const fallo = useShopifyFallo(venueId)
  const error = connection.importacion.error
  const reautorizar = useMutation({
    mutationFn: () => reauthorizeShopify(venueId),
    onSuccess: d => navegar(d.url),
    onError: fallo,
  })
  return (
    <section role="alert" className="space-y-3 rounded-xl border border-destructive/40 p-4" data-tour="shopify-import-stopped">
      <p className="font-medium text-foreground">{t('connect.importStopped')}</p>
      <p className="text-sm text-muted-foreground">{t(`connect.importErrors.${error}`)}</p>
      <div className="flex flex-wrap gap-2">
        {error === 'FALTA_PERMISO' ? (
          <Button onClick={() => reautorizar.mutate()} disabled={!canManage || reautorizar.isPending} data-tour="shopify-reauthorize">
            {t('avisos.reauthorize')}
          </Button>
        ) : canManage ? (
          <Button asChild variant="outline">
            <a href={salesWhatsAppLink(t('piloto.whatsappMessage'))} target="_blank" rel="noreferrer">
              {t('piloto.contact')}
            </a>
          </Button>
        ) : (
          <Button variant="outline" disabled>
            {t('piloto.contact')}
          </Button>
        )}
        <CancelarConexion venueId={venueId} canManage={canManage} />
      </div>
      {!canManage && <p className="text-sm text-muted-foreground">{t('connect.importStoppedAskAdmin')}</p>}
    </section>
  )
}

/** REVIEWING sin aplicar: la vista previa real (12 bis.3), paginada y filtrada en el servidor. */
export function ShopifyConnectReview({ venueId, canManage }: { venueId: string; canManage: boolean }) {
  const { t } = useTranslation('shopify')
  const fallo = useShopifyFallo(venueId)
  const invalidate = useInvalidateShopify()
  const [filtro, setFiltro] = useState<ConnectReviewFiltro>('CAMBIAN')
  const q = useShopifyConnectReview(venueId, filtro, canManage)
  const items = useMemo(() => dedupe(q.data?.pages.flatMap(p => p.items) ?? [], i => i.variantLinkId), [q.data?.pages])
  const primera = q.data?.pages[0]
  // 🔴 N3: sólo con la vista previa de ESTA sucursal y ESTE filtro cargada bien. Cargando, error (también una actualización
  // fallida) o datos provisionales (`isPlaceholderData`, p. ej. al cambiar de filtro) ⇒ no se aplica.
  const listo = canManage && q.status === 'success' && !q.isPlaceholderData
  const apply = useMutation({
    mutationFn: () => applyShopifyConnect(venueId),
    onSuccess: () => invalidate(venueId),
    onError: fallo,
  })

  if (!canManage) {
    // Apagado se ve y se explica: el título, quién puede y los botones deshabilitados (la vista previa pide `settings:manage`).
    return (
      <section className="space-y-4 rounded-xl border border-input p-4" data-tour="shopify-preview">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('preview.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('preview.body')}</p>
        </div>
        <Alert className="border-input bg-muted/40">
          <AlertDescription className="text-sm text-muted-foreground">{t('preview.readOnly')}</AlertDescription>
        </Alert>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button disabled data-tour="shopify-apply">
            {t('preview.apply')}
          </Button>
          <CancelarConexion venueId={venueId} canManage={false} />
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4 rounded-xl border border-input p-4" data-tour="shopify-preview">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t('preview.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('preview.body')}</p>
      </div>
      {primera && <p className="text-sm text-foreground">{t('preview.resumen', primera.resumen)}</p>}
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('preview.filtroLabel')}>
        {CONNECT_REVIEW_FILTROS.map(f => (
          <Button key={f} size="sm" variant={filtro === f ? 'default' : 'outline'} aria-pressed={filtro === f} onClick={() => setFiltro(f)}>
            {t(`preview.filtros.${f}`)}
          </Button>
        ))}
      </div>
      <ListaPaginada
        q={q}
        cuantos={items.length}
        total={primera?.total ?? 0}
        vacio={t('preview.empty')}
        textoError={t('preview.loadError')}
      >
        <div className="flex items-center justify-end gap-2 px-3 text-xs text-muted-foreground">
          <span>{t('preview.hoy')}</span>
          <ArrowRight className="h-3 w-3" aria-hidden />
          <span>{t('preview.quedara')}</span>
        </div>
        <ul className="divide-y divide-border rounded-lg border border-input">
          {items.map(i => (
            <li key={i.variantLinkId} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{i.name}</p>
                <p className="text-xs text-muted-foreground">{i.sku ?? '—'}</p>
                {/* Lo de Shopify al importar es dato secundario: sólo se enseña cuando no es lo que quedará. */}
                {i.shopifyQty != null && i.quedara !== String(i.shopifyQty) && (
                  <p className="text-xs text-muted-foreground">{t('preview.enShopify', { qty: i.shopifyQty })}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2 tabular-nums">
                {i.nuevo && <Badge variant="secondary">{t('preview.nuevo')}</Badge>}
                <span className="text-muted-foreground">{i.avoqadoQty}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                <span className="font-medium text-foreground">{i.quedara ?? '—'}</span>
              </div>
            </li>
          ))}
        </ul>
      </ListaPaginada>
      {!listo && <p className="text-xs text-muted-foreground">{t('preview.applyBlocked')}</p>}
      <div className="flex flex-wrap gap-2 pt-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={!listo || apply.isPending} data-tour="shopify-apply">
              {t('preview.apply')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('preview.applyTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('preview.applyBody')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
              {/* Doble candado: si la vista previa falla con el diálogo abierto, confirmar tampoco aplica. */}
              <AlertDialogAction disabled={!listo} onClick={() => listo && apply.mutate()}>
                {t('preview.applyConfirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <CancelarConexion venueId={venueId} canManage={canManage} />
      </div>
    </section>
  )
}
