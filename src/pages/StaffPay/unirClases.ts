import type { ClaseValoradaDto } from '@/types/staffPay'

/** Une páginas de cursor sin repetir una clase (dedup por id estable). */
export function unirClases(pages: Array<{ items: ClaseValoradaDto[] }> | undefined): ClaseValoradaDto[] {
  const vistas = new Map<string, ClaseValoradaDto>()
  for (const p of pages ?? []) for (const c of p.items) if (!vistas.has(c.classSessionId)) vistas.set(c.classSessionId, c)
  return [...vistas.values()]
}
