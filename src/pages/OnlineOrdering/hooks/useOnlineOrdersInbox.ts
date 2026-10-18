import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useSocket } from '@/context/SocketContext'
import { getInbox, onlineOrderingKeys } from '@/services/onlineOrdering.service'

/**
 * El ÚNICO sondeo de la bandeja (cada 10 s, se detiene con la pestaña oculta) más el aviso en vivo del servidor.
 * 🔴 La cabecera de latido (`tray`) se decide EN CADA petición: también la que dispara un evento de socket con la pestaña
 * oculta debe salir sin ella, o una bandeja que nadie mira mantendría abierta la tienda (R13).
 */
export function useOnlineOrdersInbox(venueId: string, opts: { trayActive: () => boolean }) {
  const queryClient = useQueryClient()
  const { socket, joinVenueRoom, leaveVenueRoom } = useSocket()

  const query = useQuery({
    queryKey: onlineOrderingKeys.inbox(venueId),
    queryFn: () => getInbox(venueId, { tray: document.visibilityState === 'visible' && opts.trayActive() }),
    enabled: !!venueId,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    retry: 1,
  })

  useEffect(() => {
    if (!venueId || !socket) return
    joinVenueRoom(venueId)
    const refresh = () => queryClient.invalidateQueries({ queryKey: onlineOrderingKeys.inbox(venueId) })
    const onCreated = (e: { source?: string } | undefined) => {
      if (e?.source === 'WEB') refresh()
    }
    // `order_updated` también lo emiten las cuentas del POS: sólo el de un pedido en línea trae `onlineStatus`.
    const onUpdated = (e: { onlineStatus?: string } | undefined) => {
      if (e?.onlineStatus) refresh()
    }
    socket.on('order_created', onCreated)
    socket.on('order_updated', onUpdated)
    return () => {
      socket.off('order_created', onCreated)
      socket.off('order_updated', onUpdated)
      leaveVenueRoom(venueId)
    }
  }, [venueId, socket, joinVenueRoom, leaveVenueRoom, queryClient])

  return query
}
