import type { DateFilter } from '@/components/filters'

/**
 * El exporte del Historial de inventario corre en el SERVIDOR (carril en segundo plano) y sólo entiende
 * lo que el servidor sabe filtrar: búsqueda, UN tipo y un rango de fechas. Estas piezas puras traducen lo
 * que el usuario tiene puesto en la página a eso, sin esconder lo que el archivo no puede respetar.
 */

const DIA_MS = 24 * 60 * 60 * 1000
/** Sin filtro de fecha en la página, el archivo propone los últimos 30 días (se cambia en el diálogo). */
export const DIAS_POR_OMISION = 30

const inicioDelDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
const finDelDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
const leer = (v: unknown): Date | null => {
  if (typeof v !== 'string' || !v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * El rango con el que abre el diálogo de exportar: el filtro de fecha de la página traducido a «desde-hasta»,
 * con las mismas reglas con que la página filtra la tabla. Sin filtro (o uno que no se puede leer), los
 * últimos 30 días.
 */
export function rangoInicialDelExporte(filtro: DateFilter | null, ahora: Date = new Date()): { from: Date; to: Date } {
  const porOmision = { from: inicioDelDia(new Date(ahora.getTime() - DIAS_POR_OMISION * DIA_MS)), to: ahora }
  if (!filtro) return porOmision

  switch (filtro.operator) {
    case 'last': {
      const n = typeof filtro.value === 'number' ? filtro.value : parseInt(String(filtro.value ?? ''), 10) || 0
      if (n <= 0) return porOmision
      const desde = new Date(ahora)
      if (filtro.unit === 'hours') desde.setHours(desde.getHours() - n)
      else if (filtro.unit === 'weeks') desde.setDate(desde.getDate() - n * 7)
      else if (filtro.unit === 'months') desde.setMonth(desde.getMonth() - n)
      else desde.setDate(desde.getDate() - n)
      return { from: desde, to: ahora }
    }
    case 'between': {
      const a = leer(filtro.value)
      const b = leer(filtro.value2)
      if (!a || !b) return porOmision
      return { from: a, to: finDelDia(b) }
    }
    case 'after': {
      const a = leer(filtro.value)
      return a ? { from: a, to: ahora } : porOmision
    }
    case 'before': {
      const b = leer(filtro.value)
      return b ? { from: inicioDelDia(new Date(b.getTime() - DIAS_POR_OMISION * DIA_MS)), to: b } : porOmision
    }
    case 'on': {
      const d = leer(filtro.value)
      return d ? { from: inicioDelDia(d), to: finDelDia(d) } : porOmision
    }
    default:
      return porOmision
  }
}

/**
 * Qué filtros de la página NO llegan al archivo: SKU, proveedor y coste total se aplican sólo a la página que
 * se ve, y el servidor filtra a lo más UN tipo. Se le dice al usuario en el diálogo en vez de entregarle un
 * archivo que parezca filtrado y no lo esté.
 */
export function filtrosQueNoLleganAlArchivo(f: {
  sku: string[]
  proveedor: string[]
  costeTotal: unknown
  tipos: string[]
}): Array<'sku' | 'provider' | 'totalCost' | 'type'> {
  const fuera: Array<'sku' | 'provider' | 'totalCost' | 'type'> = []
  if (f.sku.length > 0) fuera.push('sku')
  if (f.proveedor.length > 0) fuera.push('provider')
  if (f.costeTotal !== null && f.costeTotal !== undefined) fuera.push('totalCost')
  if (f.tipos.length > 1) fuera.push('type')
  return fuera
}
