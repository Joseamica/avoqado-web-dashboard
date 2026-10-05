import type { CeldaDto } from '@/types/staffPay'

export type Cuadricula = Record<string, Array<number | undefined>>

export function cuadriculaDesdeCeldas(celdas: CeldaDto[], niveles: string[], maxCount: number): Cuadricula {
  const c: Cuadricula = {}
  for (const n of niveles) c[n] = Array.from({ length: maxCount + 1 }, () => undefined)
  for (const cel of celdas) if (c[cel.payLevelId] && cel.count <= maxCount) c[cel.payLevelId][cel.count] = cel.amount
  return c
}

/** Con `maxCount`, deja fuera las filas por encima del techo (la cuadrícula en edición puede guardarlas para no perderlas). */
export function celdasDesdeCuadricula(c: Cuadricula, maxCount?: number): CeldaDto[] {
  const out: CeldaDto[] = []
  for (const [payLevelId, filas] of Object.entries(c)) filas.forEach((amount, count) => { if (amount !== undefined && (maxCount === undefined || count <= maxCount)) out.push({ payLevelId, count, amount }) })
  return out
}

export function rellenarHaciaAbajo(c: Cuadricula, payLevelId: string, desde: number, hasta: number): Cuadricula {
  const filas = [...(c[payLevelId] ?? [])]
  const valor = filas[desde]
  for (let i = desde + 1; i <= hasta && i < filas.length; i++) filas[i] = valor
  return { ...c, [payLevelId]: filas }
}

export function simular(c: Cuadricula, payLevelId: string, lugares: number, maxCount: number): { monto: number | null; filaUsada: number } {
  const filaUsada = Math.min(Math.max(lugares, 0), maxCount)
  const v = c[payLevelId]?.[filaUsada]
  return { monto: v === undefined ? null : v, filaUsada }
}

export function faltantes(c: Cuadricula, maxCount: number): number {
  let n = 0
  for (const filas of Object.values(c)) for (let i = 0; i <= maxCount; i++) if (filas[i] === undefined) n++
  return n
}

export function redimensionar(c: Cuadricula, maxCount: number): Cuadricula {
  const out: Cuadricula = {}
  for (const [k, filas] of Object.entries(c)) out[k] = Array.from({ length: maxCount + 1 }, (_, i) => filas[i])
  return out
}

/** Como `redimensionar`, pero NUNCA recorta: sólo agrega filas vacías. Para editar el techo sin perder montos al teclear. */
export function ampliar(c: Cuadricula, maxCount: number): Cuadricula {
  const out: Cuadricula = {}
  for (const [k, filas] of Object.entries(c)) out[k] = filas.length > maxCount ? filas : Array.from({ length: maxCount + 1 }, (_, i) => filas[i])
  return out
}
