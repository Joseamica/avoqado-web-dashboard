import { useQuery } from '@tanstack/react-query'

import { useAccess } from '@/hooks/use-access'
import { getOnlineOrder, onlineOrderingKeys } from '@/services/onlineOrdering.service'

/**
 * El pedido en línea de una cuenta, para su detalle (la bandeja sólo guarda 24 h). Sólo una cuenta de origen en línea (`WEB`, o sin el
 * dato) y con `orders:read` (lo que pide la ruta); `aplica` dice si se lee. Su 404 llega como `null`: no es pedido en línea. Una sola
 * lectura aunque la pidan el detalle y «Devolver» (misma llave).
 */
export function usePedidoEnLinea(venueId: string, orderId: string, source: string | null | undefined, cuentaLista = true) {
  const { can } = useAccess()
  const aplica = cuentaLista && !!venueId && can('orders:read') && (!source || source === 'WEB')
  const lectura = useQuery({
    queryKey: onlineOrderingKeys.order(venueId, orderId),
    queryFn: () => getOnlineOrder(venueId, orderId),
    enabled: aplica,
  })
  return { aplica, lectura }
}
