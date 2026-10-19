import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { useCallback } from 'react'
import * as svc from '@/services/productGroups.service'
import type { Paged } from '@/types/productGroup'
import { productGroupKeys } from './queryKeys'

const CONSULTA = { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } as const
// Tolerante a una respuesta sin la forma paginada (un server viejo o una simulación): sin esto, React Query llama esto al pintar y
// la excepción tumbaba la pantalla de Productos entera por culpa del aviso de sugerencias.
const siguiente = <T>(last: Paged<T> | undefined) => (last?.page && last.page * last.pageSize < last.total ? last.page + 1 : undefined)

/** Une las páginas sin repetidos (una página puede moverse si alguien agrega mientras tanto). */
export function unirPaginas<T>(data: InfiniteData<Paged<T>> | undefined, id: (x: T) => string): { items: T[]; total: number } {
  const vistos = new Set<string>()
  const items: T[] = []
  for (const p of data?.pages ?? [])
    for (const x of p?.items ?? []) {
      const k = id(x)
      if (vistos.has(k)) continue
      vistos.add(k)
      items.push(x)
    }
  const ultima = data?.pages[data.pages.length - 1] // `lib` del repo es ES2020: sin Array.prototype.at
  return { items, total: ultima?.total ?? 0 }
}

export function useProductGroup(venueId: string | null | undefined, groupId: string | null | undefined) {
  return useQuery({
    queryKey: productGroupKeys.detail(venueId ?? '', groupId ?? ''),
    queryFn: () => svc.getProductGroup(venueId!, groupId!),
    enabled: !!venueId && !!groupId,
    ...CONSULTA,
  })
}

export function useArchivedVariants(venueId: string | null | undefined, groupId: string | null | undefined, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: productGroupKeys.archived(venueId ?? '', groupId ?? ''),
    queryFn: ({ pageParam }) => svc.getArchivedVariants(venueId!, groupId!, { page: pageParam, pageSize: 25 }),
    initialPageParam: 1,
    getNextPageParam: siguiente,
    enabled: !!venueId && !!groupId && enabled,
    ...CONSULTA,
  })
}

export function useGroupSuggestions(venueId: string | null | undefined, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: productGroupKeys.suggestions(venueId ?? ''),
    queryFn: ({ pageParam }) => svc.getGroupSuggestions(venueId!, { page: pageParam, pageSize: 20 }),
    initialPageParam: 1,
    getNextPageParam: siguiente,
    enabled: !!venueId && enabled,
    ...CONSULTA,
    staleTime: 5 * 60_000,
  })
}

export function useOptionLibrary(venueId: string | null | undefined, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: productGroupKeys.optionLibrary(venueId ?? ''),
    queryFn: ({ pageParam }) => svc.listOptionLibrary(venueId!, { page: pageParam, pageSize: 25 }),
    initialPageParam: 1,
    getNextPageParam: siguiente,
    enabled: !!venueId && enabled,
    ...CONSULTA,
  })
}

/**
 * Las consultas que muestran nombres, familias o existencias de productos de un negocio. Agrupar, renombrar, separar, archivar o crecer
 * cambia lo que cualquiera de ellas pinta; sin esto, el reporte o el ruteo enseñan los nombres de antes hasta 5 min (Codex C3).
 */
export const lectoresDelCatalogo = (venueId: string) => [
  ['products', venueId], // lista, familias (detalle, archivadas, sugerencias), Stock de productos, Resumen de existencias
  ['product', venueId], // ficha /menumaker/products/:id
  ['product-detail', venueId], // asistente de producto en modo edición
  ['salesByItem', 'report', { venueId }], // Ventas por artículo (el negocio va dentro de los filtros)
  ['chart', 'best-selling-products', venueId], // Más vendidos del inicio
  ['printRouting', venueId], // Ruteo de impresoras
  ['products-with-recipes', venueId], // Recetas (nombres de las variantes)
  ['productInventoryMovements', venueId], // Movimientos recientes de un producto
]

/** Después de CUALQUIER escritura de familia: relee todo lo que la muestra (sólo se vuelve a pedir lo que está en pantalla). */
export function useInvalidarCatalogo() {
  const qc = useQueryClient()
  return useCallback(
    (venueId: string) => Promise.all(lectoresDelCatalogo(venueId).map(queryKey => qc.invalidateQueries({ queryKey }))),
    [qc],
  )
}
