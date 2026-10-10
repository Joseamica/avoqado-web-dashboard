import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export function Cargando() {
  const { t } = useTranslation('shopify')
  return (
    <div role="status" aria-label={t('common:loading')} className="flex justify-center py-8">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )
}

/** Un error nunca se pinta como «vacío»: dice que falló y deja reintentar (bounded-data-and-query-load.md). */
export function ErrorConReintento({ texto, onRetry, cargando }: { texto: string; onRetry: () => void; cargando: boolean }) {
  const { t } = useTranslation('shopify')
  return (
    <Alert variant="destructive">
      <AlertDescription>{texto}</AlertDescription>
      <Button variant="outline" size="sm" className="col-start-2 mt-2 justify-self-start" onClick={onRetry} disabled={cargando}>
        {t('common:retry')}
      </Button>
    </Alert>
  )
}

/** Lo que `ListaPaginada` necesita de un `useInfiniteQuery` (TanStack v5). */
export interface ListaQuery {
  data: unknown
  isLoading: boolean
  isError: boolean
  isRefetchError: boolean
  isFetchNextPageError: boolean
  isFetching: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  refetch: () => unknown
  fetchNextPage: () => unknown
}

/**
 * Los estados de una lista paginada en el servidor (Codex #37 y N4): cargando · primera carga fallida (error con
 * reintento, nunca «vacío») · datos viejos tras una actualización fallida (se dicen NO actualizados, y una lista vacía en
 * caché deja de decir «todo bien») · «Cargar más» fallido (se dice aparte; lo de arriba sigue) · vacío · datos con total.
 */
export function ListaPaginada({
  q,
  cuantos,
  total,
  vacio,
  textoError,
  children,
}: {
  q: ListaQuery
  cuantos: number
  total: number
  vacio: string
  textoError: string
  children: ReactNode
}) {
  const { t } = useTranslation('shopify')
  if (q.isLoading && !q.data) return <Cargando />
  if (q.isError && !q.data) return <ErrorConReintento texto={textoError} onRetry={() => q.refetch()} cargando={q.isFetching} />
  return (
    <>
      {q.isRefetchError && <ErrorConReintento texto={t('list.staleError')} onRetry={() => q.refetch()} cargando={q.isFetching} />}
      {cuantos === 0 ? (
        !q.isRefetchError && <p className="text-sm text-muted-foreground">{vacio}</p>
      ) : (
        <>
          {children}
          <p className="text-xs text-muted-foreground">{t('list.total', { shown: cuantos, total })}</p>
        </>
      )}
      {q.isFetchNextPageError ? (
        <Alert variant="destructive">
          <AlertDescription>{t('list.loadMoreError')}</AlertDescription>
          <Button
            variant="outline"
            size="sm"
            className="col-start-2 mt-2 justify-self-start"
            onClick={() => q.fetchNextPage()}
            disabled={q.isFetchingNextPage}
          >
            {t('list.retryLoadMore')}
          </Button>
        </Alert>
      ) : (
        q.hasNextPage &&
        cuantos > 0 && (
          <Button variant="outline" size="sm" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
            {q.isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('list.loadMore')}
          </Button>
        )
      )}
    </>
  )
}
