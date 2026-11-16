import { useTranslation } from 'react-i18next'
import { SummaryQueryBoundary } from '@/components/SummaryQueryBoundary'

/**
 * El servidor contestó, pero no pudo leer todos los cobros del sistema anterior de QR (el puente legacy de Mindform) y lo marcó
 * con `legacyUnavailable`: el total a la vista puede estar incompleto (D15). No bloquea: las cifras que sí llegaron siguen ahí.
 * Mismo aviso que `AvisoDeCarga`; aquélla habla de una consulta que falló, ésta de una que contestó a medias.
 */
export function AvisoCobrosQrIncompletos({ incompleto, onRetry }: { incompleto: boolean | undefined; onRetry?: () => void }) {
  const { t } = useTranslation('common')
  if (!incompleto) return null
  return (
    <SummaryQueryBoundary isError message={t('loadFailure.legacyQr')} retryLabel={t('retry')} onRetry={onRetry}>
      {null}
    </SummaryQueryBoundary>
  )
}
