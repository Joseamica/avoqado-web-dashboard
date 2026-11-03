import { useTranslation } from 'react-i18next'
import { SummaryQueryBoundary } from '@/components/SummaryQueryBoundary'
import { falloDeCarga, reintentarCarga, type EstadoDeCarga } from '@/lib/falloDeCarga'
import { esSinPermiso } from '@/lib/reintentoSinPermiso'

/** El aviso de que una lista no cargó. `hayDatos`: lo que se ve puede estar viejo o incompleto, pero sigue a la vista. */
export function AvisoDeCarga({ query, hayDatos }: { query: EstadoDeCarga | null; hayDatos: boolean }) {
  const { t } = useTranslation('common')
  if (!query || !falloDeCarga(query)) return null

  const sinPermiso = esSinPermiso(query.error)
  const message = t(sinPermiso ? 'loadFailure.forbidden' : hayDatos ? 'loadFailure.partial' : 'loadFailure.empty')
  return (
    <SummaryQueryBoundary isError message={message} retryLabel={t('retry')} onRetry={sinPermiso ? undefined : () => reintentarCarga(query)}>
      {null}
    </SummaryQueryBoundary>
  )
}
