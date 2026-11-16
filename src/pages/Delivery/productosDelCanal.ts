/** Cálculos puros de la pantalla «productos del canal» (D1). Sin React ni red. */
import type { Product } from '@/types'
import type { DeliveryChannelConfig, DeliveryProvider } from '@/types/delivery'

export type ProductoDelCanal = Pick<Product, 'id' | 'sku' | 'name' | 'price' | 'active' | 'createdAt' | 'categoryId'> & {
  category?: { name: string } | null
}

/**
 * La lista y los precios de al abrir, IGUAL que los lee el SERVIDOR (Codex impl r1 #1):
 *  · lista = `productoIds`; si no hay, la vieja por código pasada a ids de los productos recibidos.
 *  · precios = `porProducto` si existe (la `overrides` es su copia por código: un código reusado le daría el precio a otro);
 *    si no, los de `overrides` cuyo código es de un producto recibido, empiece o no con `MOD-` (un código de producto gana). Lo
 *    que no es de ningún producto recibido (extras, códigos viejos) se ignora: el SERVIDOR conserva los extras.
 */
export function seleccionAlAbrir(
  config: DeliveryChannelConfig | null | undefined,
  productos: ProductoDelCanal[],
): { lista: string[] | null; precios: Record<string, number>; codigosSinProducto: string[] } {
  const idPorCodigo = new Map(productos.map(p => [p.sku, p.id]))
  const porProducto = config?.precios?.porProducto
  const precios: Record<string, number> = { ...(porProducto ?? {}) }
  if (!porProducto) {
    for (const [codigo, precio] of Object.entries(config?.precios?.overrides ?? {})) {
      const id = idPorCodigo.get(codigo)
      if (id) precios[id] = precio
    }
  }
  if (config?.productoIds) return { lista: config.productoIds, precios, codigosSinProducto: [] }
  if (!config?.productos) return { lista: null, precios, codigosSinProducto: [] }
  const lista: string[] = []
  const sinProducto: string[] = []
  for (const codigo of config.productos) {
    const id = idPorCodigo.get(codigo)
    if (id) lista.push(id)
    else sinProducto.push(codigo)
  }
  return { lista, precios, codigosSinProducto: sinProducto }
}

export function productosNuevos(
  productos: ProductoDelCanal[],
  lista: string[] | null,
  revisados: string[],
  conectadoEn: string | null,
): ProductoDelCanal[] {
  if (lista === null || !conectadoEn) return []
  const dentro = new Set(lista)
  const vistos = new Set(revisados)
  const desde = new Date(conectadoEn).getTime()
  return productos.filter(p => !dentro.has(p.id) && !vistos.has(p.id) && new Date(p.createdAt).getTime() > desde)
}

export function idsQueYaNoExisten(lista: string[] | null, productos: ProductoDelCanal[]): string[] {
  if (!lista) return []
  const hay = new Set(productos.map(p => p.id))
  return lista.filter(id => !hay.has(id))
}

/**
 * Rappi sólo acepta pesos enteros (mitad hacia arriba; el servidor usa Decimal exacto, así que se quita el ruido de float
 * antes). Los demás, 2 decimales con la misma cuenta que uber.menuMapper (Math.round(x * 100) / 100).
 */
export function precioQueSePublica(provider: DeliveryProvider, pesos: number): number {
  return provider === 'RAPPI' ? Math.floor(Number(pesos.toFixed(6)) + 0.5) : Math.round(pesos * 100) / 100
}

export function precioGuia(provider: DeliveryProvider, precioMostrador: number, markupPercent = 0): number {
  return precioQueSePublica(provider, precioMostrador * (1 + markupPercent / 100))
}

export function erroresDePrecios(precios: Record<string, number | undefined>): string[] {
  return Object.entries(precios)
    .filter(([, v]) => v !== undefined && (!Number.isFinite(v) || v < 0))
    .map(([id]) => id)
}
