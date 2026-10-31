import { SKU_PATTERN } from '@/lib/validators/product'
import type { VariantRowInput } from '@/types/productGroup'

/** Topes del server (spec D13; variantNaming.ts). */
export const MAX_OPCIONES = 3
export const MAX_VALORES = 100
export const MAX_VARIANTES = 250
export const MAX_TEXTO_OPCION = 40
const MAX_DINERO = 10_000_000
const MAX_EXISTENCIAS = 1_000_000
export const MAX_CODIGO = 14
// La misma regla que la ficha y el servidor (espacio y punto desde D3, 30-oct).
const SKU_VALIDO = SKU_PATTERN
const DOS_DECIMALES = /^\d+(\.\d{1,2})?$/
/** Igual que el conector de Shopify y el server: espacio, punto medio, espacio. */
export const SEPARADOR = ' · '

export interface OpcionEditable {
  /** Identidad fija de la opción en el alta (no viaja al server): renombrarla no la cambia; quitarla y agregar otra, sí. */
  id?: string
  name: string
  values: string[]
}

export interface FilaVariante {
  key: string
  values: string[]
  incluida: boolean
  price?: number
  cost?: number
  sku?: string
  gtin?: string
  initialStock?: number
  /** Con qué opciones nació la fila (sus identificadores): sólo se conserva o hereda sobre ESAS opciones. No viaja al server. */
  deOpciones?: string
}

export type ProblemaDeOpciones =
  | { code: 'sinOpciones' }
  | { code: 'demasiadasOpciones' }
  | { code: 'opcionSinNombre' }
  | { code: 'opcionRepetida'; name: string }
  | { code: 'opcionSinValores'; name: string }
  | { code: 'demasiadosValores'; name: string }
  | { code: 'textoLargo'; text: string }
  | { code: 'demasiadasCombinaciones'; count: number }

export type ProblemaDeFila =
  | { code: 'sinFilas' }
  | { code: 'sinPrecio'; nombre: string }
  | { code: 'precioInvalido'; nombre: string }
  | { code: 'costoInvalido'; nombre: string }
  | { code: 'skuInvalido'; nombre: string }
  | { code: 'skuRepetido'; sku: string }
  | { code: 'codigoLargo'; nombre: string }
  | { code: 'existenciasInvalidas'; nombre: string }

export const norm = (s: string) => s.trim().toLocaleLowerCase('es-MX')
/** Precio o costo válido para el server: > 0, ≤ 10,000,000, hasta 2 decimales exactos (1e-7 y 19.999 no pasan). */
export const esDineroValido = (n: number | undefined) =>
  n !== undefined && Number.isFinite(n) && n > 0 && n <= MAX_DINERO && DOS_DECIMALES.test(String(n))
export const esSkuValido = (sku: string) => SKU_VALIDO.test(sku) && sku.length <= 64

export function limpiarOpciones(opciones: OpcionEditable[]): OpcionEditable[] {
  return opciones.map(o => {
    const vistos = new Set<string>()
    const values: string[] = []
    for (const v of o.values) {
      const t = v.trim()
      if (!t || vistos.has(norm(t))) continue
      vistos.add(norm(t))
      values.push(t)
    }
    return { name: o.name.trim(), values }
  })
}

export function contarCombinaciones(opciones: OpcionEditable[]): number {
  return opciones.length === 0 ? 0 : opciones.reduce((n, o) => n * o.values.length, 1)
}

/**
 * Recibe opciones YA limpias (limpiarOpciones). El primer problema que impide generar la tabla, o null. `conTope = false` omite el
 * tope de combinaciones (al AGREGAR a una familia, el tope es de variantes vivas, no de combinaciones posibles: Tarea 7).
 */
export function validarOpciones(opciones: OpcionEditable[], conTope = true): ProblemaDeOpciones | null {
  if (opciones.length === 0) return { code: 'sinOpciones' }
  if (opciones.length > MAX_OPCIONES) return { code: 'demasiadasOpciones' }
  const nombres = new Set<string>()
  for (const o of opciones) {
    if (!o.name) return { code: 'opcionSinNombre' }
    if (o.name.length > MAX_TEXTO_OPCION) return { code: 'textoLargo', text: o.name }
    if (nombres.has(norm(o.name))) return { code: 'opcionRepetida', name: o.name }
    nombres.add(norm(o.name))
    if (o.values.length === 0) return { code: 'opcionSinValores', name: o.name }
    if (o.values.length > MAX_VALORES) return { code: 'demasiadosValores', name: o.name }
    const largo = o.values.find(v => v.length > MAX_TEXTO_OPCION)
    if (largo) return { code: 'textoLargo', text: largo }
  }
  const count = contarCombinaciones(opciones)
  return conTope && count > MAX_VARIANTES ? { code: 'demasiadasCombinaciones', count } : null
}

/** Todas las combinaciones, en el orden de las opciones. Lanza si pasan de `max`: cuenta ANTES con validarOpciones. */
export function generarCombinaciones(opciones: OpcionEditable[], max = MAX_VARIANTES): string[][] {
  if (contarCombinaciones(opciones) > max) throw new Error(`Más de ${max} combinaciones`)
  return opciones.reduce<string[][]>((acc, o) => acc.flatMap(prefijo => o.values.map(v => [...prefijo, v])), [[]])
}

export const llaveDeCombinacion = (values: string[]) => JSON.stringify(values.map(norm))
export const nombreDeVariante = (padre: string, values: string[]) => [padre.trim(), ...values].join(SEPARADOR)

/** Igual que `suggestSku` del server. Es sólo la sugerencia visible: si choca, el server agrega -2, -3… */
export function sugerirSku(padre: string, values: string[]): string {
  return [padre, ...values]
    .join('-')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/, '')
}

/**
 * Regenera las filas (opciones YA válidas) y conserva lo tecleado en cada combinación que sigue existiendo. Al agregar una opción (el
 * asistente sólo agrega al final), cada fila pasa 1 a 1 al PRIMER valor de la opción nueva con su precio, costo e «incluida»
 * («S» → «S · Rojo»), como Shopify; los demás valores («S · Azul») salen vacíos. Decisión del founder (19-oct): nunca adivinar un
 * precio. Quitar una opción o renombrar un valor tampoco hereda. SKU, código y existencias nunca: son de una sola variante.
 */
export function sincronizarFilas(opciones: OpcionEditable[], previas: FilaVariante[], ids?: (string | undefined)[]): FilaVariante[] {
  const porLlave = new Map(previas.map(f => [f.key, f]))
  // `ids` (de las opciones sin limpiar) son la identidad de cada opción; sin ellos, el nombre.
  const identidad = opciones.map((o, i) => ids?.[i] ?? norm(o.name))
  const deOpciones = JSON.stringify(identidad)
  const deOpcionesAntes = JSON.stringify(identidad.slice(0, -1)) // las mismas opciones, sin la que se acaba de agregar
  const primeroDeLaUltima = norm(opciones[opciones.length - 1]?.values[0] ?? '')
  return generarCombinaciones(opciones).map(values => {
    const key = llaveDeCombinacion(values)
    const previa = porLlave.get(key)
    // Mismos valores pero de OTRAS opciones (se quitó Talla y la «m» es de Modelo) no es la misma combinación.
    if (previa && (previa.deOpciones === undefined || previa.deOpciones === deOpciones)) return { ...previa, values, deOpciones }
    const origen =
      values.length > 1 && norm(values[values.length - 1]) === primeroDeLaUltima
        ? porLlave.get(llaveDeCombinacion(values.slice(0, -1)))
        : undefined
    return origen && origen.deOpciones === deOpcionesAntes
      ? { key, values, incluida: origen.incluida, price: origen.price, cost: origen.cost, deOpciones }
      : { key, values, incluida: true, deOpciones }
  })
}

/** Para la vista previa del alta: cuántas variantes van y el rango de los precios ya capturados. */
export function resumenDeFamilia(filas: FilaVariante[]): { count: number; min?: number; max?: number } {
  const incluidas = filas.filter(f => f.incluida)
  const precios = incluidas.map(f => f.price).filter((p): p is number => p !== undefined)
  return precios.length
    ? { count: incluidas.length, min: Math.min(...precios), max: Math.max(...precios) }
    : { count: incluidas.length }
}

export function validarFilas(padre: string, filas: FilaVariante[], conInventario: boolean): ProblemaDeFila | null {
  const incluidas = filas.filter(f => f.incluida)
  if (incluidas.length === 0) return { code: 'sinFilas' }
  const skus = new Set<string>()
  for (const f of incluidas) {
    const nombre = nombreDeVariante(padre, f.values)
    if (f.price === undefined) return { code: 'sinPrecio', nombre }
    if (!esDineroValido(f.price)) return { code: 'precioInvalido', nombre }
    if (f.cost !== undefined && !esDineroValido(f.cost)) return { code: 'costoInvalido', nombre }
    const sku = f.sku?.trim()
    if (sku) {
      if (!esSkuValido(sku)) return { code: 'skuInvalido', nombre }
      if (skus.has(sku)) return { code: 'skuRepetido', sku } // exacto, como el server (@@unique([venueId, sku]))
      skus.add(sku)
    }
    if ((f.gtin?.trim().length ?? 0) > MAX_CODIGO) return { code: 'codigoLargo', nombre }
    if (conInventario && f.initialStock !== undefined && (!Number.isInteger(f.initialStock) || f.initialStock < 0 || f.initialStock > MAX_EXISTENCIAS))
      return { code: 'existenciasInvalidas', nombre }
  }
  return null
}

/** Contrato: SKU vacío se OMITE (el server rechaza ""), costo vacío se omite, existencias sólo con inventario. */
export function filaParaServidor(f: FilaVariante, conInventario: boolean): VariantRowInput {
  const sku = f.sku?.trim()
  const gtin = f.gtin?.trim()
  return {
    values: f.values,
    price: f.price as number,
    ...(f.cost !== undefined ? { cost: f.cost } : {}),
    ...(sku ? { sku } : {}),
    ...(gtin ? { gtin } : {}),
    ...(conInventario && f.initialStock !== undefined ? { initialStock: f.initialStock } : {}),
  }
}
