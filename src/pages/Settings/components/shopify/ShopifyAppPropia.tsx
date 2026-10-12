import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Copy, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useInvalidateShopify } from '@/hooks/use-shopify'
import { useToast } from '@/hooks/use-toast'
import { connectShopifyOwnApp } from '@/services/shopify.service'
import { SHOPIFY_PERMISOS_APP } from '@/types/shopify'
import { useShopifyFallo } from './shopify.helpers'

const PASOS = ['1', '2', '3', '4', '5', '6'] as const
const PERMISOS = SHOPIFY_PERMISOS_APP.join(',')

/**
 * 5a, «Conecta con la app de tu tienda» (spec §6): los 6 pasos en pantalla con los permisos para copiar, el Client ID, el Client
 * Secret (oculto y sin autocompletar) y «Conectar». El dominio viene fijo. CONNECT devuelve el intent y sigue la ubicación de
 * siempre (`onIntent`); REAUTHORIZE («Cambiar llaves» o «Reconectar») cambia las llaves en el acto (`onListo`). Un error se dice con
 * el texto del mapa de C7 y el bloque se queda con el Client ID para corregirlo. El secret vive sólo en el estado de este bloque
 * (se vacía en cuanto termina la petición, con éxito o con error): no se guarda en el navegador ni se registra.
 */
export function ShopifyAppPropia({
  venueId,
  shopDomain,
  purpose,
  canManage,
  onIntent,
  onListo,
  onCancelar,
}: {
  venueId: string
  shopDomain: string
  purpose: 'CONNECT' | 'REAUTHORIZE'
  canManage: boolean
  onIntent?: (intent: string) => void
  onListo?: () => void
  onCancelar: () => void
}) {
  const { t } = useTranslation('shopify')
  const { toast } = useToast()
  const fallo = useShopifyFallo(venueId)
  const invalidate = useInvalidateShopify()
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const reautoriza = purpose === 'REAUTHORIZE'
  const clientIdRef = useRef<HTMLInputElement>(null)
  // «Reconectar», «Volver a dar permiso» y «Cambiar llaves» abren el bloque abajo de la tarjeta: se trae a la vista con el cursor en el
  // Client ID, para que el dueño vea que se abrió (jsdom no implementa `scrollIntoView`).
  useEffect(() => {
    const el = clientIdRef.current
    if (reautoriza && el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center' })
  }, [reautoriza])
  const completas = !!clientId.trim() && !!clientSecret.trim()
  const conectar = useMutation({
    // Un error de axios lleva el cuerpo de la petición (con el secret): al desmontar el bloque la caché no lo conserva.
    gcTime: 0,
    mutationFn: () => connectShopifyOwnApp(venueId, purpose, { shopDomain, clientId, clientSecret }),
    onSuccess: async r => {
      if ('intent' in r) return onIntent?.(r.intent)
      toast({ title: t('connect.reauthorized') })
      await invalidate(venueId)
      onListo?.()
    },
    onError: fallo,
    // El secret no se queda en el estado cuando la petición terminó: si Shopify lo rechazó, el dueño lo vuelve a pegar.
    onSettled: () => setClientSecret(''),
  })
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(PERMISOS)
      toast({ title: t('connect.appPropia.copiados') })
    } catch {
      // Sin portapapeles (navegador viejo o sin permiso): la lista sigue a la vista para copiarla a mano.
    }
  }
  return (
    <form
      className="space-y-4 rounded-xl border border-input p-4"
      onSubmit={e => {
        e.preventDefault()
        if (canManage && completas) conectar.mutate()
      }}
      data-tour="shopify-app-propia"
    >
      <div>
        <p className="font-medium text-foreground">{t('connect.appPropia.title')}</p>
        <p className="text-sm text-muted-foreground">{t('connect.appPropia.body')}</p>
      </div>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
        {PASOS.map(p => (
          <li key={p}>
            {t(`connect.appPropia.pasos.${p}`)}
            {p === '2' && (
              <div className="mt-2 space-y-2">
                <code className="block break-all rounded-md bg-muted px-2 py-1 text-xs">{PERMISOS}</code>
                <Button type="button" variant="outline" size="sm" onClick={copiar} data-tour="shopify-app-propia-copiar">
                  <Copy className="mr-2 h-4 w-4" />
                  {t('connect.appPropia.copiar')}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="space-y-1">
        <Label htmlFor="shopify-client-id">{t('connect.appPropia.clientIdLabel')}</Label>
        <Input
          id="shopify-client-id"
          ref={clientIdRef}
          autoFocus={reautoriza}
          value={clientId}
          disabled={!canManage}
          onChange={e => setClientId(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
          data-bwignore
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="shopify-client-secret">{t('connect.appPropia.clientSecretLabel')}</Label>
        <Input
          id="shopify-client-secret"
          type="password"
          value={clientSecret}
          disabled={!canManage}
          onChange={e => setClientSecret(e.target.value)}
          // Chrome ignora "off" en un password; "new-password" evita que rellene la contraseña de Avoqado aquí y que ofrezca guardar
          // el secret. Los data-* piden lo mismo a los gestores de contraseñas (1Password, LastPass, Bitwarden).
          autoComplete="new-password"
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
          data-bwignore
        />
        <p className="text-xs text-muted-foreground">{t('connect.appPropia.clientSecretHelp')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!canManage || !completas || conectar.isPending} data-tour="shopify-app-propia-submit">
          {conectar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('connect.appPropia.submit')}
        </Button>
        <Button type="button" variant="outline" onClick={onCancelar}>
          {t('connect.appPropia.cancel')}
        </Button>
      </div>
    </form>
  )
}
