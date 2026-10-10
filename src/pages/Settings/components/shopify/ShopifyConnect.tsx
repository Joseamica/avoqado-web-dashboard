import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, MapPin } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { salesWhatsAppLink } from '@/config/plan-catalog'
import { useInvalidateShopify, useShopifyLocations } from '@/hooks/use-shopify'
import { confirmShopifyConnect, explicarErrorShopify, startShopifyConnect, textoDeErrorShopify } from '@/services/shopify.service'
import { Cargando } from './ShopifyListStates'
import { dominioValido, type Navegar, useShopifyFallo } from './shopify.helpers'

/**
 * Sin acceso a la función en la Fase 1 (Premium comercial, Pro, Gratis): el piloto se abre por invitación. NO es el
 * paywall genérico: ése ofrece comprar el plan, y comprarlo no daría Shopify (Codex N2). Sin `settings:manage` el botón se ve
 * deshabilitado y dice a quién pedirlo.
 */
export function ShopifyPiloto({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation('shopify')
  return (
    <section className="space-y-3 rounded-xl border border-input p-4" data-tour="shopify-piloto">
      <p className="font-medium text-foreground">{t('piloto.title')}</p>
      <p className="text-sm text-muted-foreground">{t('piloto.body')}</p>
      {canManage ? (
        <Button asChild size="sm" data-tour="shopify-piloto-contact">
          <a href={salesWhatsAppLink(t('piloto.whatsappMessage'))} target="_blank" rel="noreferrer">
            {t('piloto.contact')}
          </a>
        </Button>
      ) : (
        <>
          <Button size="sm" disabled data-tour="shopify-piloto-contact">
            {t('piloto.contact')}
          </Button>
          <p className="text-sm text-muted-foreground">{t('piloto.askOwner')}</p>
        </>
      )}
    </section>
  )
}

/**
 * Sin conexión: el dominio. De regreso con `?intent=`: la ubicación. Sin `settings:manage` se VE, deshabilitado (la página dice
 * por qué y a quién pedirlo: «apagado se ve y se explica»).
 *
 * Los errores salen del mapa de C7 (`explicarErrorShopify`), con su acción:
 * - VOLVER_A_EMPEZAR / REAUTORIZAR dentro del asistente ⇒ «Volver a empezar» (suelta el intent: un OAuth nuevo). Volver a dar
 *   permiso sólo tiene sentido con una conexión, y aquí todavía no la hay.
 * - REINTENTAR_LUEGO ⇒ se dice y el intent se CONSERVA (T6): sigue la misma ubicación a un toque; nada se reintenta solo.
 */
export function ShopifyConnect({
  venueId,
  intent,
  canManage,
  navegar,
  onDone,
}: {
  venueId: string
  intent: string | null
  canManage: boolean
  navegar: Navegar
  onDone: () => void
}) {
  const { t } = useTranslation('shopify')
  const fallo = useShopifyFallo(venueId)
  const invalidate = useInvalidateShopify()
  const [domain, setDomain] = useState('')
  const [soloPiloto, setSoloPiloto] = useState(false)
  /** El texto del error que obliga a empezar de nuevo (el intent ya no sirve). */
  const [reinicio, setReinicio] = useState<string | null>(null)
  const locations = useShopifyLocations(venueId, intent)
  const valido = dominioValido(domain)

  const start = useMutation({
    mutationFn: () => startShopifyConnect(venueId, domain),
    onSuccess: d => navegar(d.url),
    onError: (e: unknown) => (explicarErrorShopify(e).clave === 'errors.codes.SHOPIFY_SOLO_PILOTO' ? setSoloPiloto(true) : fallo(e)),
  })
  const confirm = useMutation({
    mutationFn: (locationId: string) => confirmShopifyConnect(venueId, { intent: intent!, locationId }),
    onSuccess: async () => {
      onDone()
      await invalidate(venueId)
    },
    onError: (e: unknown) => {
      const accion = fallo(e)
      if (accion && accion !== 'REINTENTAR_LUEGO') setReinicio(textoDeErrorShopify(t, e))
    },
  })

  if (intent && canManage) {
    if (reinicio) {
      return (
        <Alert variant="destructive" data-tour="shopify-connect-restart">
          <AlertDescription>{reinicio}</AlertDescription>
          <Button variant="outline" size="sm" className="col-start-2 mt-2 justify-self-start" onClick={onDone}>
            {t('connect.restart')}
          </Button>
        </Alert>
      )
    }
    if (locations.isLoading) return <Cargando />
    if (locations.isError) {
      const reintentable = explicarErrorShopify(locations.error).accion === 'REINTENTAR_LUEGO'
      return (
        <Alert variant="destructive">
          <AlertDescription>{textoDeErrorShopify(t, locations.error)}</AlertDescription>
          <div className="col-start-2 mt-2 flex flex-wrap gap-2">
            {reintentable && (
              <Button variant="outline" size="sm" onClick={() => locations.refetch()} disabled={locations.isFetching}>
                {t('common:retry')}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onDone}>
              {t('connect.restart')}
            </Button>
          </div>
        </Alert>
      )
    }
    const lista = locations.data ?? []
    return (
      <section className="space-y-3 rounded-xl border border-input p-4" data-tour="shopify-connect-location">
        <div>
          <p className="font-medium text-foreground">{t('connect.chooseLocation')}</p>
          <p className="text-sm text-muted-foreground">{t('connect.chooseLocationHelp')}</p>
        </div>
        {lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('connect.noLocations')}</p>
        ) : (
          <div className="grid gap-2">
            {lista.map(l => (
              <Button
                key={l.id}
                variant="outline"
                className="justify-start gap-2"
                disabled={confirm.isPending}
                onClick={() => confirm.mutate(l.id)}
                data-tour="shopify-connect-location-option"
              >
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{l.name}</span>
              </Button>
            ))}
          </div>
        )}
      </section>
    )
  }

  return (
    <form
      className="space-y-4 rounded-xl border border-input p-4"
      onSubmit={e => {
        e.preventDefault()
        if (canManage && valido) start.mutate()
      }}
      data-tour="shopify-connect-form"
    >
      <div>
        <p className="font-medium text-foreground">{t('connect.title')}</p>
        <p className="text-sm text-muted-foreground">{t('connect.body')}</p>
      </div>
      {soloPiloto && (
        <Alert>
          <AlertTitle>{t('connect.soloPilotoTitle')}</AlertTitle>
          {/* El texto del piloto sale del mapa de errores, sin hablar de plan (N2). */}
          <AlertDescription>{t('errors.codes.SHOPIFY_SOLO_PILOTO')}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-1">
        <Label htmlFor="shopify-domain">{t('connect.domainLabel')}</Label>
        <Input
          id="shopify-domain"
          value={domain}
          disabled={!canManage}
          onChange={e => {
            setDomain(e.target.value)
            setSoloPiloto(false)
          }}
          placeholder={t('connect.domainPlaceholder')}
          autoComplete="off"
          aria-invalid={!!domain.trim() && !valido}
          data-tour="shopify-connect-domain"
        />
        {domain.trim() && !valido ? (
          <p className="text-xs text-destructive">{t('errors.codes.SHOPIFY_DOMINIO_INVALIDO')}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{t('connect.domainHelp')}</p>
        )}
      </div>
      <Button type="submit" disabled={!canManage || start.isPending || !valido} data-tour="shopify-connect-submit">
        {start.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('connect.submit')}
      </Button>
    </form>
  )
}
