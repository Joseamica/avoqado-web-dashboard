import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/useDebounce'
import {
  claveDelEnvio,
  enviosPuedenAvanzar,
  useInvalidateShopify,
  useInvalidateShopifyResumen,
  useShopifyEnviosEnCamino,
  useShopifyReviews,
} from '@/hooks/use-shopify'
import { resolveShopifyReview } from '@/services/shopify.service'
import type { ShopifyChoice, ShopifyEnvio, ShopifyOverview, ShopifyReview } from '@/types/shopify'
import { ListaPaginada } from './ShopifyListStates'
import { dedupe, useShopifyFallo } from './shopify.helpers'

const OPCIONES: readonly ShopifyChoice[] = ['AVOQADO', 'SHOPIFY']
/** El ancla a la que ligan los avisos de la campanita, el correo diario y el detalle de un conteo (L19). */
const ANCLA = '#por-revisar'

export function ShopifyReviewList({
  venueId,
  overview,
  sinPermiso,
  motivoSinResolver,
}: {
  venueId: string
  /** El resumen vigente: dice si las elecciones en camino pueden avanzar (`enviosPuedenAvanzar`) y cómo se cuentan (L7, Z7). */
  overview: ShopifyOverview | undefined
  /** Al usuario le falta `inventory:adjust`: los botones se VEN, deshabilitados, y el texto dice a quién pedirlo. */
  sinPermiso: boolean
  /** null ⇒ se puede resolver; si no, el texto de por qué no (permiso o conexión no activa). */
  motivoSinResolver: string | null
}) {
  const { t } = useTranslation('shopify')
  const { toast } = useToast()
  const { hash } = useLocation()
  const fallo = useShopifyFallo(venueId)
  const invalidate = useInvalidateShopify()
  const invalidarResumen = useInvalidateShopifyResumen()
  const [busqueda, setBusqueda] = useState('')
  const q = useDebounce(busqueda.trim(), 300)
  const lista = useShopifyReviews(venueId, q, true)
  // `filas` memoizadas: el hook de envíos las funde por id y no debe rehacer la fusión en cada render (C7, requisito 6).
  const cargadas = useMemo(
    () => dedupe(lista.data?.pages.flatMap(p => p.items.map(item => ({ item, at: p.recibidoEn }))) ?? [], f => f.item.id),
    [lista.data?.pages],
  )
  // R2-4/R3-3: las páginas cargadas NO se sondean; el estado de sus elecciones en camino se pregunta por tandas de ≤ 50 sobre el
  // estado actualizado y se funde por id. Sólo mientras la conexión puede avanzar (plan activo, ACTIVA, sin error permanente).
  const items = useShopifyEnviosEnCamino(venueId, cargadas, enviosPuedenAvanzar(overview))

  // Requisito 8c (ruling del controlador): cuando un envío sondeado PASA de «en camino» a ATORADO o ENVIADO sólo cambian los
  // conteos del resumen: la lista conserva esa misma fila RESUELTA con el mismo total (el sondeo ya la pintó), una DEAD_LETTER no
  // abre una revisión nueva (la abre el siguiente cuadre, y la página ya vigila `cuadre.ultimo`/`pendiente`) y los productos
  // sin pareja no dependen de los envíos. Se refresca SÓLO el resumen, una vez por cambio.
  const antes = useRef<Map<string, ShopifyEnvio | null> | null>(null)
  useEffect(() => {
    const previo = antes.current
    antes.current = new Map(items.map(i => [i.id, i.envio]))
    if (!previo) return
    if (items.some(i => previo.get(i.id) === 'PENDIENTE' && (i.envio === 'ATORADO' || i.envio === 'ENVIADO'))) {
      void invalidarResumen(venueId)
    }
  }, [items, venueId, invalidarResumen])

  // L19: el hash no hace scroll solo porque la sección aparece DESPUÉS de cargar el resumen: se baja una vez, ya con la lista.
  const seccion = useRef<HTMLElement>(null)
  const yaBajo = useRef(false)
  useEffect(() => {
    if (hash !== ANCLA || yaBajo.current || lista.isLoading) return
    yaBajo.current = true
    seccion.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }, [hash, lista.isLoading])

  const resolver = useMutation({
    mutationFn: (v: { item: ShopifyReview; choice: ShopifyChoice }) =>
      resolveShopifyReview(venueId, v.item.id, {
        choice: v.choice,
        expectedAvoqadoQty: v.item.avoqadoQty,
        expectedShopifyQty: v.item.shopifyQty,
      }),
    // La elección en camino la dice la LISTA (su envío, persistido en el server; N5): aquí sólo el aviso y refrescar.
    onSuccess: r => {
      toast({ title: r.estado === 'ENVIO_PENDIENTE' ? t('review.savedChoice') : t('review.resolved') })
      return invalidate(venueId)
    },
    // Un 409 «cambió» (RELEER) trae números nuevos: `fallo` vuelve a leer para que el dueño elija sobre lo vigente (N13).
    onError: fallo,
  })
  // Con permiso del usuario pero sin conexión que lo permita, los botones se ocultan (el texto dice por qué); sin permiso del
  // usuario se ven deshabilitados.
  const verBotones = motivoSinResolver === null || sinPermiso
  const puedeResolver = motivoSinResolver === null

  return (
    <section id="por-revisar" ref={seccion} className="space-y-3" data-tour="shopify-reviews">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('review.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('review.intro')}</p>
        </div>
        <Input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder={t('review.search')}
          aria-label={t('review.search')}
          className="w-full sm:w-64"
          data-tour="shopify-reviews-search"
        />
      </div>
      {motivoSinResolver && <p className="text-sm text-muted-foreground">{motivoSinResolver}</p>}
      <ListaPaginada
        q={lista}
        cuantos={items.length}
        total={lista.data?.pages[0]?.total ?? 0}
        vacio={q ? t('review.noMatches') : t('review.empty')}
        textoError={t('review.loadError')}
      >
        {items.map(item => {
          const claveEnvio = claveDelEnvio(item, overview)
          return item.status === 'RESOLVED' ? (
            <div key={item.id} className="space-y-1 rounded-lg border border-input p-3" data-tour="shopify-review-choice">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-foreground">{item.product.name}</span>
                <span className="text-xs text-muted-foreground">{item.product.sku ?? '—'}</span>
              </div>
              {item.choice && <p className="text-sm text-foreground">{t(`review.elegiste.${item.choice}`)}</p>}
              {/* Z7: sin envío en camino sólo se dice qué eligió, nunca «ya llegó». Con la conexión que no avanza: «en pausa». */}
              {item.envio && claveEnvio && (
                <p className={item.envio === 'ATORADO' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>{t(claveEnvio)}</p>
              )}
            </div>
          ) : (
            <div key={item.id} className="space-y-2 rounded-lg border border-input p-3" data-tour="shopify-review-item">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-foreground">{item.product.name}</span>
                <span className="text-xs text-muted-foreground">{item.product.sku ?? '—'}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t(`review.reasons.${item.reason}`)}</p>
              <div className="flex gap-4 text-sm tabular-nums text-foreground">
                <span>{t('review.avoqado', { qty: item.avoqadoQty })}</span>
                <span>{t('review.shopify', { qty: item.shopifyQty })}</span>
              </div>
              {item.atorados > 0 && <p className="text-xs text-muted-foreground">{t('review.stuck', { n: item.atorados })}</p>}
              {verBotones && (
                <div className="flex flex-wrap items-center gap-3">
                  {OPCIONES.map(choice => (
                    // El Badge va FUERA del botón: así el nombre accesible del botón es sólo su acción (Codex #36).
                    <span key={choice} className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant={item.suggestion === choice ? 'default' : 'outline'}
                        disabled={!puedeResolver || resolver.isPending}
                        onClick={() => resolver.mutate({ item, choice })}
                      >
                        {choice === 'AVOQADO' ? t('review.useAvoqado') : t('review.useShopify')}
                      </Button>
                      {item.suggestion === choice && <Badge variant="secondary">{t('review.suggested')}</Badge>}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </ListaPaginada>
    </section>
  )
}
