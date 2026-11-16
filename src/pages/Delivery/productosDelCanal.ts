/** Cálculos puros de la pantalla «productos del canal» (D1). Sin React ni red. */
import type { Product } from '@/types'
import type { DeliveryChannelConfig, DeliveryProvider } from '@/types/delivery'

export type ProductoDelCanal = Pick<Product, 'id' | 'sku' | 'name' | 'price' | 'active' | 'createdAt' | 'categoryId'> & {
  category?: { name: string } | null
}

const esMod = (k: string) => k.startsWith('MOD-')

export function seleccionAlAbrir(
  config: DeliveryChannelConfig | null | undefined,
  productos: ProductoDelCanal[],
): { lista: string[] | null; precios: Record<string, number>; codigosSinProducto: string[] } {
  const precios = config?.precios
  if (config?.productoIds) {
    return { lista: config.productoIds, precios: { ...(precios?.porProducto ?? {}) }, codigosSinProducto: [] }
  }
  const idPorCodigo = new Map(productos.map(p => [p.sku, p.id]))
  const out: Record<string, number> = {}
  const sinProducto: string[] = []
  for (const [codigo, precio] of Object.entries(precios?.overrides ?? {})) {
    if (esMod(codigo)) continue
    const id = idPorCodigo.get(codigo)
    if (id) out[id] = precio
  }
  if (!config?.productos) return { lista: null, precios: { ...(precios?.porProducto ?? {}), ...out }, codigosSinProducto: [] }
  const lista: string[] = []
  for (const codigo of config.productos) {
    const id = idPorCodigo.get(codigo)
    if (id) lista.push(id)
    else sinProducto.push(codigo)
  }
  return { lista, precios: out, codigosSinProducto: sinProducto }
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

/** Rappi sólo acepta pesos enteros (mitad hacia arriba); los demás, 2 decimales. */
export function precioQueSePublica(provider: DeliveryProvider, pesos: number): number {
  return provider === 'RAPPI' ? Math.floor(pesos + 0.5) : Math.round(pesos * 100) / 100
}

export function precioGuia(provider: DeliveryProvider, precioMostrador: number, markupPercent = 0): number {
  return precioQueSePublica(provider, precioMostrador * (1 + markupPercent / 100))
}

export function erroresDePrecios(precios: Record<string, number | undefined>): string[] {
  return Object.entries(precios)
    .filter(([, v]) => v !== undefined && (!Number.isFinite(v) || v < 0))
    .map(([id]) => id)
}
