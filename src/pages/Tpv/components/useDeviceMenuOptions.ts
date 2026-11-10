import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { getDeviceMenuOptions } from '@/services/deviceMenus.service'

export const OPTIONS_PAGE_SIZE = 100
export type DeviceMenuChoice = { value: string; label: string; description?: string }

/** Opciones de menú paginadas y con búsqueda en el servidor; las usan la pestaña Menús y el editor cuando carga solo. */
export function useDeviceMenuOptions(venueId: string, search: string, enabled = true) {
  const { t } = useTranslation('tpv')
  const query = useInfiniteQuery({
    queryKey: ['device-menu-options', venueId, search],
    queryFn: ({ pageParam }) => getDeviceMenuOptions(venueId, { search: search || undefined, page: pageParam, pageSize: OPTIONS_PAGE_SIZE }),
    initialPageParam: 1,
    // Sin `last.menus.length` una página vacía (se borraron menús) pediría «más» para siempre.
    getNextPageParam: (last, all) =>
      last.menus.length > 0 && all.reduce((n, p) => n + p.menus.length, 0) < last.total ? all.length + 1 : undefined,
    // La búsqueda va en la llave: sin esto cada tecla vacía las opciones (bounded-data-and-query-load.md).
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
    enabled: enabled && !!venueId,
  })

  const options = useMemo<DeviceMenuChoice[]>(() => {
    // Por id: si un menú se movió de página entre una lectura y otra, no sale dos veces.
    const vistos = new Set<string>()
    return (query.data?.pages ?? [])
      .flatMap(p => p.menus)
      .filter(m => !vistos.has(m.id) && !!vistos.add(m.id))
      .map(m => ({
        value: m.id,
        label: m.name,
        // Categorías DIRECTAS del menú: no es la cuenta de «En su pantalla ve» (ésa suma subcategorías con productos).
        description: t('deviceMenus.categoriasDelMenu', { count: m.categoryCount }),
      }))
  }, [query.data, t])

  const pages = query.data?.pages ?? []
  const total = pages[pages.length - 1]?.total ?? 0
  return { query, options, total }
}
