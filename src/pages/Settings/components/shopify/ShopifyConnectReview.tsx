import { useEffect, useMemo, useState } from 'react'
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
import { useToast } from '@/hooks/use-toast'
import { useInvalidateShopify, useInvalidateShopifyVistaPrevia, useShopifyConnectReview } from '@/hooks/use-shopify'
import { applyShopifyConnect, disconnectShopify, reauthorizeShopify, saveShopifyConnectChoices } from '@/services/shopify.service'
import {
  CONNECT_REVIEW_FILTROS,
  type ConnectReviewFiltro,
  type ShopifyChoice,
  type ShopifyConnectReviewItem,
  type ShopifyConnection,
  type ShopifyVistaConexion,
} from '@/types/shopify'
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
          {/* Nunca un «Cancelar» suelto junto a «Sí, cancelar»: la salida dice qué pasa (C10). */}
          <AlertDialogCancel>{t('preview.cancelKeep')}</AlertDialogCancel>
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

/** Las piezas que quedan, como número, sólo para escoger singular o plural («Queda 1» / «Quedan 5»); lo que se PINTA es el texto del servidor. */
const piezas = (qty: string) => (Number.isFinite(Number(qty)) ? Number(qty) : 0)

/**
 * D1: «Usar el de Avoqado» / «Usar el de Shopify» de UN producto, sin nada marcado hasta que se elige. Cada opción dice cuántas
 * piezas quedan en los dos lados. Se guarda al tocar, con la conexión y los números que se VIERON (si cambiaron, 409 RELEER y
 * se vuelve a leer); mientras se guarda, las dos se apagan (un doble clic no manda dos).
 */
function EleccionDeProducto({ venueId, vista, item }: { venueId: string; vista: ShopifyVistaConexion; item: ShopifyConnectReviewItem }) {
  const { t } = useTranslation('shopify')
  const fallo = useShopifyFallo(venueId)
  const invalidarVista = useInvalidateShopifyVistaPrevia()
  const elegir = useMutation({
    mutationFn: (choice: ShopifyChoice) =>
      saveShopifyConnectChoices(venueId, {
        vista,
        elecciones: [
          { variantLinkId: item.variantLinkId, choice, expectedAvoqadoQty: item.avoqadoQty, expectedShopifyQty: item.shopifyQty ?? 0 },
        ],
      }),
    onSuccess: () => invalidarVista(venueId),
    onError: fallo,
  })
  const opciones: Array<{ choice: ShopifyChoice; label: string; queda: string }> = [
    { choice: 'AVOQADO', label: t('preview.usarAvoqado'), queda: item.avoqadoQty },
    { choice: 'SHOPIFY', label: t('preview.usarShopify'), queda: item.quedara ?? '—' },
  ]
  return (
    <div
      role="radiogroup"
      aria-label={t('preview.eleccionLabel', { name: item.name })}
      className="flex flex-wrap gap-2"
      data-tour="shopify-decision"
    >
      {opciones.map(o => (
        <Button
          key={o.choice}
          type="button"
          size="sm"
          role="radio"
          aria-checked={item.eleccion === o.choice}
          variant={item.eleccion === o.choice ? 'default' : 'outline'}
          disabled={elegir.isPending}
          onClick={() => elegir.mutate(o.choice)}
          className="h-auto flex-col items-start gap-0.5 py-1.5"
        >
          <span>{o.label}</span>
          <span className="text-xs font-normal opacity-80">{t('preview.quedanEnLosDos', { count: piezas(o.queda), qty: o.queda })}</span>
        </Button>
      ))}
    </div>
  )
}

/**
 * D1: la misma opción para los productos que FALTAN por elegir, en todas las páginas (el servidor la guarda producto por
 * producto). Sólo llena los que no tienen elección: lo que se eligió a mano se queda como está, y «Avoqado» se salta los de
 * stock con decimales (Shopify sólo cuenta piezas enteras), que siguen pendientes. También es una elección explícita: ningún
 * botón viene marcado. Después se puede cambiar cualquiera.
 */
function ElegirLosQueFaltan({ venueId, vista, porDecidir }: { venueId: string; vista: ShopifyVistaConexion; porDecidir: number }) {
  const { t } = useTranslation('shopify')
  const { toast } = useToast()
  const fallo = useShopifyFallo(venueId)
  const invalidarVista = useInvalidateShopifyVistaPrevia()
  // El aviso emergente se va a los 5 s y la persona se queda con productos sin elegir sin saber por qué: el último resultado
  // de «Avoqado» que dejó productos pendientes se guarda y su explicación se queda en la página mientras falte elegir (este
  // componente sólo existe con `porDecidir > 0`, así que se va solo cuando ya no falta nada).
  const [dejoPendientes, setDejoPendientes] = useState(false)
  const elegir = useMutation({
    mutationFn: (todos: ShopifyChoice) => saveShopifyConnectChoices(venueId, { vista, todos }),
    onSuccess: async (r, todos) => {
      // Que no queden callados: si «Avoqado» dejó productos sin elegir, se dice por qué (no es una falla: se eligen aparte).
      const dejo = todos === 'AVOQADO' && r.porDecidir > 0
      setDejoPendientes(dejo)
      if (dejo) {
        toast({
          title: t('preview.todosQuedaron', { guardadas: r.guardadas, porDecidir: r.porDecidir }),
          description: t('preview.todosQuedaronDetalle'),
        })
      }
      await invalidarVista(venueId)
    },
    onError: fallo,
  })
  return (
    <div className="space-y-2" data-tour="shopify-decision-todos">
      <p className="text-sm text-foreground">{t('preview.todosAyuda', { count: porDecidir })}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={elegir.isPending} onClick={() => elegir.mutate('AVOQADO')}>
          {t('preview.todosAvoqado')}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={elegir.isPending} onClick={() => elegir.mutate('SHOPIFY')}>
          {t('preview.todosShopify')}
        </Button>
      </div>
      {dejoPendientes && <p className="text-xs text-muted-foreground">{t('preview.todosQuedaronDetalle')}</p>}
    </div>
  )
}

/** REVIEWING sin aplicar: la vista previa real (12 bis.3), paginada y filtrada en el servidor. */
export function ShopifyConnectReview({ venueId, canManage }: { venueId: string; canManage: boolean }) {
  const { t } = useTranslation('shopify')
  const fallo = useShopifyFallo(venueId)
  const invalidate = useInvalidateShopify()
  const [filtro, setFiltro] = useState<ConnectReviewFiltro>('CAMBIAN')
  // W4: abre en la primera pestaña que tenga algo, en este orden: Cambian → Nuevos → Todos (en una primera conexión todo
  // es «Nuevo» y «Cambian» sale vacía). Una sola vez, con el primer resumen: después manda lo que elija la persona.
  const [elegidaSola, setElegidaSola] = useState(false)
  const q = useShopifyConnectReview(venueId, filtro, canManage)
  const items = useMemo(() => dedupe(q.data?.pages.flatMap(p => p.items) ?? [], i => i.variantLinkId), [q.data?.pages])
  const primera = q.data?.pages[0]
  // D1: cuántos faltan por elegir en TODA la vista previa (no sólo en la página cargada) y la conexión que se está viendo.
  const porDecidir = primera?.resumen.porDecidir ?? 0
  const vistaConexion = primera?.conexion ?? null
  useEffect(() => {
    if (elegidaSola || !primera || q.isPlaceholderData) return
    setElegidaSola(true)
    const r = primera.resumen
    const inicial: ConnectReviewFiltro = r.cambian > 0 ? 'CAMBIAN' : r.nuevos > 0 ? 'NUEVOS' : 'TODOS'
    if (inicial !== filtro) setFiltro(inicial)
  }, [elegidaSola, primera, q.isPlaceholderData, filtro])
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
          <Button
            key={f}
            size="sm"
            variant={filtro === f ? 'default' : 'outline'}
            aria-pressed={filtro === f}
            onClick={() => {
              setElegidaSola(true) // lo que elige la persona gana sobre la elección automática
              setFiltro(f)
            }}
          >
            {t(`preview.filtros.${f}`)}
          </Button>
        ))}
      </div>
      {/* D1: «Nuevos» no trae decisiones (esos productos toman Shopify): con decisiones pendientes se dice dónde se eligen. */}
      {filtro === 'NUEVOS' && porDecidir > 0 && <p className="text-sm text-muted-foreground">{t('preview.eligeEnCambian')}</p>}
      {/* D1: con decisiones pendientes, la opción para los que faltan (también en las páginas que no se abrieron). */}
      {vistaConexion && porDecidir > 0 && <ElegirLosQueFaltan venueId={venueId} vista={vistaConexion} porDecidir={porDecidir} />}
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
            <li key={i.variantLinkId} className="space-y-2 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{i.name}</p>
                  <p className="text-xs text-muted-foreground">{i.sku ?? '—'}</p>
                  {/* Lo de Shopify al importar es dato secundario: sólo se enseña cuando no es lo que quedará. */}
                  {!i.requiereDecision && i.shopifyQty != null && i.quedara !== String(i.shopifyQty) && (
                    <p className="text-xs text-muted-foreground">{t('preview.enShopify', { qty: i.shopifyQty })}</p>
                  )}
                </div>
                {i.requiereDecision ? (
                  // D1: con una decisión pendiente no hay un «así quedará» único: se enseñan los dos números.
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {t('preview.ambos', { avoqado: i.avoqadoQty, shopify: i.shopifyQty ?? '—' })}
                  </span>
                ) : (
                  <div className="flex shrink-0 items-center gap-2 tabular-nums">
                    {i.nuevo && <Badge variant="secondary">{t('preview.nuevo')}</Badge>}
                    <span className="text-muted-foreground">{i.avoqadoQty}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <span className="font-medium text-foreground">{i.quedara ?? '—'}</span>
                  </div>
                )}
              </div>
              {i.requiereDecision && vistaConexion && <EleccionDeProducto venueId={venueId} vista={vistaConexion} item={i} />}
            </li>
          ))}
        </ul>
      </ListaPaginada>
      {!listo && <p className="text-xs text-muted-foreground">{t('preview.applyBlocked')}</p>}
      {/* D1: el servidor también lo exige (422), incluidas las páginas que no se abrieron. */}
      {porDecidir > 0 && (
        <p role="status" className="text-sm font-medium text-foreground" data-tour="shopify-por-decidir">
          {t('preview.porDecidir', { count: porDecidir })}
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={!listo || porDecidir > 0 || apply.isPending} data-tour="shopify-apply">
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
              <AlertDialogAction disabled={!listo || porDecidir > 0} onClick={() => listo && porDecidir === 0 && apply.mutate()}>
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
