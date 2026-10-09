/** Piezas sin JSX de la pantalla de Shopify: la navegación inyectable, el manejo de un error del servidor y la unión de páginas. */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/hooks/use-toast'
import { useInvalidateShopify } from '@/hooks/use-shopify'
import { explicarErrorShopify, textoDeErrorShopify, type ShopifyErrorAccion } from '@/services/shopify.service'

/** jsdom no deja redefinir `window.location` (índice v2 §6, Codex #36): la ida a Shopify entra por aquí y la prueba la inyecta. */
export type Navegar = (url: string) => void
export const navegarDeVerdad: Navegar = url => window.location.assign(url)

/** Dominio de una tienda Shopify (`algo.myshopify.com`). El servidor lo vuelve a validar; esto evita mandar lo evidentemente mal. */
const DOMINIO_SHOPIFY = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i
export const dominioValido = (s: string): boolean => DOMINIO_SHOPIFY.test(s.trim())

/** Tras estas acciones lo que el dueño ve ya no es lo vigente (V3, L9): se invalida y se vuelve a leer, nunca se reintenta a ciegas. */
const VUELVE_A_LEER: ReadonlySet<ShopifyErrorAccion> = new Set(['CONECTAR', 'RELEER', 'REAUTORIZAR'])

/**
 * Qué se hace con el error de una acción del conector: se dice con su texto del mapa de C7 (`textoDeErrorShopify`, nunca la
 * jerga de axios) y, si lo que se veía quedó viejo, se vuelve a leer todo lo de la sucursal. Devuelve la acción para que
 * quien llamó decida lo suyo (p. ej. el asistente de conexión ofrece «Volver a empezar»). El resumen se invalida también con
 * `planRequired`, `SIN_PLAN`, `NO_ACTIVA`, `YA_CONECTADA`, `EN_PAUSA` y `FALTA_PERMISO`: todas son RELEER o REAUTORIZAR.
 */
export function useShopifyFallo(venueId: string | undefined) {
  const { t } = useTranslation('shopify')
  const { toast } = useToast()
  const invalidate = useInvalidateShopify()
  return useCallback(
    (e: unknown): ShopifyErrorAccion | null => {
      toast({ variant: 'destructive', title: textoDeErrorShopify(t, e) })
      const { accion } = explicarErrorShopify(e)
      if (accion && VUELVE_A_LEER.has(accion)) void invalidate(venueId)
      return accion
    },
    [t, toast, invalidate, venueId],
  )
}

/** Une las páginas de «Cargar más» sin repetir: una fila puede cambiar de página entre una petición y otra. */
export function dedupe<X>(xs: X[], key: (x: X) => string): X[] {
  return [...new Map(xs.map(x => [key(x), x])).values()]
}
