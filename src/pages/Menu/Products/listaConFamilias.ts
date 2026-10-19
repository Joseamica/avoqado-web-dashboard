import { agruparPorFamilia, valorDeFamilia, type Familia } from '@/features/product-variants/families'
import type { Product } from '@/types'

export type FilaProducto = Product & { __familia?: Familia<Product> }

export const rangoDePrecio = (f: Familia<Product>) => {
  const precios = f.variantes.map(v => Number(v.price))
  return { min: Math.min(...precios), max: Math.max(...precios) }
}

/** La lista de Productos con cada familia en UNA fila. Sin familias devuelve la misma lista, objeto por objeto (spec §1.6). */
export function filasConFamilias(productos: Product[]): FilaProducto[] {
  if (!productos.some(p => p.productGroupId)) return productos
  return agruparPorFamilia(productos).map(r => {
    if (r.tipo === 'producto') return r.producto
    const f = r.familia
    const primera = f.variantes[0]
    return { ...primera, id: valorDeFamilia(f.groupId), name: f.name, imageUrl: f.imageUrl ?? primera.imageUrl, price: rangoDePrecio(f).min, __familia: f }
  })
}
