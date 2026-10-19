import type { Product } from '@/types'
import { ALLOWED_GROUP_TYPES, type GroupExistingBody } from '@/types/productGroup'
import { MAX_OPCIONES, MAX_TEXTO_OPCION, MAX_VALORES, MAX_VARIANTES, SEPARADOR, llaveDeCombinacion, norm } from './combinations'

export interface MiembroAgrupar {
  productId: string
  name: string
  sku?: string
  values: string[]
}
export interface EstadoAgrupar {
  name: string
  categoryId?: string
  optionNames: string[]
  members: MiembroAgrupar[]
}
export type ProblemaDeAgrupar =
  | { code: 'sinNombre' }
  | { code: 'nombreLargo' }
  | { code: 'sinMiembros' }
  | { code: 'demasiadosMiembros' }
  | { code: 'sinOpciones' }
  | { code: 'demasiadasOpciones' }
  | { code: 'opcionSinNombre' }
  | { code: 'opcionRepetida'; name: string }
  | { code: 'valorVacio'; producto: string }
  | { code: 'textoLargo'; text: string }
  | { code: 'demasiadosValores'; name: string }
  | { code: 'combinacionRepetida'; combo: string }

/** Sólo productos sueltos de tipos físicos o de consumo (servicios, clases y eventos no llevan variantes). */
export const esAgrupable = (p: Pick<Product, 'type' | 'productGroupId'>) =>
  !p.productGroupId && (ALLOWED_GROUP_TYPES as readonly string[]).includes(String(p.type))

/** El body de la vista previa y del apply, con las mismas reglas que el server; el primer problema gana. */
export function cuerpoDeAgrupar(e: EstadoAgrupar): { ok: true; body: GroupExistingBody } | { ok: false; problema: ProblemaDeAgrupar } {
  const fallo = (problema: ProblemaDeAgrupar) => ({ ok: false as const, problema })
  const name = e.name.trim()
  if (!name) return fallo({ code: 'sinNombre' })
  if (name.length > 120) return fallo({ code: 'nombreLargo' })
  if (e.members.length === 0) return fallo({ code: 'sinMiembros' })
  if (e.members.length > MAX_VARIANTES) return fallo({ code: 'demasiadosMiembros' })
  const nombres = e.optionNames.map(n => n.trim())
  if (nombres.length === 0) return fallo({ code: 'sinOpciones' })
  if (nombres.length > MAX_OPCIONES) return fallo({ code: 'demasiadasOpciones' })
  const vistos = new Set<string>()
  for (const n of nombres) {
    if (!n) return fallo({ code: 'opcionSinNombre' })
    if (n.length > MAX_TEXTO_OPCION) return fallo({ code: 'textoLargo', text: n })
    if (vistos.has(norm(n))) return fallo({ code: 'opcionRepetida', name: n })
    vistos.add(norm(n))
  }
  const members = e.members.map(m => ({ productId: m.productId, values: nombres.map((_, i) => (m.values[i] ?? '').trim()) }))
  const combos = new Set<string>()
  for (const [k, m] of members.entries()) {
    if (m.values.some(v => !v)) return fallo({ code: 'valorVacio', producto: e.members[k].name })
    const largo = m.values.find(v => v.length > MAX_TEXTO_OPCION)
    if (largo) return fallo({ code: 'textoLargo', text: largo })
    const llave = llaveDeCombinacion(m.values)
    if (combos.has(llave)) return fallo({ code: 'combinacionRepetida', combo: m.values.join(SEPARADOR) })
    combos.add(llave)
  }
  const options = nombres.map((n, i) => {
    const valores: string[] = []
    const ya = new Set<string>()
    for (const m of members)
      if (!ya.has(norm(m.values[i]))) {
        ya.add(norm(m.values[i]))
        valores.push(m.values[i])
      }
    return { name: n, values: valores }
  })
  const muchos = options.find(o => o.values.length > MAX_VALORES)
  if (muchos) return fallo({ code: 'demasiadosValores', name: muchos.name })
  return { ok: true, body: { name, ...(e.categoryId ? { categoryId: e.categoryId } : {}), options, members } }
}

/**
 * «Playera · S» y «MODELO - Talla 34»: los dos patrones reales (importadores de Shopify y catálogo de IQ). Si no hay prefijo común, vacío.
 * Con «- Talla N» también dice cómo se llama la opción (`opcion: 'Talla'`).
 */
export function sugerirDesdeNombres(nombres: string[]): { parentName: string; valores: string[]; opcion?: string } {
  const talla = nombres.map(n => /^(.*?)\s+-\s+Talla\s+(.+)$/i.exec(n.trim()))
  if (talla.every(Boolean) && new Set(talla.map(x => norm(x![1]))).size === 1)
    return { parentName: talla[0]![1].trim(), valores: talla.map(x => x![2].trim()), opcion: 'Talla' }
  const partes = nombres.map(n => n.split(SEPARADOR))
  if (partes.every(p => p.length > 1) && new Set(partes.map(p => norm(p[0]))).size === 1)
    return { parentName: partes[0][0].trim(), valores: partes.map(p => p.slice(1).join(SEPARADOR).trim()) }
  return { parentName: '', valores: nombres.map(() => '') }
}

/**
 * Con UNA opción cuyos valores son todos «S · Azul» (2 o 3 partes, las mismas en todos), arranca con una columna por parte y nombres
 * vacíos para que el dueño los escriba. Si no, devuelve el mismo estado.
 */
export function partirEnOpciones(e: EstadoAgrupar): EstadoAgrupar {
  if (e.optionNames.length !== 1 || e.members.length === 0) return e
  const partes = e.members.map(m => (m.values[0] ?? '').split(SEPARADOR).map(p => p.trim()))
  const n = partes[0].length
  if (n < 2 || n > MAX_OPCIONES || partes.some(p => p.length !== n)) return e
  return {
    ...e,
    optionNames: Array.from({ length: n }, (_, i) => (i === 0 ? e.optionNames[0] : '')),
    members: e.members.map((m, k) => ({ ...m, values: partes[k] })),
  }
}
