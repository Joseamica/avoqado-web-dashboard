/** Lo que hace falta saber de una consulta de TanStack (`useQuery` o `useInfiniteQuery`) para decir si su lista es de fiar. */
export type EstadoDeCarga = {
  isError: boolean
  isFetching: boolean
  isPaused: boolean
  error: unknown
  refetch: () => unknown
  isFetchNextPageError?: boolean
  fetchNextPage?: () => unknown
}

/**
 * Una lista vacía por un fallo no es un negocio sin datos. Sin internet la consulta se pausa en vez de fallar, y vuelve sola con
 * la red. Mientras se reintenta no cuenta: si vuelve a fallar, regresa.
 */
export function falloDeCarga(query: EstadoDeCarga | null): boolean {
  return !!query && ((query.isError && !query.isFetching) || query.isPaused)
}

/** El servidor dijo que ese registro no existe: reintentar no lo arregla. */
export function esNoEncontrado(error: unknown): boolean {
  return (error as { response?: { status?: number } } | null)?.response?.status === 404
}

/** Página de detalle: el registro no llegó, y no porque no exista. Un 404 de verdad sigue siendo su «no encontrado». */
export function detalleNoCargo(query: EstadoDeCarga & { data: unknown }): boolean {
  return query.data === undefined && falloDeCarga(query) && !esNoEncontrado(query.error)
}

/** `refetch` vuelve a leer las páginas guardadas, no la que nunca llegó: esa se pide con `fetchNextPage`. */
export function reintentarCarga(query: EstadoDeCarga): void {
  if (query.isFetchNextPageError && query.fetchNextPage) void query.fetchNextPage()
  else void query.refetch()
}
