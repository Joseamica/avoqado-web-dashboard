/**
 * D1 · casilla «Vender en: ☑ Rappi ☐ Uber Eats» al crear o editar UN producto (alta clásica, asistente y ficha).
 *
 * Sale con el permiso `delivery-channels:manage`, el plan con delivery y al menos un canal ACTIVE o PAUSED. Sin el plan no se
 * consulta nada (como `useDeliveryStatus`); si aun así la lista falla (un 403), no sale y no se avisa: la pantalla del producto
 * queda como siempre.
 *
 * `aplicar` corre DESPUÉS de guardar el producto y sólo usa lo que recibe (lo marcado en ESE envío, Codex plan r2 #7): una
 * respuesta tardía no aplica lo marcado en otra apertura del asistente. Y compara contra cómo estaba cada canal AL ENVIAR (`base`,
 * Codex impl r1 #3): contra la lectura viva, un refresco a media guardada mandaba un canal que nadie tocó y borraba lo de otra
 * persona. Nunca lanza; si la ruta falla, avisa por canal.
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

/** Lo que viaja con un guardado: lo marcado y cómo estaba cada canal en ese momento (copias). */
export interface EnvioVenderEn {
  marcados: Record<string, boolean>
  base: Record<string, boolean>
}

export interface EstadoVenderEn {
  visible: boolean
  canales: CanalVenderEn[]
  marcados: Record<string, boolean>
  cambio: boolean
  setMarcado: (id: string, v: boolean) => void
  reiniciar: () => void
  /** Lo que se pone en las variables del guardado, al enviarlo. */
  envio: () => EnvioVenderEn
  /**
   * `true` si no había nada que mandar o todo quedó; `false` si la ruta falló (ya se avisó). Nunca lanza. `soloCanales`: el guardado
   * no tocó el producto, así que el aviso no dice «El producto se guardó».
   */
  aplicar: (productId: string, alEnviar: EnvioVenderEn & { alta: boolean; soloCanales?: boolean }) => Promise<boolean>
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
  const canales = useMemo<CanalVenderEn[]>(() => {
    const visibles = ((puede ? data : undefined) ?? []).filter(c => c.status === 'ACTIVE' || c.status === 'PAUSED')
    // Dos tiendas del mismo proveedor (dos Rappi) se distinguen por su tienda; un proveedor solo se queda con su nombre.
    const etiquetas = visibles.map(c => providerLabel(c.provider))
    const repetida = (e: string) => etiquetas.indexOf(e) !== etiquetas.lastIndexOf(e)
    return visibles.map(c => {
      const ids = c.config?.productoIds
      const codigos = c.config?.productos
      const dentroInicial =
        ids != null ? !!producto.id && ids.includes(producto.id) : codigos != null ? !!producto.sku && codigos.includes(producto.sku) : true
      const etiqueta = providerLabel(c.provider)
      const nombre = repetida(etiqueta) ? `${etiqueta} · ${c.externalLocationId}` : etiqueta
      return { id: c.id, nombre, todoElCatalogo: ids == null && codigos == null, dentroInicial }
    })
  }, [puede, data, producto.id, producto.sku])

  // Sólo lo que la persona tocó; lo demás es como está el producto en el canal.
  const [elegidos, setElegidos] = useState<Record<string, boolean>>({})
  const marcados = useMemo(() => Object.fromEntries(canales.map(c => [c.id, elegidos[c.id] ?? c.dentroInicial])), [canales, elegidos])
  const cambio = canales.some(c => marcados[c.id] !== c.dentroInicial)
  const setMarcado = useCallback((id: string, v: boolean) => setElegidos(previos => ({ ...previos, [id]: v })), [])
  const reiniciar = useCallback(() => setElegidos({}), [])
  const envio = () => ({ marcados: { ...marcados }, base: Object.fromEntries(canales.map(c => [c.id, c.dentroInicial])) })

  const aplicar: EstadoVenderEn['aplicar'] = async (productId, { marcados: enviados, base, alta, soloCanales }) => {
    const porId = new Map(canales.map(c => [c.id, c]))
    const enviar: Record<string, boolean> = {}
    for (const [id, dentro] of Object.entries(enviados)) {
      const c = porId.get(id)
      if (!c) continue // el canal ya no está conectado
      // En un alta, un canal con lista que quedó sin marcar también va: así cuenta como revisado y no sale en «nuevos».
      if (dentro !== base[id] || (alta && !dentro && !c.todoElCatalogo)) enviar[id] = dentro
    }
    if (Object.keys(enviar).length === 0) return true
    try {
      await ponerProductoEnCanales(venueId, productId, enviar)
      return true
    } catch (error) {
      const motivo = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      for (const [id, dentro] of Object.entries(enviar)) {
        if (dentro === base[id]) continue // sólo «revisado» en un alta: el producto no estaba ni iba a estar ahí
        const llave = soloCanales
          ? dentro
            ? 'venderEn.noSePudoAgregar'
            : 'venderEn.noSePudoQuitar'
          : dentro
            ? 'venderEn.falloAgregar'
            : 'venderEn.falloQuitar'
        toast({
          title: t(llave, { canal: porId.get(id)!.nombre }),
          ...(motivo ? { description: motivo } : {}),
          variant: 'destructive',
        })
      }
      return false
    } finally {
      // Se espera la lectura nueva: así la casilla ya refleja el canal (y «Guardar» se apaga) cuando esto termina.
      await queryClient.invalidateQueries({ queryKey: ['deliveryChannels', venueId] })
    }
  }

  return { visible: canales.length > 0, canales, marcados, cambio, setMarcado, reiniciar, envio, aplicar }
}
