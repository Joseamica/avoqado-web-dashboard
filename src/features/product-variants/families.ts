import { includesNormalized } from '@/lib/utils'
import type { VariantOption } from '@/types/productGroup'
import { SEPARADOR } from './combinations'

export interface ProductoConFamilia {
  id: string
  name: string
  productGroupId?: string | null
  productGroupName?: string | null
  productGroupImageUrl?: string | null
  variantOptions?: VariantOption[] | null
}

export interface Familia<P> {
  groupId: string
  name: string
  imageUrl: string | null
  variantes: P[]
}

export type Renglon<P> = { tipo: 'familia'; familia: Familia<P> } | { tipo: 'producto'; producto: P }

const ordenadas = (p: ProductoConFamilia) => (p.variantOptions ?? []).slice().sort((a, b) => a.namePosition - b.namePosition)

function compararVariantes(a: ProductoConFamilia, b: ProductoConFamilia): number {
  const pa = ordenadas(a).map(o => o.valuePosition)
  const pb = ordenadas(b).map(o => o.valuePosition)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? -1) - (pb[i] ?? -1)
    if (d !== 0) return d
  }
  return a.name.localeCompare(b.name, 'es')
}

/**
 * Junta las variantes de cada familia en un renglón, en el lugar de su primera variante. Los productos sueltos quedan donde
 * estaban: una lista sin familias sale idéntica (spec §1.6, «un negocio que no usa variantes no nota ningún cambio»).
 */
export function agruparPorFamilia<P extends ProductoConFamilia>(productos: P[]): Renglon<P>[] {
  const renglones: Renglon<P>[] = []
  const familias = new Map<string, Familia<P>>()
  for (const p of productos) {
    if (!p.productGroupId) {
      renglones.push({ tipo: 'producto', producto: p })
      continue
    }
    let f = familias.get(p.productGroupId)
    if (!f) {
      f = { groupId: p.productGroupId, name: p.productGroupName ?? p.name, imageUrl: p.productGroupImageUrl ?? null, variantes: [] }
      familias.set(p.productGroupId, f)
      renglones.push({ tipo: 'familia', familia: f })
    }
    f.variantes.push(p)
  }
  for (const f of familias.values()) f.variantes.sort(compararVariantes)
  return renglones
}

export function familiasDe<P extends ProductoConFamilia>(productos: P[]): Familia<P>[] {
  return agruparPorFamilia(productos).flatMap(r => (r.tipo === 'familia' ? [r.familia] : []))
}

/** «M · Azul»: los valores en el orden de las opciones; '' en un producto suelto. */
export const valoresDeVariante = (p: ProductoConFamilia) => ordenadas(p).map(o => o.value).join(SEPARADOR)

export const PREFIJO_FAMILIA = 'familia:'
export const valorDeFamilia = (groupId: string) => `${PREFIJO_FAMILIA}${groupId}`

/** Selector múltiple: «familia:<id>» se vuelve los ids de sus variantes; sin repetidos, en el orden en que se eligieron. */
export function expandirSeleccion(valores: string[], productos: ProductoConFamilia[]): string[] {
  const porFamilia = new Map(familiasDe(productos).map(f => [f.groupId, f.variantes.map(v => v.id)]))
  const salida: string[] = []
  const vistos = new Set<string>()
  for (const v of valores) {
    const ids = v.startsWith(PREFIJO_FAMILIA) ? (porFamilia.get(v.slice(PREFIJO_FAMILIA.length)) ?? []) : [v]
    for (const id of ids) {
      if (vistos.has(id)) continue
      vistos.add(id)
      salida.push(id)
    }
  }
  return salida
}

/** El groupId si los ids son exactamente todas las variantes de UNA familia (para mostrar «toda la familia» como elegida); si no, null. */
export function familiaDeIds(ids: string[], productos: ProductoConFamilia[]): string | null {
  if (ids.length < 2) return null
  for (const f of familiasDe(productos)) {
    const deLaFamilia = new Set(f.variantes.map(v => v.id))
    if (deLaFamilia.size === ids.length && ids.every(id => deLaFamilia.has(id))) return f.groupId
  }
  return null
}

export function variantesParaAgregar<P extends ProductoConFamilia>(f: Familia<P>, yaAgregados: string[]): P[] {
  const ya = new Set(yaAgregados)
  return f.variantes.filter(v => !ya.has(v.id))
}

/** Familias cuyo nombre coincide con lo buscado y que todavía tienen variantes por agregar (etiquetas). */
export function sugerenciasDeFamilia<P extends ProductoConFamilia>(termino: string, productos: P[], yaAgregados: string[]): Familia<P>[] {
  if (!termino.trim()) return []
  return familiasDe(productos).filter(f => includesNormalized(f.name, termino) && variantesParaAgregar(f, yaAgregados).length > 0)
}

/**
 * Campos que en una variante son del padre (contrato §6, `GROUP_OWNED_PRODUCT_FIELDS` + extras). Las pantallas que editan UN producto
 * por id los OMITEN si es variante: deshabilitarlos no basta, el formulario reenvía `''`/`null` y el server lo cuenta como cambio (409).
 */
const CAMPOS_DEL_PADRE = [
  'name',
  'description',
  'type',
  'imageUrl',
  'categoryId',
  'printStationId',
  'satProductKey',
  'satUnitKey',
  'ivaTratamiento',
  'taxRate',
  'objetoImp',
  'modifierGroupIds',
] as const

export function sinCamposDelPadre<T extends Record<string, unknown>>(body: T): T {
  const resto: Record<string, unknown> = { ...body }
  for (const campo of CAMPOS_DEL_PADRE) delete resto[campo]
  return resto as T
}
