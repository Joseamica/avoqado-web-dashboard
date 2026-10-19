import { agruparPorFamilia, valorDeFamilia, type Familia } from '@/features/product-variants/families'
import type { VariantOption } from '@/types/productGroup'
import type { StockOverviewRow } from './types/stock-overview'

/** Una fila de existencias; la de una familia trae `__familia` con sus variantes (las filas originales, sin copiar). */
export type FilaConFamilia<R> = R & { __familia?: Familia<R> }

type FilaBase = { id: string; name: string; variantOptions?: VariantOption[] | null }

/**
 * Existencias con cada familia en UNA fila (spec §9, P8): sus números los pone `sumar`, va en el lugar de su primera variante y
 * sus variantes quedan en el orden de sus opciones (S, M, L). `familiaDe` dice de qué familia es cada fila (null = suelta, como un
 * ingrediente). 🔴 Sin familias devuelve LA MISMA lista: un negocio sin variantes ve exactamente las filas de hoy.
 */
export function filasDeExistencias<R extends FilaBase>(
  filas: R[],
  familiaDe: (r: R) => { id: string; name: string } | null,
  sumar: (rs: R[]) => Partial<R>,
): FilaConFamilia<R>[] {
  const conFamilia = filas.map(fila => ({ fila, familia: familiaDe(fila) }))
  if (!conFamilia.some(c => c.familia)) return filas as FilaConFamilia<R>[]
  // agruparPorFamilia (Tarea 3) ya sabe el lugar y el orden; se le da la familia que dijo `familiaDe` y se recupera la fila original.
  const renglones = agruparPorFamilia(
    conFamilia.map(({ fila, familia }) => ({
      id: fila.id,
      name: fila.name,
      variantOptions: fila.variantOptions,
      productGroupId: familia?.id ?? null,
      productGroupName: familia?.name ?? null,
      fila,
    })),
  )
  return renglones.map(r => {
    if (r.tipo === 'producto') return r.producto.fila
    const variantes = r.familia.variantes.map(v => v.fila)
    const familia: Familia<R> = { ...r.familia, variantes }
    return { ...variantes[0], ...sumar(variantes), id: valorDeFamilia(familia.groupId), name: familia.name, __familia: familia }
  })
}

/** La familia de un producto según GET /products (null = producto suelto o ingrediente). */
export const familiaDeProducto = (r: { name: string; productGroupId?: string | null; productGroupName?: string | null }) =>
  r.productGroupId ? { id: r.productGroupId, name: r.productGroupName ?? r.name } : null

/** Suma un dato de las variantes, redondeada a milésimas (hay existencias por peso); null si ninguna lo tiene. */
export function sumaDe<R>(rs: R[], dato: (r: R) => number | null | undefined): number | null {
  const valores = rs.map(dato).filter((n): n is number => n != null)
  return valores.length ? Math.round(valores.reduce((a, b) => a + b, 0) * 1000) / 1000 : null
}

/** La fila de una familia en el Resumen de existencias: suma de existencias, mínimo y confirmado; SKU y precio son de cada variante. */
export const sumarExistencias = (rs: StockOverviewRow[]): Partial<StockOverviewRow> => ({
  stock: sumaDe(rs, r => r.stock) ?? 0,
  minStock: sumaDe(rs, r => r.minStock),
  confirmedStock: sumaDe(rs, r => r.confirmedStock),
  sku: null,
  price: null,
  cost: null,
})
