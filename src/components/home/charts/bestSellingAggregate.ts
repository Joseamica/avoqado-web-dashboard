/**
 * «Más vendidos» del inicio: junta las ventas de la gráfica. Puro: sin React.
 *
 * Los sueltos se unen por nombre (como siempre). Las variantes de una familia se unen por `productGroupId` y llevan el
 * nombre de la familia; unir por nombre mezclaría una familia con un producto suelto que se llame igual.
 */
import type { BestSellingProduct } from '@/services/dashboard.progressive.service'

export type ModoMasVendidos = 'plano' | 'porTipo'
export type BarraMasVendida = BestSellingProduct
type Tipo = 'FOOD' | 'BEVERAGE' | 'OTHER'

const llave = (p: BestSellingProduct) => (p.productGroupId ? `familia:${p.productGroupId}` : `suelto:${p.name}`)
const etiqueta = (p: BestSellingProduct) => (p.productGroupId ? p.productGroupName || p.name : p.name)

export function agregarMasVendidos(products: BestSellingProduct[] | undefined | null, modo: 'plano'): Array<{ name: string; quantity: number }>
export function agregarMasVendidos(products: BestSellingProduct[] | undefined | null, modo: 'porTipo'): Record<Tipo, BarraMasVendida[]>
export function agregarMasVendidos(products: BestSellingProduct[] | undefined | null, modo: ModoMasVendidos) {
  const lista = products || []

  if (modo === 'plano') {
    // Lista plana (retail): sin tipo, las 10 más vendidas.
    const unidos = new Map<string, { name: string; quantity: number }>()
    lista.forEach(product => {
      const k = llave(product)
      const existing = unidos.get(k)
      if (existing) existing.quantity = Number(existing.quantity) + Number(product.quantity)
      else unidos.set(k, { name: etiqueta(product), quantity: Number(product.quantity) })
    })
    return [...unidos.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10)
  }

  // Por tipo (comida / bebida / otros): las 3 más vendidas de cada uno.
  const categories: Record<Tipo, BarraMasVendida[]> = { FOOD: [], BEVERAGE: [], OTHER: [] }
  lista.forEach(product => {
    const productType = product.type || 'OTHER'
    const conocido = productType in categories
    const bucket = categories[conocido ? (productType as Tipo) : 'OTHER']
    // Un tipo desconocido cae en OTHER SIN unirse por nombre (así era); una familia sí se une siempre.
    const existing = conocido || product.productGroupId ? bucket.find(p => llave(p) === llave(product)) : undefined
    if (existing) existing.quantity = Number(existing.quantity) + Number(product.quantity)
    else bucket.push({ ...product, name: etiqueta(product) })
  })
  ;(Object.keys(categories) as Tipo[]).forEach(type => {
    categories[type].sort((a, b) => Number(b.quantity) - Number(a.quantity))
    categories[type] = categories[type].slice(0, 3)
  })
  return categories
}
