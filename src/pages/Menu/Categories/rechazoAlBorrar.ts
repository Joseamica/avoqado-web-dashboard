import type { TFunction } from 'i18next'

import { textoDelServidor } from '@/utils/apiError'

/**
 * Lo que dice el aviso cuando el servidor NO deja eliminar una categoría (encargo 08cc59, 15-nov).
 *
 * Antes la ventana se cerraba y no salía nada: el dueño no sabía si se había borrado ni por qué no. El servidor manda un
 * código (`CATEGORY_HAS_PRODUCTS` / `CATEGORY_HAS_SUBCATEGORIES`) con los números y los nombres; aquí se arma el texto en
 * el idioma del panel. Un código que no conocemos usa el texto del servidor (ya en español), y sin respuesta (red, 5xx) el
 * genérico.
 */
export function rechazoAlBorrarCategoria(error: unknown, categoria: string, t: TFunction): string {
  const data = (error as { response?: { data?: { code?: unknown; details?: unknown } } } | null | undefined)?.response?.data
  const details = (data?.details ?? {}) as { productos?: unknown; pausados?: unknown; ejemplos?: unknown; subcategorias?: unknown }

  if (data?.code === 'CATEGORY_HAS_PRODUCTS' && typeof details.productos === 'number') {
    const total = details.productos
    const pausados = typeof details.pausados === 'number' ? details.pausados : 0
    const ejemplos = Array.isArray(details.ejemplos) ? details.ejemplos.filter((n): n is string => typeof n === 'string') : []
    const resto = total - ejemplos.length
    const lista =
      ejemplos.length === 0
        ? ''
        : resto > 0
          ? t('categoryDetail.deleteBlocked.listWithMore', { names: ejemplos.join(', '), count: resto })
          : t('categoryDetail.deleteBlocked.list', { names: ejemplos.join(', ') })
    const nota =
      pausados === 0
        ? ''
        : pausados === total
          ? t('categoryDetail.deleteBlocked.allPaused', { count: total })
          : t('categoryDetail.deleteBlocked.somePaused', { count: pausados })
    return [
      t('categoryDetail.deleteBlocked.products', { name: categoria, count: total, paused: nota, list: lista }),
      pausados > 0 ? t('categoryDetail.deleteBlocked.pausedCount') : '',
      t('categoryDetail.deleteBlocked.productsAction', { count: total }),
    ]
      .filter(Boolean)
      .join(' ')
  }

  if (data?.code === 'CATEGORY_HAS_SUBCATEGORIES' && Array.isArray(details.subcategorias) && details.subcategorias.length > 0) {
    const nombres = details.subcategorias.filter((n): n is string => typeof n === 'string')
    return t('categoryDetail.deleteBlocked.subcategories', { name: categoria, count: nombres.length, names: nombres.join(', ') })
  }

  return textoDelServidor(error) ?? t('categoryDetail.deleteBlocked.generic')
}
