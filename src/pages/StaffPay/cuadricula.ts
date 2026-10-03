import type { CeldaDto } from '@/types/staffPay'

export type Cuadricula = Record<string, Array<number | undefined>>

export function cuadriculaDesdeCeldas(celdas: CeldaDto[], niveles: string[], maxCount: number): Cuadricula {
  const c: Cuadricula = {}
  for (const n of niveles) c[n] = Array.from({ length: maxCount + 1 }, () => undefined)
  for (const cel of celdas) if (c[cel.payLevelId] && cel.count <= maxCount) c[cel.payLevelId][cel.count] = cel.amount
  return c
}

export function celdasDesdeCuadricula(c: Cuadricula): CeldaDto[] {
  const out: CeldaDto[] = []
  for (const [payLevelId, filas] of Object.entries(c)) filas.forEach((amount, count) => { if (amount !== undefined) out.push({ payLevelId, count, amount }) })
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
