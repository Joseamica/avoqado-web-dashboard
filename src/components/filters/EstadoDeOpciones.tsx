import { useTranslation } from 'react-i18next'
import { BotonReintentar } from '@/components/AvisoDeCarga'
import { Skeleton } from '@/components/ui/skeleton'
import { falloDeCarga, type EstadoDeCarga } from '@/lib/falloDeCarga'
import { esSinPermiso } from '@/lib/reintentoSinPermiso'

/** La lectura de donde salen las opciones de un filtro, si no es la de la lista. */
export type FuenteDeOpciones = EstadoDeCarga & { data?: unknown }

/**
 * Lo que un filtro dice de sus opciones según su lectura: en camino, caída (con o sin opciones anteriores) o sin opciones.
 * Sin `fuente` no se sabe si no hay o si aún no llegan: sin un texto del llamador, no se afirma «Sin resultados».
 */
export function EstadoDeOpciones({ fuente, hayOpciones, emptyLabel }: { fuente?: FuenteDeOpciones; hayOpciones: boolean; emptyLabel?: string }) {
  const { t } = useTranslation('common')
  if (fuente && falloDeCarga(fuente)) {
    return (
      <div role="alert" className="mb-2 p-2 text-center text-sm text-muted-foreground">
        <p>{t(esSinPermiso(fuente.error) ? 'loadFailure.forbidden' : hayOpciones ? 'loadFailure.partial' : 'loadFailure.empty')}</p>
        <BotonReintentar query={fuente} className="mt-2" />
      </div>
    )
  }
  if (hayOpciones) return null
  if (fuente && fuente.data === undefined && fuente.isFetching) return <Skeleton className="m-2 h-16" aria-busy="true" />
  return <p className="py-4 text-center text-sm text-muted-foreground">{emptyLabel ?? t('loadFailure.noOptions')}</p>
}
