import type { AddVariantsBody, IvaElegible, ProductGroupDetail, ProductGroupVariant, UpdateGroupBody } from '@/types/productGroup'
import {
  MAX_CODIGO, MAX_VARIANTES, contarCombinaciones, esDineroValido, esSkuValido, filaParaServidor, generarCombinaciones, limpiarOpciones,
  llaveDeCombinacion, norm, validarOpciones, type FilaVariante, type OpcionEditable, type ProblemaDeOpciones,
} from './combinations'

export interface EstadoPadre {
  name: string
  description: string
  categoryId: string
  imageUrl: string | null
  modifierGroupIds: string[]
  printStationId: string | null
  satProductKey: string
  satUnitKey: string
  /** undefined = sin tocar (el selector muestra el IVA vigente). */
  ivaTratamiento?: IvaElegible
}

export const estadoDelPadre = (f: ProductGroupDetail): EstadoPadre => ({
  name: f.name,
  description: f.description ?? '',
  categoryId: f.categoryId,
  imageUrl: f.imageUrl,
  modifierGroupIds: f.modifierGroupIds,
  printStationId: f.printStationId,
  satProductKey: f.satProductKey ?? '',
  satUnitKey: f.satUnitKey ?? '',
})

const mismoConjunto = (a: string[], b: string[]) => a.length === b.length && a.every(x => b.includes(x))

/** El PATCH del padre con SOLO lo que cambió (el server copia cada campo a las variantes: mandar de más sería trabajo inútil). */
export function cambiosDelPadre(f: ProductGroupDetail, e: EstadoPadre, conSat: boolean): UpdateGroupBody {
  const b: UpdateGroupBody = {}
  if (e.name.trim() !== f.name) b.name = e.name.trim()
  const descripcion = e.description.trim() || null
  if (descripcion !== f.description) b.description = descripcion
  if (e.categoryId !== f.categoryId) b.categoryId = e.categoryId
  if (e.imageUrl !== f.imageUrl) b.imageUrl = e.imageUrl
  if (e.printStationId !== f.printStationId) b.printStationId = e.printStationId
  if (!mismoConjunto(e.modifierGroupIds, f.modifierGroupIds)) b.modifierGroupIds = e.modifierGroupIds
  if (conSat) {
    const sp = e.satProductKey.trim() || null
    const su = e.satUnitKey.trim() || null
    if (sp !== f.satProductKey) b.satProductKey = sp
    if (su !== f.satUnitKey) b.satUnitKey = su
  }
  if (e.ivaTratamiento && e.ivaTratamiento !== f.ivaTratamiento) b.ivaTratamiento = e.ivaTratamiento
  return b
}

export interface EdicionVariante {
  price?: number
  cost?: number
  sku: string
  gtin: string
  active: boolean
}

export const edicionDe = (v: ProductGroupVariant): EdicionVariante => ({
  price: v.price,
  cost: v.cost ?? undefined,
  sku: v.sku,
  gtin: v.gtin ?? '',
  active: v.active,
})

export type ProblemaDeEdicion = 'sinPrecio' | 'precioInvalido' | 'costoInvalido' | 'skuVacio' | 'skuInvalido' | 'codigoLargo'

/**
 * Lo que cambió de una variante para `PUT /products/:id` (campos de la variante; nunca los del padre).
 * Con `campos` (lo que el dueño tocó) sólo se validan y se mandan ésos: un dato heredado que nadie tocó (precio 0) no estorba, y un campo
 * que otra persona cambió en el server nunca se devuelve a su valor viejo.
 */
export function cambiosDeVariante(
  v: ProductGroupVariant,
  e: EdicionVariante,
  campos?: ReadonlySet<keyof EdicionVariante>,
): { ok: true; cambios: Record<string, unknown> } | { ok: false; problema: ProblemaDeEdicion } {
  const toca = (k: keyof EdicionVariante) => !campos || campos.has(k)
  const cambios: Record<string, unknown> = {}
  if (toca('price')) {
    if (e.price === undefined) return { ok: false, problema: 'sinPrecio' }
    if (!esDineroValido(e.price)) return { ok: false, problema: 'precioInvalido' }
    if (e.price !== v.price) cambios.price = e.price
  }
  if (toca('cost')) {
    if (e.cost !== undefined && !esDineroValido(e.cost)) return { ok: false, problema: 'costoInvalido' }
    if ((e.cost ?? null) !== v.cost) cambios.cost = e.cost ?? null
  }
  if (toca('sku')) {
    const sku = e.sku.trim()
    if (!sku) return { ok: false, problema: 'skuVacio' }
    if (!esSkuValido(sku)) return { ok: false, problema: 'skuInvalido' }
    if (sku !== v.sku) cambios.sku = sku
  }
  if (toca('gtin')) {
    const gtin = e.gtin.trim()
    if (gtin.length > MAX_CODIGO) return { ok: false, problema: 'codigoLargo' }
    if ((gtin || null) !== v.gtin) cambios.gtin = gtin || null
  }
  if (toca('active') && e.active !== v.active) cambios.active = e.active
  return { ok: true, cambios }
}

export interface Crecimiento {
  /** Por nombre de opción existente, los valores NUEVOS que el dueño escribió. */
  nuevosValores: Record<string, string[]>
  nuevaOpcion?: { name: string; values: string[]; paraExistentes: string }
}

export type ProblemaDeCrecimiento =
  | ProblemaDeOpciones
  | { code: 'valorParaExistentes' }
  | { code: 'sinCambios' }
  /** Las nuevas pasan de 250: ni se generan (freno contra una pestaña congelada). `caben` es cuántas entran todavía junto a las vivas. */
  | { code: 'noCaben'; count: number; vivas: number; caben: number }

export interface PlanDeCrecimiento {
  opciones: OpcionEditable[]
  /** Las combinaciones con algún valor nuevo (marcadas) y, si se pidieron y caben, las viejas que faltan (desmarcadas, al final). */
  filas: FilaVariante[]
  problema: ProblemaDeCrecimiento | null
  /** Combinaciones de puros valores viejos que nunca se crearon (o están archivadas): se CUENTAN, no se generan. */
  faltantes: number
  /** Si caben en la tabla junto con las nuevas (nuevas + faltantes ≤ 250). */
  faltantesCaben: boolean
  /**
   * Cuántas variantes nuevas caben todavía (250 − vivas: el server cuenta vivas + nuevas, contrato §1; QA MEDIO-1). Se compara contra
   * las filas MARCADAS: con 240 vivas y 12 generadas, el dueño puede marcar 10.
   */
  caben: number
}

/**
 * Sólo las combinaciones con algún valor nuevo, en el orden de las opciones. Nunca recorre las de puros valores viejos (en una familia
 * «rala» de 5×50 con 30 vivas son 220): cada rama que visita termina en al menos una combinación con valor nuevo.
 */
function combinacionesConNuevo(opciones: OpcionEditable[], esNuevo: (valor: string, i: number) => boolean): string[][] {
  const quedaNuevo = opciones.map((_, i) => opciones.slice(i).some((o, k) => o.values.some(v => esNuevo(v, i + k))))
  const r: string[][] = []
  const ir = (i: number, prefijo: string[], conNuevo: boolean): void => {
    if (i === opciones.length) {
      r.push(prefijo)
      return
    }
    // Sin valor nuevo todavía y ninguno después: ésta tiene que poner uno nuevo.
    const valores = conNuevo || quedaNuevo[i + 1] ? opciones[i].values : opciones[i].values.filter(v => esNuevo(v, i))
    for (const v of valores) ir(i + 1, [...prefijo, v], conNuevo || esNuevo(v, i))
  }
  if (quedaNuevo[0]) ir(0, [], false)
  return r
}

/**
 * Las opciones como quedarán y las combinaciones a crear. Se cuenta ANTES de generar (nunca se arma un arreglo enorme):
 * - las que llevan algún valor nuevo (total − producto de los valores viejos; en una opción nueva, el «viejo» es el que toman las
 *   existentes) van marcadas; si pasan de 250, `noCaben` y no se generan. Que las MARCADAS quepan con las vivas (`caben`) lo cuida
 *   quien pinta la tabla;
 * - las de puros valores viejos que faltan sólo se cuentan (`faltantes`) y se generan, desmarcadas, con `verFaltantes` y si caben: pueden
 *   ser combinaciones que el dueño nunca quiso o archivadas (el server rechaza recrear una archivada).
 */
export function planDeCrecimiento(f: ProductGroupDetail, c: Crecimiento, verFaltantes = false): PlanDeCrecimiento {
  const existentes = [...f.options].sort((a, b) => a.position - b.position)
  const opciones: OpcionEditable[] = existentes.map(o => ({
    name: o.name,
    values: [...[...o.values].sort((a, b) => a.position - b.position).map(v => v.value), ...(c.nuevosValores[o.name] ?? [])],
  }))
  if (c.nuevaOpcion) opciones.push({ name: c.nuevaOpcion.name, values: c.nuevaOpcion.values })
  const limpias = limpiarOpciones(opciones)
  const caben = Math.max(0, MAX_VARIANTES - f.variants.length)
  const vacio = { opciones: limpias, filas: [] as FilaVariante[], faltantes: 0, faltantesCaben: false, caben }
  const p = validarOpciones(limpias, false)
  if (p) return { ...vacio, problema: p }
  const nueva = c.nuevaOpcion ? limpias.length - 1 : -1
  const paraExistentes = c.nuevaOpcion ? norm(c.nuevaOpcion.paraExistentes) : ''
  if (c.nuevaOpcion && !limpias[nueva].values.some(v => norm(v) === paraExistentes)) return { ...vacio, problema: { code: 'valorParaExistentes' } }
  const viejos = existentes.map(o => new Set(o.values.map(v => norm(v.value))))
  // Un valor repetido de uno viejo (aun con otras mayúsculas) ya lo quitó limpiarOpciones: aquí «nuevo» es de verdad nuevo.
  const esNuevo = (valor: string, i: number) => (i === nueva ? norm(valor) !== paraExistentes : !viejos[i]?.has(norm(valor)))
  const soloViejos = limpias.map((o, i) => ({ ...o, values: o.values.filter(v => !esNuevo(v, i)) }))
  const productoViejo = contarCombinaciones(soloViejos)
  const conNuevo = contarCombinaciones(limpias) - productoViejo
  if (conNuevo > MAX_VARIANTES) return { ...vacio, problema: { code: 'noCaben', count: conNuevo, vivas: f.variants.length, caben } }
  const vivas = new Set(f.variants.map(v => llaveDeCombinacion(c.nuevaOpcion ? [...v.values, c.nuevaOpcion.paraExistentes] : v.values)))
  const faltantes = Math.max(0, productoViejo - vivas.size)
  if (conNuevo === 0 && !c.nuevaOpcion && faltantes === 0) return { ...vacio, problema: { code: 'sinCambios' } }
  const faltantesCaben = faltantes <= MAX_VARIANTES - conNuevo
  const filas: FilaVariante[] = combinacionesConNuevo(limpias, esNuevo).map(values => ({ key: llaveDeCombinacion(values), values, incluida: true }))
  if (verFaltantes && faltantes > 0 && faltantesCaben)
    for (const values of generarCombinaciones(soloViejos, MAX_VARIANTES + vivas.size)) {
      const key = llaveDeCombinacion(values)
      if (!vivas.has(key)) filas.push({ key, values, incluida: false })
    }
  return { opciones: limpias, filas, problema: null, faltantes, faltantesCaben, caben }
}

/**
 * El body de `POST /:groupId/variants`. `variants` va aunque esté vacío (agregar sólo un eje o sólo valores es válido). Un valor
 * «nuevo» que ya existe en esa opción (aun con otras mayúsculas) no viaja.
 */
export function cuerpoDeCrecimiento(f: ProductGroupDetail, c: Crecimiento, filas: FilaVariante[], conInventario: boolean): AddVariantsBody {
  const yaEstan = new Map(f.options.map(o => [norm(o.name), new Set(o.values.map(v => norm(v.value)))]))
  const newValues = Object.entries(c.nuevosValores)
    .map(([optionName, values]) => ({
      optionName,
      values: limpiarOpciones([{ name: optionName, values }])[0].values.filter(v => !yaEstan.get(norm(optionName))?.has(norm(v))),
    }))
    .filter(x => x.values.length)
  const nueva = c.nuevaOpcion && limpiarOpciones([c.nuevaOpcion])[0]
  return {
    ...(newValues.length ? { newValues } : {}),
    ...(c.nuevaOpcion && nueva
      ? {
          newOptions: [{
            name: nueva.name,
            values: nueva.values,
            // El texto tal como quedó en la opción (el dueño pudo elegir «algodón» y escribir «Algodón»).
            defaultValueForExisting: nueva.values.find(v => norm(v) === norm(c.nuevaOpcion!.paraExistentes)) ?? c.nuevaOpcion.paraExistentes.trim(),
          }],
        }
      : {}),
    variants: filas.filter(x => x.incluida).map(x => filaParaServidor(x, conInventario)),
  }
}
