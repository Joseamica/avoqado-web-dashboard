import { useEffect } from 'react'

import { useFiscalConfig } from '@/hooks/use-cfdi'
import type { FiscalConfig } from '@/services/cfdi.service'

export type FaltaParaFacturar = 'emisor' | 'csd' | 'comercio'

/**
 * Qué le falta al negocio para poder facturar ALGUNA venta, o `null` si ya puede. La misma regla que el SERVIDOR
 * (`loadOrderForCfdiFromDb` + `validateBeforeStamp`): con terminal o sin ella, una venta necesita un emisor con CSD activo y un comercio
 * de ESE emisor con la facturación encendida.
 *
 * 🔴 Basta una pareja lista: con varios emisores o comercios, sólo el servidor sabe si ESTA venta se puede facturar.
 */
export function queFaltaParaFacturar({ emisores, merchantConfigs }: FiscalConfig): FaltaParaFacturar | null {
  if (emisores.length === 0) return 'emisor'
  const conCsd = emisores.filter(emisor => emisor.csdStatus === 'ACTIVE')
  if (conCsd.length === 0) return 'csd'
  const listo = conCsd.some(emisor => merchantConfigs.some(c => c.fiscalEmisorId === emisor.id && c.facturacionEnabled))
  return listo ? null : 'comercio'
}

/**
 * `null` también mientras carga o si la lectura falla: aquí no se bloquea sin saber, el candado de verdad es el servidor.
 * Al abrir se vuelve a leer: otra persona pudo dejarlo listo en otra pestaña después de la última lectura.
 */
export function useFaltaParaFacturar({ enabled, abierto }: { enabled: boolean; abierto: boolean }): FaltaParaFacturar | null {
  const { data, isError, refetch } = useFiscalConfig({ enabled })
  useEffect(() => {
    if (abierto) void refetch({ cancelRefetch: false })
  }, [abierto, refetch])
  return isError || !data ? null : queFaltaParaFacturar(data)
}
