import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { SummaryQueryBoundary } from '@/components/SummaryQueryBoundary'
import { esNoEncontrado, falloDeCarga, reintentarCarga, reintentarSirve, type EstadoDeCarga } from '@/lib/falloDeCarga'
import { esSinPermiso } from '@/lib/reintentoSinPermiso'

/** «Reintentar» para un aviso con texto propio. Reintentar no arregla un 403 ni un 404: ahí no sale. */
export function BotonReintentar({ query, className }: { query: EstadoDeCarga; className?: string }) {
  const { t } = useTranslation('common')
  if (!reintentarSirve(query.error)) return null
  return (
    <Button type="button" variant="outline" size="sm" className={className} onClick={() => reintentarCarga(query)}>
      {t('retry')}
    </Button>
  )
}

/**
 * El aviso de que una lista no cargó. `hayDatos`: lo que se ve puede estar viejo o incompleto, pero sigue a la vista.
 * `volverAlInicio`: la salida si falló una página que no es la primera y la pantalla ya no tiene su paginador.
 * `deUnRegistro`: la lectura es de UN registro (no de una lista): su 404 dice que ya no existe, y reintentar no lo arregla.
 */
export function AvisoDeCarga({
  query,
  hayDatos,
  volverAlInicio,
  deUnRegistro,
}: {
  query: EstadoDeCarga | null
  hayDatos: boolean
  volverAlInicio?: () => void
  deUnRegistro?: boolean
}) {
  const { t } = useTranslation('common')
  if (!query || !falloDeCarga(query)) return null

  const sinPermiso = esSinPermiso(query.error)
  const noExiste = !!deUnRegistro && esNoEncontrado(query.error)
  const message = t(sinPermiso ? 'loadFailure.forbidden' : noExiste ? 'loadFailure.notFound' : hayDatos ? 'loadFailure.partial' : 'loadFailure.empty')
  return (
    <>
      <SummaryQueryBoundary isError message={message} retryLabel={t('retry')} onRetry={sinPermiso || noExiste ? undefined : () => reintentarCarga(query)}>
        {null}
      </SummaryQueryBoundary>
      {volverAlInicio && (
        <Button type="button" variant="outline" size="sm" className="mb-4" onClick={volverAlInicio}>
          {t('loadFailure.backToFirstPage')}
        </Button>
      )}
    </>
  )
}
