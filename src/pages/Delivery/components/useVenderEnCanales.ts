/**
 * D1 · casilla «Vender en: ☑ Rappi ☐ Uber Eats» al crear o editar UN producto (alta clásica, asistente y ficha).
 *
 * Sale con el permiso `delivery-channels:manage`, el plan con delivery y al menos un canal ACTIVE o PAUSED. Sin el plan no se
 * consulta nada (como `useDeliveryStatus`); si aun así la lista falla (un 403), no sale y no se avisa: la pantalla del producto
 * queda como siempre.
 *
 * `aplicar` corre DESPUÉS de guardar el producto y sólo usa lo que recibe (lo marcado en ESE envío, Codex plan r2 #7): una
 * respuesta tardía no aplica lo marcado en otra apertura del asistente. Nunca lanza; si la ruta falla, avisa por canal.
 */
import { useCallback, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAccess } from '@/hooks/use-access'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { useToast } from '@/hooks/use-toast'
import { getChannels, ponerProductoEnCanales } from '@/services/delivery.service'
import { providerLabel } from '../providerLabels'

export interface CanalVenderEn {
  id: string
  nombre: string
  /** Sin lista: el canal publica todo el catálogo. */
  todoElCatalogo: boolean
  /** Cómo está el producto en el canal al abrir (en un alta: fuera de todo canal con lista). */
  dentroInicial: boolean
}

export interface EstadoVenderEn {
  visible: boolean
  canales: CanalVenderEn[]
  marcados: Record<string, boolean>
  cambio: boolean
  setMarcado: (id: string, v: boolean) => void
  reiniciar: () => void
  /** `true` si no había nada que mandar o todo quedó; `false` si la ruta falló (ya se avisó). Nunca lanza. */
  aplicar: (productId: string, alEnviar: { marcados: Record<string, boolean>; alta: boolean }) => Promise<boolean>
}

/** `activo: false` no consulta los canales (el asistente cerrado o en edición); lo ya leído sigue sirviendo a `aplicar`. */
export function useVenderEnCanales(venueId: string, producto: { id?: string; sku?: string }, activo = true): EstadoVenderEn {
  const { can } = useAccess()
  // `!isLoading` es obligatorio: mientras el plan carga, `hasAccess` deja pasar todo (use-delivery-status.ts lo explica).
  const plan = useTierFeatureAccess('DELIVERY_CHANNELS')
  const puede = can('delivery-channels:manage') && plan.hasAccess && !plan.isLoading
  const { t } = useTranslation('delivery')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['deliveryChannels', venueId],
    queryFn: () => getChannels(venueId),
    enabled: puede && activo && !!venueId,
    retry: false,
    staleTime: 60_000,
  })

  // Sin permiso o sin plan, ni lo que otra pantalla dejó en la caché (la página de Delivery sólo mira el plan): ni se ve ni se manda.
  const canales = useMemo<CanalVenderEn[]>(
    () =>
      ((puede ? data : undefined) ?? [])
        .filter(c => c.status === 'ACTIVE' || c.status === 'PAUSED')
        .map(c => {
          const ids = c.config?.productoIds
          const codigos = c.config?.productos
          const dentroInicial =
            ids != null
              ? !!producto.id && ids.includes(producto.id)
              : codigos != null
                ? !!producto.sku && codigos.includes(producto.sku)
                : true
          return { id: c.id, nombre: providerLabel(c.provider), todoElCatalogo: ids == null && codigos == null, dentroInicial }
        }),
    [puede, data, producto.id, producto.sku],
  )

  // Sólo lo que la persona tocó; lo demás es como está el producto en el canal.
  const [elegidos, setElegidos] = useState<Record<string, boolean>>({})
  const marcados = useMemo(() => Object.fromEntries(canales.map(c => [c.id, elegidos[c.id] ?? c.dentroInicial])), [canales, elegidos])
  const cambio = canales.some(c => marcados[c.id] !== c.dentroInicial)
  const setMarcado = useCallback((id: string, v: boolean) => setElegidos(previos => ({ ...previos, [id]: v })), [])
  const reiniciar = useCallback(() => setElegidos({}), [])

  const aplicar: EstadoVenderEn['aplicar'] = async (productId, { marcados: enviados, alta }) => {
    const porId = new Map(canales.map(c => [c.id, c]))
    const enviar: Record<string, boolean> = {}
    for (const [id, dentro] of Object.entries(enviados)) {
      const c = porId.get(id)
      if (!c) continue // el canal ya no está conectado
      // En un alta, un canal con lista que quedó sin marcar también va: así cuenta como revisado y no sale en «nuevos».
      if (dentro !== c.dentroInicial || (alta && !dentro && !c.todoElCatalogo)) enviar[id] = dentro
    }
    if (Object.keys(enviar).length === 0) return true
    try {
      await ponerProductoEnCanales(venueId, productId, enviar)
      return true
    } catch {
      for (const [id, dentro] of Object.entries(enviar)) {
        const c = porId.get(id)!
        if (dentro === c.dentroInicial) continue // sólo «revisado» en un alta: el producto no estaba ni iba a estar ahí
        toast({ title: t(dentro ? 'venderEn.falloAgregar' : 'venderEn.falloQuitar', { canal: c.nombre }), variant: 'destructive' })
      }
      return false
    } finally {
      // Se espera la lectura nueva: así la casilla ya refleja el canal (y «Guardar» se apaga) cuando esto termina.
      await queryClient.invalidateQueries({ queryKey: ['deliveryChannels', venueId] })
    }
  }

  return { visible: canales.length > 0, canales, marcados, cambio, setMarcado, reiniciar, aplicar }
}
