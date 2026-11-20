import { useEffect, useRef } from 'react'
import type { QueryClient, QueryKey } from '@tanstack/react-query'

import { useSocket } from '@/context/SocketContext'

/** Lo que trae una lectura del estado de la tienda para saber cuándo volver a leer (D662 v4). */
export interface MarcasDeLectura {
  /** Cuándo leyó el SERVIDOR el estado (su reloj, tomado ANTES de leer). */
  storeReadAt?: string | null
  /** Cuándo se guardaron los ajustes que leyó (Reanudar, pausar y ajustes la mueven). */
  storeVersion?: string | null
  /** La hora límite más cercana de un pedido por aceptar (reloj del SERVIDOR). */
  storeNextDeadlineAt?: string | null
  /** Cuándo SALIÓ la petición (reloj del navegador). */
  enviadoEn?: number
}

/** Margen tras la hora límite: con la espera del SERVIDOR, la lectura de ese momento ya trae el veredicto definitivo. */
export const MARGEN_TRAS_LA_HORA_LIMITE_MS = 300
const ESPERA_MINIMA_MS = 250

/**
 * Cuánto esperar (reloj del navegador) para volver a leer justo después de la próxima hora límite. No depende de que el reloj del
 * navegador coincida con el del SERVIDOR: cuenta desde que salió la petición, que fue antes de `storeReadAt`, así que dispara un poco
 * ANTES si acaso; esa lectura temprana trae la misma hora límite y se vuelve a programar. `null` si no hay qué esperar.
 */
export function esperaHastaLaHoraLimite(m: MarcasDeLectura, ahora: number = Date.now()): number | null {
  if (!m.storeNextDeadlineAt || !m.storeReadAt || m.enviadoEn === undefined) return null
  const falta = Date.parse(m.storeNextDeadlineAt) - Date.parse(m.storeReadAt) - (ahora - m.enviadoEn)
  if (!Number.isFinite(falta)) return null
  return Math.max(ESPERA_MINIMA_MS, falta + MARGEN_TRAS_LA_HORA_LIMITE_MS)
}

/**
 * De dos lecturas, la más nueva (Codex p2v4-r2 #5): primero la que leyó unos ajustes guardados más tarde (`storeVersion`: un «Reanudar» o
 * una pausa ya guardados), y con los mismos ajustes la que el SERVIDOR leyó más tarde (`storeReadAt`: la pausa sola sólo puede aparecer con
 * el tiempo). Sin marcas (SERVIDOR viejo), la segunda.
 */
export function laMasNueva<T extends { storeReadAt?: string | null; storeVersion?: string | null }>(
  a: T | undefined,
  b: T | undefined,
): T | undefined {
  if (!a) return b
  if (!b) return a
  const va = a.storeVersion ? Date.parse(a.storeVersion) : null
  const vb = b.storeVersion ? Date.parse(b.storeVersion) : null
  if (va !== null && vb !== null && va !== vb) return vb > va ? b : a
  if (a.storeReadAt && b.storeReadAt) return Date.parse(b.storeReadAt) > Date.parse(a.storeReadAt) ? b : a
  return b
}

/**
 * D662 v5 (Codex p2v4-r5 #3): una lectura NUEVA de verdad. `invalidateQueries` a secas reutiliza la petición que ya va en camino cuando la
 * consulta todavía no tiene datos (TanStack Query, `query.fetch`), y esa petición salió ANTES del cambio que avisa el socket. Se cancela
 * la que va en camino (su respuesta se descarta) y se pide otra.
 */
export function releerSinReusar(qc: QueryClient, queryKey: QueryKey): Promise<void> {
  return qc.cancelQueries({ queryKey }).then(() => qc.invalidateQueries({ queryKey }))
}

/**
 * D662 v4 (hueco 5): el estado de la tienda se vuelve a leer en cuanto puede cambiar, sin esperar el sondeo de 30 s:
 * - el aviso del SERVIDOR (`online_ordering_store_changed`: Reanudar, pausar, ajustes, se pausó sola) y cualquier cambio de un pedido en
 *   línea (`order_updated` con `onlineStatus`: una cancelación tardía también puede pausarla; Codex p2v4-r2 #3) o un pedido nuevo
 *   (`order_created` de la tienda: su hora límite puede ser la próxima), en el cuarto de ESTE
 *   negocio (el socket entra al cuarto aunque la sesión sea de otra sucursal; Codex p2v4-r2 #4);
 * - al reconectarse el socket (un aviso pudo perderse mientras estaba caído) y, sobre todo, cuando el SERVIDOR CONFIRMA la suscripción a
 *   esta sucursal (al entrar y en cada reconexión; Codex p2v5-r1 #8): una lectura que salió antes de la confirmación pudo perder el aviso;
 *   la que sale después ya no;
 * - al volver a la pestaña (el navegador frena los temporizadores de una pestaña oculta);
 * - justo después de la próxima hora límite de un pedido por aceptar (ahí se puede pausar sola).
 */
export function useRelecturaDeLaTienda(
  venueId: string | undefined,
  marcas: MarcasDeLectura | undefined,
  releer: () => void,
  /** La Bandeja ya relee con cada cambio de pedido (su propio oyente): no hace falta otra relectura. */
  opts: { conPedidos?: boolean } = {},
) {
  const conPedidos = opts.conPedidos !== false
  const { socket, joinVenueRoom, leaveVenueRoom, alConfirmarSucursal } = useSocket()
  const releerRef = useRef(releer)
  releerRef.current = releer

  useEffect(() => {
    if (!venueId || !socket) return
    const onCambio = (e: { venueId?: string } | undefined) => {
      if (!e?.venueId || e.venueId === venueId) releerRef.current()
    }
    const onPedido = (e: { onlineStatus?: string; venueId?: string } | undefined) => {
      if (e?.onlineStatus && (!e.venueId || e.venueId === venueId)) releerRef.current()
    }
    const onConectado = () => releerRef.current()
    const dejarDeEsperar = alConfirmarSucursal(venueId, () => releerRef.current())
    joinVenueRoom(venueId)
    socket.on('online_ordering_store_changed', onCambio)
    // Un pedido NUEVO trae una hora límite que puede ser la próxima (sin pedidos por aceptar no había relectura programada).
    const onNuevo = (e: { source?: string; venueId?: string } | undefined) => {
      if (e?.source === 'WEB' && (!e.venueId || e.venueId === venueId)) releerRef.current()
    }
    if (conPedidos) {
      socket.on('order_updated', onPedido)
      socket.on('order_created', onNuevo)
    }
    socket.on('connect', onConectado)
    return () => {
      socket.off('online_ordering_store_changed', onCambio)
      if (conPedidos) {
        socket.off('order_updated', onPedido)
        socket.off('order_created', onNuevo)
      }
      socket.off('connect', onConectado)
      dejarDeEsperar()
      leaveVenueRoom(venueId)
    }
  }, [venueId, socket, joinVenueRoom, leaveVenueRoom, alConfirmarSucursal, conPedidos])

  useEffect(() => {
    if (!venueId) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') releerRef.current()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [venueId])

  const espera = marcas ? esperaHastaLaHoraLimite(marcas) : null
  const clave = `${marcas?.storeNextDeadlineAt ?? ''}|${marcas?.storeReadAt ?? ''}`
  useEffect(() => {
    if (!venueId || espera === null) return
    const t = setTimeout(() => releerRef.current(), espera)
    return () => clearTimeout(t)
    // `clave` cambia con cada lectura nueva: se reprograma con su hora límite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId, clave])
}
